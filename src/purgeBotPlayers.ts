import type { Client } from "discord.js";
import type { EloDb } from "./db";
import { discordUserIsBotCached } from "./discordDisplayNames";
import { opsLog } from "./opsLog";
import { getSlackUserProfileCached } from "./slackDisplayNames";
import { SLACK_GUILD_ID } from "./tenants";

type SlackInfoClient = { users: { info: (a: { user: string }) => Promise<unknown> } };

/** Drop `players` rows for Slack users Slack reports as bots (startup cleanup). */
export async function purgeSlackBotPlayersFromDb(db: EloDb, client: SlackInfoClient): Promise<number> {
  const sorted = db.getAllPlayersSorted(SLACK_GUILD_ID);
  const botIds: string[] = [];
  for (const p of sorted) {
    const snap = await getSlackUserProfileCached(client, p.playerId);
    if (snap?.isBot === true) botIds.push(p.playerId);
  }
  const n = db.deletePlayersForGuild(SLACK_GUILD_ID, botIds);
  if (n > 0) {
    opsLog("elo.purge_bot_players", { platform: "slack", guildId: SLACK_GUILD_ID, removed: n });
  }
  return n;
}

/** Drop `players` rows for Discord users that are bots, for every guild the bot shares with DB data. */
export async function purgeDiscordBotPlayersFromDb(db: EloDb, client: Client): Promise<number> {
  let total = 0;
  const guildIds = db.listGuildIdsWithPlayerRows().filter((id) => id !== SLACK_GUILD_ID);
  for (const gid of guildIds) {
    const guild = client.guilds.cache.get(gid);
    if (!guild) continue;
    const sorted = db.getAllPlayersSorted(gid);
    const botIds: string[] = [];
    for (const p of sorted) {
      if (await discordUserIsBotCached(guild, p.playerId)) botIds.push(p.playerId);
    }
    const n = db.deletePlayersForGuild(gid, botIds);
    total += n;
    if (n > 0) {
      opsLog("elo.purge_bot_players", { platform: "discord", guildId: gid, removed: n });
    }
  }
  return total;
}
