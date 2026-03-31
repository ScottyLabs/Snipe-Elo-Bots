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
   * After a player takes part in a scoring snipe (any pair), they cannot earn ELO from another snipe
   * until this many minutes have passed (applies to sniper and sniped roles). Multi-target snipes in one
   * message still score each pair. 0 disables.
   */
  snipePairCooldownMinutes: parseSnipeCooldownMinutes(),
};
