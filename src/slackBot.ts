import { App, type CustomRoute } from "@slack/bolt";
import { config } from "./config";
import { EloDb } from "./db";
import { ensureLeaderboardCanvas, updateLeaderboardCanvas } from "./canvas";
import { formatAdjustEloConfirmation, formatSnipeConfirmation, formatUndoConfirmation } from "./snipe";
import {
  isLikelyImageMessage,
  isProcessableUserMessageEvent,
  parseMentionedUserIdsFromMessageEvent,
  parseUserToken,
} from "./parse";
import { opsLog } from "./opsLog";
import { SLACK_GUILD_ID } from "./tenants";

function chunkSlackText(text: string, maxLen = 3500): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let cur = "";
  for (const line of lines) {
    const next = cur ? `${cur}\n${line}` : line;
    if (next.length > maxLen) {
      if (cur) chunks.push(cur);
      cur = line.length > maxLen ? line.slice(0, maxLen) : line;
    } else {
      cur = next;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

function formatSlackLeaderboardText(db: EloDb): string {
  const players = db.getAllPlayersSorted(SLACK_GUILD_ID).slice(0, config.leaderboard.topN);
  const title = config.leaderboard.title;
  if (players.length === 0) return `*${title}*\n_No ratings yet._`;
  const lines: string[] = [`*${title}*`, ""];
  let rank = 1;
  for (const p of players) {
    lines.push(`${rank}. <@${p.playerId}> — *${p.rating}*`);
    rank++;
  }
  return lines.join("\n");
}

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

  const wrongChannelEphemeral = async (respond: (args: any) => Promise<void>) => {
    await respond({
      response_type: "ephemeral",
      text: `Use Snipe ELO slash commands only in <#${config.slack.channelId}>.`,
    });
  };

  app.command(config.slackOps.slashLeaderboard, async ({ command, ack, respond, client }) => {
    await ack();
    if (command.channel_id !== config.slack.channelId) {
      await wrongChannelEphemeral(respond);
      return;
    }
    try {
      const body = formatSlackLeaderboardText(params.db);
      const parts = chunkSlackText(body);
      await respond({ response_type: "in_channel", text: parts[0] ?? "_Empty._" });
      for (let i = 1; i < parts.length; i++) {
        await client.chat.postMessage({ channel: command.channel_id, text: parts[i] });
      }
      opsLog("command.slash.leaderboard", { userId: command.user_id, channelId: command.channel_id });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await respond({ response_type: "ephemeral", text: `Failed: ${msg}` });
    }
  });

  app.command(config.slackOps.slashUndo, async ({ command, ack, respond, client }) => {
    await ack();
    if (command.channel_id !== config.slack.channelId) {
      await wrongChannelEphemeral(respond);
      return;
    }
    const threadTs = command.thread_ts;
    if (!threadTs) {
      await respond({
        response_type: "ephemeral",
        text:
          "Run this command *from inside the snipe thread* (open the thread under the bot confirmation, then use the slash command there).",
      });
      return;
    }
    opsLog("command.slash.removesnipe", { userId: command.user_id, channelId: command.channel_id, threadTs });
    try {
      const snipe = params.db.getLatestUndoableSnipeEventForThread(SLACK_GUILD_ID, threadTs);
      if (!snipe) {
        opsLog("command.slash.removesnipe.result", { result: "nothing_to_undo", threadTs });
        await respond({
          response_type: "ephemeral",
          text: "Nothing to undo in this thread.",
        });
        return;
      }
      const undoResult = params.db.undoSnipeEvent({
        guildId: SLACK_GUILD_ID,
        channelId: command.channel_id,
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
        channel: command.channel_id,
        thread_ts: threadTs,
        text: undoText,
      });
      await respond({
        response_type: "ephemeral",
        text: "Undo applied. Details posted in the thread.",
      });
      opsLog("command.slash.removesnipe.result", {
        result: "ok",
        undoesSnipeId: snipe.snipeId,
        undoSnipeId: undoResult.undoSnipeId,
        threadTs,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      opsLog("command.slash.removesnipe.result", { result: "error", error: msg, threadTs });
      await respond({ response_type: "ephemeral", text: `Undo failed: ${msg}` });
    }
  });

  app.command(config.slackOps.slashMakeup, async ({ command, ack, respond, client }) => {
    await ack();
    if (command.channel_id !== config.slack.channelId) {
      await wrongChannelEphemeral(respond);
      return;
    }
    const parts = command.text.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      await respond({
        response_type: "ephemeral",
        text: `Usage: ${config.slackOps.slashMakeup} <sniper> <sniped1> <sniped2> ... (Slack mentions like <@U123>)`,
      });
      return;
    }
    const sniperToken = parts[0];
    const snipedTokens = parts.slice(1);
    opsLog("command.slash.makeupsnipe", {
      userId: command.user_id,
      channelId: command.channel_id,
      textPreview: command.text.slice(0, 200),
    });
    try {
      const sniperResolve = parseUserToken(sniperToken);
      if (!sniperResolve.ok) {
        await respond({
          response_type: "ephemeral",
          text: "Could not parse sniper. Use a Slack mention like <@U123>.",
        });
        return;
      }
      const snipedIds = await resolveUserTokensToIds({ client, tokens: snipedTokens });
      const root = await client.chat.postMessage({
        channel: command.channel_id,
        text: `<@${command.user_id}> ran \`${config.slackOps.slashMakeup}\`.`,
      });
      const rootTs = root.ts as string;
      await handleApplySnipe({
        type: "makeup",
        channelId: command.channel_id,
        threadTs: rootTs,
        sourceMessageTs: rootTs,
        sniperId: sniperResolve.userId,
        snipedIds,
        reactSource: false,
      });
      await respond({ response_type: "ephemeral", text: "Makeup snipe recorded. See the thread on the new channel message." });
      opsLog("command.slash.makeupsnipe.result", { result: "ok", sniperId: sniperResolve.userId, snipedIds });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      opsLog("command.slash.makeupsnipe.result", { result: "error", error: msg });
      await respond({ response_type: "ephemeral", text: `${config.slackOps.slashMakeup} failed: ${msg}` });
    }
  });

  app.command(config.slackOps.slashAdjustElo, async ({ command, ack, respond, client }) => {
    await ack();
    if (command.channel_id !== config.slack.channelId) {
      await wrongChannelEphemeral(respond);
      return;
    }
    const tokens = command.text.trim().split(/\s+/).filter(Boolean);
    if (tokens.length < 2) {
      await respond({
        response_type: "ephemeral",
        text: `Usage: ${config.slackOps.slashAdjustElo} <user> <delta> — delta is a whole number (e.g. 50 or -25).`,
      });
      return;
    }
    const delta = Number(tokens[tokens.length - 1]);
    const userTok = parseUserToken(tokens.slice(0, -1).join(" "));
    opsLog("command.slash.adjustelo", {
      userId: command.user_id,
      channelId: command.channel_id,
      textPreview: command.text.slice(0, 200),
    });
    try {
      if (!userTok.ok) {
        await respond({
          response_type: "ephemeral",
          text: "Could not parse user. Use a Slack mention like <@U123>.",
        });
        return;
      }
      if (!Number.isFinite(delta) || !Number.isInteger(delta)) {
        await respond({
          response_type: "ephemeral",
          text: `Delta must be a whole number (got: ${tokens[tokens.length - 1]}).`,
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
        channel: command.channel_id,
        text: formatAdjustEloConfirmation({
          playerId: change.playerId,
          beforeRating: change.beforeRating,
          afterRating: change.afterRating,
          delta: change.delta,
        }),
      });
      await respond({ response_type: "ephemeral", text: "ELO updated. Canvas leaderboard refreshed." });
      opsLog("command.slash.adjustelo.result", { result: "ok", targetUserId: userTok.userId, delta });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      opsLog("command.slash.adjustelo.result", { result: "error", error: msg });
      await respond({ response_type: "ephemeral", text: `${config.slackOps.slashAdjustElo} failed: ${msg}` });
    }
  });

  console.log(
    `[snipe-elo] Slack slash commands (register these in the Slack app): ${config.slackOps.slashLeaderboard}, ${config.slackOps.slashUndo}, ${config.slackOps.slashMakeup}, ${config.slackOps.slashAdjustElo}`
  );

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
      if (!userId || !ts) return;

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

