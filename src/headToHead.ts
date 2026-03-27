import type { DirectedSnipePairCount } from "./db";

/** Shown when there is no head-to-head data (Slack text / Discord embed description). */
export const HEADTOHEAD_EMPTY =
  "_No head-to-head yet—nothing still standing on the ledger, or the field’s still empty._";

export function collectIdsFromDirectedPairs(rows: DirectedSnipePairCount[]): string[] {
  const s = new Set<string>();
  for (const r of rows) {
    s.add(r.sniperId);
    s.add(r.snipedId);
  }
  return [...s];
}

