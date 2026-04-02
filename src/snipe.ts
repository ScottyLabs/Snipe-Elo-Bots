import type { PairMatch, PlayerChange } from "./db";
import { isExusiaiVoiceActive, L } from "./voice";

/**
 * Exusiai voice: show snipe confirmations with gains/losses mirrored, while `applySnipe` stores real ELO.
 * Cooldown rows (zero transfer) pass through unchanged.
 */
export function mirrorExusiaiAprilFoolsSnipeDisplay(
  pairMatches: PairMatch[],
  playerChanges: PlayerChange[]
): { pairMatches: PairMatch[]; playerChanges: PlayerChange[] } {
  if (!isExusiaiVoiceActive()) {
    return { pairMatches, playerChanges };
  }
  const mirroredPairs = pairMatches.map((m) => {
    if (m.pairCooldownSkip) {
      return m;
    }
    const sniperDa = m.sniperAfter - m.sniperBefore;
    const snipedDa = m.snipedAfter - m.snipedBefore;
    return {
      ...m,
      sniperAfter: m.sniperBefore - sniperDa,
      snipedAfter: m.snipedBefore - snipedDa,
      sniperDelta: -m.sniperDelta,
    };
  });
  const mirroredChanges = playerChanges.map((c) => ({
    ...c,
    afterRating: c.beforeRating - c.delta,
    delta: -c.delta,
  }));
  return { pairMatches: mirroredPairs, playerChanges: mirroredChanges };
}

export function formatSigned(n: number): string {
  const s = n >= 0 ? `+${n}` : `${n}`;
  return s;
}

/** IDs to resolve for display names on snipe confirmations. */
export function collectIdsForSnipeConfirmation(
  sniperId: string,
  pairMatches: PairMatch[],
  playerChanges: PlayerChange[]
): string[] {
  const s = new Set<string>();
  s.add(sniperId);
  for (const m of pairMatches) {
    s.add(m.sniperId);
    s.add(m.snipedId);
  }
  for (const c of playerChanges) s.add(c.playerId);
  return [...s];
}

export function formatPlayerListElo(playerChanges: PlayerChange[], nameOf: (id: string) => string): string {
  const byAfter = [...playerChanges].sort((a, b) => b.afterRating - a.afterRating);
  return byAfter.map((c) => `${nameOf(c.playerId)}: ${c.afterRating}`).join("\n");
}

export function formatSnipeConfirmation(params: {
  sniperId: string;
  pairMatches: PairMatch[];
  playerChanges: PlayerChange[];
  kind: "snipe" | "makeup";
  nameOf: (id: string) => string;
  /** Extra block (e.g. live duel score), appended after standings. */
  duelAppend?: string;
  /** Pair indices where the *sniped* player was a bounty mark (first snipe on them that day → 2× ELO for that pair). */
  bountyFirstPairIndices?: number[];
  /** Discord: bold the bounty heading only (message content markdown). */
  discordBountyHeading?: boolean;
}): string {
  const {
    sniperId,
    pairMatches,
    playerChanges,
    kind,
    nameOf,
    duelAppend,
    bountyFirstPairIndices,
    discordBountyHeading,
  } = params;
  const bountySet = new Set(bountyFirstPairIndices ?? []);
  const cooldownRows = pairMatches.filter((m) => m.pairCooldownSkip);
  const header = L.snipeConfirmationHeader({
    kind,
    sniperLabel: nameOf(sniperId),
  });

  const matchLines = pairMatches.map((m) => {
    const snipedDelta = m.snipedAfter - m.snipedBefore;
    const sniperDelta = m.sniperAfter - m.sniperBefore;
    return `- ${nameOf(m.sniperId)}: ${formatSigned(sniperDelta)}\n  ${nameOf(m.snipedId)}: ${formatSigned(snipedDelta)}`;
  });

  const bountyRows = pairMatches.filter((m) => bountySet.has(m.pairIdx));

  const lines: string[] = [header, "", "Exchange of fire:", ...matchLines];
  if (bountyRows.length > 0) {
    const bountyTitle = discordBountyHeading
      ? L.snipeConfirmationBountySectionTitleDiscord(bountyRows.length === 1)
      : L.snipeConfirmationBountySectionTitle(bountyRows.length === 1);
    const plat = discordBountyHeading ? "discord" : "slack";
    const detail = L.snipeConfirmationBountyExchangeDetail(plat);
    lines.push(
      "",
      bountyTitle,
      ...bountyRows.map(
        (m) => `- ${nameOf(m.sniperId)} vs ${nameOf(m.snipedId)}${detail}`
      )
    );
  }
  if (cooldownRows.length > 0) {
    const cdTitle = discordBountyHeading
      ? L.snipeConfirmationPairCooldownSectionTitleDiscord(cooldownRows.length === 1)
      : L.snipeConfirmationPairCooldownSectionTitle(cooldownRows.length === 1);
    const plat = discordBountyHeading ? "discord" : "slack";
    const cdDetail = L.snipeConfirmationPairCooldownExchangeDetail(plat);
    lines.push(
      "",
      cdTitle,
      ...cooldownRows.map((m) => `- ${nameOf(m.sniperId)} vs ${nameOf(m.snipedId)}${cdDetail}`)
    );
  }
  lines.push("", L.snipeConfirmationStandingsHeading(), formatPlayerListElo(playerChanges, nameOf));
  if (duelAppend?.trim()) {
    lines.push("", duelAppend.trim());
  }
  if (isExusiaiVoiceActive()) {
    const plat = discordBountyHeading ? "discord" : "slack";
    const note = L.snipeConfirmationAprilFoolsMirrorDisclaimer(plat);
    if (note) lines.push("", note);
  }
  return lines.join("\n");
}

export function formatUndoConfirmation(params: {
  undoingSnipeId: string;
  playerChanges: PlayerChange[];
  kind: "undo";
  nameOf: (id: string) => string;
}): string {
  const { playerChanges, nameOf } = params;
  return [
    `Consider that last entry revised. Here's where everyone landed:`,
    "",
    formatPlayerListElo(playerChanges, nameOf),
  ].join("\n");
}

export function formatAdjustEloConfirmation(params: {
  playerId: string;
  beforeRating: number;
  afterRating: number;
  delta: number;
  nameOf: (id: string) => string;
}): string {
  const { playerId, beforeRating, afterRating, delta, nameOf } = params;
  return `${nameOf(playerId)}: ${beforeRating} → ${afterRating} (${formatSigned(delta)}) — the books are updated. Do try to keep things sporting~`;
}
