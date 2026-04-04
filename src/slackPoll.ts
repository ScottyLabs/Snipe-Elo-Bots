import crypto from "crypto";
import type { EloDb, SlackPollRow } from "./db";
import { opsLog } from "./opsLog";
import { formatDurationLabel, parseDurationToMs } from "./snipeDuel";

export type PollSlashParsed =
  | { ok: true; kind: "list" }
  | { ok: true; kind: "check"; index: number }
  | { ok: true; kind: "create"; title: string; options: string[]; durationMs: number | null }
  | { ok: false; reason: "usage" | "too_many_options" | "bad_check_index" };

const MAX_OPTIONS = 24;

/**
 * Slash text after `/poll` (no leading command). Examples:
 * - `list`
 * - `check 2`
 * - `Best map? | Dust2 | Inferno | Mirage`
 * - `Lunch? | Pizza | Sushi | 4h` (optional duration as last segment, needs ≥4 pipe parts)
 */
export function parsePollSlashText(raw: string): PollSlashParsed {
  const t = raw.trim();
  if (!t) return { ok: false, reason: "usage" };
  const lower = t.toLowerCase();
  if (lower === "list") return { ok: true, kind: "list" };
  const checkM = /^check\s+(\d+)\s*$/i.exec(t);
  if (checkM) {
    const index = parseInt(checkM[1]!, 10);
    if (!Number.isFinite(index) || index < 1) return { ok: false, reason: "bad_check_index" };
    return { ok: true, kind: "check", index };
  }

  const parts = t
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length < 3) return { ok: false, reason: "usage" };

  let durationMs: number | null = null;
  let body = parts;
  if (parts.length >= 4) {
    const last = parts[parts.length - 1]!;
    const d = parseDurationToMs(last);
    if (d != null) {
      durationMs = d;
      body = parts.slice(0, -1);
    }
  }

  if (body.length < 3) return { ok: false, reason: "usage" };
  const title = body[0]!;
  const options = body.slice(1);
  if (options.length < 2) return { ok: false, reason: "usage" };
  if (options.length > MAX_OPTIONS) return { ok: false, reason: "too_many_options" };

  return { ok: true, kind: "create", title, options, durationMs };
}

export function slackPollUsage(slashPoll: string): string {
  const cmd = slashPoll.startsWith("/") ? slashPoll : `/${slashPoll}`;
  return [
    `*Usage*`,
    `• \`${cmd} list\` — active polls in this channel (numbered).`,
    `• \`${cmd} check <n>\` — I’ll ping you in that poll’s thread.`,
    `• \`${cmd} <question> | <option1> | <option2> [| …] [| duration]\` — post a poll.`,
    `  Separate with \`|\`. Optional time limit only as the *last* segment (e.g. \`2h\`, \`7d\`) when you have at least two options before it.`,
    `• Vote in the poll’s *thread* by sending a message that is only the option number (\`1\`, \`2\`, …).`,
  ].join("\n");
}

export function formatSlackPollMessage(params: {
  creatorUserId: string;
  title: string;
  options: string[];
  durationMs: number | null;
  createdAtMs: number;
}): string {
  const lines: string[] = [
    `*Poll* by <@${params.creatorUserId}>`,
    "",
    `*${params.title}*`,
    "",
    ...params.options.map((o, i) => `${i + 1}. ${o}`),
    "",
    "_Reply in this thread with a number to vote (e.g. `1`). You can change your vote by sending another number._",
  ];
  if (params.durationMs != null) {
    const endsAt = params.createdAtMs + params.durationMs;
    const endStr = new Date(endsAt).toISOString().replace("T", " ").slice(0, 16) + " UTC";
    lines.push(`_Closes in ${formatDurationLabel(params.durationMs)} (around _${endStr}_ UTC)._`);
  } else {
    lines.push("_No scheduled close._");
  }
  return lines.join("\n");
}

