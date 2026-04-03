import type { Client } from "discord.js";
import { calendarDateKeyInTimeZone, formatBountyDateLabel } from "./bounty";
import { BOUNTY_MANUAL_DATE_META_KEY } from "./bountyManual";
import { bountyEnv } from "./bountyEnv";
import type { EloDb } from "./db";
import { escapeDiscordMarkdownChunk, takeDiscordHumanLeaderboardPaged } from "./discordDisplayNames";
import {
  escapeSlackLeaderboardName,
  takeSlackHumanLeaderboardPaged,
  type SlackInfoClient,
} from "./slackDisplayNames";
import { L } from "./voice";

type SlackBountyClient = SlackInfoClient & {
  chat: {
    postMessage: (a: { channel: string; text: string; mrkdwn?: boolean }) => Promise<unknown>;
  };
};

function recalcFooterSlack(claimsCleared: number): string {
  return (
    `_Recalc: marks are from the leaderboard *right now*; any manual list for today was cleared; ` +
    `${claimsCleared} first-snipe (2×) claim(s) for today were reset._`
  );
}

function recalcFooterDiscord(claimsCleared: number): string {
  return (
    `*Recalc:* marks are from the leaderboard **right now**; any manual list for today was cleared; ` +
    `${claimsCleared} first-snipe (2×) claim(s) for today were reset.`
  );
}

export function bountyRecalcDisabledMessage(): string {
  return "Daily bounty is switched off—there's nothing to recalculate.";
}

export function bountyRecalcSuccessEphemeral(claimsCleared: number): string {
  return `Recalculated today's bounty from the leaderboard, cleared the manual list lock, and reset ${claimsCleared} first-snipe claim(s). Posted to the channel.`;
}

/**
 * Rebuild today's bounty marks from the current human leaderboard (top BOUNTY_TOP_N),
 * clear today's first-snipe claims, and drop the manual-list lock so midnight auto can run tomorrow.
 */
export async function executeSlackBountyRecalc(args: {
  client: SlackBountyClient;
  db: EloDb;
  guildId: string;
  channelId: string;
  nowMs?: number;
}): Promise<
  | { ok: true; dateKey: string; targetIds: string[]; claimsCleared: number; channelText: string }
  | { ok: false; ephemeral: string }
> {
  if (!bountyEnv.enabled) {
    return { ok: false, ephemeral: bountyRecalcDisabledMessage() };
  }
  const now = args.nowMs ?? Date.now();
  const dateKey = calendarDateKeyInTimeZone(now, bountyEnv.timezone);
  args.db.deleteMeta(args.guildId, BOUNTY_MANUAL_DATE_META_KEY);
  const claimsCleared = args.db.clearBountyFirstSnipeClaimsForDate(args.guildId, dateKey);
  const sorted = args.db.getAllPlayersSorted(args.guildId);
  const { allHumans, displayNames } = await takeSlackHumanLeaderboardPaged(args.client, sorted, bountyEnv.topN);
  const targetIds = allHumans.map((p) => p.playerId).slice(0, bountyEnv.topN);
  args.db.upsertDailyBountyTargets(args.guildId, dateKey, targetIds, Date.now());
  const dateLabel = formatBountyDateLabel(dateKey, bountyEnv.timezone);
  let channelText: string;
  if (targetIds.length === 0) {
    channelText = L.bountyDailyNoTargetsSlack(dateLabel);
  } else {
    const rankedLines = targetIds.map((id) => escapeSlackLeaderboardName(displayNames.get(id) ?? id));
    channelText = L.bountyDailyAnnouncementSlack({ dateLabel, rankedLines });
  }
  channelText += "\n\n" + recalcFooterSlack(claimsCleared);
  return { ok: true, dateKey, targetIds, claimsCleared, channelText };
}

export async function executeDiscordBountyRecalc(args: {
  client: Client;
  db: EloDb;
  guildId: string;
  channelId: string;
  nowMs?: number;
}): Promise<
  | { ok: true; dateKey: string; targetIds: string[]; claimsCleared: number; channelText: string }
  | { ok: false; ephemeral: string }
> {
  if (!bountyEnv.enabled) {
    return { ok: false, ephemeral: bountyRecalcDisabledMessage() };
  }
  const guild = await args.client.guilds.fetch(args.guildId).catch(() => null);
  if (!guild) {
    return { ok: false, ephemeral: "Couldn't load this server." };
  }
  const now = args.nowMs ?? Date.now();
  const dateKey = calendarDateKeyInTimeZone(now, bountyEnv.timezone);
  args.db.deleteMeta(args.guildId, BOUNTY_MANUAL_DATE_META_KEY);
  const claimsCleared = args.db.clearBountyFirstSnipeClaimsForDate(args.guildId, dateKey);
  const sorted = args.db.getAllPlayersSorted(args.guildId);
  const { allHumans, nameMap } = await takeDiscordHumanLeaderboardPaged(guild, sorted, bountyEnv.topN);
  const targetIds = allHumans.map((p) => p.playerId).slice(0, bountyEnv.topN);
  args.db.upsertDailyBountyTargets(args.guildId, dateKey, targetIds, Date.now());
  const dateLabel = formatBountyDateLabel(dateKey, bountyEnv.timezone);
  let channelText: string;
  if (targetIds.length === 0) {
    channelText = L.bountyDailyNoTargetsDiscord(dateLabel);
  } else {
    const rankedLines = targetIds.map((id) => escapeDiscordMarkdownChunk(nameMap.get(id) ?? id));
    channelText = L.bountyDailyAnnouncementDiscord({ dateLabel, rankedLines });
  }
  channelText += "\n\n" + recalcFooterDiscord(claimsCleared);
  return { ok: true, dateKey, targetIds, claimsCleared, channelText };
}
