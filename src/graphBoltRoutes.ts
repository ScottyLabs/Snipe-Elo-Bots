import type { CustomRoute } from "@slack/bolt";
import type { WebClient } from "@slack/web-api";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { EloDb } from "./db";
import { handleGraphSiteRequest, type GraphHttpPlatformContext } from "./graphHttpServer";
import { resolveSlackDisplayNames } from "./slackDisplayNames";

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
  });

  const runSite = attachGraphHandler(makeCtx, handleGraphSiteRequest);

  return [
    { path: "/api/graph/redeem", method: "POST", handler: runSite },
    { path: "/api/graph/data", method: "GET", handler: runSite },
    { path: "/api/graph/player/:playerId", method: "GET", handler: runSite },
    { path: "/graph{/*filepath}", method: "GET", handler: runSite },
  ];
}
