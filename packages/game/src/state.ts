import type { Difficulty, LevelDefinition, SaveState } from "@descent/shared";
import { defaultLevelId } from "@descent/shared";
import { clamp, cloneVec3, vec3 } from "./math.js";
import { enemyArchetypes } from "./definitions.js";
import type {
  CreateGameStateOptions,
  DoorState,
  GameState,
  MissionObjectiveState,
  PickupState,
  ShipState
} from "./types.js";

const difficultyScale: Record<Difficulty, { health: number; damage: number; time: number; pickup: number }> = {
  easy: { health: 0.9, damage: 0.85, time: 1.2, pickup: 1.2 },
  normal: { health: 1, damage: 1, time: 1, pickup: 1 },
  hard: { health: 1.2, damage: 1.15, time: 0.8, pickup: 0.8 }
};

const createShip = (level: LevelDefinition): ShipState => {
  const start = level.checkpoints.find((checkpoint) => checkpoint.id === level.startCheckpointId) ?? level.checkpoints[0];
  if (!start) {
    throw new Error(`Level ${level.id} is missing a start checkpoint.`);
  }

  return {
    position: cloneVec3(start.position),
    velocity: vec3(),
    orientation: { ...start.heading },
    stats: {
      shields: 100,
      energy: 100,
      flareAmmo: 6,
      currentPrimaryWeapon: "pulse",
      currentSecondaryWeapon: "nova",
      primaryCooldown: 0,
      secondaryCooldown: 0,
      flareCooldown: 0,
      keys: []
    },
    lastSafePosition: cloneVec3(start.position),
    lastSafeOrientation: { ...start.heading }
  };
};

const createPickups = (level: LevelDefinition): PickupState[] =>
  level.pickups.map((pickup) => ({
    id: pickup.id,
    type: pickup.type,
    position: cloneVec3(pickup.position),
    amount: pickup.amount,
    keyColor: pickup.keyColor,
    weaponId: pickup.weaponId,
    powerupId: pickup.powerupId,
    collected: false
  }));

const createDoors = (level: LevelDefinition): DoorState[] => level.doors.map((door) => ({ id: door.id, open: !door.keyColor }));

const createMissionObjectives = (level: LevelDefinition): MissionObjectiveState[] =>
  level.objectives.map((objective) => ({ id: objective.id, complete: false }));

const createEnemies = (level: LevelDefinition, difficulty: Difficulty) => {
  const multiplier = difficultyScale[difficulty].health;
  return level.encounters.map((encounter) => {
    const archetype = enemyArchetypes[encounter.enemyType];
    if (!archetype) {
      throw new Error(`Unknown enemy archetype: ${encounter.enemyType}`);
    }

    return {
      id: encounter.id,
      type: encounter.enemyType,
      sectorId: encounter.sectorId,
      position: cloneVec3(encounter.position),
      velocity: vec3(),
      health: Math.round(archetype.maxHealth * encounter.healthMultiplier * multiplier),
      maxHealth: Math.round(archetype.maxHealth * encounter.healthMultiplier * multiplier),
      behavior: "idle" as const,
      active: false,
      visible: false,
      scoreValue: archetype.scoreValue,
      triggeredBy: encounter.trigger
    };
  });
};

export const createGameState = (level: LevelDefinition, options: CreateGameStateOptions = {}): GameState => {
  const difficulty = options.difficulty ?? "normal";
  const startCheckpointId = options.startCheckpointId ?? level.startCheckpointId;
  const startCheckpoint = level.checkpoints.find((checkpoint) => checkpoint.id === startCheckpointId) ?? level.checkpoints[0];

  if (!startCheckpoint) {
    throw new Error(`Level ${level.id} is missing a usable checkpoint.`);
  }

  const ship = createShip(level);
  ship.position = cloneVec3(startCheckpoint.position);
  ship.orientation = { ...startCheckpoint.heading };
  ship.lastSafePosition = cloneVec3(startCheckpoint.position);
  ship.lastSafeOrientation = { ...startCheckpoint.heading };

  const completedObjectiveStates = createMissionObjectives(level);
  const timeScale = difficultyScale[difficulty];
  const reactorCountdown = Math.round(level.reactor.countdownSeconds * timeScale.time);

  return {
    level,
    levelId: level.id ?? defaultLevelId,
    difficulty,
    tick: 0,
    elapsedSeconds: 0,
    ship,
    enemies: createEnemies(level, difficulty),
    pickups: createPickups(level),
    doors: createDoors(level),
    mission: {
      activeCheckpointId: startCheckpoint.id,
      objectiveStates: completedObjectiveStates,
      reactor: {
        hitPoints: level.reactor.hitPoints,
        countdownSeconds: level.reactor.countdownSeconds,
        countdownRemaining: reactorCountdown,
        armed: false,
        destroyed: false
      },
      escapeUnlocked: false,
      completed: false,
      failed: false
    },
    runStats: {
      flaresUsed: 0,
      robotsDestroyed: 0,
      secretsFound: 0,
      damageTaken: 0,
      shotsFired: 0
    },
    currentSectorId: startCheckpoint.sectorId,
    score: 0
  };
};

export const restoreShipFromSave = (level: LevelDefinition, saveState: SaveState): ShipState => {
  const ship = createShip(level);
  ship.stats.shields = clamp(saveState.shields, 0, 200);
  ship.stats.energy = clamp(saveState.energy, 0, 200);
  ship.stats.flareAmmo = saveState.flareAmmo;
  ship.stats.currentPrimaryWeapon = saveState.primaryWeapon;
  ship.stats.currentSecondaryWeapon = saveState.secondaryWeapon;
  ship.stats.keys = [...saveState.keys];
  return ship;
};

export const applySaveState = (state: GameState, saveState: SaveState): GameState => {
  const checkpoint = state.level.checkpoints.find((entry) => entry.id === saveState.checkpointId) ?? state.level.checkpoints[0];
  if (!checkpoint) {
    throw new Error(`Unable to restore checkpoint ${saveState.checkpointId}`);
  }

  const ship = restoreShipFromSave(state.level, saveState);
  ship.position = cloneVec3(checkpoint.position);
  ship.orientation = { ...checkpoint.heading };
  ship.lastSafePosition = cloneVec3(checkpoint.position);
  ship.lastSafeOrientation = { ...checkpoint.heading };

  return {
    ...state,
    ship,
    currentSectorId: checkpoint.sectorId,
    mission: {
      ...state.mission,
      activeCheckpointId: checkpoint.id,
      reactor: {
        ...state.mission.reactor,
        armed: saveState.reactorArmed,
        destroyed: saveState.reactorDestroyed
      }
    },
    score: saveState.score,
    elapsedSeconds: saveState.elapsedSeconds
  };
};

export const getDifficultyScale = (difficulty: Difficulty) => difficultyScale[difficulty];

export const markSafePosition = (state: GameState): GameState => ({
  ...state,
  ship: {
    ...state.ship,
    lastSafePosition: cloneVec3(state.ship.position),
    lastSafeOrientation: { ...state.ship.orientation }
  }
});
