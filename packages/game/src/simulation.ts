import type { Difficulty, LevelDefinition, RunResult, SaveState } from "@descent/shared";
import { addVec3, clamp, scaleVec3, wrapAngle } from "./math.js";
import { buildRunResult, buildSaveState, calculateScore } from "./score.js";
import { applySaveState, createGameState, getDifficultyScale } from "./state.js";
import { completeMissionIfEscaped, failMissionIfReactorExpired, interactWithMission, updateMissionProgress } from "./mission.js";
import { fireFlare, fireWeapon, updateWeaponTimers } from "./weapons.js";
import { activateTriggeredEnemies, updateEnemies } from "./enemies.js";
import type {
  GameEngine,
  GameInput,
  GameState,
  GameStepEvent,
  GameStepResult,
  SimulationClock,
  SimulationState
} from "./types.js";
import type { LeaderboardEntry } from "@descent/shared";
import { distanceVec3 } from "./math.js";

const fixedDeltaSeconds = 1 / 60;

const moveShip = (state: GameState, input: GameInput, deltaSeconds: number): GameState => {
  const scale = getDifficultyScale(state.difficulty);
  const acceleration = 30 * scale.pickup;
  const afterburnerFactor = input.afterburner ? 1.7 : 1;
  const thrustForward = clamp(input.thrustForward ?? 0, -1, 1);
  const thrustRight = clamp(input.thrustRight ?? 0, -1, 1);
  const thrustUp = clamp(input.thrustUp ?? 0, -1, 1);
  const yaw = clamp(input.yaw ?? 0, -1, 1);
  const pitch = clamp(input.pitch ?? 0, -1, 1);
  const roll = clamp(input.roll ?? 0, -1, 1);
  const orientation = {
    pitch: wrapAngle(state.ship.orientation.pitch + pitch * deltaSeconds * 2.7),
    yaw: wrapAngle(state.ship.orientation.yaw + yaw * deltaSeconds * 2.7),
    roll: wrapAngle(state.ship.orientation.roll + roll * deltaSeconds * 3.1)
  };
  const forward = {
    x: Math.sin(orientation.yaw) * Math.cos(orientation.pitch),
    y: -Math.sin(orientation.pitch),
    z: -Math.cos(orientation.yaw) * Math.cos(orientation.pitch)
  };
  const right = {
    x: Math.cos(orientation.yaw),
    y: 0,
    z: Math.sin(orientation.yaw)
  };
  const up = {
    x: 0,
    y: 1,
    z: 0
  };
  const desiredVelocity = addVec3(
    addVec3(scaleVec3(forward, thrustForward * acceleration * afterburnerFactor), scaleVec3(right, thrustRight * acceleration * 0.7)),
    scaleVec3(up, thrustUp * acceleration * 0.6)
  );
  const nextVelocity = {
    x: state.ship.velocity.x + (desiredVelocity.x - state.ship.velocity.x) * clamp(deltaSeconds * 4, 0, 1),
    y: state.ship.velocity.y + (desiredVelocity.y - state.ship.velocity.y) * clamp(deltaSeconds * 4, 0, 1),
    z: state.ship.velocity.z + (desiredVelocity.z - state.ship.velocity.z) * clamp(deltaSeconds * 4, 0, 1)
  };
  const drag = input.afterburner ? 0.012 : 0.08;
  const nextPosition = {
    x: state.ship.position.x + nextVelocity.x * deltaSeconds,
    y: state.ship.position.y + nextVelocity.y * deltaSeconds,
    z: state.ship.position.z + nextVelocity.z * deltaSeconds
  };

  return {
    ...state,
    ship: {
      ...state.ship,
      position: nextPosition,
      velocity: {
        x: nextVelocity.x * (1 - drag),
        y: nextVelocity.y * (1 - drag),
        z: nextVelocity.z * (1 - drag)
      },
      orientation
    }
  };
};

