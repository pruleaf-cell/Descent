import { cloneVec3, distanceVec3 } from "./math.js";
import type { GameInput, GameState, GameStepEvent, MissionObjectiveState } from "./types.js";

const completeObjective = (objectiveStates: MissionObjectiveState[], objectiveId: string): MissionObjectiveState[] =>
  objectiveStates.map((objective) => (objective.id === objectiveId ? { ...objective, complete: true } : objective));

const markObjective = (state: GameState, objectiveId: string): { state: GameState; event?: GameStepEvent } => {
  const objective = state.mission.objectiveStates.find((entry) => entry.id === objectiveId);
  if (!objective || objective.complete) {
    return { state };
  }

  return {
    state: {
      ...state,
      mission: {
        ...state.mission,
        objectiveStates: completeObjective(state.mission.objectiveStates, objectiveId)
      }
    },
    event: {
      type: "objective-complete",
      payload: { objectiveId }
    }
  };
};

export const updateMissionProgress = (state: GameState): { state: GameState; events: GameStepEvent[] } => {
  const events: GameStepEvent[] = [];
  let nextState = state;

  const currentCheckpoint = state.level.checkpoints.find((checkpoint) => checkpoint.id === state.mission.activeCheckpointId) ?? state.level.checkpoints[0];
  if (currentCheckpoint && distanceVec3(state.ship.position, currentCheckpoint.position) < 3) {
    nextState = {
      ...nextState,
      ship: {
        ...nextState.ship,
        lastSafePosition: cloneVec3(state.ship.position),
        lastSafeOrientation: { ...state.ship.orientation }
      }
    };
    events.push({
      type: "checkpoint-hit",
      payload: {
        checkpointId: currentCheckpoint.id
      }
    });
  }

  const hubSector = state.level.sectors.find((sector) => sector.kind === "hub");
  if (hubSector && distanceVec3(state.ship.position, hubSector.center) < Math.max(hubSector.size.x, hubSector.size.z) * 0.45) {
    const result = markObjective(nextState, "reach-hub");
    nextState = result.state;
    if (result.event) {
      events.push(result.event);
    }
  }

  const azureKeyPickup = nextState.pickups.find((pickup) => pickup.keyColor === "azure");
  if (azureKeyPickup?.collected) {
    const result = markObjective(nextState, "collect-azure");
    nextState = result.state;
    if (result.event) {
      events.push(result.event);
    }
  }

  const crimsonKeyPickup = nextState.pickups.find((pickup) => pickup.keyColor === "crimson");
  if (crimsonKeyPickup?.collected) {
    const result = markObjective(nextState, "collect-crimson");
    nextState = result.state;
    if (result.event) {
      events.push(result.event);
    }
  }

  if (nextState.mission.reactor.armed) {
    const reactorObjective = markObjective(nextState, "arm-reactor");
    nextState = reactorObjective.state;
    if (reactorObjective.event) {
      events.push(reactorObjective.event);
    }
  }

  if (nextState.mission.reactor.destroyed) {
    const destroyedObjective = markObjective(nextState, "destroy-reactor");
    nextState = destroyedObjective.state;
    if (destroyedObjective.event) {
      events.push(destroyedObjective.event);
    }
  }

  if (nextState.mission.completed) {
    const escapeObjective = markObjective(nextState, "escape");
    nextState = escapeObjective.state;
    if (escapeObjective.event) {
      events.push(escapeObjective.event);
    }
  }

  return { state: nextState, events };
};

export const interactWithMission = (state: GameState, input: GameInput): { state: GameState; events: GameStepEvent[] } => {
  if (!input.interact) {
    return { state, events: [] };
  }

  const events: GameStepEvent[] = [];
  let nextState = state;

  for (const door of nextState.doors) {
    if (!door.open) {
      const doorDefinition = nextState.level.doors.find((entry) => entry.id === door.id);
      if (!doorDefinition) {
        continue;
      }

      const doorCenter = doorDefinition.position;
      const distance = distanceVec3(nextState.ship.position, doorCenter);
      if (distance < 4) {
        const canOpen = !doorDefinition.keyColor || nextState.ship.stats.keys.includes(doorDefinition.keyColor);
        if (canOpen) {
          nextState = {
            ...nextState,
            doors: nextState.doors.map((entry) => (entry.id === door.id ? { ...entry, open: true } : entry))
          };
          events.push({
            type: "door-opened",
            payload: {
              doorId: door.id
            }
          });
        }
      }
    }
  }

  const keyPickup = nextState.pickups.find((pickup) => !pickup.collected && pickup.type === "key" && distanceVec3(pickup.position, nextState.ship.position) < 3);
  if (keyPickup?.keyColor && !nextState.ship.stats.keys.includes(keyPickup.keyColor)) {
    nextState = {
      ...nextState,
      ship: {
        ...nextState.ship,
        stats: {
          ...nextState.ship.stats,
          keys: [...nextState.ship.stats.keys, keyPickup.keyColor]
        }
      }
    };
  }

  const reactorSwitch = nextState.level.switches.find((entry) => entry.armsReactor && distanceVec3(entry.position, nextState.ship.position) < 3);
  if (reactorSwitch && !nextState.mission.reactor.armed) {
    nextState = {
      ...nextState,
      mission: {
        ...nextState.mission,
        reactor: {
          ...nextState.mission.reactor,
          armed: true
        }
      },
      enemies: nextState.enemies.map((enemy) =>
        enemy.triggeredBy === "on-reactor"
          ? {
              ...enemy,
              active: true,
              visible: true,
              behavior: "chase"
            }
          : enemy
      )
    };
    events.push({
      type: "reactor-armed",
      payload: {
        switchId: reactorSwitch.id
      }
    });
  }

  return { state: nextState, events };
};

export const completeMissionIfEscaped = (state: GameState): { state: GameState; events: GameStepEvent[] } => {
  if (state.mission.completed || state.mission.failed || !state.mission.reactor.destroyed) {
    return { state, events: [] };
  }

  const exitSector = state.level.exit;
  if (distanceVec3(state.ship.position, exitSector.position) < 5) {
    return {
      state: {
        ...state,
        mission: {
          ...state.mission,
          completed: true,
          escapeUnlocked: true
        }
      },
      events: [
        {
          type: "mission-complete",
          payload: {
            levelId: state.levelId
          }
        }
      ]
    };
  }

  return { state, events: [] };
};

export const failMissionIfReactorExpired = (state: GameState): { state: GameState; events: GameStepEvent[] } => {
  if (state.mission.completed || state.mission.failed || !state.mission.reactor.armed) {
    return { state, events: [] };
  }

  if (state.mission.reactor.countdownRemaining > 0) {
    return { state, events: [] };
  }

  return {
    state: {
      ...state,
      mission: {
        ...state.mission,
        failed: true
      }
    },
    events: [
      {
        type: "mission-failed",
        payload: {
          reason: "reactor-timer-expired"
        }
      }
    ]
  };
};
