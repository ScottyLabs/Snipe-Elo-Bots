import type { EloDb } from "./db";

/** Discord or Slack: resolve labels for graph + player panel APIs. */
export type GraphHttpPlatformContext = {
  db: EloDb;
  guildDisplayName: (guildId: string) => Promise<string>;
  resolveDisplayNamesForGuild: (guildId: string, userIds: string[]) => Promise<Map<string, string>>;
  isGuildResolvableForPlayerPanel: (guildId: string) => Promise<boolean>;
  /** Player IDs to keep in the snipe graph (exclude bots / non-humans). */
  filterGraphHumanPlayerIds: (guildId: string, userIds: string[]) => Promise<Set<string>>;
  /** This app’s own bot user id(s) — always removed from the graph. */
  getGraphExcludedSelfPlayerIds: () => Promise<Set<string>>;
};
