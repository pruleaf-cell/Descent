import {
  Euler,
  Clock,
  Color,
  AmbientLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer
} from "three";
import type { LeaderboardEntry, LevelDefinition, PlayerProfile, SaveState } from "@descent/shared";
import { contentManifest, levels } from "@descent/content";
import type { EngineModule, InputSnapshot, RuntimeBridge, RuntimePhase, RuntimeSnapshot, ShipState } from "./contracts";
import { InputController } from "./input";
import { WorldProjector, projectLevel } from "./projector";

type RuntimeOptions = {
  levelId?: string;
  level?: LevelDefinition;
  canvas?: HTMLCanvasElement | null;
  container?: HTMLElement | null;
  profile?: PlayerProfile;
  leaderboard?: LeaderboardEntry[];
  engine?: EngineModule;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toTuple = (vector: Vector3): readonly [number, number, number] => [vector.x, vector.y, vector.z];

const createSaveState = (level: LevelDefinition): SaveState => ({
  checkpointId: level.startCheckpointId,
  shields: 100,
  energy: 100,
  flareAmmo: 6,
  primaryWeapon: "pulse",
  secondaryWeapon: "volley",
  keys: [],
  destroyedEncounters: [],
  collectedPickups: [],
  objectiveIds: [],
  score: 0,
  elapsedSeconds: 0,
  reactorArmed: false,
  reactorDestroyed: false
});

const buildShipState = (saveState: SaveState): ShipState => ({
  position: [0, 0, 0],
  velocity: [0, 0, 0],
  rotation: [0, 0, 0],
  shields: saveState.shields,
  energy: saveState.energy,
  flares: saveState.flareAmmo,
  score: saveState.score,
  weapon: {
    primary: saveState.primaryWeapon,
    secondary: saveState.secondaryWeapon,
    active: saveState.primaryWeapon,
    ammoPrimary: 120,
    ammoSecondary: 24
  }
});

const defaultSnapshot = (level: LevelDefinition, profile?: PlayerProfile, leaderboard?: LeaderboardEntry[]): RuntimeSnapshot => ({
  phase: "briefing",
  levelId: level.id,
  levelTitle: level.title,
  objectiveText: level.objectives[0]?.label ?? "Prepare to descend.",
  message: level.description,
  elapsedSeconds: 0,
  reactorSecondsLeft: level.reactor.countdownSeconds,
  player: buildShipState(createSaveState(level)),
  objectives: level.objectives.map((objective) => ({
    id: objective.id,
    label: objective.label,
    complete: false
  })),
  pickups: level.pickups.map((pickup) => ({
    id: pickup.id,
    label: pickup.id,
    collected: false
  })),
  world: projectLevel(level, {
    phase: "briefing",
    levelId: level.id,
    levelTitle: level.title,
    objectiveText: "",
    message: "",
    elapsedSeconds: 0,
    reactorSecondsLeft: level.reactor.countdownSeconds,
    player: buildShipState(createSaveState(level)),
    objectives: [],
    pickups: [],
    world: [],
    saveState: createSaveState(level),
    profile,
    leaderboard
  }),
  saveState: createSaveState(level),
  profile,
  leaderboard
});

const fitRenderer = (renderer: WebGLRenderer, canvas: HTMLCanvasElement) => {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width || canvas.clientWidth || canvas.width || 1280));
  const height = Math.max(1, Math.floor(rect.height || canvas.clientHeight || canvas.height || 720));
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  return { width, height };
};

const resolveLevel = (options: RuntimeOptions): LevelDefinition => {
  if (options.level) return options.level;
  const levelId = options.levelId ?? contentManifest.levels[0]?.id ?? levels[0]?.id;
  const level = levels.find((entry) => entry.id === levelId) ?? levels[0];
  if (!level) {
    throw new Error("No content level available for the browser runtime.");
  }
  return level;
};

class FallbackBridge implements RuntimeBridge {
  readonly level: LevelDefinition;
  state: RuntimeSnapshot;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(70, 1, 0.1, 2000);
  private readonly renderer = new WebGLRenderer({ antialias: true, alpha: true });
  private readonly clock = new Clock();
  private readonly input = new InputController();
  private readonly projector = new WorldProjector();
  private readonly shipGroup = new Group();
  private readonly canvas?: HTMLCanvasElement | null;
  private raf = 0;
  private running = false;
  private accumulator = 0;
  private readonly fixedStep = 1 / 60;
  private readonly shipMesh = new Mesh(
    new SphereGeometry(0.8, 16, 16),
    new MeshBasicMaterial({ color: "#f4f7fb" })
  );

