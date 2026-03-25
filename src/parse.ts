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

export function isLikelyImageMessage(event: any): boolean {
  // Slack message payload includes files[] for uploaded images.
  const files = Array.isArray(event?.files) ? event.files : [];
  return files.some((f: any) => {
    const mimetype = (f?.mimetype ?? "") as string;
    const filetype = (f?.filetype ?? "") as string;
    return mimetype.startsWith("image/") || filetype.startsWith("image/");
  });
}

