/** Resolve Slack user display names without @mentions (no pings). Cached to limit users.info traffic. */

import { parseUserToken } from "./parse";

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { displayName: string; expiresAt: number }>();
const usernameToIdCache = new Map<string, { userId: string; expiresAt: number }>();

export function escapeSlackTableCell(s: string): string {
  return s.replace(/\|/g, "·").replace(/\n/g, " ").trim() || "—";
}

/** Plain display names in mrkdwn messages (no pings; avoid accidental bold/italic). */
export function escapeSlackLeaderboardName(s: string): string {
  return s
    .replace(/\*/g, "·")
    .replace(/_/g, "·")
    .replace(/`/g, "'")
    .replace(/\n/g, " ")
    .trim() || "—";
}

export async function resolveSlackDisplayNames(
  client: { users: { info: (a: { user: string }) => Promise<unknown> } },
  userIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  const out = new Map<string, string>();
  const now = Date.now();
  const toFetch: string[] = [];

  for (const id of unique) {
    const hit = cache.get(id);
    if (hit && hit.expiresAt > now) {
      out.set(id, hit.displayName);
    } else {
      toFetch.push(id);
    }
  }

  for (const id of toFetch) {
    try {
      const res = (await client.users.info({ user: id })) as {
        user?: {
          name?: string;
          real_name?: string;
          profile?: { display_name?: string; real_name?: string };
        };
      };
      const u = res.user;
      const dn =
        (u?.profile?.display_name && String(u.profile.display_name).trim()) ||
        (u?.profile?.real_name && String(u.profile.real_name).trim()) ||
        (u?.real_name && String(u.real_name).trim()) ||
        (u?.name && String(u.name).trim()) ||
        id;
      cache.set(id, { displayName: dn, expiresAt: now + CACHE_TTL_MS });
      out.set(id, dn);
    } catch {
      out.set(id, id);
      cache.set(id, { displayName: id, expiresAt: now + 60_000 });
    }
  }

  return out;
}

type UsersListClient = {
  users: { list: (a: { limit?: number; cursor?: string }) => Promise<unknown> };
};

/** Map workspace username (`user.name`, e.g. lying2) to user id. Cached; uses users.list (users:read). */
export async function resolveSlackUsernameToUserId(client: UsersListClient, handle: string): Promise<string | null> {
  const h = handle.toLowerCase().trim();
  if (!h) return null;
  const now = Date.now();
  const hit = usernameToIdCache.get(h);
  if (hit && hit.expiresAt > now) return hit.userId;

  let cursor: string | undefined;
  for (;;) {
    const res = (await client.users.list({ limit: 200, cursor })) as {
      ok?: boolean;
      members?: Array<{ id?: string; name?: string; deleted?: boolean; is_bot?: boolean }>;
      response_metadata?: { next_cursor?: string };
    };
    if (!res.ok || !Array.isArray(res.members)) return null;
    for (const m of res.members) {
      if (m.deleted || m.is_bot) continue;
      if (m.id && m.name && m.name.toLowerCase() === h) {
        usernameToIdCache.set(h, { userId: m.id, expiresAt: now + CACHE_TTL_MS });
        return m.id;
      }
    }
    cursor = res.response_metadata?.next_cursor;
    if (!cursor) break;
  }
  return null;
}

/**
 * Resolves `<@U…>`, raw `U…`, or legacy @username / bare handle from slash-command text (no ping).
 */
export async function resolveSlackUserTokenToUserId(
  client: UsersListClient,
  raw: string
): Promise<string | null> {
  const t = raw.trim();
  if (!t) return null;
  const parsed = parseUserToken(t);
  if (parsed.ok) return parsed.userId;
  if (parsed.reason.startsWith("username:")) {
    const handle = parsed.reason.slice("username:".length);
    return resolveSlackUsernameToUserId(client, handle);
  }
  return null;
}
