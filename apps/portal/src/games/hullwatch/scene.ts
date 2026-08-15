import { Engine } from "@babylonjs/core/Engines/engine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { PointLight } from "@babylonjs/core/Lights/pointLight.js";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture.js";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh.js";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder.pure.js";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder.pure.js";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder.pure.js";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder.pure.js";
import { HullwatchAudio } from "./audio";

export type HullwatchPhase = "ready" | "running" | "paused" | "complete" | "failed";
export type HullwatchInputMode = "mouse" | "keyboard" | "touch" | "gamepad";

export type HullwatchTelemetry = {
  phase: HullwatchPhase;
  score: number;
  hull: number;
  heat: number;
  overheat: boolean;
  remaining: number;
  wave: number;
  kills: number;
  intercepts: number;
  accuracy: number;
  combo: number;
  threats: number;
  lock: "FIGHTER" | "BOMBER" | "TORPEDO" | null;
  inputMode: HullwatchInputMode;
  callout: string;
};

export type HullwatchRuntime = {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  setMuted(muted: boolean): void;
  setFire(active: boolean): void;
  destroy(): void;
};

type EnemyKind = "fighter" | "bomber";
type Enemy = {
  root: TransformNode;
  kind: EnemyKind;
  hp: number;
  speed: number;
  baseX: number;
  baseY: number;
  phase: number;
  attackTimer: number;
};

type Threat = {
  root: TransformNode;
  kind: "bolt" | "torpedo";
  hp: number;
  velocity: Vector3;
  damage: number;
};

type Tracer = { mesh: AbstractMesh; life: number };
type Explosion = { mesh: AbstractMesh; life: number };
type LockTarget = { enemy?: Enemy; threat?: Threat; label: HullwatchTelemetry["lock"] };

type TurretVisual = {
  yaw: TransformNode;
  cradle: TransformNode;
  leftMuzzle: AbstractMesh;
  rightMuzzle: AbstractMesh;
};

const RUN_SECONDS = 90;
const MAX_HEAT = 100;
const SHOT_INTERVAL = 0.105;
const OVERHEAT_RELEASE = 54;
const HIDDEN_SCALE = 0.0001;

