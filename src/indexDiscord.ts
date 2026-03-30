import type { Client } from "discord.js";
import { EloDb } from "./db";
import { discordConfig } from "./discord/configDiscord";
import { startDiscordBot } from "./discord/bot";
import { startGraphHttpServer } from "./graphHttpServer";

async function main() {
  console.log(`[snipe-elo-discord] DB: ${discordConfig.dbPath}`);
  const db = new EloDb(discordConfig.dbPath, {
    tenantIdForLegacyMigration: discordConfig.tenantIdForLegacyMigration,
  });
  const clientRef: { current: Client | null } = { current: null };
  const port = Number(process.env.PORT ?? 8080);
  startGraphHttpServer(port, {
    db,
    getGuild: async (gid) => {
      const c = clientRef.current;
      if (!c) return null;
      return c.guilds.cache.get(gid) ?? (await c.guilds.fetch(gid).catch(() => null));
    },
  });
  const shutdown = (signal: NodeJS.Signals) => {
    try {
      console.log(`[snipe-elo-discord] shutdown ${signal}`);
      db.close();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  await startDiscordBot(db, {
    onReady: (c) => {
      clientRef.current = c;
    },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