  constructor(level: LevelDefinition, profile?: PlayerProfile, leaderboard?: LeaderboardEntry[], canvas?: HTMLCanvasElement | null, container?: HTMLElement | null) {
    this.level = level;
    this.canvas = canvas ?? null;
    this.state = defaultSnapshot(level, profile, leaderboard);

    this.scene.background = new Color(level.palette.background);
    this.scene.fog = null;

    this.camera.position.set(0, 6, 24);
    this.camera.lookAt(0, 0, -20);
    this.scene.add(new AmbientLight(level.palette.accent, 0.5));

    this.shipGroup.add(this.shipMesh);
    this.scene.add(this.projector.group);
    this.scene.add(this.shipGroup);

    if (container) {
      container.appendChild(this.renderer.domElement);
    }

    if (canvas) {
      this.attachCanvas(canvas);
    }

    if (typeof window !== "undefined") {
      this.input.attach(window);
    }
    if (typeof document !== "undefined") {
      this.input.setPointerLocked(document.pointerLockElement !== null);
    }
  }

  setProfile(profile?: PlayerProfile): void {
    this.state.profile = profile;
  }

  setLeaderboard(entries: LeaderboardEntry[]): void {
    this.state.leaderboard = entries;
  }

  setPhase(phase: RuntimePhase): void {
    this.state.phase = phase;
  }

  setPause(paused: boolean): void {
    this.state.phase = paused ? "paused" : this.state.phase === "paused" ? "active" : this.state.phase;
  }

  setInput(snapshot: InputSnapshot): void {
    this.stepWithInput(snapshot, this.fixedStep);
  }

