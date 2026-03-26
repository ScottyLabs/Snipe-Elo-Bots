/**
 * Normalize a message command to lowercase with exactly one leading `/`.
 * Env may be `removesnipe` or `/removesnipe`.
 */
export function normalizeSlashCommand(raw: string | undefined, defaultWithoutSlash: string): string {
  const trimmed = (raw?.trim() || defaultWithoutSlash).toLowerCase();
  const body = trimmed.replace(/^\/+/, "") || defaultWithoutSlash.toLowerCase();
  return `/${body}`;
}

/** Message text must already be trimmed and lowercased. */
export function isSlashCommandBody(textLower: string, slashCommand: string): boolean {
  const c = slashCommand.toLowerCase();
  return textLower === c || textLower.startsWith(`${c} `);
}
