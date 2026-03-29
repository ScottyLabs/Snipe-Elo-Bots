/** Daily bounty marks (top-N on the board): first time each mark is *sniped* that calendar day, that pair’s ELO transfer is 2×. Marks who *snipe* others get normal ELO. */
export const bountyEnv = {
  enabled: !["0", "false", "no", "off"].includes((process.env.BOUNTY_ENABLED ?? "true").toLowerCase()),
  /** IANA zone. Midnight and calendar boundaries use this (default Eastern). */
  timezone: (process.env.BOUNTY_TIMEZONE ?? "America/New_York").trim() || "America/New_York",
  /** How many top players are marked as bounty targets each day (default 3). */
  topN: Math.min(20, Math.max(1, Number(process.env.BOUNTY_TOP_N ?? 3))),
};
