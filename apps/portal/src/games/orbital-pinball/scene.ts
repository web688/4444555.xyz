import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  PointLight,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { getDailyRouteKey } from "./progress";

export type PinballPhase = "ready" | "running" | "paused" | "complete" | "failed";

export type PinballTelemetry = {
  phase: PinballPhase;
  score: number;
  multiplier: number;
  remaining: number;
  ballsRemaining: number;
  ballsPlayed: number;
  bumperHits: number;
  targetsCleared: number;
  targetsLit: number;
  relayLoops: number;
  maxMultiplier: number;
  charge: number;
  routeKey: string;
  inputMode: "keyboard" | "touch" | "gamepad";
  callout: string;
  fps: number;
};

export type PinballRuntime = {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  setMuted(muted: boolean): void;
  setLeftFlipper(active: boolean): void;
  setRightFlipper(active: boolean): void;
  setLaunch(active: boolean): void;
  destroy(): void;
};

type Segment = { ax: number; az: number; bx: number; bz: number };
type Bumper = { x: number; z: number; radius: number; cooldown: number; ring: Mesh };
type Target = { x: number; z: number; radius: number; hit: boolean; mesh: Mesh; cooldown: number };

const RUN_SECONDS = 180;
const BALL_RADIUS = 0.29;
const FIXED_STEP = 1 / 120;
const FLIPPER_LENGTH = 2.35;
const FLIPPER_RADIUS = 0.38;

const initialTelemetry = (): PinballTelemetry => ({
  phase: "ready",
  score: 0,
  multiplier: 1,
  remaining: RUN_SECONDS,
  ballsRemaining: 3,
  ballsPlayed: 0,
  bumperHits: 0,
  targetsCleared: 0,
  targetsLit: 0,
  relayLoops: 0,
  maxMultiplier: 1,
  charge: 0,
  routeKey: getDailyRouteKey(),
  inputMode: "keyboard",
  callout: "",
  fps: 60,
});

function unlitPbr(name: string, color: Color3, scene: Scene) {
  const material = new PBRMaterial(name, scene);
  material.albedoColor = color;
  material.metallic = 0;
  material.roughness = 1;
  material.unlit = true;
  return material;
}

function emissive(name: string, color: Color3, scene: Scene, alpha = 1) {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color.scale(0.05);
  material.emissiveColor = color;
  material.alpha = alpha;
  material.disableLighting = true;
  return material;
}

function tube(name: string, points: Array<[number, number]>, radius: number, material: PBRMaterial | StandardMaterial, scene: Scene) {
  const mesh = MeshBuilder.CreateTube(name, {
    path: points.map(([x, z]) => new Vector3(x, 0.34, z)),
    radius,
    tessellation: 14,
    cap: Mesh.CAP_ALL,
  }, scene);
  mesh.material = material;
  return mesh;
}

function distanceToSegment(x: number, z: number, segment: Segment) {
  const vx = segment.bx - segment.ax;
  const vz = segment.bz - segment.az;
  const wx = x - segment.ax;
  const wz = z - segment.az;
  const lengthSq = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / lengthSq));
  const px = segment.ax + vx * t;
  const pz = segment.az + vz * t;
  const dx = x - px;
  const dz = z - pz;
  const distance = Math.hypot(dx, dz);
  return { distance, nx: distance > 0.0001 ? dx / distance : 0, nz: distance > 0.0001 ? dz / distance : 1, px, pz, t };
}

