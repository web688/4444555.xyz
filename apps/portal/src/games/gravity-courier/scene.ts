import { Engine } from "@babylonjs/core/Engines/engine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Scalar } from "@babylonjs/core/Maths/math.scalar.js";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { PointLight } from "@babylonjs/core/Lights/pointLight.js";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture.js";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder.pure.js";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder.pure.js";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder.pure.js";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder.pure.js";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer.js";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem.js";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline.js";
import { CourierAudio } from "./audio";

export type GatePhase = "running" | "paused" | "complete" | "error";

export type GateTelemetry = {
  phase: GatePhase;
  elapsed: number;
  progress: number;
  score: number;
  multiplier: number;
  speed: number;
  integrity: number;
  quality: "high" | "balanced";
  fps: number;
  inputMode: "keyboard" | "pointer" | "gamepad";
  callout: string;
  steerX: number;
  steerY: number;
  steering: boolean;
};

export type GateRuntime = {
  pause(): void;
  resume(): void;
  restart(): void;
  setMuted(muted: boolean): void;
  destroy(): void;
};

type Obstacle = {
  root: TransformNode;
  radius: number;
  resolved: boolean;
  phase: number;
};

type MovingRing = { root: TransformNode; spin: number };

const ROUTE_SECONDS = 30;
const ROUTE_LENGTH = 310;
const laneX = [-7, -3.5, 0, 3.5, 7];
const laneY = [-3.6, -1.2, 1.4, 3.8];

