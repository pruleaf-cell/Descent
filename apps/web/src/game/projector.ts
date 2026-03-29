import {
  BoxGeometry,
  Color,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3
} from "three";
import type { LevelDefinition } from "@descent/shared";
import type { RuntimeSnapshot, WorldEntity } from "./contracts";

const entityColor = (kind: WorldEntity["kind"], active: boolean, color: string) => {
  if (!active) return new Color("#4f5964");
  if (kind === "reactor") return new Color("#ff3b30");
  if (kind === "exit") return new Color("#7df9ff");
  return new Color(color);
};

const worldEntity = (entity: WorldEntity): WorldEntity => entity;

const makeEntityGroup = (entity: WorldEntity) => {
  const group = new Group();
  const [x, y, z] = entity.position;
  const [sx, sy, sz] = entity.size;
  group.position.set(x, y, z);

  let geometry: BoxGeometry | SphereGeometry;
  if (entity.kind === "pickup" || entity.kind === "checkpoint") {
    geometry = new SphereGeometry(Math.max(sx, sy, sz) * 0.35, 16, 16);
  } else if (entity.kind === "reactor") {
    geometry = new BoxGeometry(sx * 1.2, sy * 1.2, sz * 1.2, 2, 2, 2);
  } else {
    geometry = new BoxGeometry(sx, sy, sz, 1, 1, 1);
  }

  const baseMaterial = new MeshBasicMaterial({
    color: entityColor(entity.kind, entity.active, entity.color),
    transparent: true,
    opacity: entity.active ? 0.92 : 0.25,
    wireframe: entity.kind === "sector"
  });

  const mesh = new Mesh(geometry, baseMaterial);
  group.add(mesh);

  const edges = new LineSegments(
    new EdgesGeometry(geometry),
    new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: entity.active ? 0.45 : 0.12 })
  );
  group.add(edges);

  if (entity.kind === "pickup") {
    const glow = new Mesh(
      new SphereGeometry(Math.max(sx, sy, sz) * 0.55, 16, 16),
      new MeshBasicMaterial({ color: entity.color, transparent: true, opacity: 0.14 })
    );
    group.add(glow);
  }

  return group;
};

export class WorldProjector {
  readonly group = new Group();
  private readonly meshes = new Map<string, Group>();

  project(level: LevelDefinition, snapshot: RuntimeSnapshot): void {
    const liveIds = new Set<string>();
    const entities = snapshot.world.length ? snapshot.world : projectLevel(level, snapshot);

    for (const entity of entities) {
      liveIds.add(entity.id);
      let mesh = this.meshes.get(entity.id);
      if (!mesh) {
        mesh = makeEntityGroup(entity);
        this.meshes.set(entity.id, mesh);
        this.group.add(mesh);
      }

      mesh.visible = true;
      mesh.position.set(...entity.position);
      mesh.scale.set(Math.max(entity.size[0], 0.001), Math.max(entity.size[1], 0.001), Math.max(entity.size[2], 0.001));
      mesh.rotation.set(0, 0, 0);
      const meshChild = mesh.children[0];
      if (meshChild instanceof Mesh && meshChild.material instanceof MeshBasicMaterial) {
        meshChild.material.color = entityColor(entity.kind, entity.active, entity.color);
        meshChild.material.opacity = entity.active ? 0.92 : 0.25;
      }
    }

    for (const [id, mesh] of this.meshes) {
      mesh.visible = liveIds.has(id);
    }
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) {
      mesh.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          const materials: Material[] = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            material.dispose();
          }
        }
      });
    }
    this.meshes.clear();
    this.group.clear();
  }
}

export function projectLevel(level: LevelDefinition, snapshot: RuntimeSnapshot): WorldEntity[] {
  return [
    ...level.sectors.map((sector) => worldEntity({
      id: `sector:${sector.id}`,
      kind: "sector",
      label: sector.label,
      position: [sector.center.x, sector.center.y, sector.center.z] as const,
      size: [sector.size.x, sector.size.y, sector.size.z] as const,
      color: level.palette.accent,
      active: true,
      meta: { kind: sector.kind }
    })),
    ...level.doors.map((door) => worldEntity({
      id: `door:${door.id}`,
      kind: "door",
      label: door.id,
      position: [door.position.x, door.position.y, door.position.z] as const,
      size: [door.size.x, door.size.y, door.size.z] as const,
      color: door.keyColor === "azure" ? "#6ca7ff" : door.keyColor === "crimson" ? "#ff4d6d" : "#f0f3f7",
      active:
        !door.keyColor ||
        (door.keyColor === "azure" && snapshot.saveState.keys.includes("azure")) ||
        (door.keyColor === "crimson" && snapshot.saveState.keys.includes("crimson")) ||
        (door.opensOnSwitchId === "door-reactor" && snapshot.saveState.reactorArmed) ||
        (door.opensOnSwitchId === "door-escape" && snapshot.saveState.reactorDestroyed),
      meta: { from: door.fromSectorId, to: door.toSectorId }
    })),
    ...level.pickups.map((pickup) => worldEntity({
      id: `pickup:${pickup.id}`,
      kind: "pickup",
      label: pickup.id,
      position: [pickup.position.x, pickup.position.y, pickup.position.z] as const,
      size: [1.2, 1.2, 1.2] as const,
      color: pickup.keyColor === "azure" ? "#6ca7ff" : pickup.keyColor === "crimson" ? "#ff4d6d" : "#ffd166",
      active: !snapshot.saveState.collectedPickups.includes(pickup.id),
      meta: { type: pickup.type }
    })),
    ...level.encounters.map((encounter) => worldEntity({
      id: `enemy:${encounter.id}`,
      kind: "enemy",
      label: encounter.enemyType,
      position: [encounter.position.x, encounter.position.y, encounter.position.z] as const,
      size: [2, 2, 2] as const,
      color: encounter.enemyType === "reactor-elite" ? "#ff3b30" : "#a9b7ff",
      active: !snapshot.saveState.destroyedEncounters.includes(encounter.id),
      meta: { sectorId: encounter.sectorId, trigger: encounter.trigger }
    })),
    ...level.checkpoints.map((checkpoint) => worldEntity({
      id: `checkpoint:${checkpoint.id}`,
      kind: "checkpoint",
      label: checkpoint.id,
      position: [checkpoint.position.x, checkpoint.position.y, checkpoint.position.z] as const,
      size: [1.2, 1.2, 1.2] as const,
      color: "#7df9ff",
      active: true
    })),
    worldEntity({
      id: "reactor",
      kind: "reactor",
      label: "Reactor",
      position: [level.reactor.position.x, level.reactor.position.y, level.reactor.position.z] as const,
      size: [6, 6, 6] as const,
      color: "#ff3b30",
      active: !snapshot.saveState.reactorDestroyed
    }),
    worldEntity({
      id: "exit",
      kind: "exit",
      label: "Exit",
      position: [level.exit.position.x, level.exit.position.y, level.exit.position.z] as const,
      size: [3, 3, 3] as const,
      color: "#7df9ff",
      active: snapshot.phase === "completed" || snapshot.saveState.reactorDestroyed
    })
  ];
}

export function fitCameraToLevel(camera: Vector3, level: LevelDefinition) {
  const maxSpan = level.sectors.reduce((acc, sector) => Math.max(acc, sector.size.x, sector.size.y, sector.size.z), 18);
  camera.set(maxSpan * 0.6, maxSpan * 0.5, maxSpan * 1.4);
}
