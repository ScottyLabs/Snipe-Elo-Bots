/** https://discord.com/developers/docs/resources/channel#create-message */
export const DISCORD_MESSAGE_CONTENT_MAX = 2000;

const TRUNCATE_NOTE = "\n…\n_(truncated for Discord’s 2000-character limit.)_";

/** Ensures `content` is valid for Discord message `content` fields. */
export function clampDiscordMessageContent(text: string): string {
  if (text.length <= DISCORD_MESSAGE_CONTENT_MAX) return text;
  const budget = DISCORD_MESSAGE_CONTENT_MAX - TRUNCATE_NOTE.length;
  return (budget > 0 ? text.slice(0, budget).trimEnd() : "") + TRUNCATE_NOTE;
}