export async function createGravityCourierScene(
  canvas: HTMLCanvasElement,
  onTelemetry: (telemetry: GateTelemetry) => void,
): Promise<GateRuntime> {
  if (!Engine.isSupported()) throw new Error("WebGL is not available in this browser.");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let quality: GateTelemetry["quality"] =
    !reducedMotion && window.devicePixelRatio <= 2 && (navigator.hardwareConcurrency ?? 4) >= 6 ? "high" : "balanced";
  const engine = new Engine(
    canvas,
    true,
    { preserveDrawingBuffer: false, stencil: true, powerPreference: "high-performance" },
    true,
  );
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio, quality === "high" ? 2 : 1.5));

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.004, 0.006, 0.016, 1);
  scene.fogMode = Scene.FOGMODE_NONE;
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.exposure = 1.12;
  scene.imageProcessingConfiguration.contrast = 1.42;
  scene.imageProcessingConfiguration.vignetteEnabled = true;
  scene.imageProcessingConfiguration.vignetteWeight = 1.45;
  scene.imageProcessingConfiguration.vignetteColor = new Color4(0.02, 0.025, 0.06, 1);

  const camera = new FreeCamera("courier-camera", new Vector3(0, 4.7, -16.5), scene);
  camera.minZ = 0.1;
  camera.maxZ = 600;
  camera.fov = 0.82;
  camera.setTarget(new Vector3(0, 0.4, 32));

  const ambient = new HemisphericLight("orbital-ambient", new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.3;
  ambient.diffuse = new Color3(0.28, 0.38, 0.62);
  ambient.groundColor = new Color3(0.18, 0.08, 0.03);
  const keyLight = new DirectionalLight("solar-key", new Vector3(-0.45, -0.3, -1), scene);
  keyLight.position = new Vector3(35, 28, -20);
  keyLight.intensity = 4.6;
  keyLight.diffuse = new Color3(1, 0.68, 0.3);
  const rimLight = new PointLight("cyan-rim", new Vector3(-10, 2, -3), scene);
  rimLight.intensity = 38;
  rimLight.range = 42;
  rimLight.diffuse = new Color3(0.15, 0.75, 1);

  const glow = new GlowLayer("energy-glow", scene, { blurKernelSize: quality === "high" ? 48 : 24 });
  glow.intensity = quality === "high" ? 0.28 : 0.2;
  const pipeline = new DefaultRenderingPipeline("cinematic-pipeline", true, scene, [camera]);
  pipeline.fxaaEnabled = false;
  pipeline.bloomEnabled = false;
  pipeline.chromaticAberrationEnabled = false;
  pipeline.grainEnabled = false;

  const audio = new CourierAudio();
  void audio.arm();
  const ship = createCourier(scene);
  const shield = createShield(scene, ship);
  const movingRings = createOrbitalLane(scene, quality);
  const obstacles = createObstacles(scene, quality);
  const relay = createRelayGate(scene, quality);
  createPlanet(scene, quality);
  const starfield = createStarfield(scene, ship, quality);

  const pressed = new Set<string>();
  const pointerTarget = { active: false, x: 0, y: 0 };
  let targetX = 0;
  let targetY = 0;
  let elapsed = 0;
  let score = 0;
  let multiplier = 1;
  let integrity = 3;
  let speed = 54;
  let paused = false;
  let complete = false;
  let destroyed = false;
  let hitFlash = 0;
  let nearMissFlash = 0;
  let shake = 0;
  let lastTelemetry = 0;
  let smoothedFps = 60;
  let lowFpsSeconds = 0;
  let inputMode: GateTelemetry["inputMode"] = "keyboard";
  let callout = "";
  let calloutSeconds = 0;
  let relayAnnounced = false;

  const onKeyDown = (event: KeyboardEvent) => {
    pressed.add(event.code);
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    void audio.arm();
    inputMode = "keyboard";
  };
  const onKeyUp = (event: KeyboardEvent) => pressed.delete(event.code);
  const onPointerDown = (event: PointerEvent) => {
    pointerTarget.active = true;
    canvas.setPointerCapture(event.pointerId);
    setPointerTarget(event);
    inputMode = "pointer";
    void audio.arm();
  };
  const onPointerMove = (event: PointerEvent) => {
    if (pointerTarget.active) setPointerTarget(event);
  };
  const onPointerUp = (event: PointerEvent) => {
    pointerTarget.active = false;
    targetX = ship.position.x;
    targetY = ship.position.y;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  const onVisibility = () => {
    if (document.hidden) {
      clearActiveInput();
      pause();
    }
  };
  const onBlur = () => clearActiveInput();
  const onResize = () => engine.resize();

  function clearActiveInput() {
    pressed.clear();
    pointerTarget.active = false;
    targetX = ship.position.x;
    targetY = ship.position.y;
    audio.setBoost(false);
  }

  function setPointerTarget(event: PointerEvent) {
    const bounds = canvas.getBoundingClientRect();
    pointerTarget.x = Scalar.Clamp(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1);
    pointerTarget.y = Scalar.Clamp(-(((event.clientY - bounds.top) / bounds.height) * 2 - 1), -1, 1);
  }

  function update(delta: number) {
    if (paused || destroyed) return;
    const activeGamepad = Array.from(navigator.getGamepads?.() ?? []).find((pad): pad is Gamepad => Boolean(pad?.connected));
    const gamepadX = Math.abs(activeGamepad?.axes[0] ?? 0) > 0.12 ? activeGamepad?.axes[0] ?? 0 : 0;
    const gamepadY = Math.abs(activeGamepad?.axes[1] ?? 0) > 0.12 ? activeGamepad?.axes[1] ?? 0 : 0;
    const gamepadBoost = Boolean(activeGamepad?.buttons[0]?.pressed || (activeGamepad?.buttons[7]?.value ?? 0) > 0.35);
    const gamepadSteering = Math.abs(gamepadX) > 0 || Math.abs(gamepadY) > 0;
    const gamepadActive = gamepadSteering || gamepadBoost;
    if (gamepadActive) inputMode = "gamepad";

    smoothedFps = Scalar.Lerp(smoothedFps, 1 / Math.max(delta, 0.001), 0.045);
    if (quality === "high") {
      lowFpsSeconds = smoothedFps < 47 ? lowFpsSeconds + delta : Math.max(0, lowFpsSeconds - delta * 0.5);
      if (lowFpsSeconds > 2.4) {
        quality = "balanced";
        engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio, 1.25));
        pipeline.chromaticAberrationEnabled = false;
        pipeline.grainEnabled = false;
        pipeline.bloomEnabled = false;
        glow.intensity = 0.2;
        callout = "ADAPTIVE RENDERING · BALANCED";
        calloutSeconds = 2.2;
      }
    }

    const boost = (pressed.has("Space") || pointerTarget.active || gamepadBoost) && !complete;
    const targetSpeed = complete ? 18 : boost ? 82 : 54;
    speed = Scalar.Lerp(speed, targetSpeed, 1 - Math.exp(-delta * 3.2));
    audio.setBoost(boost);
    starfield.emitRate = (quality === "high" ? 420 : 190) * (boost ? 1.65 : 1);

    if (!complete) {
      elapsed = Math.min(ROUTE_SECONDS, elapsed + delta);
      score += Math.round(speed * delta * multiplier * 0.8);
      if (elapsed >= ROUTE_SECONDS) {
        complete = true;
        callout = "DELIVERY CONFIRMED";
        calloutSeconds = 3;
        audio.complete();
      }
    }

    const horizontal = gamepadSteering ? gamepadX : Number(pressed.has("KeyD") || pressed.has("ArrowRight")) - Number(pressed.has("KeyA") || pressed.has("ArrowLeft"));
    const vertical = gamepadSteering ? -gamepadY : Number(pressed.has("KeyW") || pressed.has("ArrowUp")) - Number(pressed.has("KeyS") || pressed.has("ArrowDown"));
    const steering = pointerTarget.active || gamepadSteering || horizontal !== 0 || vertical !== 0;
    if (pointerTarget.active) {
      targetX = pointerTarget.x * 8.3;
      targetY = pointerTarget.y * 4.5;
    } else {
      targetX = Scalar.Clamp(ship.position.x + horizontal * 1.35, -8.3, 8.3);
      targetY = Scalar.Clamp(ship.position.y + vertical * 1, -4.4, 4.4);
    }
    const follow = 1 - Math.exp(-delta * 20);
    ship.position.x = Scalar.Lerp(ship.position.x, targetX, follow);
    ship.position.y = Scalar.Lerp(ship.position.y, targetY, follow);
    ship.rotation.z = Scalar.Lerp(ship.rotation.z, -(targetX - ship.position.x) * 0.23 - horizontal * 0.16, follow);
    ship.rotation.x = Scalar.Lerp(ship.rotation.x, (targetY - ship.position.y) * 0.08, follow);
    ship.scaling.z = Scalar.Lerp(ship.scaling.z, boost ? 1.08 : 1, follow);

    const routeDelta = speed * delta;
    for (const ring of movingRings) {
      ring.root.position.z -= routeDelta;
      ring.root.rotation.z += ring.spin * delta;
      if (ring.root.position.z < -28) ring.root.position.z += ROUTE_LENGTH;
    }
    const routeProgress = elapsed / ROUTE_SECONDS;
    relay.root.position.z = 250 - Math.pow(routeProgress, 2.35) * 253;
    relay.root.rotation.z += delta * (complete ? 1.4 : 0.26);
    relay.inner.rotation.z -= delta * (complete ? 2 : 0.48);
    const relayPulse = 1 + Math.sin(elapsed * 4.5) * 0.04 + (complete ? Math.sin(elapsed * 12) * 0.08 : 0);
    relay.core.scaling.setAll(relayPulse);
    relay.light.intensity = 24 + routeProgress * 34 + (complete ? 32 : 0);
    if (!relayAnnounced && routeProgress > 0.8) {
      relayAnnounced = true;
      callout = "RELAY LOCK ACQUIRED";
      calloutSeconds = 2.2;
    }
    for (const obstacle of obstacles) {
      obstacle.root.position.z -= routeDelta;
      obstacle.root.rotation.z += Math.sin(elapsed * 0.4 + obstacle.phase) * delta * 0.22;
      if (obstacle.root.position.z < -10) recycleObstacle(obstacle, obstacles);
      const zDistance = Math.abs(obstacle.root.position.z - ship.position.z);
      const xDistance = obstacle.root.position.x - ship.position.x;
      const yDistance = obstacle.root.position.y - ship.position.y;
      const lateral = Math.hypot(xDistance, yDistance);
      if (!obstacle.resolved && zDistance < 1.45) {
        obstacle.resolved = true;
        if (lateral < obstacle.radius + 0.9) {
          integrity = Math.max(0, integrity - 1);
          multiplier = 1;
          score = Math.max(0, score - 650);
          hitFlash = 1;
          shake = reducedMotion ? 0.06 : 0.38;
          callout = "HULL IMPACT · CHAIN LOST";
          calloutSeconds = 1.5;
          audio.hit();
        } else if (lateral < obstacle.radius + 3.1) {
          multiplier = Math.min(8, multiplier + 1);
          score += 480 * multiplier;
          nearMissFlash = 1;
          callout = `NEAR MISS · ×${multiplier}`;
          calloutSeconds = 1.25;
          audio.nearMiss(multiplier / 8);
        }
      }
    }

    hitFlash = Math.max(0, hitFlash - delta * 2.8);
    nearMissFlash = Math.max(0, nearMissFlash - delta * 3.4);
    calloutSeconds = Math.max(0, calloutSeconds - delta);
    if (calloutSeconds === 0 && !complete) callout = "";
    shake = Math.max(0, shake - delta * 1.9);
    scene.imageProcessingConfiguration.exposure = 1.12 + hitFlash * 0.65;
    glow.intensity = (quality === "high" ? 0.28 : 0.2) + nearMissFlash * 0.34;
    shield.visibility = hitFlash * 0.82;
    const shieldPulse = 1 + (1 - hitFlash) * 0.24;
    shield.scaling.set(1.45 * shieldPulse, 0.7 * shieldPulse, shieldPulse);
    const shakeX = (Math.random() - 0.5) * shake;
    const shakeY = (Math.random() - 0.5) * shake;
    camera.position.x = Scalar.Lerp(camera.position.x, ship.position.x * 0.13 + shakeX, follow * 0.5);
    camera.position.y = Scalar.Lerp(camera.position.y, 4.7 + ship.position.y * 0.1 + shakeY, follow * 0.5);
    camera.position.z = Scalar.Lerp(camera.position.z, boost ? -17.8 : -16.5, follow * 0.4);
    camera.fov = Scalar.Lerp(camera.fov, boost ? 0.9 : 0.82, follow * 0.35);
    camera.setTarget(new Vector3(ship.position.x * 0.3, ship.position.y * 0.22, 31));

    const now = performance.now();
    if (now - lastTelemetry > 50) {
      lastTelemetry = now;
      onTelemetry({
        phase: complete ? "complete" : "running",
        elapsed,
        progress: elapsed / ROUTE_SECONDS,
        score,
        multiplier,
        speed: Math.round(speed * 18.5),
        integrity,
        quality,
        fps: Math.round(smoothedFps),
        inputMode,
        callout,
        steerX: Scalar.Clamp(targetX / 8.3, -1, 1),
        steerY: Scalar.Clamp(targetY / 4.5, -1, 1),
        steering,
      });
    }
  }

  function recycleObstacle(obstacle: Obstacle, all: Obstacle[]) {
    const furthest = Math.max(...all.map((item) => item.root.position.z));
    obstacle.root.position.z = furthest + 24 + Math.random() * 16;
    obstacle.root.position.x = laneX[Math.floor(Math.random() * laneX.length)] ?? 0;
    obstacle.root.position.y = laneY[Math.floor(Math.random() * laneY.length)] ?? 0;
    obstacle.resolved = false;
  }

  const render = () => {
    update(Math.min(engine.getDeltaTime() / 1000, 0.05));
    scene.render();
  };

  function pause() {
    if (paused || destroyed) return;
    paused = true;
    engine.stopRenderLoop(render);
    audio.setBoost(false);
    onTelemetry({ phase: "paused", elapsed, progress: elapsed / ROUTE_SECONDS, score, multiplier, speed: Math.round(speed * 18.5), integrity, quality, fps: Math.round(smoothedFps), inputMode, callout, steerX: Scalar.Clamp(targetX / 8.3, -1, 1), steerY: Scalar.Clamp(targetY / 4.5, -1, 1), steering: false });
  }

  function resume() {
    if (!paused || destroyed) return;
    paused = false;
    void audio.arm();
    engine.runRenderLoop(render);
  }

  function restart() {
    elapsed = 0;
    score = 0;
    multiplier = 1;
    integrity = 3;
    speed = 54;
    complete = false;
    relayAnnounced = false;
    callout = "ROUTE RESET";
    calloutSeconds = 1.4;
    targetX = 0;
    targetY = 0;
    ship.position.set(0, 0, 0);
    obstacles.forEach((obstacle, index) => {
      obstacle.root.position.z = 38 + index * 25;
      obstacle.resolved = false;
    });
    if (paused) resume();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    engine.stopRenderLoop(render);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    audio.destroy();
    scene.dispose();
    engine.dispose();
  }

  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  engine.runRenderLoop(render);

  return { pause, resume, restart, setMuted: (muted) => audio.setMuted(muted), destroy };
}

