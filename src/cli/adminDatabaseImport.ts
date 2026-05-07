#!/usr/bin/env node
/**
 * Replace DB from a flat admin export CSV (same format as GET /api/admin/database.csv).
 *
 *   DISCORD_DB_PATH=./snipe-elo-discord.sqlite3 DISCORD_GUILD_ID=<snowflake> npm run admin:import -- path/to/export.csv
 */
import fs from "fs";
import path from "path";
import { EloDb } from "../db";

function main(): void {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: npm run admin:import -- <path-to-export.csv>");
    process.exit(1);
  }
  const abs = path.resolve(process.cwd(), csvPath);
  if (!fs.existsSync(abs)) {
    console.error(`[admin:import] file not found: ${abs}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(abs, "utf8");
  const cwd = process.cwd();
  const dbPath = path.resolve(cwd, process.env.DISCORD_DB_PATH ?? "./snipe-elo-discord.sqlite3");
  const tenant = process.env.DISCORD_GUILD_ID?.trim() || "__discord__";
  const db = new EloDb(dbPath, { tenantIdForLegacyMigration: tenant });
  db.adminReplaceDatabaseFromFlatExportCsv(raw);
  db.close();
  console.log("[admin:import] done");
}

main();
