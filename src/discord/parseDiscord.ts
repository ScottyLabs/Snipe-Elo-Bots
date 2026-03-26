import type { Message, PartialMessage } from "discord.js";

const MENTION_RE = /<@!?(\d+)>/g;

export function parseMentionedUserIdsFromContent(content: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(content)) !== null) {
    out.push(m[1]);
  }
  return [...new Set(out)];
}

export function messageHasImageAttachment(message: Message | PartialMessage): boolean {
  const atts = message.attachments;
  if (!atts || atts.size === 0) return false;
  for (const a of atts.values()) {
    const ct = a.contentType ?? "";
    const name = a.name?.toLowerCase() ?? "";
    if (ct.startsWith("image/")) return true;
    if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) return true;
  }
  for (const e of message.embeds ?? []) {
    if (e.image?.url || e.thumbnail?.url) return true;
  }
  return false;
}

/** Mentioned users from Discord + text (excluding everyone/here). */
export function collectMentionedUserIds(message: Message): string[] {
  const fromUsers = [...message.mentions.users.values()].map((u) => u.id);
  const fromText = parseMentionedUserIdsFromContent(message.content);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...fromUsers, ...fromText]) {
    if (message.client.user && id === message.client.user.id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
