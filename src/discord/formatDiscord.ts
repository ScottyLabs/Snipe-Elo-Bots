import type { PairMatch, PlayerChange } from "../db";

export function formatSigned(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function mention(id: string): string {
  return `<@${id}>`;
}

export function formatPlayerListElo(playerChanges: PlayerChange[]): string {
  const byAfter = [...playerChanges].sort((a, b) => b.afterRating - a.afterRating);
  return byAfter.map((c) => `${mention(c.playerId)}: ${c.afterRating}`).join("\n");
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
      ? `Mission accomplished—after a fashion. A makeup snipe is filed under ${mention(sniperId)}; the records are thorough, you see.`
      : `Target accounted for. ${mention(sniperId)} may take the credit—the rest is bookkeeping.`;

  const matchLines = pairMatches.map((m) => {
    const snipedDelta = m.snipedAfter - m.snipedBefore;
    return `- ${mention(m.snipedId)}: sniper ${formatSigned(m.sniperDelta)}, sniped ${formatSigned(snipedDelta)}.`;
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

export function formatUndoConfirmation(playerChanges: PlayerChange[]): string {
  return [`Consider that last entry revised. Here's where everyone landed:`, "", formatPlayerListElo(playerChanges)].join(
    "\n"
  );
}

export function formatAdjustEloConfirmation(params: {
  playerId: string;
  beforeRating: number;
  afterRating: number;
  delta: number;
}): string {
  const { playerId, beforeRating, afterRating, delta } = params;
  return `${mention(playerId)}: ${beforeRating} → ${afterRating} (${formatSigned(delta)}) — the books are updated. Do try to keep things sporting~`;
}
