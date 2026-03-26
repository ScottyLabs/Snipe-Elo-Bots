import type { PairMatch, PlayerChange } from "./db";

export function formatSigned(n: number): string {
  const s = n >= 0 ? `+${n}` : `${n}`;
  return s;
}

export function formatPlayerListElo(playerChanges: PlayerChange[]): string {
  const byAfter = [...playerChanges].sort((a, b) => b.afterRating - a.afterRating);
  return byAfter.map((c) => `<@${c.playerId}>: ${c.afterRating}`).join("\n");
}

export function formatSnipeConfirmation(params: {
  sniperId: string;
  pairMatches: PairMatch[];
  playerChanges: PlayerChange[];
  kind: "snipe" | "makeup";
}): string {
  const { sniperId, pairMatches, playerChanges, kind } = params;
  const header =
    kind === "makeup"
      ? `Mission accomplished. A makeup snipe is filed under <@${sniperId}>; the records are thorough, you see.`
      : `Target accounted for. <@${sniperId}> may take the credit—the rest is bookkeeping.`;

  const matchLines = pairMatches.map((m) => {
    const snipedDelta = m.snipedAfter - m.snipedBefore;
    const sniperDelta = m.sniperAfter - m.sniperBefore;
    return `- <@${m.sniperId}>: ${formatSigned(sniperDelta)}\n  <@${m.snipedId}>: ${formatSigned(snipedDelta)}`;
  });

  return [
    header,
    "",
    "Exchange of fire:",
    ...matchLines,
    "",
    "Standings—for the moment:",
    formatPlayerListElo(playerChanges),
  ].join("\n");
}

export function formatUndoConfirmation(params: {
  undoingSnipeId: string;
  playerChanges: PlayerChange[];
  kind: "undo";
}): string {
  const { playerChanges } = params;
  return [
    `Consider that last entry revised. Here's where everyone landed:`,
    "",
    formatPlayerListElo(playerChanges),
  ].join("\n");
}

export function formatAdjustEloConfirmation(params: {
  playerId: string;
  beforeRating: number;
  afterRating: number;
  delta: number;
}): string {
  const { playerId, beforeRating, afterRating, delta } = params;
  return `<@${playerId}>: ${beforeRating} → ${afterRating} (${formatSigned(delta)}) — the books are updated. Do try to keep things sporting~`;
}
