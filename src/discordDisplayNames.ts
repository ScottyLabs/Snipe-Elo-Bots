import type { Guild } from "discord.js";
import type { PlayerRating } from "./db";

/** Member display names without @mentions (no pings). Cached per guild. */

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { name: string; isBot: boolean; expiresAt: number }>();

function cacheKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

export function escapeDiscordMarkdownChunk(s: string): string {
  return s.replace(/\*/g, "·").replace(/`/g, "'").replace(/\n/g, " ").trim() || "—";
}

export async function discordUserIsBotCached(guild: Guild, userId: string): Promise<boolean> {
  return (await getDiscordUserEntryCached(guild, userId)).isBot;
}

async function getDiscordUserEntryCached(guild: Guild, userId: string): Promise<{ name: string; isBot: boolean }> {
  const key = cacheKey(guild.id, userId);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return { name: hit.name, isBot: hit.isBot };

  try {
    const member = await guild.members.fetch({ user: userId }).catch(() => null);
    if (member) {
      const name =
        member.displayName.replace(/\s+/g, " ").trim() || member.user.username || userId;
      const isBot = member.user.bot;
      cache.set(key, { name, isBot, expiresAt: now + CACHE_TTL_MS });
      return { name, isBot };
    }
    const user = await guild.client.users.fetch(userId).catch(() => null);
    const name = (user?.username && user.username.trim()) || userId;
    const isBot = Boolean(user?.bot);
    cache.set(key, { name, isBot, expiresAt: now + CACHE_TTL_MS });
    return { name, isBot };
  } catch {
    cache.set(key, { name: userId, isBot: false, expiresAt: now + 60_000 });
    return { name: userId, isBot: false };
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

/** Rating-sorted slice of human (non-bot) players for leaderboard text. */
export async function takeTopDiscordHumanLeaderboard(
  guild: Guild,
  sortedPlayers: PlayerRating[],
  topN: number
): Promise<{ players: PlayerRating[]; nameMap: Map<string, string> }> {
  const players: PlayerRating[] = [];
  const nameMap = new Map<string, string>();
  for (const p of sortedPlayers) {
    if (players.length >= topN) break;
    const e = await getDiscordUserEntryCached(guild, p.playerId);
    if (e.isBot) continue;
    players.push(p);
    nameMap.set(p.playerId, e.name);
  }
  return { players, nameMap };
}
