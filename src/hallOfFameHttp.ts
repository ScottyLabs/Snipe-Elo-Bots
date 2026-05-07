import type { Guild } from "discord.js";
import fs from "fs";
import http from "http";
import path from "path";
import type { EloDb, HallOfFameSnapshotRow, PlayerRating } from "./db";
import { takeDiscordHumanLeaderboardPaged } from "./discordDisplayNames";
import type { GraphHttpPlatformContext } from "./graphHttpPlatformContext";
import { opsLog } from "./opsLog";
import { takeSlackHumanLeaderboardPaged, type SlackInfoClient } from "./slackDisplayNames";
import { SLACK_GUILD_ID } from "./tenants";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

function hallPublicDir(): string {
  return path.join(__dirname, "..", "public", "hall");
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const s = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(s),
    "Cache-Control": "no-store",
  });
  res.end(s);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function bearerToken(req: http.IncomingMessage): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

function resolvePublicGuildId(db: EloDb, url: URL): string | null {
  const explicit = url.searchParams.get("guildId")?.trim();
  if (explicit) return explicit;
  const preferred = process.env.PUBLIC_GRAPH_GUILD_ID?.trim() || process.env.DISCORD_GUILD_ID?.trim();
  if (preferred) return preferred;
  const guildIds = db.listGuildIdsWithPlayerRows();
  if (guildIds.length === 1) return guildIds[0];
  if (guildIds.includes(SLACK_GUILD_ID)) return SLACK_GUILD_ID;
  return guildIds[0] ?? null;
}

export type HallOfFameHttpContext = GraphHttpPlatformContext & {
  getGuild: (guildId: string) => Promise<Guild | null>;
  /** Slack bot only: used to archive `__slack__` without a Discord `Guild`. */
  getSlackArchiveClient?: () => SlackInfoClient | null;
};

function clampInt(n: unknown, lo: number, hi: number, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(hi, Math.max(lo, Math.floor(v)));
}

