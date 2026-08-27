import Database from "better-sqlite3";
import * as fs from "fs";
import type { EloDb } from "./db";
import { opsLog } from "./opsLog";
import { toCanonical, slackIdForCanonical } from "./identityMap";
import { eloEnv } from "./eloEnv";

// Reads all player rows from the Discord DB (read-only), merges into the unified DB,
// then renames the Discord DB file to <path>.pre-merge-backup.
// Safe to call multiple times; the meta flag 'merge_done' prevents re-running.
export function reconcileFromDiscordDb(args: {
  unifiedDb: EloDb;
  sharedGuildId: string;
  discordDbPath: string;
  discordGuildId: string; // the Discord guild whose rows to migrate
}): void {
  const { unifiedDb, sharedGuildId, discordDbPath, discordGuildId } = args;

  if (!fs.existsSync(discordDbPath)) {
    opsLog("reconcile.skip", { reason: "discord_db_not_found", discordDbPath });
    return;
  }
  if (unifiedDb.getMeta(sharedGuildId, "merge_done") === "true") {
    opsLog("reconcile.skip", { reason: "already_done" });
    return;
  }

  opsLog("reconcile.start", { discordDbPath, discordGuildId, sharedGuildId });
  const discordDb = new Database(discordDbPath, { readonly: true });

  try {
    // All Slack players (guild_id = '__slack__') from the unified DB.
    const slackPlayers = unifiedDb.getAllPlayersSorted("__slack__");

    // All Discord players from the old Discord DB.
    const discordRows = discordDb
      .prepare(
        `SELECT player_id, rating FROM players WHERE guild_id = ? ORDER BY rating DESC`
      )
      .all(discordGuildId) as { player_id: string; rating: number }[];
    const discordScoreMap = new Map(discordRows.map(r => [r.player_id, r.rating]));

    const handledDiscordIds = new Set<string>();

    // Process every Slack player.
    for (const { playerId: slackId, rating: slackScore } of slackPlayers) {
      const canonical = toCanonical('slack', slackId); // already in memory from Keycloak refresh
      const isLinked = !canonical.startsWith('slack:');

      if (isLinked) {
        const discordId = canonical;
        handledDiscordIds.add(discordId);
        const discordScore = discordScoreMap.get(discordId) ?? eloEnv.initialRating;
        const mergedScore = slackScore + discordScore - 1000;
        unifiedDb.ensurePlayers(sharedGuildId, [discordId]);
        const existing = unifiedDb.getRatings(sharedGuildId, [discordId]).get(discordId);
        if (existing !== undefined) {
          unifiedDb.adjustPlayerRating({ guildId: sharedGuildId, playerId: discordId, delta: mergedScore - existing });
        } else {
          unifiedDb.adjustPlayerRating({ guildId: sharedGuildId, playerId: discordId, delta: mergedScore - eloEnv.initialRating });
        }
        unifiedDb.upsertPlayerProfile({ canonicalId: discordId, slackId, discordId, source: 'reconciled' });
      } else {
        // Unlinked Slack user: carry over their score under 'slack:SLACKID'.
        const slackCanonical = `slack:${slackId}`;
        unifiedDb.ensurePlayers(sharedGuildId, [slackCanonical]);
        const existing = unifiedDb.getRatings(sharedGuildId, [slackCanonical]).get(slackCanonical);
        if (existing !== undefined) {
          unifiedDb.adjustPlayerRating({ guildId: sharedGuildId, playerId: slackCanonical, delta: slackScore - existing });
        } else {
          unifiedDb.adjustPlayerRating({ guildId: sharedGuildId, playerId: slackCanonical, delta: slackScore - eloEnv.initialRating });
        }
        unifiedDb.upsertPlayerProfile({ canonicalId: slackCanonical, slackId, discordId: null, source: 'reconciled' });
      }
    }

    // Process Discord-only players (no Slack link, not already handled).
    for (const { player_id: discordId, rating: discordScore } of discordRows) {
      if (handledDiscordIds.has(discordId)) continue;
      const slackId = slackIdForCanonical(discordId); // check if linked to a Slack user not in DB1
      unifiedDb.ensurePlayers(sharedGuildId, [discordId]);
      const existing = unifiedDb.getRatings(sharedGuildId, [discordId]).get(discordId);
      if (existing !== undefined) {
        unifiedDb.adjustPlayerRating({ guildId: sharedGuildId, playerId: discordId, delta: discordScore - existing });
      } else {
        unifiedDb.adjustPlayerRating({ guildId: sharedGuildId, playerId: discordId, delta: discordScore - eloEnv.initialRating });
      }
      unifiedDb.upsertPlayerProfile({ canonicalId: discordId, slackId: slackId ?? null, discordId, source: 'reconciled' });
    }

    unifiedDb.setMeta(sharedGuildId, "merge_done", "true");
    opsLog("reconcile.done", {
      slackCount: slackPlayers.length,
      discordCount: discordRows.length,
    });
  } finally {
    discordDb.close();
  }

  // Rename Discord DB so it is no longer used.
  const backupPath = `${discordDbPath}.pre-merge-backup`;
  fs.renameSync(discordDbPath, backupPath);
  opsLog("reconcile.backup", { from: discordDbPath, to: backupPath });
}