function createCourier(scene: Scene) {
  const root = new TransformNode("courier-root", scene);
  const hullMaterial = pbr(scene, "courier-hull", new Color3(0.36, 0.4, 0.47), 0.92, 0.25);
  const darkMaterial = pbr(scene, "courier-carbon", new Color3(0.025, 0.035, 0.055), 0.78, 0.2);
  const canopyMaterial = pbr(scene, "courier-canopy", new Color3(0.02, 0.13, 0.2), 0.55, 0.1, new Color3(0.04, 0.44, 0.7));
  const energyMaterial = emissive(scene, "courier-energy", new Color3(0.1, 0.85, 1), 0.95);

  const hull = CreateCylinder("courier-hull-mesh", { height: 3.8, diameterTop: 0.42, diameterBottom: 1.18, tessellation: 8 }, scene);
  hull.rotation.x = Math.PI / 2;
  hull.position.z = 0.15;
  hull.material = hullMaterial;
  hull.parent = root;

  const canopy = CreateSphere("courier-canopy-mesh", { diameter: 1, segments: 20 }, scene);
  canopy.scaling.set(0.63, 0.34, 0.95);
  canopy.position.set(0, 0.36, 0.25);
  canopy.material = canopyMaterial;
  canopy.parent = root;

  for (const side of [-1, 1]) {
    const wing = CreateBox(`courier-wing-${side}`, { width: 3.7, height: 0.1, depth: 1.55 }, scene);
    wing.scaling.x = 0.72;
    wing.position.set(side * 1.2, -0.08, -0.28);
    wing.rotation.y = side * -0.1;
    wing.rotation.z = side * -0.08;
    wing.material = darkMaterial;
    wing.parent = root;
    const edge = CreateBox(`courier-edge-${side}`, { width: 1.35, height: 0.035, depth: 0.1 }, scene);
    edge.position.set(side * 2.05, -0.06, 0.25);
    edge.rotation.y = side * -0.18;
    edge.material = energyMaterial;
    edge.parent = root;
    const engine = CreateCylinder(`courier-engine-${side}`, { height: 0.78, diameter: 0.42, tessellation: 16 }, scene);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(side * 0.62, -0.2, -1.55);
    engine.material = darkMaterial;
    engine.parent = root;
    const exhaust = CreateCylinder(`courier-exhaust-${side}`, { height: 7.5, diameterTop: 0.16, diameterBottom: 0.52, tessellation: 18 }, scene);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(side * 0.62, -0.2, -5.55);
    exhaust.material = energyMaterial;
    exhaust.parent = root;
    exhaust.visibility = 0.72;
  }

  const courierLight = new PointLight("courier-drive-light", new Vector3(0, -0.15, -2.3), scene);
  courierLight.diffuse = new Color3(0.05, 0.75, 1);
  courierLight.intensity = 14;
  courierLight.range = 18;
  courierLight.parent = root;
  return root;
}

