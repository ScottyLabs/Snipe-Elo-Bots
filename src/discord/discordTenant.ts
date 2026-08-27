import { config } from "../config";
import { discordConfig } from "./configDiscord";

// Effective DB tenant for a Discord guild's DB operations.
// Bridged guild -> shared tenant. All other guilds -> own Discord snowflake (unchanged).
export function discordEffectiveGuildId(discordGuildId: string): string {
  if (discordConfig.bridgedGuildId && discordGuildId === discordConfig.bridgedGuildId) {
    return config.sharedGuildId ?? discordGuildId;
  }
  return discordGuildId;
}
