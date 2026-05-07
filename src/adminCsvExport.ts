import type http from "http";
import type { EloDb } from "./db";
import { opsLog } from "./opsLog";

function bearerToken(req: http.IncomingMessage): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

function jsonError(res: http.ServerResponse, status: number, body: Record<string, unknown>): void {
  const s = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(s),
    "Cache-Control": "no-store",
  });
  res.end(s);
}

/** Prefer `ADMIN_CSV_EXPORT_TOKEN`; otherwise reuse `HALL_OF_FAME_ARCHIVE_TOKEN` so one secret can cover admin tools. */
export function resolveAdminCsvExportToken(): string {
  return (
    process.env.ADMIN_CSV_EXPORT_TOKEN?.trim() || process.env.HALL_OF_FAME_ARCHIVE_TOKEN?.trim() || ""
  );
}

/**
 * GET `/api/admin/database.csv` — full SQLite export as one CSV (section per table).
 * `Authorization: Bearer <ADMIN_CSV_EXPORT_TOKEN>` or the same bearer as `HALL_OF_FAME_ARCHIVE_TOKEN` if the CSV-specific var is unset.
 */
export async function handleAdminCsvExportRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  db: EloDb
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method !== "GET" || url.pathname !== "/api/admin/database.csv") {
    return false;
  }

  const expected = resolveAdminCsvExportToken();
  if (!expected) {
    jsonError(res, 503, { error: "export_not_configured" });
    return true;
  }

  const got = bearerToken(req);
  if (!got || got !== expected) {
    jsonError(res, 401, { error: "unauthorized" });
    return true;
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `snipe-elo-database-${ts}.csv`;

  try {
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    });
    res.write("\ufeff");
    db.writeAdminDatabaseFlatCsv((chunk) => {
      res.write(chunk);
    });
    res.end();
    opsLog("admin.database_csv_export", {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      jsonError(res, 500, { error: "export_failed", message: msg });
    } else {
      res.destroy();
    }
    opsLog("admin.database_csv_export_failed", { message: msg });
  }
  return true;
}
