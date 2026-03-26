export function parseMentionedUserIds(text: string): string[] {
  // Slack user mentions look like: <@U12345678> (sometimes with a display suffix: <@U123|name>)
  const re = /<@([A-Z0-9]+)(?:\|[^>]+)?>/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[1]);
  }
  // Deduplicate while preserving order.
  return [...new Set(out)];
}

function collectUserIdsFromObject(v: any, out: Set<string>): void {
  if (v == null) return;
  if (Array.isArray(v)) {
    for (const x of v) collectUserIdsFromObject(x, out);
    return;
  }
  if (typeof v === "object") {
    if (v.type === "user" && typeof v.user_id === "string") out.add(v.user_id);
    for (const k of Object.keys(v)) collectUserIdsFromObject((v as any)[k], out);
  }
}

/** Mentions in Block Kit / rich_text often do not appear in `text`; walk the payload. */
export function parseMentionedUserIdsFromMessageEvent(event: any): string[] {
  const fromText = parseMentionedUserIds(event?.text ?? "");
  const fromBlocks = new Set<string>();
  collectUserIdsFromObject(event?.blocks, fromBlocks);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of fromText) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of fromBlocks) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function parseUserToken(token: string): { ok: true; userId: string } | { ok: false; reason: string } {
  const t = token.trim();

  // Allow comma-separated tokens from user input.
  const cleaned = t.replace(/^[<@!\s]+|[>,.\s]+$/g, "").trim();

  // <@U123> or Slack's usual <@U123|display name> in slash-command text
  const mentionMatch = t.match(/<@([A-Z0-9]+)(?:\|[^>]+)?>/);
  if (mentionMatch) {
    return { ok: true, userId: mentionMatch[1] };
  }

  // Plain Slack ID form
  if (/^U[A-Z0-9]+$/.test(cleaned)) {
    return { ok: true, userId: cleaned };
  }

  // @username form (we will resolve later with a user list map)
  const atUsername = cleaned.match(/^@([a-zA-Z0-9_.-]+)$/);
  if (atUsername) {
    return { ok: false, reason: `username:${atUsername[1]}` };
  }

  return { ok: false, reason: "unrecognized_token" };
}

export function normalizeCommandText(text: string | undefined | null): string {
  return (text ?? "").trim();
}

const IMAGE_FILETYPES = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "heic",
  "bmp",
  "tif",
  "tiff",
  "svg",
]);

function fileLooksLikeImage(f: any): boolean {
  if (!f || typeof f !== "object") return false;
  const mimetype = String(f.mimetype ?? "");
  const filetype = String(f.filetype ?? "").toLowerCase();
  if (mimetype.startsWith("image/")) return true;
  if (filetype.startsWith("image")) return true;
  return IMAGE_FILETYPES.has(filetype);
}

export function isLikelyImageMessage(event: any): boolean {
  const files = Array.isArray(event?.files) ? event.files : [];
  if (files.some((f: any) => fileLooksLikeImage(f))) return true;
  // file_share events often use a singular `file` object instead of `files[]`.
  if (fileLooksLikeImage(event?.file)) return true;
  // Without files:read, Slack may redact file fields; file_share + known image extension still counts.
  if (event?.subtype === "file_share" && event?.file) {
    const ft = String(event.file.filetype ?? "").toLowerCase();
    if (IMAGE_FILETYPES.has(ft)) return true;
    const mime = String(event.file.mimetype ?? "");
    if (!mime && !ft) return true;
  }
  const atts = Array.isArray(event?.attachments) ? event.attachments : [];
  if (atts.some((a: any) => typeof a?.image_url === "string" && a.image_url.length > 0)) return true;
  return false;
}

/** Slack uses subtypes like file_share for uploads; we must not drop those for snipe detection. */
export function isProcessableUserMessageEvent(event: any): boolean {
  if (event?.bot_id) return false;
  const st = event?.subtype as string | undefined;
  if (st == null || st === "") return true;
  return st === "file_share" || st === "thread_broadcast";
}