export async function createOrbitalPinballScene(
  canvas: HTMLCanvasElement,
  onTelemetry: (telemetry: PinballTelemetry) => void,
): Promise<PinballRuntime> {
  const engine = new Engine(canvas, true, { antialias: true, preserveDrawingBuffer: false, stencil: true });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.004, 0.006, 0.008, 1);
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (coarsePointer) engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio || 1));

  const camera = new ArcRotateCamera("orbital-pinball-camera", -Math.PI / 2, 0.47, 28.5, new Vector3(0, 0.15, 0.25), scene);
  camera.fov = coarsePointer ? 0.72 : 0.66;
  camera.lowerRadiusLimit = camera.upperRadiusLimit = camera.radius;
  camera.inputs.clear();

  const skyLight = new HemisphericLight("pinball-soft-light", new Vector3(-0.25, 1, 0.15), scene);
  skyLight.intensity = 0.72;
  skyLight.diffuse = new Color3(0.74, 0.82, 0.88);
  skyLight.groundColor = new Color3(0.015, 0.02, 0.025);
  const accentLight = new PointLight("pinball-accent-light", new Vector3(0, 5, 1.5), scene);
  accentLight.diffuse = new Color3(0.18, 0.75, 0.88);
  accentLight.intensity = coarsePointer ? 12 : 22;
  accentLight.range = 18;

  const matteWhite = unlitPbr("pinball-matte-ivory", new Color3(0.9, 0.91, 0.88), scene);
  const softWhite = unlitPbr("pinball-soft-white", new Color3(0.62, 0.66, 0.66), scene);
  const carbon = new PBRMaterial("pinball-carbon", scene);
  carbon.albedoColor = new Color3(0.012, 0.018, 0.022);
  carbon.metallic = 0.08;
  carbon.roughness = 0.92;
  const cyan = emissive("pinball-cyan", new Color3(0.12, 0.88, 1), scene);
  const cyanDim = emissive("pinball-cyan-dim", new Color3(0.035, 0.22, 0.27), scene, 0.82);
  const amber = emissive("pinball-amber", new Color3(1, 0.43, 0.08), scene);
  const amberDim = emissive("pinball-amber-dim", new Color3(0.3, 0.11, 0.025), scene, 0.85);

  const field = MeshBuilder.CreateGround("floating-playfield", { width: 11.7, height: 19.25, subdivisions: 1 }, scene);
  field.position.z = 0.15;
  field.material = carbon;

  const underplate = MeshBuilder.CreateBox("floating-underplate", { width: 10.9, height: 0.12, depth: 18.3 }, scene);
  underplate.position.set(0, -0.12, 0.15);
  underplate.material = unlitPbr("underplate-black", new Color3(0.006, 0.008, 0.009), scene);

  const stars: Mesh[] = [];
  let starSeed = 0x4444555;
  const random = () => {
    starSeed = (Math.imul(starSeed, 1664525) + 1013904223) >>> 0;
    return starSeed / 4294967296;
  };
  for (let index = 0; index < (coarsePointer ? 22 : 42); index += 1) {
    const star = MeshBuilder.CreateSphere(`void-star-${index}`, { diameter: 0.025 + random() * 0.045, segments: 4 }, scene);
    const side = random() > 0.5 ? 1 : -1;
    star.position.set(side * (6.6 + random() * 7), -0.25 - random(), -10 + random() * 22);
    star.material = random() > 0.82 ? cyanDim : softWhite;
    stars.push(star);
  }

  const leftRail: Array<[number, number]> = [[-5.65, -8.55], [-5.65, 7.35], [-4.85, 9.05], [-2.75, 10.05], [0, 10.35]];
  const rightRail: Array<[number, number]> = [[0, 10.35], [2.75, 10.05], [4.85, 9.05], [5.65, 7.35], [5.65, -8.55]];
  const leftDrainRail: Array<[number, number]> = [[-5.65, -8.55], [-4.25, -9.1], [-2.35, -9.35]];
  const rightDrainRail: Array<[number, number]> = [[2.35, -9.35], [4.35, -9.05], [5.65, -8.55]];
  const launchDivider: Array<[number, number]> = [[4.45, -8.35], [4.45, 6.9], [4.15, 7.8]];

  tube("rail-left", leftRail, 0.105, matteWhite, scene);
  tube("rail-right", rightRail, 0.105, matteWhite, scene);
  tube("rail-drain-left", leftDrainRail, 0.105, matteWhite, scene);
  tube("rail-drain-right", rightDrainRail, 0.105, matteWhite, scene);
  tube("rail-launch-divider", launchDivider, 0.085, softWhite, scene);

  tube("route-left", [[-4.6, 5.9], [-3.8, 7.8], [-2.1, 8.85]], 0.055, cyanDim, scene);
  tube("route-right", [[3.9, 7.65], [2.4, 8.75], [0.6, 9.2]], 0.055, amberDim, scene);
  tube("lower-guide-left", [[-4.65, -4.6], [-3.4, -5.8], [-2.7, -7.1]], 0.065, softWhite, scene);
  tube("lower-guide-right", [[4.1, -4.5], [3.25, -5.7], [2.7, -7.1]], 0.065, softWhite, scene);

  const orbitalRing = MeshBuilder.CreateTorus("relay-orbit", { diameter: 4.3, thickness: 0.075, tessellation: 64 }, scene);
  orbitalRing.position.set(0, 0.2, 2.2);
  orbitalRing.material = cyanDim;
  const orbitalRingInner = MeshBuilder.CreateTorus("relay-orbit-inner", { diameter: 3.55, thickness: 0.035, tessellation: 64 }, scene);
  orbitalRingInner.position.set(0, 0.205, 2.2);
  orbitalRingInner.material = softWhite;

  const relayCore = MeshBuilder.CreateCylinder("relay-core", { diameter: 1.05, height: 0.18, tessellation: 40 }, scene);
  relayCore.position.set(0, 0.16, 2.2);
  relayCore.material = carbon;
  const relayCoreRing = MeshBuilder.CreateTorus("relay-core-energy", { diameter: 0.76, thickness: 0.07, tessellation: 40 }, scene);
  relayCoreRing.position.set(0, 0.28, 2.2);
  relayCoreRing.material = amber;

  const bumperData = [
    { x: -2.65, z: 3.7, radius: 0.72 },
    { x: 2.55, z: 4.05, radius: 0.72 },
    { x: 0, z: 6.15, radius: 0.76 },
    { x: -0.15, z: -0.45, radius: 0.66 },
  ];
  const bumpers: Bumper[] = bumperData.map((entry, index) => {
    const base = MeshBuilder.CreateCylinder(`bumper-base-${index}`, { diameter: entry.radius * 1.95, height: 0.28, tessellation: 32 }, scene);
    base.position.set(entry.x, 0.18, entry.z);
    base.material = matteWhite;
    const ring = MeshBuilder.CreateTorus(`bumper-ring-${index}`, { diameter: entry.radius * 1.48, thickness: 0.11, tessellation: 32 }, scene);
    ring.position.set(entry.x, 0.39, entry.z);
    ring.material = index === 2 ? amber : cyan;
    return { ...entry, cooldown: 0, ring };
  });

  const targetXs = [-2.8, -0.95, 0.95, 2.8];
  const targets: Target[] = targetXs.map((x, index) => {
    const mesh = MeshBuilder.CreateBox(`relay-target-${index}`, { width: 0.52, height: 0.58, depth: 0.22 }, scene);
    mesh.position.set(x, 0.32, 0.85);
    mesh.material = amberDim;
    return { x, z: 0.85, radius: 0.42, hit: false, mesh, cooldown: 0 };
  });

  const leftPivot = { x: -2.35, z: -7.38 };
  const rightPivot = { x: 2.35, z: -7.38 };
  const leftFlipperRoot = new TransformNode("left-flipper-root", scene);
  leftFlipperRoot.position.set(leftPivot.x, 0.36, leftPivot.z);
  const rightFlipperRoot = new TransformNode("right-flipper-root", scene);
  rightFlipperRoot.position.set(rightPivot.x, 0.36, rightPivot.z);
  const leftFlipperMesh = MeshBuilder.CreateBox("left-flipper", { width: FLIPPER_LENGTH, height: 0.3, depth: 0.54 }, scene);
  leftFlipperMesh.parent = leftFlipperRoot;
  leftFlipperMesh.position.x = FLIPPER_LENGTH / 2;
  leftFlipperMesh.material = matteWhite;
  const rightFlipperMesh = MeshBuilder.CreateBox("right-flipper", { width: FLIPPER_LENGTH, height: 0.3, depth: 0.54 }, scene);
  rightFlipperMesh.parent = rightFlipperRoot;
  rightFlipperMesh.position.x = FLIPPER_LENGTH / 2;
  rightFlipperMesh.material = matteWhite;
  const leftFlipperMark = MeshBuilder.CreateBox("left-flipper-mark", { width: 0.7, height: 0.315, depth: 0.565 }, scene);
  leftFlipperMark.parent = leftFlipperMesh;
  leftFlipperMark.position.x = 0.55;
  leftFlipperMark.material = amber;
  const rightFlipperMark = MeshBuilder.CreateBox("right-flipper-mark", { width: 0.7, height: 0.315, depth: 0.565 }, scene);
  rightFlipperMark.parent = rightFlipperMesh;
  rightFlipperMark.position.x = -0.55;
  rightFlipperMark.material = amber;

  const ballMesh = MeshBuilder.CreateSphere("orbital-ball", { diameter: BALL_RADIUS * 2, segments: 20 }, scene);
  const ballMaterial = new PBRMaterial("orbital-ball-metal", scene);
  ballMaterial.albedoColor = new Color3(0.72, 0.78, 0.8);
  ballMaterial.metallic = 0.78;
  ballMaterial.roughness = 0.2;
  ballMesh.material = ballMaterial;
  ballMesh.position.y = 0.43;

  const plunger = MeshBuilder.CreateCylinder("launch-plunger", { diameter: 0.55, height: 0.2, tessellation: 24 }, scene);
  plunger.position.set(5.08, 0.22, -8.62);
  plunger.material = amber;

  const wallSegments: Segment[] = [];
  const addPathSegments = (points: Array<[number, number]>) => {
    for (let index = 0; index < points.length - 1; index += 1) {
      wallSegments.push({ ax: points[index][0], az: points[index][1], bx: points[index + 1][0], bz: points[index + 1][1] });
    }
  };
  addPathSegments(leftRail);
  addPathSegments(rightRail);
  addPathSegments(leftDrainRail);
  addPathSegments(rightDrainRail);
  addPathSegments(launchDivider);

  let telemetry = initialTelemetry();
  let lastTelemetryAt = 0;
  let calloutUntil = 0;
  let accumulator = 0;
  let lastFrameAt = performance.now();
  let pausedAt = 0;
  let destroyed = false;
  let elapsed = 0;
  let ballResetTimer = 0;
  let comboTimer = 0;
  let relayCooldown = 0;
  let targetBankReset = 0;
  let stuckTimer = 0;
  let leftAngle = 0.22;
  let rightAngle = Math.PI - 0.22;
  let leftKeyboard = false;
  let rightKeyboard = false;
  let leftTouch = false;
  let rightTouch = false;
  let launchKeyboard = false;
  let launchTouch = false;
  let launchWasActive = false;
  let launchCharge = 0;
  let muted = false;
  let audioContext: AudioContext | null = null;
  const ball = { x: 5.08, z: -7.95, vx: 0, vz: 0, active: true, inPlunger: true };

  const tone = (frequency: number, duration = 0.055, gain = 0.035) => {
    if (muted) return;
    try {
      audioContext ??= new AudioContext();
      if (audioContext.state === "suspended") void audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const volume = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(gain, audioContext.currentTime);
      volume.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
      oscillator.connect(volume).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch {
      // Audio is enhancement only.
    }
  };

  const emit = (force = false) => {
    const now = performance.now();
    if (!force && now - lastTelemetryAt < 50) return;
    lastTelemetryAt = now;
    telemetry = {
      ...telemetry,
      remaining: Math.max(0, Math.ceil(RUN_SECONDS - elapsed)),
      charge: launchCharge,
      targetsLit: targets.filter((target) => target.hit).length,
      fps: Math.max(1, Math.round(engine.getFps() || 60)),
      callout: now < calloutUntil ? telemetry.callout : "",
    };
    onTelemetry({ ...telemetry });
  };

  const callout = (text: string, seconds = 1.1) => {
    telemetry.callout = text;
    calloutUntil = performance.now() + seconds * 1000;
    emit(true);
  };

  const addScore = (base: number) => {
    telemetry.score += Math.round(base * telemetry.multiplier);
  };

  const advanceCombo = () => {
    telemetry.multiplier = Math.min(8, telemetry.multiplier + 1);
    telemetry.maxMultiplier = Math.max(telemetry.maxMultiplier, telemetry.multiplier);
    comboTimer = 3.2;
  };

  const syncBall = () => {
    ballMesh.setEnabled(ball.active);
    if (ball.active) ballMesh.position.set(ball.x, 0.43, ball.z);
  };

  const resetBall = (countAsNewBall: boolean) => {
    ball.x = 5.08;
    ball.z = -7.95;
    ball.vx = 0;
    ball.vz = 0;
    ball.active = true;
    ball.inPlunger = true;
    launchCharge = 0;
    launchWasActive = false;
    if (countAsNewBall) telemetry.ballsPlayed += 1;
    syncBall();
  };

  const resetTargets = () => {
    for (const target of targets) {
      target.hit = false;
      target.mesh.material = amberDim;
    }
    targetBankReset = 0;
  };

  const resetRun = () => {
    telemetry = initialTelemetry();
    telemetry.phase = "running";
    telemetry.ballsPlayed = 1;
    elapsed = 0;
    ballResetTimer = 0;
    comboTimer = 0;
    relayCooldown = 0;
    stuckTimer = 0;
    resetTargets();
    resetBall(false);
    callout("BALL 01 · RELAY ARMED", 1.5);
  };

  const finishRun = (completed: boolean) => {
    telemetry.phase = completed ? "complete" : "failed";
    ball.active = false;
    syncBall();
    callout(completed ? "ROUTE COMPLETE" : "SIGNAL LOST", 2);
    emit(true);
  };

  const launchBall = () => {
    if (telemetry.phase !== "running" || !ball.active || !ball.inPlunger) return;
    const power = 10.8 + launchCharge * 6.2;
    ball.vx = -0.55 - launchCharge * 0.45;
    ball.vz = power;
    ball.inPlunger = false;
    launchCharge = 0;
    tone(180, 0.09, 0.05);
    callout("LAUNCH", 0.55);
  };

  const drainBall = () => {
    if (!ball.active) return;
    ball.active = false;
    syncBall();
    telemetry.ballsRemaining = Math.max(0, telemetry.ballsRemaining - 1);
    telemetry.multiplier = 1;
    comboTimer = 0;
    tone(88, 0.2, 0.045);
    if (telemetry.ballsRemaining <= 0) {
      finishRun(false);
      return;
    }
    ballResetTimer = 1.05;
    callout(`BALL ${telemetry.ballsPlayed.toString().padStart(2, "0")} LOST`, 0.9);
  };

  const resolveSegment = (segment: Segment, radius: number, restitution = 0.9, kick = 0) => {
    const contact = distanceToSegment(ball.x, ball.z, segment);
    if (contact.distance >= radius || contact.distance <= 0.00001) return false;
    const penetration = radius - contact.distance;
    ball.x += contact.nx * penetration;
    ball.z += contact.nz * penetration;
    const inward = ball.vx * contact.nx + ball.vz * contact.nz;
    if (inward < 0) {
      ball.vx -= (1 + restitution) * inward * contact.nx;
      ball.vz -= (1 + restitution) * inward * contact.nz;
    }
    if (kick > 0) {
      ball.vz = Math.max(ball.vz, 5.8 + kick);
      ball.vx += contact.nx * kick * 0.38;
    }
    return true;
  };

  const resolveCircle = (x: number, z: number, radius: number, impulse: number) => {
    const dx = ball.x - x;
    const dz = ball.z - z;
    const distance = Math.hypot(dx, dz);
    const minimum = BALL_RADIUS + radius;
    if (distance >= minimum || distance < 0.00001) return false;
    const nx = dx / distance;
    const nz = dz / distance;
    const penetration = minimum - distance;
    ball.x += nx * penetration;
    ball.z += nz * penetration;
    const inward = ball.vx * nx + ball.vz * nz;
    if (inward < 0) {
      ball.vx -= 1.82 * inward * nx;
      ball.vz -= 1.82 * inward * nz;
    }
    ball.vx += nx * impulse;
    ball.vz += nz * impulse;
    return true;
  };

  const flipperSegment = (pivot: { x: number; z: number }, angle: number): Segment => ({
    ax: pivot.x,
    az: pivot.z,
    bx: pivot.x + Math.cos(angle) * FLIPPER_LENGTH,
    bz: pivot.z + Math.sin(angle) * FLIPPER_LENGTH,
  });

  const stepPhysics = (dt: number) => {
    if (telemetry.phase !== "running") return;
    elapsed += dt;
    if (elapsed >= RUN_SECONDS) {
      finishRun(true);
      return;
    }

    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) telemetry.multiplier = 1;
    }
    relayCooldown = Math.max(0, relayCooldown - dt);
    for (const bumper of bumpers) bumper.cooldown = Math.max(0, bumper.cooldown - dt);
    for (const target of targets) target.cooldown = Math.max(0, target.cooldown - dt);

    if (targetBankReset > 0) {
      targetBankReset -= dt;
      if (targetBankReset <= 0) resetTargets();
    }

    if (!ball.active) {
      if (ballResetTimer > 0) {
        ballResetTimer -= dt;
        if (ballResetTimer <= 0 && telemetry.ballsRemaining > 0) {
          telemetry.ballsPlayed += 1;
          resetBall(false);
          callout(`BALL ${telemetry.ballsPlayed.toString().padStart(2, "0")} · READY`, 1);
        }
      }
      emit();
      return;
    }

    const gamepads = navigator.getGamepads?.() ?? [];
    const gamepad = gamepads[0];
    const gamepadLeft = Boolean(gamepad && (gamepad.buttons[4]?.pressed || gamepad.buttons[6]?.pressed));
    const gamepadRight = Boolean(gamepad && (gamepad.buttons[5]?.pressed || gamepad.buttons[7]?.pressed));
    const gamepadLaunch = Boolean(gamepad && (gamepad.buttons[0]?.pressed || gamepad.buttons[2]?.pressed));
    if (gamepadLeft || gamepadRight || gamepadLaunch) telemetry.inputMode = "gamepad";

    const leftActive = leftKeyboard || leftTouch || gamepadLeft;
    const rightActive = rightKeyboard || rightTouch || gamepadRight;
    const launchActive = launchKeyboard || launchTouch || gamepadLaunch;
    const leftTarget = leftActive ? 1.02 : 0.22;
    const rightTarget = rightActive ? Math.PI - 1.02 : Math.PI - 0.22;
    leftAngle += (leftTarget - leftAngle) * Math.min(1, dt * 24);
    rightAngle += (rightTarget - rightAngle) * Math.min(1, dt * 24);
    leftFlipperRoot.rotation.y = -leftAngle;
    rightFlipperRoot.rotation.y = -rightAngle;

    if (ball.inPlunger) {
      ball.x = 5.08;
      ball.z = -7.95 - launchCharge * 0.48;
      if (launchActive) launchCharge = Math.min(1, launchCharge + dt * 0.8);
      if (launchWasActive && !launchActive) launchBall();
      launchWasActive = launchActive;
      syncBall();
      emit();
      return;
    }

    ball.vz -= 1.35 * dt;
    const damping = Math.pow(0.9975, dt * 120);
    ball.vx *= damping;
    ball.vz *= damping;
    const speed = Math.hypot(ball.vx, ball.vz);
    if (speed > 18) {
      ball.vx = (ball.vx / speed) * 18;
      ball.vz = (ball.vz / speed) * 18;
    }
    ball.x += ball.vx * dt;
    ball.z += ball.vz * dt;

    for (const segment of wallSegments) resolveSegment(segment, BALL_RADIUS + 0.105, 0.91);

    if (ball.x > 4.45 && ball.z < 7.75) {
      if (ball.x > 5.38) {
        ball.x = 5.38;
        ball.vx = -Math.abs(ball.vx) * 0.86;
      }
      if (ball.x < 4.74) {
        ball.x = 4.74;
        ball.vx = Math.abs(ball.vx) * 0.84;
      }
    } else if (ball.z > 7.55 && ball.x > 4.15) {
      ball.vx -= 7.8 * dt;
    }

    resolveSegment(flipperSegment(leftPivot, leftAngle), BALL_RADIUS + FLIPPER_RADIUS, 0.9, leftActive ? 5.2 : 0);
    resolveSegment(flipperSegment(rightPivot, rightAngle), BALL_RADIUS + FLIPPER_RADIUS, 0.9, rightActive ? 5.2 : 0);

    for (const bumper of bumpers) {
      if (resolveCircle(bumper.x, bumper.z, bumper.radius, 4.4) && bumper.cooldown <= 0) {
        bumper.cooldown = 0.16;
        telemetry.bumperHits += 1;
        addScore(320);
        advanceCombo();
        bumper.ring.scaling.setAll(1.18);
        tone(350 + telemetry.multiplier * 42, 0.055, 0.035);
        callout(telemetry.multiplier >= 4 ? `RELAY CHAIN ×${telemetry.multiplier}` : "+320 RELAY", 0.48);
      }
      bumper.ring.scaling.x += (1 - bumper.ring.scaling.x) * Math.min(1, dt * 12);
      bumper.ring.scaling.y = bumper.ring.scaling.x;
      bumper.ring.scaling.z = bumper.ring.scaling.x;
    }

    for (const target of targets) {
      if (resolveCircle(target.x, target.z, target.radius, 1.8) && target.cooldown <= 0) {
        target.cooldown = 0.2;
        if (!target.hit) {
          target.hit = true;
          target.mesh.material = amber;
          telemetry.targetsCleared += 1;
          addScore(650);
          advanceCombo();
          tone(580, 0.045, 0.025);
          callout("NODE LOCKED", 0.45);
          if (targets.every((candidate) => candidate.hit)) {
            addScore(5000);
            telemetry.relayLoops += 1;
            targetBankReset = 1.4;
            tone(820, 0.12, 0.045);
            callout("ORBITAL ARRAY · +5000", 1.1);
          }
        }
      }
    }

    if (relayCooldown <= 0 && ball.z > 8.2 && ball.x < -2.2) {
      relayCooldown = 1.25;
      telemetry.relayLoops += 1;
      addScore(1400);
      advanceCombo();
      tone(720, 0.08, 0.03);
      callout("HIGH ORBIT · +1400", 0.7);
    }

    const currentSpeed = Math.hypot(ball.vx, ball.vz);
    if (currentSpeed < 0.38 && ball.z > -7.1) stuckTimer += dt;
    else stuckTimer = 0;
    if (stuckTimer > 2.4) {
      ball.vz += 4.6;
      ball.vx += ball.x <= 0 ? 1.7 : -1.7;
      stuckTimer = 0;
      callout("AUTO NUDGE", 0.55);
    }

    if (ball.z < -10.15 || Math.abs(ball.x) > 7.2 || ball.z > 11.5) drainBall();
    syncBall();
    emit();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      leftKeyboard = true;
      telemetry.inputMode = "keyboard";
      event.preventDefault();
    }
    if (event.code === "ArrowRight" || event.code === "KeyD") {
      rightKeyboard = true;
      telemetry.inputMode = "keyboard";
      event.preventDefault();
    }
    if (event.code === "Space") {
      launchKeyboard = true;
      telemetry.inputMode = "keyboard";
      event.preventDefault();
    }
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") leftKeyboard = false;
    if (event.code === "ArrowRight" || event.code === "KeyD") rightKeyboard = false;
    if (event.code === "Space") launchKeyboard = false;
  };
  const clearInput = () => {
    leftKeyboard = false;
    rightKeyboard = false;
    launchKeyboard = false;
    leftTouch = false;
    rightTouch = false;
    launchTouch = false;
  };
  const onResize = () => engine.resize();
  const onVisibility = () => {
    if (document.hidden && telemetry.phase === "running") {
      telemetry.phase = "paused";
      pausedAt = performance.now();
      clearInput();
      emit(true);
    }
  };

  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clearInput);
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);

  syncBall();
  emit(true);

  scene.onBeforeRenderObservable.add(() => {
    if (destroyed) return;
    const now = performance.now();
    const frameSeconds = Math.min(0.05, Math.max(0, (now - lastFrameAt) / 1000));
    lastFrameAt = now;
    if (telemetry.phase === "running") {
      accumulator += frameSeconds;
      let iterations = 0;
      while (accumulator >= FIXED_STEP && iterations < 8) {
        stepPhysics(FIXED_STEP);
        accumulator -= FIXED_STEP;
        iterations += 1;
      }
    }
    if (!reducedMotion) {
      orbitalRing.rotation.y += frameSeconds * 0.12;
      orbitalRingInner.rotation.y -= frameSeconds * 0.08;
      relayCoreRing.rotation.y += frameSeconds * 0.7;
      stars.forEach((star, index) => {
        star.position.z += Math.sin(now * 0.00008 + index) * frameSeconds * 0.012;
      });
    }
  });

  engine.runRenderLoop(() => scene.render());

  const runtime: PinballRuntime = {
    start() {
      if (telemetry.phase !== "ready") return;
      try {
        audioContext ??= new AudioContext();
      } catch {
        // Audio is optional.
      }
      resetRun();
      emit(true);
    },
    pause() {
      if (telemetry.phase !== "running") return;
      telemetry.phase = "paused";
      pausedAt = performance.now();
      clearInput();
      emit(true);
    },
    resume() {
      if (telemetry.phase !== "paused") return;
      telemetry.phase = "running";
      lastFrameAt = performance.now();
      accumulator = 0;
      if (pausedAt) pausedAt = 0;
      emit(true);
    },
    restart() {
      resetRun();
      emit(true);
    },
    setMuted(nextMuted: boolean) {
      muted = nextMuted;
    },
    setLeftFlipper(active: boolean) {
      leftTouch = active;
      if (active) telemetry.inputMode = "touch";
    },
    setRightFlipper(active: boolean) {
      rightTouch = active;
      if (active) telemetry.inputMode = "touch";
    },
    setLaunch(active: boolean) {
      launchTouch = active;
      if (active) telemetry.inputMode = "touch";
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearInput();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearInput);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
      void audioContext?.close().catch(() => undefined);
      audioContext = null;
    },
  };

  return runtime;
}
