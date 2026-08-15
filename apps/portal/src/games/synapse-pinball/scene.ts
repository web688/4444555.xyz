import { Engine } from "@babylonjs/core/Engines/engine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Scalar } from "@babylonjs/core/Maths/math.scalar.js";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { PointLight } from "@babylonjs/core/Lights/pointLight.js";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import { ReflectionProbe } from "@babylonjs/core/Probes/reflectionProbe.js";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder.pure.js";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder.pure.js";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder.pure.js";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder.pure.js";
import { CreateTube } from "@babylonjs/core/Meshes/Builders/tubeBuilder.pure.js";
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

interface BumperAssembly {
  root: TransformNode;
  cap: TransformNode;
  filament: StandardMaterial;
  light: PointLight;
  x: number;
  y: number;
  radius: number;
  flashTimer: number;
}

interface TargetAssembly {
  root: TransformNode;
  mesh: TransformNode;
  label: string;
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
  scene.clearColor = new Color4(0.003, 0.005, 0.012, 1);
  scene.fogMode = Scene.FOGMODE_NONE;
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.exposure = 1.18;
  scene.imageProcessingConfiguration.contrast = 1.45;
  scene.imageProcessingConfiguration.vignetteEnabled = true;
  scene.imageProcessingConfiguration.vignetteWeight = 1.25;
  scene.imageProcessingConfiguration.vignetteColor = new Color4(0.01, 0.015, 0.04, 1);

  // Ergonomic Player Perspective Camera
  const camera = new FreeCamera("pinball-camera", new Vector3(0, 18.5, -14.2), scene);
  camera.minZ = 0.1;
  camera.maxZ = 400;
  camera.fov = 0.78;
  const baseCameraTarget = new Vector3(0, 1.2, 3.5);
  camera.setTarget(baseCameraTarget);

