import { config } from "./config";
import { EloDb } from "./db";
import { startSlackBot } from "./slackBot";

async function main() {
  const db = new EloDb(config.storage.dbPath);
  await startSlackBot({ db });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

