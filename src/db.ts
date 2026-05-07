import Database from "better-sqlite3";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { calendarDateKeyInTimeZone } from "./bounty";
import { bountyEnv } from "./bountyEnv";
import type { FlatCsvTableSection } from "./flatCsvExportParse";
import { looksLikeAdminDatabaseFlatCsv, parseFlatCsvExportSections } from "./flatCsvExportParse";
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
  /** True when this pair was skipped because of snipe cooldown (no ELO / no bounty on this pair). */
  pairCooldownSkip?: boolean;
};

export type PlayerChange = {
  playerId: string;
  beforeRating: number;
  afterRating: number;
  delta: number;
};

/** Count of snipe/makeup pair rows still on the books (parent event not undone). */
export type DirectedSnipePairCount = {
  sniperId: string;
  snipedId: string;
  count: number;
};

/** Slack snipe duel: pending → active → settled (or declined). */
export type SnipeDuelRow = {
  duelId: string;
  guildId: string;
  channelId: string;
  rootMessageTs: string;
  challengerId: string;
  targetId: string;
  betPoints: number;
  durationMs: number;
  status: "pending" | "active" | "declined" | "settled";
  acceptedAt: number | null;
  endsAt: number | null;
  settledAt: number | null;
  winnerId: string | null;
  createdAt: number;
};

function mapSnipeDuelRow(row: Record<string, unknown>): SnipeDuelRow {
  return {
    duelId: row.duel_id as string,
    guildId: row.guild_id as string,
    channelId: row.channel_id as string,
    rootMessageTs: row.root_message_ts as string,
    challengerId: row.challenger_id as string,
    targetId: row.target_id as string,
    betPoints: row.bet_points as number,
    durationMs: row.duration_ms as number,
    status: row.status as SnipeDuelRow["status"],
    acceptedAt: (row.accepted_at as number | null) ?? null,
    endsAt: (row.ends_at as number | null) ?? null,
    settledAt: (row.settled_at as number | null) ?? null,
    winnerId: (row.winner_id as string | null) ?? null,
    createdAt: row.created_at as number,
  };
}

export type SlackPollRow = {
  pollId: string;
  guildId: string;
  channelId: string;
  rootMessageTs: string;
  createdBy: string;
  title: string;
  options: string[];
  createdAt: number;
  endsAt: number | null;
};

function mapSlackPollRow(row: Record<string, unknown>): SlackPollRow {
  let options: string[] = [];
  try {
    const j = JSON.parse(row.options_json as string) as unknown;
    if (Array.isArray(j)) options = j.filter((x): x is string => typeof x === "string");
  } catch {
    options = [];
  }
  return {
    pollId: row.poll_id as string,
    guildId: row.guild_id as string,
    channelId: row.channel_id as string,
    rootMessageTs: row.root_message_ts as string,
    createdBy: row.created_by as string,
    title: row.title as string,
    options,
    createdAt: row.created_at as number,
    endsAt: (row.ends_at as number | null) ?? null,
  };
}

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

/** One pair row: this user was `snipedId` (target); parent event metadata for display. */
export type SnipeReceivedRow = {
  snipeId: string;
  sniperId: string;
  snipedId: string;
  type: string;
  createdAt: number;
  undoneAt: number | null;
};

function newId(): string {
  return crypto.randomUUID();
}

/** One row in a frozen end-of-cycle leaderboard snapshot (Discord user ids + display names at archive time). */
export type HallOfFameSnapshotRow = {
  rank: number;
  playerId: string;
  displayName: string;
  rating: number;
};

export type HallOfFameCycle = {
  cycleId: string;
  guildId: string;
  title: string;
  subtitle: string | null;
  closedAt: number;
  rewardsText: string | null;
  snapshot: HallOfFameSnapshotRow[];
  createdAt: number;
};

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

function adminCsvEscapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "bigint") return String(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Buffer) {
    const b64 = value.toString("base64");
    return `"${b64.replace(/"/g, '""')}"`;
  }
  const s = String(value);
  if (/[\r\n",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export class EloDb {
  private db: Database.Database;
  private readonly tenantIdForLegacyMigration: string;
  private readonly isMemoryDb: boolean;
  private closed = false;

  constructor(dbPath: string, opts?: EloDbOptions) {
    this.tenantIdForLegacyMigration = opts?.tenantIdForLegacyMigration ?? SLACK_GUILD_ID;
    this.isMemoryDb = !dbPath || dbPath === ":memory:";
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

      CREATE TABLE IF NOT EXISTS snipe_duels(
        duel_id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        root_message_ts TEXT NOT NULL,
        challenger_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        bet_points INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        status TEXT NOT NULL,
        accepted_at INTEGER,
        ends_at INTEGER,
        settled_at INTEGER,
        winner_id TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_snipe_duels_guild_status_ends ON snipe_duels(guild_id, status, ends_at);
      CREATE INDEX IF NOT EXISTS idx_snipe_duels_root ON snipe_duels(guild_id, root_message_ts);

      /* Bounty state lives in this file with the rest of ELO; keep DB_PATH / DISCORD_DB_PATH on a persistent volume across deploys. */
      CREATE TABLE IF NOT EXISTS daily_bounty_targets(
        guild_id TEXT NOT NULL,
        bounty_date TEXT NOT NULL,
        target_ids_json TEXT NOT NULL,
        announced_at INTEGER NOT NULL,
        PRIMARY KEY(guild_id, bounty_date)
      );

      CREATE TABLE IF NOT EXISTS bounty_first_snipes(
        guild_id TEXT NOT NULL,
        bounty_date TEXT NOT NULL,
        bounty_target_id TEXT NOT NULL,
        sniper_id TEXT NOT NULL,
        snipe_id TEXT NOT NULL,
        PRIMARY KEY(guild_id, bounty_date, bounty_target_id)
      );
      CREATE INDEX IF NOT EXISTS idx_bounty_first_snipes_snipe ON bounty_first_snipes(snipe_id);

      CREATE TABLE IF NOT EXISTS graph_passcodes(
        code TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_graph_passcodes_expires ON graph_passcodes(expires_at);

      CREATE TABLE IF NOT EXISTS graph_sessions(
        token TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_graph_sessions_expires ON graph_sessions(expires_at);

      CREATE TABLE IF NOT EXISTS polls(
        poll_id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        root_message_ts TEXT NOT NULL,
        created_by TEXT NOT NULL,
        title TEXT NOT NULL,
        options_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        ends_at INTEGER,
        UNIQUE(guild_id, channel_id, root_message_ts)
      );
      CREATE INDEX IF NOT EXISTS idx_polls_guild_channel ON polls(guild_id, channel_id);

      CREATE TABLE IF NOT EXISTS poll_votes(
        poll_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        option_idx INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(poll_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);

      CREATE TABLE IF NOT EXISTS hall_of_fame_cycles(
        cycle_id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        title TEXT NOT NULL,
        subtitle TEXT,
        closed_at INTEGER NOT NULL,
        rewards_text TEXT,
        snapshot_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_hof_guild_closed ON hall_of_fame_cycles(guild_id, closed_at DESC);
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

  /** Remove a guild meta key if present (e.g. clear manual bounty lock). */
  deleteMeta(guildId: string, key: string): void {
    const r = this.db.prepare(`DELETE FROM kv WHERE key = ?`).run(this.metaKey(guildId, key));
    if (r.changes > 0) this.checkpoint();
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

  listGuildIdsWithPlayerRows(): string[] {
    const rows = this.db.prepare(`SELECT DISTINCT guild_id FROM players`).all() as { guild_id: string }[];
    return rows.map((r) => r.guild_id);
  }

  getDailyBountyTargets(guildId: string, bountyDate: string): string[] {
    const row = this.getDailyBountyAnnouncementRow(guildId, bountyDate);
    return row?.targetIds ?? [];
  }

  /** Row for that calendar day, or null if the bot has not stored a list yet. */
  getDailyBountyAnnouncementRow(
    guildId: string,
    bountyDate: string
  ): { targetIds: string[]; announcedAt: number } | null {
    const row = this.db
      .prepare(
        `SELECT target_ids_json, announced_at FROM daily_bounty_targets WHERE guild_id = ? AND bounty_date = ?`
      )
      .get(guildId, bountyDate) as { target_ids_json: string; announced_at: number } | undefined;
    if (!row) return null;
    let targetIds: string[] = [];
    try {
      const j = JSON.parse(row.target_ids_json) as unknown;
      if (Array.isArray(j)) targetIds = j.filter((x): x is string => typeof x === "string");
    } catch {
      targetIds = [];
    }
    return { targetIds, announcedAt: row.announced_at };
  }

  /** Bounty marks that have already had their first qualifying snipe today. */
  listBountyClaimedTargetsForDate(guildId: string, bountyDate: string): string[] {
    const rows = this.db
      .prepare(`SELECT bounty_target_id FROM bounty_first_snipes WHERE guild_id = ? AND bounty_date = ?`)
      .all(guildId, bountyDate) as { bounty_target_id: string }[];
    return rows.map((r) => r.bounty_target_id);
  }

  /** First qualifying snipe per mark today (who landed it + snipe row id). */
  getBountyFirstSnipesForDate(
    guildId: string,
    bountyDate: string
  ): { bountyTargetId: string; sniperId: string; snipeId: string }[] {
    const rows = this.db
      .prepare(
        `SELECT bounty_target_id, sniper_id, snipe_id FROM bounty_first_snipes WHERE guild_id = ? AND bounty_date = ?`
      )
      .all(guildId, bountyDate) as { bounty_target_id: string; sniper_id: string; snipe_id: string }[];
    return rows.map((r) => ({
      bountyTargetId: r.bounty_target_id,
      sniperId: r.sniper_id,
      snipeId: r.snipe_id,
    }));
  }

  upsertDailyBountyTargets(guildId: string, bountyDate: string, targetIds: string[], announcedAt: number): void {
    this.db
      .prepare(
        `INSERT INTO daily_bounty_targets(guild_id, bounty_date, target_ids_json, announced_at)
         VALUES(?,?,?,?)
         ON CONFLICT(guild_id, bounty_date) DO UPDATE SET
           target_ids_json = excluded.target_ids_json,
           announced_at = excluded.announced_at`
      )
      .run(guildId, bountyDate, JSON.stringify(targetIds), announcedAt);
    this.checkpoint();
  }

  /** Remove today's first-snipe claim for one mark (reopens 2×). Returns whether a row existed. */
  deleteBountyFirstSnipeClaim(args: { guildId: string; bountyDate: string; bountyTargetId: string }): boolean {
    const r = this.db
      .prepare(
        `DELETE FROM bounty_first_snipes WHERE guild_id = ? AND bounty_date = ? AND bounty_target_id = ?`
      )
      .run(args.guildId, args.bountyDate, args.bountyTargetId);
    if (r.changes > 0) this.checkpoint();
    return r.changes > 0;
  }

  /** Remove all first-snipe claims for a calendar day. Returns rows deleted. */
  clearBountyFirstSnipeClaimsForDate(guildId: string, bountyDate: string): number {
    const r = this.db
      .prepare(`DELETE FROM bounty_first_snipes WHERE guild_id = ? AND bounty_date = ?`)
      .run(guildId, bountyDate);
    if (r.changes > 0) this.checkpoint();
    return Number(r.changes);
  }

  /**
   * Insert or replace a manual first-snipe row (synthetic snipe_id; not removed by normal snipe undo).
   */
  upsertManualBountyFirstSnipe(args: {
    guildId: string;
    bountyDate: string;
    bountyTargetId: string;
    sniperId: string;
  }): void {
    const snipeId = `manual-adjustbounty:${newId()}`;
    this.db
      .prepare(
        `INSERT INTO bounty_first_snipes(guild_id, bounty_date, bounty_target_id, sniper_id, snipe_id)
         VALUES(?,?,?,?,?)
         ON CONFLICT(guild_id, bounty_date, bounty_target_id) DO UPDATE SET
           sniper_id = excluded.sniper_id,
           snipe_id = excluded.snipe_id`
      )
      .run(args.guildId, args.bountyDate, args.bountyTargetId, args.sniperId, snipeId);
    this.checkpoint();
  }

  /** Removes rating rows (e.g. bots). Does not delete snipe history. */
  deletePlayersForGuild(guildId: string, playerIds: string[]): number {
    if (playerIds.length === 0) return 0;
    const placeholders = playerIds.map(() => "?").join(",");
    const r = this.db
      .prepare(`DELETE FROM players WHERE guild_id = ? AND player_id IN (${placeholders})`)
      .run(guildId, ...playerIds);
    return Number(r.changes);
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
    bountyFirstPairIndices: number[];
    pairCooldownPairIndices: number[];
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
    const snipedIdsJson = JSON.stringify(snipedIds);
    const bountyDateKey = calendarDateKeyInTimeZone(now, bountyEnv.timezone);

    const tx = this.db.transaction(() => {
      const row = this.db
        .prepare(`SELECT target_ids_json FROM daily_bounty_targets WHERE guild_id = ? AND bounty_date = ?`)
        .get(guildId, bountyDateKey) as { target_ids_json: string } | undefined;
      let bountyTargets: string[] = [];
      if (bountyEnv.enabled && row?.target_ids_json) {
        try {
          const j = JSON.parse(row.target_ids_json) as unknown;
          if (Array.isArray(j)) bountyTargets = j.filter((x): x is string => typeof x === "string");
        } catch {
          bountyTargets = [];
        }
      }
      const bountyTargetSet = new Set(bountyTargets);
      const claimStmt = this.db.prepare(
        `SELECT 1 FROM bounty_first_snipes WHERE guild_id = ? AND bounty_date = ? AND bounty_target_id = ?`
      );
      const insertClaim = this.db.prepare(
        `INSERT INTO bounty_first_snipes(guild_id, bounty_date, bounty_target_id, sniper_id, snipe_id)
         VALUES(?,?,?,?,?)`
      );

      const cooldownMs =
        eloEnv.snipePairCooldownMinutes > 0 ? eloEnv.snipePairCooldownMinutes * 60 * 1000 : 0;
      /** Latest scoring exchange between this unordered pair (either direction; non-undone; sniper_delta != 0). */
      const lastPairScoringAt = this.db.prepare(
        `SELECT MAX(se.created_at) AS last_at
         FROM event_pair_matches epm
         INNER JOIN snipe_events se ON se.snipe_id = epm.snipe_id
         WHERE se.guild_id = ?
           AND se.undone_at IS NULL
           AND se.type IN ('snipe', 'makeup')
           AND epm.sniper_delta != 0
           AND (
             (epm.sniper_id = ? AND epm.sniped_id = ?)
             OR (epm.sniper_id = ? AND epm.sniped_id = ?)
           )`
      );

      const currentRatings = new Map(startRatings);
      const pairMatches: PairMatch[] = [];
      const bountyFirstPairIndices: number[] = [];
      const pairCooldownPairIndices: number[] = [];

      for (let i = 0; i < snipedIds.length; i++) {
        const snipedId = snipedIds[i];
        const sniperBefore = currentRatings.get(sniperId)!;
        const snipedBefore = currentRatings.get(snipedId)!;

        let cooldownSkip = false;
        let lastAtPair: number | null = null;
        if (cooldownMs > 0) {
          const rowP = lastPairScoringAt.get(guildId, sniperId, snipedId, snipedId, sniperId) as
            | { last_at: number | null }
            | undefined;
          lastAtPair = rowP?.last_at ?? null;
          cooldownSkip = lastAtPair != null && now - lastAtPair < cooldownMs;
        }

        if (cooldownSkip) {
          pairMatches.push({
            pairIdx: i,
            sniperId,
            snipedId,
            sniperBefore,
            sniperAfter: sniperBefore,
            snipedBefore,
            snipedAfter: snipedBefore,
            sniperDelta: 0,
            pairCooldownSkip: true,
          });
          pairCooldownPairIndices.push(i);
          opsLog("elo.snipe_cooldown_skip", {
            guildId,
            snipeId,
            sniperId,
            snipedId,
            pairIdx: i,
            msSincePairLastScoring: lastAtPair != null ? now - lastAtPair : undefined,
          });
          continue;
        }

        const { sniperDelta: baseTransfer } = computePairRatingDeltas({
          sniperRating: sniperBefore,
          snipedRating: snipedBefore,
        });

        // Daily bounty: 2× transfer only when the *sniped* player is a listed mark and this is their
        // first time sniped that calendar day. A mark who *snipes* others uses normal ELO (sniperId is ignored here).
        const snipedIsBountyMark = bountyTargetSet.has(snipedId);
        const bountyClaimStillOpen =
          snipedIsBountyMark && !claimStmt.get(guildId, bountyDateKey, snipedId);
        let mult = 1;
        if (bountyEnv.enabled && bountyClaimStillOpen) {
          mult = 2;
        }
        const transferMag = baseTransfer * mult;

        const sniperAfter = sniperBefore + transferMag;
        const snipedAfter = snipedBefore - transferMag;
        const sniperDelta = sniperAfter - sniperBefore;

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
        if (mult === 2) {
          bountyFirstPairIndices.push(i);
          insertClaim.run(guildId, bountyDateKey, snipedId, sniperId, snipeId);
        }
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

      return { pairMatches, playerChanges, currentRatings, bountyFirstPairIndices, pairCooldownPairIndices };
    });

    const { pairMatches, playerChanges, currentRatings, bountyFirstPairIndices, pairCooldownPairIndices } =
      tx();
    if (bountyFirstPairIndices.length > 0) {
      this.checkpoint();
    }

    for (const c of playerChanges) {
      if (c.delta === 0) continue;
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
    for (const idx of bountyFirstPairIndices) {
      const snipedId = snipedIds[idx];
      opsLog("bounty.first_snipe", {
        guildId,
        snipeId,
        bountyDate: bountyDateKey,
        bountyTargetId: snipedId,
        sniperId,
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
      bountyPairs: bountyFirstPairIndices.length,
      snipeCooldownPairs: pairCooldownPairIndices.length,
    });

    return {
      snipeId,
      pairMatches,
      playerChanges,
      finalRatings: currentRatings,
      bountyFirstPairIndices,
      pairCooldownPairIndices,
    };
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

  /** Latest snipe/makeup events where this user was the sniper (includes later-undone rows). */
  getRecentSnipesForSniper(guildId: string, sniperId: string, limit: number): SnipeEventRow[] {
    const cap = Math.min(Math.max(1, limit), 50);
    const rows = this.db
      .prepare(
        `
      SELECT *
      FROM snipe_events
      WHERE guild_id = ?
        AND sniper_id = ?
        AND type IN ('snipe', 'makeup')
      ORDER BY created_at DESC
      LIMIT ?
    `
      )
      .all(guildId, sniperId, cap) as Record<string, unknown>[];
    return rows.map(mapSnipeRow);
  }

  /**
   * Latest pair rows where this user was sniped (one row per shooter→target pair in an event).
   * Includes events later undone (same as sniper log).
   */
  getRecentSnipesAsSniped(guildId: string, snipedId: string, limit: number): SnipeReceivedRow[] {
    const cap = Math.min(Math.max(1, limit), 50);
    const rows = this.db
      .prepare(
        `
      SELECT se.snipe_id AS snipe_id,
             epm.sniper_id AS sniper_id,
             epm.sniped_id AS sniped_id,
             se.type AS type,
             se.created_at AS created_at,
             se.undone_at AS undone_at
      FROM event_pair_matches epm
      INNER JOIN snipe_events se ON se.snipe_id = epm.snipe_id
      WHERE se.guild_id = ?
        AND epm.sniped_id = ?
        AND se.type IN ('snipe', 'makeup')
      ORDER BY se.created_at DESC
      LIMIT ?
    `
      )
      .all(guildId, snipedId, cap) as {
      snipe_id: string;
      sniper_id: string;
      sniped_id: string;
      type: string;
      created_at: number;
      undone_at: number | null;
    }[];
    return rows.map((r) => ({
      snipeId: r.snipe_id,
      sniperId: r.sniper_id,
      snipedId: r.sniped_id,
      type: r.type,
      createdAt: r.created_at,
      undoneAt: r.undone_at,
    }));
  }

  /**
   * Per ordered pair (sniper → sniped), how many pair rows exist in events that still count
   * (snipe/makeup, not undone). Used for head-to-head.
   */
  getDirectedSnipePairCounts(guildId: string): DirectedSnipePairCount[] {
    const rows = this.db
      .prepare(
        `
      SELECT epm.sniper_id AS sniper_id, epm.sniped_id AS sniped_id, COUNT(*) AS c
      FROM event_pair_matches epm
      INNER JOIN snipe_events se ON se.snipe_id = epm.snipe_id
      WHERE se.guild_id = ?
        AND se.type IN ('snipe', 'makeup')
        AND se.undone_at IS NULL
      GROUP BY epm.sniper_id, epm.sniped_id
    `
      )
      .all(guildId) as { sniper_id: string; sniped_id: string; c: number }[];
    return rows.map((r) => ({
      sniperId: r.sniper_id,
      snipedId: r.sniped_id,
      count: r.c,
    }));
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

      this.db.prepare(`DELETE FROM bounty_first_snipes WHERE snipe_id = ?`).run(args.snipeIdToUndo);

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
    this.checkpoint();

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

  insertSnipeDuel(args: {
    guildId: string;
    channelId: string;
    rootMessageTs: string;
    challengerId: string;
    targetId: string;
    betPoints: number;
    durationMs: number;
  }): string {
    const duelId = newId();
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO snipe_duels(
          duel_id, guild_id, channel_id, root_message_ts,
          challenger_id, target_id, bet_points, duration_ms,
          status, accepted_at, ends_at, settled_at, winner_id, created_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        duelId,
        args.guildId,
        args.channelId,
        args.rootMessageTs,
        args.challengerId,
        args.targetId,
        args.betPoints,
        args.durationMs,
        "pending",
        null,
        null,
        null,
        null,
        now
      );
    return duelId;
  }

  getSnipeDuelByRootMessageTs(guildId: string, rootMessageTs: string): SnipeDuelRow | null {
    const row = this.db
      .prepare(`SELECT * FROM snipe_duels WHERE guild_id = ? AND root_message_ts = ?`)
      .get(guildId, rootMessageTs) as Record<string, unknown> | undefined;
    if (!row) return null;
    return mapSnipeDuelRow(row);
  }

  getActiveDuelForPair(guildId: string, userA: string, userB: string, nowMs: number): SnipeDuelRow | null {
    const row = this.db
      .prepare(
        `SELECT * FROM snipe_duels
         WHERE guild_id = ?
           AND status = 'active'
           AND ends_at IS NOT NULL
           AND ends_at > ?
           AND (
             (challenger_id = ? AND target_id = ?)
             OR (challenger_id = ? AND target_id = ?)
           )
         LIMIT 1`
      )
      .get(guildId, nowMs, userA, userB, userB, userA) as Record<string, unknown> | undefined;
    if (!row) return null;
    return mapSnipeDuelRow(row);
  }

  listSnipeDuelsDueForSettlement(guildId: string, nowMs: number): SnipeDuelRow[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM snipe_duels
         WHERE guild_id = ?
           AND status = 'active'
           AND ends_at IS NOT NULL
           AND ends_at <= ?
         ORDER BY ends_at ASC`
      )
      .all(guildId, nowMs) as Record<string, unknown>[];
    return rows.map(mapSnipeDuelRow);
  }

  /** All guilds (e.g. Discord snowflakes); excludes nothing—callers filter Slack vs Discord. */
  listAllSnipeDuelsDueForSettlement(nowMs: number): SnipeDuelRow[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM snipe_duels
         WHERE status = 'active'
           AND ends_at IS NOT NULL
           AND ends_at <= ?
         ORDER BY ends_at ASC`
      )
      .all(nowMs) as Record<string, unknown>[];
    return rows.map(mapSnipeDuelRow);
  }

  acceptSnipeDuel(duelId: string, guildId: string, acceptedAt: number, endsAt: number): void {
    const r = this.db
      .prepare(
        `UPDATE snipe_duels SET status = 'active', accepted_at = ?, ends_at = ?
         WHERE duel_id = ? AND guild_id = ? AND status = 'pending'`
      )
      .run(acceptedAt, endsAt, duelId, guildId);
    if (r.changes === 0) throw new Error("duel_accept_failed");
  }

  declineSnipeDuel(duelId: string, guildId: string): void {
    const r = this.db
      .prepare(`UPDATE snipe_duels SET status = 'declined' WHERE duel_id = ? AND guild_id = ? AND status = 'pending'`)
      .run(duelId, guildId);
    if (r.changes === 0) throw new Error("duel_decline_failed");
  }

  settleSnipeDuel(duelId: string, guildId: string, winnerId: string | null, settledAt: number): void {
    const r = this.db
      .prepare(
        `UPDATE snipe_duels SET status = 'settled', settled_at = ?, winner_id = ?
         WHERE duel_id = ? AND guild_id = ? AND status = 'active'`
      )
      .run(settledAt, winnerId, duelId, guildId);
    if (r.changes === 0) throw new Error("duel_settle_failed");
  }

  /**
   * Counts pair rows (sniper → sniped) in snipe/makeup events that are still on the books,
   * with event created in [sinceMs, untilMs] inclusive.
   */
  countDirectedSnipesInWindow(
    guildId: string,
    sniperId: string,
    snipedId: string,
    sinceMs: number,
    untilMs: number
  ): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS c
         FROM event_pair_matches epm
         INNER JOIN snipe_events se ON se.snipe_id = epm.snipe_id
         WHERE se.guild_id = ?
           AND se.type IN ('snipe', 'makeup')
           AND se.undone_at IS NULL
           AND epm.sniper_id = ?
           AND epm.sniped_id = ?
           AND se.created_at >= ?
           AND se.created_at <= ?`
      )
      .get(guildId, sniperId, snipedId, sinceMs, untilMs) as { c: number } | undefined;
    return row?.c ?? 0;
  }

  insertPoll(args: {
    pollId: string;
    guildId: string;
    channelId: string;
    rootMessageTs: string;
    createdBy: string;
    title: string;
    options: string[];
    createdAt: number;
    endsAt: number | null;
  }): void {
    this.db
      .prepare(
        `INSERT INTO polls(
          poll_id, guild_id, channel_id, root_message_ts, created_by, title, options_json, created_at, ends_at
        ) VALUES(?,?,?,?,?,?,?,?,?)`
      )
      .run(
        args.pollId,
        args.guildId,
        args.channelId,
        args.rootMessageTs,
        args.createdBy,
        args.title,
        JSON.stringify(args.options),
        args.createdAt,
        args.endsAt
      );
    this.checkpoint();
  }

  /** Active poll whose root message is the thread parent (Slack `thread_ts` for replies). */
  getActivePollByRootMessage(guildId: string, channelId: string, rootMessageTs: string, nowMs: number): SlackPollRow | null {
    const row = this.db
      .prepare(
        `SELECT * FROM polls
         WHERE guild_id = ? AND channel_id = ? AND root_message_ts = ?
           AND (ends_at IS NULL OR ends_at > ?)`
      )
      .get(guildId, channelId, rootMessageTs, nowMs) as Record<string, unknown> | undefined;
    if (!row) return null;
    return mapSlackPollRow(row);
  }

  /** Oldest-first numbering for `/poll list` and `/poll check N`. */
  listActivePollsInChannel(guildId: string, channelId: string, nowMs: number): SlackPollRow[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM polls
         WHERE guild_id = ? AND channel_id = ?
           AND (ends_at IS NULL OR ends_at > ?)
         ORDER BY created_at ASC`
      )
      .all(guildId, channelId, nowMs) as Record<string, unknown>[];
    return rows.map(mapSlackPollRow);
  }

  upsertPollVote(pollId: string, userId: string, optionIdx: number, updatedAt: number): void {
    this.db
      .prepare(
        `INSERT INTO poll_votes(poll_id, user_id, option_idx, updated_at) VALUES(?,?,?,?)
         ON CONFLICT(poll_id, user_id) DO UPDATE SET option_idx = excluded.option_idx, updated_at = excluded.updated_at`
      )
      .run(pollId, userId, optionIdx, updatedAt);
    this.checkpoint();
  }

  private mapHallOfFameRow(row: Record<string, unknown>): HallOfFameCycle {
    let snapshot: HallOfFameSnapshotRow[] = [];
    try {
      const j = JSON.parse(row.snapshot_json as string) as unknown;
      if (Array.isArray(j)) {
        snapshot = j
          .map((x) => {
            if (!x || typeof x !== "object") return null;
            const o = x as Record<string, unknown>;
            const rank = Number(o.rank);
            const rating = Number(o.rating);
            if (!Number.isFinite(rank) || !Number.isFinite(rating)) return null;
            const playerId = typeof o.playerId === "string" ? o.playerId : "";
            const displayName = typeof o.displayName === "string" ? o.displayName : playerId;
            return { rank, playerId, displayName, rating };
          })
          .filter((x): x is HallOfFameSnapshotRow => x !== null);
      }
    } catch {
      snapshot = [];
    }
    return {
      cycleId: row.cycle_id as string,
      guildId: row.guild_id as string,
      title: row.title as string,
      subtitle: (row.subtitle as string | null) ?? null,
      closedAt: row.closed_at as number,
      rewardsText: (row.rewards_text as string | null) ?? null,
      snapshot,
      createdAt: row.created_at as number,
    };
  }

  /** Append a permanent cycle record (e.g. before an ELO reset). */
  insertHallOfFameCycle(args: {
    guildId: string;
    title: string;
    subtitle?: string | null;
    closedAt?: number;
    rewardsText?: string | null;
    snapshot: HallOfFameSnapshotRow[];
  }): { cycleId: string } {
    const cycleId = newId();
    const now = Date.now();
    const closedAt = args.closedAt ?? now;
    const subtitle = args.subtitle ?? null;
    const rewardsText = args.rewardsText ?? null;
    const snapshotJson = JSON.stringify(args.snapshot);
    this.db
      .prepare(
        `INSERT INTO hall_of_fame_cycles(cycle_id, guild_id, title, subtitle, closed_at, rewards_text, snapshot_json, created_at)
         VALUES(?,?,?,?,?,?,?,?)`
      )
      .run(
        cycleId,
        args.guildId,
        args.title,
        subtitle,
        closedAt,
        rewardsText,
        snapshotJson,
        now
      );
    this.checkpoint();
    return { cycleId };
  }

  listHallOfFameCycles(guildId: string): HallOfFameCycle[] {
    const rows = this.db
      .prepare(
        `SELECT cycle_id, guild_id, title, subtitle, closed_at, rewards_text, snapshot_json, created_at
         FROM hall_of_fame_cycles WHERE guild_id = ? ORDER BY closed_at DESC, created_at DESC`
      )
      .all(guildId) as Record<string, unknown>[];
    return rows.map((r) => this.mapHallOfFameRow(r));
  }

  getHallOfFameCycle(guildId: string, cycleId: string): HallOfFameCycle | null {
    const row = this.db
      .prepare(
        `SELECT cycle_id, guild_id, title, subtitle, closed_at, rewards_text, snapshot_json, created_at
         FROM hall_of_fame_cycles WHERE guild_id = ? AND cycle_id = ?`
      )
      .get(guildId, cycleId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapHallOfFameRow(row);
  }

  /**
   * Removes the newest cycle for `guildId` (by `closed_at`, then `created_at`).
   * Does not restore live ratings; use only to drop a mistaken archive row.
   */
  deleteLatestHallOfFameCycle(guildId: string): { deleted: boolean; cycleId?: string; title?: string } {
    const row = this.db
      .prepare(
        `SELECT cycle_id, title FROM hall_of_fame_cycles WHERE guild_id = ?
         ORDER BY closed_at DESC, created_at DESC LIMIT 1`
      )
      .get(guildId) as { cycle_id: string; title: string } | undefined;
    if (!row) return { deleted: false };
    this.db
      .prepare(`DELETE FROM hall_of_fame_cycles WHERE guild_id = ? AND cycle_id = ?`)
      .run(guildId, row.cycle_id);
    this.checkpoint();
    opsLog("hof.deleted_latest", { guildId, cycleId: row.cycle_id });
    return { deleted: true, cycleId: row.cycle_id, title: row.title };
  }

  purgeExpiredGraphRows(): void {
    const now = Date.now();
    this.db.prepare(`DELETE FROM graph_passcodes WHERE expires_at < ?`).run(now);
    this.db.prepare(`DELETE FROM graph_sessions WHERE expires_at < ?`).run(now);
  }

  /** One-time view code for the snipe graph website; valid ~60s until redeem. */
  issueGraphPasscode(guildId: string): { code: string; expiresAtMs: number } {
    this.purgeExpiredGraphRows();
    for (let i = 0; i < 8; i++) {
      const code = crypto.randomBytes(4).toString("hex").toUpperCase();
      const expiresAtMs = Date.now() + 60_000;
      try {
        this.db
          .prepare(`INSERT INTO graph_passcodes(code, guild_id, expires_at) VALUES(?,?,?)`)
          .run(code, guildId, expiresAtMs);
        this.checkpoint();
        return { code, expiresAtMs };
      } catch {
        /* rare code collision */
      }
    }
    throw new Error("graph_passcode_issue_failed");
  }

  /**
   * Consumes a passcode (if still valid) and returns a longer-lived session token for API access.
   * Passcode must be redeemed within its original 60s window.
   */
  redeemGraphPasscode(code: string): { token: string; guildId: string; sessionExpiresAtMs: number } | null {
    this.purgeExpiredGraphRows();
    const normalized = code.trim().replace(/\s+/g, "").toUpperCase();
    const row = this.db
      .prepare(`SELECT guild_id, expires_at FROM graph_passcodes WHERE code = ?`)
      .get(normalized) as { guild_id: string; expires_at: number } | undefined;
    if (!row || row.expires_at < Date.now()) return null;
    this.db.prepare(`DELETE FROM graph_passcodes WHERE code = ?`).run(normalized);
    const sessionMs = Math.max(60_000, Number(process.env.GRAPH_VIEW_SESSION_MS ?? 45 * 60 * 1000));
    const sessionExpiresAtMs = Date.now() + sessionMs;
    const token = crypto.randomBytes(32).toString("hex");
    this.db
      .prepare(`INSERT INTO graph_sessions(token, guild_id, expires_at) VALUES(?,?,?)`)
      .run(token, row.guild_id, sessionExpiresAtMs);
    this.checkpoint();
    return { token, guildId: row.guild_id, sessionExpiresAtMs };
  }

  /** Guild id for an active graph viewer session, or null. */
  validateGraphSession(token: string): string | null {
    if (!token) return null;
    this.purgeExpiredGraphRows();
    const row = this.db
      .prepare(`SELECT guild_id, expires_at FROM graph_sessions WHERE token = ?`)
      .get(token) as { guild_id: string; expires_at: number } | undefined;
    if (!row) return null;
    if (row.expires_at < Date.now()) {
      this.db.prepare(`DELETE FROM graph_sessions WHERE token = ?`).run(token);
      return null;
    }
    return row.guild_id;
  }

  /**
   * Single UTF-8 CSV: one section per non-internal SQLite table. Each section starts with
   * `# TABLE:tablename`, then a header row, then RFC 4180 data rows (for admin download only).
   */
  /**
   * Wipe snipe / duel / bounty / graph-session state and reset every player rating to `INITIAL_RATING`.
   * Preserves `kv`, `hall_of_fame_cycles`, `polls`, and `poll_votes`.
   */
  adminResetSeasonPreserveMeta(): void {
    const now = Date.now();
    const r0 = eloEnv.initialRating;
    this.db.transaction(() => {
      this.db.prepare(`DELETE FROM bounty_first_snipes`).run();
      this.db.prepare(`DELETE FROM daily_bounty_targets`).run();
      this.db.prepare(`DELETE FROM event_pair_matches`).run();
      this.db.prepare(`DELETE FROM event_player_changes`).run();
      this.db.prepare(`DELETE FROM snipe_events`).run();
      this.db.prepare(`DELETE FROM snipe_duels`).run();
      this.db.prepare(`DELETE FROM graph_passcodes`).run();
      this.db.prepare(`DELETE FROM graph_sessions`).run();
      this.db.prepare(`UPDATE players SET rating = ?, updated_at = ?`).run(r0, now);
    })();
    this.checkpoint();
    opsLog("admin.reset_season", { initialRating: r0 });
  }

  /**
   * Replace DB contents with a flat CSV from `GET /api/admin/database.csv` (same `# TABLE:` sections).
   * Wipes all application tables then inserts from the file. Use only with backups.
   */
  adminReplaceDatabaseFromFlatExportCsv(csvText: string): void {
    if (!looksLikeAdminDatabaseFlatCsv(csvText)) {
      throw new Error("CSV does not look like an admin database export (expected # TABLE:…)");
    }
    const sections = parseFlatCsvExportSections(csvText);
    if (sections.size === 0) throw new Error("no # TABLE: sections in CSV");

    /** FK-safe insert order (only tables we ship in exports). */
    const tableOrder = [
      "kv",
      "players",
      "daily_bounty_targets",
      "hall_of_fame_cycles",
      "graph_passcodes",
      "graph_sessions",
      "polls",
      "poll_votes",
      "snipe_events",
      "event_player_changes",
      "event_pair_matches",
      "bounty_first_snipes",
      "snipe_duels",
    ] as const;
    const allowed = new Set<string>(tableOrder);

    for (const name of sections.keys()) {
      if (!allowed.has(name)) {
        throw new Error(`Unknown or unsupported table in CSV: ${name}`);
      }
    }

    const deleteOrder = [
      "bounty_first_snipes",
      "event_pair_matches",
      "event_player_changes",
      "snipe_events",
      "poll_votes",
      "polls",
      "snipe_duels",
      "daily_bounty_targets",
      "graph_passcodes",
      "graph_sessions",
      "hall_of_fame_cycles",
      "players",
      "kv",
    ];

    let inserted = 0;
    this.db.transaction(() => {
      this.db.pragma("foreign_keys = OFF");
      for (const t of deleteOrder) {
        this.db.prepare(`DELETE FROM "${t}"`).run();
      }
      for (const table of tableOrder) {
        const sec = sections.get(table);
        if (!sec) continue;
        this.insertTableFromFlatCsvSection(table, sec);
        inserted++;
      }
    })();
    this.checkpoint();
    opsLog("admin.database_import_csv", { tablesInserted: inserted });
  }

  private insertTableFromFlatCsvSection(table: string, sec: FlatCsvTableSection): void {
    const headers = sec.headers.map((h) => h.trim()).filter((h) => h.length > 0);
    if (headers.length === 0) return;
    for (const h of headers) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(h)) {
        throw new Error(`bad column name ${h} in table ${table}`);
      }
    }
    const colList = headers.map((c) => `"${c}"`).join(", ");
    const placeholders = headers.map(() => "?").join(", ");
    const stmt = this.db.prepare(
      `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`
    );
    for (const cells of sec.rows) {
      const values: (string | null)[] = headers.map((_, i) => {
        const v = cells[i];
        if (v === undefined || v === null || String(v).trim() === "") return null;
        return String(v);
      });
      stmt.run(...values);
    }
  }

  writeAdminDatabaseFlatCsv(write: (chunk: string) => void): void {
    this.checkpoint();
    const tableNames = this.db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT GLOB 'sqlite_*' ORDER BY name`
      )
      .pluck()
      .all() as string[];
    for (const table of tableNames) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) continue;
      write(`\n# TABLE:${table}\n`);
      const colRows = this.db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
      const colNames = colRows.map((c) => c.name);
      write(colNames.map(adminCsvEscapeCell).join(",") + "\n");
      const stmt = this.db.prepare(`SELECT * FROM "${table}"`);
      for (const row of stmt.iterate() as IterableIterator<Record<string, unknown>>) {
        write(colNames.map((c) => adminCsvEscapeCell(row[c])).join(",") + "\n");
      }
    }
  }

  /**
   * Merge WAL into the main database file (best-effort). Helps bounty/ELO survive restarts when the
   * host copies only the `.sqlite3` file, and pairs with close() on graceful shutdown.
   */
  checkpoint(): void {
    if (this.isMemoryDb || this.closed) return;
    try {
      this.db.pragma("wal_checkpoint(TRUNCATE)");
    } catch {
      /* ignore */
    }
  }

  /** WAL checkpoint then close. Idempotent. */
  close(): void {
    if (this.closed) return;
    this.checkpoint();
    try {
      this.db.close();
    } catch {
      /* ignore */
    }
    this.closed = true;
  }
}
