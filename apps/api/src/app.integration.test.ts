import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createApp } from "./app.js";
import { defaultLevelId, defaultLevelTitle, defaultPilotName, type Difficulty, type LeaderboardEntry, type PlayerProfile, type RunResult, type SaveState } from "./contracts.js";

type LevelState = {
  levelId: string;
  title: string;
  active: boolean;
  updatedAt: string;
};

type TestDatabase = {
  migrate(): void;
  seed(): void;
  close(): void;
  createGuestProfile(pilotName?: string): PlayerProfile;
  createRegisteredProfile(input: { pilotName: string; email: string; password: string; preferredDifficulty?: Difficulty }): PlayerProfile;
  upgradeGuestProfile(profileId: string, input: { email: string; password: string; pilotName?: string }): PlayerProfile;
  authenticate(email: string, password: string): PlayerProfile | null;
  createSession(profileId: string): string;
  getSession(token: string): { token: string; profile: PlayerProfile } | null;
  deleteSession(token: string): void;
  listProgress(profileId: string): Array<{ levelId: string; state: SaveState; updatedAt: string }>;
  getProgress(profileId: string, levelId: string): SaveState | null;
  saveProgress(profileId: string, levelId: string, state: SaveState): void;
  submitRun(result: RunResult): LeaderboardEntry | null;
  listLeaderboard(levelId: string, difficulty?: Difficulty): LeaderboardEntry[];
  listLevels(): LevelState[];
  setLevelActive(levelId: string, active: boolean): LevelState | null;
  resetLeaderboard(levelId?: string): number;
  updateProfile(profileId: string, patch: { pilotName?: string; preferredDifficulty?: Difficulty }): PlayerProfile;
};

describe("api integration", () => {
  let db: TestDatabase;
  let app: ReturnType<typeof createApp> | undefined;

  beforeEach(() => {
    db = createTestDatabase();
    db.migrate();
    db.seed();
    app = createApp(db as never, {
      appUrl: "http://localhost:5173",
      adminToken: "test-admin",
      cookieName: "descent_session",
      cookieSecure: false
    });
  });

  afterEach(async () => {
    await app?.close();
    db.close();
  });

  it("creates a guest, stores progress, and returns it", async () => {
    const guest = await app!.inject({
      method: "POST",
      url: "/api/v1/auth/guest",
      payload: { pilotName: "RIFT-01" }
    });
    expect(guest.statusCode).toBe(200);
    const guestBody = guest.json<{ profile: { id: string; pilotName: string } }>();
    expect(guestBody.profile.pilotName).toBe("RIFT-01");

    const cookie = guest.cookies[0];
    if (!cookie) {
      throw new Error("expected guest session cookie");
    }

    const state = {
      checkpointId: "cp-hub",
      shields: 84,
      energy: 65,
      flareAmmo: 5,
      primaryWeapon: "pulse",
      secondaryWeapon: "nova",
      keys: ["azure"],
      destroyedEncounters: ["entry-drone"],
      collectedPickups: ["flare-start"],
      objectiveIds: ["reach-hub"],
      score: 1200,
      elapsedSeconds: 72.5,
      reactorArmed: false,
      reactorDestroyed: false
    };

    const saved = await app!.inject({
      method: "PUT",
      url: "/api/v1/progress/crimson-foundry",
      cookies: { descent_session: cookie.value },
      payload: { state }
    });
    expect(saved.statusCode).toBe(200);

    const loaded = await app!.inject({
      method: "GET",
      url: "/api/v1/progress/crimson-foundry",
      cookies: { descent_session: cookie.value }
    });
    expect(loaded.statusCode).toBe(200);
    expect(loaded.json<{ state: typeof state }>().state).toMatchObject(state);
  });

  it("accepts a completed run and exposes it on the leaderboard", async () => {
    const login = await app!.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "ace@foundry.test", password: "password123" }
    });
    expect(login.statusCode).toBe(200);
    const cookie = login.cookies[0];
    if (!cookie) {
      throw new Error("expected login session cookie");
    }

    const profile = login.json<{ profile: { id: string } }>().profile;
    const submitted = await app!.inject({
      method: "POST",
      url: "/api/v1/runs",
      cookies: { descent_session: cookie.value },
      payload: {
        profileId: profile.id,
        levelId: "crimson-foundry",
        difficulty: "normal",
        score: 50000,
        elapsedSeconds: 420.5,
        flaresUsed: 7,
        robotsDestroyed: 36,
        secretsFound: 1,
        escaped: true,
        reactorDestroyed: true
      }
    });
    expect(submitted.statusCode).toBe(200);
    expect(submitted.json<{ accepted: boolean }>().accepted).toBe(true);

    const leaderboard = await app!.inject({
      method: "GET",
      url: "/api/v1/leaderboards/crimson-foundry?difficulty=normal"
    });
    expect(leaderboard.statusCode).toBe(200);
    const entries = leaderboard.json<{ entries: Array<{ score: number; pilotName: string }> }>().entries;
    expect(entries.some((entry) => entry.score === 50000)).toBe(true);
  });

  it("allows admin moderation with a token", async () => {
    const result = await app!.inject({
      method: "POST",
      url: "/api/v1/admin/leaderboards/reset",
      headers: { "x-admin-token": "test-admin" },
      payload: { levelId: "crimson-foundry" }
    });
    expect(result.statusCode).toBe(200);
    expect(result.json<{ cleared: number }>().cleared).toBeGreaterThanOrEqual(1);
  });
});

