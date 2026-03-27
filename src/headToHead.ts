import type { DirectedSnipePairCount } from "./db";

/** Shown when there is no head-to-head data (Slack text / Discord embed description). */
export const HEADTOHEAD_EMPTY =
  "_No head-to-head yet—nothing still standing on the ledger, or the field’s still empty._";

type PairAgg = { a: string; b: string; ab: number; ba: number };

function aggregateUnorderedPairs(rows: DirectedSnipePairCount[]): PairAgg[] {
  if (rows.length === 0) return [];

  const directed = new Map<string, number>();
  for (const r of rows) {
    directed.set(`${r.sniperId}|${r.snipedId}`, r.count);
  }

  const ids = new Set<string>();
  for (const r of rows) {
    ids.add(r.sniperId);
    ids.add(r.snipedId);
  }
  const sorted = [...ids].sort();

  const out: PairAgg[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      const ab = directed.get(`${a}|${b}`) ?? 0;
      const ba = directed.get(`${b}|${a}`) ?? 0;
      if (ab === 0 && ba === 0) continue;
      out.push({ a, b, ab, ba });
    }
  }
  return out;
}

export function collectIdsFromDirectedPairs(rows: DirectedSnipePairCount[]): string[] {
  const s = new Set<string>();
  for (const r of rows) {
    s.add(r.sniperId);
    s.add(r.snipedId);
  }
  return [...s];
}

/** Pipes/newlines in names would break markdown tables. */
function escapeTableCell(s: string): string {
  return s.replace(/\|/g, "·").replace(/\n/g, " ").trim() || "—";
}

function pairwiseMarkdownTable(pairs: PairAgg[], nameOf: (id: string) => string): string {
  const header = "| Player A | Player B | A → B | B → A |";
  const sep = "| :--- | :--- | ---: | ---: |";
  const body = pairs.map((p) => {
    const na = escapeTableCell(nameOf(p.a));
    const nb = escapeTableCell(nameOf(p.b));
    return `| ${na} | ${nb} | **${p.ab}** | **${p.ba}** |`;
  });
  return [header, sep, ...body].join("\n");
}

/** Body for Discord embed `setDescription` (title is set on the embed). Returns `null` when there is no data. */
export function formatHeadToHeadDiscordEmbedDescription(
  rows: DirectedSnipePairCount[],
  nameOf: (id: string) => string
): string | null {
  const pairs = aggregateUnorderedPairs(rows);
  if (pairs.length === 0) return null;

  return ["_Snipes still on the books (undone rounds removed)._", "", pairwiseMarkdownTable(pairs, nameOf)].join("\n");
}
