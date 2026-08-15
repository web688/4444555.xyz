import { Engine } from "@babylonjs/core/Engines/engine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Scalar } from "@babylonjs/core/Maths/math.scalar.js";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { PointLight } from "@babylonjs/core/Lights/pointLight.js";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder.pure.js";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder.pure.js";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder.pure.js";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder.pure.js";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem.js";
import { PinballAudio } from "./audio";
import { createSeededRandom, getDailyRouteKey, hashRouteSeed } from "./progress";

export type PinballPhase = "ready" | "in_play" | "paused" | "drained" | "complete" | "error";

export type PinballReport = {
  averageFps: number;
  renderWidth: number;
  renderHeight: number;
  devicePixelRatio: number;
  totalTimeSeconds: number;
  bumperHits: number;
  rampLoops: number;
  maxMultiplier: number;
};

export type PinballTelemetry = {
  phase: PinballPhase;
  elapsed: number;
  score: number;
  multiplier: number;
  ballsRemaining: number;
  maxBalls: number;
  speed: number;
  bumperHits: number;
  rampLoops: number;
  maxMultiplier: number;
  targetsCleared: number;
  routeKey: string;
  fps: number;
  callout: string;
  report: PinballReport | null;
};

export type PinballRuntime = {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  setMuted(muted: boolean): void;
  setFlipperLeft(active: boolean): void;
  setFlipperRight(active: boolean): void;
  setPlunger(charging: boolean): void;
  nudge(): void;
  destroy(): void;
};

interface Bumper {
  root: TransformNode;
  mesh: TransformNode;
  light: PointLight;
  x: number;
  y: number;
  radius: number;
  flashTimer: number;
}

interface Target {
  mesh: TransformNode;
  x: number;
  y: number;
  dropped: boolean;
}

