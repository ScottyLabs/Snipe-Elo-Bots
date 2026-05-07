import type { CustomRoute } from "@slack/bolt";
import type { WebClient } from "@slack/web-api";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { EloDb } from "./db";
import { handleAdminCsvExportRequest } from "./adminCsvExport";
import { handleAdminDatabaseMutationRequests } from "./adminDatabaseMutationsHttp";
import { handleHallOfFameRequest } from "./hallOfFameHttp";
import { handleGraphSiteRequest, type GraphHttpPlatformContext } from "./graphHttpServer";
import { filterSlackGraphHumanPlayerIds, resolveSlackDisplayNames } from "./slackDisplayNames";

/** Cached from `auth.test` so we exclude this Slack app’s bot user from the graph. */
let slackGraphBotUserId: string | null | undefined;

async function slackBotOwnUserId(client: WebClient): Promise<string | null> {
  if (slackGraphBotUserId !== undefined) return slackGraphBotUserId;
  try {
    const r = (await client.auth.test({})) as { user_id?: string };
    slackGraphBotUserId = r.user_id?.trim() || null;
  } catch {
    slackGraphBotUserId = null;
  }
  return slackGraphBotUserId;
}

function safeEndJsonError(res: ServerResponse, status: number, body: unknown): void {
  if (res.writableEnded) return;
  const s = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(s),
    "Cache-Control": "no-store",
  });
  res.end(s);
}

function attachGraphHandler(
  ctx: () => GraphHttpPlatformContext,
  handler: (req: IncomingMessage, res: ServerResponse, c: GraphHttpPlatformContext) => Promise<void>
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    void (async () => {
      try {
        await handler(req, res, ctx());
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!res.writableEnded) {
          safeEndJsonError(res, 500, { error: "server_error", message: msg });
        }
      }
    })();
  };
}

/**
 * Serves the snipe graph SPA and `/api/graph/*` on the same port as Bolt (HTTP or Socket Mode auxiliary server).
 */
export function slackGraphBoltCustomRoutes(args: {
  db: EloDb;
  getClient: () => WebClient;
}): CustomRoute[] {
  const makeCtx = (): GraphHttpPlatformContext => ({
    db: args.db,
    guildDisplayName: async () => {
      try {
        const t = (await args.getClient().team.info()) as { team?: { name?: string } };
        const n = t.team?.name;
        return (typeof n === "string" && n.trim()) || "Slack workspace";
      } catch {
        return "Slack workspace";
      }
    },
    resolveDisplayNamesForGuild: async (_guildId, userIds) =>
      resolveSlackDisplayNames(args.getClient(), userIds),
    isGuildResolvableForPlayerPanel: async () => true,
    filterGraphHumanPlayerIds: async (_guildId, userIds) =>
      filterSlackGraphHumanPlayerIds(args.getClient(), userIds),
    getGraphExcludedSelfPlayerIds: async () => {
      const id = await slackBotOwnUserId(args.getClient());
      return id ? new Set([id]) : new Set();
    },
  });

  const runAdminHallGraph = attachGraphHandler(makeCtx, async (req, res, c) => {
    if (await handleAdminDatabaseMutationRequests(req, res, c.db)) return;
    if (await handleAdminCsvExportRequest(req, res, c.db)) return;
    const handled = await handleHallOfFameRequest(req, res, {
      ...c,
      /* Slack graph has no Discord guild — archive-from-API is Discord-only; viewing cycles still works. */
      getGuild: async () => null,
    });
    if (handled) return;
    await handleGraphSiteRequest(req, res, c);
  });

  return [
    { path: "/api/admin/reset-season", method: "POST", handler: runAdminHallGraph },
    { path: "/api/admin/database-import", method: "POST", handler: runAdminHallGraph },
    { path: "/api/admin/database.csv", method: "GET", handler: runAdminHallGraph },
    { path: "/api/graph/redeem", method: "POST", handler: runAdminHallGraph },
    { path: "/api/graph/data", method: "GET", handler: runAdminHallGraph },
    { path: "/api/graph/player/:playerId", method: "GET", handler: runAdminHallGraph },
    { path: "/api/hof/cycles/:cycleId", method: "GET", handler: runAdminHallGraph },
    { path: "/api/hof/cycles", method: "GET", handler: runAdminHallGraph },
    { path: "/api/hof/archive", method: "POST", handler: runAdminHallGraph },
    { path: "/hof", method: "GET", handler: runAdminHallGraph },
    { path: "/hof{/*filepath}", method: "GET", handler: runAdminHallGraph },
    { path: "/graph{/*filepath}", method: "GET", handler: runAdminHallGraph },
  ];
}
