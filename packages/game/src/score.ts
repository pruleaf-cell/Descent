import type { Difficulty, RunResult, SaveState } from "@descent/shared";
import { clamp } from "./math.js";
import type { GameState, ScoreBreakdown } from "./types.js";

const difficultyMultiplier: Record<Difficulty, number> = {
  easy: 0.9,
  normal: 1,
  hard: 1.25
};

export const calculateScoreBreakdown = (state: GameState): ScoreBreakdown => {
  const objectives = state.mission.objectiveStates.filter((objective) => objective.complete).length * 800;
  const enemies = state.runStats.robotsDestroyed * 225;
  const secrets = state.runStats.secretsFound * 300;
  const timeBonus = Math.max(0, Math.round(3500 - state.elapsedSeconds * 18));
  const damagePenalty = Math.round(state.runStats.damageTaken * 10);
  const flarePenalty = state.runStats.flaresUsed * 5;
  const reactorBonus = state.mission.reactor.destroyed ? 2000 : 0;
  const escapeBonus = state.mission.completed ? 2500 : 0;
  const base = 1000;
  const multiplier = difficultyMultiplier[state.difficulty];
  const total = clamp(
    Math.round((base + objectives + enemies + secrets + timeBonus + reactorBonus + escapeBonus - damagePenalty - flarePenalty) * multiplier),
    0,
    Number.MAX_SAFE_INTEGER
  );

  return {
    base,
    objectives,
    enemies,
    secrets,
    timeBonus,
    damagePenalty,
    flarePenalty,
    reactorBonus,
    escapeBonus,
    multiplier,
    total
  };
};

export const calculateScore = (state: GameState): number => calculateScoreBreakdown(state).total;

export const buildSaveState = (state: GameState): SaveState => ({
  checkpointId: state.mission.activeCheckpointId,
  shields: state.ship.stats.shields,
  energy: state.ship.stats.energy,
  flareAmmo: state.ship.stats.flareAmmo,
  primaryWeapon: state.ship.stats.currentPrimaryWeapon,
  secondaryWeapon: state.ship.stats.currentSecondaryWeapon,
  keys: [...state.ship.stats.keys],
  destroyedEncounters: state.enemies.filter((enemy) => enemy.behavior === "destroyed").map((enemy) => enemy.id),
  collectedPickups: state.pickups.filter((pickup) => pickup.collected).map((pickup) => pickup.id),
  objectiveIds: state.mission.objectiveStates.filter((objective) => objective.complete).map((objective) => objective.id),
  score: state.score,
  elapsedSeconds: state.elapsedSeconds,
  reactorArmed: state.mission.reactor.armed,
  reactorDestroyed: state.mission.reactor.destroyed
});

export const buildRunResult = (state: GameState, profileId: string): RunResult => ({
  profileId,
  levelId: state.levelId,
  difficulty: state.difficulty,
  score: state.score,
  elapsedSeconds: state.elapsedSeconds,
  flaresUsed: state.runStats.flaresUsed,
  robotsDestroyed: state.runStats.robotsDestroyed,
  secretsFound: state.runStats.secretsFound,
  escaped: state.mission.completed,
  reactorDestroyed: state.mission.reactor.destroyed
});