function createTestDatabase(): TestDatabase {
  const profiles = new Map<string, PlayerProfile & { email: string | null; password: string | null }>();
  const sessions = new Map<string, { profileId: string; expiresAt: number }>();
  const progress = new Map<string, Map<string, { state: SaveState; updatedAt: string }>>();
  const runs: Array<LeaderboardEntry & { profileId: string; flaresUsed: number; robotsDestroyed: number; secretsFound: number }> = [];
  const levels = new Map<string, LevelState>();

  function mapProfile(profile: PlayerProfile & { email: string | null; password: string | null }): PlayerProfile {
    return {
      id: profile.id,
      pilotName: profile.pilotName,
      accountType: profile.accountType,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      preferredDifficulty: profile.preferredDifficulty,
      bestScore: profile.bestScore,
      bestTimeSeconds: profile.bestTimeSeconds
    };
  }

  function getProfile(profileId: string) {
    const profile = profiles.get(profileId);
    if (!profile) {
      throw new Error("profile not found");
    }
    return profile;
  }

  function buildLeaderboardEntry(profileId: string, result: RunResult, createdAt: string): LeaderboardEntry {
    const profile = profiles.get(profileId);
    return {
      id: `run_${profileId}_${result.levelId}_${createdAt}`,
      pilotName: profile?.pilotName ?? defaultPilotName,
      levelId: result.levelId,
      difficulty: result.difficulty,
      score: result.score,
      elapsedSeconds: result.elapsedSeconds,
      escaped: result.escaped,
      reactorDestroyed: result.reactorDestroyed,
      createdAt
    };
  }

  const db: TestDatabase = {
    migrate() {},
    seed() {
      const now = new Date().toISOString();
      const seeded: PlayerProfile & { email: string | null; password: string | null } = {
        id: "seed-ace",
        pilotName: "ACE-7",
        accountType: "registered",
        email: "ace@foundry.test",
        password: "password123",
        preferredDifficulty: "normal",
        bestScore: 48750,
        bestTimeSeconds: 476.2,
        createdAt: now,
        updatedAt: now
      };
      profiles.set(seeded.id, seeded);
      levels.set(defaultLevelId, {
        levelId: defaultLevelId,
        title: defaultLevelTitle,
        active: true,
        updatedAt: now
      });
      runs.push({
        ...buildLeaderboardEntry(seeded.id, {
          profileId: seeded.id,
          levelId: defaultLevelId,
          difficulty: "normal",
          score: 48750,
          elapsedSeconds: 476.2,
          flaresUsed: 9,
          robotsDestroyed: 41,
          secretsFound: 1,
          escaped: true,
          reactorDestroyed: true
        }, now),
        profileId: seeded.id,
        flaresUsed: 9,
        robotsDestroyed: 41,
        secretsFound: 1
      });
    },
    close() {},
    createGuestProfile(pilotName = defaultPilotName) {
      const now = new Date().toISOString();
      const profile: PlayerProfile & { email: string | null; password: string | null } = {
        id: `guest_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
        pilotName,
        accountType: "guest",
        email: null,
        password: null,
        preferredDifficulty: "normal",
        bestScore: 0,
        bestTimeSeconds: 0,
        createdAt: now,
        updatedAt: now
      };
      profiles.set(profile.id, profile);
      return mapProfile(profile);
    },
    createRegisteredProfile(input) {
      const now = new Date().toISOString();
      const profile: PlayerProfile & { email: string | null; password: string | null } = {
        id: `pilot_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
        pilotName: input.pilotName,
        accountType: "registered",
        email: input.email.toLowerCase(),
        password: input.password,
        preferredDifficulty: input.preferredDifficulty ?? "normal",
        bestScore: 0,
        bestTimeSeconds: 0,
        createdAt: now,
        updatedAt: now
      };
      profiles.set(profile.id, profile);
      return mapProfile(profile);
    },
    upgradeGuestProfile(profileId, input) {
      const existing = [...profiles.values()].find((profile) => profile.email?.toLowerCase() === input.email.toLowerCase() && profile.id !== profileId);
      if (existing) {
        throw new Error("email already in use");
      }
      const profile = getProfile(profileId);
      profile.accountType = "registered";
      profile.pilotName = input.pilotName ?? profile.pilotName;
      profile.email = input.email.toLowerCase();
      profile.password = input.password;
      profile.updatedAt = new Date().toISOString();
      return mapProfile(profile);
    },
    authenticate(email, password) {
      const profile = [...profiles.values()].find((entry) => entry.email?.toLowerCase() === email.toLowerCase() && entry.password === password);
      return profile ? mapProfile(profile) : null;
    },
    createSession(profileId) {
      const token = randomUUID().replaceAll("-", "");
      sessions.set(token, { profileId, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
      return token;
    },
    getSession(token) {
      const session = sessions.get(token);
      if (!session || session.expiresAt <= Date.now()) {
        sessions.delete(token);
        return null;
      }
      const profile = profiles.get(session.profileId);
      return profile ? { token, profile: mapProfile(profile) } : null;
    },
    deleteSession(token) {
      sessions.delete(token);
    },
    listProgress(profileId) {
      return [...(progress.get(profileId)?.entries() ?? [])]
        .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))
        .map(([levelId, entry]) => ({ levelId, state: entry.state, updatedAt: entry.updatedAt }));
    },
    getProgress(profileId, levelId) {
      return progress.get(profileId)?.get(levelId)?.state ?? null;
    },
    saveProgress(profileId, levelId, state) {
      const now = new Date().toISOString();
      const profileProgress = progress.get(profileId) ?? new Map<string, { state: SaveState; updatedAt: string }>();
      profileProgress.set(levelId, { state, updatedAt: now });
      progress.set(profileId, profileProgress);
    },
    submitRun(result) {
      const now = new Date().toISOString();
      runs.push({
        ...buildLeaderboardEntry(result.profileId, result, now),
        profileId: result.profileId,
        flaresUsed: result.flaresUsed,
        robotsDestroyed: result.robotsDestroyed,
        secretsFound: result.secretsFound
      });

      const profile = profiles.get(result.profileId);
      if (profile && result.escaped && result.reactorDestroyed) {
        profile.bestScore = Math.max(profile.bestScore, result.score);
        profile.bestTimeSeconds = profile.bestTimeSeconds <= 0 ? result.elapsedSeconds : Math.min(profile.bestTimeSeconds, result.elapsedSeconds);
        profile.updatedAt = now;
      }

      return result.escaped && result.reactorDestroyed ? buildLeaderboardEntry(result.profileId, result, now) : null;
    },
    listLeaderboard(levelId, difficulty) {
      return runs
        .filter((run) => run.levelId === levelId && run.escaped && run.reactorDestroyed && (!difficulty || run.difficulty === difficulty))
        .sort((a, b) => b.score - a.score || a.elapsedSeconds - b.elapsedSeconds || a.createdAt.localeCompare(b.createdAt));
    },
    listLevels() {
      return [...levels.values()];
    },
    setLevelActive(levelId, active) {
      const current = levels.get(levelId);
      if (!current) {
        return null;
      }
      const updated = { ...current, active, updatedAt: new Date().toISOString() };
      levels.set(levelId, updated);
      return updated;
    },
    resetLeaderboard(levelId) {
      const before = runs.length;
      if (levelId) {
        for (let index = runs.length - 1; index >= 0; index -= 1) {
          if (runs[index]?.levelId === levelId) {
            runs.splice(index, 1);
          }
        }
      } else {
        runs.length = 0;
      }
      return before - runs.length;
    },
    updateProfile(profileId, patch) {
      const profile = getProfile(profileId);
      profile.pilotName = patch.pilotName ?? profile.pilotName;
      profile.preferredDifficulty = patch.preferredDifficulty ?? profile.preferredDifficulty;
      profile.updatedAt = new Date().toISOString();
      return mapProfile(profile);
    }
  };

  return db;
}
