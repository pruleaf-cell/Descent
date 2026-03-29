import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  contentManifestSchema,
  defaultLevelId,
  levelSchema,
  type ContentManifest,
  type EncounterDefinition,
  type LevelDefinition,
  type ObjectiveDefinition,
  type PickupDefinition,
  type SectorDefinition
} from "@descent/shared";

const dataPath = fileURLToPath(new URL("../data/crimson-foundry.json", import.meta.url));
const rawLevel = JSON.parse(readFileSync(dataPath, "utf8")) as unknown;
const parsedLevel = levelSchema.parse(rawLevel);

export const levels = [parsedLevel] satisfies LevelDefinition[];
export const primaryLevel = parsedLevel;

export function getLevel(levelId: string): LevelDefinition | undefined {
  return levels.find((level) => level.id === levelId);
}

export function assertLevel(levelId: string): LevelDefinition {
  const level = getLevel(levelId);
  if (!level) {
    throw new Error(`Unknown level: ${levelId}`);
  }
  return level;
}

export function getLevelSummary(level: LevelDefinition) {
  return {
    id: level.id,
    title: level.title,
    description: level.description,
    objectiveLabels: level.objectives.map((objective) => objective.label),
    sectorCount: level.sectors.length,
    checkpointCount: level.checkpoints.length,
    enemyCount: level.encounters.length,
    pickupCount: level.pickups.length,
    secretCount: level.secrets.length,
    hasReactorCountdown: Boolean(level.reactor.countdownSeconds)
  };
}

export function getMissionBrief(level: LevelDefinition = primaryLevel) {
  const objectiveChain = level.objectives.map((objective, index) => `${index + 1}. ${objective.label}`);
  return {
    title: level.title,
    tone: "retro-industrial infiltration",
    missionText: level.description,
    objectiveChain,
    combatNotes: [
      "Use flares to keep tunnels readable when the mine goes dark.",
      "Spend missiles on heavy guards and reactor defenders.",
      "Keep moving in 6DOF space; the mine rewards constant motion."
    ],
    keyTargets: level.pickups
      .filter((pickup) => pickup.type === "key")
      .map((pickup) => `${pickup.keyColor ?? "unknown"} key`),
    escapeCondition: "Overload the reactor and reach the entry bay before detonation."
  };
}

export function getSectorMap(level: LevelDefinition = primaryLevel) {
  return Object.fromEntries(level.sectors.map((sector) => [sector.id, sector])) as Record<string, SectorDefinition>;
}

export function getObjectiveMap(level: LevelDefinition = primaryLevel) {
  return Object.fromEntries(level.objectives.map((objective) => [objective.id, objective])) as Record<
    string,
    ObjectiveDefinition
  >;
}

export function getPickupMap(level: LevelDefinition = primaryLevel) {
  return Object.fromEntries(level.pickups.map((pickup) => [pickup.id, pickup])) as Record<string, PickupDefinition>;
}

export function getEncounterMap(level: LevelDefinition = primaryLevel) {
  return Object.fromEntries(level.encounters.map((encounter) => [encounter.id, encounter])) as Record<
    string,
    EncounterDefinition
  >;
}

export function buildContentManifest(levelsInput: LevelDefinition[] = levels): ContentManifest {
  return contentManifestSchema.parse({
    generatedAt: new Date().toISOString(),
    levels: levelsInput.map((entry) => ({
      id: entry.id,
      title: entry.title,
      checkpointCount: entry.checkpoints.length,
      objectiveCount: entry.objectives.length,
      enemyCount: entry.encounters.length,
      pickupCount: entry.pickups.length
    }))
  });
}

export const contentManifest = buildContentManifest();
export const missionBrief = getMissionBrief();
export const levelIndex = Object.fromEntries(levels.map((level) => [level.id, getLevelSummary(level)]));
export const missionRoute = primaryLevel.objectives.map((objective) => ({
  id: objective.id,
  label: objective.label,
  sectorId: objective.sectorId ?? null,
  keyColor: objective.keyColor ?? null
}));

export const contentCatalog = {
  version: "1.0.0",
  theme: "retro-industrial",
  supportedModes: ["easy", "normal", "hard"],
  levelIds: levels.map((level) => level.id),
  defaultLevelId,
  missionBrief,
  levelIndex,
  missionRoute,
  difficultyTuning: {
    easy: {
      pickupBonus: 1.25,
      escapeTimerMultiplier: 1.25
    },
    normal: {
      pickupBonus: 1,
      escapeTimerMultiplier: 1
    },
    hard: {
      pickupBonus: 0.85,
      escapeTimerMultiplier: 0.85
    }
  },
  gameplayBeats: [
    "Entry bay infiltration",
    "Hub exploration",
    "Wing key retrieval",
    "Reactor arm and overload",
    "Timed escape through the collapsing mine"
  ]
};

export function emitContentPreviewFile(targetPath: string) {
  writeFileSync(
    targetPath,
    JSON.stringify(
      {
        ...contentCatalog,
        generatedAt: contentManifest.generatedAt
      },
      null,
      2
    ),
    "utf8"
  );
}

export type { LevelDefinition } from "@descent/shared";
