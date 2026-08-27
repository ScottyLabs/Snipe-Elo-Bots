import { config } from "./config";

export const SLACK_GUILD_ID = "__slack__";

// Effective DB tenant for all Slack operations.
// Returns SHARED_GUILD_ID in unified mode, else SLACK_GUILD_ID (unchanged behavior).
export function slackEffectiveGuildId(): string {
  return config.sharedGuildId ?? SLACK_GUILD_ID;
}
