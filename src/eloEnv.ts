/** Shared ELO env (Slack + Discord). Load dotenv in each entrypoint before importing modules that use this. */
export const eloEnv = {
  kFactor: Number(process.env.ELO_K_FACTOR ?? 32),
  initialRating: Number(process.env.INITIAL_RATING ?? 1000),
};