function createShield(scene: Scene, ship: TransformNode) {
  const material = emissive(scene, "courier-shield-material", new Color3(0.12, 0.78, 1), 0.52);
  material.alpha = 0.34;
  material.wireframe = true;
  material.backFaceCulling = false;
  const shield = CreateSphere("courier-shield", { diameter: 5.4, segments: 24 }, scene);
  shield.scaling.set(1.45, 0.7, 1);
  shield.material = material;
  shield.parent = ship;
  shield.visibility = 0;
  return shield;
}

function createRelayGate(scene: Scene, quality: GateTelemetry["quality"]) {
  const root = new TransformNode("relay-gate", scene);
  root.position.z = 250;
  const inner = new TransformNode("relay-gate-inner", scene);
  inner.parent = root;
  const metal = pbr(scene, "relay-metal", new Color3(0.12, 0.13, 0.15), 0.96, 0.2);
  const energy = emissive(scene, "relay-energy", new Color3(0.98, 0.64, 0.18), 1.35);
  const cyan = emissive(scene, "relay-cyan", new Color3(0.16, 0.82, 1), 1.1);
  const outer = CreateTorus("relay-outer", { diameter: 21, thickness: 0.42, tessellation: quality === "high" ? 128 : 64 }, scene);
  outer.rotation.x = Math.PI / 2;
  outer.material = metal;
  outer.parent = root;
  const innerRing = CreateTorus("relay-inner-ring", { diameter: 13.5, thickness: 0.16, tessellation: quality === "high" ? 96 : 48 }, scene);
  innerRing.rotation.x = Math.PI / 2;
  innerRing.material = cyan;
  innerRing.parent = inner;
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const spoke = CreateBox(`relay-spoke-${index}`, { width: 4.2, height: index % 3 === 0 ? 0.36 : 0.14, depth: 0.26 }, scene);
    spoke.position.set(Math.cos(angle) * 7.7, Math.sin(angle) * 7.7, 0);
    spoke.rotation.z = angle;
    spoke.material = index % 3 === 0 ? energy : metal;
    spoke.parent = inner;
  }
  const core = CreateSphere("relay-core", { diameter: 1.4, segments: quality === "high" ? 32 : 18 }, scene);
  core.material = energy;
  core.parent = root;
  const light = new PointLight("relay-light", Vector3.Zero(), scene);
  light.diffuse = new Color3(1, 0.44, 0.08);
  light.intensity = 24;
  light.range = 48;
  light.parent = root;
  return { root, inner, core, light };
}

