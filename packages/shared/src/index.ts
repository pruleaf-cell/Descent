import { z } from "zod";

export const vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number()
});

export const rotationSchema = z.object({
  pitch: z.number(),
  yaw: z.number(),
  roll: z.number()
});

export const difficultySchema = z.enum(["easy", "normal", "hard"]);
export type Difficulty = z.infer<typeof difficultySchema>;

export const keyColorSchema = z.enum(["amber", "azure", "crimson"]);
export type KeyColor = z.infer<typeof keyColorSchema>;

export const weaponIdSchema = z.enum(["pulse", "volley", "shredder", "concussion", "nova"]);
export type WeaponId = z.infer<typeof weaponIdSchema>;

export const enemyTypeSchema = z.enum(["patrol-drone", "sentry-turret", "hunter", "heavy-guard", "reactor-elite"]);
export type EnemyType = z.infer<typeof enemyTypeSchema>;

export const pickupSchema = z.object({
  id: z.string(),
  type: z.enum(["shield", "energy", "flare", "ammo-primary", "ammo-missile", "key", "powerup", "weapon"]),
  position: vector3Schema,
  amount: z.number().int().nonnegative().default(0),
  keyColor: keyColorSchema.optional(),
  weaponId: weaponIdSchema.optional(),
  powerupId: z.string().optional()
});
export type PickupDefinition = z.infer<typeof pickupSchema>;

export const encounterSchema = z.object({
  id: z.string(),
  sectorId: z.string(),
  enemyType: enemyTypeSchema,
  position: vector3Schema,
  patrolRadius: z.number().positive().default(6),
  trigger: z.enum(["on-enter", "on-reactor", "on-key"]).default("on-enter"),
  healthMultiplier: z.number().positive().default(1)
});
export type EncounterDefinition = z.infer<typeof encounterSchema>;

export const doorSchema = z.object({
  id: z.string(),
  fromSectorId: z.string(),
  toSectorId: z.string(),
  position: vector3Schema,
  size: vector3Schema,
  keyColor: keyColorSchema.optional(),
  opensOnSwitchId: z.string().optional()
});
export type DoorDefinition = z.infer<typeof doorSchema>;

export const switchSchema = z.object({
  id: z.string(),
  sectorId: z.string(),
  position: vector3Schema,
  targetDoorId: z.string().optional(),
  armsReactor: z.boolean().default(false)
});
export type SwitchDefinition = z.infer<typeof switchSchema>;

export const sectorSchema = z.object({
  id: z.string(),
  label: z.string(),
  center: vector3Schema,
  size: vector3Schema,
  kind: z.enum(["hub", "tunnel", "arena", "reactor", "escape", "secret", "entry"])
});
export type SectorDefinition = z.infer<typeof sectorSchema>;

export const checkpointSchema = z.object({
  id: z.string(),
  sectorId: z.string(),
  position: vector3Schema,
  heading: rotationSchema
});
export type CheckpointDefinition = z.infer<typeof checkpointSchema>;

export const objectiveSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["reach-sector", "collect-key", "arm-reactor", "destroy-reactor", "escape"]),
  sectorId: z.string().optional(),
  keyColor: keyColorSchema.optional()
});
export type ObjectiveDefinition = z.infer<typeof objectiveSchema>;

export const levelSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  palette: z.object({
    background: z.string(),
    accent: z.string(),
    warning: z.string()
  }),
  sectors: z.array(sectorSchema).min(1),
  doors: z.array(doorSchema),
  switches: z.array(switchSchema),
  checkpoints: z.array(checkpointSchema).min(1),
  pickups: z.array(pickupSchema),
  encounters: z.array(encounterSchema),
  objectives: z.array(objectiveSchema).min(1),
  startCheckpointId: z.string(),
  reactor: z.object({
    sectorId: z.string(),
    position: vector3Schema,
    hitPoints: z.number().positive(),
    countdownSeconds: z.number().int().positive()
  }),
  exit: z.object({
    sectorId: z.string(),
    position: vector3Schema
  }),
  secrets: z.array(
    z.object({
      id: z.string(),
      sectorId: z.string(),
      rewardLabel: z.string()
    })
  )
});
export type LevelDefinition = z.infer<typeof levelSchema>;

