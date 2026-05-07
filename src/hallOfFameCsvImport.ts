import type { EloDb, HallOfFameSnapshotRow } from "./db";
import {
  parseCsvLine,
  parseFlatCsvExportSections,
  type FlatCsvTableSection,
} from "./flatCsvExportParse";

export { parseCsvLine, parseFlatCsvExportSections, looksLikeAdminDatabaseFlatCsv } from "./flatCsvExportParse";
export type { FlatCsvTableSection } from "./flatCsvExportParse";

export type ParsedHallOfFameImport = {
  guildId: string;
  title: string;
  subtitle: string | null;
  closedAt: number;
  rewardsText: string | null;
  snapshot: HallOfFameSnapshotRow[];
};

export const HALL_OF_FAME_IMPORT_SENTINEL = "# hall_of_fame_import v1";
const HEADER_SENTINEL = HALL_OF_FAME_IMPORT_SENTINEL;
const STANDINGS_SENTINEL = "# standings";

export function looksLikeHallOfFameImportCsv(text: string): boolean {
  const body = text.replace(/^\ufeff/, "");
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    if (t === "") continue;
    return t.toLowerCase() === HEADER_SENTINEL.toLowerCase();
  }
  return false;
}

function isValidGuildIdForImport(s: string): boolean {
  const t = s.trim();
  if (t === "__slack__") return true;
  return /^\d{17,20}$/.test(t);
}

function isValidPlayerIdForImport(s: string): boolean {
  const t = s.trim();
  return t.length > 0 && !/[\r\n,]/.test(t);
}

/** Build one or more hall cycles from `players` rows in an admin export (one cycle per distinct guild_id). */
export function buildHallImportsFromAdminExportSections(
  sections: Map<string, FlatCsvTableSection>,
  fileBaseName: string
): ParsedHallOfFameImport[] {
  const sec = sections.get("players");
  if (!sec) {
    throw new Error("Admin export has no # TABLE:players section (cannot build hall snapshot)");
  }
  const { headers, rows } = sec;
  const norm = (h: string) => h.trim().toLowerCase();
  const idx = (name: string) => headers.findIndex((h) => norm(h) === name);
  const gi = idx("guild_id");
  const pi = idx("player_id");
  const ri = idx("rating");
  const ui = idx("updated_at");
  if (gi < 0 || pi < 0 || ri < 0) {
    throw new Error("players section must include guild_id, player_id, and rating columns");
  }

  type Row = { guildId: string; playerId: string; rating: number; updatedAt: number };
  const parsed: Row[] = [];
  for (const cells of rows) {
    const need = Math.max(gi, pi, ri, ui >= 0 ? ui : -1) + 1;
    if (cells.length < need) continue;
    const guildId = (cells[gi] ?? "").trim();
    const playerId = (cells[pi] ?? "").trim();
    if (!isValidGuildIdForImport(guildId) || !isValidPlayerIdForImport(playerId)) continue;
    const rating = parseInt(String(cells[ri]), 10);
    if (!Number.isFinite(rating)) continue;
    const updatedAt =
      ui >= 0 ? parseInt(String(cells[ui] ?? "0"), 10) : 0;
    parsed.push({
      guildId,
      playerId,
      rating,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
    });
  }
  if (parsed.length === 0) {
    throw new Error("players section had no valid rows (check guild_id / player_id / rating)");
  }

  const byGuild = new Map<string, Row[]>();
  for (const r of parsed) {
    if (!byGuild.has(r.guildId)) byGuild.set(r.guildId, []);
    byGuild.get(r.guildId)!.push(r);
  }

  for (const [gid, list] of byGuild) {
    const best = new Map<string, Row>();
    for (const r of list) {
      const prev = best.get(r.playerId);
      if (!prev || r.rating > prev.rating || (r.rating === prev.rating && r.updatedAt > prev.updatedAt)) {
        best.set(r.playerId, r);
      }
    }
    byGuild.set(gid, [...best.values()]);
  }

  const baseTitle = fileBaseName.trim() || "Hall import";
  const imports: ParsedHallOfFameImport[] = [];
  const multi = byGuild.size > 1;

  for (const [guildId, list] of byGuild) {
    list.sort((a, b) =>
      b.rating !== a.rating ? b.rating - a.rating : a.playerId.localeCompare(b.playerId)
    );
    const maxUp = list.reduce((m, r) => Math.max(m, r.updatedAt), 0);
    const closedAt = maxUp > 0 ? maxUp : Date.now();
    const snapshot: HallOfFameSnapshotRow[] = list.map((r, idx) => ({
      rank: idx + 1,
      playerId: r.playerId,
      displayName: r.playerId,
      rating: r.rating,
    }));
    imports.push({
      guildId,
      title: multi ? `${baseTitle} — ${guildId}` : baseTitle,
      subtitle: `Discord guild ${guildId}`,
      closedAt,
      rewardsText: null,
      snapshot,
    });
  }
  return imports;
}

