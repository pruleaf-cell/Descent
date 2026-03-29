import {
  assertLevel,
  contentCatalog,
  getEncounterMap,
  getObjectiveMap,
  getPickupMap,
  getSectorMap,
  levels,
  primaryLevel
} from "./index.js";
import { defaultLevelId } from "@descent/shared";

function fail(message: string): never {
  throw new Error(`[content:validate] ${message}`);
}

function isPointInsideSector(
  point: { x: number; y: number; z: number },
  sector: { center: { x: number; y: number; z: number }; size: { x: number; y: number; z: number } }
) {
  return (
    Math.abs(point.x - sector.center.x) <= sector.size.x / 2 &&
    Math.abs(point.y - sector.center.y) <= sector.size.y / 2 &&
    Math.abs(point.z - sector.center.z) <= sector.size.z / 2
  );
}

function sectorAtPoint(level: ReturnType<typeof assertLevel>, point: { x: number; y: number; z: number }) {
  return level.sectors.find((sector) => isPointInsideSector(point, sector));
}

function validateLevel(levelId: string) {
  const level = assertLevel(levelId);
  const sectorMap = getSectorMap(level);
  const objectiveMap = getObjectiveMap(level);
  const pickupMap = getPickupMap(level);
  const encounterMap = getEncounterMap(level);
  const knownSectorIds = new Set(Object.keys(sectorMap));
  const knownDoorIds = new Set(level.doors.map((door) => door.id));
  const knownCheckpointIds = new Set(level.checkpoints.map((checkpoint) => checkpoint.id));

  if (level.startCheckpointId && !knownCheckpointIds.has(level.startCheckpointId)) {
    fail(`Level ${level.id} references unknown start checkpoint ${level.startCheckpointId}`);
  }

  if (!level.sectors.some((sector) => sector.kind === "entry")) {
    fail(`Level ${level.id} must define at least one entry sector`);
  }

  if (!level.secrets.length) {
    fail(`Level ${level.id} should contain at least one secret route or cache`);
  }

  const objectiveKinds = level.objectives.map((objective) => objective.kind);
  const requiredKinds = ["reach-sector", "collect-key", "collect-key", "arm-reactor", "destroy-reactor", "escape"];
  for (let index = 0; index < requiredKinds.length; index += 1) {
    if (objectiveKinds[index] !== requiredKinds[index]) {
      fail(`Level ${level.id} objective order should start with ${requiredKinds.join(" -> ")}`);
    }
  }

  for (const objective of Object.values(objectiveMap)) {
    if (objective.sectorId && !knownSectorIds.has(objective.sectorId)) {
      fail(`Objective ${objective.id} points at unknown sector ${objective.sectorId}`);
    }
  }

  for (const pickup of Object.values(pickupMap)) {
    if (pickup.keyColor && pickup.type !== "key") {
      fail(`Pickup ${pickup.id} has a keyColor but is not marked as a key pickup`);
    }
    if (pickup.weaponId && pickup.type !== "weapon") {
      fail(`Pickup ${pickup.id} has a weaponId but is not marked as a weapon pickup`);
    }
    if (pickup.powerupId && pickup.type !== "powerup") {
      fail(`Pickup ${pickup.id} has a powerupId but is not marked as a powerup pickup`);
    }
    if (!sectorAtPoint(level, pickup.position)) {
      fail(`Pickup ${pickup.id} is not positioned inside any sector`);
    }
  }

  for (const encounter of Object.values(encounterMap)) {
    if (!knownSectorIds.has(encounter.sectorId)) {
      fail(`Encounter ${encounter.id} points at unknown sector ${encounter.sectorId}`);
    }
    const sector = level.sectors.find((entry) => entry.id === encounter.sectorId);
    if (!sector || !isPointInsideSector(encounter.position, sector)) {
      fail(`Encounter ${encounter.id} is not positioned inside sector ${encounter.sectorId}`);
    }
  }

  for (const door of level.doors) {
    if (!knownSectorIds.has(door.fromSectorId) || !knownSectorIds.has(door.toSectorId)) {
      fail(`Door ${door.id} links unknown sectors`);
    }
    if (door.opensOnSwitchId && !level.switches.some((sw) => sw.id === door.opensOnSwitchId)) {
      fail(`Door ${door.id} references unknown switch ${door.opensOnSwitchId}`);
    }
  }

  for (const sw of level.switches) {
    if (!knownSectorIds.has(sw.sectorId)) {
      fail(`Switch ${sw.id} points at unknown sector`);
    }
    if (sw.targetDoorId && !knownDoorIds.has(sw.targetDoorId)) {
      fail(`Switch ${sw.id} points at unknown door ${sw.targetDoorId}`);
    }
    if (sw.armsReactor && sw.targetDoorId) {
      fail(`Switch ${sw.id} cannot both arm the reactor and target a door`);
    }
  }

  const adjacency = new Map<string, Set<string>>();
  for (const sector of level.sectors) {
    adjacency.set(sector.id, new Set());
  }
  for (const door of level.doors) {
    adjacency.get(door.fromSectorId)?.add(door.toSectorId);
    adjacency.get(door.toSectorId)?.add(door.fromSectorId);
  }

  const visited = new Set<string>();
  const queue = [level.checkpoints.find((checkpoint) => checkpoint.id === level.startCheckpointId)?.sectorId ?? "entry-bay"];
  while (queue.length) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        queue.push(next);
      }
    }
  }

  const requiredSectors = new Set([
    level.reactor.sectorId,
    level.exit.sectorId,
    ...level.objectives.flatMap((objective) => (objective.sectorId ? [objective.sectorId] : [])),
    ...level.pickups.map((pickup) => sectorAtPoint(level, pickup.position)?.id ?? "")
  ]);

  for (const sectorId of requiredSectors) {
    if (sectorId && !visited.has(sectorId) && knownSectorIds.has(sectorId)) {
      fail(`Required sector ${sectorId} is unreachable from the entry flow`);
    }
  }
}

if (levels.length !== 1) {
  fail(`Expected exactly one v1 level, found ${levels.length}`);
}

if (primaryLevel.id !== defaultLevelId) {
  fail(`Expected default level ${defaultLevelId}, found ${primaryLevel.id}`);
}

for (const level of levels) {
  validateLevel(level.id);
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      levelCount: levels.length,
      levelIds: levels.map((level) => level.id),
      mission: contentCatalog.missionBrief.title,
      routeLength: contentCatalog.missionRoute.length
    },
    null,
    2
  )
);
