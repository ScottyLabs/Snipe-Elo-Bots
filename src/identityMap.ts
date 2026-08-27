import type { EloDb } from "./db";
import { opsLog } from "./opsLog";

let _db: EloDb;
// In-memory cache: slackId -> canonicalId (Discord snowflake or 'slack:SLACKID')
const slackToCanonical = new Map<string, string>();
// In-memory cache: canonicalId -> slackId
const canonicalToSlack = new Map<string, string>();

export function initIdentityMap(db: EloDb): void {
  _db = db;
  for (const p of db.getAllPlayerProfiles()) {
    if (p.slackId && p.canonicalId) {
      slackToCanonical.set(p.slackId, p.canonicalId);
      canonicalToSlack.set(p.canonicalId, p.slackId);
    }
  }
  _startKeycloakRefreshLoop();
}

// Returns canonical player ID.
// 'discord' -> discordId unchanged (Discord snowflakes are canonical).
// 'slack'   -> mapped canonicalId from profile if linked; else 'slack:'+slackId.
export function toCanonical(platform: 'discord' | 'slack', platformId: string): string {
  if (platform === 'discord') return platformId;
  return slackToCanonical.get(platformId) ?? `slack:${platformId}`;
}

// Slack ID for a canonical, or null.
export function slackIdForCanonical(canonicalId: string): string | null {
  if (canonicalId.startsWith('slack:')) return canonicalId.slice(6);
  return canonicalToSlack.get(canonicalId) ?? null;
}

// Discord snowflake for a canonical.
// For Discord-native canonicals this is the canonical itself.
// For 'slack:'-prefixed canonicals, returns null if not linked to a Discord account.
export function discordIdForCanonical(canonicalId: string): string | null {
  if (!canonicalId.startsWith('slack:')) return canonicalId;
  const slackId = canonicalId.slice(6);
  const mapped = slackToCanonical.get(slackId);
  return mapped && !mapped.startsWith('slack:') ? mapped : null;
}

// Persist a manual or Keycloak link. Does NOT merge player scores; call mergePlayerScoresAfterLink separately.
export function upsertLink(slackId: string, discordId: string, source: 'keycloak' | 'manual'): void {
  _db.upsertPlayerProfile({ canonicalId: discordId, slackId, discordId, source });
  slackToCanonical.set(slackId, discordId);
  canonicalToSlack.set(discordId, slackId);
  // Remove stale 'slack:slackId' profile entry now that canonical is discordId.
  _db.deletePlayerProfile(`slack:${slackId}`);
  canonicalToSlack.delete(`slack:${slackId}`);
}

// Called after upsertLink; merges player scores for the newly linked pair.
// slackPlayer canonical was 'slack:slackId'; discordPlayer canonical is discordId.
// New score = slackScore + discordScore - 1000 (additive deltas from baseline).
// If only one side has a rating row, no score change on the Discord side (except to create it).
// Deletes the 'slack:SLACKID' player row; the discordId row carries the merged rating.
export function mergePlayerScoresAfterLink(
  db: EloDb,
  guildId: string,
  slackId: string,
  discordId: string
): void {
  const slackCanonical = `slack:${slackId}`;
  const slackRatings = db.getRatings(guildId, [slackCanonical]);
  const discordRatings = db.getRatings(guildId, [discordId]);
  const slackScore = slackRatings.get(slackCanonical);
  const discordScore = discordRatings.get(discordId);

  if (slackScore !== undefined && discordScore !== undefined) {
    const merged = slackScore + discordScore - 1000;
    db.adjustPlayerRating({ guildId, playerId: discordId, delta: merged - discordScore });
  } else if (slackScore !== undefined) {
    // No Discord row yet; create it with the Slack score.
    db.ensurePlayers(guildId, [discordId]);
    db.adjustPlayerRating({ guildId, playerId: discordId, delta: slackScore - 1000 });
  }
  // If only Discord row exists: keep it unchanged.
  // Delete the Slack-canonical row.
  db.deletePlayersForGuild(guildId, [slackCanonical]);
}

