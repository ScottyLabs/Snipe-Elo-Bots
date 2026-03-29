import { calendarDateKeyInTimeZone, formatBountyDateLabel } from "./bounty";
import { bountyEnv } from "./bountyEnv";
import type { EloDb } from "./db";
import * as L from "./voiceLemuen";

export function formatBountyStatusMessage(params: {
  platform: "slack" | "discord";
  db: EloDb;
  guildId: string;
  nowMs?: number;
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

  const claimed = new Set(params.db.listBountyClaimedTargetsForDate(params.guildId, dateKey));
  const header = L.bountySlashListHeader(params.platform, dateLabel, bountyEnv.timezone);
  const lines = targetIds.map((id, i) =>
    L.bountySlashMarkLine(params.platform, i + 1, params.nameOf(id), claimed.has(id))
  );
  return [header, "", ...lines, "", L.bountySlashFooter(params.platform)].join("\n");
}
