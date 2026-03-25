import { App } from "@slack/bolt";
import { config } from "./config";
import { EloDb } from "./db";
import { ensureLeaderboardCanvas, updateLeaderboardCanvas } from "./canvas";
import { formatSnipeConfirmation, formatUndoConfirmation } from "./snipe";
import { isLikelyImageMessage, normalizeCommandText, parseMentionedUserIds, parseUserToken } from "./parse";

type Mentioned = { sniperId: string; snipedIds: string[] };

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

export async function startSlackBot(params: {
  db: EloDb;
  logger?: Console;
}): Promise<void> {
  const app = new App({
    token: config.slack.botToken,
    signingSecret: config.slack.signingSecret,
    socketMode: Boolean(process.env.SLACK_APP_TOKEN),
    appToken: process.env.SLACK_APP_TOKEN,
    // For HTTP mode (non-socket-mode).
    port: config.server.port,
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
    const canvasId = await ensureCanvasOnce();

    const result = params.db.applySnipe({
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
      params.db.setConfirmationMessageTs(result.snipeId, confirmationTs);
    }

    await updateLeaderboardCanvas({ client: app.client, db: params.db, canvasId });
  };

  // Main event router.
  app.event("message", async ({ event, client, logger: boltLogger }) => {
    try {
      const channelId: string | undefined = (event as any).channel;
      if (!channelId || channelId !== config.slack.channelId) return;

      const subtype = (event as any).subtype;
      const botId = (event as any).bot_id;
      if (subtype || botId) return;

      const text = normalizeCommandText((event as any).text);
      const userId = (event as any).user as string | undefined;
      const ts = (event as any).ts as string | undefined;
      const threadTs = (event as any).thread_ts as string | undefined;
      if (!text || !userId || !ts) return;

      const lower = text.toLowerCase();

      // Undo command in thread.
      if (lower.startsWith(config.slackOps.undoCommand) && threadTs) {
        try {
          const snipe = params.db.getLatestUndoableSnipeEventForThread(threadTs);
          if (!snipe) {
            await client.chat.postMessage({
              channel: channelId,
              thread_ts: threadTs,
              text: "Nothing to undo in this thread.",
            });
            return;
          }

          // Undo.
          const undoResult = params.db.undoSnipeEvent({
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
          return;
        } catch (e: any) {
          await client.chat.postMessage({
            channel: channelId,
            thread_ts: threadTs,
            text: `Undo failed: ${e?.message ?? String(e)}`,
          });
          return;
        }
      }

      // Makeupsnipe command.
      if (lower.startsWith(config.slackOps.makeupCommand)) {
        try {
          const parts = text.split(/\s+/).filter(Boolean);
          if (parts.length < 3) {
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
            await client.chat.postMessage({
              channel: channelId,
              text: `Could not parse sniper token. Use a Slack mention like <@U123>.`,
            });
            return;
          }

          const snipedIds = await resolveUserTokensToIds({ client, tokens: snipedTokens });
          await handleApplySnipe({
            type: "makeup",
            channelId,
            threadTs: ts,
            sourceMessageTs: ts,
            sniperId: sniperResolve.userId,
            snipedIds,
            reactSource: false,
          });

          return;
        } catch (e: any) {
          await client.chat.postMessage({
            channel: channelId,
            text: `makeupsnipe failed: ${e?.message ?? String(e)}`,
          });
          return;
        }
      }

      // Implicit snipe: mention(s) + image attachment in the same message.
      const hasImage = isLikelyImageMessage(event);
      if (!hasImage) return;

      const mentionedIds = parseMentionedUserIds((event as any).text ?? "");
      if (mentionedIds.length === 0) return;

      const sniperId = userId;
      const snipedIds = mentionedIds.filter((id) => id !== sniperId);
      if (snipedIds.length === 0) return;

      try {
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

  await ensureCanvasOnce();

  logger.log(`Starting Slack bot on port ${config.server.port}`);
  await app.start(config.server.port);
}