function clampArchiveString(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * Serves `/hof/` static site and `/api/hof/*` APIs.
 * @returns true if this handler wrote the response.
 */
export async function handleHallOfFameRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  ctx: HallOfFameHttpContext
): Promise<boolean> {
  const { db, getGuild } = ctx;
  const root = hallPublicDir();

  const serveFile = (rel: string): void => {
    const resolved = path.normalize(path.join(root, rel));
    if (!resolved.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(resolved, (err, buf) => {
      if (err) {
        res.writeHead(404).end();
        return;
      }
      const ext = path.extname(resolved).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream", "Cache-Control": "no-store" });
      res.end(buf);
    });
  };

  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const p = url.pathname;

  try {
    if (req.method === "GET" && p === "/hof") {
      res.writeHead(302, { Location: "/hof/" });
      res.end();
      return true;
    }

    if (req.method === "GET" && p === "/hof/") {
      serveFile("index.html");
      return true;
    }

    if (req.method === "GET" && p.startsWith("/hof/")) {
      const rel = p.slice("/hof/".length) || "index.html";
      if (rel.includes("..")) {
        res.writeHead(403).end();
        return true;
      }
      serveFile(rel);
      return true;
    }

    const graphToken = bearerToken(req);

    if (req.method === "GET" && p === "/api/hof/cycles") {
      const guildId = graphToken ? db.validateGraphSession(graphToken) : resolvePublicGuildId(db, url);
      if (!guildId) {
        json(res, 401, { error: "unauthorized" });
        return true;
      }
      const cycles = db.listHallOfFameCycles(guildId);
      const guildName = await ctx.guildDisplayName(guildId);
      json(res, 200, { cycles, guildName });
      return true;
    }

    const oneCycleMatch = /^\/api\/hof\/cycles\/([^/]+)$/.exec(p);
    if (req.method === "GET" && oneCycleMatch) {
      const guildId = graphToken ? db.validateGraphSession(graphToken) : resolvePublicGuildId(db, url);
      if (!guildId) {
        json(res, 401, { error: "unauthorized" });
        return true;
      }
      const cycleId = decodeURIComponent(oneCycleMatch[1]);
      const cycle = db.getHallOfFameCycle(guildId, cycleId);
      if (!cycle) {
        json(res, 404, { error: "not_found" });
        return true;
      }
      json(res, 200, { cycle });
      return true;
    }

    if (req.method === "POST" && p === "/api/hof/archive") {
      const adminTok = process.env.HALL_OF_FAME_ARCHIVE_TOKEN?.trim();
      if (!adminTok) {
        json(res, 503, { error: "archive_not_configured" });
        return true;
      }
      const auth = bearerToken(req);
      if (!auth || auth !== adminTok) {
        json(res, 401, { error: "unauthorized" });
        return true;
      }
      const raw = await readBody(req);
      let j: Record<string, unknown> = {};
      try {
        j = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        json(res, 400, {
          error: "invalid_json",
          hint: 'Body must be valid JSON. Use only straight ASCII double-quote characters ("), not typographic quotes from Slack/Word.',
        });
        return true;
      }
      const guildId = typeof j.guildId === "string" ? j.guildId.trim() : "";
      const title = clampArchiveString(j.title, 500);
      if (!guildId || !title) {
        json(res, 400, { error: "guild_id_and_title_required" });
        return true;
      }
      const subtitleRaw = j.subtitle;
      const subtitle =
        typeof subtitleRaw === "string" && subtitleRaw.trim()
          ? clampArchiveString(subtitleRaw, 500)
          : null;
      const rewardsRaw = j.rewardsText;
      const rewardsText =
        typeof rewardsRaw === "string" && rewardsRaw.trim()
          ? clampArchiveString(rewardsRaw, 12_000)
          : null;
      const closedAtRaw = j.closedAt;
      const closedAt =
        typeof closedAtRaw === "number" && Number.isFinite(closedAtRaw)
          ? Math.floor(closedAtRaw)
          : Date.now();
      const defaultTop = Number(process.env.HALL_OF_FAME_SNAPSHOT_TOP ?? 100);
      const topN = clampInt(j.topN, 1, 500, defaultTop);
      const sorted = db.getAllPlayersSorted(guildId);

      let allHumans: PlayerRating[];
      let nameMap: Map<string, string>;
      if (guildId === SLACK_GUILD_ID) {
        const slackClient = ctx.getSlackArchiveClient?.() ?? null;
        if (!slackClient) {
          json(res, 400, {
            error: "guild_unavailable",
            hint: "Slack tenant archive requires the Slack bot HTTP handler (Slack API client).",
          });
          return true;
        }
        const r = await takeSlackHumanLeaderboardPaged(slackClient, sorted, topN);
        allHumans = r.allHumans;
        nameMap = r.displayNames;
      } else {
        const guild = await getGuild(guildId);
        if (!guild) {
          json(res, 400, { error: "guild_unavailable" });
          return true;
        }
        const r = await takeDiscordHumanLeaderboardPaged(guild, sorted, topN);
        allHumans = r.allHumans;
        nameMap = r.nameMap;
      }
      const snapshot: HallOfFameSnapshotRow[] = allHumans.map((pl, i) => ({
        rank: i + 1,
        playerId: pl.playerId,
        displayName: nameMap.get(pl.playerId) ?? pl.playerId,
        rating: pl.rating,
      }));

      const { cycleId } = db.insertHallOfFameCycle({
        guildId,
        title,
        subtitle,
        closedAt,
        rewardsText,
        snapshot,
      });
      opsLog("hof.archived", { cycleId, guildId, rows: snapshot.length });
      json(res, 200, { cycleId, guildId, snapshotCount: snapshot.length });
      return true;
    }

    if (req.method === "POST" && p === "/api/hof/undo-latest") {
      const adminTok = process.env.HALL_OF_FAME_ARCHIVE_TOKEN?.trim();
      if (!adminTok) {
        json(res, 503, { error: "archive_not_configured" });
        return true;
      }
      const auth = bearerToken(req);
      if (!auth || auth !== adminTok) {
        json(res, 401, { error: "unauthorized" });
        return true;
      }
      const raw = await readBody(req);
      let j: Record<string, unknown> = {};
      try {
        j = JSON.parse(raw || "{}") as Record<string, unknown>;
      } catch {
        json(res, 400, {
          error: "invalid_json",
          hint: 'Body must be valid JSON. Use only straight ASCII double-quote characters ("), not typographic quotes from Slack/Word.',
        });
        return true;
      }
      const guildId = typeof j.guildId === "string" ? j.guildId.trim() : "";
      if (!guildId) {
        json(res, 400, { error: "guild_id_required" });
        return true;
      }
      const out = db.deleteLatestHallOfFameCycle(guildId);
      if (!out.deleted) {
        json(res, 200, { deleted: false, guildId });
        return true;
      }
      json(res, 200, {
        deleted: true,
        guildId,
        cycleId: out.cycleId,
        title: out.title ?? null,
      });
      return true;
    }

    return false;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    json(res, 500, { error: "server_error", message: msg });
    return true;
  }
}