// Returns the leaderboard display label for a canonical player ID in unified mode.
// Format: "slack_display_name || discord_display_name".
// Either side is the literal string "null" when that platform's name is not yet cached.
export function canonicalLeaderboardLabel(canonicalId: string): string {
  const profile = _db.getProfileByCanonical(canonicalId);
  const slackName = profile?.slackDisplayName ?? 'null';
  const discordName = profile?.discordDisplayName ?? 'null';
  return `${slackName} || ${discordName}`;
}

// Cache Slack display name into player_profiles (call after resolving name during snipe).
// Only has effect in unified mode; caller must guard on config.sharedGuildId.
export function cacheSlackDisplayName(slackId: string, displayName: string): void {
  // Strip 'slack:' prefix if caller passed a canonical ID instead of raw Slack ID.
  const rawSlackId = slackId.startsWith('slack:') ? slackId.slice(6) : slackId;
  const canonical = toCanonical('slack', rawSlackId);
  _db.updateProfileDisplayName(canonical, 'slack', displayName);
}

// Cache Discord display name into player_profiles.
export function cacheDiscordDisplayName(discordId: string, displayName: string): void {
  // discordId is already canonical for Discord users.
  _db.updateProfileDisplayName(discordId, 'discord', displayName);
}

// Use in unified mode wherever resolveSlackDisplayNames is called with canonical IDs.
// Recovers raw Slack IDs from canonicals, calls Slack API, caches results.
// For Discord-only players (no Slack link), returns their cached Discord display name.
export async function resolveCanonicalNamesViaSlack(
  slackResolver: (ids: string[]) => Promise<Map<string, string>>,
  canonicalIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const rawToCanonical = new Map<string, string>();

  for (const canonical of canonicalIds) {
    const rawSlackId = canonical.startsWith('slack:')
      ? canonical.slice(6)
      : slackIdForCanonical(canonical); // Keycloak-linked: canonical is Discord snowflake
    if (rawSlackId) {
      rawToCanonical.set(rawSlackId, canonical);
    } else {
      // Discord-only player: no Slack account, use cached Discord display name.
      const profile = _db.getProfileByCanonical(canonical);
      result.set(canonical, profile?.discordDisplayName ?? canonical);
    }
  }

  if (rawToCanonical.size > 0) {
    const slackNames = await slackResolver([...rawToCanonical.keys()]);
    for (const [rawSlackId, name] of slackNames) {
      const canonical = rawToCanonical.get(rawSlackId)!;
      cacheSlackDisplayName(rawSlackId, name);
      result.set(canonical, name);
    }
    // Fall back to cached profile for any the API couldn't resolve.
    for (const [, canonical] of rawToCanonical) {
      if (!result.has(canonical)) {
        const profile = _db.getProfileByCanonical(canonical);
        result.set(canonical, profile?.slackDisplayName ?? canonical);
      }
    }
  }

  return result;
}

// On startup in unified mode: fill in null display names by calling platform resolvers.
// Each resolver receives raw platform IDs and returns a name map. Call once after bot is ready.
export async function reconcileNullDisplayNames(resolvers: {
  slack?: (ids: string[]) => Promise<Map<string, string>>;
  discord?: (ids: string[]) => Promise<Map<string, string>>;
}): Promise<void> {
  const profiles = _db.getAllPlayerProfiles();

  if (resolvers.slack) {
    const needsSlack = profiles
      .filter(p => p.slackId && !p.slackDisplayName)
      .map(p => p.slackId!);
    if (needsSlack.length > 0) {
      try {
        const names = await resolvers.slack(needsSlack);
        for (const [slackId, name] of names) {
          const canonical = toCanonical('slack', slackId);
          _db.updateProfileDisplayName(canonical, 'slack', name);
        }
        opsLog('identityMap.reconcileNames.slack', { count: names.size });
      } catch (e) {
        opsLog('identityMap.reconcileNames.slackError', { error: String(e) });
      }
    }
  }

  if (resolvers.discord) {
    const needsDiscord = profiles
      .filter(p => p.discordId && !p.discordDisplayName)
      .map(p => p.discordId!);
    if (needsDiscord.length > 0) {
      try {
        const names = await resolvers.discord(needsDiscord);
        for (const [discordId, name] of names) {
          _db.updateProfileDisplayName(discordId, 'discord', name);
        }
        opsLog('identityMap.reconcileNames.discord', { count: names.size });
      } catch (e) {
        opsLog('identityMap.reconcileNames.discordError', { error: String(e) });
      }
    }
  }
}

