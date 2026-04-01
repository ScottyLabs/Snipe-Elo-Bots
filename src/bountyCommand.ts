import { calendarDateKeyInTimeZone, formatBountyDateLabel } from "./bounty";
import { bountyEnv } from "./bountyEnv";
import type { EloDb } from "./db";
import { L } from "./voice";

export function formatBountyStatusMessage(params: {
  platform: "slack" | "discord";
  db: EloDb;
  guildId: string;
  nowMs?: number;
  /** Display names for bounty mark ids and for any sniper id that claimed a mark today. */
  nameOf: (id: string) => string;
}): string {
  const now = params.nowMs ?? Date.now();
  const dateKey = calendarDateKeyInTimeZone(now, bountyEnv.timezone);
  const dateLabel = formatBountyDateLabel(dateKey, bountyEnv.timezone);

  if (!bountyEnv.enabled) {
    return L.bountySlashDisabled(params.platform);
  }

  const row = params.db.getDailyBountyAnnouncementRow(params.guildId, dateKey);
  if (!row) {
    return L.bountySlashNoLedgerYet(params.platform, dateLabel);
  }

  const { targetIds } = row;
  if (targetIds.length === 0) {
    return L.bountySlashEmptyMarks(params.platform, dateLabel);
  }

  const claims = params.db.getBountyFirstSnipesForDate(params.guildId, dateKey);
  const claimByMark = new Map(claims.map((c) => [c.bountyTargetId, c]));
  const header = L.bountySlashListHeader(params.platform, dateLabel, bountyEnv.timezone);
  const lines = targetIds.map((id, i) => {
    const claim = claimByMark.get(id);
    const claimed = Boolean(claim);
    const claimedByName = claim ? params.nameOf(claim.sniperId) : null;
    return L.bountySlashMarkLine(params.platform, i + 1, params.nameOf(id), claimed, claimedByName);
  });
  return [header, "", ...lines, "", L.bountySlashFooter(params.platform)].join("\n");
}