export async function createHullwatchScene(
  canvas: HTMLCanvasElement,
  onTelemetry: (telemetry: HullwatchTelemetry) => void,
): Promise<HullwatchRuntime> {
  if (!Engine.isSupported()) throw new Error("WebGL is not available in this browser.");

  const mobileTier = window.matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, powerPreference: "high-performance" }, true);
  engine.setHardwareScalingLevel(mobileTier ? 1.15 : 1 / Math.min(window.devicePixelRatio || 1, 1.5));

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.002, 0.003, 0.006, 1);
  scene.skipPointerMovePicking = true;
  scene.constantlyUpdateMeshUnderPointer = false;
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.exposure = 1.08;
  scene.imageProcessingConfiguration.contrast = 1.34;
  scene.imageProcessingConfiguration.vignetteEnabled = true;
  scene.imageProcessingConfiguration.vignetteWeight = 1.15;
  scene.imageProcessingConfiguration.vignetteColor = new Color4(0.005, 0.008, 0.014, 1);

  const camera = new FreeCamera("gunner-camera", new Vector3(0, 5.2, -12.5), scene);
  camera.minZ = 0.05;
  camera.maxZ = 500;
  camera.fov = mobileTier ? 0.95 : 0.88;
  camera.setTarget(new Vector3(0, 8, 80));

  const ambient = new HemisphericLight("hull-ambient", new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.38;
  ambient.diffuse = new Color3(0.38, 0.48, 0.62);
  ambient.groundColor = new Color3(0.025, 0.03, 0.04);

  const key = new DirectionalLight("cold-star-key", new Vector3(0.36, -0.42, -1), scene);
  key.position = new Vector3(-35, 45, -30);
  key.intensity = 3.8;
  key.diffuse = new Color3(0.72, 0.84, 1);

  const warmRim = new DirectionalLight("warm-rim", new Vector3(-0.5, -0.2, 1), scene);
  warmRim.position = new Vector3(40, 12, 90);
  warmRim.intensity = 1.7;
  warmRim.diffuse = new Color3(1, 0.42, 0.2);

  const impactLight = new PointLight("impact-light", new Vector3(0, 2, 4), scene);
  impactLight.diffuse = new Color3(1, 0.28, 0.08);
  impactLight.range = 28;
  impactLight.intensity = 0;

  const materials = createMaterials(scene);
  createDeepSpace(scene, materials.star);
  createPlanet(scene, materials.planet);
  const turret = createCarrierAndTurret(scene, materials);
  const audio = new HullwatchAudio();

  // Weapon effects deliberately use materials that are already visible on the carrier.
  // This avoids compiling a new shader variant on the first trigger pull.
  const tracerPool = createTracerPool(scene, materials.coolLight, mobileTier ? 12 : 18);
  const explosionPool = createExplosionPool(scene, materials.enemyHot, mobileTier ? 6 : 10);
  let tracerCursor = 0;
  let explosionCursor = 0;

  const enemies: Enemy[] = [];
  const threats: Threat[] = [];
  const pressed = new Set<string>();
  const aimForward = new Vector3(0, 0.035, 1).normalize();
  let pointerFire = false;
  let virtualFire = false;
  let gamepadFire = false;
  let aimYaw = 0;
  let aimPitch = 0.035;
  let phase: HullwatchPhase = "ready";
  let elapsed = 0;
  let score = 0;
  let hull = 100;
  let heat = 0;
  let overheat = false;
  let shotCooldown = 0;
  let spawnTimer = 0.8;
  let kills = 0;
  let intercepts = 0;
  let shots = 0;
  let hits = 0;
  let combo = 1;
  let comboTimer = 0;
  let inputMode: HullwatchInputMode = mobileTier ? "touch" : "mouse";
  let callout = "";
  let calloutTimer = 0;
  let destroyed = false;
  let autoPaused = false;
  let muzzleEnergyLeft = 0;
  let muzzleEnergyRight = 0;
  let barrelSide = 0;
  let rngState = 0x445555;
  let lastTelemetryAt = 0;
  let currentLock: LockTarget | null = null;
  let visualEffectsHealthy = true;

  const random = () => {
    rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
    return rngState / 4294967296;
  };

  const setCallout = (text: string, seconds = 1.8) => {
    callout = text;
    calloutTimer = seconds;
  };

  const wave = () => Math.min(3, Math.floor(elapsed / 30) + 1);

  const telemetry = (): HullwatchTelemetry => ({
    phase,
    score: Math.round(score),
    hull: Math.max(0, Math.round(hull)),
    heat: Math.round(heat),
    overheat,
    remaining: Math.max(0, RUN_SECONDS - elapsed),
    wave: wave(),
    kills,
    intercepts,
    accuracy: shots > 0 ? Math.round((hits / shots) * 100) : 100,
    combo,
    threats: enemies.length + threats.length,
    lock: currentLock?.label ?? null,
    inputMode,
    callout: calloutTimer > 0 ? callout : "",
  });

  const publish = (force = false) => {
    const now = performance.now();
    if (!force && now - lastTelemetryAt < 80) return;
    lastTelemetryAt = now;
    onTelemetry(telemetry());
  };

  const hideEffects = () => {
    turret.leftMuzzle.scaling.setAll(HIDDEN_SCALE);
    turret.rightMuzzle.scaling.setAll(HIDDEN_SCALE);
    for (const tracer of tracerPool) {
      tracer.life = 0;
      tracer.mesh.scaling.setAll(HIDDEN_SCALE);
    }
    for (const explosion of explosionPool) {
      explosion.life = 0;
      explosion.mesh.scaling.setAll(HIDDEN_SCALE);
    }
  };

  const clearCombatObjects = () => {
    for (const enemy of enemies) enemy.root.dispose();
    enemies.length = 0;
    for (const threat of threats) threat.root.dispose();
    threats.length = 0;
    hideEffects();
  };

  const damageHull = (amount: number, reason: string) => {
    hull = Math.max(0, hull - amount);
    impactLight.intensity = reducedMotion ? 8 : 22;
    setCallout(reason, 1.4);
    audio.impact();
    combo = 1;
    comboTimer = 0;
    if (hull <= 0 && phase === "running") {
      phase = "failed";
      pointerFire = false;
      virtualFire = false;
      setCallout("CARRIER HULL LOST", 4);
      publish(true);
    }
  };

  const spawnExplosion = (position: Vector3, large = false) => {
    if (!visualEffectsHealthy) return;
    const explosion = explosionPool[explosionCursor % explosionPool.length];
    explosionCursor += 1;
    if (!explosion) return;
    explosion.mesh.position.copyFrom(position);
    explosion.mesh.scaling.setAll(large ? 0.9 : 0.55);
    explosion.life = reducedMotion ? 0.12 : 0.28;
  };

  const removeEnemy = (enemy: Enemy) => {
    const index = enemies.indexOf(enemy);
    if (index >= 0) enemies.splice(index, 1);
    enemy.root.dispose();
  };

  const removeThreat = (threat: Threat) => {
    const index = threats.indexOf(threat);
    if (index >= 0) threats.splice(index, 1);
    threat.root.dispose();
  };

  const spawnThreat = (enemy: Enemy) => {
    const torpedo = enemy.kind === "bomber" && random() > 0.18;
    const root = new TransformNode(`threat-${Math.floor(elapsed * 1000)}-${threats.length}`, scene);
    root.position.copyFrom(enemy.root.position);
    const target = torpedo
      ? new Vector3((random() - 0.5) * 10, -1.2 + random() * 2, 8 + random() * 14)
      : new Vector3((random() - 0.5) * 15, -0.5 + random() * 4, 4 + random() * 12);
    const direction = target.subtract(root.position).normalize();
    const speed = torpedo ? (mobileTier ? 14 : 12) : 34;

    if (torpedo) {
      const body = CreateCylinder("torpedo-body", { height: 2.6, diameter: 0.52, tessellation: 8 }, scene);
      body.rotation.x = Math.PI / 2;
      body.material = materials.torpedo;
      body.parent = root;
      const nose = CreateSphere("torpedo-nose", { diameter: 0.64, segments: 8 }, scene);
      nose.position.z = -1.25;
      nose.material = materials.torpedoHot;
      nose.parent = root;
      const tail = CreateCylinder("torpedo-tail", { height: 0.9, diameterTop: 0.12, diameterBottom: 0.6, tessellation: 8 }, scene);
      tail.rotation.x = Math.PI / 2;
      tail.position.z = 1.65;
      tail.material = materials.torpedoHot;
      tail.parent = root;
      root.scaling.setAll(mobileTier ? 1.55 : 2.1);
      root.lookAt(target);
    } else {
      const bolt = CreateBox("hostile-bolt", { width: 0.12, height: 0.12, depth: 2.2 }, scene);
      bolt.material = materials.hostileBolt;
      bolt.parent = root;
      root.lookAt(target);
    }

    threats.push({ root, kind: torpedo ? "torpedo" : "bolt", hp: torpedo ? 2 : 1, velocity: direction.scale(speed), damage: torpedo ? 17 : 4 });
    if (torpedo) setCallout("TORPEDO INBOUND", 1.25);
  };

  const spawnEnemy = () => {
    const stage = wave();
    const bomberChance = stage === 1 ? 0.16 : stage === 2 ? 0.28 : 0.38;
    const kind: EnemyKind = random() < bomberChance ? "bomber" : "fighter";
    const root = new TransformNode(`enemy-${Math.floor(elapsed * 1000)}-${enemies.length}`, scene);
    const side = random() < 0.5 ? -1 : 1;
    const baseX = side * (10 + random() * 25);
    const baseY = 5 + random() * 21;
    root.position.set(baseX, baseY, 94 + random() * 42);

    if (kind === "fighter") {
      const body = CreateBox("fighter-body", { width: 1.35, height: 0.62, depth: 4.2 }, scene);
      body.material = materials.enemyHull;
      body.parent = root;
      const wing = CreateBox("fighter-wing", { width: 6.2, height: 0.16, depth: 1.65 }, scene);
      wing.position.z = 0.45;
      wing.material = materials.enemyHull;
      wing.parent = root;
      const spine = CreateBox("fighter-spine", { width: 0.6, height: 0.45, depth: 2.6 }, scene);
      spine.position.y = 0.42;
      spine.position.z = -0.2;
      spine.material = materials.enemyPanel;
      spine.parent = root;
      for (const x of [-0.46, 0.46]) {
        const engineGlow = CreateSphere("fighter-engine", { diameter: 0.38, segments: 8 }, scene);
        engineGlow.position.set(x, 0, 2.15);
        engineGlow.material = materials.enemyHot;
        engineGlow.parent = root;
      }
    } else {
      const body = CreateBox("bomber-body", { width: 2.5, height: 1.2, depth: 6.8 }, scene);
      body.material = materials.enemyHull;
      body.parent = root;
      const wing = CreateBox("bomber-wing", { width: 8.8, height: 0.26, depth: 2.2 }, scene);
      wing.position.z = 0.8;
      wing.material = materials.enemyHull;
      wing.parent = root;
      const armor = CreateBox("bomber-armor", { width: 1.5, height: 0.55, depth: 3.4 }, scene);
      armor.position.y = 0.78;
      armor.material = materials.enemyPanel;
      armor.parent = root;
      for (const x of [-0.82, 0.82]) {
        const engineGlow = CreateSphere("bomber-engine", { diameter: 0.55, segments: 8 }, scene);
        engineGlow.position.set(x, 0.05, 3.45);
        engineGlow.material = materials.enemyHot;
        engineGlow.parent = root;
      }
    }

    root.rotation.z = (random() - 0.5) * 0.5;
    enemies.push({
      root,
      kind,
      hp: kind === "fighter" ? 2 : 5,
      speed: kind === "fighter" ? 18 + stage * 1.8 : 10 + stage * 1.3,
      baseX,
      baseY,
      phase: random() * Math.PI * 2,
      attackTimer: 0.7 + random() * 1.4,
    });
  };

  const acquireTarget = (forward: Vector3): LockTarget | null => {
    let best: LockTarget | null = null;
    let bestValue = -Infinity;

    for (const threat of threats) {
      if (threat.kind !== "torpedo") continue;
      const offset = threat.root.position.subtract(camera.position);
      const distance = offset.length();
      if (distance <= 0.01) continue;
      const dot = Vector3.Dot(offset.scale(1 / distance), forward);
      if (dot < 0.9915) continue;
      const value = dot * 4 - distance * 0.0015 + 1.4;
      if (value > bestValue) {
        bestValue = value;
        best = { threat, label: "TORPEDO" };
      }
    }

    for (const enemy of enemies) {
      const offset = enemy.root.position.subtract(camera.position);
      const distance = offset.length();
      if (distance <= 0.01) continue;
      const dot = Vector3.Dot(offset.scale(1 / distance), forward);
      const threshold = enemy.kind === "bomber" ? 0.9928 : 0.9944;
      if (dot < threshold) continue;
      const value = dot * 4 - distance * 0.0017 + (enemy.kind === "bomber" ? 0.18 : 0);
      if (value > bestValue) {
        bestValue = value;
        best = { enemy, label: enemy.kind === "bomber" ? "BOMBER" : "FIGHTER" };
      }
    }
    return best;
  };

  const emitTracer = () => {
    if (!visualEffectsHealthy) return;
    const tracer = tracerPool[tracerCursor % tracerPool.length];
    tracerCursor += 1;
    if (!tracer) return;
    const origin = camera.position.add(aimForward.scale(7.5));
    tracer.mesh.position.copyFrom(origin.add(aimForward.scale(10)));
    // Do not call mesh.lookAt() while firing. The turret already owns the exact aim angles.
    tracer.mesh.rotation.x = -aimPitch;
    tracer.mesh.rotation.y = aimYaw;
    tracer.mesh.rotation.z = 0;
    tracer.mesh.scaling.setAll(1);
    tracer.life = 0.075;
  };

  const fireShot = () => {
    if (overheat || shotCooldown > 0 || phase !== "running") return;
    shotCooldown = SHOT_INTERVAL;
    heat = Math.min(MAX_HEAT, heat + 8.2);
    shots += 1;
    barrelSide = 1 - barrelSide;
    if (barrelSide === 0) muzzleEnergyLeft = 1;
    else muzzleEnergyRight = 1;

    // The direction is already computed by updateAim. No first-shot camera ray allocation.
    emitTracer();
    const target = acquireTarget(aimForward);
    currentLock = target;
    if (!target) return;

    hits += 1;
    score += 18 * combo;

    if (target.threat) {
      target.threat.hp -= 1;
      if (target.threat.hp <= 0) {
        const position = target.threat.root.position.clone();
        removeThreat(target.threat);
        spawnExplosion(position, false);
        intercepts += 1;
        combo = Math.min(8, combo + 1);
        comboTimer = 4.2;
        score += 360 * combo;
        setCallout("TORPEDO INTERCEPT", 0.9);
        audio.intercept();
      }
      return;
    }

    if (target.enemy) {
      target.enemy.hp -= 1;
      if (target.enemy.hp <= 0) {
        const enemy = target.enemy;
        const position = enemy.root.position.clone();
        const base = enemy.kind === "bomber" ? 620 : 280;
        removeEnemy(enemy);
        spawnExplosion(position, enemy.kind === "bomber");
        kills += 1;
        combo = Math.min(8, combo + 1);
        comboTimer = 4.2;
        score += base * combo;
        setCallout(enemy.kind === "bomber" ? "BOMBER BROKEN" : "FIGHTER DOWN", 0.7);
        audio.kill();
      }
    }
  };

  const updateAim = (dt: number) => {
    const keyboardX = (pressed.has("KeyD") || pressed.has("ArrowRight") ? 1 : 0) - (pressed.has("KeyA") || pressed.has("ArrowLeft") ? 1 : 0);
    const keyboardY = (pressed.has("KeyS") || pressed.has("ArrowDown") ? 1 : 0) - (pressed.has("KeyW") || pressed.has("ArrowUp") ? 1 : 0);
    if (keyboardX !== 0 || keyboardY !== 0) {
      inputMode = "keyboard";
      aimYaw += keyboardX * dt * 1.25;
      aimPitch -= keyboardY * dt * 0.82;
    }

    const gamepad = navigator.getGamepads?.()[0];
    gamepadFire = false;
    if (gamepad) {
      const stickX = Math.abs(gamepad.axes[2] ?? 0) > 0.12 ? gamepad.axes[2] ?? 0 : gamepad.axes[0] ?? 0;
      const stickY = Math.abs(gamepad.axes[3] ?? 0) > 0.12 ? gamepad.axes[3] ?? 0 : gamepad.axes[1] ?? 0;
      if (Math.abs(stickX) > 0.1 || Math.abs(stickY) > 0.1) {
        inputMode = "gamepad";
        aimYaw += stickX * dt * 1.45;
        aimPitch -= stickY * dt * 0.95;
      }
      gamepadFire = Boolean(gamepad.buttons[7]?.value && gamepad.buttons[7].value > 0.18) || Boolean(gamepad.buttons[0]?.pressed);
    }

    aimYaw = Math.max(-0.92, Math.min(0.92, aimYaw));
    aimPitch = Math.max(-0.26, Math.min(0.46, aimPitch));
    const cp = Math.cos(aimPitch);
    aimForward.set(Math.sin(aimYaw) * cp, Math.sin(aimPitch), Math.cos(aimYaw) * cp);
    camera.setTarget(camera.position.add(aimForward.scale(120)));
    turret.yaw.rotation.y = aimYaw;
    turret.cradle.rotation.x = -aimPitch;
    currentLock = acquireTarget(aimForward);
  };

  const updateEnemies = (dt: number) => {
    for (let index = enemies.length - 1; index >= 0; index -= 1) {
      const enemy = enemies[index];
      if (!enemy) continue;
      enemy.root.position.z -= enemy.speed * dt;
      const strafe = enemy.kind === "fighter" ? 4.8 : 2.2;
      enemy.root.position.x = enemy.baseX + Math.sin(elapsed * (enemy.kind === "fighter" ? 1.55 : 0.85) + enemy.phase) * strafe;
      enemy.root.position.y = enemy.baseY + Math.cos(elapsed * 1.15 + enemy.phase) * (enemy.kind === "fighter" ? 2.2 : 1.2);
      enemy.root.rotation.z = Math.sin(elapsed * 1.3 + enemy.phase) * (enemy.kind === "fighter" ? 0.32 : 0.12);
      enemy.attackTimer -= dt;
      if (enemy.root.position.z < 78 && enemy.attackTimer <= 0) {
        spawnThreat(enemy);
        enemy.attackTimer = enemy.kind === "bomber" ? 3.4 + random() * 1.4 : 1.9 + random() * 1.4;
      }
      if (enemy.root.position.z < 13) {
        damageHull(enemy.kind === "bomber" ? 15 : 8, enemy.kind === "bomber" ? "BOMBER STRIKE THROUGH" : "FIGHTER STRIKE THROUGH");
        removeEnemy(enemy);
      }
    }
  };

  const updateThreats = (dt: number) => {
    for (let index = threats.length - 1; index >= 0; index -= 1) {
      const threat = threats[index];
      if (!threat) continue;
      threat.root.position.x += threat.velocity.x * dt;
      threat.root.position.y += threat.velocity.y * dt;
      threat.root.position.z += threat.velocity.z * dt;
      if (threat.kind === "torpedo" && !reducedMotion) threat.root.rotation.z += dt * 2.4;
      if (threat.root.position.z < 6) {
        damageHull(threat.damage, threat.kind === "torpedo" ? "TORPEDO IMPACT" : "HULL IMPACT");
        removeThreat(threat);
      }
    }
  };

  const updateEffects = (dt: number) => {
    impactLight.intensity = Math.max(0, impactLight.intensity - dt * 75);
    muzzleEnergyLeft = Math.max(0, muzzleEnergyLeft - dt * 14);
    muzzleEnergyRight = Math.max(0, muzzleEnergyRight - dt * 14);
    turret.leftMuzzle.scaling.setAll(muzzleEnergyLeft > 0.02 ? 0.5 + muzzleEnergyLeft * 1.2 : HIDDEN_SCALE);
    turret.rightMuzzle.scaling.setAll(muzzleEnergyRight > 0.02 ? 0.5 + muzzleEnergyRight * 1.2 : HIDDEN_SCALE);

    for (const tracer of tracerPool) {
      if (tracer.life <= 0) continue;
      tracer.life -= dt;
      if (tracer.life <= 0) tracer.mesh.scaling.setAll(HIDDEN_SCALE);
    }
    for (const explosion of explosionPool) {
      if (explosion.life <= 0) continue;
      explosion.life -= dt;
      explosion.mesh.scaling.scaleInPlace(1 + dt * 5.4);
      if (explosion.life <= 0) explosion.mesh.scaling.setAll(HIDDEN_SCALE);
    }
  };

  const update = (dt: number) => {
    elapsed += dt;
    shotCooldown = Math.max(0, shotCooldown - dt);
    if (calloutTimer > 0) calloutTimer -= dt;
    comboTimer = Math.max(0, comboTimer - dt);
    if (comboTimer <= 0) combo = 1;

    updateAim(dt);
    heat = Math.max(0, heat - dt * (overheat ? 28 : 20));
    if (!overheat && heat >= MAX_HEAT - 0.01) {
      overheat = true;
      setCallout("CANNON THERMAL LOCK", 1.5);
      audio.overheat();
    } else if (overheat && heat <= OVERHEAT_RELEASE) {
      overheat = false;
      setCallout("CANNONS READY", 0.8);
    }

    const wantsFire = pointerFire || virtualFire || gamepadFire || pressed.has("Space");
    if (wantsFire) {
      try {
        fireShot();
      } catch (error) {
        pointerFire = false;
        virtualFire = false;
        gamepadFire = false;
        visualEffectsHealthy = false;
        hideEffects();
        setCallout("CANNON VISUALS BYPASSED — FIRE CONTROL ACTIVE", 2.4);
        console.error("Hullwatch fire path recovered", error);
      }
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnEnemy();
      const stage = wave();
      spawnTimer = Math.max(0.58, 1.62 - stage * 0.23) * (0.86 + random() * 0.3);
    }

    updateEnemies(dt);
    updateThreats(dt);
    updateEffects(dt);

    if (elapsed >= RUN_SECONDS && phase === "running") {
      phase = "complete";
      pointerFire = false;
      virtualFire = false;
      setCallout("ESCORT CORRIDOR CLEARED", 4);
      publish(true);
    }
  };

  const reset = () => {
    clearCombatObjects();
    elapsed = 0;
    score = 0;
    hull = 100;
    heat = 0;
    overheat = false;
    shotCooldown = 0;
    spawnTimer = 0.75;
    kills = 0;
    intercepts = 0;
    shots = 0;
    hits = 0;
    combo = 1;
    comboTimer = 0;
    aimYaw = 0;
    aimPitch = 0.035;
    currentLock = null;
    pointerFire = false;
    virtualFire = false;
    gamepadFire = false;
    callout = "";
    calloutTimer = 0;
    rngState = 0x445555;
    impactLight.intensity = 0;
    visualEffectsHealthy = true;
    phase = "ready";
    updateAim(0);
    publish(true);
  };

  const setPointerAim = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    aimYaw = Math.max(-0.92, Math.min(0.92, nx * 0.92));
    aimPitch = Math.max(-0.26, Math.min(0.46, -ny * 0.38 + 0.07));
    inputMode = event.pointerType === "touch" ? "touch" : "mouse";
    void audio.arm();
  };

  const onPointerMove = (event: PointerEvent) => setPointerAim(event);
  const onPointerDown = (event: PointerEvent) => {
    setPointerAim(event);
    if (event.pointerType === "mouse") pointerFire = true;
  };
  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerType === "mouse") pointerFire = false;
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    pressed.add(event.code);
    inputMode = "keyboard";
    void audio.arm();
  };
  const onKeyUp = (event: KeyboardEvent) => pressed.delete(event.code);
  const onVisibility = () => {
    if (document.hidden && phase === "running") {
      phase = "paused";
      autoPaused = true;
      publish(true);
    } else if (!document.hidden && autoPaused && phase === "paused") {
      phase = "running";
      autoPaused = false;
      publish(true);
    }
  };
  const onResize = () => engine.resize();

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);

  engine.runRenderLoop(() => {
    if (destroyed) return;
    const dt = Math.min(0.05, Math.max(0, engine.getDeltaTime() / 1000));
    try {
      if (phase === "running") update(dt);
      else {
        updateAim(0);
        updateEffects(dt);
      }
      scene.render();
      publish();
    } catch (error) {
      // A visual effect must never be allowed to terminate Babylon's render loop.
      pointerFire = false;
      virtualFire = false;
      gamepadFire = false;
      visualEffectsHealthy = false;
      hideEffects();
      setCallout("DISPLAY RECOVERED — COMBAT CONTINUES", 2.4);
      console.error("Hullwatch render loop recovered", error);
      publish(true);
    }
  });

  // Render once before the player can fire. The weapon-effect material is already used by
  // visible carrier geometry, so there is no first-trigger shader compilation path.
  scene.render();
  reset();

  return {
    start() {
      if (phase !== "ready") return;
      phase = "running";
      setCallout("DEFEND THE CARRIER", 1.8);
      void audio.arm();
      publish(true);
    },
    pause() {
      if (phase !== "running") return;
      phase = "paused";
      autoPaused = false;
      pointerFire = false;
      virtualFire = false;
      publish(true);
    },
    resume() {
      if (phase !== "paused") return;
      phase = "running";
      autoPaused = false;
      publish(true);
    },
    restart() {
      reset();
    },
    setMuted(muted) {
      audio.setMuted(muted);
    },
    setFire(active) {
      virtualFire = active;
      if (active) void audio.arm();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      engine.stopRenderLoop();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      clearCombatObjects();
      audio.destroy();
      scene.dispose();
      engine.dispose();
    },
  };
}