function createOrbitalLane(scene: Scene, quality: GateTelemetry["quality"]) {
  const ringMaterial = emissive(scene, "lane-energy", new Color3(0.11, 0.52, 0.72), 0.35);
  const metalMaterial = pbr(scene, "lane-metal", new Color3(0.08, 0.09, 0.11), 0.95, 0.38);
  const rings: MovingRing[] = [];
  const count = quality === "high" ? 14 : 10;
  for (let index = 0; index < count; index += 1) {
    const root = new TransformNode(`orbital-ring-${index}`, scene);
    root.position.z = 22 + index * (ROUTE_LENGTH / count);
    root.rotation.z = index * 0.41;
    const diameter = 18 + (index % 3) * 1.6;
    const torus = CreateTorus(`ring-energy-${index}`, { diameter, thickness: index % 4 === 0 ? 0.11 : 0.045, tessellation: quality === "high" ? 96 : 48 }, scene);
    torus.rotation.x = Math.PI / 2;
    torus.material = index % 4 === 0 ? metalMaterial : ringMaterial;
    torus.parent = root;
    const segments = index % 4 === 0 ? 12 : 4;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const strut = CreateBox(`ring-strut-${index}-${segment}`, { width: 0.28, height: 1.15 + (segment % 3) * 0.35, depth: 0.55 }, scene);
      strut.position.set(Math.cos(angle) * diameter * 0.5, Math.sin(angle) * diameter * 0.5, 0);
      strut.rotation.z = -angle;
      strut.material = metalMaterial;
      strut.parent = root;
    }
    rings.push({ root, spin: (index % 2 ? 1 : -1) * (0.035 + (index % 5) * 0.006) });
  }
  return rings;
}

