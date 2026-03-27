import { App, type CustomRoute } from "@slack/bolt";
import { config } from "./config";
import { EloDb } from "./db";
import { ensureLeaderboardCanvas, updateLeaderboardCanvas } from "./canvas";
import { purgeSlackBotPlayersFromDb } from "./purgeBotPlayers";
import {
  collectIdsForSnipeConfirmation,
  formatAdjustEloConfirmation,
  formatSnipeConfirmation,
  formatUndoConfirmation,
} from "./snipe";
import {
  isLikelyImageMessage,
  isProcessableUserMessageEvent,
  normalizeCommandText,
  parseMentionedUserIdsFromMessageEvent,
} from "./parse";
import { isCommandBody } from "./slashCommands";
import { opsLog } from "./opsLog";
import {
  escapeSlackLeaderboardName,
  getSlackUserProfileCached,
  resolveSlackDisplayNames,
  resolveSlackUserTokenToUserId,
  takeTopSlackHumanLeaderboard,
} from "./slackDisplayNames";
import { SLACK_GUILD_ID } from "./tenants";
import { collectIdsFromDirectedPairs, formatHeadToHeadSlack } from "./headToHead";
import { SNIPES_LOG_LIMIT, collectIdsForSnipeLog, formatSlackSnipesList } from "./snipeHistory";
import * as L from "./voiceLemuen";

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

async function formatSlackLeaderboardText(
  client: { users: { info: (a: { user: string }) => Promise<unknown> } },
  db: EloDb
): Promise<string> {
  const title = config.leaderboard.title;
  const sorted = db.getAllPlayersSorted(SLACK_GUILD_ID);
  const { players, displayNames } = await takeTopSlackHumanLeaderboard(
    client,
    sorted,
    config.leaderboard.topN
  );
  if (players.length === 0) return `*${title}*\n${L.leaderboardEmptyFallback()}`;
  const lines: string[] = [`*${title}*`, ""];
  let rank = 1;
  for (const p of players) {
    const label = escapeSlackLeaderboardName(displayNames.get(p.playerId) ?? p.playerId);
    lines.push(`${rank}. ${label} — *${p.rating}*`);
    rank++;
  }
  return lines.join("\n");
}

