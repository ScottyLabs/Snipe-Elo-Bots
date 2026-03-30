import type { Guild } from "discord.js";
import fs from "fs";
import http from "http";
import path from "path";
import type { EloDb } from "./db";
import { resolveDiscordDisplayNames } from "./discordDisplayNames";
import { collectIdsFromDirectedPairs } from "./headToHead";
import { opsLog } from "./opsLog";
import { SNIPES_LOG_LIMIT, buildSnipesApiPayload, collectIdsForSnipeLog } from "./snipeHistory";

/** Top 3 by ELO among graph nodes (gold / silver / bronze in viewer). */
function medalRanksForNodes(pairIds: string[], ratings: Map<string, number>): Map<string, 1 | 2 | 3> {
  const sorted = [...pairIds].sort((a, b) => {
    const ra = ratings.get(a) ?? Number.NEGATIVE_INFINITY;
    const rb = ratings.get(b) ?? Number.NEGATIVE_INFINITY;
    if (rb !== ra) return rb - ra;
    return a.localeCompare(b);
  });
  const out = new Map<string, 1 | 2 | 3>();
  for (let i = 0; i < Math.min(3, sorted.length); i++) {
    out.set(sorted[i], (i + 1) as 1 | 2 | 3);
  }
  return out;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

function graphPublicDir(): string {
  return path.join(__dirname, "..", "public", "graph");
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

/** Undirected reachability from focus (weakly connected component as a set of nodes). */
export function weaklyConnectedNodeSet(
  nodeIds: Set<string>,
  directedEdges: { from: string; to: string }[],
  focusId: string
): Set<string> {
  if (!nodeIds.has(focusId)) return new Set();
  const adj = new Map<string, Set<string>>();
  for (const e of directedEdges) {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue;
    if (!adj.has(e.from)) adj.set(e.from, new Set());
    if (!adj.has(e.to)) adj.set(e.to, new Set());
    adj.get(e.from)!.add(e.to);
    adj.get(e.to)!.add(e.from);
  }
  const seen = new Set<string>();
  const stack = [focusId];
  while (stack.length) {
    const v = stack.pop()!;
    if (seen.has(v)) continue;
    seen.add(v);
    for (const w of adj.get(v) ?? []) stack.push(w);
  }
  return seen;
}

export type GraphHttpOpts = {
  db: EloDb;
  getGuild: (guildId: string) => Promise<Guild | null>;
};

/** Discord or Slack: resolve labels for graph + player panel APIs. */
export type GraphHttpPlatformContext = {
  db: EloDb;
  guildDisplayName: (guildId: string) => Promise<string>;
  resolveDisplayNamesForGuild: (guildId: string, userIds: string[]) => Promise<Map<string, string>>;
  isGuildResolvableForPlayerPanel: (guildId: string) => Promise<boolean>;
};

export async function handleGraphSiteRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  ctx: GraphHttpPlatformContext
): Promise<void> {
  const { db } = ctx;
  const root = graphPublicDir();

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
    if (req.method === "GET" && p === "/graph") {
      res.writeHead(302, { Location: "/graph/" });
      res.end();
      return;
    }

    if (req.method === "GET" && p === "/graph/") {
      serveFile("index.html");
      return;
    }

    if (req.method === "GET" && p.startsWith("/graph/")) {
      const rel = p.slice("/graph/".length) || "index.html";
      if (rel.includes("..")) {
        res.writeHead(403).end();
        return;
      }
      serveFile(rel);
      return;
    }

    if (req.method === "POST" && p === "/api/graph/redeem") {
      const raw = await readBody(req);
      let code = "";
      try {
        const j = JSON.parse(raw) as { code?: string };
        code = typeof j.code === "string" ? j.code : "";
      } catch {
        json(res, 400, { error: "invalid_json" });
        return;
      }
      const out = db.redeemGraphPasscode(code);
      if (!out) {
        json(res, 401, { error: "invalid_or_expired_code" });
        return;
      }
      opsLog("graph.redeem", { guildId: out.guildId });
      json(res, 200, {
        token: out.token,
        sessionExpiresAtMs: out.sessionExpiresAtMs,
      });
      return;
    }

    const token = bearerToken(req);
    const guildId = token ? db.validateGraphSession(token) : null;

    if (req.method === "GET" && p === "/api/graph/data") {
      if (!guildId) {
        json(res, 401, { error: "unauthorized" });
        return;
      }
      const guildName = await ctx.guildDisplayName(guildId);
      const rows = db.getDirectedSnipePairCounts(guildId);
      const pairIds = collectIdsFromDirectedPairs(rows);
      const ratings = db.getRatings(guildId, pairIds);
      const nameMap =
        pairIds.length > 0 ? await ctx.resolveDisplayNamesForGuild(guildId, pairIds) : new Map<string, string>();
      const medals = medalRanksForNodes(pairIds, ratings);
      const nodes = pairIds.map((id) => ({
        id,
        label: nameMap.get(id) ?? id,
        rating: ratings.get(id) ?? null,
        medalRank: medals.get(id) ?? null,
      }));
      const edges = rows.map((r) => ({
        from: r.sniperId,
        to: r.snipedId,
        count: r.count,
      }));
      json(res, 200, { guildId, guildName, nodes, edges });
      return;
    }

    const playerMatch = /^\/api\/graph\/player\/([^/]+)$/.exec(p);
    if (req.method === "GET" && playerMatch) {
      if (!guildId) {
        json(res, 401, { error: "unauthorized" });
        return;
      }
      const playerId = decodeURIComponent(playerMatch[1]);
      if (!(await ctx.isGuildResolvableForPlayerPanel(guildId))) {
        json(res, 503, { error: "guild_unavailable" });
        return;
      }
      const asSniper = db.getRecentSnipesForSniper(guildId, playerId, SNIPES_LOG_LIMIT);
      const asSniped = db.getRecentSnipesAsSniped(guildId, playerId, SNIPES_LOG_LIMIT);
      const ids = collectIdsForSnipeLog(playerId, asSniper, asSniped);
      const names = await ctx.resolveDisplayNamesForGuild(guildId, ids);
      const nameOf = (id: string) => names.get(id) ?? id;
      const displayName = nameOf(playerId);
      const payload = buildSnipesApiPayload(asSniper, asSniped, nameOf);
      json(res, 200, { playerId, displayName, ...payload });
      return;
    }

    res.writeHead(404).end();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    json(res, 500, { error: "server_error", message: msg });
  }
}

export function startGraphHttpServer(port: number, opts: GraphHttpOpts): http.Server {
  const { db, getGuild } = opts;
  const platformCtx: GraphHttpPlatformContext = {
    db,
    guildDisplayName: async (guildId) => (await getGuild(guildId))?.name ?? "Server",
    resolveDisplayNamesForGuild: async (guildId, userIds) => {
      const guild = await getGuild(guildId);
      return guild && userIds.length > 0 ? resolveDiscordDisplayNames(guild, userIds) : new Map();
    },
    isGuildResolvableForPlayerPanel: async (guildId) => Boolean(await getGuild(guildId)),
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const p = url.pathname;

    if (req.method === "GET" && (p === "/" || p === "/health")) {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ok");
      return;
    }

    await handleGraphSiteRequest(req, res, platformCtx);
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[snipe-graph] HTTP + viewer on 0.0.0.0:${port} (site /graph/)`);
  });

  return server;
}
