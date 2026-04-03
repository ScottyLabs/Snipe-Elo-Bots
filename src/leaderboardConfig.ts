/**
 * `LEADERBOARD_TOP_N`: max humans on the leaderboard after skipping bots.
 * Omit, empty, `0`, negative, or non-numeric → no cap (every human on the ledger).
 */
export function parseLeaderboardTopN(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/** Effective cap for loops: finite positive N, or +∞ when uncapped. */
export function leaderboardHumanCap(maxHumans: number): number {
  return maxHumans > 0 && Number.isFinite(maxHumans) ? maxHumans : Number.POSITIVE_INFINITY;
}
