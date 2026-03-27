import dotenv from "dotenv";
import { eloEnv } from "./eloEnv";
import { normalizeSlashCommand } from "./slashCommands";

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
  elo: eloEnv,
  leaderboard: {
    title: process.env.LEADERBOARD_CANVAS_TITLE ?? "ELO Leaderboard",
    topN: Number(process.env.LEADERBOARD_TOP_N ?? 50),
    /** If set, use this canvas instead of creating a new one (Slack SDK has no canvases.list). */
    canvasIdOverride: process.env.LEADERBOARD_CANVAS_ID?.trim() || null,
  },
  /**
   * Slash command paths for Bolt `app.command(...)`. Register matching Slash Commands in the Slack app.
   * Env may be `removesnipe` or `/removesnipe`.
   */
  slackOps: {
    implicitSnipeEmoji: "dart",
    slashUndo: normalizeSlashCommand(process.env.UNDO_COMMAND, "removesnipe"),
    slashMakeup: normalizeSlashCommand(process.env.MAKEUP_COMMAND, "makeupsnipe"),
    slashAdjustElo: normalizeSlashCommand(process.env.ADJUSTELO_COMMAND, "adjustelo"),
    slashLeaderboard: normalizeSlashCommand(process.env.SLACK_LEADERBOARD_COMMAND, "leaderboard"),
    slashShowLeaderboard: normalizeSlashCommand(process.env.SLACK_SHOW_LEADERBOARD_COMMAND, "show_leaderboard"),
    slashSnipes: normalizeSlashCommand(process.env.SLACK_SNIPES_COMMAND, "snipes"),
    slashHeadtohead: normalizeSlashCommand(process.env.SLACK_HEADTOHEAD_COMMAND, "headtohead"),
    slashHelp: normalizeSlashCommand(process.env.SLACK_HELP_COMMAND, "help"),
    slashSnipeDuel: normalizeSlashCommand(process.env.SLACK_SNIPEDUEL_COMMAND, "snipeduel"),
    /** Only these Slack user IDs may use `/adjustelo`. Comma-separated in `ADJUSTELO_ALLOWED_SLACK_USER_IDS`; default is a single operator. */
    adjustEloAllowedSlackUserIds: (process.env.ADJUSTELO_ALLOWED_SLACK_USER_IDS ?? "U09E6EHA5R8")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    /**
     * If true, also accept plain channel messages (no leading `/`) for the same command names.
     * Use when slash commands are not registered in the Slack app yet—Slack never auto-creates them from code.
     */
    textCommandsFallback: ["1", "true", "yes", "on"].includes(
      (process.env.SLACK_TEXT_COMMANDS_FALLBACK ?? "").trim().toLowerCase()
    ),
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

