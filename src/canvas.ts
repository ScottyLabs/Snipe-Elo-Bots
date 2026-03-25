import { config } from "./config";
import type { EloDb, PlayerRating } from "./db";

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
    const playerLabel = `<!@${p.playerId}>`;
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

  const existing = db.getMeta("leaderboard_canvas_id");
  if (existing) return existing;

  const fromEnv = config.leaderboard.canvasIdOverride;
  if (fromEnv) {
    db.setMeta("leaderboard_canvas_id", fromEnv);
    return fromEnv;
  }

  // @slack/web-api exposes canvases.create / edit but not canvases.list; create a new canvas.
  const players = db.getAllPlayersSorted();
  const markdown = renderLeaderboardMarkdown(players);
  const created = await client.canvases.create({
    channel_id: config.slack.channelId,
    title,
    document_content: { type: "markdown", markdown },
  });
  const canvasId = created?.canvas_id ?? created?.id;
  if (!canvasId) throw new Error("failed_to_create_canvas");
  db.setMeta("leaderboard_canvas_id", canvasId);
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
}

