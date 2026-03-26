import Database from "better-sqlite3";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { eloEnv } from "./eloEnv";
import { computePairRatingDeltas } from "./elo";
import { opsLog } from "./opsLog";
import { SLACK_GUILD_ID } from "./tenants";

export type PlayerRating = { playerId: string; rating: number };

export type PairMatch = {
  pairIdx: number;
  sniperId: string;
  snipedId: string;
  sniperBefore: number;
  sniperAfter: number;
  snipedBefore: number;
  snipedAfter: number;
  sniperDelta: number;
};

export type PlayerChange = {
  playerId: string;
  beforeRating: number;
  afterRating: number;
  delta: number;
};

export type SnipeEventRow = {
  snipeId: string;
  guildId: string;
  type: string;
  channelId: string;
  threadTs: string;
  sourceMessageTs: string | null;
  sniperId: string | null;
  snipedIdsJson: string | null;
  undoneOfSnipeId: string | null;
  undoneAt: number | null;
  confirmationMessageTs: string | null;
  createdAt: number;
};

function newId(): string {
  return crypto.randomUUID();
}

function mapSnipeRow(row: Record<string, unknown>): SnipeEventRow {
  return {
    snipeId: row.snipe_id as string,
    guildId: row.guild_id as string,
    type: row.type as string,
    channelId: row.channel_id as string,
    threadTs: row.thread_ts as string,
    sourceMessageTs: (row.source_message_ts as string | null) ?? null,
    sniperId: (row.sniper_id as string | null) ?? null,
    snipedIdsJson: (row.sniped_ids_json as string | null) ?? null,
    undoneOfSnipeId: (row.undone_of_snipe_id as string | null) ?? null,
    undoneAt: (row.undone_at as number | null) ?? null,
    confirmationMessageTs: (row.confirmation_message_ts as string | null) ?? null,
    createdAt: row.created_at as number,
  };
}

export type EloDbOptions = {
  /** Rows without guild_id (pre-migration) are assigned to this tenant. Slack: SLACK_GUILD_ID; Discord: configured guild. */
  tenantIdForLegacyMigration?: string;
};

export class EloDb {
  private db: Database.Database;
  private readonly tenantIdForLegacyMigration: string;

