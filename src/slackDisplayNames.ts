/** Resolve Slack user display names without @mentions (no pings). Cached to limit users.info traffic. */

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { displayName: string; expiresAt: number }>();

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
