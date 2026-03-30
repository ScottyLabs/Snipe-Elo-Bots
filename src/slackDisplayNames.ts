/** Resolve Slack user display names without @mentions (no pings). Cached to limit users.info traffic. */

import type { PlayerRating } from "./db";
import { parseUserToken } from "./parse";

const CACHE_TTL_MS = 10 * 60 * 1000;
const profileCache = new Map<string, { snap: SlackUserProfileSnap; expiresAt: number }>();
const usernameToIdCache = new Map<string, { userId: string; expiresAt: number }>();

export type SlackUserProfileSnap = {
  displayName: string;
  isBot: boolean;
  deleted: boolean;
};

export type SlackInfoClient = { users: { info: (a: { user: string }) => Promise<unknown> } };

function slackDisplayNameFromUser(
  u: {
    name?: string;
    real_name?: string;
    profile?: { display_name?: string; real_name?: string };
  },
  fallbackId: string
): string {
  return (
    (u.profile?.display_name && String(u.profile.display_name).trim()) ||
    (u.profile?.real_name && String(u.profile.real_name).trim()) ||
    (u.real_name && String(u.real_name).trim()) ||
    (u.name && String(u.name).trim()) ||
    fallbackId
  );
}

/**
 * Cached users.info: display label, bot flag, deleted. Used for leaderboards (humans only) and snipe guards.
 */
export async function getSlackUserProfileCached(client: SlackInfoClient, userId: string): Promise<SlackUserProfileSnap | null> {
  const now = Date.now();
  const hit = profileCache.get(userId);
  if (hit && hit.expiresAt > now) return hit.snap;

  try {
    const res = (await client.users.info({ user: userId })) as {
      user?: {
        is_bot?: boolean;
        deleted?: boolean;
        name?: string;
        real_name?: string;
        profile?: { display_name?: string; real_name?: string };
      };
    };
    const u = res.user;
    if (!u) return null;
    const snap: SlackUserProfileSnap = {
      displayName: slackDisplayNameFromUser(u, userId),
      isBot: Boolean(u.is_bot),
      deleted: Boolean(u.deleted),
    };
    profileCache.set(userId, { snap, expiresAt: now + CACHE_TTL_MS });
    return snap;
  } catch {
    const snap: SlackUserProfileSnap = { displayName: userId, isBot: false, deleted: false };
    profileCache.set(userId, { snap, expiresAt: now + 60_000 });
    return snap;
  }
}

export function escapeSlackTableCell(s: string): string {
  return s.replace(/\|/g, "·").replace(/\n/g, " ").trim() || "—";
}

/** Plain display names in mrkdwn messages (no pings; avoid accidental bold/italic). */
export function escapeSlackLeaderboardName(s: string): string {
  return s
    .replace(/\*/g, "·")
    .replace(/_/g, "·")
    .replace(/`/g, "'")
    .replace(/</g, "‹")
    .replace(/>/g, "›")
    .replace(/\n/g, " ")
    .trim() || "—";
}

export async function resolveSlackDisplayNames(client: SlackInfoClient, userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  const out = new Map<string, string>();
  for (const id of unique) {
    const snap = await getSlackUserProfileCached(client, id);
    out.set(id, snap?.displayName ?? id);
  }
  return out;
}

/** IDs that are non-bot, non-deleted Slack users (for graph / analytics). */
export async function filterSlackGraphHumanPlayerIds(client: SlackInfoClient, userIds: string[]): Promise<Set<string>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  const out = new Set<string>();
  for (const id of unique) {
    const snap = await getSlackUserProfileCached(client, id);
    if (snap && !snap.isBot && !snap.deleted) out.add(id);
  }
  return out;
}

/** Walk rating-sorted players; skip bots and deleted until `maxHumans` humans collected (for pagination). */
export async function takeSlackHumanLeaderboardPaged(
  client: SlackInfoClient,
  sortedPlayers: PlayerRating[],
  maxHumans: number
): Promise<{ allHumans: PlayerRating[]; displayNames: Map<string, string> }> {
  const allHumans: PlayerRating[] = [];
  const displayNames = new Map<string, string>();
  for (const p of sortedPlayers) {
    if (allHumans.length >= maxHumans) break;
    const snap = await getSlackUserProfileCached(client, p.playerId);
    if (!snap || snap.isBot || snap.deleted) continue;
    allHumans.push(p);
    displayNames.set(p.playerId, snap.displayName);
  }
  return { allHumans, displayNames };
}

/** Walk rating-sorted players; skip bots and deleted accounts until `topN` humans (for canvas / text leaderboard). */
export async function takeTopSlackHumanLeaderboard(
  client: SlackInfoClient,
  sortedPlayers: PlayerRating[],
  topN: number
): Promise<{ players: PlayerRating[]; displayNames: Map<string, string> }> {
  const { allHumans, displayNames } = await takeSlackHumanLeaderboardPaged(client, sortedPlayers, topN);
  return { players: allHumans, displayNames };
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
export async function resolveSlackUserTokenToUserId(client: UsersListClient, raw: string): Promise<string | null> {
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
