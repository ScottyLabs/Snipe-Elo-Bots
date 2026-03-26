import dotenv from "dotenv";
dotenv.config({ quiet: true });

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

function parseGuildSnipeChannels(): Map<string, string> {
  const m = new Map<string, string>();
  const multi = process.env.DISCORD_GUILD_SNIPE_CHANNELS?.trim();
  if (multi) {
    for (const part of multi.split(",")) {
      const seg = part.trim();
      if (!seg) continue;
      const idx = seg.indexOf(":");
      if (idx <= 0) continue;
      const guildId = seg.slice(0, idx).trim();
      const channelId = seg.slice(idx + 1).trim();
      if (guildId && channelId) m.set(guildId, channelId);
    }
  }
  if (m.size === 0) {
    const g = process.env.DISCORD_GUILD_ID?.trim();
    const c = process.env.DISCORD_SNIPE_CHANNEL_ID?.trim();
    if (g && c) m.set(g, c);
  }
  // Empty is allowed: moderators can set per-guild channel later with /setsnipechannel.
  return m;
}

const guildSnipeChannels = parseGuildSnipeChannels();

/** Pre-migration rows in the Discord SQLite file are attributed to this guild (prefer DISCORD_GUILD_ID when set). */
function tenantIdForLegacyMigration(map: Map<string, string>): string {
  const fromEnv = process.env.DISCORD_GUILD_ID?.trim();
  if (fromEnv) return fromEnv;
  const first = map.keys().next().value;
  if (first) return first;
  // No configured guild yet; use a stable placeholder tenant for legacy rows.
  return "__discord__";
}

export const discordConfig = {
  token: requireEnv("DISCORD_BOT_TOKEN"),
  applicationId: requireEnv("DISCORD_APPLICATION_ID"),
  guildSnipeChannels,
  tenantIdForLegacyMigration: tenantIdForLegacyMigration(guildSnipeChannels),
  dbPath: process.env.DISCORD_DB_PATH ?? "./snipe-elo-discord.sqlite3",
  snipeRequireImage: !["0", "false", "no", "off"].includes(
    (process.env.SNIPE_REQUIRE_IMAGE ?? "true").toLowerCase()
  ),
  leaderboardTopN: Number(process.env.LEADERBOARD_TOP_N ?? 50),
  leaderboardTitle: process.env.LEADERBOARD_TITLE ?? "ELO Leaderboard",
};
