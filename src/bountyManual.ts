import { calendarDateKeyInTimeZone, previousCalendarDateKey } from "./bounty";
import { bountyEnv } from "./bountyEnv";
import type { EloDb } from "./db";

/** When this meta equals today's `bounty_date` key, automatic midnight/catch-up bounty upserts are skipped. */
export const BOUNTY_MANUAL_DATE_META_KEY = "bounty_targets_manual_date";

export function bountyTargetIdsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * True when automatic daily bounty announcement would repeat the same mark list:
 * today's stored row matches, or (on first store for the day) yesterday's list matches.
 */
export function bountyAutoAnnounceTargetsUnchanged(
  db: EloDb,
  guildId: string,
  dateKey: string,
  computedTargetIds: string[]
): boolean {
  const todayRow = db.getDailyBountyAnnouncementRow(guildId, dateKey);
  if (todayRow !== null) {
    return bountyTargetIdsEqual(todayRow.targetIds, computedTargetIds);
  }
  const previousTargets = db.getDailyBountyTargets(guildId, previousCalendarDateKey(dateKey));
  return bountyTargetIdsEqual(previousTargets, computedTargetIds);
}

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

/**
 * Append bounty marks for today (dedupes against existing list, caps at `bountyEnv.topN`).
 * Sets the same manual lock as `applyManualBountyTargets`.
 */
export function appendManualBountyTargets(args: {
  db: EloDb;
  guildId: string;
  addTargetIds: string[];
  nowMs?: number;
}): { dateKey: string; targetIds: string[]; truncated: boolean; actuallyAdded: string[] } {
  if (!bountyEnv.enabled) {
    throw new Error("bounty_disabled");
  }
  const uniqAdd = [...new Set(args.addTargetIds.filter(Boolean))];
  if (uniqAdd.length === 0) {
    throw new Error("no_marks");
  }

  const now = args.nowMs ?? Date.now();
  const dateKey = calendarDateKeyInTimeZone(now, bountyEnv.timezone);
  const row = args.db.getDailyBountyAnnouncementRow(args.guildId, dateKey);
  const existing = row?.targetIds ?? [];

  const newIds = uniqAdd.filter((id) => !existing.includes(id));
  if (newIds.length === 0) {
    throw new Error("bounty_no_new_marks");
  }

  const merged = [...existing, ...newIds];
  const truncated = merged.length > bountyEnv.topN;
  const capped = merged.slice(0, bountyEnv.topN);
  const actuallyAdded = newIds.filter((id) => capped.includes(id));

  args.db.ensurePlayers(args.guildId, capped);
  args.db.upsertDailyBountyTargets(args.guildId, dateKey, capped, Date.now());
  args.db.setMeta(args.guildId, BOUNTY_MANUAL_DATE_META_KEY, dateKey);

  return { dateKey, targetIds: capped, truncated, actuallyAdded };
}

/**
 * Remove bounty marks from today's list (any that appear in both the list and `removeTargetIds`).
 * Drops matching first-snipe claims so 2× state stays consistent. Sets the manual lock for today.
 */
export function removeManualBountyTargets(args: {
  db: EloDb;
  guildId: string;
  removeTargetIds: string[];
  nowMs?: number;
}): { dateKey: string; targetIds: string[]; actuallyRemoved: string[] } {
  if (!bountyEnv.enabled) {
    throw new Error("bounty_disabled");
  }
  const uniq = [...new Set(args.removeTargetIds.filter(Boolean))];
  if (uniq.length === 0) {
    throw new Error("no_marks");
  }

  const now = args.nowMs ?? Date.now();
  const dateKey = calendarDateKeyInTimeZone(now, bountyEnv.timezone);
  const row = args.db.getDailyBountyAnnouncementRow(args.guildId, dateKey);
  const existing = row?.targetIds ?? [];
  if (existing.length === 0) {
    throw new Error("bounty_no_list_today");
  }

  const removeSet = new Set(uniq);
  const actuallyRemoved = uniq.filter((id) => existing.includes(id));
  if (actuallyRemoved.length === 0) {
    throw new Error("bounty_remove_none_on_list");
  }

  const next = existing.filter((id) => !removeSet.has(id));
  for (const id of actuallyRemoved) {
    args.db.deleteBountyFirstSnipeClaim({
      guildId: args.guildId,
      bountyDate: dateKey,
      bountyTargetId: id,
    });
  }
  if (next.length > 0) {
    args.db.ensurePlayers(args.guildId, next);
  }
  args.db.upsertDailyBountyTargets(args.guildId, dateKey, next, Date.now());
  args.db.setMeta(args.guildId, BOUNTY_MANUAL_DATE_META_KEY, dateKey);

  return { dateKey, targetIds: next, actuallyRemoved };
}
