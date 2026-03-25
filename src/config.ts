import dotenv from "dotenv";

// Avoid noisy "injecting env (0) from .env" on Railway (vars come from the platform, not a file).
dotenv.config({ quiet: true });

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
    /** If set, use this canvas instead of creating a new one (Slack SDK has no canvases.list). */
    canvasIdOverride: process.env.LEADERBOARD_CANVAS_ID?.trim() || null,
  },
  slackOps: {
    implicitSnipeEmoji: "dart",
    undoCommand: (process.env.UNDO_COMMAND ?? "removesnipe").toLowerCase(),
    makeupCommand: (process.env.MAKEUP_COMMAND ?? "makeupsnipe").toLowerCase(),
    /** If false, mentioning others counts as a snipe without an image (easier testing / alternate rules). */
    snipeRequireImage: !["0", "false", "no", "off"].includes(
      (process.env.SNIPE_REQUIRE_IMAGE ?? "true").toLowerCase()
    ),
  },
  storage: {
    dbPath: process.env.DB_PATH ?? "./snipe-elo.sqlite3",
  },
  server: {
    port: Number(process.env.PORT ?? 3000),
  },
};

