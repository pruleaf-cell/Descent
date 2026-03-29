import { z } from "zod";

export const difficultyValues = ["easy", "normal", "hard"] as const;
export const keyColorValues = ["amber", "azure", "crimson"] as const;
export const weaponValues = ["pulse", "volley", "shredder", "concussion", "nova"] as const;

export const playerProfileSchema = z.object({
  id: z.string(),
  pilotName: z.string().min(2).max(24),
  accountType: z.enum(["guest", "registered"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  preferredDifficulty: z.enum(difficultyValues),
  bestScore: z.number(),
  bestTimeSeconds: z.number()
});

export const leaderboardEntrySchema = z.object({
  id: z.string(),
  pilotName: z.string(),
  levelId: z.string(),
  difficulty: z.enum(difficultyValues),
  score: z.number(),
  elapsedSeconds: z.number(),
  escaped: z.boolean(),
  reactorDestroyed: z.boolean(),
  createdAt: z.string()
});

export const saveStateSchema = z.object({
  checkpointId: z.string(),
  shields: z.number().nonnegative(),
  energy: z.number().nonnegative(),
  flareAmmo: z.number().int().nonnegative(),
  primaryWeapon: z.enum(weaponValues),
  secondaryWeapon: z.enum(weaponValues),
  keys: z.array(z.enum(keyColorValues)),
  destroyedEncounters: z.array(z.string()),
  collectedPickups: z.array(z.string()),
  objectiveIds: z.array(z.string()),
  score: z.number(),
  elapsedSeconds: z.number().nonnegative(),
  reactorArmed: z.boolean(),
  reactorDestroyed: z.boolean()
});

export const runResultSchema = z.object({
  profileId: z.string(),
  levelId: z.string(),
  difficulty: z.enum(difficultyValues),
  score: z.number().int(),
  elapsedSeconds: z.number().nonnegative(),
  flaresUsed: z.number().int().nonnegative(),
  robotsDestroyed: z.number().int().nonnegative(),
  secretsFound: z.number().int().nonnegative(),
  escaped: z.boolean(),
  reactorDestroyed: z.boolean()
});

export const profileSchema = z.object({
  profile: playerProfileSchema
});

export const leaderboardResponseSchema = z.object({
  levelId: z.string(),
  entries: z.array(leaderboardEntrySchema)
});

export type Difficulty = (typeof difficultyValues)[number];
export type KeyColor = (typeof keyColorValues)[number];
export type WeaponId = (typeof weaponValues)[number];
export type PlayerProfile = z.infer<typeof playerProfileSchema>;
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
export type SaveState = z.infer<typeof saveStateSchema>;
export type RunResult = z.infer<typeof runResultSchema>;
export const authGuestSchema = z.object({
  pilotName: z.string().min(2).max(24).optional()
});

export const authRegisterSchema = z.object({
  pilotName: z.string().min(2).max(24),
  email: z.email(),
  password: z.string().min(8)
});

export const authLoginSchema = z.object({
  email: z.email(),
  password: z.string().min(8)
});

export const authUpgradeSchema = z.object({
  email: z.email(),
  password: z.string().min(8)
});

export const profilePatchSchema = z.object({
  pilotName: z.string().min(2).max(24).optional(),
  preferredDifficulty: z.enum(difficultyValues).optional()
});

export const progressPutSchema = z.object({
  state: saveStateSchema
});

export const leaderboardQuerySchema = z.object({
  difficulty: z.enum(difficultyValues).optional()
});

export const adminLevelUpdateSchema = z.object({
  active: z.boolean()
});

export const adminLeaderboardResetSchema = z.object({
  levelId: z.string().optional()
});

export const defaultPilotName = "CALLSIGN-7";
export const defaultLevelId = "crimson-foundry";
export const defaultLevelTitle = "Crimson Foundry";
