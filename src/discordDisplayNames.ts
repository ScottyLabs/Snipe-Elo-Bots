import type { Guild } from "discord.js";

/** Member display names without @mentions (no pings). Cached per guild. */

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { name: string; expiresAt: number }>();

function cacheKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

export function escapeDiscordMarkdownChunk(s: string): string {
  return s.replace(/\*/g, "·").replace(/`/g, "'").replace(/\n/g, " ").trim() || "—";
}

export async function resolveDiscordDisplayNames(guild: Guild, userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  const out = new Map<string, string>();
  const now = Date.now();
  const toFetch: string[] = [];

  for (const id of unique) {
    const key = cacheKey(guild.id, id);
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now) {
      out.set(id, hit.name);
    } else {
      toFetch.push(id);
    }
  }

  for (const id of toFetch) {
    const key = cacheKey(guild.id, id);
    try {
      const member = await guild.members.fetch({ user: id }).catch(() => null);
      if (member) {
        const name =
          member.displayName.replace(/\s+/g, " ").trim() ||
          member.user.username ||
          id;
        cache.set(key, { name, expiresAt: now + CACHE_TTL_MS });
        out.set(id, name);
        continue;
      }
      const user = await guild.client.users.fetch(id).catch(() => null);
      const name = (user?.username && user.username.trim()) || id;
      cache.set(key, { name, expiresAt: now + CACHE_TTL_MS });
      out.set(id, name);
    } catch {
      out.set(id, id);
      cache.set(key, { name: id, expiresAt: now + 60_000 });
    }
  }

  return out;
}
