/** Shared ELO env (Slack + Discord). Load dotenv in each entrypoint before importing modules that use this. */
export const eloEnv = {
  kFactor: Number(process.env.ELO_K_FACTOR ?? 32),
  initialRating: Number(process.env.INITIAL_RATING ?? 1000),
  /**
   * After a snipe that moves ELO between A and B, further snipes involving both players within this window
   * get no ELO (and no bounty claim on that pair). 0 disables.
   */
  snipePairCooldownMinutes: Math.max(0, Number(process.env.SNIPE_PAIR_COOLDOWN_MINUTES ?? 15)),
};
