import { config } from "./config";
import type { EloDb, PlayerRating } from "./db";
import { opsLog } from "./opsLog";
import { escapeSlackTableCell, takeSlackHumanLeaderboardPaged } from "./slackDisplayNames";
import { SLACK_GUILD_ID } from "./tenants";

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

/** One heading + table only; native canvas title is cleared on update so Slack does not stack title bar + body (huge gap). */
function normalizeCanvasMarkdown(markdown: string): string {
  return markdown.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export function renderLeaderboardMarkdown(
  pageRows: PlayerRating[],
  displayNames: Map<string, string>,
  meta?: { startRank: number; totalListedHumans: number; totalPages: number }
): string {
  const title = config.leaderboard.title;

  if (pageRows.length === 0) {
    return normalizeCanvasMarkdown(`# ${title}\n\n_No ratings yet._`);
  }

  const lines: string[] = [`# ${title}`, ""];
  if (meta && meta.totalPages > 1) {
    lines.push(
      `_Showing ranks ${meta.startRank}–${meta.startRank + pageRows.length - 1} (page 1 of ${meta.totalPages}; top ${meta.totalListedHumans} on the board). Use /leaderboard in channel to flip pages._`,
      ""
    );
  }
  lines.push("| Rank | Player | ELO |", "|---:|---|---:|");

  const startRank = meta?.startRank ?? 1;
  for (let i = 0; i < pageRows.length; i++) {
    const p = pageRows[i];
    const rank = startRank + i;
    const raw = displayNames.get(p.playerId) ?? p.playerId;
    const playerLabel = escapeSlackTableCell(raw);
    lines.push(`| ${rank} | ${playerLabel} | ${p.rating} |`);
  }

  return normalizeCanvasMarkdown(lines.join("\n"));
}

/** Invisible title so the channel tab still has a label without duplicating the visible `# …` heading. */
const CANVAS_TAB_TITLE = "\u200b";

async function setCanvasTabTitle(client: { canvases: { edit: (a: unknown) => Promise<unknown> } }, canvasId: string): Promise<void> {
  try {
    await client.canvases.edit({
      canvas_id: canvasId,
      changes: [
        {
          operation: "rename",
          title_content: { type: "markdown", markdown: CANVAS_TAB_TITLE },
        },
      ],
    });
  } catch {
    // Older canvases or API quirks: leaderboard body still updates.
  }
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
    const stored = db.getMeta(SLACK_GUILD_ID, "leaderboard_canvas_id");
    if (stored !== fromEnv) {
      db.setMeta(SLACK_GUILD_ID, "leaderboard_canvas_id", fromEnv);
      if (stored) {
        opsLog("canvas.leaderboard.id_source", { source: "env_override", previousCanvasId: stored, canvasId: fromEnv });
      }
    }
    return fromEnv;
  }

  const existing = db.getMeta(SLACK_GUILD_ID, "leaderboard_canvas_id");
  if (existing) return existing;

  // No env id and none in DB: create once, then all later updates use canvases.edit only.
  await ensureBotInChannel(client, config.slack.channelId);

  const sorted = db.getAllPlayersSorted(SLACK_GUILD_ID);
  const { allHumans, displayNames } = await takeSlackHumanLeaderboardPaged(
    client,
    sorted,
    config.leaderboard.topN
  );
  const pageSize = config.leaderboard.pageSize;
  const totalPages = allHumans.length === 0 ? 1 : Math.ceil(allHumans.length / pageSize);
  const pageSlice = allHumans.slice(0, Math.min(pageSize, allHumans.length));
  const markdown = renderLeaderboardMarkdown(pageSlice, displayNames, {
    startRank: 1,
    totalListedHumans: allHumans.length,
    totalPages,
  });
  let created: { canvas_id?: string; id?: string };
  try {
    created = await client.canvases.create({
      channel_id: config.slack.channelId,
      document_content: { type: "markdown", markdown },
    });
  } catch (err: unknown) {
    if (slackErrorCode(err) === "not_in_channel") {
      throw new Error(
        `The channel won't have me—not_in_channel. Invite the bot to the snipe room (e.g. /invite @YourBot), ` +
          `or grant channels:join for public halls. Channel: ${config.slack.channelId}`
      );
    }
    throw err;
  }
  const canvasId = created?.canvas_id ?? created?.id;
  if (!canvasId) throw new Error("The leaderboard canvas refused to appear—check scopes and channel access.");
  await setCanvasTabTitle(client, canvasId);
  db.setMeta(SLACK_GUILD_ID, "leaderboard_canvas_id", canvasId);
  opsLog("canvas.leaderboard.created", { canvasId, title });
  return canvasId;
}

export async function updateLeaderboardCanvas(params: {
  client: any;
  db: EloDb;
  canvasId: string;
}): Promise<void> {
  const { client, db, canvasId } = params;
  const sorted = db.getAllPlayersSorted(SLACK_GUILD_ID);
  const { allHumans, displayNames } = await takeSlackHumanLeaderboardPaged(
    client,
    sorted,
    config.leaderboard.topN
  );
  const pageSize = config.leaderboard.pageSize;
  const totalPages = allHumans.length === 0 ? 1 : Math.ceil(allHumans.length / pageSize);
  const pageSlice = allHumans.slice(0, Math.min(pageSize, allHumans.length));
  const markdown = renderLeaderboardMarkdown(pageSlice, displayNames, {
    startRank: 1,
    totalListedHumans: allHumans.length,
    totalPages,
  });

  await client.canvases.edit({
    canvas_id: canvasId,
    changes: [
      {
        operation: "replace",
        document_content: { type: "markdown", markdown },
      },
    ],
  });
  await setCanvasTabTitle(client, canvasId);
  opsLog("canvas.leaderboard.updated", {
    canvasId,
    playerCount: allHumans.length,
  });
}