function createMaterials(scene: Scene) {
  const hull = new PBRMaterial("carrier-hull", scene);
  hull.albedoColor = new Color3(0.11, 0.13, 0.15);
  hull.metallic = 0.9;
  hull.roughness = 0.42;

  const armor = new PBRMaterial("carrier-armor", scene);
  armor.albedoColor = new Color3(0.23, 0.25, 0.26);
  armor.metallic = 0.82;
  armor.roughness = 0.34;

  const ceramic = new PBRMaterial("turret-ceramic", scene);
  ceramic.albedoColor = new Color3(0.72, 0.73, 0.7);
  ceramic.metallic = 0.58;
  ceramic.roughness = 0.3;

  const coolLight = new StandardMaterial("carrier-cool-light", scene);
  coolLight.diffuseColor = new Color3(0.08, 0.13, 0.16);
  coolLight.emissiveColor = new Color3(0.28, 0.68, 0.78);

  const enemyHull = new PBRMaterial("enemy-hull", scene);
  enemyHull.albedoColor = new Color3(0.045, 0.05, 0.058);
  enemyHull.metallic = 0.94;
  enemyHull.roughness = 0.28;

  const enemyPanel = new PBRMaterial("enemy-panel", scene);
  enemyPanel.albedoColor = new Color3(0.22, 0.13, 0.1);
  enemyPanel.metallic = 0.82;
  enemyPanel.roughness = 0.31;

  const enemyHot = new StandardMaterial("enemy-hot", scene);
  enemyHot.diffuseColor = new Color3(0.16, 0.035, 0.018);
  enemyHot.emissiveColor = new Color3(0.92, 0.24, 0.08);

  const torpedo = new PBRMaterial("torpedo-hull", scene);
  torpedo.albedoColor = new Color3(0.2, 0.19, 0.17);
  torpedo.metallic = 0.88;
  torpedo.roughness = 0.26;

  const torpedoHot = new StandardMaterial("torpedo-hot", scene);
  torpedoHot.diffuseColor = new Color3(0.2, 0.05, 0.02);
  torpedoHot.emissiveColor = new Color3(1, 0.3, 0.09);

  const hostileBolt = new StandardMaterial("hostile-bolt", scene);
  hostileBolt.diffuseColor = new Color3(0.25, 0.05, 0.02);
  hostileBolt.emissiveColor = new Color3(1, 0.24, 0.06);

  const star = new StandardMaterial("deep-space", scene);
  star.disableLighting = true;
  star.backFaceCulling = false;

  const planet = new PBRMaterial("planet", scene);
  planet.albedoColor = new Color3(0.055, 0.075, 0.1);
  planet.metallic = 0.05;
  planet.roughness = 0.92;

  return { hull, armor, ceramic, coolLight, enemyHull, enemyPanel, enemyHot, torpedo, torpedoHot, hostileBolt, star, planet };
}