export function formatSlackPollListEphemeral(polls: SlackPollRow[], nowMs: number, slashPoll: string): string {
  if (polls.length === 0) {
    return "_No active polls in this channel._";
  }
  const lines = ["*Active polls* (this channel)", ""];
  for (let i = 0; i < polls.length; i++) {
    const p = polls[i]!;
    const n = i + 1;
    let suffix: string;
    if (p.endsAt == null) {
      suffix = "no time limit";
    } else {
      const left = Math.max(0, p.endsAt - nowMs);
      suffix = `closes in ${formatDurationLabel(left)}`;
    }
    const shortTitle = p.title.length > 80 ? `${p.title.slice(0, 77)}…` : p.title;
    lines.push(`${n}. ${shortTitle} — _${suffix}_`);
  }
  const cmd = slashPoll.startsWith("/") ? slashPoll : `/${slashPoll}`;
  lines.push("", `_Use \`${cmd} check <n>\` to get pinged in that thread._`);
  return lines.join("\n");
}

export function slackPollCheckThreadPing(userId: string, listIndex: number): string {
  return `<@${userId}> — here’s poll #${listIndex}. Cast your vote by replying in this thread with an option number.`;
}

export function slackPollVoteRecordedEphemeral(optionLabel: string): string {
  return `Got it — counted for *${optionLabel}*.`;
}

/** Handles parsed `/poll` subcommands; always completes with an ephemeral (or channel post for check ping). */
export async function handleSlackPollParsed(args: {
  parsed: PollSlashParsed;
  db: EloDb;
  client: any;
  guildId: string;
  channelId: string;
  userId: string;
  slashPollPath: string;
  ephemeral: (text: string) => Promise<void>;
}): Promise<void> {
  const { parsed, db, client, guildId, channelId, userId, slashPollPath, ephemeral } = args;
  if (!parsed.ok) {
    if (parsed.reason === "usage") {
      await ephemeral(slackPollUsage(slashPollPath));
    } else if (parsed.reason === "too_many_options") {
      await ephemeral(`Too many options (max ${MAX_OPTIONS}).`);
    } else {
      await ephemeral(`Use \`${slashPollPath} check <number>\` with a positive poll number.`);
    }
    return;
  }

  const now = Date.now();

  if (parsed.kind === "list") {
    const polls = db.listActivePollsInChannel(guildId, channelId, now);
    await ephemeral(formatSlackPollListEphemeral(polls, now, slashPollPath));
    opsLog("slack.poll.list", { userId, channelId, count: polls.length });
    return;
  }

  if (parsed.kind === "check") {
    const polls = db.listActivePollsInChannel(guildId, channelId, now);
    const p = polls[parsed.index - 1];
    if (!p) {
      await ephemeral(`No active poll #${parsed.index}. Try \`${slashPollPath} list\`.`);
      return;
    }
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: p.rootMessageTs,
      text: slackPollCheckThreadPing(userId, parsed.index),
      mrkdwn: true,
    });
    await ephemeral("Pinged you in that poll’s thread.");
    opsLog("slack.poll.check", { userId, channelId, listIndex: parsed.index, pollId: p.pollId });
    return;
  }

  const endsAt = parsed.durationMs != null ? now + parsed.durationMs : null;
  const body = formatSlackPollMessage({
    creatorUserId: userId,
    title: parsed.title,
    options: parsed.options,
    durationMs: parsed.durationMs,
    createdAtMs: now,
  });
  const posted = await client.chat.postMessage({
    channel: channelId,
    text: body,
    mrkdwn: true,
  });
  const rootTs = posted.ts;
  if (!rootTs) throw new Error("poll_post_missing_ts");
  const pollId = crypto.randomUUID();
  db.insertPoll({
    pollId,
    guildId,
    channelId,
    rootMessageTs: rootTs,
    createdBy: userId,
    title: parsed.title,
    options: parsed.options,
    createdAt: now,
    endsAt,
  });
  await ephemeral("Posted your poll. Votes: reply *in this message’s thread* with just the option number.");
  opsLog("slack.poll.create", {
    userId,
    channelId,
    pollId,
    optionCount: parsed.options.length,
    hasEnd: endsAt != null,
  });
}
