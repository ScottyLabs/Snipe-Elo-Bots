import type { Client } from "discord.js";
import { calendarDateKeyInTimeZone, formatBountyDateLabel, timeHourMinuteInTimeZone } from "./bounty";
import { bountyEnv } from "./bountyEnv";
import type { EloDb } from "./db";
import { escapeDiscordMarkdownChunk, takeDiscordHumanLeaderboardPaged } from "./discordDisplayNames";
import { opsLog } from "./opsLog";
import {
  escapeSlackLeaderboardName,
  takeSlackHumanLeaderboardPaged,
  type SlackInfoClient,
} from "./slackDisplayNames";
import * as L from "./voiceLemuen";

type SlackBountyClient = SlackInfoClient & {
  chat: {
    postMessage: (a: { channel: string; text: string; mrkdwn?: boolean }) => Promise<unknown>;
  };
};

export async function announceSlackBountyForDate(
  client: SlackBountyClient,
  db: EloDb,
  guildId: string,
  channelId: string,
  dateKey: string
): Promise<void> {
  if (!bountyEnv.enabled) return;
  const sorted = db.getAllPlayersSorted(guildId);
  const { allHumans, displayNames } = await takeSlackHumanLeaderboardPaged(client, sorted, bountyEnv.topN);
  const targetIds = allHumans.map((p) => p.playerId).slice(0, bountyEnv.topN);
  db.upsertDailyBountyTargets(guildId, dateKey, targetIds, Date.now());
  const dateLabel = formatBountyDateLabel(dateKey, bountyEnv.timezone);
  if (targetIds.length === 0) {
    await client.chat.postMessage({
      channel: channelId,
      text: L.bountyDailyNoTargetsSlack(dateLabel),
      mrkdwn: true,
    });
    opsLog("bounty.announced", { platform: "slack", guildId, dateKey, count: 0 });
    return;
  }
  const rankedLines = targetIds.map((id) => escapeSlackLeaderboardName(displayNames.get(id) ?? id));
  const text = L.bountyDailyAnnouncementSlack({ dateLabel, rankedLines });
  await client.chat.postMessage({ channel: channelId, text, mrkdwn: true });
  opsLog("bounty.announced", { platform: "slack", guildId, dateKey, count: targetIds.length });
}

export function startSlackBountyScheduler(
  client: SlackBountyClient,
  db: EloDb,
  guildId: string,
  channelId: string
): void {
  if (!bountyEnv.enabled) return;

  const dk = calendarDateKeyInTimeZone(Date.now(), bountyEnv.timezone);
  let lastAnnouncedDateKey: string | null =
    db.getDailyBountyAnnouncementRow(guildId, dk) !== null ? dk : null;

  const tick = async () => {
    if (!bountyEnv.enabled) return;
    const now = Date.now();
    const { hour, minute, dateKey } = timeHourMinuteInTimeZone(now, bountyEnv.timezone);
    const inMidnightWindow = hour === 0 && minute < 10;
    if (inMidnightWindow && lastAnnouncedDateKey !== dateKey) {
      lastAnnouncedDateKey = dateKey;
      try {
        await announceSlackBountyForDate(client, db, guildId, channelId, dateKey);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[bounty] Slack announce failed:", e);
        opsLog("bounty.announce_failed", { platform: "slack", guildId, dateKey, error: msg });
        lastAnnouncedDateKey = null;
      }
      return;
    }
    /* Only when no DB row yet—empty target list for today is still a stored day (do not re-announce every minute). */
    if (db.getDailyBountyAnnouncementRow(guildId, dateKey) === null) {
      try {
        await announceSlackBountyForDate(client, db, guildId, channelId, dateKey);
        lastAnnouncedDateKey = dateKey;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[bounty] Slack catch-up failed:", e);
        opsLog("bounty.catchup_failed", { platform: "slack", guildId, dateKey, error: msg });
      }
    }
  };

  setInterval(() => void tick(), 60_000);
  void tick();
}