function createDeepSpace(scene: Scene, material: StandardMaterial) {
  const texture = new DynamicTexture("star-map", { width: 1024, height: 512 }, scene, false);
  const context = texture.getContext();
  context.fillStyle = "#010204";
  context.fillRect(0, 0, 1024, 512);
  let seed = 0x44aa55;
  const random = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  for (let index = 0; index < 520; index += 1) {
    const x = Math.floor(random() * 1024);
    const y = Math.floor(random() * 512);
    const alpha = 0.16 + random() * 0.65;
    const radius = random() > 0.97 ? 1.4 : random() > 0.8 ? 0.8 : 0.45;
    context.fillStyle = `rgba(${random() > 0.82 ? 185 : 225},${random() > 0.86 ? 205 : 228},240,${alpha})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  const gradient = context.createRadialGradient(760, 160, 10, 760, 160, 210);
  gradient.addColorStop(0, "rgba(70,88,112,0.08)");
  gradient.addColorStop(0.45, "rgba(38,48,70,0.035)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(520, 0, 504, 340);
  texture.update();
  material.emissiveTexture = texture;
  material.diffuseTexture = texture;

  const sky = CreateSphere("deep-space-shell", { diameter: 420, segments: 18 }, scene);
  sky.material = material;
  sky.isPickable = false;
}

function createPlanet(scene: Scene, material: PBRMaterial) {
  const planet = CreateSphere("distant-planet", { diameter: 44, segments: 24 }, scene);
  planet.position.set(-82, 23, 145);
  planet.material = material;
  planet.isPickable = false;
  const ring = CreateTorus("planet-ring", { diameter: 58, thickness: 0.42, tessellation: 80 }, scene);
  ring.position.copyFrom(planet.position);
  ring.rotation.x = Math.PI * 0.38;
  ring.rotation.z = Math.PI * 0.12;
  const ringMaterial = new StandardMaterial("planet-ring-material", scene);
  ringMaterial.diffuseColor = new Color3(0.12, 0.13, 0.14);
  ringMaterial.emissiveColor = new Color3(0.045, 0.05, 0.06);
  ringMaterial.alpha = 0.42;
  ring.material = ringMaterial;
  ring.isPickable = false;
}

function createCarrierAndTurret(scene: Scene, materials: ReturnType<typeof createMaterials>): TurretVisual {
  const carrier = new TransformNode("carrier", scene);
  const deck = CreateBox("carrier-deck", { width: 20, height: 3.2, depth: 74 }, scene);
  deck.position.set(0, -3.5, 25);
  deck.material = materials.hull;
  deck.parent = carrier;

  const spine = CreateBox("carrier-spine", { width: 5.2, height: 2.5, depth: 66 }, scene);
  spine.position.set(0, -1.5, 27);
  spine.material = materials.armor;
  spine.parent = carrier;

  for (const side of [-1, 1]) {
    const shoulder = CreateBox("carrier-shoulder", { width: 4.4, height: 2.2, depth: 54 }, scene);
    shoulder.position.set(side * 10.6, -4.1, 27);
    shoulder.material = materials.hull;
    shoulder.parent = carrier;
    for (let index = 0; index < 7; index += 1) {
      const panel = CreateBox("carrier-panel", { width: 3.5, height: 0.15, depth: 5.4 }, scene);
      panel.position.set(side * 9.7, -2.92, 4 + index * 8.2);
      panel.material = index % 2 === 0 ? materials.armor : materials.hull;
      panel.parent = carrier;
    }
  }

  for (let index = 0; index < 9; index += 1) {
    const strip = CreateBox("deck-light", { width: index % 2 === 0 ? 0.16 : 0.1, height: 0.06, depth: 2.8 }, scene);
    strip.position.set(index % 2 === 0 ? -3.15 : 3.15, -0.18, 1 + index * 6.5);
    strip.material = materials.coolLight;
    strip.parent = carrier;
  }

  const yaw = new TransformNode("turret-yaw", scene);
  yaw.position.set(0, -0.2, -4.2);
  yaw.parent = carrier;
  const base = CreateCylinder("turret-base", { height: 1.3, diameter: 4.8, tessellation: 24 }, scene);
  base.position.y = 0.4;
  base.material = materials.armor;
  base.parent = yaw;
  const collar = CreateTorus("turret-collar", { diameter: 4.3, thickness: 0.24, tessellation: 36 }, scene);
  collar.position.y = 1.0;
  collar.material = materials.ceramic;
  collar.parent = yaw;

  const cradle = new TransformNode("turret-cradle", scene);
  cradle.position.y = 1.25;
  cradle.parent = yaw;
  const housing = CreateBox("turret-housing", { width: 3.4, height: 1.5, depth: 3.2 }, scene);
  housing.position.z = 0.8;
  housing.material = materials.ceramic;
  housing.parent = cradle;

  for (const side of [-1, 1]) {
    const barrel = CreateCylinder("rail-cannon", { height: 6.6, diameter: 0.44, tessellation: 12 }, scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(side * 0.92, 0.12, 3.65);
    barrel.material = materials.armor;
    barrel.parent = cradle;
    const shroud = CreateBox("barrel-shroud", { width: 0.72, height: 0.62, depth: 2.8 }, scene);
    shroud.position.set(side * 0.92, 0.14, 2.05);
    shroud.material = materials.ceramic;
    shroud.parent = cradle;
  }

  const leftMuzzle = CreateSphere("left-muzzle", { diameter: 0.62, segments: 8 }, scene);
  leftMuzzle.position.set(-0.92, 0.12, 7.0);
  leftMuzzle.material = materials.coolLight;
  leftMuzzle.parent = cradle;
  leftMuzzle.scaling.setAll(HIDDEN_SCALE);
  leftMuzzle.isPickable = false;
  const rightMuzzle = CreateSphere("right-muzzle", { diameter: 0.62, segments: 8 }, scene);
  rightMuzzle.position.set(0.92, 0.12, 7.0);
  rightMuzzle.material = materials.coolLight;
  rightMuzzle.parent = cradle;
  rightMuzzle.scaling.setAll(HIDDEN_SCALE);
  rightMuzzle.isPickable = false;

  return { yaw, cradle, leftMuzzle, rightMuzzle };
}

function createTracerPool(scene: Scene, material: StandardMaterial, count: number): Tracer[] {
  return Array.from({ length: count }, (_, index) => {
    const mesh = CreateBox(`tracer-${index}`, { width: 0.055, height: 0.055, depth: 20 }, scene);
    mesh.material = material;
    mesh.scaling.setAll(HIDDEN_SCALE);
    mesh.isPickable = false;
    return { mesh, life: 0 };
  });
}

function createExplosionPool(scene: Scene, material: StandardMaterial, count: number): Explosion[] {
  return Array.from({ length: count }, (_, index) => {
    const mesh = CreateSphere(`explosion-${index}`, { diameter: 2.4, segments: 10 }, scene);
    mesh.material = material;
    mesh.scaling.setAll(HIDDEN_SCALE);
    mesh.isPickable = false;
    return { mesh, life: 0 };
  });
}