// --- Keycloak refresh loop (internal) ---

function _startKeycloakRefreshLoop(): void {
  const url          = process.env.KEYCLOAK_URL?.trim();
  const realm        = process.env.KEYCLOAK_REALM?.trim();
  const clientId     = process.env.KEYCLOAK_CLIENT_ID?.trim();
  const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET?.trim();
  if (!url || !realm || !clientId || !clientSecret) return;

  const intervalMs = Number(process.env.KEYCLOAK_REFRESH_INTERVAL_MS ?? 60000);
  _refreshFromKeycloak(url, realm, clientId, clientSecret).catch(() => {});
  setInterval(() => {
    _refreshFromKeycloak(url, realm, clientId, clientSecret).catch(() => {});
  }, intervalMs).unref();
}

async function _refreshFromKeycloak(
  url: string, realm: string, clientId: string, clientSecret: string
): Promise<void> {
  const discordAlias = process.env.KEYCLOAK_DISCORD_IDP_ALIAS ?? 'discord';
  const slackAlias   = process.env.KEYCLOAK_SLACK_IDP_ALIAS   ?? 'slack';

  // Get client-credentials token.
  let token: string;
  try {
    const res = await fetch(
      `${url}/realms/${realm}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      }
    );
    if (!res.ok) { opsLog('identityMap.keycloak.tokenError', { status: res.status }); return; }
    const data = await res.json() as { access_token: string };
    token = data.access_token;
  } catch (e) {
    opsLog('identityMap.keycloak.tokenFetchFailed', { error: String(e) });
    return;
  }

  // Collect user IDs that have a Discord or Slack federated identity.
  const discordMap = new Map<string, string>(); // keycloak userId -> discordId
  const slackMap   = new Map<string, string>(); // keycloak userId -> slackId

  for (const alias of [discordAlias, slackAlias]) {
    let first = 0;
    while (first < 4000) {
      let page: Array<{ id: string }> = [];
      try {
        const r = await fetch(
          `${url}/admin/realms/${realm}/users?idpAlias=${alias}&first=${first}&max=100`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!r.ok) { opsLog('identityMap.keycloak.userPageError', { alias, status: r.status }); break; }
        page = await r.json() as Array<{ id: string }>;
      } catch { break; }

      for (const user of page) {
        try {
          const fr = await fetch(
            `${url}/admin/realms/${realm}/users/${user.id}/federated-identity`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!fr.ok) continue;
          const feds = await fr.json() as Array<{ identityProvider: string; userId: string }>;
          const discordEntry = feds.find(f => f.identityProvider === discordAlias);
          const slackEntry   = feds.find(f => f.identityProvider === slackAlias);
          if (discordEntry) discordMap.set(user.id, discordEntry.userId);
          if (slackEntry) {
            const raw = slackEntry.userId;
            const slackId = raw.includes(':') ? raw.split(':').pop()! : raw;
            if (/^[UW]/i.test(slackId)) slackMap.set(user.id, slackId);
          }
        } catch { /* skip this user */ }
      }

      if (page.length < 100) break;
      first += 100;
    }
  }

  // Link users that have both Discord and Slack IDs.
  let count = 0;
  for (const [kcId, discordId] of discordMap) {
    const slackId = slackMap.get(kcId);
    if (slackId) {
      upsertLink(slackId, discordId, 'keycloak');
      count++;
    }
  }
  opsLog('identityMap.keycloak.refresh', { count });
}
