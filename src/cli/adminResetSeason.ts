#!/usr/bin/env node
/**
 * Reset all ELO / snipe / duel / bounty / graph-session state; keep kv, hall_of_fame, polls.
 *
 *   DISCORD_DB_PATH=./snipe-elo-discord.sqlite3 DISCORD_GUILD_ID=<snowflake> npm run admin:reset
 */
import fs from "fs";
import path from "path";
import { EloDb } from "../db";

function main(): void {
  const cwd = process.cwd();
  const dbPath = path.resolve(cwd, process.env.DISCORD_DB_PATH ?? "./snipe-elo-discord.sqlite3");
  if (!fs.existsSync(dbPath)) {
    console.error(`[admin:reset] DB not found: ${dbPath}`);
    process.exit(1);
  }
  const tenant = process.env.DISCORD_GUILD_ID?.trim() || "__discord__";
  const db = new EloDb(dbPath, { tenantIdForLegacyMigration: tenant });
  db.adminResetSeasonPreserveMeta();
  db.close();
  console.log("[admin:reset] done (ratings -> INITIAL_RATING, ledger cleared, kv/hall/polls kept)");
}

main();