  constructor(dbPath: string, opts?: EloDbOptions) {
    this.tenantIdForLegacyMigration = opts?.tenantIdForLegacyMigration ?? SLACK_GUILD_ID;
    let openPath = dbPath;
    if (dbPath && dbPath !== ":memory:") {
      openPath = path.resolve(dbPath);
      const dir = path.dirname(openPath);
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(openPath);
    this.db.pragma("journal_mode = WAL");
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kv(
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS players(
        guild_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        rating INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(guild_id, player_id)
      );

      CREATE TABLE IF NOT EXISTS snipe_events(
        snipe_id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        type TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        thread_ts TEXT NOT NULL,
        source_message_ts TEXT,
        sniper_id TEXT,
        sniped_ids_json TEXT,
        undone_of_snipe_id TEXT,
        undone_at INTEGER,
        confirmation_message_ts TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS event_player_changes(
        snipe_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        before_rating INTEGER NOT NULL,
        after_rating INTEGER NOT NULL,
        delta INTEGER NOT NULL,
        PRIMARY KEY(snipe_id, player_id)
      );

      CREATE TABLE IF NOT EXISTS event_pair_matches(
        snipe_id TEXT NOT NULL,
        pair_idx INTEGER NOT NULL,
        sniper_id TEXT NOT NULL,
        sniped_id TEXT NOT NULL,
        sniper_before INTEGER NOT NULL,
        sniper_after INTEGER NOT NULL,
        sniped_before INTEGER NOT NULL,
        sniped_after INTEGER NOT NULL,
        sniper_delta INTEGER NOT NULL,
        PRIMARY KEY(snipe_id, pair_idx)
      );
    `);
    this.migrateLegacySchemaIfNeeded();
  }

  private tableHasColumn(table: string, column: string): boolean {
    const cols = this.db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    return cols.some((c) => c.name === column);
  }

  private migrateLegacySchemaIfNeeded() {
    const legacyTenant = this.tenantIdForLegacyMigration;
    if (!this.tableHasColumn("players", "guild_id")) {
      this.db.exec(`
        CREATE TABLE players__mig(
          guild_id TEXT NOT NULL,
          player_id TEXT NOT NULL,
          rating INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY(guild_id, player_id)
        );
        INSERT INTO players__mig SELECT '${legacyTenant.replace(/'/g, "''")}', player_id, rating, updated_at FROM players;
        DROP TABLE players;
        ALTER TABLE players__mig RENAME TO players;
      `);
      opsLog("db.migrate", { table: "players", legacyTenant });
    }

    if (!this.tableHasColumn("snipe_events", "guild_id")) {
      this.db.exec(`
        CREATE TABLE snipe_events__mig(
          snipe_id TEXT PRIMARY KEY,
          guild_id TEXT NOT NULL,
          type TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          thread_ts TEXT NOT NULL,
          source_message_ts TEXT,
          sniper_id TEXT,
          sniped_ids_json TEXT,
          undone_of_snipe_id TEXT,
          undone_at INTEGER,
          confirmation_message_ts TEXT,
          created_at INTEGER NOT NULL
        );
        INSERT INTO snipe_events__mig
        SELECT snipe_id, '${legacyTenant.replace(/'/g, "''")}', type, channel_id, thread_ts, source_message_ts,
               sniper_id, sniped_ids_json, undone_of_snipe_id, undone_at, confirmation_message_ts, created_at
        FROM snipe_events;
        DROP TABLE snipe_events;
        ALTER TABLE snipe_events__mig RENAME TO snipe_events;
      `);
      opsLog("db.migrate", { table: "snipe_events", legacyTenant });
    }

    const kvNeedsNs = this.db
      .prepare(`SELECT 1 FROM kv WHERE instr(key, '::') = 0 LIMIT 1`)
      .get() as { 1: number } | undefined;
    if (kvNeedsNs) {
      const prefix = `${legacyTenant.replace(/'/g, "''")}::`;
      this.db.exec(`
        CREATE TABLE kv__mig(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        INSERT INTO kv__mig
        SELECT CASE WHEN instr(key, '::') > 0 THEN key ELSE '${prefix}' || key END, value FROM kv;
        DROP TABLE kv;
        ALTER TABLE kv__mig RENAME TO kv;
      `);
      opsLog("db.migrate", { table: "kv", legacyTenant });
    }
  }

  private metaKey(guildId: string, key: string): string {
    return `${guildId}::${key}`;
  }

