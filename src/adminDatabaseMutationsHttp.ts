import type http from "http";
import type { EloDb } from "./db";
import { resolveAdminCsvExportToken } from "./adminCsvExport";
import { opsLog } from "./opsLog";

const MAX_IMPORT_BYTES = 35 * 1024 * 1024;

function bearerToken(req: http.IncomingMessage): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
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

function readBody(req: http.IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (c) => {
      total += c.length;
      if (total > maxBytes) {
        reject(new Error("body_too_large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * POST `/api/admin/reset-season` — wipe scoring + reset all ratings; keep kv, hall, polls.
 * POST `/api/admin/database-import` — body = raw flat export CSV; full replace (dangerous).
 * Same bearer as CSV export (`ADMIN_CSV_EXPORT_TOKEN` or `HALL_OF_FAME_ARCHIVE_TOKEN`).
 */
export async function handleAdminDatabaseMutationRequests(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  db: EloDb
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const p = url.pathname;

  if (req.method !== "POST" || (p !== "/api/admin/reset-season" && p !== "/api/admin/database-import")) {
    return false;
  }

  const expected = resolveAdminCsvExportToken();
  if (!expected) {
    json(res, 503, { error: "admin_mutations_not_configured" });
    return true;
  }
  if (bearerToken(req) !== expected) {
    json(res, 401, { error: "unauthorized" });
    return true;
  }

  try {
    if (p === "/api/admin/reset-season") {
      try {
        await readBody(req, 64_000);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "body_too_large") {
          json(res, 413, { error: "body_too_large" });
          return true;
        }
        throw e;
      }
      db.adminResetSeasonPreserveMeta();
      json(res, 200, { ok: true, action: "reset_season" });
      return true;
    }

    const cl = req.headers["content-length"];
    if (cl && Number(cl) > MAX_IMPORT_BYTES) {
      json(res, 413, { error: "body_too_large" });
      return true;
    }
    const raw = await readBody(req, MAX_IMPORT_BYTES);
    db.adminReplaceDatabaseFromFlatExportCsv(raw);
    json(res, 200, { ok: true, action: "database_import" });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    opsLog("admin.mutation_failed", { path: p, message: msg });
    json(res, 400, { error: "mutation_failed", message: msg });
    return true;
  }
}
