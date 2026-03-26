import type { PairMatch, PlayerChange } from "./db";

export function formatSigned(n: number): string {
  const s = n >= 0 ? `+${n}` : `${n}`;
  return s;
}

export function formatPlayerListElo(playerChanges: PlayerChange[]): string {
  // Stable order: show higher ELO first for readability.
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
      ? `Snipe recorded (makeup) by <@${sniperId}>`
      : `Snipe recorded by <@${sniperId}>`;

  const matchLines = pairMatches.map((m) => {
    const snipedDelta = m.snipedAfter - m.snipedBefore;
    const sniperDelta = m.sniperAfter - m.sniperBefore;
    return `- <@${m.sniperId}>: ${formatSigned(sniperDelta)}\n  <@${m.snipedId}>: ${formatSigned(snipedDelta)}`;
  });

  return [
    header,
    "",
    "Changes:",
    ...matchLines,
    "",
    "Current ELOs:",
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
    `Snipe undone.`,
    "",
    "ELOs after undo:",
    formatPlayerListElo(playerChanges),
  ].join("\n");
}

