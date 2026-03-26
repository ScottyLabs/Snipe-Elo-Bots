/**
 * Normalize a message / slash command label to lowercase with exactly one leading `/`.
 * Env may be `removesnipe` or `/removesnipe`.
 */
export function normalizeSlashCommand(raw: string | undefined, defaultWithoutSlash: string): string {
  const trimmed = (raw?.trim() || defaultWithoutSlash).toLowerCase();
  const body = trimmed.replace(/^\/+/, "") || defaultWithoutSlash.toLowerCase();
  return `/${body}`;
}

/** Plain-text command line: already trimmed and lowercased. */
export function isCommandBody(textLower: string, commandWithoutSlash: string): boolean {
  const c = commandWithoutSlash.replace(/^\//, "").toLowerCase();
  return textLower === c || textLower.startsWith(`${c} `);
}
