import { describe, expect, it } from "vitest";
import type { LevelDefinition } from "@descent/shared";
import {
  buildSaveState,
  calculateScore,
  createGameEngine,
  createGameState,
  fireFlare,
  stepGameState
} from "../src/index.js";

describe("gameplay engine", () => {
  const level: LevelDefinition = {
    id: "test-mine",
    title: "Test Mine",
    description: "A compact mine for gameplay tests.",
    palette: {
      background: "#000000",
      accent: "#ff7a18",
      warning: "#ff3b30"
    },
    sectors: [
      { id: "entry", label: "Entry", center: { x: 0, y: 0, z: 0 }, size: { x: 20, y: 8, z: 20 }, kind: "entry" },
      { id: "hub", label: "Hub", center: { x: 0, y: 0, z: -24 }, size: { x: 24, y: 8, z: 24 }, kind: "hub" },
      { id: "reactor", label: "Reactor", center: { x: 0, y: 0, z: -48 }, size: { x: 18, y: 10, z: 18 }, kind: "reactor" }
    ],
    doors: [
      { id: "door-entry-hub", fromSectorId: "entry", toSectorId: "hub", position: { x: 0, y: 0, z: -10 }, size: { x: 4, y: 4, z: 1 } },
      { id: "door-hub-reactor", fromSectorId: "hub", toSectorId: "reactor", position: { x: 0, y: 0, z: -36 }, size: { x: 4, y: 4, z: 1 }, opensOnSwitchId: "switch-reactor" }
    ],
    switches: [
      { id: "switch-reactor", sectorId: "reactor", position: { x: 0, y: 0, z: -44 }, armsReactor: true }
    ],
    checkpoints: [
      { id: "start", sectorId: "entry", position: { x: 0, y: 0, z: 4 }, heading: { pitch: 0, yaw: Math.PI, roll: 0 } }
    ],
    pickups: [
      { id: "flare", type: "flare", position: { x: 0, y: 0, z: -2 }, amount: 2 }
    ],
    encounters: [
      {
        id: "drone",
        sectorId: "hub",
        enemyType: "patrol-drone",
        position: { x: 0, y: 0, z: -22 },
        patrolRadius: 4,
        trigger: "on-enter",
        healthMultiplier: 1
      }
    ],
    objectives: [
      { id: "reach-hub", label: "Reach hub", kind: "reach-sector", sectorId: "hub" },
      { id: "arm-reactor", label: "Arm reactor", kind: "arm-reactor", sectorId: "reactor" },
      { id: "destroy-reactor", label: "Destroy reactor", kind: "destroy-reactor", sectorId: "reactor" },
      { id: "escape", label: "Escape", kind: "escape", sectorId: "entry" }
    ],
    startCheckpointId: "start",
    reactor: {
      sectorId: "reactor",
      position: { x: 0, y: 0, z: -48 },
      hitPoints: 100,
      countdownSeconds: 30
    },
    exit: {
      sectorId: "entry",
      position: { x: 0, y: 0, z: 8 }
    },
    secrets: []
  };

  it("consumes flares and respects flare cooldown", () => {
    const state = createGameState(level);
    const first = fireFlare(state);

    expect(first.state.ship.stats.flareAmmo).toBe(state.ship.stats.flareAmmo - 1);
    expect(first.state.runStats.flaresUsed).toBe(1);

    const second = fireFlare(first.state);
    expect(second.state.ship.stats.flareAmmo).toBe(first.state.ship.stats.flareAmmo);
    expect(second.events).toHaveLength(0);
  });

  it("moves the ship forward and advances simulation with fixed steps", () => {
    const state = createGameState(level);
    const result = stepGameState(state, { thrustForward: 1 }, 1 / 60);

    expect(result.state.tick).toBe(1);
    expect(result.state.elapsedSeconds).toBeCloseTo(1 / 60);
    expect(result.state.ship.position.z).not.toBe(state.ship.position.z);
  });

  it("produces save state and score from the current game state", () => {
    const engine = createGameEngine(level);
    const afterFiring = fireFlare(engine.state);
    const saveState = buildSaveState(afterFiring.state);

    expect(saveState.checkpointId).toBe(level.startCheckpointId);
    expect(saveState.flareAmmo).toBe(afterFiring.state.ship.stats.flareAmmo);
    expect(calculateScore(afterFiring.state)).toBeGreaterThanOrEqual(0);
  });
});