const collectPickups = (state: GameState): { state: GameState; events: GameStepEvent[] } => {
  const events: GameStepEvent[] = [];
  let nextState = state;

  nextState = {
    ...nextState,
    pickups: nextState.pickups.map((pickup) => {
      if (pickup.collected) {
        return pickup;
      }

      const closeEnough = distanceVec3(nextState.ship.position, pickup.position) < 3;
      if (!closeEnough) {
        return pickup;
      }

      events.push({
        type: "pickup-collected",
        payload: {
          pickupId: pickup.id,
          pickupType: pickup.type
        }
      });

      if (pickup.type === "flare") {
        nextState = {
          ...nextState,
          ship: {
            ...nextState.ship,
            stats: {
              ...nextState.ship.stats,
              flareAmmo: nextState.ship.stats.flareAmmo + pickup.amount
            }
          }
        };
      }

      if (pickup.type === "shield") {
        nextState = {
          ...nextState,
          ship: {
            ...nextState.ship,
            stats: {
              ...nextState.ship.stats,
              shields: clamp(nextState.ship.stats.shields + pickup.amount, 0, 200)
            }
          }
        };
      }

      if (pickup.type === "energy") {
        nextState = {
          ...nextState,
          ship: {
            ...nextState.ship,
            stats: {
              ...nextState.ship.stats,
              energy: clamp(nextState.ship.stats.energy + pickup.amount, 0, 200)
            }
          }
        };
      }

      if (pickup.type === "ammo-primary") {
        nextState = {
          ...nextState,
          ship: {
            ...nextState.ship,
            stats: {
              ...nextState.ship.stats,
              energy: clamp(nextState.ship.stats.energy + pickup.amount, 0, 200)
            }
          }
        };
      }

      if (pickup.type === "key" && pickup.keyColor) {
        if (!nextState.ship.stats.keys.includes(pickup.keyColor)) {
          nextState = {
            ...nextState,
            ship: {
              ...nextState.ship,
              stats: {
                ...nextState.ship.stats,
                keys: [...nextState.ship.stats.keys, pickup.keyColor]
              }
            }
          };
        }
      }

      if (pickup.type === "weapon" && pickup.weaponId) {
        nextState = {
          ...nextState,
          ship: {
            ...nextState.ship,
            stats: {
              ...nextState.ship.stats,
              currentSecondaryWeapon: pickup.weaponId
            }
          }
        };
      }

      if (pickup.type === "powerup" && pickup.powerupId === "phase-shield") {
        nextState = {
          ...nextState,
          ship: {
            ...nextState.ship,
            stats: {
              ...nextState.ship.stats,
              shields: clamp(nextState.ship.stats.shields + 25, 0, 200)
            }
          }
        };
      }

      return {
        ...pickup,
        collected: true
      };
    })
  };

  return { state: nextState, events };
};

const updateReactor = (state: GameState, deltaSeconds: number): GameState => {
  if (!state.mission.reactor.armed || state.mission.reactor.destroyed || state.mission.failed) {
    return state;
  }

  const remaining = clamp(state.mission.reactor.countdownRemaining - deltaSeconds, 0, state.mission.reactor.countdownSeconds);
  return {
    ...state,
    mission: {
      ...state.mission,
      reactor: {
        ...state.mission.reactor,
        countdownRemaining: remaining,
        destroyed: remaining <= 0
      }
    }
  };
};