  step(dt: number): void {
    this.accumulator += dt;
    while (this.accumulator >= this.fixedStep) {
      const snapshot = this.input.consume();
      this.stepWithInput(snapshot, this.fixedStep);
      this.accumulator -= this.fixedStep;
    }
    this.render();
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  dispose(): void {
    this.stop();
    this.projector.dispose();
    this.input.detach();
    this.renderer.dispose();
  }

  attachCanvas(canvas: HTMLCanvasElement | null): void {
    if (!canvas) return;
    if (this.renderer.domElement !== canvas) {
      canvas.replaceWith(this.renderer.domElement);
    }
    const { width, height } = fitRenderer(this.renderer, canvas);
    this.resize(width, height);
  }

  snapshot(): RuntimeSnapshot {
    return {
      ...this.state,
      player: { ...this.state.player, weapon: { ...this.state.player.weapon } },
      objectives: this.state.objectives.map((objective) => ({ ...objective })),
      pickups: this.state.pickups.map((pickup) => ({ ...pickup })),
      world: this.state.world.map((entity) => ({ ...entity, meta: entity.meta ? { ...entity.meta } : undefined }))
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.step(dt);
      this.raf = window.requestAnimationFrame(tick);
    };
    this.clock.start();
    this.raf = window.requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    if (this.raf) {
      window.cancelAnimationFrame(this.raf);
    }
    this.raf = 0;
  }

  private stepWithInput(input: InputSnapshot, dt: number): void {
    this.state.phase = this.state.phase === "boot" ? "briefing" : this.state.phase;
    if (input.pause) {
      this.state.phase = this.state.phase === "paused" ? "active" : "paused";
      this.state.message = this.state.phase === "paused" ? "Paused." : "Resuming descent.";
      if (this.state.phase === "paused") {
        this.state.world = projectLevel(this.level, this.state);
        this.render();
        return;
      }
    }
    if (this.state.phase === "paused") {
      this.state.world = projectLevel(this.level, this.state);
      this.render();
      return;
    }

    const player = this.state.player;
    const position = new Vector3(...player.position);
    const velocity = new Vector3(...player.velocity);
    const rotation = new Vector3(...player.rotation);

    rotation.y += input.mouseDeltaX * 0.0015;
    rotation.x = clamp(rotation.x - input.mouseDeltaY * 0.0015, -1.45, 1.45);
    rotation.z += ((input.rollRight ? 1 : 0) - (input.rollLeft ? 1 : 0)) * dt * 1.5;

    const shipEuler = new Euler(rotation.x, rotation.y, rotation.z, "YXZ");
    const forward = new Vector3(0, 0, -1).applyEuler(shipEuler);
    const right = new Vector3(1, 0, 0).applyEuler(shipEuler);
    const up = new Vector3(0, 1, 0);

    const thrust = new Vector3();
    if (input.thrustForward) thrust.add(forward);
    if (input.thrustBackward) thrust.sub(forward);
    if (input.strafeRight) thrust.add(right);
    if (input.strafeLeft) thrust.sub(right);
    if (input.moveUp) thrust.add(up);
    if (input.moveDown) thrust.sub(up);
    if (input.afterburner) thrust.multiplyScalar(1.45);

    velocity.addScaledVector(thrust, dt * 12);
    velocity.multiplyScalar(1 - Math.min(0.65, dt * 1.1));
    position.addScaledVector(velocity, dt);

    const levelBounds = this.level.sectors.reduce((bounds, sector) => {
      bounds.min.x = Math.min(bounds.min.x, sector.center.x - sector.size.x * 0.5);
      bounds.min.y = Math.min(bounds.min.y, sector.center.y - sector.size.y * 0.5);
      bounds.min.z = Math.min(bounds.min.z, sector.center.z - sector.size.z * 0.5);
      bounds.max.x = Math.max(bounds.max.x, sector.center.x + sector.size.x * 0.5);
      bounds.max.y = Math.max(bounds.max.y, sector.center.y + sector.size.y * 0.5);
      bounds.max.z = Math.max(bounds.max.z, sector.center.z + sector.size.z * 0.5);
      return bounds;
    }, { min: new Vector3(Infinity, Infinity, Infinity), max: new Vector3(-Infinity, -Infinity, -Infinity) });

    position.x = clamp(position.x, levelBounds.min.x + 1.5, levelBounds.max.x - 1.5);
    position.y = clamp(position.y, levelBounds.min.y + 1.2, levelBounds.max.y - 1.2);
    position.z = clamp(position.z, levelBounds.min.z + 1.5, levelBounds.max.z - 1.5);

    if (input.flare && this.state.saveState.flareAmmo > 0) {
      this.state.saveState.flareAmmo -= 1;
      this.state.player.flares = this.state.saveState.flareAmmo;
      this.state.message = "Flare deployed.";
    }

    if (input.primaryFire && this.state.player.weapon.ammoPrimary > 0) {
      this.state.player.weapon.ammoPrimary -= 1;
      this.state.player.score += 5;
    }

    if (input.secondaryFire && this.state.player.weapon.ammoSecondary > 0) {
      this.state.player.weapon.ammoSecondary -= 1;
      this.state.player.score += 15;
    }

    if (input.nextWeapon) {
      const cycle = ["pulse", "volley", "shredder", "concussion", "nova"] as const;
      const currentIndex = cycle.indexOf(this.state.player.weapon.active as (typeof cycle)[number]);
      const next = cycle[(currentIndex + 1) % cycle.length] ?? cycle[0];
      this.state.player.weapon.active = next;
      this.state.message = `Weapon set to ${next}.`;
    }

    this.state.elapsedSeconds += dt;
    this.state.saveState.elapsedSeconds = this.state.elapsedSeconds;
    this.state.player.shields = clamp(this.state.player.shields - dt * 0.02, 0, 100);
    this.state.player.energy = clamp(this.state.player.energy - dt * 0.01, 0, 100);
    this.state.player.position = toTuple(position);
    this.state.player.velocity = toTuple(velocity);
    this.state.player.rotation = toTuple(rotation);
    this.state.player.score = Math.max(this.state.player.score, Math.floor(this.state.elapsedSeconds * 10));
    this.state.saveState.score = this.state.player.score;

    const missionProgress = this.updateObjectives(position);
    if (missionProgress) {
      this.state.objectiveText = missionProgress;
    }

    if (this.state.saveState.reactorArmed && !this.state.saveState.reactorDestroyed) {
      this.state.reactorSecondsLeft = Math.max(0, this.state.reactorSecondsLeft - dt);
      if (this.state.reactorSecondsLeft <= 0) {
        this.state.saveState.reactorDestroyed = true;
        this.state.phase = "completed";
        this.state.message = "Reactor breached. Escape now.";
      }
    }

    this.state.world = projectLevel(this.level, this.state);
    this.projector.project(this.level, this.state);

    this.shipGroup.position.copy(position);
    this.shipGroup.rotation.set(rotation.x, rotation.y, rotation.z);
    this.camera.position.lerp(position.clone().add(new Vector3(0, 5, 12)), 0.2);
    this.camera.lookAt(position);

    this.render();
  }

  private updateObjectives(position: Vector3): string | undefined {
    const checkpoint = this.level.checkpoints.find((entry) => entry.id === this.state.saveState.checkpointId) ?? this.level.checkpoints[0];
    if (checkpoint) {
      const checkpointPosition = new Vector3(checkpoint.position.x, checkpoint.position.y, checkpoint.position.z);
      if (position.distanceTo(checkpointPosition) < 4 && this.state.saveState.checkpointId !== checkpoint.id) {
        this.state.saveState.checkpointId = checkpoint.id;
      }
    }

    for (const pickup of this.level.pickups) {
      if (this.state.saveState.collectedPickups.includes(pickup.id)) continue;
      const pickupPosition = new Vector3(pickup.position.x, pickup.position.y, pickup.position.z);
      if (position.distanceTo(pickupPosition) < 3) {
        this.state.saveState.collectedPickups.push(pickup.id);
        if (pickup.type === "flare") {
          this.state.saveState.flareAmmo += pickup.amount || 1;
          this.state.player.flares = this.state.saveState.flareAmmo;
        }
        if (pickup.type === "key" && pickup.keyColor) {
          this.state.saveState.keys.push(pickup.keyColor);
        }
        if (pickup.type === "weapon" && pickup.weaponId) {
          this.state.player.weapon.secondary = pickup.weaponId;
          this.state.player.weapon.active = pickup.weaponId;
          this.state.saveState.secondaryWeapon = pickup.weaponId;
        }
        if (pickup.type === "energy") {
          this.state.player.energy = clamp(this.state.player.energy + (pickup.amount || 20), 0, 100);
          this.state.saveState.energy = this.state.player.energy;
        }
        if (pickup.type === "shield") {
          this.state.player.shields = clamp(this.state.player.shields + (pickup.amount || 20), 0, 100);
          this.state.saveState.shields = this.state.player.shields;
        }
        this.state.pickups = this.state.pickups.map((entry) => entry.id === pickup.id ? { ...entry, collected: true } : entry);
        this.state.saveState.collectedPickups.push(pickup.id);
        this.state.message = `Collected ${pickup.id}`;
      }
    }

    const objectives = this.state.objectives;
    const hubCore = this.level.sectors.find((sector) => sector.id === "hub-core");
    const reachHub = objectives[0];
    if (reachHub && !reachHub.complete && position.distanceTo(new Vector3(hubCore?.center.x ?? 0, 0, hubCore?.center.z ?? 0)) < 16) {
      reachHub.complete = true;
      this.state.saveState.objectiveIds.push(reachHub.id);
      return reachHub.label;
    }
    const collectAzure = objectives[1];
    if (collectAzure && !collectAzure.complete && this.state.saveState.keys.includes("azure")) {
      collectAzure.complete = true;
      this.state.saveState.objectiveIds.push(collectAzure.id);
      return collectAzure.label;
    }
    const collectCrimson = objectives[2];
    if (collectCrimson && !collectCrimson.complete && this.state.saveState.keys.includes("crimson")) {
      collectCrimson.complete = true;
      this.state.saveState.objectiveIds.push(collectCrimson.id);
      return collectCrimson.label;
    }
    const armReactor = objectives[3];
    if (armReactor && !armReactor.complete && position.distanceTo(new Vector3(this.level.reactor.position.x, this.level.reactor.position.y, this.level.reactor.position.z)) < 10) {
      armReactor.complete = true;
      this.state.saveState.objectiveIds.push(armReactor.id);
      this.state.saveState.reactorArmed = true;
      this.state.phase = "active";
      return armReactor.label;
    }
    const destroyReactor = objectives[4];
    if (destroyReactor && !destroyReactor.complete && this.state.saveState.reactorDestroyed) {
      destroyReactor.complete = true;
      this.state.saveState.objectiveIds.push(destroyReactor.id);
      return destroyReactor.label;
    }
    const escape = objectives[5];
    if (escape && !escape.complete && this.state.saveState.reactorDestroyed && position.distanceTo(new Vector3(this.level.exit.position.x, this.level.exit.position.y, this.level.exit.position.z)) < 12) {
      escape.complete = true;
      this.state.saveState.objectiveIds.push(escape.id);
      this.state.phase = "completed";
      this.state.message = "Mission complete.";
      return escape.label;
    }

    return undefined;
  }

  private render(): void {
    const size = this.renderer.getSize(new Vector2());
    if (size.x === 0 || size.y === 0) {
      const canvas = this.renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      if (rect.width && rect.height) {
        this.resize(rect.width, rect.height);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
}

export const createGameRuntime = async (options: RuntimeOptions = {}): Promise<RuntimeBridge & { start(): void; stop(): void }> => {
  const level = resolveLevel(options);
  const moduleName = "@descent/game" as string;
  const externalModule = options.engine ?? (await import(moduleName).catch(() => null as unknown as EngineModule | null));
  const bridge = externalModule?.createBridge?.(level) ?? new FallbackBridge(level, options.profile, options.leaderboard, options.canvas, options.container);
  bridge.setProfile(options.profile);
  if (options.leaderboard) bridge.setLeaderboard(options.leaderboard);
  if (options.canvas) bridge.attachCanvas(options.canvas);
  return bridge as RuntimeBridge & { start(): void; stop(): void };
};