export const progressSchema = z.object({
  checkpointId: z.string(),
  shields: z.number().nonnegative(),
  energy: z.number().nonnegative(),
  flareAmmo: z.number().int().nonnegative(),
  primaryWeapon: weaponIdSchema,
  secondaryWeapon: weaponIdSchema,
  keys: z.array(keyColorSchema),
  destroyedEncounters: z.array(z.string()),
  collectedPickups: z.array(z.string()),
  objectiveIds: z.array(z.string()),
  score: z.number(),
  elapsedSeconds: z.number().nonnegative(),
  reactorArmed: z.boolean(),
  reactorDestroyed: z.boolean()
});
export type SaveState = z.infer<typeof progressSchema>;

export const playerProfileSchema = z.object({
  id: z.string(),
  pilotName: z.string().min(2).max(24),
  accountType: z.enum(["guest", "registered"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  preferredDifficulty: difficultySchema,
  bestScore: z.number().default(0),
  bestTimeSeconds: z.number().nonnegative().default(0)
});
export type PlayerProfile = z.infer<typeof playerProfileSchema>;

export const runResultSchema = z.object({
  profileId: z.string(),
  levelId: z.string(),
  difficulty: difficultySchema,
  score: z.number().int(),
  elapsedSeconds: z.number().nonnegative(),
  flaresUsed: z.number().int().nonnegative(),
  robotsDestroyed: z.number().int().nonnegative(),
  secretsFound: z.number().int().nonnegative(),
  escaped: z.boolean(),
  reactorDestroyed: z.boolean()
});
export type RunResult = z.infer<typeof runResultSchema>;

export const leaderboardEntrySchema = z.object({
  id: z.string(),
  pilotName: z.string(),
  levelId: z.string(),
  difficulty: difficultySchema,
  score: z.number(),
  elapsedSeconds: z.number(),
  escaped: z.boolean(),
  reactorDestroyed: z.boolean(),
  createdAt: z.string()
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const authGuestResponseSchema = z.object({
  profile: playerProfileSchema
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
  preferredDifficulty: difficultySchema.optional()
});

export const progressEnvelopeSchema = z.object({
  levelId: z.string(),
  state: progressSchema
});

export const leaderboardQuerySchema = z.object({
  levelId: z.string(),
  difficulty: difficultySchema.optional()
});

export const contentManifestSchema = z.object({
  generatedAt: z.string(),
  levels: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      checkpointCount: z.number().int(),
      objectiveCount: z.number().int(),
      enemyCount: z.number().int(),
      pickupCount: z.number().int()
    })
  )
});
export type ContentManifest = z.infer<typeof contentManifestSchema>;

export const assetManifestSchema = z.object({
  generatedAt: z.string(),
  hud: z.object({
    banner: z.string(),
    crosshair: z.string()
  }),
  audio: z.object({
    alarm: z.string(),
    flare: z.string()
  })
});
export type AssetManifest = z.infer<typeof assetManifestSchema>;

export const defaultControls = {
  thrustForward: "KeyW",
  thrustBackward: "KeyS",
  strafeLeft: "KeyA",
  strafeRight: "KeyD",
  rollLeft: "KeyQ",
  rollRight: "KeyE",
  moveUp: "Space",
  moveDown: "ControlLeft",
  afterburner: "ShiftLeft",
  flare: "KeyF",
  primaryFire: "Mouse0",
  secondaryFire: "Mouse2",
  nextWeapon: "Tab",
  automap: "KeyM",
  pause: "Escape"
} as const;

export const defaultPilotName = "CALLSIGN-7";
export const defaultLevelId = "crimson-foundry";

