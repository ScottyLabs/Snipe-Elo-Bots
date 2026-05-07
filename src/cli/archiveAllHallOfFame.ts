#!/usr/bin/env node
/**
 * POST /api/hof/archive once per guild_id that has rows in `players` (same notion of “registered” as the DB).
 *
 * Discord and Slack are usually separate Railway apps and DB files. Set both base URLs when your DB lists
 * both `__slack__` and Discord snowflakes; use a single URL when the DB is only one platform.
 *
 *   export HALL_OF_FAME_ARCHIVE_TOKEN='…'
 *   export HOF_ARCHIVE_DISCORD_BASE_URL='https://discord-bot.example.railway.app'
 *   export HOF_ARCHIVE_SLACK_BASE_URL='https://slack-bot.example.railway.app'
 *   export DISCORD_DB_PATH='./snipe-elo.sqlite3'
 *   npm run hof:archive-all
 *
 * Shorthand: if both services share the same origin (unusual), set only `HOF_ARCHIVE_BASE_URL`.
 *
 * Optional: `HOF_ARCHIVE_TITLE` (default: ISO timestamp title), `HALL_OF_FAME_SNAPSHOT_TOP`, `HOF_ARCHIVE_DRY_RUN=1`.
 */
import fs from "fs";
import path from "path";
import { EloDb } from "../db";
import { SLACK_GUILD_ID } from "../tenants";

function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

function archiveBaseForGuild(
  guildId: string,
  discordBase: string,
  slackBase: string
): string | null {
  if (guildId === SLACK_GUILD_ID) return slackBase || null;
  return discordBase || null;
}

async function postArchive(
  base: string,
  token: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; text: string }> {
  const url = `${stripTrailingSlash(base)}/api/hof/archive`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, text };
}

async function main(): Promise<void> {
  const token = process.env.HALL_OF_FAME_ARCHIVE_TOKEN?.trim();
  if (!token) {
    console.error("[hof:archive-all] Set HALL_OF_FAME_ARCHIVE_TOKEN (same as the bot's archive API).");
    process.exit(1);
  }

  const single = stripTrailingSlash(process.env.HOF_ARCHIVE_BASE_URL?.trim() ?? "");
  const discordBase = stripTrailingSlash(process.env.HOF_ARCHIVE_DISCORD_BASE_URL?.trim() ?? "") || single;
  const slackBase = stripTrailingSlash(process.env.HOF_ARCHIVE_SLACK_BASE_URL?.trim() ?? "") || single;

  const cwd = process.cwd();
  const dbPath = path.resolve(cwd, process.env.DISCORD_DB_PATH ?? "./snipe-elo-discord.sqlite3");
  if (!fs.existsSync(dbPath)) {
    console.error(`[hof:archive-all] DB not found: ${dbPath}`);
    process.exit(1);
  }

  const tenant = process.env.DISCORD_GUILD_ID?.trim() || "__discord__";
  const db = new EloDb(dbPath, { tenantIdForLegacyMigration: tenant });
  const guildIds = [...new Set(db.listGuildIdsWithPlayerRows())].sort((a, b) => a.localeCompare(b));
  db.close();

  if (guildIds.length === 0) {
    console.log("[hof:archive-all] No guild_id rows in players; nothing to archive.");
    return;
  }

  const title =
    process.env.HOF_ARCHIVE_TITLE?.trim() ||
    `Season archive ${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}`;
  const topRaw = process.env.HALL_OF_FAME_SNAPSHOT_TOP;
  const topN = Math.min(500, Math.max(1, Math.floor(Number(topRaw) > 0 ? Number(topRaw) : 100)));

  const dry = process.env.HOF_ARCHIVE_DRY_RUN === "1" || process.env.HOF_ARCHIVE_DRY_RUN === "true";

  console.log(`[hof:archive-all] ${guildIds.length} guild(s) from ${dbPath}`);
  let failed = 0;

  for (const guildId of guildIds) {
    const base = archiveBaseForGuild(guildId, discordBase, slackBase);
    if (!base) {
      console.error(
        `[hof:archive-all] SKIP ${guildId}: no base URL (set HOF_ARCHIVE_DISCORD_BASE_URL / HOF_ARCHIVE_SLACK_BASE_URL or HOF_ARCHIVE_BASE_URL)`
      );
      failed++;
      continue;
    }

    const body = {
      guildId,
      title,
      subtitle: "",
      rewardsText: "",
      topN,
    };

    if (dry) {
      console.log(`[hof:archive-all] DRY_RUN would POST ${guildId} -> ${base}/api/hof/archive`);
      continue;
    }

    const out = await postArchive(base, token, body);
    if (!out.ok) {
      console.error(`[hof:archive-all] FAIL ${guildId} HTTP ${out.status}: ${out.text.slice(0, 500)}`);
      failed++;
    } else {
      console.log(`[hof:archive-all] OK ${guildId}: ${out.text.slice(0, 300)}`);
    }
  }

  if (failed) process.exit(1);
}

void main();
