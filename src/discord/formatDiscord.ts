import type { PairMatch, PlayerChange } from "../db";
import * as L from "../voiceLemuen";

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
  bountyFirstPairIndices?: number[];
}): string {
  const { sniperId, pairMatches, playerChanges, kind, bountyFirstPairIndices } = params;
  const bountySet = new Set(bountyFirstPairIndices ?? []);
  const header =
    kind === "makeup"
      ? `Mission accomplished—after a fashion. A makeup snipe is filed under ${mention(sniperId)}; the records are thorough, you see.`
      : `Target accounted for. ${mention(sniperId)} may take the credit—the rest is bookkeeping.`;

  const matchLines = pairMatches.map((m) => {
    const snipedDelta = m.snipedAfter - m.snipedBefore;
    return `- ${mention(m.snipedId)}: sniper ${formatSigned(m.sniperDelta)}, sniped ${formatSigned(snipedDelta)}`;
  });

  const bountyRows = pairMatches.filter((m) => bountySet.has(m.pairIdx));
  const parts: string[] = [header, "", "Exchange of fire:", ...matchLines];
  if (bountyRows.length > 0) {
    parts.push(
      "",
      L.snipeConfirmationBountySectionTitleDiscord(bountyRows.length === 1),
      ...bountyRows.map((m) => `- ${mention(m.sniperId)} vs ${mention(m.snipedId)}`)
    );
  }
  parts.push("", "Standings—for the moment:", formatPlayerListElo(playerChanges));
  return parts.join("\n");
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
