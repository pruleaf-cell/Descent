import type {
  Difficulty,
  EncounterDefinition,
  KeyColor,
  LevelDefinition,
  LeaderboardEntry,
  PickupDefinition,
  RunResult,
  SaveState,
  WeaponId
} from "@descent/shared";
import type { Vec3 } from "./math.js";

export interface ShipOrientation {
  pitch: number;
  yaw: number;
  roll: number;
}

export interface ShipStats {
  shields: number;
  energy: number;
  flareAmmo: number;
  currentPrimaryWeapon: WeaponId;
  currentSecondaryWeapon: WeaponId;
  primaryCooldown: number;
  secondaryCooldown: number;
  flareCooldown: number;
  keys: KeyColor[];
}

export interface ShipState {
  position: Vec3;
  velocity: Vec3;
  orientation: ShipOrientation;
  stats: ShipStats;
  lastSafePosition: Vec3;
  lastSafeOrientation: ShipOrientation;
}

export interface EnemyArchetype {
  type: EncounterDefinition["enemyType"];
  maxHealth: number;
  speed: number;
  damage: number;
  attackRange: number;
  turnRate: number;
  scoreValue: number;
}

export type EnemyBehavior = "idle" | "patrol" | "chase" | "attack" | "destroyed";

export interface EnemyState {
  id: string;
  type: EncounterDefinition["enemyType"];
  sectorId: string;
  position: Vec3;
  velocity: Vec3;
  health: number;
  maxHealth: number;
  behavior: EnemyBehavior;
  active: boolean;
  visible: boolean;
  scoreValue: number;
  triggeredBy?: "on-enter" | "on-reactor" | "on-key";
}

export interface PickupState {
  id: string;
  type: PickupDefinition["type"];
  position: Vec3;
  amount: number;
  keyColor?: KeyColor;
  weaponId?: WeaponId;
  powerupId?: string;
  collected: boolean;
}

export interface DoorState {
  id: string;
  open: boolean;
}

export interface MissionObjectiveState {
  id: string;
  complete: boolean;
}

export interface ReactorState {
  hitPoints: number;
  countdownSeconds: number;
  countdownRemaining: number;
  armed: boolean;
  destroyed: boolean;
}

export interface MissionState {
  activeCheckpointId: string;
  objectiveStates: MissionObjectiveState[];
  reactor: ReactorState;
  escapeUnlocked: boolean;
  completed: boolean;
  failed: boolean;
}

export interface RunStats {
  flaresUsed: number;
  robotsDestroyed: number;
  secretsFound: number;
  damageTaken: number;
  shotsFired: number;
}

export interface GameState {
  level: LevelDefinition;
  levelId: string;
  difficulty: Difficulty;
  tick: number;
  elapsedSeconds: number;
  ship: ShipState;
  enemies: EnemyState[];
  pickups: PickupState[];
  doors: DoorState[];
  mission: MissionState;
  runStats: RunStats;
  currentSectorId: string;
  score: number;
}

export interface GameInput {
  thrustForward?: number;
  thrustRight?: number;
  thrustUp?: number;
  yaw?: number;
  pitch?: number;
  roll?: number;
  firePrimary?: boolean;
  fireSecondary?: boolean;
  flare?: boolean;
  interact?: boolean;
  nextWeapon?: boolean;
  previousWeapon?: boolean;
  afterburner?: boolean;
}

export interface GameStepEvent {
  type:
    | "ship-moved"
    | "weapon-fired"
    | "flare-fired"
    | "enemy-spawned"
    | "enemy-damaged"
    | "enemy-destroyed"
    | "pickup-collected"
    | "objective-complete"
    | "checkpoint-hit"
    | "reactor-armed"
    | "reactor-destroyed"
    | "mission-complete"
    | "mission-failed"
    | "door-opened";
  payload: Record<string, unknown>;
}

export interface GameStepResult {
  state: GameState;
  events: GameStepEvent[];
  ticks: number;
}

export interface SimulationState {
  state: GameState;
  accumulator: number;
}

export interface CreateGameStateOptions {
  difficulty?: Difficulty;
  startCheckpointId?: string;
}

export interface ScoreBreakdown {
  base: number;
  objectives: number;
  enemies: number;
  secrets: number;
  timeBonus: number;
  damagePenalty: number;
  flarePenalty: number;
  reactorBonus: number;
  escapeBonus: number;
  multiplier: number;
  total: number;
}

export interface WeaponSpec {
  id: WeaponId;
  cooldownSeconds: number;
  ammoCost: number;
  damage: number;
  range: number;
  speed: number;
  scoreValue: number;
  secondary?: boolean;
}

export interface SimulationClock {
  fixedDeltaSeconds: number;
  totalSeconds: number;
  ticks: number;
}

export interface GameEngine {
  readonly state: GameState;
  readonly clock: SimulationClock;
  step(input: GameInput, deltaSeconds: number): GameStepResult;
  reset(saveState?: SaveState): GameState;
  checkpoint(): SaveState;
  runResult(profileId: string): RunResult;
  leaderboardEntry(profileId: string, pilotName: string): LeaderboardEntry;
}

