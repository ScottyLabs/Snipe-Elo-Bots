import { EloDb } from "./db";
import { startDiscordBot } from "./discord/bot";
import { discordConfig } from "./discord/configDiscord";

async function main() {
  console.log(`[snipe-elo-discord] DB: ${discordConfig.dbPath}`);
  const db = new EloDb(discordConfig.dbPath, {
    tenantIdForLegacyMigration: discordConfig.tenantIdForLegacyMigration,
  });
  await startDiscordBot(db);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