function parseClosedAt(raw: string): number {
  const t = raw.trim();
  if (!t) return Date.now();
  if (/^\d+$/.test(t)) {
    const n = parseInt(t, 10);
    return Number.isFinite(n) ? n : Date.now();
  }
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : Date.now();
}


/**
 * Hand-import format (see hall-of-fame-inbox/FORMAT.txt): meta key/value lines, then `# standings`,
 * then CSV with header rank,player_id,display_name,rating
 */
export function parseHallOfFameImportCsv(text: string): ParsedHallOfFameImport {
  const body = text.replace(/^\ufeff/, "");
  const lines = body.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i]!.trim() === "") i++;
  if (i >= lines.length || lines[i]!.trim().toLowerCase() !== HEADER_SENTINEL) {
    throw new Error(`Missing first line exactly: ${HEADER_SENTINEL}`);
  }
  i++;
  const meta = new Map<string, string>();
  while (i < lines.length) {
    const raw = lines[i]!;
    const trimmed = raw.trim();
    if (trimmed.toLowerCase() === STANDINGS_SENTINEL) {
      i++;
      break;
    }
    if (trimmed === "" || trimmed.startsWith("#")) {
      i++;
      continue;
    }
    const cells = parseCsvLine(raw);
    if (cells.length < 2) throw new Error(`Bad meta line ${i + 1}: expected key,value`);
    const key = cells[0]!.trim().toLowerCase();
    const value = cells.slice(1).join(",").trim();
    meta.set(key, value);
    i++;
  }
  const guildId = meta.get("guild_id")?.trim() ?? "";
  const title = meta.get("title")?.trim() ?? "";
  if (!isValidGuildIdForImport(guildId)) throw new Error("meta guild_id must be a Discord snowflake or __slack__");
  if (!title) throw new Error("meta title is required");
  const subtitleRaw = meta.get("subtitle")?.trim();
  const subtitle = subtitleRaw ? subtitleRaw : null;
  const closedAt = parseClosedAt(meta.get("closed_at") ?? "");
  const rewardsRaw = meta.get("rewards_text");
  const rewardsText =
    rewardsRaw != null && String(rewardsRaw).trim() !== ""
      ? String(rewardsRaw).replace(/\\n/g, "\n")
      : null;

  if (i >= lines.length) throw new Error("Missing standings table after # standings");
  const headerLine = lines[i]!;
  const header = parseCsvLine(headerLine).map((h) => h.trim().toLowerCase());
  i++;
  const idxRank = header.indexOf("rank");
  const idxPid = header.indexOf("player_id");
  const idxName = header.indexOf("display_name");
  const idxRating = header.indexOf("rating");
  if (idxRank < 0 || idxPid < 0 || idxName < 0 || idxRating < 0) {
    throw new Error("standings header must include rank,player_id,display_name,rating");
  }

  const snapshot: HallOfFameSnapshotRow[] = [];
  let rowNum = i;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === "") {
      i++;
      continue;
    }
    const cells = parseCsvLine(line);
    const need = Math.max(idxRank, idxPid, idxName, idxRating) + 1;
    if (cells.length < need) throw new Error(`standings row ${rowNum + 1}: not enough columns`);
    const rank = parseInt(String(cells[idxRank]), 10);
    const playerId = String(cells[idxPid] ?? "").trim();
    const displayName = String(cells[idxName] ?? "").trim() || playerId;
    const rating = parseInt(String(cells[idxRating]), 10);
    if (!Number.isFinite(rank) || !Number.isFinite(rating) || !playerId) {
      throw new Error(`standings row ${rowNum + 1}: bad rank, player_id, or rating`);
    }
    snapshot.push({ rank, playerId, displayName, rating });
    i++;
    rowNum++;
  }
  if (snapshot.length === 0) throw new Error("standings: no data rows");
  return { guildId, title, subtitle, closedAt, rewardsText, snapshot };
}

export function insertParsedHallOfFame(db: EloDb, p: ParsedHallOfFameImport): { cycleId: string } {
  return db.insertHallOfFameCycle({
    guildId: p.guildId,
    title: p.title,
    subtitle: p.subtitle,
    closedAt: p.closedAt,
    rewardsText: p.rewardsText,
    snapshot: p.snapshot,
  });
}
