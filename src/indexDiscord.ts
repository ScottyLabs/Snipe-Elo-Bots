import type { Client } from "discord.js";
import { EloDb } from "./db";
import { discordConfig } from "./discord/configDiscord";
import { startDiscordBot } from "./discord/bot";
import { initIdentityMap } from "./identityMap";
import { startGraphHttpServer } from "./graphHttpServer";

async function main() {
  console.log(`[snipe-elo-discord] DB: ${discordConfig.dbPath}`);
  const db = new EloDb(discordConfig.dbPath, {
    tenantIdForLegacyMigration: discordConfig.tenantIdForLegacyMigration,
  });
  if (discordConfig.bridgedGuildId) {
    initIdentityMap(db);
  }
  const clientRef: { current: Client | null } = { current: null };
  const selfBotUserIdRef: { current: string | null } = { current: null };
  // In unified mode both bots share one Railway service; Slack's Bolt owns PORT and already
  // serves the graph viewer. Skip the Discord graph HTTP server to avoid a port conflict.
  // In standalone Discord-only mode, start it as before.
  if (!discordConfig.bridgedGuildId) {
    const port = Number(process.env.PORT ?? 8080);
    startGraphHttpServer(port, {
      db,
      selfBotUserIdRef,
      discordClientRef: clientRef,
      getGuild: async (gid) => {
        const c = clientRef.current;
        if (!c) return null;
        return c.guilds.cache.get(gid) ?? (await c.guilds.fetch(gid).catch(() => null));
      },
    });
  }
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
      selfBotUserIdRef.current = c.user?.id ?? null;
    },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