async function announceDiscordBountyForGuild(
  client: Client,
  db: EloDb,
  guildId: string,
  channelId: string,
  dateKey: string
): Promise<void> {
  if (!bountyEnv.enabled) return;
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;
  const sorted = db.getAllPlayersSorted(guildId);
  const { allHumans, nameMap } = await takeDiscordHumanLeaderboardPaged(guild, sorted, bountyEnv.topN);
  const targetIds = allHumans.map((p) => p.playerId).slice(0, bountyEnv.topN);
  db.upsertDailyBountyTargets(guildId, dateKey, targetIds, Date.now());
  const dateLabel = formatBountyDateLabel(dateKey, bountyEnv.timezone);
  const ch = await guild.channels.fetch(channelId).catch(() => null);
  if (!ch || !ch.isTextBased()) return;
  if (targetIds.length === 0) {
    await ch.send({ content: L.bountyDailyNoTargetsDiscord(dateLabel) });
    opsLog("bounty.announced", { platform: "discord", guildId, dateKey, count: 0 });
    return;
  }
  const rankedLines = targetIds.map((id) =>
    escapeDiscordMarkdownChunk(nameMap.get(id) ?? id)
  );
  const text = L.bountyDailyAnnouncementDiscord({ dateLabel, rankedLines });
  await ch.send({ content: text });
  opsLog("bounty.announced", { platform: "discord", guildId, dateKey, count: targetIds.length });
}

export function startDiscordBountyScheduler(args: {
  client: Client;
  db: EloDb;
  /** Same resolution as snipe handling (env map + per-guild meta). */
  resolveSnipeChannelId: (guildId: string) => string | null;
}): void {
  if (!bountyEnv.enabled) return;
  const { client, db, resolveSnipeChannelId } = args;
  const lastAnnouncedByGuild = new Map<string, string | null>();

  const warmLastKeys = () => {
    const dk = calendarDateKeyInTimeZone(Date.now(), bountyEnv.timezone);
    for (const guild of client.guilds.cache.values()) {
      const channelId = resolveSnipeChannelId(guild.id);
      if (!channelId) continue;
      lastAnnouncedByGuild.set(
        guild.id,
        db.getDailyBountyAnnouncementRow(guild.id, dk) !== null ? dk : null
      );
    }
  };
  warmLastKeys();

  const tick = async () => {
    if (!bountyEnv.enabled) return;
    const now = Date.now();
    const { hour, minute, dateKey } = timeHourMinuteInTimeZone(now, bountyEnv.timezone);
    const inMidnightWindow = hour === 0 && minute < 10;

    for (const guild of client.guilds.cache.values()) {
      const channelId = resolveSnipeChannelId(guild.id);
      if (!channelId) continue;

      let last = lastAnnouncedByGuild.get(guild.id);
      if (last === undefined) {
        last = db.getDailyBountyAnnouncementRow(guild.id, dateKey) !== null ? dateKey : null;
        lastAnnouncedByGuild.set(guild.id, last);
      }

      if (inMidnightWindow && last !== dateKey) {
        const prev = last;
        lastAnnouncedByGuild.set(guild.id, dateKey);
        try {
          await announceDiscordBountyForGuild(client, db, guild.id, channelId, dateKey);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[bounty] Discord announce failed guild=${guild.id}:`, e);
          opsLog("bounty.announce_failed", { platform: "discord", guildId: guild.id, dateKey, error: msg });
          lastAnnouncedByGuild.set(guild.id, prev);
        }
        continue;
      }
      if (db.getDailyBountyAnnouncementRow(guild.id, dateKey) === null) {
        try {
          await announceDiscordBountyForGuild(client, db, guild.id, channelId, dateKey);
          lastAnnouncedByGuild.set(guild.id, dateKey);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[bounty] Discord catch-up failed guild=${guild.id}:`, e);
          opsLog("bounty.catchup_failed", { platform: "discord", guildId: guild.id, dateKey, error: msg });
        }
      }
    }
  };

  setInterval(() => void tick(), 60_000);
  void tick();
}
