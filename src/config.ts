import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const config = {
  slack: {
    botToken: requireEnv("SLACK_BOT_TOKEN"),
    signingSecret: requireEnv("SLACK_SIGNING_SECRET"),
    channelId: requireEnv("SLACK_CHANNEL_ID"),
    // If set, bot will run in Socket Mode.
    appToken: process.env.SLACK_APP_TOKEN,
  },
  elo: {
    kFactor: Number(process.env.ELO_K_FACTOR ?? 32),
    initialRating: Number(process.env.INITIAL_RATING ?? 1000),
    // Used only for display truncation, not the ELO math itself.
    decimals: 0,
  },
  leaderboard: {
    title: process.env.LEADERBOARD_CANVAS_TITLE ?? "ELO Leaderboard",
    topN: Number(process.env.LEADERBOARD_TOP_N ?? 50),
  },
  slackOps: {
    implicitSnipeEmoji: "dart",
    undoCommand: (process.env.UNDO_COMMAND ?? "removesnipe").toLowerCase(),
    makeupCommand: (process.env.MAKEUP_COMMAND ?? "makeupsnipe").toLowerCase(),
  },
  storage: {
    dbPath: process.env.DB_PATH ?? "./snipe-elo.sqlite3",
  },
  server: {
    port: Number(process.env.PORT ?? 3000),
  },
};

