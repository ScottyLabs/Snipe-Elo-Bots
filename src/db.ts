import Database from "better-sqlite3";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { config } from "./config";
import { computePairRatingDeltas } from "./elo";

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

export class EloDb {
  private db: Database.Database;

  constructor(dbPath: string) {
    // better-sqlite3 does not create parent directories; Railway volume paths
    // like /data/snipe.sqlite fail if /data is missing until first mount step.
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
        player_id TEXT PRIMARY KEY,
        rating INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS snipe_events(
        snipe_id TEXT PRIMARY KEY,
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
  }

  getMeta(key: string): string | null {
    const row = this.db.prepare(`SELECT value FROM kv WHERE key = ?`).get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  setMeta(key: string, value: string) {
    const stmt = this.db.prepare(`INSERT INTO kv(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
    stmt.run(key, value);
  }

  ensurePlayers(playerIds: string[]) {
    const now = Date.now();
    const insert = this.db.prepare(
      `INSERT INTO players(player_id, rating, updated_at)
       SELECT ?, ?, ?
       WHERE NOT EXISTS(SELECT 1 FROM players WHERE player_id = ?)`
    );
    const seen = new Set<string>();
    for (const id of playerIds) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      insert.run(id, config.elo.initialRating, now, id);
    }
  }

  getRatings(playerIds: string[]): Map<string, number> {
    const ids = [...new Set(playerIds)].filter(Boolean);
    if (ids.length === 0) return new Map();
    const placeholders = ids.map(() => "?").join(",");
    const rows = this.db
      .prepare(`SELECT player_id, rating FROM players WHERE player_id IN (${placeholders})`)
      .all(...ids) as { player_id: string; rating: number }[];

    const map = new Map<string, number>();
    for (const r of rows) map.set(r.player_id, r.rating);
    return map;
  }

  getAllPlayersSorted(): PlayerRating[] {
    const rows = this.db
      .prepare(`SELECT player_id, rating FROM players ORDER BY rating DESC, player_id ASC`)
      .all() as { player_id: string; rating: number }[];
    return rows.map((r) => ({ playerId: r.player_id, rating: r.rating }));
  }

  setConfirmationMessageTs(snipeId: string, confirmationMessageTs: string) {
    this.db
      .prepare(`UPDATE snipe_events SET confirmation_message_ts = ? WHERE snipe_id = ?`)
      .run(confirmationMessageTs, snipeId);
  }

  applySnipe(args: {
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
    const now = Date.now();
    const snipeId = newId();
    const sniperId = args.sniperId;
    const snipedIds = [...new Set(args.snipedIds)].filter((x) => x !== sniperId);
    if (snipedIds.length === 0) {
      throw new Error("no_sniped_ids");
    }

    const involvedIds = [sniperId, ...snipedIds];
    this.ensurePlayers(involvedIds);

    const startRatings = this.getRatings(involvedIds);
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

    // Build per-player net changes for easy logging/undo.
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
          ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`
        )
        .run(
          snipeId,
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
        `UPDATE players SET rating = ?, updated_at = ? WHERE player_id = ?`
      );
      const insertPlayer = this.db.prepare(
        `INSERT INTO players(player_id, rating, updated_at) VALUES(?,?,?)`
      );

      for (const change of playerChanges) {
        const exists = this.db
          .prepare(`SELECT 1 FROM players WHERE player_id = ?`)
          .get(change.playerId);
        if (exists) updatePlayer.run(change.afterRating, now, change.playerId);
        else insertPlayer.run(change.playerId, change.afterRating, now);

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

    return { snipeId, pairMatches, playerChanges, finalRatings: currentRatings };
  }

  getLatestUndoableSnipeEventForThread(threadTs: string): SnipeEventRow | null {
    const row = this.db
      .prepare(
        `
      SELECT *
      FROM snipe_events
      WHERE thread_ts = ?
        AND type IN ('snipe','makeup')
        AND undone_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `
      )
      .get(threadTs) as any;
    if (!row) return null;
    return {
      snipeId: row.snipe_id,
      type: row.type,
      channelId: row.channel_id,
      threadTs: row.thread_ts,
      sourceMessageTs: row.source_message_ts ?? null,
      sniperId: row.sniper_id ?? null,
      snipedIdsJson: row.sniped_ids_json ?? null,
      undoneOfSnipeId: row.undone_of_snipe_id ?? null,
      undoneAt: row.undone_at ?? null,
      confirmationMessageTs: row.confirmation_message_ts ?? null,
      createdAt: row.created_at,
    };
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

  undoSnipeEvent(args: { channelId: string; threadTs: string; snipeIdToUndo: string }): {
    undoSnipeId: string;
    playerChanges: PlayerChange[];
  } {
    const original = this.db
      .prepare(`SELECT * FROM snipe_events WHERE snipe_id = ?`)
      .get(args.snipeIdToUndo) as any | undefined;
    if (!original) throw new Error("snipe_not_found");
    if (original.undone_at) throw new Error("snipe_already_undone");

    const now = Date.now();
    const undoSnipeId = newId();
    const playerChangesOriginal = this.getEventPlayerChanges(args.snipeIdToUndo);
    const involvedIds = playerChangesOriginal.map((c) => c.playerId);

    this.ensurePlayers(involvedIds);
    const currentRatings = this.getRatings(involvedIds);

    // Safety: only undo if the event's final state is still the current state.
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
      // Mark original as undone.
      this.db
        .prepare(`UPDATE snipe_events SET undone_at = ? WHERE snipe_id = ?`)
        .run(now, args.snipeIdToUndo);

      // Create an undo event row (also logged).
      this.db
        .prepare(
          `INSERT INTO snipe_events(
            snipe_id,
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
          ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`
        )
        .run(
          undoSnipeId,
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
        `UPDATE players SET rating = ?, updated_at = ? WHERE player_id = ?`
      );

      const undoPlayerChanges: PlayerChange[] = [];
      for (const orig of playerChangesOriginal) {
        const before = orig.afterRating;
        const after = orig.beforeRating;
        const delta = after - before;
        updatePlayer.run(after, now, orig.playerId);

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
    return { undoSnipeId, playerChanges: undoPlayerChanges };
  }
}

