#!/usr/bin/env node
/**
 * Import hall-of-fame cycles from CSV files in ./hall-of-fame-inbox/
 *
 * Supports:
 * 1) Hand-written hall files (see hall-of-fame-inbox/FORMAT.txt) — first line `# hall_of_fame_import v1`
 * 2) Exact admin dump from GET /api/admin/database.csv — first non-empty line `# TABLE:…`
 *
 *   DISCORD_DB_PATH=./snipe-elo-discord.sqlite3 DISCORD_GUILD_ID=<snowflake> npm run hof:import
 */
import fs from "fs";
import path from "path";
import { EloDb } from "../db";
import {
  buildHallImportsFromAdminExportSections,
  insertParsedHallOfFame,
  looksLikeAdminDatabaseFlatCsv,
  looksLikeHallOfFameImportCsv,
  parseFlatCsvExportSections,
  parseHallOfFameImportCsv,
} from "../hallOfFameCsvImport";

const INBOX = "hall-of-fame-inbox";

function main(): void {
  const cwd = process.cwd();
  const inboxDir = path.join(cwd, INBOX);
  const processedDir = path.join(inboxDir, "processed");
  const failedDir = path.join(inboxDir, "failed");
  fs.mkdirSync(inboxDir, { recursive: true });
  fs.mkdirSync(processedDir, { recursive: true });
  fs.mkdirSync(failedDir, { recursive: true });

  const rawDb = process.env.DISCORD_DB_PATH ?? "./snipe-elo-discord.sqlite3";
  const dbPath = path.resolve(cwd, rawDb);
  const tenant = process.env.DISCORD_GUILD_ID?.trim() || "__discord__";

  let db: EloDb;
  try {
    db = new EloDb(dbPath, { tenantIdForLegacyMigration: tenant });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err?.code === "ENOENT") {
      console.error(`[hof:import] Cannot open database at:\n  ${dbPath}`);
      console.error(
        "  DISCORD_DB_PATH must be a real .sqlite3 file (Slack: same as DB_PATH, often ./snipe-elo.sqlite3)."
      );
      console.error('  Do not use documentation placeholders like "/path/to/your/…".');
      process.exit(1);
    }
    throw e;
  }

  const files = fs
    .readdirSync(inboxDir)
    .filter((f) => f.toLowerCase().endsWith(".csv") && !f.startsWith("."))
    .sort();

  if (files.length === 0) {
    console.log(`[hof:import] No .csv files in ${inboxDir}/ — nothing to do.`);
    db.close();
    return;
  }

  for (const name of files) {
    const src = path.join(inboxDir, name);
    let text: string;
    try {
      text = fs.readFileSync(src, "utf8");
    } catch (e) {
      console.error(`[hof:import] skip ${name}:`, e);
      continue;
    }

    const baseName = path.parse(name).name;

    try {
      if (looksLikeHallOfFameImportCsv(text)) {
        const parsed = parseHallOfFameImportCsv(text);
        const { cycleId } = insertParsedHallOfFame(db, parsed);
        moveProcessed(src, processedDir, name);
        console.log(
          `[hof:import] ok ${name} (hand format) -> cycle ${cycleId} guild ${parsed.guildId} (${parsed.snapshot.length} rows)`
        );
        continue;
      }

      if (looksLikeAdminDatabaseFlatCsv(text)) {
        const sections = parseFlatCsvExportSections(text);
        const imports = buildHallImportsFromAdminExportSections(sections, baseName);
        const cycleIds: string[] = [];
        for (const p of imports) {
          const { cycleId } = insertParsedHallOfFame(db, p);
          cycleIds.push(cycleId);
        }
        moveProcessed(src, processedDir, name);
        console.log(
          `[hof:import] ok ${name} (admin export) -> ${cycleIds.length} cycle(s) ${cycleIds.join(", ")} (${imports.map((i) => `${i.guildId}:${i.snapshot.length}`).join("; ")})`
        );
        continue;
      }

      console.log(`[hof:import] skip ${name}: not a hall import or admin database CSV (leave file in inbox)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const dest = path.join(failedDir, `${stamp}__${name}`);
      fs.renameSync(src, dest);
      fs.writeFileSync(`${dest}.err.txt`, msg + "\n", "utf8");
      console.error(`[hof:import] FAIL ${name}: ${msg} -> ${path.basename(dest)}`);
    }
  }

  db.close();
}

function moveProcessed(src: string, processedDir: string, name: string): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(processedDir, `${stamp}__${name}`);
  fs.renameSync(src, dest);
}

main();
