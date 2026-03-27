import type { SnipeEventRow, SnipeReceivedRow } from "./db";

export const SNIPES_LOG_LIMIT = 5;

export function parseSnipedIdsFromEvent(row: SnipeEventRow): string[] {
  if (!row.snipedIdsJson) return [];
  try {
    const arr = JSON.parse(row.snipedIdsJson) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function formatSnipeHistoryTimestamp(createdAt: number): string {
  return new Date(createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function linesAsSniperDiscord(rows: SnipeEventRow[], nameOf: (id: string) => string): string[] {
  if (rows.length === 0) return ["_No snipes on record._"];
  return rows.map((row) => {
    const date = formatSnipeHistoryTimestamp(row.createdAt);
    const ids = parseSnipedIdsFromEvent(row);
    const snipedPart = ids.map((id) => nameOf(id)).join(", ") || "—";
    const kind = row.type === "makeup" ? "makeup" : "snipe";
    const undone = row.undoneAt != null ? " _(undone)_" : "";
    return `• ${date} — ${kind} · sniped ${snipedPart}${undone}`;
  });
}

function linesAsSnipedDiscord(rows: SnipeReceivedRow[], nameOf: (id: string) => string): string[] {
  if (rows.length === 0) return ["_No times on record._"];
  return rows.map((row) => {
    const date = formatSnipeHistoryTimestamp(row.createdAt);
    const kind = row.type === "makeup" ? "makeup" : "snipe";
    const undone = row.undoneAt != null ? " _(undone)_" : "";
    return `• ${date} — ${kind} · sniped by ${nameOf(row.sniperId)}${undone}`;
  });
}

function linesAsSniperSlack(rows: SnipeEventRow[], nameOf: (id: string) => string): string[] {
  if (rows.length === 0) return ["_No snipes on record._"];
  return rows.map((row) => {
    const date = formatSnipeHistoryTimestamp(row.createdAt);
    const ids = parseSnipedIdsFromEvent(row);
    const snipedPart = ids.map((id) => nameOf(id)).join(", ") || "—";
    const kind = row.type === "makeup" ? "makeup" : "snipe";
    const undone = row.undoneAt != null ? " _(undone)_" : "";
    return `• ${date} — ${kind} · sniped ${snipedPart}${undone}`;
  });
}

function linesAsSnipedSlack(rows: SnipeReceivedRow[], nameOf: (id: string) => string): string[] {
  if (rows.length === 0) return ["_No times on record._"];
  return rows.map((row) => {
    const date = formatSnipeHistoryTimestamp(row.createdAt);
    const kind = row.type === "makeup" ? "makeup" : "snipe";
    const undone = row.undoneAt != null ? " _(undone)_" : "";
    return `• ${date} — ${kind} · sniped by ${nameOf(row.sniperId)}${undone}`;
  });
}

export function collectIdsForSnipeLog(
  targetId: string,
  asSniper: SnipeEventRow[],
  asSniped: SnipeReceivedRow[]
): string[] {
  const s = new Set<string>([targetId]);
  for (const row of asSniper) {
    if (row.sniperId) s.add(row.sniperId);
    for (const id of parseSnipedIdsFromEvent(row)) s.add(id);
  }
  for (const row of asSniped) {
    s.add(row.sniperId);
    s.add(row.snipedId);
  }
  return [...s];
}

export function formatDiscordSnipesList(
  asSniper: SnipeEventRow[],
  asSniped: SnipeReceivedRow[],
  subjectDisplayName: string,
  nameOf: (id: string) => string
): string {
  const lines: string[] = [
    `**Snipes for ${subjectDisplayName}**`,
    "",
    "**As sniper** _(last 5)_",
    "",
    ...linesAsSniperDiscord(asSniper, nameOf),
    "",
    "**Sniped by** _(last 5)_",
    "",
    ...linesAsSnipedDiscord(asSniped, nameOf),
  ];
  return lines.join("\n");
}

export function formatSlackSnipesList(
  asSniper: SnipeEventRow[],
  asSniped: SnipeReceivedRow[],
  subjectDisplayName: string,
  nameOf: (id: string) => string
): string {
  const lines: string[] = [
    `*Snipes for ${subjectDisplayName}*`,
    "",
    "*As sniper* _(last 5)_",
    "",
    ...linesAsSniperSlack(asSniper, nameOf),
    "",
    "*Sniped by* _(last 5)_",
    "",
    ...linesAsSnipedSlack(asSniped, nameOf),
  ];
  return lines.join("\n");
}
