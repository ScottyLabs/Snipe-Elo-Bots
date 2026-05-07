#!/usr/bin/env node
/**
 * Delete the most recently archived Hall of Fame cycle for one guild (same ordering as /hof list).
 * Does not change live ELO or snipe history.
 *
 *   DISCORD_DB_PATH=./snipe-elo.sqlite3 DISCORD_GUILD_ID=__slack__ npm run hof:undo-latest
 *   DISCORD_DB_PATH=./snipe-elo-discord.sqlite3 DISCORD_GUILD_ID=<snowflake> npm run hof:undo-latest
 *
 * On production, the SQLite file on your laptop may not match Railway. Same auth as archive:
 *   curl -sS -X POST "https://YOUR-SLACK-BOT/api/hof/undo-latest" \
 *     -H "Authorization: Bearer $HALL_OF_FAME_ARCHIVE_TOKEN" \
 *     -H "Content-Type: application/json" \
 *     -d '{"guildId":"__slack__"}'
 */
import fs from "fs";
import path from "path";
import { EloDb } from "../db";

function main(): void {
  const cwd = process.cwd();
  const dbPath = path.resolve(cwd, process.env.DISCORD_DB_PATH ?? "./snipe-elo-discord.sqlite3");
  if (!fs.existsSync(dbPath)) {
    console.error(`[hof:undo-latest] DB not found: ${dbPath}`);
    process.exit(1);
  }
  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  if (!guildId) {
    console.error("[hof:undo-latest] Set DISCORD_GUILD_ID (e.g. __slack__ or your Discord guild snowflake).");
    process.exit(1);
  }
  const tenant = guildId;
  const db = new EloDb(dbPath, { tenantIdForLegacyMigration: tenant });
  const out = db.deleteLatestHallOfFameCycle(guildId);
  db.close();
  if (!out.deleted) {
    console.log(
      `[hof:undo-latest] No rows in hall_of_fame_cycles for guild_id=${guildId}.\n` +
        `  Database file: ${dbPath}\n` +
        `  Fix: set DISCORD_DB_PATH to the same SQLite file the bot uses (Slack is often ./snipe-elo.sqlite3; default here is ./snipe-elo-discord.sqlite3). ` +
        `If the Hall UI is production only, download that volume / DB or run this where the live file lives.`
    );
    return;
  }
  console.log(
    `[hof:undo-latest] Removed cycle ${out.cycleId} (${JSON.stringify(out.title ?? "")}) for guild ${guildId} (db: ${dbPath})`
  );
}

main();