function createObstacles(scene: Scene, quality: GateTelemetry["quality"]) {
  const metal = pbr(scene, "hazard-metal", new Color3(0.12, 0.1, 0.09), 0.95, 0.34);
  const hot = emissive(scene, "hazard-hot", new Color3(1, 0.22, 0.035), 1.25);
  const count = quality === "high" ? 10 : 7;
  const obstacles: Obstacle[] = [];
  for (let index = 0; index < count; index += 1) {
    const root = new TransformNode(`hazard-${index}`, scene);
    root.position.set(laneX[(index * 2 + 1) % laneX.length] ?? 0, laneY[(index * 3) % laneY.length] ?? 0, 42 + index * 27);
    root.rotation.z = index * 0.73;
    const core = CreateCylinder(`hazard-core-${index}`, { height: 2.8, diameter: 1.3, tessellation: 6 }, scene);
    core.rotation.x = Math.PI / 2;
    core.material = metal;
    core.parent = root;
    for (const side of [-1, 1]) {
      const blade = CreateBox(`hazard-blade-${index}-${side}`, { width: 5.5, height: 0.22, depth: 1 }, scene);
      blade.position.x = side * 2.35;
      blade.material = metal;
      blade.parent = root;
      const warning = CreateBox(`hazard-warning-${index}-${side}`, { width: 1.5, height: 0.06, depth: 1.04 }, scene);
      warning.position.x = side * 3.2;
      warning.position.y = 0.14;
      warning.material = hot;
      warning.parent = root;
    }
    if (index % 2 === 0) {
      const verticalBlade = CreateBox(`hazard-cross-${index}`, { width: 0.22, height: 5.5, depth: 1 }, scene);
      verticalBlade.material = metal;
      verticalBlade.parent = root;
      const verticalWarning = CreateBox(`hazard-cross-warning-${index}`, { width: 0.06, height: 2.1, depth: 1.04 }, scene);
      verticalWarning.position.y = 2.3;
      verticalWarning.material = hot;
      verticalWarning.parent = root;
    }
    obstacles.push({ root, radius: 3.2, resolved: false, phase: index * 0.8 });
  }
  return obstacles;
}

