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
      ? `Snipe recorded (makeup) by ${mention(sniperId)}`
      : `Snipe recorded by ${mention(sniperId)}`;

  const matchLines = pairMatches.map((m) => {
    const snipedDelta = m.snipedAfter - m.snipedBefore;
    return `- ${mention(m.snipedId)}: sniper ${formatSigned(m.sniperDelta)}, sniped ${formatSigned(snipedDelta)}.`;
  });

  return [header, "", "Changes:", ...matchLines, "", "Current ELOs:", formatPlayerListElo(playerChanges)].join("\n");
}

export function formatUndoConfirmation(playerChanges: PlayerChange[]): string {
  return [`Snipe undone.`, "", "ELOs after undo:", formatPlayerListElo(playerChanges)].join("\n");
}