const updateDamageFromEnemies = (state: GameState): GameState => {
  const closestThreat = state.enemies
    .filter((enemy) => enemy.active && enemy.behavior !== "destroyed")
    .map((enemy) => ({
      enemy,
      distance: distanceVec3(enemy.position, state.ship.position)
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  if (!closestThreat || closestThreat.distance > 4.5) {
    return state;
  }

  const archetypeDamage = closestThreat.enemy.scoreValue / 50;
  const damage = Math.max(1, Math.round(archetypeDamage * getDifficultyScale(state.difficulty).damage));
  return {
    ...state,
    ship: {
      ...state.ship,
      stats: {
        ...state.ship.stats,
        shields: clamp(state.ship.stats.shields - damage, 0, 200)
      }
    },
    runStats: {
      ...state.runStats,
      damageTaken: state.runStats.damageTaken + damage
    }
  };
};

const activateMissionTriggers = (state: GameState): GameState => {
  let nextState = state;
  const sector = nextState.level.sectors.find((candidate) => candidate.id === nextState.currentSectorId);
  if (sector?.kind === "hub") {
    nextState = activateTriggeredEnemies(nextState, "on-enter");
  }
  if (nextState.mission.reactor.armed) {
    nextState = activateTriggeredEnemies(nextState, "on-reactor");
  }
  return nextState;
};

const updateCurrentSector = (state: GameState): GameState => {
  const sector = state.level.sectors.find((candidate) => {
    const halfX = candidate.size.x / 2;
    const halfY = candidate.size.y / 2;
    const halfZ = candidate.size.z / 2;
    return (
      state.ship.position.x >= candidate.center.x - halfX &&
      state.ship.position.x <= candidate.center.x + halfX &&
      state.ship.position.y >= candidate.center.y - halfY &&
      state.ship.position.y <= candidate.center.y + halfY &&
      state.ship.position.z >= candidate.center.z - halfZ &&
      state.ship.position.z <= candidate.center.z + halfZ
    );
  });

  if (!sector) {
    return state;
  }

  return {
    ...state,
    currentSectorId: sector.id
  };
};

export const stepGameState = (state: GameState, input: GameInput, deltaSeconds: number): GameStepResult => {
  const events: GameStepEvent[] = [];
  let nextState = state;
  nextState = moveShip(nextState, input, deltaSeconds);
  nextState = updateWeaponTimers(nextState, deltaSeconds);
  const interaction = interactWithMission(nextState, input);
  nextState = interaction.state;
  events.push(...interaction.events);
  const pickupResult = collectPickups(nextState);
  nextState = pickupResult.state;
  events.push(...pickupResult.events);

  if (input.firePrimary) {
    const fired = fireWeapon(nextState, "primary");
    nextState = fired.state;
    events.push(...fired.events);
  }

  if (input.fireSecondary) {
    const fired = fireWeapon(nextState, "secondary");
    nextState = fired.state;
    events.push(...fired.events);
  }

  if (input.flare) {
    const flare = fireFlare(nextState);
    nextState = flare.state;
    events.push(...flare.events);
  }

  const enemyUpdate = updateEnemies(nextState, input, deltaSeconds);
  nextState = enemyUpdate.state;
  events.push(...enemyUpdate.events);
  nextState = updateReactor(nextState, deltaSeconds);
  nextState = updateDamageFromEnemies(nextState);
  nextState = updateCurrentSector(nextState);
  nextState = activateMissionTriggers(nextState);

  const missionProgress = updateMissionProgress(nextState);
  nextState = missionProgress.state;
  events.push(...missionProgress.events);
  const escapeResult = completeMissionIfEscaped(nextState);
  nextState = escapeResult.state;
  events.push(...escapeResult.events);
  const failResult = failMissionIfReactorExpired(nextState);
  nextState = failResult.state;
  events.push(...failResult.events);

  const score = calculateScore(nextState);
  nextState = {
    ...nextState,
    tick: nextState.tick + 1,
    elapsedSeconds: nextState.elapsedSeconds + deltaSeconds,
    score
  };

  return {
    state: nextState,
    events,
    ticks: 1
  };
};

export const stepGameFixed = (state: GameState, input: GameInput, elapsedSeconds: number, stepSize = fixedDeltaSeconds): SimulationState => {
  let accumulator = elapsedSeconds;
  let nextState = state;
  while (accumulator >= stepSize) {
    const result = stepGameState(nextState, input, stepSize);
    nextState = result.state;
    accumulator -= stepSize;
  }

  return {
    state: nextState,
    accumulator
  };
};

export class DescentGameEngine implements GameEngine {
  private _state: GameState;
  private _clock: SimulationClock;

  constructor(level: LevelDefinition, options: { difficulty?: Difficulty; startCheckpointId?: string } = {}) {
    this._state = createGameState(level, options);
    this._clock = {
      fixedDeltaSeconds,
      totalSeconds: 0,
      ticks: 0
    };
  }

  public get state(): GameState {
    return this._state;
  }

  public get clock(): SimulationClock {
    return this._clock;
  }

  public step(input: GameInput, deltaSeconds: number): GameStepResult {
    let accumulator = deltaSeconds;
    const events: GameStepEvent[] = [];
    let ticks = 0;

    while (accumulator >= fixedDeltaSeconds) {
      const result = stepGameState(this._state, input, fixedDeltaSeconds);
      this._state = result.state;
      events.push(...result.events);
      accumulator -= fixedDeltaSeconds;
      ticks += result.ticks;
      this._clock.ticks += result.ticks;
      this._clock.totalSeconds += fixedDeltaSeconds;
    }

    return {
      state: this._state,
      events,
      ticks
    };
  }

  public reset(saveState?: SaveState): GameState {
    if (saveState) {
      this._state = applySaveState(this._state, saveState);
    } else {
      this._state = createGameState(this._state.level, {
        difficulty: this._state.difficulty,
        startCheckpointId: this._state.level.startCheckpointId
      });
    }
    this._clock = {
      fixedDeltaSeconds,
      totalSeconds: 0,
      ticks: 0
    };
    return this._state;
  }

  public checkpoint(): SaveState {
    return buildSaveState(this._state);
  }

  public runResult(profileId: string): RunResult {
    return buildRunResult(this._state, profileId);
  }

  public leaderboardEntry(profileId: string, pilotName: string): LeaderboardEntry {
    return {
      id: `${profileId}-${this._state.levelId}-${this._state.tick}`,
      pilotName,
      levelId: this._state.levelId,
      difficulty: this._state.difficulty,
      score: this._state.score,
      elapsedSeconds: this._state.elapsedSeconds,
      escaped: this._state.mission.completed,
      reactorDestroyed: this._state.mission.reactor.destroyed,
      createdAt: new Date().toISOString()
    };
  }
}

export const createGameEngine = (level: LevelDefinition, options: { difficulty?: Difficulty; startCheckpointId?: string } = {}) =>
  new DescentGameEngine(level, options);
