import { EloDb } from "./db";
import { startDiscordBot } from "./discord/bot";
import { discordConfig } from "./discord/configDiscord";
import http from "http";

function startHealthServer(): void {
  const port = Number(process.env.PORT ?? 8080);
  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/health" || url === "/") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ok");
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("not found");
  });
  server.listen(port, () => {
    console.log(`[snipe-elo-discord] Health server listening on :${port}`);
  });
}

async function main() {
  console.log(`[snipe-elo-discord] DB: ${discordConfig.dbPath}`);
  startHealthServer();
  const db = new EloDb(discordConfig.dbPath, {
    tenantIdForLegacyMigration: discordConfig.tenantIdForLegacyMigration,
  });
  await startDiscordBot(db);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
