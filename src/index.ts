import { config } from "./config";
import { EloDb } from "./db";
import { opsLog } from "./opsLog";
import { startSlackBot } from "./slackBot";

async function main() {
  opsLog("service.boot", {
    node: process.version,
    dbPath: config.storage.dbPath,
  });
  const db = new EloDb(config.storage.dbPath);
  const shutdown = (signal: NodeJS.Signals) => {
    try {
      opsLog("service.shutdown", { signal });
      db.close();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  await startSlackBot({ db });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

