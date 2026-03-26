import { App, type CustomRoute } from "@slack/bolt";
import { config } from "./config";
import { EloDb } from "./db";
import { ensureLeaderboardCanvas, updateLeaderboardCanvas } from "./canvas";
import { formatAdjustEloConfirmation, formatSnipeConfirmation, formatUndoConfirmation } from "./snipe";
import {
  isLikelyImageMessage,
  isProcessableUserMessageEvent,
  normalizeCommandText,
  parseMentionedUserIdsFromMessageEvent,
  parseUserToken,
} from "./parse";
import { opsLog } from "./opsLog";
import { isSlashCommandBody } from "./slashCommands";
import { SLACK_GUILD_ID } from "./tenants";

function uniquePreserveOrder<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of arr) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

async function resolveUserTokensToIds(args: { client: any; tokens: string[] }): Promise<string[]> {
  // Basic implementation: only supports Slack mention IDs (<@U...>) or raw IDs (U...).
  // Username resolution is intentionally omitted for safety/simplicity.
  const ids: string[] = [];
  for (const t of args.tokens) {
    const parsed = parseUserToken(t);
    if (!parsed.ok) throw new Error(`unrecognized_user_token:${parsed.reason}`);
    ids.push(parsed.userId);
  }
  return uniquePreserveOrder(ids);
}

/** Railway (and similar) probe $PORT; Socket Mode otherwise opens no HTTP server. */
const railwayHealthRoutes: CustomRoute[] = [
  {
    path: "/",
    method: "GET",
    handler: (_req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ok");
    },
  },
  {
    path: "/health",
    method: "GET",
    handler: (_req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ok");
    },
  },
];

