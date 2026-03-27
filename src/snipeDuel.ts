import type { EloDb, SnipeDuelRow } from "./db";

const MIN_DURATION_MS = 60_000;
const MAX_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

/** Parses e.g. `30m`, `2h`, `7d`, `1w` (weeks). */
export function parseDurationToMs(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  const m = /^(\d+)\s*(m|h|d|w)$/.exec(s);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2];
  let ms = 0;
  switch (unit) {
    case "m":
      ms = n * 60_000;
      break;
    case "h":
      ms = n * 60 * 60_000;
      break;
    case "d":
      ms = n * 24 * 60 * 60_000;
      break;
    case "w":
      ms = n * 7 * 24 * 60 * 60_000;
      break;
    default:
      return null;
  }
  if (ms < MIN_DURATION_MS || ms > MAX_DURATION_MS) return null;
  return ms;
}

export function formatDurationLabel(durationMs: number): string {
  if (durationMs % (7 * 24 * 60 * 60_000) === 0) {
    const w = durationMs / (7 * 24 * 60 * 60_000);
    return `${w} week${w === 1 ? "" : "s"}`;
  }
  if (durationMs % (24 * 60 * 60_000) === 0) {
    const d = durationMs / (24 * 60 * 60_000);
    return `${d} day${d === 1 ? "" : "s"}`;
  }
  if (durationMs % (60 * 60_000) === 0) {
    const h = durationMs / (60 * 60_000);
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  const min = Math.round(durationMs / 60_000);
  return `${min} minute${min === 1 ? "" : "s"}`;
}

export function formatDuelChallengeBlocks(params: {
  challengerMention: string;
  targetMention: string;
  durationLabel: string;
  betPoints: number;
}): string {
  return [
    `*Snipe duel* — ${params.challengerMention} challenges ${params.targetMention}.`,
    `• After you *accept*, the clock runs for *${params.durationLabel}*.`,
    `• Stake: *${params.betPoints}* ELO — winner takes that much from the loser’s rating; *tie* — no change.`,
    "",
    `${params.targetMention}: reply in this thread with \`acceptduel\` or \`declineduel\`.`,
  ].join("\n");
}

/** Appended to snipe confirmation when the sniper→sniped pair is in an active duel. */
export function formatDuelLiveScoreLineShort(params: {
  duel: SnipeDuelRow;
  nameOf: (id: string) => string;
  db: EloDb;
  guildId: string;
  nowMs: number;
}): string {
  const { duel, nameOf, db, guildId, nowMs } = params;
  const a = duel.challengerId;
  const b = duel.targetId;
  const since = duel.acceptedAt ?? 0;
  const until = duel.endsAt ?? nowMs;
  const end = Math.min(nowMs, until);
  const aToB = db.countDirectedSnipesInWindow(guildId, a, b, since, end);
  const bToA = db.countDirectedSnipesInWindow(guildId, b, a, since, end);
  const endDate = new Date(until);
  const endStr = endDate.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  return (
    `*Duel:* ${nameOf(a)}→${nameOf(b)} *${aToB}* · ${nameOf(b)}→${nameOf(a)} *${bToA}* · ends _${endStr}_`
  );
}

export function collectActiveDuelsForSnipe(
  db: EloDb,
  guildId: string,
  sniperId: string,
  snipedIds: string[],
  nowMs: number
): SnipeDuelRow[] {
  const out: SnipeDuelRow[] = [];
  const seen = new Set<string>();
  for (const snipedId of snipedIds) {
    if (snipedId === sniperId) continue;
    const d = db.getActiveDuelForPair(guildId, sniperId, snipedId, nowMs);
    if (d && !seen.has(d.duelId)) {
      seen.add(d.duelId);
      out.push(d);
    }
  }
  return out;
}

export function formatDuelSettlementMessage(params: {
  duel: SnipeDuelRow;
  nameOf: (id: string) => string;
  db: EloDb;
  guildId: string;
}): string {
  const { duel, nameOf, db, guildId } = params;
  const a = duel.challengerId;
  const b = duel.targetId;
  const since = duel.acceptedAt ?? 0;
  const until = duel.endsAt ?? Date.now();
  const aToB = db.countDirectedSnipesInWindow(guildId, a, b, since, until);
  const bToA = db.countDirectedSnipesInWindow(guildId, b, a, since, until);
  const na = nameOf(a);
  const nb = nameOf(b);
  if (aToB === bToA) {
    return (
      `*Snipe duel ended — tie* (${na} vs ${nb}: ${aToB} landing each way). ` +
      `Stake *${duel.betPoints}* ELO stays put.`
    );
  }
  const winnerId = aToB > bToA ? a : b;
  const loserId = winnerId === a ? b : a;
  return (
    `*Snipe duel resolved* — ${nameOf(winnerId)} wins (${na}→${nb} *${aToB}*, ${nb}→${na} *${bToA}*). ` +
    `*${duel.betPoints}* ELO: ${nameOf(loserId)} → ${nameOf(winnerId)}.`
  );
}