  // Lighting Architecture
  const ambient = new HemisphericLight("mainframe-ambient", new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.38;
  ambient.diffuse = new Color3(0.2, 0.28, 0.42);
  ambient.groundColor = new Color3(0.04, 0.05, 0.08);

  const keyLight = new DirectionalLight("solar-key", new Vector3(-0.35, -0.85, 0.4), scene);
  keyLight.position = new Vector3(14, 28, -12);
  keyLight.intensity = 4.2;
  keyLight.diffuse = new Color3(1, 0.95, 0.9);

  // Real-Time Shadow Generator
  const shadowGenerator = mobileTier
    ? null
    : new ShadowGenerator(quality === "high" ? 2048 : 1024, keyLight);
  if (shadowGenerator) {
    shadowGenerator.useContactHardeningShadow = quality === "high";
    shadowGenerator.contactHardeningLightSizeUVRatio = 0.04;
    shadowGenerator.bias = 0.0005;
    shadowGenerator.normalBias = 0.002;
  }

  const rimLightCyan = new PointLight("cyan-rim", new Vector3(-14, 12, 6), scene);
  rimLightCyan.intensity = mobileTier ? 16 : 28;
  rimLightCyan.range = 38;
  rimLightCyan.diffuse = new Color3(0, 0.94, 0.66);

  const rimLightViolet = new PointLight("violet-rim", new Vector3(14, 12, 10), scene);
  rimLightViolet.intensity = mobileTier ? 14 : 24;
  rimLightViolet.range = 38;
  rimLightViolet.diffuse = new Color3(0.72, 0.38, 1);

  const audio = new PinballAudio();
  void audio.arm();

  // Materials & Shaders
  const unlitMatte = (name: string, color: Color3) => {
    const mat = new PBRMaterial(name, scene);
    mat.albedoColor = color;
    mat.metallic = 0;
    mat.roughness = 1;
    mat.unlit = true;
    return mat;
  };

  const emissiveMat = (name: string, color: Color3, intensity = 1.2) => {
    const mat = new StandardMaterial(name, scene);
    mat.emissiveColor = color.scale(intensity);
    mat.disableLighting = true;
    return mat;
  };

  const pbrMetal = (name: string, color: Color3, metallic = 0.95, roughness = 0.15) => {
    const mat = new PBRMaterial(name, scene);
    mat.albedoColor = color;
    mat.metallic = metallic;
    mat.roughness = roughness;
    return mat;
  };

  const pbrClearGlass = (name: string, tint = new Color3(0.85, 0.95, 1)) => {
    const mat = new PBRMaterial(name, scene);
    mat.albedoColor = tint;
    mat.metallic = 0.1;
    mat.roughness = 0.05;
    mat.alpha = 0.45;
    mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
    return mat;
  };

  const railWhiteMat = unlitMatte("rail-white", Color3.White());
  const hazardOrangeMat = emissiveMat("hazard-orange", new Color3(1, 0.44, 0.05), 1.5);
  const cyanNeonMat = emissiveMat("cyan-neon", new Color3(0, 0.94, 0.66), 1.6);
  const violetNeonMat = emissiveMat("violet-neon", new Color3(0.72, 0.38, 1), 1.6);
  const goldNeonMat = emissiveMat("gold-neon", new Color3(1, 0.78, 0.22), 1.5);
  const darkTitaniumMat = pbrMetal("dark-titanium", new Color3(0.08, 0.09, 0.12), 0.92, 0.25);
  const polishedChromeMat = pbrMetal("chrome", new Color3(0.96, 0.98, 1), 1, 0.04);
  const carbonApronMat = pbrMetal("carbon-apron", new Color3(0.03, 0.04, 0.05), 0.6, 0.4);

  // Real-Time Reflection Probe for Liquid Chrome Ball
  const ballProbe = mobileTier
    ? null
    : new ReflectionProbe("ball-reflection-probe", 256, scene);
  if (ballProbe) {
    ballProbe.refreshRate = 1;
    polishedChromeMat.reflectionTexture = ballProbe.cubeTexture;
  }

  // Cleanroom Environment: Towering Server Monoliths & Overhead Trusses
  const envRoot = new TransformNode("mainframe-env", scene);

  // Reflective Floor
  const floor = CreateBox("cleanroom-floor", { width: 90, height: 1, depth: 90 }, scene);
  floor.position.set(0, -5, 10);
  floor.material = pbrMetal("floor-mat", new Color3(0.02, 0.025, 0.035), 0.7, 0.3);
  floor.parent = envRoot;

  // Server Towers
  for (let col = -4; col <= 4; col += 1) {
    if (Math.abs(col) < 2) continue;
    const towerX = col * 9.5;
    for (let row = 0; row < 5; row += 1) {
      const towerZ = -18 + row * 11;
      const tower = CreateBox(`server-col-${col}-${row}`, { width: 4.2, height: 34, depth: 4.2 }, scene);
      tower.position.set(towerX, 12, towerZ);
      tower.material = darkTitaniumMat;
      tower.parent = envRoot;
      if (ballProbe) ballProbe.renderList?.push(tower);

      // Vertical Fiber Channel
      const fiberStrip = CreateBox(`server-fiber-${col}-${row}`, { width: 0.12, height: 32, depth: 0.12 }, scene);
      fiberStrip.position.set(towerX + (col > 0 ? -2.05 : 2.05), 12, towerZ);
      fiberStrip.material = (row + Math.abs(col)) % 2 === 0 ? cyanNeonMat : violetNeonMat;
      fiberStrip.parent = envRoot;
      if (ballProbe) ballProbe.renderList?.push(fiberStrip);
    }
  }

  // Overhead Gantry Trusses
  for (let g = 0; g < 3; g += 1) {
    const truss = CreateBox(`overhead-truss-${g}`, { width: 60, height: 0.8, depth: 1.2 }, scene);
    truss.position.set(0, 22, -10 + g * 16);
    truss.material = darkTitaniumMat;
    truss.parent = envRoot;
    if (ballProbe) ballProbe.renderList?.push(truss);
  }

  // Table Root with realistic 9.5 deg pitch
  const tableWidth = 14.4;
  const tableLength = 26;
  const tableRoot = new TransformNode("table-root", scene);
  tableRoot.rotation.x = -0.165;

  // High-Definition 2048x4096 Procedural Silicon Table Deck
  const deckTexture = new DynamicTexture("playfield-hd-texture", { width: 2048, height: 4096 }, scene, false);
  const dCtx = deckTexture.getContext() as unknown as CanvasRenderingContext2D;

  function renderPlayfieldTexture(activeMult = 1) {
    // Dark Silicon Wafer Background
    dCtx.fillStyle = "#07090e";
    dCtx.fillRect(0, 0, 2048, 4096);

    // Micro-Carbon Weave Grid Pattern
    dCtx.strokeStyle = "rgba(255, 255, 255, 0.025)";
    dCtx.lineWidth = 1;
    for (let x = 0; x < 2048; x += 32) {
      dCtx.beginPath();
      dCtx.moveTo(x, 0);
      dCtx.lineTo(x, 4096);
      dCtx.stroke();
    }
    for (let y = 0; y < 4096; y += 32) {
      dCtx.beginPath();
      dCtx.moveTo(0, y);
      dCtx.lineTo(2048, y);
      dCtx.stroke();
    }

    // Outer Perimeter Silicon Margin
    dCtx.strokeStyle = "rgba(0, 240, 168, 0.35)";
    dCtx.lineWidth = 8;
    dCtx.strokeRect(90, 90, 1868, 3916);

    // Gold Circuit Traces & Microchip Nodes
    dCtx.strokeStyle = "rgba(246, 189, 82, 0.55)";
    dCtx.lineWidth = 4;
    for (let i = 0; i < 18; i += 1) {
      const startX = 220 + i * 90;
      dCtx.beginPath();
      dCtx.moveTo(startX, 600);
      dCtx.lineTo(startX, 1600);
      dCtx.lineTo(startX + (i % 2 === 0 ? 120 : -120), 2200);
      dCtx.lineTo(startX, 3100);
      dCtx.stroke();

      // Gold IC Pads
      dCtx.fillStyle = "rgba(246, 189, 82, 0.85)";
      dCtx.beginPath();
      dCtx.arc(startX, 600, 8, 0, Math.PI * 2);
      dCtx.arc(startX, 3100, 8, 0, Math.PI * 2);
      dCtx.fill();
    }

    // Glowing Recessed Laser Bus Conduits
    dCtx.strokeStyle = "rgba(0, 240, 168, 0.65)";
    dCtx.lineWidth = 10;
    dCtx.shadowColor = "#00f0a8";
    dCtx.shadowBlur = 24;

    // Center Quantum Core Vortex Rings
    dCtx.beginPath();
    dCtx.arc(1024, 1800, 320, 0, Math.PI * 2);
    dCtx.stroke();
    dCtx.beginPath();
    dCtx.arc(1024, 1800, 180, 0, Math.PI * 2);
    dCtx.stroke();

    // Top Prism Array Halo
    dCtx.strokeStyle = "rgba(184, 97, 255, 0.7)";
    dCtx.shadowColor = "#b861ff";
    dCtx.beginPath();
    dCtx.arc(1024, 850, 480, 0.2, Math.PI - 0.2);
    dCtx.stroke();
    dCtx.shadowBlur = 0;

    // Illuminated Mission Insert Chevrons (Ramps)
    const drawChevron = (cx: number, cy: number, color: string, glow: boolean) => {
      dCtx.fillStyle = color;
      if (glow) {
        dCtx.shadowColor = color;
        dCtx.shadowBlur = 20;
      }
      dCtx.beginPath();
      dCtx.moveTo(cx, cy - 60);
      dCtx.lineTo(cx + 40, cy);
      dCtx.lineTo(cx + 25, cy);
      dCtx.lineTo(cx, cy - 35);
      dCtx.lineTo(cx - 25, cy);
      dCtx.lineTo(cx - 40, cy);
      dCtx.closePath();
      dCtx.fill();
      dCtx.shadowBlur = 0;
    };

    // Left Ramp Chevrons
    for (let c = 0; c < 3; c += 1) {
      drawChevron(520, 2200 - c * 90, "#00f0a8", true);
    }
    // Right Ramp Chevrons
    for (let c = 0; c < 3; c += 1) {
      drawChevron(1528, 2200 - c * 90, "#b861ff", true);
    }

    // Dynamic Multiplier Ladder (x2, x4, x6, x8, x10)
    const multValues = [2, 4, 6, 8, 10];
    multValues.forEach((val, idx) => {
      const active = activeMult >= val;
      const my = 2750 - idx * 130;
      dCtx.fillStyle = active ? "#f6bd52" : "rgba(255, 255, 255, 0.12)";
      if (active) {
        dCtx.shadowColor = "#f6bd52";
        dCtx.shadowBlur = 22;
      }
      dCtx.beginPath();
      dCtx.moveTo(1024, my - 45);
      dCtx.lineTo(1024 + 55, my);
      dCtx.lineTo(1024, my + 45);
      dCtx.lineTo(1024 - 55, my);
      dCtx.closePath();
      dCtx.fill();
      dCtx.shadowBlur = 0;

      dCtx.fillStyle = active ? "#06090f" : "#606875";
      dCtx.font = "bold 32px monospace";
      dCtx.textAlign = "center";
      dCtx.textBaseline = "middle";
      dCtx.fillText(`×${val}`, 1024, my);
    });

    // Silkscreen Telemetry & Markings
    dCtx.fillStyle = "rgba(255, 255, 255, 0.4)";
    dCtx.font = "600 24px monospace";
    dCtx.textAlign = "center";
    dCtx.fillText("OPTICAL QUANTUM BUS / ARCHITECTURE 01", 1024, 380);
    dCtx.fillText("SUPERCONDUCTING CORE WELL", 1024, 2180);
    dCtx.fillText("OVERCLOCK MATRIX", 1024, 3050);

    deckTexture.update();
  }

  renderPlayfieldTexture(1);

  const deckMat = new PBRMaterial("deck-pbr", scene);
  deckMat.albedoTexture = deckTexture;
  deckMat.metallic = 0.25;
  deckMat.roughness = 0.45;

  const deck = CreateBox("table-bed", { width: tableWidth, height: 0.6, depth: tableLength }, scene);
  deck.position.set(0, -0.3, 3);
  deck.material = deckMat;
  deck.receiveShadows = true;
  deck.parent = tableRoot;
  if (ballProbe) ballProbe.renderList?.push(deck);

  // Table Boundary Rails with Chamfers & Underglow Channels
  const railHeight = 1.4;
  const railThickness = 0.7;

  // Left Outer Rail with Neon Underglow
  const leftRail = CreateBox("rail-left", { width: railThickness, height: railHeight, depth: tableLength }, scene);
  leftRail.position.set(-tableWidth / 2 + railThickness / 2, railHeight / 2, 3);
  leftRail.material = railWhiteMat;
  leftRail.parent = tableRoot;
  shadowGenerator?.addShadowCaster(leftRail);

  const leftUnderglow = CreateBox("rail-left-glow", { width: 0.08, height: 0.12, depth: tableLength - 2 }, scene);
  leftUnderglow.position.set(-tableWidth / 2 + railThickness + 0.05, 0.2, 3);
  leftUnderglow.material = cyanNeonMat;
  leftUnderglow.parent = tableRoot;

  // Right Outer Rail & Plunger Divider
  const rightRail = CreateBox("rail-right", { width: railThickness, height: railHeight, depth: tableLength }, scene);
  rightRail.position.set(tableWidth / 2 - railThickness / 2, railHeight / 2, 3);
  rightRail.material = railWhiteMat;
  rightRail.parent = tableRoot;
  shadowGenerator?.addShadowCaster(rightRail);

  const rightUnderglow = CreateBox("rail-right-glow", { width: 0.08, height: 0.12, depth: tableLength - 2 }, scene);
  rightUnderglow.position.set(tableWidth / 2 - railThickness - 0.05, 0.2, 3);
  rightUnderglow.material = violetNeonMat;
  rightUnderglow.parent = tableRoot;

  const plungerDivider = CreateBox("plunger-divider", { width: 0.35, height: railHeight, depth: tableLength * 0.75 }, scene);
  plungerDivider.position.set(tableWidth / 2 - 1.7, railHeight / 2, -0.1);
  plungerDivider.material = railWhiteMat;
  plungerDivider.parent = tableRoot;
  shadowGenerator?.addShadowCaster(plungerDivider);

  // Top Curved Arch & Hazard Warning Header
  const topArch = CreateBox("rail-top", { width: tableWidth, height: railHeight, depth: railThickness }, scene);
  topArch.position.set(0, railHeight / 2, tableLength / 2 + 3 - railThickness / 2);
  topArch.material = railWhiteMat;
  topArch.parent = tableRoot;
  shadowGenerator?.addShadowCaster(topArch);

  const topHazard = CreateBox("hazard-top-trim", { width: tableWidth - 1, height: 0.12, depth: 0.15 }, scene);
  topHazard.position.set(0, railHeight + 0.06, tableLength / 2 + 3 - railThickness / 2);
  topHazard.material = hazardOrangeMat;
  topHazard.parent = tableRoot;

  // Lower Apron Assembly (Brushed Carbon with instruction card slot)
  const apron = CreateBox("apron-plate", { width: tableWidth - 3.8, height: 0.6, depth: 5 }, scene);
  apron.position.set(-0.9, 0.35, -8.5);
  apron.material = carbonApronMat;
  apron.parent = tableRoot;
  shadowGenerator?.addShadowCaster(apron);

  // 3 Multi-Tiered Faceted Quartz Prism Bumpers
  const bumpers: BumperAssembly[] = [];
  const bumperCoords = [
    { x: -3.0, z: 8.5 },
    { x: 3.0, z: 8.5 },
    { x: 0, z: 11.4 },
  ];

  bumperCoords.forEach((coord, idx) => {
    const root = new TransformNode(`bumper-assembly-${idx}`, scene);
    root.position.set(coord.x, 0, coord.z);
    root.parent = tableRoot;

    // Chrome Base Skirt
    const skirt = CreateCylinder(`bumper-skirt-${idx}`, { height: 0.4, diameterTop: 2.2, diameterBottom: 2.5, tessellation: 24 }, scene);
    skirt.position.y = 0.2;
    skirt.material = polishedChromeMat;
    skirt.parent = root;
    shadowGenerator?.addShadowCaster(skirt);

    // Glowing Internal Filament Cylinder
    const filamentMat = emissiveMat(`bumper-filament-mat-${idx}`, new Color3(0, 0.94, 0.66), 1.8);
    const filament = CreateCylinder(`bumper-filament-${idx}`, { height: 0.7, diameter: 1.4, tessellation: 18 }, scene);
    filament.position.y = 0.55;
    filament.material = filamentMat;
    filament.parent = root;

    // Faceted Quartz Glass Cap
    const cap = CreateCylinder(`bumper-cap-${idx}`, { height: 0.6, diameterTop: 2.4, diameterBottom: 2.0, tessellation: 6 }, scene);
    cap.position.y = 0.9;
    cap.material = pbrClearGlass(`bumper-glass-${idx}`, new Color3(0.8, 0.95, 1));
    cap.parent = root;
    shadowGenerator?.addShadowCaster(cap);

    // Top Chrome Finial Ring
    const finial = CreateTorus(`bumper-finial-${idx}`, { diameter: 1.2, thickness: 0.12, tessellation: 20 }, scene);
    finial.position.y = 1.25;
    finial.rotation.x = Math.PI / 2;
    finial.material = polishedChromeMat;
    finial.parent = root;

    // Radial Point Light
    const light = new PointLight(`bumper-light-${idx}`, new Vector3(0, 1.4, 0), scene);
    light.diffuse = new Color3(0, 0.94, 0.66);
    light.intensity = 10;
    light.range = 9;
    light.parent = root;

    bumpers.push({
      root,
      cap,
      filament: filamentMat,
      light,
      x: coord.x,
      y: coord.z,
      radius: 1.25,
      flashTimer: 0,
    });
  });

  // Dual Sweeping Wireform Habitrails (Ramps)
  function createWireformRamp(name: string, isLeft: boolean) {
    const side = isLeft ? -1 : 1;
    const rampRoot = new TransformNode(name, scene);
    rampRoot.parent = tableRoot;

    // Curved Path Points
    const curvePoints = [
      new Vector3(side * 3.4, 0.2, 4.5),
      new Vector3(side * 3.8, 1.6, 6.2),
      new Vector3(side * 4.2, 2.8, 8.0),
      new Vector3(side * 3.2, 3.2, 9.8),
      new Vector3(side * 1.6, 2.6, 8.5),
      new Vector3(side * 2.2, 1.4, 2.5),
      new Vector3(side * 2.2, 0.4, -4.5),
    ];

    // Dual Parallel Chrome Rail Tubes
    const leftRailPath = curvePoints.map((pt) => pt.add(new Vector3(-0.25, 0, 0)));
    const rightRailPath = curvePoints.map((pt) => pt.add(new Vector3(0.25, 0, 0)));

    const rTube1 = CreateTube(`${name}-rail-1`, { path: leftRailPath, radius: 0.06, tessellation: 8 }, scene);
    rTube1.material = polishedChromeMat;
    rTube1.parent = rampRoot;
    shadowGenerator?.addShadowCaster(rTube1);

    const rTube2 = CreateTube(`${name}-rail-2`, { path: rightRailPath, radius: 0.06, tessellation: 8 }, scene);
    rTube2.material = polishedChromeMat;
    rTube2.parent = rampRoot;
    shadowGenerator?.addShadowCaster(rTube2);

    // Support Stanchions
    [1, 3, 5].forEach((idx) => {
      const pt = curvePoints[idx];
      if (pt) {
        const post = CreateCylinder(`${name}-post-${idx}`, { height: pt.y, diameter: 0.12 }, scene);
        post.position.set(pt.x, pt.y / 2, pt.z);
        post.material = darkTitaniumMat;
        post.parent = rampRoot;
        shadowGenerator?.addShadowCaster(post);
      }
    });

    // Glowing Fiber Entrance Arch
    const arch = CreateTorus(`${name}-entrance-arch`, { diameter: 1.2, thickness: 0.1, tessellation: 20 }, scene);
    arch.position.set(side * 3.4, 0.8, 4.8);
    arch.rotation.x = Math.PI / 2;
    arch.material = isLeft ? cyanNeonMat : violetNeonMat;
    arch.parent = rampRoot;

    return rampRoot;
  }

  createWireformRamp("ramp-left-wireform", true);
  createWireformRamp("ramp-right-wireform", false);

  // Recessed Superconducting Magnetic Well (Center Core)
  const coreRoot = new TransformNode("quantum-core-assembly", scene);
  coreRoot.position.set(0, 0, 4.2);
  coreRoot.parent = tableRoot;

  // Stepped Titanium Rings
  const coreOuterRing = CreateTorus("core-outer-ring", { diameter: 3.6, thickness: 0.22, tessellation: 32 }, scene);
  coreOuterRing.position.y = 0.15;
  coreOuterRing.rotation.x = Math.PI / 2;
  coreOuterRing.material = darkTitaniumMat;
  coreOuterRing.parent = coreRoot;
  shadowGenerator?.addShadowCaster(coreOuterRing);

  const coreHazardTeeth = CreateTorus("core-hazard-ring", { diameter: 3.1, thickness: 0.14, tessellation: 32 }, scene);
  coreHazardTeeth.position.y = 0.18;
  coreHazardTeeth.rotation.x = Math.PI / 2;
  coreHazardTeeth.material = hazardOrangeMat;
  coreHazardTeeth.parent = coreRoot;

  const coreCenterLight = new PointLight("quantum-core-light", new Vector3(0, 1.2, 0), scene);
  coreCenterLight.diffuse = new Color3(1, 0.45, 0.05);
  coreCenterLight.intensity = 14;
  coreCenterLight.range = 11;
  coreCenterLight.parent = coreRoot;

  // 4 Logic Gate Drop Targets with Backlit Symbols
  const targets: TargetAssembly[] = [];
  const targetConfigs = [
    { x: -4.0, label: "AND" },
    { x: -2.8, label: "OR" },
    { x: 2.8, label: "XOR" },
    { x: 4.0, label: "NOT" },
  ];

  targetConfigs.forEach((cfg, idx) => {
    const tRoot = new TransformNode(`target-assembly-${idx}`, scene);
    tRoot.position.set(cfg.x, 0, 1.2);
    tRoot.parent = tableRoot;

    // Recessed Plate
    const tPlate = CreateBox(`target-plate-${idx}`, { width: 0.85, height: 0.8, depth: 0.2 }, scene);
    tPlate.position.y = 0.4;
    tPlate.material = cyanNeonMat;
    tPlate.parent = tRoot;
    shadowGenerator?.addShadowCaster(tPlate);

    targets.push({ root: tRoot, mesh: tPlate, label: cfg.label, x: cfg.x, y: 1.2, dropped: false });
  });

  // Engineered 3D Articulated Flippers
  const flipperLength = 2.4;

  function createDetailedFlipper(name: string, isLeft: boolean) {
    const root = new TransformNode(name, scene);
    root.position.set(isLeft ? -2.4 : 2.4, 0.35, -6.5);
    root.parent = tableRoot;

    const side = isLeft ? 1 : -1;

    // Tapered Carbon Bat
    const bat = CreateBox(`${name}-bat`, { width: flipperLength, height: 0.55, depth: 0.42 }, scene);
    bat.position.set(side * (flipperLength / 2), 0, 0);
    bat.material = darkTitaniumMat;
    bat.parent = root;
    shadowGenerator?.addShadowCaster(bat);

    // Colored High-Tension Silicone Rubber Striking Band
    const rubber = CreateBox(`${name}-rubber`, { width: flipperLength, height: 0.16, depth: 0.14 }, scene);
    rubber.position.set(side * (flipperLength / 2), 0.24, 0.2);
    rubber.material = isLeft ? cyanNeonMat : violetNeonMat;
    rubber.parent = root;

    // Chrome Pivot Hub Cap
    const hub = CreateCylinder(`${name}-hub`, { height: 0.65, diameter: 0.65, tessellation: 20 }, scene);
    hub.position.y = 0.05;
    hub.material = polishedChromeMat;
    hub.parent = root;
    shadowGenerator?.addShadowCaster(hub);

    return root;
  }

  const flipperLeftRoot = createDetailedFlipper("flipper-left", true);
  const flipperRightRoot = createDetailedFlipper("flipper-right", false);

  // Slingshot Triangular Rebound Banks
  function createSlingshotBank(name: string, isLeft: boolean) {
    const side = isLeft ? -1 : 1;
    const slingRoot = new TransformNode(name, scene);
    slingRoot.position.set(side * 4.4, 0.35, -3.8);
    slingRoot.rotation.y = side * 0.3;
    slingRoot.parent = tableRoot;

    const body = CreateBox(`${name}-body`, { width: 1.8, height: 0.7, depth: 3.4 }, scene);
    body.material = railWhiteMat;
    body.parent = slingRoot;
    shadowGenerator?.addShadowCaster(body);

    const band = CreateBox(`${name}-band`, { width: 0.12, height: 0.2, depth: 3.4 }, scene);
    band.position.x = -side * 0.85;
    band.material = isLeft ? cyanNeonMat : violetNeonMat;
    band.parent = slingRoot;

    return slingRoot;
  }

  createSlingshotBank("sling-left-bank", true);
  createSlingshotBank("sling-right-bank", false);

  // Precision Spring Plunger Mechanism
  const plungerRoot = new TransformNode("plunger-assembly", scene);
  plungerRoot.position.set(tableWidth / 2 - 0.85, 0.35, -8.2);
  plungerRoot.parent = tableRoot;

  const plungerRod = CreateCylinder("plunger-rod", { height: 3.6, diameter: 0.38, tessellation: 18 }, scene);
  plungerRod.rotation.x = Math.PI / 2;
  plungerRod.material = polishedChromeMat;
  plungerRod.parent = plungerRoot;
  shadowGenerator?.addShadowCaster(plungerRod);

  const plungerTip = CreateSphere("plunger-tip", { diameter: 0.6, segments: 16 }, scene);
  plungerTip.position.z = 1.8;
  plungerTip.material = hazardOrangeMat;
  plungerTip.parent = plungerRoot;

  // Photonic Chrome Ball
  const ballRadius = 0.45;
  const ball = CreateSphere("photonic-chrome-ball", { diameter: ballRadius * 2, segments: 32 }, scene);
  ball.material = polishedChromeMat;
  ball.parent = tableRoot;
  shadowGenerator?.addShadowCaster(ball);

  const ballCoreLight = new PointLight("ball-core-light", Vector3.Zero(), scene);
  ballCoreLight.diffuse = new Color3(0, 0.94, 0.66);
  ballCoreLight.intensity = 12;
  ballCoreLight.range = 6;
  ballCoreLight.parent = ball;

  // State Management
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

  // Physics State
  let ballX = tableWidth / 2 - 0.85;
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

  // Camera Shake
  let cameraShake = 0;

  const routeKey = getDailyRouteKey();
  let animationId = 0;
  let lastTimestamp = performance.now();
  let frameCount = 0;
  let fps = 60;
  let fpsTimer = 0;
  let running = false;

  function resetBall() {
    ballX = tableWidth / 2 - 0.85;
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
    const launchSpeed = 24 + plungerPower * 30;
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

    // Gravity Acceleration down incline table
    const gravity = 29;
    ballVz -= gravity * dt;

    // Magnetic Well Vortex Capture
    const distToCore = Math.sqrt(ballX * ballX + (ballZ - 4.2) * (ballZ - 4.2));
    if (distToCore < 1.7) {
      if (vortexHoldTimer <= 0) {
        vortexHoldTimer = 1.2;
        audio.setVortex(true, 1);
        multiplier = Math.min(10, multiplier + 1);
        if (multiplier > maxMultiplier) maxMultiplier = multiplier;
        score += 15000 * multiplier;
        renderPlayfieldTexture(multiplier);
        cameraShake = 0.35;
        callout = `QUANTUM CORE CHARGE! ×${multiplier} [ +${(15000 * multiplier).toLocaleString()} PTS ]`;
        calloutTimer = 2.4;
      }
    }

    if (vortexHoldTimer > 0) {
      vortexHoldTimer -= dt;
      const angle = (1.2 - vortexHoldTimer) * Math.PI * 6;
      ballX = Math.cos(angle) * 0.75;
      ballZ = 4.2 + Math.sin(angle) * 0.75;
      ballVx = 0;
      ballVz = 0;
      if (vortexHoldTimer <= 0) {
        audio.setVortex(false);
        ballVx = (Math.random() - 0.5) * 18;
        ballVz = -25;
      }
      ball.position.set(ballX, ballRadius, ballZ);
      return;
    }

    // Velocity Integration
    ballX += ballVx * dt;
    ballZ += ballVz * dt;

    // Damping
    ballVx *= Math.pow(0.988, dt * 60);
    ballVz *= Math.pow(0.988, dt * 60);

    // Top Arch Bounce
    if (ballZ > tableLength / 2 + 3 - railThickness - ballRadius) {
      ballZ = tableLength / 2 + 3 - railThickness - ballRadius;
      ballVz = -Math.abs(ballVz) * 0.78;
      if (ballX > tableWidth / 2 - 2.2) {
        ballVx = -15;
      }
    }

    // Left Outer Wall
    if (ballX < -tableWidth / 2 + railThickness + ballRadius) {
      ballX = -tableWidth / 2 + railThickness + ballRadius;
      ballVx = Math.abs(ballVx) * 0.82;
      audio.targetHit();
    }

    // Right Outer Wall
    if (ballX > tableWidth / 2 - railThickness - ballRadius) {
      ballX = tableWidth / 2 - railThickness - ballRadius;
      ballVx = -Math.abs(ballVx) * 0.82;
      audio.targetHit();
    }

    // Plunger Divider Wall
    if (ballZ < 8 && ballX > tableWidth / 2 - 2.0 && ballX < tableWidth / 2 - 1.4) {
      if (ballVx > 0) {
        ballX = tableWidth / 2 - 2.0 - ballRadius;
        ballVx = -Math.abs(ballVx) * 0.82;
      } else {
        ballX = tableWidth / 2 - 1.4 + ballRadius;
        ballVx = Math.abs(ballVx) * 0.82;
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
          const nx = dx / dist;
          const nz = dz / dist;
          const bounceSpeed = 28;
          ballVx = nx * bounceSpeed;
          ballVz = nz * bounceSpeed;
          ballX = b.x + nx * (b.radius + ballRadius + 0.05);
          ballZ = b.y + nz * (b.radius + ballRadius + 0.05);

          bumperHits += 1;
          const pts = 1000 * multiplier;
          score += pts;
          b.flashTimer = 0.28;
          cameraShake = 0.25;
          audio.bumper(i);
        }
      }
    }

    // Wireform Ramp Loop Checks
    if (ballZ > 4.6 && ballZ < 6.4 && Math.abs(ballVx) < 18) {
      if (ballX > -4.8 && ballX < -2.4 && ballVz > 4) {
        rampLoops += 1;
        score += 5000 * multiplier;
        ballX = 2.2;
        ballZ = -1.5;
        ballVx = -6;
        ballVz = -15;
        cameraShake = 0.2;
        audio.rampWhoosh();
        callout = `DATA RAMP LOOP! [ +${(5000 * multiplier).toLocaleString()} PTS ]`;
        calloutTimer = 2;
      } else if (ballX > 2.4 && ballX < 4.8 && ballVz > 4) {
        rampLoops += 1;
        score += 5000 * multiplier;
        ballX = -2.2;
        ballZ = -1.5;
        ballVx = 6;
        ballVz = -15;
        cameraShake = 0.2;
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
        if (dx < 0.65 + ballRadius && dz < 0.25 + ballRadius) {
          t.dropped = true;
          t.mesh.position.y = -0.3; // Drop into playfield
          score += 2500 * multiplier;
          audio.targetHit();

          const allDropped = targets.every((tgt) => tgt.dropped);
          if (allDropped) {
            targetsCleared += 1;
            multiplier = Math.min(10, multiplier + 1);
            if (multiplier > maxMultiplier) maxMultiplier = multiplier;
            renderPlayfieldTexture(multiplier);
            score += 20000;
            cameraShake = 0.4;
            callout = `LOGIC GATES CLEARED! OVERCLOCK ×${multiplier}`;
            calloutTimer = 2.8;
            setTimeout(() => {
              targets.forEach((tgt) => {
                tgt.dropped = false;
                tgt.mesh.position.y = 0.4;
              });
            }, 1200);
          }
        }
      }
    }

    // Slingshots Kickback
    if (ballZ > -5.2 && ballZ < -2.4) {
      if (ballX > -4.8 && ballX < -3.2 && ballVx < 0) {
        ballVx = 24;
        ballVz = 13;
        score += 500;
        cameraShake = 0.15;
        audio.targetHit();
      } else if (ballX > 3.2 && ballX < 4.8 && ballVx > 0) {
        ballVx = -24;
        ballVz = 13;
        score += 500;
        cameraShake = 0.15;
        audio.targetHit();
      }
    }

    // Flippers Collision & Precision Impulse Striking
    const flX = -2.4;
    const flZ = -6.5;
    const dxL = ballX - flX;
    const dzL = ballZ - flZ;
    if (dxL > 0 && dxL < flipperLength + 0.25 && Math.abs(dzL) < 0.85) {
      const flAngle = flipperLeftRoot.rotation.y;
      if (ballVz < 0) {
        const strikeImpulse = leftFlipperActive ? 34 : 14;
        ballVx = Math.cos(flAngle + 0.8) * strikeImpulse;
        ballVz = Math.sin(flAngle + 0.8) * strikeImpulse;
        audio.flipper();
      }
    }

    const frX = 2.4;
    const frZ = -6.5;
    const dxR = ballX - frX;
    const dzR = ballZ - frZ;
    if (dxR < 0 && dxR > -flipperLength - 0.25 && Math.abs(dzR) < 0.85) {
      const frAngle = flipperRightRoot.rotation.y;
      if (ballVz < 0) {
        const strikeImpulse = rightFlipperActive ? 34 : 14;
        ballVx = -Math.cos(-frAngle + 0.8) * strikeImpulse;
        ballVz = Math.sin(-frAngle + 0.8) * strikeImpulse;
        audio.flipper();
      }
    }

    // Drain Check
    if (ballZ < -9.8) {
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

    // Flipper Animations
    const targetLeftAngle = leftFlipperActive ? 0.68 : -0.45;
    leftFlipperAngle = Scalar.Lerp(leftFlipperAngle, targetLeftAngle, 0.45);
    flipperLeftRoot.rotation.y = leftFlipperAngle;

    const targetRightAngle = rightFlipperActive ? -0.68 : 0.45;
    rightFlipperAngle = Scalar.Lerp(rightFlipperAngle, targetRightAngle, 0.45);
    flipperRightRoot.rotation.y = rightFlipperAngle;

    // Plunger Spring
    if (plungerCharging) {
      plungerPower = Math.min(1, plungerPower + dt * 1.5);
      plungerRod.position.z = -plungerPower * 1.4;
    } else {
      plungerRod.position.z = Scalar.Lerp(plungerRod.position.z, 0, 0.4);
    }

    // Bumper Dynamic Flash Decay
    bumpers.forEach((b) => {
      if (b.flashTimer > 0) {
        b.flashTimer -= dt;
        b.light.intensity = 26;
      } else {
        b.light.intensity = 10;
      }
    });

    // Camera Shake Decay
    if (cameraShake > 0) {
      cameraShake = Math.max(0, cameraShake - dt * 1.8);
      camera.position.x = (Math.random() - 0.5) * cameraShake * 0.4;
      camera.position.y = 18.5 + (Math.random() - 0.5) * cameraShake * 0.4;
    } else {
      camera.position.x = 0;
      camera.position.y = 18.5;
    }

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
      ballVx += (Math.random() - 0.5) * 4;
      ballVz += 3.5;
      cameraShake = 0.2;
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
        plungerPower = 0.85;
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
      renderPlayfieldTexture(1);
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
      ballVz += 3.5;
      cameraShake = 0.2;
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
