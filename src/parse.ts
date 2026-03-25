export function parseMentionedUserIds(text: string): string[] {
  // Slack user mentions look like: <@U12345678>
  const re = /<@([A-Z0-9]+)>/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[1]);
  }
  // Deduplicate while preserving order.
  return [...new Set(out)];
}

export function parseUserToken(token: string): { ok: true; userId: string } | { ok: false; reason: string } {
  const t = token.trim();

  // Allow comma-separated tokens from user input.
  const cleaned = t.replace(/^[<@!\s]+|[>,.\s]+$/g, "").trim();

  // <@U123> form
  const mentionMatch = t.match(/<@([A-Z0-9]+)>/);
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
  return false;
}

/** Slack uses subtypes like file_share for uploads; we must not drop those for snipe detection. */
export function isProcessableUserMessageEvent(event: any): boolean {
  if (event?.bot_id) return false;
  const st = event?.subtype as string | undefined;
  if (st == null || st === "") return true;
  return st === "file_share" || st === "thread_broadcast";
}