function plainSlackCmd(slashPath: string): string {
  return slashPath.replace(/^\//, "").toLowerCase();
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
  const ids: string[] = [];
  for (const t of args.tokens) {
    const id = await resolveSlackUserTokenToUserId(args.client, t);
    if (!id) throw new Error(`unrecognized_user_token:${t}`);
    ids.push(id);
  }
  return uniquePreserveOrder(ids);
}

/** Non-sniper mentions that are human (not bot, not deleted). */
async function slackSnipedHumanIds(args: {
  client: { users: { info: (a: { user: string }) => Promise<unknown> } };
  sniperId: string;
  mentionedUserIds: string[];
}): Promise<{ snipedHumanIds: string[]; mentionedSomeoneBesideSniper: boolean }> {
  const candidates = args.mentionedUserIds.filter((id) => id !== args.sniperId);
  const snipedHumanIds: string[] = [];
  for (const id of candidates) {
    const snap = await getSlackUserProfileCached(args.client, id);
    if (!snap || snap.deleted || snap.isBot) continue;
    snipedHumanIds.push(id);
  }
  return { snipedHumanIds, mentionedSomeoneBesideSniper: candidates.length > 0 };
}

async function slackMakeupParticipantsAreAllHuman(client: any, sniperId: string, snipedIds: string[]): Promise<boolean> {
  const sniperSnap = await getSlackUserProfileCached(client, sniperId);
  if (!sniperSnap || sniperSnap.isBot || sniperSnap.deleted) return false;
  for (const id of snipedIds) {
    const s = await getSlackUserProfileCached(client, id);
    if (!s || s.isBot || s.deleted) return false;
  }
  return true;
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

    const snipeIds = collectIdsForSnipeConfirmation(args.sniperId, result.pairMatches, result.playerChanges);
    const snipeNames = await resolveSlackDisplayNames(app.client, snipeIds);
    const nameOf = (id: string) => escapeSlackLeaderboardName(snipeNames.get(id) ?? id);

    const confirmationText = formatSnipeConfirmation({
      kind: args.type === "makeup" ? "makeup" : "snipe",
      sniperId: args.sniperId,
      pairMatches: result.pairMatches,
      playerChanges: result.playerChanges,
      nameOf,
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
      text: L.wrongSnipeChannel(`<#${config.slack.channelId}>`),
    });
  };

  const handleSlackLeaderboardSlash = async (command: any, respond: (a: any) => Promise<void>, client: any) => {
    if (command.channel_id !== config.slack.channelId) {
      await wrongChannelEphemeral(respond);
      return;
    }
    try {
      const body = await formatSlackLeaderboardText(client, params.db);
      const parts = chunkSlackText(body);
      await respond({ response_type: "in_channel", text: parts[0] ?? L.leaderboardEmptyFallback() });
      for (let i = 1; i < parts.length; i++) {
        await client.chat.postMessage({ channel: command.channel_id, text: parts[i] });
      }
      opsLog("command.slash.leaderboard", {
        userId: command.user_id,
        channelId: command.channel_id,
        command: command.command,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await respond({ response_type: "ephemeral", text: L.leaderboardFailed(msg) });
    }
  };

  app.command(config.slackOps.slashLeaderboard, async ({ command, ack, respond, client }) => {
    await ack();
    await handleSlackLeaderboardSlash(command, respond, client);
  });

  app.command(config.slackOps.slashShowLeaderboard, async ({ command, ack, respond, client }) => {
    await ack();
    await handleSlackLeaderboardSlash(command, respond, client);
  });

  const handleSlackSnipesSlash = async (command: any, respond: (a: any) => Promise<void>, client: any) => {
    if (command.channel_id !== config.slack.channelId) {
      await wrongChannelEphemeral(respond);
      return;
    }
    const trimmed = command.text.trim();
    let targetUserId = command.user_id as string;
    if (trimmed) {
      const first = trimmed.split(/\s+/)[0];
      const id = await resolveSlackUserTokenToUserId(client, first);
      if (!id) {
        await respond({ response_type: "ephemeral", text: L.makeupParseSniperFail() });
        return;
      }
      targetUserId = id;
    }
    try {
      const asSniper = params.db.getRecentSnipesForSniper(SLACK_GUILD_ID, targetUserId, SNIPES_LOG_LIMIT);
      const asSniped = params.db.getRecentSnipesAsSniped(SLACK_GUILD_ID, targetUserId, SNIPES_LOG_LIMIT);
      const snipeLogIds = collectIdsForSnipeLog(targetUserId, asSniper, asSniped);
      const snipeLogNames = await resolveSlackDisplayNames(client, snipeLogIds);
      const snipeLogNameOf = (id: string) => escapeSlackLeaderboardName(snipeLogNames.get(id) ?? id);
      const body = formatSlackSnipesList(asSniper, asSniped, snipeLogNameOf(targetUserId), snipeLogNameOf);
      const parts = chunkSlackText(body);
      await respond({ response_type: "in_channel", text: parts[0] ?? "(empty)" });
      for (let i = 1; i < parts.length; i++) {
        await client.chat.postMessage({ channel: command.channel_id, text: parts[i] });
      }
      opsLog("command.slash.snipes", { userId: command.user_id, targetUserId });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await respond({ response_type: "ephemeral", text: L.snipesFailed(msg) });
    }
  };

  app.command(config.slackOps.slashSnipes, async ({ command, ack, respond, client }) => {
    await ack();
    await handleSlackSnipesSlash(command, respond, client);
  });

  const handleSlackHeadtoheadSlash = async (command: any, respond: (a: any) => Promise<void>, client: any) => {
    if (command.channel_id !== config.slack.channelId) {
      await wrongChannelEphemeral(respond);
      return;
    }
    try {
      const rows = params.db.getDirectedSnipePairCounts(SLACK_GUILD_ID);
      const h2hIds = collectIdsFromDirectedPairs(rows);
      const h2hNames = await resolveSlackDisplayNames(client, h2hIds);
      const h2hNameOf = (id: string) => escapeSlackLeaderboardName(h2hNames.get(id) ?? id);
      const body = formatHeadToHeadSlack(rows, h2hNameOf);
      const parts = chunkSlackText(body);
      await respond({ response_type: "in_channel", text: parts[0] ?? "(empty)" });
      for (let i = 1; i < parts.length; i++) {
        await client.chat.postMessage({ channel: command.channel_id, text: parts[i] });
      }
      opsLog("command.slash.headtohead", { userId: command.user_id });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await respond({ response_type: "ephemeral", text: L.headtoheadFailed(msg) });
    }
  };

  app.command(config.slackOps.slashHeadtohead, async ({ command, ack, respond, client }) => {
    await ack();
    await handleSlackHeadtoheadSlash(command, respond, client);
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
        text: L.removesnipeNeedSlackThread(),
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
          text: L.removesnipeNothingInThread(),
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
      const undoIds = undoResult.playerChanges.map((c) => c.playerId);
      const undoNames = await resolveSlackDisplayNames(client, undoIds);
      const undoNameOf = (id: string) => escapeSlackLeaderboardName(undoNames.get(id) ?? id);
      const undoText = formatUndoConfirmation({
        kind: "undo",
        undoingSnipeId: snipe.snipeId,
        playerChanges: undoResult.playerChanges,
        nameOf: undoNameOf,
      });
      await client.chat.postMessage({
        channel: command.channel_id,
        thread_ts: threadTs,
        text: undoText,
      });
      await respond({
        response_type: "ephemeral",
        text: L.removesnipeUndoAckEphemeral(),
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
      await respond({ response_type: "ephemeral", text: L.removesnipeFailed(msg) });
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
        text: L.makeupUsage(config.slackOps.slashMakeup),
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
      const sniperId = await resolveSlackUserTokenToUserId(client, sniperToken);
      if (!sniperId) {
        await respond({
          response_type: "ephemeral",
          text: L.makeupParseSniperFail(),
        });
        return;
      }
      const snipedIds = await resolveUserTokensToIds({ client, tokens: snipedTokens });
      if (!(await slackMakeupParticipantsAreAllHuman(client, sniperId, snipedIds))) {
        await respond({ response_type: "ephemeral", text: L.snipeMakeupIncludesBot() });
        return;
      }
      const callerSnap = await getSlackUserProfileCached(client, command.user_id);
      const callerName = escapeSlackLeaderboardName(callerSnap?.displayName ?? command.user_id);
      const root = await client.chat.postMessage({
        channel: command.channel_id,
        text: L.makeupRootMessage(callerName, config.slackOps.slashMakeup),
      });
      const rootTs = root.ts as string;
      await handleApplySnipe({
        type: "makeup",
        channelId: command.channel_id,
        threadTs: rootTs,
        sourceMessageTs: rootTs,
        sniperId,
        snipedIds,
        reactSource: false,
      });
      await respond({ response_type: "ephemeral", text: L.makeupSuccessEphemeral() });
      opsLog("command.slash.makeupsnipe.result", { result: "ok", sniperId, snipedIds });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      opsLog("command.slash.makeupsnipe.result", { result: "error", error: msg });
      await respond({ response_type: "ephemeral", text: L.makeupCommandFailed(config.slackOps.slashMakeup, msg) });
    }
  });

  app.command(config.slackOps.slashAdjustElo, async ({ command, ack, respond, client }) => {
    await ack();
    if (command.channel_id !== config.slack.channelId) {
      await wrongChannelEphemeral(respond);
      return;
    }
    if (!config.slackOps.adjustEloAllowedSlackUserIds.includes(command.user_id)) {
      opsLog("command.slash.adjustelo.denied", { userId: command.user_id });
      await respond({ response_type: "ephemeral", text: L.adjustEloForbidden() });
      return;
    }
    const tokens = command.text.trim().split(/\s+/).filter(Boolean);
    if (tokens.length < 2) {
      await respond({
        response_type: "ephemeral",
        text: L.adjustUsage(config.slackOps.slashAdjustElo),
      });
      return;
    }
    const delta = Number(tokens[tokens.length - 1]);
    const userPart = tokens.slice(0, -1).join(" ");
    opsLog("command.slash.adjustelo", {
      userId: command.user_id,
      channelId: command.channel_id,
      textPreview: command.text.slice(0, 200),
    });
    try {
      const targetUserId = await resolveSlackUserTokenToUserId(client, userPart);
      if (!targetUserId) {
        await respond({
          response_type: "ephemeral",
          text: L.adjustParseUserFail(),
        });
        return;
      }
      const targetProf = await getSlackUserProfileCached(client, targetUserId);
      if (targetProf?.isBot) {
        await respond({ response_type: "ephemeral", text: L.adjustTargetIsBot() });
        return;
      }
      if (!Number.isFinite(delta) || !Number.isInteger(delta)) {
        await respond({
          response_type: "ephemeral",
          text: L.adjustDeltaInvalid(tokens[tokens.length - 1]),
        });
        return;
      }
      const change = params.db.adjustPlayerRating({
        guildId: SLACK_GUILD_ID,
        playerId: targetUserId,
        delta,
      });
      const canvasId = await ensureCanvasOnce();
      await updateLeaderboardCanvas({ client, db: params.db, canvasId });
      const adjNames = await resolveSlackDisplayNames(client, [change.playerId]);
      const adjNameOf = (id: string) => escapeSlackLeaderboardName(adjNames.get(id) ?? id);
      await client.chat.postMessage({
        channel: command.channel_id,
        text: formatAdjustEloConfirmation({
          playerId: change.playerId,
          beforeRating: change.beforeRating,
          afterRating: change.afterRating,
          delta: change.delta,
          nameOf: adjNameOf,
        }),
      });
      await respond({ response_type: "ephemeral", text: L.adjustSuccessEphemeral() });
      opsLog("command.slash.adjustelo.result", { result: "ok", targetUserId, delta });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      opsLog("command.slash.adjustelo.result", { result: "error", error: msg });
      await respond({ response_type: "ephemeral", text: L.adjustCommandFailed(config.slackOps.slashAdjustElo, msg) });
    }
  });

  console.log(
    `[snipe-elo] Slack slash commands (register these in the Slack app): ${config.slackOps.slashLeaderboard}, ${config.slackOps.slashShowLeaderboard}, ${config.slackOps.slashSnipes}, ${config.slackOps.slashHeadtohead}, ${config.slackOps.slashUndo}, ${config.slackOps.slashMakeup}, ${config.slackOps.slashAdjustElo}`
  );

  const plainCmd = {
    leaderboard: plainSlackCmd(config.slackOps.slashLeaderboard),
    showLeaderboard: plainSlackCmd(config.slackOps.slashShowLeaderboard),
    snipes: plainSlackCmd(config.slackOps.slashSnipes),
    headtohead: plainSlackCmd(config.slackOps.slashHeadtohead),
    undo: plainSlackCmd(config.slackOps.slashUndo),
    makeup: plainSlackCmd(config.slackOps.slashMakeup),
    adjust: plainSlackCmd(config.slackOps.slashAdjustElo),
  };

  console.log(
    `[snipe-elo] Undo in a snipe thread: Slack blocks /slash there—type plain \`${plainCmd.undo}\` in the thread (always on).` +
      (config.slackOps.textCommandsFallback
        ? ` SLACK_TEXT_COMMANDS_FALLBACK=ON — also plain: ${plainCmd.leaderboard} | ${plainCmd.showLeaderboard} | ${plainCmd.snipes} | ${plainCmd.headtohead} … · ${plainCmd.makeup} … · ${plainCmd.adjust} …`
        : "")
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
      const threadTs = (event as any).thread_ts as string | undefined;
      if (!userId || !ts) return;

      const text = normalizeCommandText((event as any).text);
      const lower = text.toLowerCase();

      const postEphemeral = async (msg: string) => {
        await client.chat.postEphemeral({ channel: channelId, user: userId, thread_ts: ts, text: msg });
      };

      // Slack does not invoke app slash commands from thread composers—plain text in the thread always works.
      if (threadTs && text && isCommandBody(lower, plainCmd.undo)) {
        opsLog("command.text.removesnipe", { userId, channelId, threadTs });
        try {
          const snipe = params.db.getLatestUndoableSnipeEventForThread(SLACK_GUILD_ID, threadTs);
          if (!snipe) {
            await postEphemeral(L.removesnipeNothingInThread());
            return;
          }
          const undoResult = params.db.undoSnipeEvent({
            guildId: SLACK_GUILD_ID,
            channelId,
            threadTs,
            snipeIdToUndo: snipe.snipeId,
          });
          const canvasId = await ensureCanvasOnce();
          await updateLeaderboardCanvas({ client, db: params.db, canvasId });
          const undoIdsText = undoResult.playerChanges.map((c) => c.playerId);
          const undoNamesText = await resolveSlackDisplayNames(client, undoIdsText);
          const undoNameOfText = (id: string) => escapeSlackLeaderboardName(undoNamesText.get(id) ?? id);
          const undoText = formatUndoConfirmation({
            kind: "undo",
            undoingSnipeId: snipe.snipeId,
            playerChanges: undoResult.playerChanges,
            nameOf: undoNameOfText,
          });
          await client.chat.postMessage({ channel: channelId, thread_ts: threadTs, text: undoText });
          await postEphemeral(L.removesnipeUndoAckEphemeral());
          opsLog("command.text.removesnipe.result", { result: "ok", undoesSnipeId: snipe.snipeId, threadTs });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          opsLog("command.text.removesnipe.result", { result: "error", error: msg, threadTs });
          await postEphemeral(L.removesnipeFailed(msg));
        }
        return;
      }

      if (config.slackOps.textCommandsFallback && text) {
        if (isCommandBody(lower, plainCmd.leaderboard) || isCommandBody(lower, plainCmd.showLeaderboard)) {
          try {
            const body = await formatSlackLeaderboardText(client, params.db);
            const parts = chunkSlackText(body);
            for (let i = 0; i < parts.length; i++) {
              await client.chat.postMessage({ channel: channelId, thread_ts: ts, text: parts[i] });
            }
            opsLog("command.text.leaderboard", { userId, channelId });
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            await postEphemeral(L.leaderboardFailed(msg));
          }
          return;
        }

        if (isCommandBody(lower, plainCmd.snipes)) {
          const parts = text.split(/\s+/).filter(Boolean);
          let targetUserId = userId;
          if (parts.length > 1) {
            const tid = await resolveSlackUserTokenToUserId(client, parts[1]);
            if (!tid) {
              await postEphemeral(L.makeupParseSniperFail());
              return;
            }
            targetUserId = tid;
          }
          try {
            const asSniper = params.db.getRecentSnipesForSniper(SLACK_GUILD_ID, targetUserId, SNIPES_LOG_LIMIT);
            const asSniped = params.db.getRecentSnipesAsSniped(SLACK_GUILD_ID, targetUserId, SNIPES_LOG_LIMIT);
            const snipeLogIdsText = collectIdsForSnipeLog(targetUserId, asSniper, asSniped);
            const snipeLogNamesText = await resolveSlackDisplayNames(client, snipeLogIdsText);
            const snipeLogNameOfText = (id: string) => escapeSlackLeaderboardName(snipeLogNamesText.get(id) ?? id);
            const body = formatSlackSnipesList(
              asSniper,
              asSniped,
              snipeLogNameOfText(targetUserId),
              snipeLogNameOfText
            );
            const chunks = chunkSlackText(body);
            for (let i = 0; i < chunks.length; i++) {
              await client.chat.postMessage({ channel: channelId, thread_ts: ts, text: chunks[i] });
            }
            opsLog("command.text.snipes", { userId, targetUserId });
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            await postEphemeral(L.snipesFailed(msg));
          }
          return;
        }

        if (isCommandBody(lower, plainCmd.headtohead)) {
          try {
            const rows = params.db.getDirectedSnipePairCounts(SLACK_GUILD_ID);
            const h2hIdsText = collectIdsFromDirectedPairs(rows);
            const h2hNamesText = await resolveSlackDisplayNames(client, h2hIdsText);
            const h2hNameOfText = (id: string) => escapeSlackLeaderboardName(h2hNamesText.get(id) ?? id);
            const body = formatHeadToHeadSlack(rows, h2hNameOfText);
            const chunks = chunkSlackText(body);
            for (let i = 0; i < chunks.length; i++) {
              await client.chat.postMessage({ channel: channelId, thread_ts: ts, text: chunks[i] });
            }
            opsLog("command.text.headtohead", { userId, channelId });
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            await postEphemeral(L.headtoheadFailed(msg));
          }
          return;
        }

        if (isCommandBody(lower, plainCmd.makeup)) {
          const parts = text.split(/\s+/).filter(Boolean);
          if (parts.length < 3) {
            await postEphemeral(L.makeupUsage(config.slackOps.slashMakeup));
            return;
          }
          const sniperToken = parts[1];
          const snipedTokens = parts.slice(2);
          opsLog("command.text.makeupsnipe", { userId, channelId, textPreview: text.slice(0, 200) });
          try {
            const sniperId = await resolveSlackUserTokenToUserId(client, sniperToken);
            if (!sniperId) {
              await postEphemeral(L.makeupParseSniperFail());
              return;
            }
            const snipedIds = await resolveUserTokensToIds({ client, tokens: snipedTokens });
            if (!(await slackMakeupParticipantsAreAllHuman(client, sniperId, snipedIds))) {
              await postEphemeral(L.snipeMakeupIncludesBot());
              return;
            }
            const callerSnapText = await getSlackUserProfileCached(client, userId);
            const callerNameText = escapeSlackLeaderboardName(callerSnapText?.displayName ?? userId);
            const root = await client.chat.postMessage({
              channel: channelId,
              text: L.makeupRootMessage(callerNameText, config.slackOps.slashMakeup),
            });
            const rootTs = root.ts as string;
            await handleApplySnipe({
              type: "makeup",
              channelId,
              threadTs: rootTs,
              sourceMessageTs: rootTs,
              sniperId,
              snipedIds,
              reactSource: false,
            });
            await postEphemeral(L.makeupSuccessEphemeral());
            opsLog("command.text.makeupsnipe.result", { result: "ok", sniperId, snipedIds });
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            opsLog("command.text.makeupsnipe.result", { result: "error", error: msg });
            await postEphemeral(L.makeupCommandFailed(config.slackOps.slashMakeup, msg));
          }
          return;
        }

        if (isCommandBody(lower, plainCmd.adjust)) {
          if (!config.slackOps.adjustEloAllowedSlackUserIds.includes(userId)) {
            opsLog("command.text.adjustelo.denied", { userId });
            await postEphemeral(L.adjustEloForbidden());
            return;
          }
          const tokens = text.split(/\s+/).filter(Boolean);
          const argTokens = tokens.slice(1);
          if (argTokens.length < 2) {
            await postEphemeral(L.adjustUsage(config.slackOps.slashAdjustElo));
            return;
          }
          const delta = Number(argTokens[argTokens.length - 1]);
          const userPart = argTokens.slice(0, -1).join(" ");
          opsLog("command.text.adjustelo", { userId, channelId, textPreview: text.slice(0, 200) });
          try {
            const targetUserId = await resolveSlackUserTokenToUserId(client, userPart);
            if (!targetUserId) {
              await postEphemeral(L.adjustParseUserFail());
              return;
            }
            const targetProfText = await getSlackUserProfileCached(client, targetUserId);
            if (targetProfText?.isBot) {
              await postEphemeral(L.adjustTargetIsBot());
              return;
            }
            if (!Number.isFinite(delta) || !Number.isInteger(delta)) {
              await postEphemeral(L.adjustDeltaInvalid(argTokens[argTokens.length - 1]));
              return;
            }
            const change = params.db.adjustPlayerRating({
              guildId: SLACK_GUILD_ID,
              playerId: targetUserId,
              delta,
            });
            const canvasId = await ensureCanvasOnce();
            await updateLeaderboardCanvas({ client, db: params.db, canvasId });
            const adjNamesTxt = await resolveSlackDisplayNames(client, [change.playerId]);
            const adjNameOfTxt = (id: string) => escapeSlackLeaderboardName(adjNamesTxt.get(id) ?? id);
            await client.chat.postMessage({
              channel: channelId,
              text: formatAdjustEloConfirmation({
                playerId: change.playerId,
                beforeRating: change.beforeRating,
                afterRating: change.afterRating,
                delta: change.delta,
                nameOf: adjNameOfTxt,
              }),
            });
            await postEphemeral(L.adjustSuccessEphemeral());
            opsLog("command.text.adjustelo.result", { result: "ok", targetUserId, delta });
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            opsLog("command.text.adjustelo.result", { result: "error", error: msg });
            await postEphemeral(L.adjustCommandFailed(config.slackOps.slashAdjustElo, msg));
          }
          return;
        }
      }

      // Implicit snipe: mentions (in text and/or blocks) + optional image (see SNIPE_REQUIRE_IMAGE).
      const hasImage = isLikelyImageMessage(event);
      const mentionedIds = parseMentionedUserIdsFromMessageEvent(event);
      if (mentionedIds.length === 0) return;

      const sniperId = userId;
      const { snipedHumanIds, mentionedSomeoneBesideSniper } = await slackSnipedHumanIds({
        client,
        sniperId,
        mentionedUserIds: mentionedIds,
      });

      if (config.slackOps.snipeRequireImage && !hasImage) return;

      if (snipedHumanIds.length === 0) {
        if (mentionedSomeoneBesideSniper) {
          opsLog("command.implicit_snipe.skipped", {
            reason: "only_bots_or_deleted_mentioned",
            userId,
            channelId,
            messageTs: ts,
          });
          await client.chat.postMessage({
            channel: channelId,
            thread_ts: ts,
            text: L.snipeImplicitBotsOnlySlack(),
          });
          return;
        }
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
            text: L.implicitSnipeOnlySelfSlack(),
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
          snipedIds: snipedHumanIds,
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
          snipedIds: snipedHumanIds,
          reactSource: true,
        });
      } catch (e: any) {
        opsLog("command.implicit_snipe.result", { result: "error", error: e?.message ?? String(e), messageTs: ts });
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: ts,
          text: L.implicitSnipeProcessFailed(e?.message ?? String(e)),
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

  try {
    const purged = await purgeSlackBotPlayersFromDb(params.db, app.client);
    if (purged > 0) {
      logger.log(`[snipe-elo] Purged ${purged} bot ELO row(s) from SQLite`);
      const canvasId = params.db.getMeta(SLACK_GUILD_ID, "leaderboard_canvas_id");
      if (canvasId) {
        await updateLeaderboardCanvas({ client: app.client, db: params.db, canvasId });
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`[snipe-elo] Bot ELO purge failed: ${msg}`);
    opsLog("elo.purge_bot_players.failed", { platform: "slack", error: msg });
  }

  void ensureCanvasOnce().catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Leaderboard canvas warmup failed (bot is up; first snipe may retry): ${msg}`);
    opsLog("canvas.ensure.startup_failed", { error: msg });
  });
  opsLog("service.ready", { port: config.server.port, socketMode: useSocketMode });
}

