import Database from "better-sqlite3";
import { mkdirSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Difficulty, LeaderboardEntry, PlayerProfile, RunResult, SaveState } from "./contracts.js";
import { defaultLevelId, defaultLevelTitle, defaultPilotName } from "./contracts.js";
import { hashPassword, verifyPassword, createSessionToken } from "./security.js";

export type ProfileAccountType = "guest" | "registered";
export type LevelState = {
  levelId: string;
  title: string;
  active: boolean;
  updatedAt: string;
};

type ProfileRow = {
  id: string;
  pilot_name: string;
  account_type: ProfileAccountType;
  email: string | null;
  password_hash: string | null;
  preferred_difficulty: Difficulty;
  best_score: number;
  best_time_seconds: number;
  created_at: string;
  updated_at: string;
};

type SessionRow = {
  token: string;
  profile_id: string;
  created_at: string;
  expires_at: string;
};

type ProgressRow = {
  profile_id: string;
  level_id: string;
  state_json: string;
  updated_at: string;
};

type RunRow = {
  id: string;
  profile_id: string;
  level_id: string;
  difficulty: Difficulty;
  score: number;
  elapsed_seconds: number;
  flares_used: number;
  robots_destroyed: number;
  secrets_found: number;
  escaped: 0 | 1;
  reactor_destroyed: 0 | 1;
  created_at: string;
};

type LevelStateRow = {
  level_id: string;
  title: string;
  active: 0 | 1;
  updated_at: string;
};

export class ApiDatabase {
  private readonly db: Database;

  constructor(filename: string) {
    mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new Database(filename);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
  }

  close(): void {
    this.db.close();
  }

  migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        pilot_name TEXT NOT NULL,
        account_type TEXT NOT NULL CHECK (account_type IN ('guest', 'registered')),
        email TEXT UNIQUE,
        password_hash TEXT,
        preferred_difficulty TEXT NOT NULL CHECK (preferred_difficulty IN ('easy', 'normal', 'hard')),
        best_score INTEGER NOT NULL DEFAULT 0,
        best_time_seconds REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS progress (
        profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        level_id TEXT NOT NULL,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (profile_id, level_id)
      );

      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        level_id TEXT NOT NULL,
        difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'normal', 'hard')),
        score INTEGER NOT NULL,
        elapsed_seconds REAL NOT NULL,
        flares_used INTEGER NOT NULL,
        robots_destroyed INTEGER NOT NULL,
        secrets_found INTEGER NOT NULL,
        escaped INTEGER NOT NULL,
        reactor_destroyed INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS level_state (
        level_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );
    `);
  }

  seed(): void {
    const now = new Date().toISOString();

    this.db.prepare(
      `INSERT INTO level_state (level_id, title, active, updated_at)
       VALUES (@levelId, @title, @active, @updatedAt)
       ON CONFLICT(level_id) DO UPDATE SET
         title = excluded.title,
         active = excluded.active,
         updated_at = excluded.updated_at`
    ).run({
      levelId: defaultLevelId,
      title: defaultLevelTitle,
      active: 1,
      updatedAt: now
    });

    const profileId = "seed-ace";
    const profileExists = this.db.prepare("SELECT 1 FROM profiles WHERE id = ?").get(profileId);
    if (!profileExists) {
      this.db.prepare(
        `INSERT INTO profiles (id, pilot_name, account_type, email, password_hash, preferred_difficulty, best_score, best_time_seconds, created_at, updated_at)
         VALUES (?, ?, 'registered', ?, ?, 'normal', ?, ?, ?, ?)`
      ).run(
        profileId,
        "ACE-7",
        "ace@foundry.test",
        hashPassword("password123"),
        48750,
        476.2,
        now,
        now
      );
    }

    const runExists = this.db.prepare("SELECT 1 FROM runs WHERE profile_id = ? AND level_id = ?").get(profileId, defaultLevelId);
    if (!runExists) {
      this.db.prepare(
        `INSERT INTO runs (id, profile_id, level_id, difficulty, score, elapsed_seconds, flares_used, robots_destroyed, secrets_found, escaped, reactor_destroyed, created_at)
         VALUES (?, ?, ?, 'normal', ?, ?, ?, ?, ?, 1, 1, ?)`
      ).run(randomUUID(), profileId, defaultLevelId, 48750, 476.2, 9, 41, 1, now);
    }
  }

  reset(): void {
    this.db.exec(`
      DELETE FROM sessions;
      DELETE FROM progress;
      DELETE FROM runs;
      DELETE FROM profiles;
      DELETE FROM level_state;
    `);
  }

  static resetFile(filename: string): void {
    if (existsSync(filename)) {
      rmSync(filename);
    }
  }

  createGuestProfile(pilotName = defaultPilotName): PlayerProfile {
    const now = new Date().toISOString();
    const id = `guest_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    this.db.prepare(
      `INSERT INTO profiles (id, pilot_name, account_type, email, password_hash, preferred_difficulty, best_score, best_time_seconds, created_at, updated_at)
       VALUES (?, ?, 'guest', NULL, NULL, 'normal', 0, 0, ?, ?)`
    ).run(id, pilotName, now, now);
    return this.getProfileById(id)!;
  }

  createRegisteredProfile(input: { pilotName: string; email: string; password: string; preferredDifficulty?: Difficulty }): PlayerProfile {
    const now = new Date().toISOString();
    const id = `pilot_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const hash = hashPassword(input.password);
    const difficulty: Difficulty = input.preferredDifficulty ?? "normal";

    this.db.prepare(
      `INSERT INTO profiles (id, pilot_name, account_type, email, password_hash, preferred_difficulty, best_score, best_time_seconds, created_at, updated_at)
       VALUES (?, ?, 'registered', ?, ?, ?, 0, 0, ?, ?)`
    ).run(id, input.pilotName, input.email.toLowerCase(), hash, difficulty, now, now);

    return this.getProfileById(id)!;
  }

  upgradeGuestProfile(profileId: string, input: { email: string; password: string; pilotName?: string }): PlayerProfile {
    const existing = this.getProfileByEmail(input.email);
    if (existing && existing.id !== profileId) {
      throw new Error("email already in use");
    }

    const now = new Date().toISOString();
    const hash = hashPassword(input.password);
    this.db.prepare(
      `UPDATE profiles
       SET account_type = 'registered',
           pilot_name = COALESCE(?, pilot_name),
           email = ?,
           password_hash = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(input.pilotName ?? null, input.email.toLowerCase(), hash, now, profileId);

    return this.getProfileById(profileId)!;
  }

  authenticate(email: string, password: string): PlayerProfile | null {
    const profile = this.getProfileByEmail(email.toLowerCase());
    if (!profile) {
      return null;
    }

    const row = this.db.prepare("SELECT password_hash FROM profiles WHERE id = ?").get(profile.id) as { password_hash: string | null } | undefined;
    if (!verifyPassword(password, row?.password_hash ?? null)) {
      return null;
    }

    return profile;
  }

  createSession(profileId: string, ttlDays = 30): string {
    const now = new Date();
    const token = createSessionToken();
    const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
    this.db.prepare(
      `INSERT INTO sessions (token, profile_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`
    ).run(token, profileId, now.toISOString(), expiresAt);
    return token;
  }

  getSession(token: string): { token: string; profile: PlayerProfile } | null {
    const row = this.db.prepare(
      `SELECT s.token, p.*
       FROM sessions s
       JOIN profiles p ON p.id = s.profile_id
       WHERE s.token = ?`
    ).get(token) as (SessionRow & ProfileRow) | undefined;

    if (!row) {
      return null;
    }

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      this.db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
      return null;
    }

    return {
      token: row.token,
      profile: this.mapProfile(row)
    };
  }

  updateProfile(profileId: string, patch: { pilotName?: string; preferredDifficulty?: Difficulty }): PlayerProfile {
    const current = this.getProfileById(profileId);
    if (!current) {
      throw new Error("profile not found");
    }

    const now = new Date().toISOString();
    this.db.prepare(
      `UPDATE profiles
       SET pilot_name = COALESCE(?, pilot_name),
           preferred_difficulty = COALESCE(?, preferred_difficulty),
           updated_at = ?
       WHERE id = ?`
    ).run(patch.pilotName ?? null, patch.preferredDifficulty ?? null, now, profileId);

    return this.getProfileById(profileId)!;
  }

  getProfileById(profileId: string): PlayerProfile | null {
    const row = this.db.prepare("SELECT * FROM profiles WHERE id = ?").get(profileId) as ProfileRow | undefined;
    return row ? this.mapProfile(row) : null;
  }

  getProfileByEmail(email: string): PlayerProfile | null {
    const row = this.db.prepare("SELECT * FROM profiles WHERE email = ?").get(email.toLowerCase()) as ProfileRow | undefined;
    return row ? this.mapProfile(row) : null;
  }

  listProgress(profileId: string): Array<{ levelId: string; state: SaveState; updatedAt: string }> {
    const rows = this.db.prepare("SELECT * FROM progress WHERE profile_id = ? ORDER BY updated_at DESC").all(profileId) as ProgressRow[];
    return rows.map((row) => ({
      levelId: row.level_id,
      state: JSON.parse(row.state_json) as SaveState,
      updatedAt: row.updated_at
    }));
  }

  getProgress(profileId: string, levelId: string): SaveState | null {
    const row = this.db.prepare("SELECT state_json FROM progress WHERE profile_id = ? AND level_id = ?").get(profileId, levelId) as { state_json: string } | undefined;
    return row ? (JSON.parse(row.state_json) as SaveState) : null;
  }

  saveProgress(profileId: string, levelId: string, state: SaveState): void {
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO progress (profile_id, level_id, state_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(profile_id, level_id) DO UPDATE SET
         state_json = excluded.state_json,
         updated_at = excluded.updated_at`
    ).run(profileId, levelId, JSON.stringify(state), now);
  }

  submitRun(result: RunResult): LeaderboardEntry | null {
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO runs (id, profile_id, level_id, difficulty, score, elapsed_seconds, flares_used, robots_destroyed, secrets_found, escaped, reactor_destroyed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      result.profileId,
      result.levelId,
      result.difficulty,
      result.score,
      result.elapsedSeconds,
      result.flaresUsed,
      result.robotsDestroyed,
      result.secretsFound,
      result.escaped ? 1 : 0,
      result.reactorDestroyed ? 1 : 0,
      now
    );

    const profile = this.getProfileById(result.profileId);
    if (profile && result.escaped && result.reactorDestroyed) {
      const betterScore = result.score > profile.bestScore;
      const betterTime = profile.bestTimeSeconds <= 0 || result.elapsedSeconds < profile.bestTimeSeconds;
      if (betterScore || betterTime) {
        this.db.prepare(
          `UPDATE profiles
           SET best_score = MAX(best_score, ?),
               best_time_seconds = CASE
                 WHEN best_time_seconds <= 0 THEN ?
                 WHEN ? < best_time_seconds THEN ?
                 ELSE best_time_seconds
               END,
               updated_at = ?
           WHERE id = ?`
        ).run(result.score, result.elapsedSeconds, result.elapsedSeconds, result.elapsedSeconds, now, result.profileId);
      }
    }

    return result.escaped && result.reactorDestroyed ? this.buildLeaderboardEntry(result.profileId, result.levelId, result.difficulty, now, result) : null;
  }

  listLeaderboard(levelId: string, difficulty?: Difficulty, limit = 25): LeaderboardEntry[] {
    const rows = (difficulty
      ? this.db.prepare(
          `SELECT r.*, p.pilot_name
           FROM runs r
           JOIN profiles p ON p.id = r.profile_id
           WHERE r.level_id = ? AND r.difficulty = ? AND r.escaped = 1 AND r.reactor_destroyed = 1
           ORDER BY r.score DESC, r.elapsed_seconds ASC, r.created_at ASC
           LIMIT ?`
        ).all(levelId, difficulty, limit)
      : this.db.prepare(
          `SELECT r.*, p.pilot_name
           FROM runs r
           JOIN profiles p ON p.id = r.profile_id
           WHERE r.level_id = ? AND r.escaped = 1 AND r.reactor_destroyed = 1
           ORDER BY r.score DESC, r.elapsed_seconds ASC, r.created_at ASC
           LIMIT ?`
        ).all(levelId, limit)) as Array<RunRow & { pilot_name: string }>;

    return rows.map((row) => this.mapLeaderboardRow(row));
  }

  listLevels(): LevelState[] {
    const rows = this.db.prepare("SELECT * FROM level_state ORDER BY level_id ASC").all() as LevelStateRow[];
    return rows.map((row) => ({
      levelId: row.level_id,
      title: row.title,
      active: row.active === 1,
      updatedAt: row.updated_at
    }));
  }

  setLevelActive(levelId: string, active: boolean): LevelState | null {
    const now = new Date().toISOString();
    const info = this.db.prepare(
      `UPDATE level_state
       SET active = ?, updated_at = ?
       WHERE level_id = ?`
    ).run(active ? 1 : 0, now, levelId);

    if (info.changes === 0) {
      return null;
    }

    const row = this.db.prepare("SELECT * FROM level_state WHERE level_id = ?").get(levelId) as LevelStateRow | undefined;
    return row
      ? {
          levelId: row.level_id,
          title: row.title,
          active: row.active === 1,
          updatedAt: row.updated_at
        }
      : null;
  }

  resetLeaderboard(levelId?: string): number {
    const info = levelId
      ? this.db.prepare("DELETE FROM runs WHERE level_id = ?").run(levelId)
      : this.db.prepare("DELETE FROM runs").run();
    return info.changes;
  }

  deleteSession(token: string): void {
    this.db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }

  private buildLeaderboardEntry(profileId: string, levelId: string, difficulty: Difficulty, createdAt: string, result: RunResult): LeaderboardEntry {
    const profile = this.getProfileById(profileId);
    return {
      id: `run_${profileId}_${levelId}_${createdAt}`,
      pilotName: profile?.pilotName ?? defaultPilotName,
      levelId,
      difficulty,
      score: result.score,
      elapsedSeconds: result.elapsedSeconds,
      escaped: result.escaped,
      reactorDestroyed: result.reactorDestroyed,
      createdAt
    };
  }

  private mapProfile(row: ProfileRow): PlayerProfile {
    return {
      id: row.id,
      pilotName: row.pilot_name,
      accountType: row.account_type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      preferredDifficulty: row.preferred_difficulty,
      bestScore: row.best_score,
      bestTimeSeconds: row.best_time_seconds
    };
  }

  private mapLeaderboardRow(row: RunRow & { pilot_name: string }): LeaderboardEntry {
    return {
      id: row.id,
      pilotName: row.pilot_name,
      levelId: row.level_id,
      difficulty: row.difficulty,
      score: row.score,
      elapsedSeconds: row.elapsed_seconds,
      escaped: row.escaped === 1,
      reactorDestroyed: row.reactor_destroyed === 1,
      createdAt: row.created_at
    };
  }
}

export function createDatabase(filename: string): ApiDatabase {
  return new ApiDatabase(filename);
}

export function deleteDatabaseFile(filename: string): void {
  if (existsSync(filename)) {
    rmSync(filename);
  }
}
