import type { LeaderboardEntry, LevelDefinition, PlayerProfile, SaveState } from "@descent/shared";

export type RuntimePhase = "boot" | "briefing" | "active" | "paused" | "completed" | "failed";

export type Vec3Tuple = readonly [number, number, number];

export type InputSnapshot = {
  thrustForward: boolean;
  thrustBackward: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
  rollLeft: boolean;
  rollRight: boolean;
  moveUp: boolean;
  moveDown: boolean;
  afterburner: boolean;
  flare: boolean;
  primaryFire: boolean;
  secondaryFire: boolean;
  nextWeapon: boolean;
  automap: boolean;
  pause: boolean;
  mouseDeltaX: number;
  mouseDeltaY: number;
};

export type ShipState = {
  position: Vec3Tuple;
  velocity: Vec3Tuple;
  rotation: Vec3Tuple;
  shields: number;
  energy: number;
  flares: number;
  score: number;
  weapon: {
    primary: string;
    secondary: string;
    active: string;
    ammoPrimary: number;
    ammoSecondary: number;
  };
};

export type EntityKind = "sector" | "door" | "pickup" | "enemy" | "checkpoint" | "reactor" | "exit" | "secret";

export type WorldEntity = {
  id: string;
  kind: EntityKind;
  label: string;
  position: Vec3Tuple;
  size: Vec3Tuple;
  color: string;
  active: boolean;
  meta?: Record<string, string | number | boolean>;
};

export type RuntimeSnapshot = {
  phase: RuntimePhase;
  levelId: string;
  levelTitle: string;
  objectiveText: string;
  message: string;
  elapsedSeconds: number;
  reactorSecondsLeft: number;
  player: ShipState;
  objectives: Array<{
    id: string;
    label: string;
    complete: boolean;
  }>;
  pickups: Array<{
    id: string;
    label: string;
    collected: boolean;
  }>;
  world: WorldEntity[];
  saveState: SaveState;
  profile?: PlayerProfile;
  leaderboard?: LeaderboardEntry[];
};

export type RuntimeBridge = {
  level: LevelDefinition;
  state: RuntimeSnapshot;
  setProfile(profile?: PlayerProfile): void;
  setLeaderboard(entries: LeaderboardEntry[]): void;
  setPhase(phase: RuntimePhase): void;
  setPause(paused: boolean): void;
  setInput(snapshot: InputSnapshot): void;
  step(dt: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
  attachCanvas(canvas: HTMLCanvasElement | null): void;
  snapshot(): RuntimeSnapshot;
};

export type EngineModule = {
  createBridge?: (level: LevelDefinition) => RuntimeBridge;
};