  getMeta(guildId: string, key: string): string | null {
    const row = this.db.prepare(`SELECT value FROM kv WHERE key = ?`).get(this.metaKey(guildId, key)) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  setMeta(guildId: string, key: string, value: string) {
    const stmt = this.db.prepare(
      `INSERT INTO kv(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    );
    stmt.run(this.metaKey(guildId, key), value);
  }

  ensurePlayers(guildId: string, playerIds: string[]) {
    const now = Date.now();
    const insert = this.db.prepare(
      `INSERT INTO players(guild_id, player_id, rating, updated_at)
       SELECT ?, ?, ?, ?
       WHERE NOT EXISTS(SELECT 1 FROM players WHERE guild_id = ? AND player_id = ?)`
    );
    const seen = new Set<string>();
    for (const id of playerIds) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      insert.run(guildId, id, eloEnv.initialRating, now, guildId, id);
    }
  }

  getRatings(guildId: string, playerIds: string[]): Map<string, number> {
    const ids = [...new Set(playerIds)].filter(Boolean);
    if (ids.length === 0) return new Map();
    const placeholders = ids.map(() => "?").join(",");
    const rows = this.db
      .prepare(`SELECT player_id, rating FROM players WHERE guild_id = ? AND player_id IN (${placeholders})`)
      .all(guildId, ...ids) as { player_id: string; rating: number }[];

    const map = new Map<string, number>();
    for (const r of rows) map.set(r.player_id, r.rating);
    return map;
  }

  getAllPlayersSorted(guildId: string): PlayerRating[] {
    const rows = this.db
      .prepare(
        `SELECT player_id, rating FROM players WHERE guild_id = ? ORDER BY rating DESC, player_id ASC`
      )
      .all(guildId) as { player_id: string; rating: number }[];
    return rows.map((r) => ({ playerId: r.player_id, rating: r.rating }));
  }

  setConfirmationMessageTs(guildId: string, snipeId: string, confirmationMessageTs: string) {
    this.db
      .prepare(`UPDATE snipe_events SET confirmation_message_ts = ? WHERE snipe_id = ? AND guild_id = ?`)
      .run(confirmationMessageTs, snipeId, guildId);
  }

  /**
   * Applies an integer delta to one player's rating (row is created at initial rating if missing).
   */
  adjustPlayerRating(args: { guildId: string; playerId: string; delta: number }): PlayerChange {
    const { guildId, playerId, delta } = args;
    if (!Number.isFinite(delta) || !Number.isInteger(delta)) {
      throw new Error("delta_must_be_integer");
    }
    const now = Date.now();
    this.ensurePlayers(guildId, [playerId]);
    const beforeRating = this.getRatings(guildId, [playerId]).get(playerId);
    if (beforeRating === undefined) {
      throw new Error("player_rating_missing");
    }
    const afterRating = beforeRating + delta;
    this.db
      .prepare(`UPDATE players SET rating = ?, updated_at = ? WHERE guild_id = ? AND player_id = ?`)
      .run(afterRating, now, guildId, playerId);

    const change: PlayerChange = {
      playerId,
      beforeRating,
      afterRating,
      delta,
    };
    opsLog("elo.change", {
      guildId,
      source: "manual_adjust",
      playerId,
      beforeRating,
      afterRating,
      delta,
    });
    opsLog("elo.adjust.commit", { guildId, playerId, delta, afterRating });
    return change;
  }

  applySnipe(args: {
    guildId: string;
    type: "snipe" | "makeup";
    channelId: string;
    threadTs: string;
    sourceMessageTs: string | null;
    sniperId: string;
    snipedIds: string[];
    pairwiseSourceBy?: string;
  }): {
    snipeId: string;
    pairMatches: PairMatch[];
    playerChanges: PlayerChange[];
    finalRatings: Map<string, number>;
  } {
    const guildId = args.guildId;
    const now = Date.now();
    const snipeId = newId();
    const sniperId = args.sniperId;
    const snipedIds = [...new Set(args.snipedIds)].filter((x) => x !== sniperId);
    if (snipedIds.length === 0) {
      throw new Error("no_sniped_ids");
    }

    const involvedIds = [sniperId, ...snipedIds];
    this.ensurePlayers(guildId, involvedIds);

    const startRatings = this.getRatings(guildId, involvedIds);
    const currentRatings = new Map(startRatings);

    const pairMatches: PairMatch[] = [];

    for (let i = 0; i < snipedIds.length; i++) {
      const snipedId = snipedIds[i];
      const sniperBefore = currentRatings.get(sniperId)!;
      const snipedBefore = currentRatings.get(snipedId)!;

      const { sniperDelta } = computePairRatingDeltas({
        sniperRating: sniperBefore,
        snipedRating: snipedBefore,
      });

      const sniperAfter = sniperBefore + sniperDelta;
      const snipedAfter = snipedBefore - sniperDelta;

      currentRatings.set(sniperId, sniperAfter);
      currentRatings.set(snipedId, snipedAfter);

      pairMatches.push({
        pairIdx: i,
        sniperId,
        snipedId,
        sniperBefore,
        sniperAfter,
        snipedBefore,
        snipedAfter,
        sniperDelta,
      });
    }

    const playerChanges: PlayerChange[] = [];
    for (const playerId of involvedIds) {
      const beforeRating = startRatings.get(playerId)!;
      const afterRating = currentRatings.get(playerId)!;
      playerChanges.push({
        playerId,
        beforeRating,
        afterRating,
        delta: afterRating - beforeRating,
      });
    }

    const snipedIdsJson = JSON.stringify(snipedIds);

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO snipe_events(
            snipe_id,
            guild_id,
            type,
            channel_id,
            thread_ts,
            source_message_ts,
            sniper_id,
            sniped_ids_json,
            undone_of_snipe_id,
            undone_at,
            confirmation_message_ts,
            created_at
          ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
        )
        .run(
          snipeId,
          guildId,
          args.type,
          args.channelId,
          args.threadTs,
          args.sourceMessageTs,
          sniperId,
          snipedIdsJson,
          null,
          null,
          null,
          now
        );

      const updatePlayer = this.db.prepare(
        `UPDATE players SET rating = ?, updated_at = ? WHERE guild_id = ? AND player_id = ?`
      );
      const insertPlayer = this.db.prepare(
        `INSERT INTO players(guild_id, player_id, rating, updated_at) VALUES(?,?,?,?)`
      );

      for (const change of playerChanges) {
        const exists = this.db
          .prepare(`SELECT 1 FROM players WHERE guild_id = ? AND player_id = ?`)
          .get(guildId, change.playerId);
        if (exists) updatePlayer.run(change.afterRating, now, guildId, change.playerId);
        else insertPlayer.run(guildId, change.playerId, change.afterRating, now);

        this.db
          .prepare(
            `INSERT INTO event_player_changes(snipe_id, player_id, before_rating, after_rating, delta)
             VALUES(?,?,?,?,?)
             ON CONFLICT(snipe_id, player_id) DO UPDATE SET
               before_rating = excluded.before_rating,
               after_rating = excluded.after_rating,
               delta = excluded.delta`
          )
          .run(snipeId, change.playerId, change.beforeRating, change.afterRating, change.delta);
      }

      const insertPair = this.db.prepare(
        `INSERT INTO event_pair_matches(
          snipe_id, pair_idx, sniper_id, sniped_id,
          sniper_before, sniper_after,
          sniped_before, sniped_after,
          sniper_delta
        ) VALUES(?,?,?,?,?,?,?,?,?)`
      );
      for (const m of pairMatches) {
        insertPair.run(
          snipeId,
          m.pairIdx,
          m.sniperId,
          m.snipedId,
          m.sniperBefore,
          m.sniperAfter,
          m.snipedBefore,
          m.snipedAfter,
          m.sniperDelta
        );
      }
    });

    tx();

    for (const c of playerChanges) {
      opsLog("elo.change", {
        guildId,
        snipeId,
        source: args.type,
        channelId: args.channelId,
        threadTs: args.threadTs,
        playerId: c.playerId,
        beforeRating: c.beforeRating,
        afterRating: c.afterRating,
        delta: c.delta,
      });
    }
    opsLog("elo.snipe.commit", {
      guildId,
      snipeId,
      source: args.type,
      channelId: args.channelId,
      threadTs: args.threadTs,
      sourceMessageTs: args.sourceMessageTs,
      sniperId,
      snipedIds,
      pairCount: pairMatches.length,
    });

    return { snipeId, pairMatches, playerChanges, finalRatings: currentRatings };
  }

  getUndoableSnipeByConfirmationMessageId(guildId: string, confirmationMessageId: string): SnipeEventRow | null {
    const row = this.db
      .prepare(
        `
      SELECT *
      FROM snipe_events
      WHERE guild_id = ?
        AND confirmation_message_ts = ?
        AND type IN ('snipe','makeup')
        AND undone_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `
      )
      .get(guildId, confirmationMessageId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return mapSnipeRow(row);
  }

  getLatestUndoableSnipeEventForThread(guildId: string, threadTs: string): SnipeEventRow | null {
    const row = this.db
      .prepare(
        `
      SELECT *
      FROM snipe_events
      WHERE guild_id = ?
        AND thread_ts = ?
        AND type IN ('snipe','makeup')
        AND undone_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `
      )
      .get(guildId, threadTs) as Record<string, unknown> | undefined;
    if (!row) return null;
    return mapSnipeRow(row);
  }

  getEventPlayerChanges(snipeId: string): PlayerChange[] {
    const rows = this.db
      .prepare(
        `SELECT player_id, before_rating, after_rating, delta
         FROM event_player_changes
         WHERE snipe_id = ?
        `
      )
      .all(snipeId) as { player_id: string; before_rating: number; after_rating: number; delta: number }[];
    return rows.map((r) => ({
      playerId: r.player_id,
      beforeRating: r.before_rating,
      afterRating: r.after_rating,
      delta: r.delta,
    }));
  }

  undoSnipeEvent(args: {
    guildId: string;
    channelId: string;
    threadTs: string;
    snipeIdToUndo: string;
  }): {
    undoSnipeId: string;
    playerChanges: PlayerChange[];
  } {
    const guildId = args.guildId;
    const original = this.db
      .prepare(`SELECT * FROM snipe_events WHERE snipe_id = ? AND guild_id = ?`)
      .get(args.snipeIdToUndo, guildId) as Record<string, unknown> | undefined;
    if (!original) throw new Error("snipe_not_found");
    if (original.undone_at) throw new Error("snipe_already_undone");

    const now = Date.now();
    const undoSnipeId = newId();
    const playerChangesOriginal = this.getEventPlayerChanges(args.snipeIdToUndo);
    const involvedIds = playerChangesOriginal.map((c) => c.playerId);

    this.ensurePlayers(guildId, involvedIds);
    const currentRatings = this.getRatings(guildId, involvedIds);

    const mismatch = playerChangesOriginal.find((c) => {
      const current = currentRatings.get(c.playerId)!;
      return current !== c.afterRating;
    });
    if (mismatch) {
      throw new Error(
        `cannot_undo_out_of_date_state player=${mismatch.playerId} expected=${mismatch.afterRating} actual=${currentRatings.get(
          mismatch.playerId
        )}`
      );
    }

    const tx = this.db.transaction(() => {
      this.db
        .prepare(`UPDATE snipe_events SET undone_at = ? WHERE snipe_id = ? AND guild_id = ?`)
        .run(now, args.snipeIdToUndo, guildId);

      this.db
        .prepare(
          `INSERT INTO snipe_events(
            snipe_id,
            guild_id,
            type,
            channel_id,
            thread_ts,
            source_message_ts,
            sniper_id,
            sniped_ids_json,
            undone_of_snipe_id,
            undone_at,
            confirmation_message_ts,
            created_at
          ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
        )
        .run(
          undoSnipeId,
          guildId,
          "undo",
          args.channelId,
          args.threadTs,
          null,
          original.sniper_id ?? null,
          original.sniped_ids_json ?? null,
          args.snipeIdToUndo,
          null,
          null,
          now
        );

      const updatePlayer = this.db.prepare(
        `UPDATE players SET rating = ?, updated_at = ? WHERE guild_id = ? AND player_id = ?`
      );

      const undoPlayerChanges: PlayerChange[] = [];
      for (const orig of playerChangesOriginal) {
        const before = orig.afterRating;
        const after = orig.beforeRating;
        const delta = after - before;
        updatePlayer.run(after, now, guildId, orig.playerId);

        undoPlayerChanges.push({
          playerId: orig.playerId,
          beforeRating: before,
          afterRating: after,
          delta,
        });

        this.db
          .prepare(
            `INSERT INTO event_player_changes(snipe_id, player_id, before_rating, after_rating, delta)
             VALUES(?,?,?,?,?)
             ON CONFLICT(snipe_id, player_id) DO UPDATE SET
               before_rating = excluded.before_rating,
               after_rating = excluded.after_rating,
               delta = excluded.delta`
          )
          .run(undoSnipeId, orig.playerId, before, after, delta);
      }

      return undoPlayerChanges;
    });

    const undoPlayerChanges = tx() as PlayerChange[];
    for (const c of undoPlayerChanges) {
      opsLog("elo.change", {
        guildId,
        snipeId: undoSnipeId,
        source: "undo",
        undoesSnipeId: args.snipeIdToUndo,
        channelId: args.channelId,
        threadTs: args.threadTs,
        playerId: c.playerId,
        beforeRating: c.beforeRating,
        afterRating: c.afterRating,
        delta: c.delta,
      });
    }
    opsLog("elo.undo.commit", {
      guildId,
      undoSnipeId,
      undoesSnipeId: args.snipeIdToUndo,
      channelId: args.channelId,
      threadTs: args.threadTs,
      playerCount: undoPlayerChanges.length,
    });
    return { undoSnipeId, playerChanges: undoPlayerChanges };
  }
}
