/** RFC-4180-style single-line CSV cells (admin export + hall import tooling). */

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

/** Same shape as `GET /api/admin/database.csv` (sections `# TABLE:name` + CSV). */
export function looksLikeAdminDatabaseFlatCsv(text: string): boolean {
  const body = text.replace(/^\ufeff/, "");
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    if (t === "") continue;
    return /^#\s*TABLE:\s*[A-Za-z_][A-Za-z0-9_]*\s*$/i.test(t);
  }
  return false;
}

export type FlatCsvTableSection = { headers: string[]; rows: string[][] };

/** Parse admin full-database flat CSV into table → header + row cells. */
export function parseFlatCsvExportSections(text: string): Map<string, FlatCsvTableSection> {
  const body = text.replace(/^\ufeff/, "");
  const lines = body.split(/\r?\n/);
  const out = new Map<string, FlatCsvTableSection>();
  let i = 0;
  while (i < lines.length) {
    while (i < lines.length && lines[i]!.trim() === "") i++;
    if (i >= lines.length) break;
    const m = /^#\s*TABLE:\s*([A-Za-z_][A-Za-z0-9_]*)\s*$/i.exec(lines[i]!.trim());
    if (!m) {
      i++;
      continue;
    }
    const tableName = m[1]!;
    i++;
    if (i >= lines.length) {
      throw new Error(`export: missing header row after # TABLE:${tableName}`);
    }
    const headers = parseCsvLine(lines[i]!);
    i++;
    const rows: string[][] = [];
    while (i < lines.length) {
      const raw = lines[i]!;
      const t = raw.trim();
      if (t === "") {
        i++;
        continue;
      }
      if (/^#\s*TABLE:/i.test(t)) break;
      rows.push(parseCsvLine(raw));
      i++;
    }
    out.set(tableName, { headers, rows });
  }
  return out;
}
