import type { Client, Guild } from "discord.js";
import type { PlayerRating } from "./db";

/** Member display names without @mentions (no pings). Cached per guild. */

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { name: string; graphLabel: string; isBot: boolean; expiresAt: number }>();

function cacheKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

export function escapeDiscordMarkdownChunk(s: string): string {
  return s.replace(/\*/g, "·").replace(/`/g, "'").replace(/\n/g, " ").trim() || "—";
}

export async function discordUserIsBotCached(guild: Guild, userId: string): Promise<boolean> {
  return (await getDiscordUserEntryCached(guild, userId)).isBot;
}

function graphLabelFromUser(
  user: { id: string; username: string; globalName?: string | null },
  displayNameFallback: string
): string {
  const u = user.username?.trim();
  if (u) return u;
  const g = user.globalName?.replace(/\s+/g, " ").trim();
  if (g) return g;
  const d = displayNameFallback.replace(/\s+/g, " ").trim();
  if (d) return d;
  return user.id;
}

async function getDiscordUserEntryCached(
  guild: Guild,
  userId: string
): Promise<{ name: string; graphLabel: string; isBot: boolean }> {
  const key = cacheKey(guild.id, userId);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return { name: hit.name, graphLabel: hit.graphLabel, isBot: hit.isBot };
  }

  try {
    const member = await guild.members.fetch({ user: userId }).catch(() => null);
    if (member) {
      const display =
        member.displayName.replace(/\s+/g, " ").trim() || member.user.username || userId;
      const name = display;
      const graphLabel = graphLabelFromUser(member.user, member.displayName);
      const isBot = member.user.bot;
      cache.set(key, { name, graphLabel, isBot, expiresAt: now + CACHE_TTL_MS });
      return { name, graphLabel, isBot };
    }
    const user = await guild.client.users.fetch(userId).catch(() => null);
    if (user) {
      const name =
        (user.username && user.username.trim()) || user.globalName?.replace(/\s+/g, " ").trim() || userId;
      const graphLabel = graphLabelFromUser(user, "");
      const isBot = Boolean(user.bot);
      cache.set(key, { name, graphLabel, isBot, expiresAt: now + CACHE_TTL_MS });
      return { name, graphLabel, isBot };
    }
    cache.set(key, { name: userId, graphLabel: userId, isBot: false, expiresAt: now + 60_000 });
    return { name: userId, graphLabel: userId, isBot: false };
  } catch {
    cache.set(key, { name: userId, graphLabel: userId, isBot: false, expiresAt: now + 60_000 });
    return { name: userId, graphLabel: userId, isBot: false };
  }
}

export async function resolveDiscordDisplayNames(guild: Guild, userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  const out = new Map<string, string>();
  for (const id of unique) {
    const e = await getDiscordUserEntryCached(guild, id);
    out.set(id, e.name);
  }
  return out;
}

/** Graph nodes: Discord login username (handle), not numeric id — same resolution cache as leaderboard. */
export async function resolveDiscordGraphLabels(guild: Guild, userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  const out = new Map<string, string>();
  for (const id of unique) {
    const e = await getDiscordUserEntryCached(guild, id);
    out.set(id, e.graphLabel);
  }
  return out;
}

/**
 * When the guild isn’t in cache yet (e.g. graph opened before ready), still resolve handles via REST.
 */
export async function resolveDiscordGraphLabelsFromClient(
  client: Client,
  userIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  const out = new Map<string, string>();
  for (const id of unique) {
    const key = `client:${id}`;
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now) {
      out.set(id, hit.graphLabel);
      continue;
    }
    try {
      const user = await client.users.fetch(id);
      const graphLabel = graphLabelFromUser(user, user.globalName ?? "");
      const name =
        (user.username && user.username.trim()) || user.globalName?.replace(/\s+/g, " ").trim() || id;
      cache.set(key, {
        name,
        graphLabel,
        isBot: Boolean(user.bot),
        expiresAt: now + CACHE_TTL_MS,
      });
      out.set(id, graphLabel);
    } catch {
      cache.set(key, { name: id, graphLabel: id, isBot: false, expiresAt: now + 60_000 });
      out.set(id, id);
    }
  }
  return out;
}

/** IDs that are non-bot Discord users (for graph / analytics). */
export async function filterDiscordGraphHumanPlayerIds(guild: Guild, userIds: string[]): Promise<Set<string>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  const out = new Set<string>();
  for (const id of unique) {
    const e = await getDiscordUserEntryCached(guild, id);
    if (!e.isBot) out.add(id);
  }
  return out;
}

/** Rating-sorted humans up to `maxHumans` (for pagination). */
export async function takeDiscordHumanLeaderboardPaged(
  guild: Guild,
  sortedPlayers: PlayerRating[],
  maxHumans: number
): Promise<{ allHumans: PlayerRating[]; nameMap: Map<string, string> }> {
  const allHumans: PlayerRating[] = [];
  const nameMap = new Map<string, string>();
  for (const p of sortedPlayers) {
    if (allHumans.length >= maxHumans) break;
    const e = await getDiscordUserEntryCached(guild, p.playerId);
    if (e.isBot) continue;
    allHumans.push(p);
    nameMap.set(p.playerId, e.name);
  }
  return { allHumans, nameMap };
}

/** Rating-sorted slice of human (non-bot) players for leaderboard text. */
export async function takeTopDiscordHumanLeaderboard(
  guild: Guild,
  sortedPlayers: PlayerRating[],
  topN: number
): Promise<{ players: PlayerRating[]; nameMap: Map<string, string> }> {
  const { allHumans, nameMap } = await takeDiscordHumanLeaderboardPaged(guild, sortedPlayers, topN);
  return { players: allHumans, nameMap };
}
