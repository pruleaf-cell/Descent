import { clamp, distanceVec3, normalizeVec3, scaleVec3, subVec3, vec3 } from "./math.js";
import { enemyArchetypes } from "./definitions.js";
import type { GameInput, GameState, GameStepEvent } from "./types.js";

const difficultyEnemyAggression = {
  easy: 0.85,
  normal: 1,
  hard: 1.2
} as const;

export const spawnEnemy = (state: GameState, enemyId: string): GameState => {
  const enemy = state.enemies.find((candidate) => candidate.id === enemyId);
  if (!enemy) {
    return state;
  }

  return {
    ...state,
    enemies: state.enemies.map((candidate) =>
      candidate.id === enemyId
        ? {
            ...candidate,
            active: true,
            visible: true,
            behavior: candidate.behavior === "idle" ? "patrol" : candidate.behavior
          }
        : candidate
    )
  };
};

export const activateTriggeredEnemies = (state: GameState, trigger: "on-enter" | "on-reactor" | "on-key"): GameState => ({
  ...state,
  enemies: state.enemies.map((enemy) =>
    enemy.triggeredBy === trigger
      ? {
          ...enemy,
          active: true,
          visible: true,
          behavior: enemy.behavior === "idle" ? "chase" : enemy.behavior
        }
      : enemy
  )
});

export const damageEnemy = (state: GameState, enemyId: string, damage: number): { state: GameState; events: GameStepEvent[] } => {
  const events: GameStepEvent[] = [];
  const enemy = state.enemies.find((candidate) => candidate.id === enemyId);
  if (!enemy || enemy.behavior === "destroyed") {
    return { state, events };
  }

  const nextHealth = clamp(enemy.health - damage, 0, enemy.maxHealth);
  const destroyed = nextHealth <= 0;
  const nextState = {
    ...state,
    enemies: state.enemies.map((candidate) =>
      candidate.id === enemyId
        ? {
            ...candidate,
            health: nextHealth,
            behavior: destroyed ? "destroyed" : candidate.behavior,
            active: destroyed ? false : candidate.active,
            visible: destroyed ? false : candidate.visible
          }
        : candidate
    ),
    runStats: destroyed
      ? {
          ...state.runStats,
          robotsDestroyed: state.runStats.robotsDestroyed + 1
        }
      : state.runStats
  };

  events.push({
    type: "enemy-damaged",
    payload: { enemyId, damage, remainingHealth: nextHealth }
  });

  if (destroyed) {
    events.push({
      type: "enemy-destroyed",
      payload: {
        enemyId,
        scoreValue: enemy.scoreValue
      }
    });
  }

  return { state: nextState, events };
};

export const updateEnemies = (state: GameState, input: GameInput, deltaSeconds: number): { state: GameState; events: GameStepEvent[] } => {
  const events: GameStepEvent[] = [];
  const aggression = difficultyEnemyAggression[state.difficulty];
  const playerPosition = state.ship.position;

  const updatedEnemies = state.enemies.map((enemy) => {
    if (!enemy.active || enemy.behavior === "destroyed") {
      return enemy;
    }

    const archetype = enemyArchetypes[enemy.type] ?? enemyArchetypes["patrol-drone"];
    if (!archetype) {
      return enemy;
    }
    const distance = distanceVec3(enemy.position, playerPosition);
    const direction = normalizeVec3(subVec3(playerPosition, enemy.position));
    const shouldAttack = distance <= archetype.attackRange * aggression;
    const shouldChase = distance <= archetype.attackRange * 1.75 * aggression;
    const shouldMove = archetype.speed > 0 && shouldChase;

    let velocity = enemy.velocity;
    let position = enemy.position;
    let behavior = enemy.behavior;

    if (shouldAttack) {
      behavior = "attack";
    } else if (shouldChase) {
      behavior = "chase";
    } else {
      behavior = "patrol";
    }

    if (shouldMove) {
      velocity = scaleVec3(direction, archetype.speed * aggression);
      position = {
        x: enemy.position.x + velocity.x * deltaSeconds,
        y: enemy.position.y + velocity.y * deltaSeconds,
        z: enemy.position.z + velocity.z * deltaSeconds
      };
    } else {
      velocity = vec3();
    }

    if (shouldAttack && !input.afterburner) {
      const damage = Math.max(1, Math.round(archetype.damage * aggression));
      events.push({
        type: "enemy-damaged",
        payload: {
          enemyId: enemy.id,
          damage: 0,
          pressure: damage
        }
      });
    }

    return {
      ...enemy,
      velocity,
      position,
      behavior,
      visible: true
    };
  });

  return {
    state: {
      ...state,
      enemies: updatedEnemies
    },
    events
  };
};
