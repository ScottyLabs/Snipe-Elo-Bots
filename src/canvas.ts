import { config } from "./config";
import type { EloDb, PlayerRating } from "./db";
import { opsLog } from "./opsLog";

function slackErrorCode(err: unknown): string | undefined {
  const e = err as { data?: { error?: string } };
  return e?.data?.error;
}

/** Public channels: join so canvases.create(channel_id) works. Private: user must /invite the bot. */
async function ensureBotInChannel(client: { conversations: { join: (a: { channel: string }) => Promise<unknown> } }, channelId: string): Promise<void> {
  try {
    await client.conversations.join({ channel: channelId });
  } catch (err: unknown) {
    const code = slackErrorCode(err);
    if (code === "already_in_channel") return;
    // Missing channels:join, private channel, etc. — canvas create will error if still not a member.
  }
}

export function renderLeaderboardMarkdown(players: PlayerRating[]): string {
  const rows = players.slice(0, config.leaderboard.topN);

  const header = `# ${config.leaderboard.title}\n`;
  if (rows.length === 0) {
    return `${header}\n_No ratings yet._`;
  }

  const lines: string[] = [];
  lines.push(header.trimEnd());
  lines.push("");
  lines.push("| Rank | Player | ELO |");
  lines.push("|---:|---|---:|");

  for (let i = 0; i < rows.length; i++) {
    const p = rows[i];
    const rank = i + 1;
    const playerLabel = `![](@${p.playerId})`;
    lines.push(`| ${rank} | ${playerLabel} | ${p.rating} |`);
  }

  return lines.join("\n");
}

export async function ensureLeaderboardCanvas(params: {
  client: any;
  db: EloDb;
}): Promise<string> {
  const { client, db } = params;
  const title = config.leaderboard.title;

  // Env wins over SQLite so redeploys / empty DB still reuse the same canvas (only edits, no new create).
  const fromEnv = config.leaderboard.canvasIdOverride;
  if (fromEnv) {
    const stored = db.getMeta("leaderboard_canvas_id");
    if (stored !== fromEnv) {
      db.setMeta("leaderboard_canvas_id", fromEnv);
      if (stored) {
        opsLog("canvas.leaderboard.id_source", { source: "env_override", previousCanvasId: stored, canvasId: fromEnv });
      }
    }
    return fromEnv;
  }

  const existing = db.getMeta("leaderboard_canvas_id");
  if (existing) return existing;

  // No env id and none in DB: create once, then all later updates use canvases.edit only.
  await ensureBotInChannel(client, config.slack.channelId);

  const players = db.getAllPlayersSorted();
  const markdown = renderLeaderboardMarkdown(players);
  let created: { canvas_id?: string; id?: string };
  try {
    created = await client.canvases.create({
      channel_id: config.slack.channelId,
      title,
      document_content: { type: "markdown", markdown },
    });
  } catch (err: unknown) {
    if (slackErrorCode(err) === "not_in_channel") {
      throw new Error(
        `Slack not_in_channel: invite the bot to the snipe channel (e.g. /invite @YourBot). ` +
          `For public channels you can also add the bot scope channels:join so it can join automatically. ` +
          `Channel ID: ${config.slack.channelId}`
      );
    }
    throw err;
  }
  const canvasId = created?.canvas_id ?? created?.id;
  if (!canvasId) throw new Error("failed_to_create_canvas");
  db.setMeta("leaderboard_canvas_id", canvasId);
  opsLog("canvas.leaderboard.created", { canvasId, title });
  return canvasId;
}

export async function updateLeaderboardCanvas(params: {
  client: any;
  db: EloDb;
  canvasId: string;
}): Promise<void> {
  const { client, db, canvasId } = params;
  const players = db.getAllPlayersSorted();
  const markdown = renderLeaderboardMarkdown(players);

  await client.canvases.edit({
    canvas_id: canvasId,
    changes: [
      {
        operation: "replace",
        document_content: { type: "markdown", markdown },
      },
    ],
  });
  opsLog("canvas.leaderboard.updated", {
    canvasId,
    playerCount: players.length,
  });
}

