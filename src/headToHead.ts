import type { DirectedSnipePairCount } from "./db";

const EMPTY =
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

export function formatHeadToHeadDiscord(rows: DirectedSnipePairCount[], nameOf: (id: string) => string): string {
  const pairs = aggregateUnorderedPairs(rows);
  if (pairs.length === 0) return EMPTY;

  const lines = pairs.map(
    (p) =>
      `• ${nameOf(p.a)} → ${nameOf(p.b)}: **${p.ab}**× · ${nameOf(p.b)} → ${nameOf(p.a)}: **${p.ba}**×`
  );
  return [
    "**Head-to-head**",
    "_Snipes still on the books (undone rounds removed)._",
    "",
    ...lines,
  ].join("\n");
}

export function formatHeadToHeadSlack(rows: DirectedSnipePairCount[], nameOf: (id: string) => string): string {
  const pairs = aggregateUnorderedPairs(rows);
  if (pairs.length === 0) return EMPTY;

  const lines = pairs.map(
    (p) =>
      `• ${nameOf(p.a)} → ${nameOf(p.b)}: *${p.ab}*× · ${nameOf(p.b)} → ${nameOf(p.a)}: *${p.ba}*×`
  );
  return [
    "*Head-to-head*",
    "_Snipes still on the books (undone rounds removed)._",
    "",
    ...lines,
  ].join("\n");
}