function createPlanet(scene: Scene, quality: GateTelemetry["quality"]) {
  const planetMaterial = pbr(scene, "planet-surface", new Color3(0.36, 0.12, 0.035), 0.05, 0.86, new Color3(0.035, 0.006, 0.002));
  const planet = CreateSphere("gate-planet", { diameter: 118, segments: quality === "high" ? 64 : 32 }, scene);
  planet.position.set(72, -31, 184);
  planet.material = planetMaterial;
  const atmosphere = CreateSphere("gate-atmosphere", { diameter: 122, segments: quality === "high" ? 48 : 24 }, scene);
  atmosphere.position.copyFrom(planet.position);
  atmosphere.material = emissive(scene, "planet-atmosphere", new Color3(0.55, 0.12, 0.025), 0.09);
  atmosphere.visibility = 0.45;
  const moon = CreateSphere("gate-moon", { diameter: 12, segments: 24 }, scene);
  moon.position.set(-44, 18, 138);
  moon.material = pbr(scene, "moon-surface", new Color3(0.14, 0.16, 0.2), 0.15, 0.95);
}

function createStarfield(scene: Scene, emitter: TransformNode, quality: GateTelemetry["quality"]) {
  const texture = new DynamicTexture("star-sprite", { width: 64, height: 64 }, scene, false);
  const context = texture.getContext();
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.15, "rgba(150,220,255,.9)");
  gradient.addColorStop(1, "rgba(30,120,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  texture.update(false);
  const particles = new ParticleSystem("route-stars", quality === "high" ? 1200 : 560, scene);
  particles.particleTexture = texture;
  particles.emitter = emitter.position;
  particles.minEmitBox = new Vector3(-30, -18, 18);
  particles.maxEmitBox = new Vector3(30, 18, 155);
  particles.direction1 = new Vector3(-0.2, -0.1, -95);
  particles.direction2 = new Vector3(0.2, 0.1, -125);
  particles.minLifeTime = 1.4;
  particles.maxLifeTime = 3.2;
  particles.minSize = 0.025;
  particles.maxSize = 0.16;
  particles.emitRate = quality === "high" ? 420 : 190;
  particles.color1 = new Color4(0.6, 0.84, 1, 0.75);
  particles.color2 = new Color4(1, 0.62, 0.24, 0.55);
  particles.colorDead = new Color4(0.1, 0.16, 0.25, 0);
  particles.updateSpeed = 0.012;
  particles.start();
  return particles;
}

function pbr(scene: Scene, name: string, color: Color3, metallic: number, roughness: number, emissiveColor = Color3.Black()) {
  const material = new PBRMaterial(name, scene);
  material.albedoColor = color;
  material.metallic = metallic;
  material.roughness = roughness;
  material.emissiveColor = emissiveColor;
  return material;
}

function emissive(scene: Scene, name: string, color: Color3, intensity: number) {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color.scale(0.06);
  material.emissiveColor = color.scale(intensity);
  material.specularColor = Color3.Black();
  return material;
}