export async function startSlackBot(params: {
  db: EloDb;
  logger?: Console;
}): Promise<void> {
  const appTokenRaw =
    process.env.SLACK_APP_TOKEN ?? process.env.SLACK_SOCKET_APP_TOKEN ?? process.env.SLACK_XAPP_TOKEN;
  const appToken =
    typeof appTokenRaw === "string" && appTokenRaw.trim().length > 0 ? appTokenRaw.trim() : undefined;
  const useSocketMode = Boolean(appToken);

  console.log(
    `[snipe-elo] PORT=${config.server.port} socketMode=${useSocketMode} appToken=${
      useSocketMode ? "set" : "MISSING — set SLACK_APP_TOKEN in Railway (xapp-…, connections:write)"
    }`
  );

  const app = new App({
    token: config.slack.botToken,
    signingSecret: config.slack.signingSecret,
    socketMode: useSocketMode,
    appToken,
    // For HTTP mode (non-socket-mode).
    port: config.server.port,
    customRoutes: railwayHealthRoutes,
  });

  const logger = params.logger ?? console;

  let leaderboardCanvasId: string | null = null;

  const ensureCanvasOnce = async () => {
    if (leaderboardCanvasId) return leaderboardCanvasId;
    leaderboardCanvasId = await ensureLeaderboardCanvas({ client: app.client, db: params.db });
    return leaderboardCanvasId;
  };

  const postToThread = async (channelId: string, threadTs: string, text: string) => {
    const res = await app.client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text,
    });
    return res?.ts as string | undefined;
  };

  const handleApplySnipe = async (args: {
    type: "snipe" | "makeup";
    channelId: string;
    threadTs: string;
    sourceMessageTs: string | null;
    sniperId: string;
    snipedIds: string[];
    // If true, bot will also react to the source message.
    reactSource?: boolean;
  }) => {
    opsLog("command.snipe.apply", {
      kind: args.type,
      channelId: args.channelId,
      threadTs: args.threadTs,
      sourceMessageTs: args.sourceMessageTs,
      sniperId: args.sniperId,
      snipedIds: args.snipedIds,
      reactSource: Boolean(args.reactSource),
    });
    const canvasId = await ensureCanvasOnce();

    const result = params.db.applySnipe({
      guildId: SLACK_GUILD_ID,
      type: args.type,
      channelId: args.channelId,
      threadTs: args.threadTs,
      sourceMessageTs: args.sourceMessageTs,
      sniperId: args.sniperId,
      snipedIds: args.snipedIds,
    });

    if (args.reactSource && args.sourceMessageTs) {
      await app.client.reactions.add({
        channel: args.channelId,
        timestamp: args.sourceMessageTs,
        name: config.slackOps.implicitSnipeEmoji,
      });
    }

    const confirmationText = formatSnipeConfirmation({
      kind: args.type === "makeup" ? "makeup" : "snipe",
      sniperId: args.sniperId,
      pairMatches: result.pairMatches,
      playerChanges: result.playerChanges,
    });

    const confirmationTs = await postToThread(args.channelId, args.threadTs, confirmationText);
    if (confirmationTs) {
      params.db.setConfirmationMessageTs(SLACK_GUILD_ID, result.snipeId, confirmationTs);
    }

    await updateLeaderboardCanvas({ client: app.client, db: params.db, canvasId });
    opsLog("command.snipe.done", {
      kind: args.type,
      snipeId: result.snipeId,
      channelId: args.channelId,
      threadTs: args.threadTs,
    });
  };

  // Main event router.
  app.event("message", async ({ event, client, logger: boltLogger }) => {
    try {
      const channelId: string | undefined = (event as any).channel;
      if (!channelId || channelId !== config.slack.channelId) return;

      if (!isProcessableUserMessageEvent(event)) return;

      const userId = ((event as any).user ??
        (event as any).file?.user ??
        (event as any).upload?.user) as string | undefined;
      const ts = (event as any).ts as string | undefined;
      const threadTs = (event as any).thread_ts as string | undefined;
      if (!userId || !ts) return;

      const text = normalizeCommandText((event as any).text);
      const lower = text.toLowerCase();

      // Undo command in thread.
      if (text && threadTs && isSlashCommandBody(lower, config.slackOps.undoCommand)) {
        opsLog("command.removesnipe", {
          userId,
          channelId,
          threadTs,
          messageTs: ts,
          textPreview: text.slice(0, 120),
        });
        try {
          const snipe = params.db.getLatestUndoableSnipeEventForThread(SLACK_GUILD_ID, threadTs);
          if (!snipe) {
            opsLog("command.removesnipe.result", { result: "nothing_to_undo", threadTs });
            await client.chat.postMessage({
              channel: channelId,
              thread_ts: threadTs,
              text: "Nothing to undo in this thread.",
            });
            return;
          }

          // Undo.
          opsLog("command.removesnipe.undoing", { snipeId: snipe.snipeId, threadTs });
          const undoResult = params.db.undoSnipeEvent({
            guildId: SLACK_GUILD_ID,
            channelId,
            threadTs,
            snipeIdToUndo: snipe.snipeId,
          });
          const canvasId = await ensureCanvasOnce();
          await updateLeaderboardCanvas({ client, db: params.db, canvasId });

          const undoText = formatUndoConfirmation({
            kind: "undo",
            undoingSnipeId: snipe.snipeId,
            playerChanges: undoResult.playerChanges,
          });
          await client.chat.postMessage({
            channel: channelId,
            thread_ts: threadTs,
            text: undoText,
          });
          opsLog("command.removesnipe.result", {
            result: "ok",
            undoesSnipeId: snipe.snipeId,
            undoSnipeId: undoResult.undoSnipeId,
            threadTs,
          });
          return;
        } catch (e: any) {
          opsLog("command.removesnipe.result", {
            result: "error",
            error: e?.message ?? String(e),
            threadTs,
          });
          await client.chat.postMessage({
            channel: channelId,
            thread_ts: threadTs,
            text: `Undo failed: ${e?.message ?? String(e)}`,
          });
          return;
        }
      }

      // Makeupsnipe command.
      if (text && isSlashCommandBody(lower, config.slackOps.makeupCommand)) {
        opsLog("command.makeupsnipe", {
          userId,
          channelId,
          messageTs: ts,
          textPreview: text.slice(0, 200),
        });
        try {
          const parts = text.split(/\s+/).filter(Boolean);
          if (parts.length < 3) {
            opsLog("command.makeupsnipe.result", { result: "usage_error", argCount: parts.length });
            await client.chat.postMessage({
              channel: channelId,
              text: `Usage: ${config.slackOps.makeupCommand} <sniper> <sniped1> <sniped2> ...`,
            });
            return;
          }

          const sniperToken = parts[1];
          const snipedTokens = parts.slice(2);

          const sniperResolve = parseUserToken(sniperToken);
          if (!sniperResolve.ok) {
            opsLog("command.makeupsnipe.result", { result: "parse_sniper_failed" });
            await client.chat.postMessage({
              channel: channelId,
              text: `Could not parse sniper token. Use a Slack mention like <@U123>.`,
            });
            return;
          }

          const snipedIds = await resolveUserTokensToIds({ client, tokens: snipedTokens });
          opsLog("command.makeupsnipe.parsed", {
            sniperId: sniperResolve.userId,
            snipedIds,
          });
          await handleApplySnipe({
            type: "makeup",
            channelId,
            threadTs: ts,
            sourceMessageTs: ts,
            sniperId: sniperResolve.userId,
            snipedIds,
            reactSource: false,
          });

          opsLog("command.makeupsnipe.result", { result: "ok", sniperId: sniperResolve.userId, snipedIds });
          return;
        } catch (e: any) {
          opsLog("command.makeupsnipe.result", { result: "error", error: e?.message ?? String(e) });
          await client.chat.postMessage({
            channel: channelId,
            text: `${config.slackOps.makeupCommand} failed: ${e?.message ?? String(e)}`,
          });
          return;
        }
      }

      // Manual ELO adjustment: /adjustelo @user <integer delta>
      if (text && isSlashCommandBody(lower, config.slackOps.adjustEloCommand)) {
        opsLog("command.adjustelo", {
          userId,
          channelId,
          messageTs: ts,
          textPreview: text.slice(0, 200),
        });
        try {
          const parts = text.split(/\s+/).filter(Boolean);
          if (parts.length < 3) {
            opsLog("command.adjustelo.result", { result: "usage_error", argCount: parts.length });
            await client.chat.postMessage({
              channel: channelId,
              text: `Usage: ${config.slackOps.adjustEloCommand} <user> <delta> — delta is a whole number (e.g. +50 or -25).`,
            });
            return;
          }

          const userTok = parseUserToken(parts[1]);
          if (!userTok.ok) {
            opsLog("command.adjustelo.result", { result: "parse_user_failed" });
            await client.chat.postMessage({
              channel: channelId,
              text: `Could not parse user. Use a Slack mention like <@U123>.`,
            });
            return;
          }

          const delta = Number(parts[2]);
          if (!Number.isFinite(delta) || !Number.isInteger(delta)) {
            opsLog("command.adjustelo.result", { result: "parse_delta_failed" });
            await client.chat.postMessage({
              channel: channelId,
              text: `Delta must be a whole number (got: ${parts[2]}).`,
            });
            return;
          }

          const change = params.db.adjustPlayerRating({
            guildId: SLACK_GUILD_ID,
            playerId: userTok.userId,
            delta,
          });
          const canvasId = await ensureCanvasOnce();
          await updateLeaderboardCanvas({ client, db: params.db, canvasId });

          await client.chat.postMessage({
            channel: channelId,
            text: formatAdjustEloConfirmation({
              playerId: change.playerId,
              beforeRating: change.beforeRating,
              afterRating: change.afterRating,
              delta: change.delta,
            }),
          });
          opsLog("command.adjustelo.result", {
            result: "ok",
            targetUserId: userTok.userId,
            delta,
          });
          return;
        } catch (e: any) {
          opsLog("command.adjustelo.result", { result: "error", error: e?.message ?? String(e) });
          await client.chat.postMessage({
            channel: channelId,
            text: `${config.slackOps.adjustEloCommand} failed: ${e?.message ?? String(e)}`,
          });
          return;
        }
      }

      // Implicit snipe: mentions (in text and/or blocks) + optional image (see SNIPE_REQUIRE_IMAGE).
      const hasImage = isLikelyImageMessage(event);
      const mentionedIds = parseMentionedUserIdsFromMessageEvent(event);
      if (mentionedIds.length === 0) return;

      const sniperId = userId;
      const snipedIds = mentionedIds.filter((id) => id !== sniperId);

      if (config.slackOps.snipeRequireImage && !hasImage) return;

      if (snipedIds.length === 0) {
        if (hasImage) {
          opsLog("command.implicit_snipe.skipped", {
            reason: "only_self_mentioned",
            userId,
            channelId,
            messageTs: ts,
          });
          await client.chat.postMessage({
            channel: channelId,
            thread_ts: ts,
            text:
              "I see an image and a mention, but only you were mentioned. " +
              "Mention everyone who was *sniped* in the same message (the photographer is the sniper automatically).",
          });
        }
        return;
      }

      try {
        opsLog("command.implicit_snipe", {
          userId,
          channelId,
          messageTs: ts,
          sniperId,
          snipedIds,
          hasImage,
          snipeRequireImage: config.slackOps.snipeRequireImage,
          subtype: (event as any).subtype ?? null,
        });
        await handleApplySnipe({
          type: "snipe",
          channelId,
          threadTs: ts,
          sourceMessageTs: ts,
          sniperId,
          snipedIds,
          reactSource: true,
        });
      } catch (e: any) {
        opsLog("command.implicit_snipe.result", { result: "error", error: e?.message ?? String(e), messageTs: ts });
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: ts,
          text: `Snipe processing failed: ${e?.message ?? String(e)}`,
        });
      }
    } catch (e: any) {
      boltLogger.error(e);
    }
  });

  // Bind HTTP (health checks + /slack/events) BEFORE Slack API calls like canvases.create.
  // Otherwise Railway probes $PORT while we’re still in ensureLeaderboardCanvas → SIGTERM.
  opsLog("service.listen", {
    port: config.server.port,
    socketMode: useSocketMode,
    hasAppToken: useSocketMode,
    channelId: config.slack.channelId,
  });
  if (!useSocketMode) {
    opsLog("service.mode.http", {
      hint: "Set SLACK_APP_TOKEN in Railway for Socket Mode, or set Event Subscriptions Request URL to https://<your-host>/slack/events",
    });
  }
  logger.log(`Starting Slack bot on port ${config.server.port}`);
  await app.start(config.server.port);

  void ensureCanvasOnce().catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Leaderboard canvas warmup failed (bot is up; first snipe may retry): ${msg}`);
    opsLog("canvas.ensure.startup_failed", { error: msg });
  });
  opsLog("service.ready", { port: config.server.port, socketMode: useSocketMode });
}

