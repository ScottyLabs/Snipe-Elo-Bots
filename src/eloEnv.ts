/** Shared ELO env (Slack + Discord). Load dotenv in each entrypoint before importing modules that use this. */
function parseSnipeCooldownMinutes(): number {
  const raw = process.env.SNIPE_PAIR_COOLDOWN_MINUTES;
  if (raw === undefined || raw.trim() === "") return 15;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 15;
  return Math.max(0, n);
}

export const eloEnv = {
  kFactor: Number(process.env.ELO_K_FACTOR ?? 32),
  initialRating: Number(process.env.INITIAL_RATING ?? 1000),
  /**
   * After a scoring snipe between two players, that unordered pair cannot earn ELO from each other again
   * until this many minutes have passed; other players may still snipe or be sniped by either side.
   * Multi-target snipes in one message still score each pair independently. 0 disables.
   */
  snipePairCooldownMinutes: parseSnipeCooldownMinutes(),
};