export async function createSynapsePinballScene(
  canvas: HTMLCanvasElement,
  onTelemetry: (telemetry: PinballTelemetry) => void,
): Promise<PinballRuntime> {
  if (!Engine.isSupported()) throw new Error("WebGL is not available in this browser.");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobileTier =
    window.matchMedia("(pointer: coarse)").matches ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const quality =
    !mobileTier && !reducedMotion && window.devicePixelRatio <= 2 ? "high" : "balanced";

  const engine = new Engine(
    canvas,
    true,
    { preserveDrawingBuffer: false, stencil: true, powerPreference: "high-performance" },
    true,
  );
  engine.setHardwareScalingLevel(mobileTier ? 1 : 1 / Math.min(window.devicePixelRatio, 1.5));

  const scene = new Scene(engine);
  scene.skipPointerMovePicking = true;
  scene.constantlyUpdateMeshUnderPointer = false;
  scene.clearColor = new Color4(0.005, 0.008, 0.018, 1);
  scene.fogMode = Scene.FOGMODE_NONE;
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.exposure = 1.15;
  scene.imageProcessingConfiguration.contrast = 1.4;
  scene.imageProcessingConfiguration.vignetteEnabled = true;
  scene.imageProcessingConfiguration.vignetteWeight = 1.35;
  scene.imageProcessingConfiguration.vignetteColor = new Color4(0.01, 0.02, 0.05, 1);

  // Camera looking down table with dramatic perspective
  const camera = new FreeCamera("pinball-camera", new Vector3(0, 24, -17), scene);
  camera.minZ = 0.1;
  camera.maxZ = 300;
  camera.fov = 0.82;
  camera.setTarget(new Vector3(0, 0, 4));

  // Mainframe Lighting
  const ambient = new HemisphericLight("mainframe-ambient", new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.45;
  ambient.diffuse = new Color3(0.18, 0.25, 0.38);
  ambient.groundColor = new Color3(0.06, 0.08, 0.12);

  const keyLight = new DirectionalLight("server-key", new Vector3(-0.35, -0.7, 0.5), scene);
  keyLight.position = new Vector3(15, 25, -10);
  keyLight.intensity = 3.8;
  keyLight.diffuse = new Color3(1, 0.92, 0.85);

  const rimLight = new PointLight("cyan-rim", new Vector3(-12, 14, 8), scene);
  rimLight.intensity = mobileTier ? 18 : 28;
  rimLight.range = 35;
  rimLight.diffuse = new Color3(0, 0.94, 0.66);

  const audio = new PinballAudio();
  void audio.arm();

  // Materials
  const unlitWhite = (name: string) => {
    const mat = new PBRMaterial(name, scene);
    mat.albedoColor = Color3.White();
    mat.metallic = 0;
    mat.roughness = 1;
    mat.unlit = true;
    return mat;
  };

  const emissiveColor = (name: string, color: Color3, intensity = 1) => {
    const mat = new StandardMaterial(name, scene);
    mat.emissiveColor = color;
    mat.disableLighting = true;
    mat.alpha = 1;
    return mat;
  };

  const pbrMetal = (name: string, color: Color3, metallic = 0.9, roughness = 0.2) => {
    const mat = new PBRMaterial(name, scene);
    mat.albedoColor = color;
    mat.metallic = metallic;
    mat.roughness = roughness;
    return mat;
  };

  const railWhiteMat = unlitWhite("rail-white");
  const hazardOrangeMat = emissiveColor("hazard-orange", new Color3(1, 0.42, 0.05), 1.2);
  const cyanNeonMat = emissiveColor("cyan-neon", new Color3(0, 0.94, 0.66), 1.3);
  const violetNeonMat = emissiveColor("violet-neon", new Color3(0.72, 0.38, 1), 1.3);
  const darkCarbonMat = pbrMetal("dark-carbon", new Color3(0.04, 0.05, 0.07), 0.5, 0.4);
  const chromeMat = pbrMetal("ball-chrome", new Color3(0.95, 0.98, 1), 1, 0.08);

  // Environment: Monolithic Server Towers surrounding table
  const environmentRoot = new TransformNode("mainframe-env", scene);
  for (let col = -3; col <= 3; col += 1) {
    if (Math.abs(col) < 2) continue;
    const towerX = col * 8.5;
    for (let row = 0; row < 4; row += 1) {
      const towerZ = -10 + row * 10;
      const tower = CreateBox(`server-tower-${col}-${row}`, { width: 3.8, height: 28, depth: 3.8 }, scene);
      tower.position.set(towerX, 10, towerZ);
      tower.material = darkCarbonMat;
      tower.parent = environmentRoot;

      const lightStrip = CreateBox(`tower-light-${col}-${row}`, { width: 0.1, height: 26, depth: 0.1 }, scene);
      lightStrip.position.set(towerX + (col > 0 ? -1.85 : 1.85), 10, towerZ);
      lightStrip.material = (row + Math.abs(col)) % 2 === 0 ? cyanNeonMat : violetNeonMat;
      lightStrip.parent = environmentRoot;
    }
  }

  // Silicon Table Deck Bed
  const tableWidth = 14;
  const tableLength = 25;
  const tableRoot = new TransformNode("table-root", scene);
  tableRoot.rotation.x = -0.14; // Angled table pitch

  // Table Bed
  const deckTexture = new DynamicTexture("deck-texture", { width: 1024, height: 2048 }, scene, false);
  const dCtx = deckTexture.getContext() as unknown as CanvasRenderingContext2D;
  dCtx.fillStyle = "#0a0c12";
  dCtx.fillRect(0, 0, 1024, 2048);

  // Gold circuit traces
  dCtx.strokeStyle = "rgba(246, 189, 82, 0.35)";
  dCtx.lineWidth = 3;
  for (let i = 0; i < 16; i += 1) {
    dCtx.beginPath();
    dCtx.moveTo(120 + i * 50, 200);
    dCtx.lineTo(120 + i * 50, 800);
    dCtx.lineTo(250 + i * 40, 1400);
    dCtx.stroke();
  }
  // Diagnostic circuit rings
  dCtx.strokeStyle = "rgba(0, 240, 168, 0.4)";
  dCtx.lineWidth = 4;
  dCtx.beginPath();
  dCtx.arc(512, 600, 220, 0, Math.PI * 2);
  dCtx.stroke();
  dCtx.beginPath();
  dCtx.arc(512, 1200, 160, 0, Math.PI * 2);
  dCtx.stroke();
  deckTexture.update();

  const deckMat = new PBRMaterial("deck-mat", scene);
  deckMat.albedoTexture = deckTexture;
  deckMat.metallic = 0.2;
  deckMat.roughness = 0.5;

  const deck = CreateBox("table-bed", { width: tableWidth, height: 0.6, depth: tableLength }, scene);
  deck.position.set(0, -0.3, 3);
  deck.material = deckMat;
  deck.parent = tableRoot;

  // Table Boundary Rails
  const railHeight = 1.2;
  const railThickness = 0.6;

  // Left Rail
  const leftRail = CreateBox("rail-left", { width: railThickness, height: railHeight, depth: tableLength }, scene);
  leftRail.position.set(-tableWidth / 2 + railThickness / 2, railHeight / 2, 3);
  leftRail.material = railWhiteMat;
  leftRail.parent = tableRoot;

  // Right Rail & Plunger Lane Divider
  const rightRail = CreateBox("rail-right", { width: railThickness, height: railHeight, depth: tableLength }, scene);
  rightRail.position.set(tableWidth / 2 - railThickness / 2, railHeight / 2, 3);
  rightRail.material = railWhiteMat;
  rightRail.parent = tableRoot;

  const plungerDivider = CreateBox("plunger-divider", { width: 0.3, height: railHeight, depth: tableLength * 0.75 }, scene);
  plungerDivider.position.set(tableWidth / 2 - 1.6, railHeight / 2, -0.1);
  plungerDivider.material = railWhiteMat;
  plungerDivider.parent = tableRoot;

  // Top Curved Arch
  const topArch = CreateBox("rail-top", { width: tableWidth, height: railHeight, depth: railThickness }, scene);
  topArch.position.set(0, railHeight / 2, tableLength / 2 + 3 - railThickness / 2);
  topArch.material = railWhiteMat;
  topArch.parent = tableRoot;

  // Hazard border strip along top
  const topHazard = CreateBox("hazard-top", { width: tableWidth - 1, height: 0.1, depth: 0.1 }, scene);
  topHazard.position.set(0, railHeight + 0.05, tableLength / 2 + 3 - railThickness / 2);
  topHazard.material = hazardOrangeMat;
  topHazard.parent = tableRoot;

  // Optical Prism Bumpers (3 in top arc)
  const bumpers: Bumper[] = [];
  const bumperCoords = [
    { x: -2.8, z: 8.5 },
    { x: 2.8, z: 8.5 },
    { x: 0, z: 11.2 },
  ];

  bumperCoords.forEach((coord, idx) => {
    const root = new TransformNode(`bumper-root-${idx}`, scene);
    root.position.set(coord.x, 0.4, coord.z);
    root.parent = tableRoot;

    const prism = CreateCylinder(`bumper-prism-${idx}`, { height: 1.1, diameter: 2.2, tessellation: 6 }, scene);
    prism.material = pbrMetal(`bumper-mat-${idx}`, new Color3(0.7, 0.9, 1), 0.1, 0.05);
    prism.parent = root;

    const neonRing = CreateTorus(`bumper-ring-${idx}`, { diameter: 2.4, thickness: 0.15, tessellation: 32 }, scene);
    neonRing.rotation.x = Math.PI / 2;
    neonRing.material = cyanNeonMat;
    neonRing.parent = root;

    const light = new PointLight(`bumper-light-${idx}`, new Vector3(0, 1.2, 0), scene);
    light.diffuse = new Color3(0, 0.94, 0.66);
    light.intensity = 8;
    light.range = 8;
    light.parent = root;

    bumpers.push({
      root,
      mesh: prism,
      light,
      x: coord.x,
      y: coord.z,
      radius: 1.15,
      flashTimer: 0,
    });
  });

  // Elevated Fiber-Optic Ramps (Left & Right)
  const leftRamp = CreateTorus("ramp-left-tube", { diameter: 7, thickness: 0.22, tessellation: 48 }, scene);
  leftRamp.position.set(-3.2, 2.2, 5.5);
  leftRamp.rotation.x = Math.PI / 2.8;
  leftRamp.rotation.y = -0.4;
  leftRamp.material = cyanNeonMat;
  leftRamp.parent = tableRoot;

  const rightRamp = CreateTorus("ramp-right-tube", { diameter: 7, thickness: 0.22, tessellation: 48 }, scene);
  rightRamp.position.set(3.2, 2.2, 5.5);
  rightRamp.rotation.x = Math.PI / 2.8;
  rightRamp.rotation.y = 0.4;
  rightRamp.material = violetNeonMat;
  rightRamp.parent = tableRoot;

  // Center Magnetic Superconducting Core
  const coreWell = CreateTorus("core-well-ring", { diameter: 3.4, thickness: 0.25, tessellation: 32 }, scene);
  coreWell.position.set(0, 0.2, 4.2);
  coreWell.rotation.x = Math.PI / 2;
  coreWell.material = hazardOrangeMat;
  coreWell.parent = tableRoot;

  const coreLight = new PointLight("core-well-light", new Vector3(0, 1, 4.2), scene);
  coreLight.diffuse = new Color3(1, 0.42, 0.05);
  coreLight.intensity = 12;
  coreLight.range = 10;
  coreLight.parent = tableRoot;

  // 4 Logic Gate Drop Targets
  const targets: Target[] = [];
  const targetXCoords = [-3.8, -2.6, 2.6, 3.8];
  targetXCoords.forEach((tx, idx) => {
    const tMesh = CreateBox(`target-${idx}`, { width: 0.8, height: 0.7, depth: 0.18 }, scene);
    tMesh.position.set(tx, 0.35, 1.2);
    tMesh.material = cyanNeonMat;
    tMesh.parent = tableRoot;
    targets.push({ mesh: tMesh, x: tx, y: 1.2, dropped: false });
  });

  // Flippers
  const flipperLength = 2.4;
  const flipperLeftRoot = new TransformNode("flipper-left-root", scene);
  flipperLeftRoot.position.set(-2.4, 0.35, -6.5);
  flipperLeftRoot.parent = tableRoot;

  const flipperLeftMesh = CreateBox("flipper-left-mesh", { width: flipperLength, height: 0.5, depth: 0.45 }, scene);
  flipperLeftMesh.position.set(flipperLength / 2, 0, 0);
  flipperLeftMesh.material = darkCarbonMat;
  flipperLeftMesh.parent = flipperLeftRoot;

  const flipperLeftEdge = CreateBox("flipper-left-edge", { width: flipperLength, height: 0.12, depth: 0.12 }, scene);
  flipperLeftEdge.position.set(flipperLength / 2, 0.22, 0.22);
  flipperLeftEdge.material = cyanNeonMat;
  flipperLeftEdge.parent = flipperLeftRoot;

  const flipperRightRoot = new TransformNode("flipper-right-root", scene);
  flipperRightRoot.position.set(2.4, 0.35, -6.5);
  flipperRightRoot.parent = tableRoot;

  const flipperRightMesh = CreateBox("flipper-right-mesh", { width: flipperLength, height: 0.5, depth: 0.45 }, scene);
  flipperRightMesh.position.set(-flipperLength / 2, 0, 0);
  flipperRightMesh.material = darkCarbonMat;
  flipperRightMesh.parent = flipperRightRoot;

  const flipperRightEdge = CreateBox("flipper-right-edge", { width: flipperLength, height: 0.12, depth: 0.12 }, scene);
  flipperRightEdge.position.set(-flipperLength / 2, 0.22, 0.22);
  flipperRightEdge.material = violetNeonMat;
  flipperRightEdge.parent = flipperRightRoot;

  // Slingshots (Left & Right triangle kickers above flippers)
  const slingLeft = CreateBox("sling-left", { width: 1.8, height: 0.6, depth: 3.2 }, scene);
  slingLeft.position.set(-4.2, 0.35, -3.8);
  slingLeft.rotation.y = 0.28;
  slingLeft.material = railWhiteMat;
  slingLeft.parent = tableRoot;

  const slingRight = CreateBox("sling-right", { width: 1.8, height: 0.6, depth: 3.2 }, scene);
  slingRight.position.set(4.2, 0.35, -3.8);
  slingRight.rotation.y = -0.28;
  slingRight.material = railWhiteMat;
  slingRight.parent = tableRoot;

  // Spring Plunger
  const plungerMesh = CreateCylinder("plunger-rod", { height: 3.2, diameter: 0.4 }, scene);
  plungerMesh.rotation.x = Math.PI / 2;
  plungerMesh.position.set(tableWidth / 2 - 0.8, 0.35, -8.2);
  plungerMesh.material = pbrMetal("plunger-mat", new Color3(0.8, 0.8, 0.9), 0.9, 0.2);
  plungerMesh.parent = tableRoot;

  // Photonic Ball
  const ballRadius = 0.45;
  const ball = CreateSphere("photonic-ball", { diameter: ballRadius * 2, segments: 24 }, scene);
  ball.material = chromeMat;
  ball.parent = tableRoot;

  const ballLight = new PointLight("ball-core-light", Vector3.Zero(), scene);
  ballLight.diffuse = new Color3(0, 0.94, 0.66);
  ballLight.intensity = 10;
  ballLight.range = 5;
  ballLight.parent = ball;

  // State
  let phase: PinballPhase = "ready";
  let score = 0;
  let multiplier = 1;
  let maxMultiplier = 1;
  let bumperHits = 0;
  let rampLoops = 0;
  let targetsCleared = 0;
  let ballsRemaining = 3;
  const maxBalls = 3;
  let elapsed = 0;
  let callout = "QUANTUM MAINFRAME ONLINE — PULL PLUNGER TO LAUNCH";
  let calloutTimer = 4;

  // Physics Simulation
  let ballX = tableWidth / 2 - 0.8;
  let ballZ = -6.5;
  let ballVx = 0;
  let ballVz = 0;
  let ballInPlay = false;

  let leftFlipperActive = false;
  let rightFlipperActive = false;
  let leftFlipperAngle = -0.45;
  let rightFlipperAngle = 0.45;

  let plungerCharging = false;
  let plungerPower = 0;

  let vortexHoldTimer = 0;

  const routeKey = getDailyRouteKey();
  let animationId = 0;
  let lastTimestamp = performance.now();
  let frameCount = 0;
  let fps = 60;
  let fpsTimer = 0;
  let running = false;

  function resetBall() {
    ballX = tableWidth / 2 - 0.8;
    ballZ = -6.5;
    ballVx = 0;
    ballVz = 0;
    ballInPlay = false;
    plungerPower = 0;
    plungerCharging = false;
    ball.position.set(ballX, ballRadius, ballZ);
    phase = ballsRemaining > 0 ? "ready" : "complete";
    if (phase === "ready") {
      callout = `BALL ${maxBalls - ballsRemaining + 1} READY — PULL PLUNGER`;
      calloutTimer = 3;
    }
  }

  function launchBall() {
    if (ballInPlay || ballsRemaining <= 0) return;
    const launchSpeed = 22 + plungerPower * 28;
    ballVx = 0;
    ballVz = launchSpeed;
    ballInPlay = true;
    phase = "in_play";
    audio.plungerRelease();
    callout = "BALL LAUNCHED — OVERCLOCK ACTIVE";
    calloutTimer = 2;
  }

  function updatePhysics(dt: number) {
    if (phase !== "in_play" || !ballInPlay) return;
    elapsed += dt;

    // Gravity pull down incline table
    const gravity = 28;
    ballVz -= gravity * dt;

    // Magnetic well vortex capture
    const distToCore = Math.sqrt(ballX * ballX + (ballZ - 4.2) * (ballZ - 4.2));
    if (distToCore < 1.6) {
      if (vortexHoldTimer <= 0) {
        vortexHoldTimer = 1.2;
        audio.setVortex(true, 1);
        multiplier = Math.min(10, multiplier + 1);
        if (multiplier > maxMultiplier) maxMultiplier = multiplier;
        score += 15000 * multiplier;
        callout = `QUANTUM CORE CHARGE! ×${multiplier} [ +${(15000 * multiplier).toLocaleString()} PTS ]`;
        calloutTimer = 2.4;
      }
    }

    if (vortexHoldTimer > 0) {
      vortexHoldTimer -= dt;
      // Spin inside well
      const angle = (1.2 - vortexHoldTimer) * Math.PI * 6;
      ballX = Math.cos(angle) * 0.7;
      ballZ = 4.2 + Math.sin(angle) * 0.7;
      ballVx = 0;
      ballVz = 0;
      if (vortexHoldTimer <= 0) {
        audio.setVortex(false);
        ballVx = (Math.random() - 0.5) * 16;
        ballVz = -24;
      }
      ball.position.set(ballX, ballRadius, ballZ);
      return;
    }

    // Velocity integration
    ballX += ballVx * dt;
    ballZ += ballVz * dt;

    // Friction / Air damping
    ballVx *= Math.pow(0.985, dt * 60);
    ballVz *= Math.pow(0.985, dt * 60);

    // Wall Collisions
    // Top Arch Bounce
    if (ballZ > tableLength / 2 + 3 - railThickness - ballRadius) {
      ballZ = tableLength / 2 + 3 - railThickness - ballRadius;
      ballVz = -Math.abs(ballVz) * 0.75;
      // Curve left into main playfield if in plunger lane
      if (ballX > tableWidth / 2 - 2.2) {
        ballVx = -14;
      }
    }

    // Left Outer Wall
    if (ballX < -tableWidth / 2 + railThickness + ballRadius) {
      ballX = -tableWidth / 2 + railThickness + ballRadius;
      ballVx = Math.abs(ballVx) * 0.8;
      audio.targetHit();
    }

    // Right Outer Wall
    if (ballX > tableWidth / 2 - railThickness - ballRadius) {
      ballX = tableWidth / 2 - railThickness - ballRadius;
      ballVx = -Math.abs(ballVx) * 0.8;
      audio.targetHit();
    }

    // Plunger divider collision
    if (ballZ < 8 && ballX > tableWidth / 2 - 1.9 && ballX < tableWidth / 2 - 1.3) {
      if (ballVx > 0) {
        ballX = tableWidth / 2 - 1.9 - ballRadius;
        ballVx = -Math.abs(ballVx) * 0.8;
      } else {
        ballX = tableWidth / 2 - 1.3 + ballRadius;
        ballVx = Math.abs(ballVx) * 0.8;
      }
    }

    // Bumpers Collision
    for (let i = 0; i < bumpers.length; i += 1) {
      const b = bumpers[i];
      if (b) {
        const dx = ballX - b.x;
        const dz = ballZ - b.y;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < b.radius + ballRadius) {
          // Bumper kickback
          const nx = dx / dist;
          const nz = dz / dist;
          const bounceSpeed = 26;
          ballVx = nx * bounceSpeed;
          ballVz = nz * bounceSpeed;
          ballX = b.x + nx * (b.radius + ballRadius + 0.05);
          ballZ = b.y + nz * (b.radius + ballRadius + 0.05);

          bumperHits += 1;
          const pts = 1000 * multiplier;
          score += pts;
          b.flashTimer = 0.25;
          audio.bumper(i);
        }
      }
    }

    // Ramps Entry Check (Left and Right Ramps)
    if (ballZ > 4.8 && ballZ < 6.2 && Math.abs(ballVx) < 18) {
      if (ballX > -4.5 && ballX < -2.5 && ballVz > 4) {
        // Left ramp loop
        rampLoops += 1;
        score += 5000 * multiplier;
        ballX = 2.4;
        ballZ = -1.5;
        ballVx = -6;
        ballVz = -14;
        audio.rampWhoosh();
        callout = `DATA RAMP LOOP! [ +${(5000 * multiplier).toLocaleString()} PTS ]`;
        calloutTimer = 2;
      } else if (ballX > 2.5 && ballX < 4.5 && ballVz > 4) {
        // Right ramp loop
        rampLoops += 1;
        score += 5000 * multiplier;
        ballX = -2.4;
        ballZ = -1.5;
        ballVx = 6;
        ballVz = -14;
        audio.rampWhoosh();
        callout = `FIBER OPTIC LOOP! [ +${(5000 * multiplier).toLocaleString()} PTS ]`;
        calloutTimer = 2;
      }
    }

    // Drop Targets Collision
    for (let i = 0; i < targets.length; i += 1) {
      const t = targets[i];
      if (t && !t.dropped) {
        const dx = Math.abs(ballX - t.x);
        const dz = Math.abs(ballZ - t.y);
        if (dx < 0.6 + ballRadius && dz < 0.2 + ballRadius) {
          t.dropped = true;
          t.mesh.position.y = -0.2; // Drop below table
          score += 2500 * multiplier;
          audio.targetHit();

          const allDropped = targets.every((tgt) => tgt.dropped);
          if (allDropped) {
            targetsCleared += 1;
            multiplier = Math.min(10, multiplier + 1);
            if (multiplier > maxMultiplier) maxMultiplier = multiplier;
            score += 20000;
            callout = `LOGIC GATES CLEARED! OVERCLOCK ×${multiplier}`;
            calloutTimer = 2.8;
            setTimeout(() => {
              targets.forEach((tgt) => {
                tgt.dropped = false;
                tgt.mesh.position.y = 0.35;
              });
            }, 1200);
          }
        }
      }
    }

    // Slingshots Kickback
    if (ballZ > -5.2 && ballZ < -2.4) {
      if (ballX > -4.5 && ballX < -3.2 && ballVx < 0) {
        ballVx = 22;
        ballVz = 12;
        score += 500;
        audio.targetHit();
      } else if (ballX > 3.2 && ballX < 4.5 && ballVx > 0) {
        ballVx = -22;
        ballVz = 12;
        score += 500;
        audio.targetHit();
      }
    }

    // Flippers Collision & Striking
    // Left Flipper
    const flX = -2.4;
    const flZ = -6.5;
    const dxL = ballX - flX;
    const dzL = ballZ - flZ;
    if (dxL > 0 && dxL < flipperLength + 0.2 && Math.abs(dzL) < 0.8) {
      const flAngle = flipperLeftRoot.rotation.y;
      if (ballVz < 0) {
        const strikeImpulse = leftFlipperActive ? 32 : 12;
        ballVx = Math.cos(flAngle + 0.8) * strikeImpulse;
        ballVz = Math.sin(flAngle + 0.8) * strikeImpulse;
        audio.flipper();
      }
    }

    // Right Flipper
    const frX = 2.4;
    const frZ = -6.5;
    const dxR = ballX - frX;
    const dzR = ballZ - frZ;
    if (dxR < 0 && dxR > -flipperLength - 0.2 && Math.abs(dzR) < 0.8) {
      const frAngle = flipperRightRoot.rotation.y;
      if (ballVz < 0) {
        const strikeImpulse = rightFlipperActive ? 32 : 12;
        ballVx = -Math.cos(-frAngle + 0.8) * strikeImpulse;
        ballVz = Math.sin(-frAngle + 0.8) * strikeImpulse;
        audio.flipper();
      }
    }

    // Outlane / Drain check
    if (ballZ < -9.5) {
      // Ball drained
      ballInPlay = false;
      ballsRemaining -= 1;
      audio.drain();

      if (ballsRemaining > 0) {
        phase = "drained";
        callout = `BALL DRAINED — ${ballsRemaining} BALLS REMAINING`;
        calloutTimer = 2.5;
        setTimeout(() => {
          if (running) resetBall();
        }, 1500);
      } else {
        phase = "complete";
        callout = "SESSION COMPLETE — OVERCLOCK TELEMETRY ARCHIVED";
        calloutTimer = 10;
        audio.complete();
      }
    }

    ball.position.set(ballX, ballRadius, ballZ);
  }

  function render() {
    const dt = 0.016;

    // Flipper animation
    const targetLeftAngle = leftFlipperActive ? 0.65 : -0.45;
    leftFlipperAngle = Scalar.Lerp(leftFlipperAngle, targetLeftAngle, 0.4);
    flipperLeftRoot.rotation.y = leftFlipperAngle;

    const targetRightAngle = rightFlipperActive ? -0.65 : 0.45;
    rightFlipperAngle = Scalar.Lerp(rightFlipperAngle, targetRightAngle, 0.4);
    flipperRightRoot.rotation.y = rightFlipperAngle;

    // Plunger animation
    if (plungerCharging) {
      plungerPower = Math.min(1, plungerPower + dt * 1.5);
      plungerMesh.position.z = -8.2 - plungerPower * 1.2;
    } else {
      plungerMesh.position.z = Scalar.Lerp(plungerMesh.position.z, -8.2, 0.35);
    }

    // Bumper flash decay
    bumpers.forEach((b) => {
      if (b.flashTimer > 0) {
        b.flashTimer -= dt;
        b.light.intensity = 24;
      } else {
        b.light.intensity = 8;
      }
    });

    scene.render();
  }

  function tick(timestamp: number) {
    if (!running) return;
    const deltaMs = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    const dt = Math.min(0.1, deltaMs / 1000);

    frameCount += 1;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
      fps = Math.round((frameCount / fpsTimer) * 10) / 10;
      frameCount = 0;
      fpsTimer = 0;
    }

    if (calloutTimer > 0) {
      calloutTimer -= dt;
      if (calloutTimer <= 0) callout = "";
    }

    updatePhysics(dt);
    render();

    const ballSpeed = Math.round(Math.sqrt(ballVx * ballVx + ballVz * ballVz) * 10);

    onTelemetry({
      phase,
      elapsed,
      score,
      multiplier,
      ballsRemaining,
      maxBalls,
      speed: ballSpeed,
      bumperHits,
      rampLoops,
      maxMultiplier,
      targetsCleared,
      routeKey,
      fps,
      callout,
      report:
        phase === "complete"
          ? {
              averageFps: fps,
              renderWidth: canvas.width,
              renderHeight: canvas.height,
              devicePixelRatio: window.devicePixelRatio || 1,
              totalTimeSeconds: Math.round(elapsed),
              bumperHits,
              rampLoops,
              maxMultiplier,
            }
          : null,
    });

    animationId = requestAnimationFrame(tick);
  }

  // Keyboard Handlers
  function handleKeyDown(event: KeyboardEvent) {
    if (["KeyA", "ArrowLeft"].includes(event.code)) {
      event.preventDefault();
      void audio.arm();
      leftFlipperActive = true;
      audio.flipper();
    } else if (["KeyD", "ArrowRight"].includes(event.code)) {
      event.preventDefault();
      void audio.arm();
      rightFlipperActive = true;
      audio.flipper();
    } else if (["Space", "ArrowDown"].includes(event.code)) {
      event.preventDefault();
      void audio.arm();
      if (!ballInPlay) {
        plungerCharging = true;
      }
    } else if (["KeyW", "ArrowUp"].includes(event.code)) {
      event.preventDefault();
      // Table nudge
      ballVx += (Math.random() - 0.5) * 4;
      ballVz += 3;
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    if (["KeyA", "ArrowLeft"].includes(event.code)) {
      leftFlipperActive = false;
    } else if (["KeyD", "ArrowRight"].includes(event.code)) {
      rightFlipperActive = false;
    } else if (["Space", "ArrowDown"].includes(event.code)) {
      if (plungerCharging) {
        plungerCharging = false;
        launchBall();
      }
    }
  }

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  // Initialize
  resetBall();
  running = true;
  lastTimestamp = performance.now();
  animationId = requestAnimationFrame(tick);

  return {
    start() {
      void audio.arm();
      if (!ballInPlay) {
        plungerPower = 0.8;
        launchBall();
      }
    },
    pause() {
      if (phase === "in_play") phase = "paused";
    },
    resume() {
      if (phase === "paused") {
        phase = "in_play";
        lastTimestamp = performance.now();
      }
    },
    restart() {
      score = 0;
      multiplier = 1;
      maxMultiplier = 1;
      bumperHits = 0;
      rampLoops = 0;
      targetsCleared = 0;
      ballsRemaining = 3;
      elapsed = 0;
      resetBall();
    },
    setMuted(muted: boolean) {
      audio.setMuted(muted);
    },
    setFlipperLeft(active: boolean) {
      void audio.arm();
      leftFlipperActive = active;
      if (active) audio.flipper();
    },
    setFlipperRight(active: boolean) {
      void audio.arm();
      rightFlipperActive = active;
      if (active) audio.flipper();
    },
    setPlunger(charging: boolean) {
      void audio.arm();
      if (charging && !ballInPlay) {
        plungerCharging = true;
      } else if (!charging && plungerCharging) {
        plungerCharging = false;
        launchBall();
      }
    },
    nudge() {
      ballVx += (Math.random() - 0.5) * 4;
      ballVz += 3;
    },
    destroy() {
      running = false;
      cancelAnimationFrame(animationId);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      audio.destroy();
      scene.dispose();
      engine.dispose();
    },
  };
}
