import { clamp, distanceVec3 } from "./math.js";
import { weaponOrder, weaponSpecs } from "./definitions.js";
import type { GameStepEvent, GameState, ShipState } from "./types.js";

const nextWeaponId = (current: string, direction: 1 | -1) => {
  const orderedWeapons = weaponOrder as readonly string[];
  const index = orderedWeapons.indexOf(current);
  const safeIndex = index >= 0 ? index : 0;
  const nextIndex = (safeIndex + direction + weaponOrder.length) % weaponOrder.length;
  const fallback = weaponOrder[0];
  return weaponOrder[nextIndex] ?? fallback;
};

const swapWeapon = (ship: ShipState, slot: "primary" | "secondary", direction: 1 | -1): ShipState => ({
  ...ship,
  stats: {
    ...ship.stats,
    currentPrimaryWeapon: slot === "primary" ? nextWeaponId(ship.stats.currentPrimaryWeapon, direction) : ship.stats.currentPrimaryWeapon,
    currentSecondaryWeapon: slot === "secondary" ? nextWeaponId(ship.stats.currentSecondaryWeapon, direction) : ship.stats.currentSecondaryWeapon
  }
});

export const cyclePrimaryWeapon = (state: GameState, direction: 1 | -1 = 1): GameState => ({
  ...state,
  ship: swapWeapon(state.ship, "primary", direction)
});

export const cycleSecondaryWeapon = (state: GameState, direction: 1 | -1 = 1): GameState => ({
  ...state,
  ship: swapWeapon(state.ship, "secondary", direction)
});

const projectileHitEnemy = (state: GameState, weaponDamage: number, weaponRange: number) => {
  const playerPosition = state.ship.position;
  const target = state.enemies
    .filter((enemy) => enemy.active && enemy.behavior !== "destroyed")
    .map((enemy) => ({
      enemy,
      distance: distanceVec3(enemy.position, playerPosition)
    }))
    .filter((entry) => entry.distance <= weaponRange)
    .sort((a, b) => a.distance - b.distance)[0];

  if (!target) {
    return { state, events: [] as GameStepEvent[] };
  }

  const nextEnemies = state.enemies.map((enemy) =>
    enemy.id === target.enemy.id
      ? {
          ...enemy,
          health: clamp(enemy.health - weaponDamage, 0, enemy.maxHealth),
          behavior: enemy.health - weaponDamage <= 0 ? ("destroyed" as const) : enemy.behavior,
          active: enemy.health - weaponDamage <= 0 ? false : enemy.active,
          visible: enemy.health - weaponDamage <= 0 ? false : enemy.visible
        }
      : enemy
  );

  const destroyed = target.enemy.health - weaponDamage <= 0;
  const events: GameStepEvent[] = [
    {
      type: "enemy-damaged",
      payload: {
        enemyId: target.enemy.id,
        damage: weaponDamage,
        remainingHealth: clamp(target.enemy.health - weaponDamage, 0, target.enemy.maxHealth)
      }
    }
  ];

  if (destroyed) {
    events.push({
      type: "enemy-destroyed",
      payload: {
        enemyId: target.enemy.id,
        scoreValue: target.enemy.scoreValue
      }
    });
  }

  return {
    state: {
      ...state,
      enemies: nextEnemies,
      runStats: {
        ...state.runStats,
        robotsDestroyed: destroyed ? state.runStats.robotsDestroyed + 1 : state.runStats.robotsDestroyed
      }
    },
    events
  };
};

export const fireWeapon = (state: GameState, slot: "primary" | "secondary"): { state: GameState; events: GameStepEvent[] } => {
  const ship = state.ship;
  const weaponId = slot === "primary" ? ship.stats.currentPrimaryWeapon : ship.stats.currentSecondaryWeapon;
  const spec = weaponSpecs[weaponId];
  if (!spec) {
    return { state, events: [] };
  }

  const cooldownKey = slot === "primary" ? "primaryCooldown" : "secondaryCooldown";
  const cooldown = ship.stats[cooldownKey];
  if (cooldown > 0) {
    return { state, events: [] };
  }

  if (slot === "secondary" && ship.stats.energy < spec.ammoCost * 2) {
    return { state, events: [] };
  }

  const nextShip = {
    ...ship,
    stats: {
      ...ship.stats,
      [cooldownKey]: spec.cooldownSeconds,
      energy: slot === "secondary" ? Math.max(0, ship.stats.energy - spec.ammoCost * 2) : ship.stats.energy
    }
  } as ShipState;

  const nextStateBase = {
    ...state,
    ship: nextShip,
    runStats: {
      ...state.runStats,
      shotsFired: state.runStats.shotsFired + 1
    }
  };

  const hitResult = projectileHitEnemy(nextStateBase, spec.damage, spec.range);
  return {
    state: hitResult.state,
    events: [
      {
        type: "weapon-fired",
        payload: {
          slot,
          weaponId,
          damage: spec.damage,
          ammoCost: spec.ammoCost
        }
      },
      ...hitResult.events
    ]
  };
};

export const fireFlare = (state: GameState): { state: GameState; events: GameStepEvent[] } => {
  if (state.ship.stats.flareAmmo <= 0 || state.ship.stats.flareCooldown > 0) {
    return { state, events: [] };
  }

  return {
    state: {
      ...state,
      ship: {
        ...state.ship,
        stats: {
          ...state.ship.stats,
          flareAmmo: state.ship.stats.flareAmmo - 1,
          flareCooldown: 0.65
        }
      },
      runStats: {
        ...state.runStats,
        flaresUsed: state.runStats.flaresUsed + 1
      }
    },
    events: [
      {
        type: "flare-fired",
        payload: {
          remainingFlareAmmo: state.ship.stats.flareAmmo - 1
        }
      }
    ]
  };
};

export const updateWeaponTimers = (state: GameState, deltaSeconds: number): GameState => ({
  ...state,
  ship: {
    ...state.ship,
    stats: {
      ...state.ship.stats,
      primaryCooldown: Math.max(0, state.ship.stats.primaryCooldown - deltaSeconds),
      secondaryCooldown: Math.max(0, state.ship.stats.secondaryCooldown - deltaSeconds),
      flareCooldown: Math.max(0, state.ship.stats.flareCooldown - deltaSeconds)
    }
  }
});
