import type { EnemyArchetype, WeaponSpec } from "./types.js";

export const weaponOrder = ["pulse", "volley", "shredder", "concussion", "nova"] as const;

export const weaponSpecs: Record<string, WeaponSpec> = {
  pulse: {
    id: "pulse",
    cooldownSeconds: 0.18,
    ammoCost: 0,
    damage: 12,
    range: 60,
    speed: 180,
    scoreValue: 15
  },
  volley: {
    id: "volley",
    cooldownSeconds: 0.32,
    ammoCost: 1,
    damage: 26,
    range: 70,
    speed: 160,
    scoreValue: 35
  },
  shredder: {
    id: "shredder",
    cooldownSeconds: 0.48,
    ammoCost: 2,
    damage: 42,
    range: 80,
    speed: 150,
    scoreValue: 65
  },
  concussion: {
    id: "concussion",
    cooldownSeconds: 0.7,
    ammoCost: 2,
    damage: 68,
    range: 90,
    speed: 130,
    scoreValue: 90
  },
  nova: {
    id: "nova",
    cooldownSeconds: 1,
    ammoCost: 4,
    damage: 105,
    range: 110,
    speed: 120,
    scoreValue: 150,
    secondary: true
  }
};

export const enemyArchetypes: Record<string, EnemyArchetype> = {
  "patrol-drone": {
    type: "patrol-drone",
    maxHealth: 30,
    speed: 8,
    damage: 6,
    attackRange: 16,
    turnRate: 1.8,
    scoreValue: 100
  },
  "sentry-turret": {
    type: "sentry-turret",
    maxHealth: 48,
    speed: 0,
    damage: 10,
    attackRange: 24,
    turnRate: 2.2,
    scoreValue: 140
  },
  hunter: {
    type: "hunter",
    maxHealth: 58,
    speed: 12,
    damage: 12,
    attackRange: 22,
    turnRate: 2.6,
    scoreValue: 180
  },
  "heavy-guard": {
    type: "heavy-guard",
    maxHealth: 82,
    speed: 6,
    damage: 18,
    attackRange: 20,
    turnRate: 1.3,
    scoreValue: 240
  },
  "reactor-elite": {
    type: "reactor-elite",
    maxHealth: 110,
    speed: 9,
    damage: 24,
    attackRange: 28,
    turnRate: 1.9,
    scoreValue: 320
  }
};

