import { calendarDateKeyInTimeZone } from "./bounty";
import { bountyEnv } from "./bountyEnv";
import type { EloDb } from "./db";

/** When this meta equals today's `bounty_date` key, automatic midnight/catch-up bounty upserts are skipped. */
export const BOUNTY_MANUAL_DATE_META_KEY = "bounty_targets_manual_date";

export function bountyAutoAnnounceShouldSkip(db: EloDb, guildId: string, dateKey: string): boolean {
  if (!bountyEnv.enabled) return true;
  return db.getMeta(guildId, BOUNTY_MANUAL_DATE_META_KEY) === dateKey;
}

/**
 * Operator-set bounty marks for the current bounty calendar day (same timezone as BOUNTY_TIMEZONE).
 * Caps count at `bountyEnv.topN`. Registers a manual lock so the scheduler won't overwrite today.
 */
export function applyManualBountyTargets(args: {
  db: EloDb;
  guildId: string;
  targetIds: string[];
  nowMs?: number;
}): { dateKey: string; targetIds: string[]; truncated: boolean } {
  if (!bountyEnv.enabled) {
    throw new Error("bounty_disabled");
  }
  const uniq = [...new Set(args.targetIds.filter(Boolean))];
  const truncated = uniq.length > bountyEnv.topN;
  const capped = uniq.slice(0, bountyEnv.topN);
  if (capped.length === 0) {
    throw new Error("no_marks");
  }
  const now = args.nowMs ?? Date.now();
  const dateKey = calendarDateKeyInTimeZone(now, bountyEnv.timezone);
  args.db.ensurePlayers(args.guildId, capped);
  args.db.upsertDailyBountyTargets(args.guildId, dateKey, capped, Date.now());
  args.db.setMeta(args.guildId, BOUNTY_MANUAL_DATE_META_KEY, dateKey);
  return { dateKey, targetIds: capped, truncated };
}
