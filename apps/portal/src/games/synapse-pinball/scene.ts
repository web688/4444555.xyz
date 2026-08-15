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
import { createCoreCaptureState, stepCoreCapture } from "./core-capture";
import { getDailyRouteKey } from "./progress";

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
  scene.clearColor = new Color4(0.0015, 0.0018, 0.0024, 1);
  scene.fogMode = Scene.FOGMODE_NONE;
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.exposure = 1.12;
  scene.imageProcessingConfiguration.contrast = 1.34;
  scene.imageProcessingConfiguration.vignetteEnabled = true;
  scene.imageProcessingConfiguration.vignetteWeight = 0.92;
  scene.imageProcessingConfiguration.vignetteColor = new Color4(0.004, 0.003, 0.002, 1);

  // A slightly higher instrument-view camera keeps the frameless silhouette readable.
  const camera = new FreeCamera("pinball-camera", new Vector3(0, 21.2, -16.8), scene);
  camera.minZ = 0.1;
  camera.maxZ = 400;
  camera.fov = 0.8;
  const baseCameraTarget = new Vector3(0, 0.75, 3.2);
  camera.setTarget(baseCameraTarget);

  // Restrained gallery lighting: the table is the subject, not the room around it.
  const ambient = new HemisphericLight("mainframe-ambient", new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.66;
  ambient.diffuse = new Color3(0.42, 0.43, 0.43);
  ambient.groundColor = new Color3(0.018, 0.019, 0.023);

  const keyLight = new DirectionalLight("solar-key", new Vector3(-0.35, -0.85, 0.4), scene);
  keyLight.position = new Vector3(14, 28, -12);
  keyLight.intensity = 2.8;
  keyLight.diffuse = new Color3(1, 0.89, 0.7);

  // Real-Time Shadow Generator
  const shadowGenerator = mobileTier
    ? null
    : new ShadowGenerator(quality === "high" ? 1024 : 512, keyLight);
  if (shadowGenerator) {
    shadowGenerator.useContactHardeningShadow = quality === "high";
    shadowGenerator.contactHardeningLightSizeUVRatio = 0.04;
    shadowGenerator.bias = 0.0005;
    shadowGenerator.normalBias = 0.002;
  }

  const rimLightCyan = new PointLight("cyan-rim", new Vector3(-10, 8, 7), scene);
  rimLightCyan.intensity = mobileTier ? 2.5 : 4.5;
  rimLightCyan.range = 24;
  rimLightCyan.diffuse = new Color3(0.22, 0.72, 0.76);

  const rimLightAmber = new PointLight("amber-rim", new Vector3(10, 9, 5), scene);
  rimLightAmber.intensity = mobileTier ? 2.5 : 4.5;
  rimLightAmber.range = 24;
  rimLightAmber.diffuse = new Color3(1, 0.55, 0.2);

  const audio = new PinballAudio();
  void audio.arm();

  // Materials & Shaders
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

  const pbrClearGlass = (name: string, tint = new Color3(0.5, 0.67, 0.69), alpha = 0.3) => {
    const mat = new PBRMaterial(name, scene);
    mat.albedoColor = tint;
    mat.metallic = 0.1;
    mat.roughness = 0.28;
    mat.alpha = alpha;
    mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
    return mat;
  };

  const railIvoryMat = pbrMetal("relay-ivory", new Color3(0.68, 0.66, 0.58), 0.2, 0.62);
  const ivoryInsetMat = pbrMetal("relay-ivory-inset", new Color3(0.82, 0.79, 0.69), 0.12, 0.72);
  const hazardAmberMat = emissiveMat("hazard-amber", new Color3(0.94, 0.38, 0.055), 0.76);
  const cyanAccentMat = emissiveMat("cyan-accent", new Color3(0.12, 0.57, 0.64), 0.72);
  const amberAccentMat = emissiveMat("amber-accent", new Color3(0.93, 0.46, 0.12), 0.74);
  const darkTitaniumMat = pbrMetal("dark-titanium", new Color3(0.026, 0.031, 0.04), 0.74, 0.48);
  const graphiteMat = pbrMetal("graphite-composite", new Color3(0.045, 0.052, 0.063), 0.24, 0.7);
  const satinAlloyMat = pbrMetal("satin-alloy", new Color3(0.46, 0.48, 0.48), 0.8, 0.34);
  const blackCeramicMat = pbrMetal("black-ceramic", new Color3(0.012, 0.015, 0.02), 0.1, 0.38);
  const smokedGlassMat = pbrClearGlass("smoked-relay-glass", new Color3(0.18, 0.36, 0.39), 0.25);

  // The approved direction has no cabinet or room frame. A soft undertray gives the floating
  // instrument a shadow while disappearing into the portal-black environment.
  const envRoot = new TransformNode("relay-environment", scene);
  const underShadow = CreateBox("relay-under-shadow", { width: 16.2, height: 0.25, depth: 28.4 }, scene);
  underShadow.position.set(0, -1.65, 3.2);
  underShadow.material = blackCeramicMat;
  underShadow.parent = envRoot;

  // Table Root with realistic 9.5 deg pitch
  const tableWidth = 14.4;
  const tableLength = 26;
  const tableRoot = new TransformNode("table-root", scene);
  tableRoot.rotation.x = -0.165;

  // Matte technical playfield: sparse markings, one warm accent and one cool accent.
  const deckTexture = new DynamicTexture("playfield-hd-texture", { width: 2048, height: 4096 }, scene, false);
  const dCtx = deckTexture.getContext() as unknown as CanvasRenderingContext2D;

  function renderPlayfieldTexture(activeMult = 1) {
    dCtx.fillStyle = "#090c11";
    dCtx.fillRect(0, 0, 2048, 4096);

    // Large graphite plates replace the flat grid and give the deck manufactured depth.
    const plates: ReadonlyArray<readonly [number, number, number, number]> = [
      [90, 110, 840, 1120],
      [1118, 110, 840, 1120],
      [90, 1320, 1870, 1460],
      [90, 2870, 840, 1110],
      [1118, 2870, 840, 1110],
    ];
    plates.forEach(([x, y, width, height], index) => {
      dCtx.fillStyle = index === 2 ? "#0c1016" : "#0d1117";
      dCtx.fillRect(x, y, width, height);
      dCtx.strokeStyle = "rgba(209, 200, 175, 0.12)";
      dCtx.lineWidth = 3;
      dCtx.strokeRect(x, y, width, height);
    });

    dCtx.strokeStyle = "rgba(220, 210, 183, 0.19)";
    dCtx.lineWidth = 3;
    for (let i = 0; i < 9; i += 1) {
      const x = 220 + i * 204;
      const bend = i % 2 === 0 ? 150 : -150;
      dCtx.beginPath();
      dCtx.moveTo(x, 340);
      dCtx.lineTo(x, 980);
      dCtx.lineTo(x + bend, 1270);
      dCtx.stroke();
      dCtx.fillStyle = i % 2 === 0 ? "rgba(208, 99, 29, 0.7)" : "rgba(44, 153, 166, 0.62)";
      dCtx.beginPath();
      dCtx.arc(x, 340, 8, 0, Math.PI * 2);
      dCtx.fill();
    }

    // Relay core schematics echo the real stacked mechanism above the texture.
    for (const [radius, alpha] of [[360, 0.56], [285, 0.32], [180, 0.2]] as const) {
      dCtx.strokeStyle = `rgba(214, 111, 38, ${alpha})`;
      dCtx.lineWidth = radius === 360 ? 9 : 4;
      dCtx.beginPath();
      dCtx.arc(1024, 1890, radius, 0, Math.PI * 2);
      dCtx.stroke();
    }
    for (let spoke = 0; spoke < 12; spoke += 1) {
      const angle = (spoke / 12) * Math.PI * 2;
      dCtx.strokeStyle = spoke % 3 === 0 ? "rgba(57, 166, 178, 0.48)" : "rgba(220, 210, 183, 0.14)";
      dCtx.lineWidth = spoke % 3 === 0 ? 5 : 2;
      dCtx.beginPath();
      dCtx.moveTo(1024 + Math.cos(angle) * 190, 1890 + Math.sin(angle) * 190);
      dCtx.lineTo(1024 + Math.cos(angle) * 350, 1890 + Math.sin(angle) * 350);
      dCtx.stroke();
    }

    // The upper arc is a route map rather than decorative neon.
    dCtx.strokeStyle = "rgba(49, 158, 171, 0.46)";
    dCtx.lineWidth = 7;
    dCtx.beginPath();
    dCtx.arc(1024, 720, 560, 0.12, Math.PI - 0.12);
    dCtx.stroke();
    dCtx.strokeStyle = "rgba(213, 106, 32, 0.38)";
    dCtx.lineWidth = 4;
    dCtx.beginPath();
    dCtx.arc(1024, 720, 490, 0.2, Math.PI - 0.2);
    dCtx.stroke();

    const drawChevron = (cx: number, cy: number, color: string) => {
      dCtx.fillStyle = color;
      dCtx.beginPath();
      dCtx.moveTo(cx, cy - 44);
      dCtx.lineTo(cx + 32, cy);
      dCtx.lineTo(cx + 16, cy);
      dCtx.lineTo(cx, cy - 24);
      dCtx.lineTo(cx - 16, cy);
      dCtx.lineTo(cx - 32, cy);
      dCtx.closePath();
      dCtx.fill();
    };

    for (let c = 0; c < 3; c += 1) {
      drawChevron(430, 2480 - c * 92, "rgba(58, 158, 168, 0.72)");
    }
    for (let c = 0; c < 3; c += 1) {
      drawChevron(1618, 2480 - c * 92, "rgba(207, 126, 49, 0.78)");
    }

    const multValues = [2, 4, 6, 8, 10];
    multValues.forEach((val, idx) => {
      const active = activeMult >= val;
      const my = 3180 - idx * 132;
      dCtx.fillStyle = active ? "#d59a59" : "rgba(232, 229, 215, 0.1)";
      dCtx.beginPath();
      dCtx.moveTo(1024, my - 36);
      dCtx.lineTo(1068, my);
      dCtx.lineTo(1024, my + 36);
      dCtx.lineTo(980, my);
      dCtx.closePath();
      dCtx.fill();

      dCtx.fillStyle = active ? "#090a0d" : "rgba(232, 229, 215, 0.32)";
      dCtx.font = "bold 28px monospace";
      dCtx.textAlign = "center";
      dCtx.textBaseline = "middle";
      dCtx.fillText(`×${val}`, 1024, my);
    });

    dCtx.fillStyle = "rgba(232, 225, 205, 0.45)";
    dCtx.font = "600 23px monospace";
    dCtx.textAlign = "center";
    dCtx.fillText("ORBITAL RELAY / TABLE 01", 1024, 210);
    dCtx.fillText("CAPTURE ARRAY", 1024, 2380);
    dCtx.fillText("ROUTE POWER", 1024, 3460);

    deckTexture.update();
  }

  renderPlayfieldTexture(1);

  const deckMat = new PBRMaterial("deck-pbr", scene);
  deckMat.albedoTexture = deckTexture;
  deckMat.metallic = 0.18;
  deckMat.roughness = 0.68;

  const undertray = CreateBox("relay-undertray", { width: 14, height: 0.42, depth: 25.7 }, scene);
  undertray.position.set(0, -0.5, 3);
  undertray.material = graphiteMat;
  undertray.parent = tableRoot;

  const deck = CreateBox("relay-playfield", { width: 13.65, height: 0.24, depth: 25.35 }, scene);
  deck.position.set(-0.1, -0.12, 3.05);
  deck.material = deckMat;
  deck.receiveShadows = true;
  deck.parent = tableRoot;

  // Physics still use the original 0.7 boundary. Visually, the approved table has only slim
  // ball guides and discrete anchor modules — no enclosing cabinet.
  const railThickness = 0.7;

  function createGuide(name: string, path: Vector3[], material = satinAlloyMat, radius = 0.1) {
    const guide = CreateTube(name, { path, radius, tessellation: mobileTier ? 6 : 10 }, scene);
    guide.material = material;
    guide.parent = tableRoot;
    shadowGenerator?.addShadowCaster(guide);
    return guide;
  }

  createGuide("left-perimeter-guide", [
    new Vector3(-6.55, 0.42, -9.8),
    new Vector3(-6.62, 0.48, 8.8),
    new Vector3(-6.22, 0.58, 13.3),
    new Vector3(-5.05, 0.7, 14.95),
  ]);
  createGuide("right-perimeter-guide", [
    new Vector3(6.55, 0.42, -9.8),
    new Vector3(6.62, 0.48, 8.8),
    new Vector3(6.22, 0.58, 13.3),
    new Vector3(5.05, 0.7, 14.95),
  ]);
  createGuide("upper-return-guide", [
    new Vector3(-5.05, 0.7, 14.95),
    new Vector3(-2.6, 0.78, 15.45),
    new Vector3(0, 0.8, 15.55),
    new Vector3(2.6, 0.78, 15.45),
    new Vector3(5.05, 0.7, 14.95),
  ], railIvoryMat, 0.13);
  createGuide("plunger-lane-guide", [
    new Vector3(5.5, 0.38, -8.9),
    new Vector3(5.5, 0.42, 8.6),
    new Vector3(5.85, 0.52, 11.8),
  ], railIvoryMat, 0.11);

  function createArmorModule(
    name: string,
    x: number,
    z: number,
    width: number,
    depth: number,
    rotation: number,
    accent: StandardMaterial,
  ) {
    const root = new TransformNode(name, scene);
    root.position.set(x, 0, z);
    root.rotation.y = rotation;
    root.parent = tableRoot;

    const base = CreateBox(`${name}-base`, { width, height: 0.42, depth }, scene);
    base.position.y = 0.22;
    base.material = darkTitaniumMat;
    base.parent = root;
    shadowGenerator?.addShadowCaster(base);

    const armor = CreateBox(`${name}-armor`, { width: width * 0.82, height: 0.24, depth: depth * 0.7 }, scene);
    armor.position.y = 0.53;
    armor.material = railIvoryMat;
    armor.parent = root;
    shadowGenerator?.addShadowCaster(armor);

    const recess = CreateBox(`${name}-recess`, { width: width * 0.48, height: 0.1, depth: depth * 0.34 }, scene);
    recess.position.y = 0.7;
    recess.material = blackCeramicMat;
    recess.parent = root;

    const datum = CreateBox(`${name}-datum`, { width: width * 0.62, height: 0.06, depth: 0.09 }, scene);
    datum.position.set(0, 0.77, depth * 0.17);
    datum.material = accent;
    datum.parent = root;

    for (const side of [-1, 1]) {
      const bolt = CreateCylinder(`${name}-bolt-${side}`, { height: 0.12, diameter: 0.16, tessellation: 10 }, scene);
      bolt.position.set(side * width * 0.31, 0.72, -depth * 0.22);
      bolt.material = satinAlloyMat;
      bolt.parent = root;
    }

    return root;
  }

  createArmorModule("left-lower-anchor", -5.35, -7.4, 2.2, 3.4, -0.12, cyanAccentMat);
  createArmorModule("right-lower-anchor", 4.75, -7.4, 2.2, 3.4, 0.12, amberAccentMat);
  createArmorModule("left-mid-anchor", -5.8, 1.9, 1.35, 3.2, 0.06, cyanAccentMat);
  createArmorModule("right-mid-anchor", 5.1, 1.9, 1.35, 3.2, -0.06, amberAccentMat);
  createArmorModule("left-upper-anchor", -5.15, 12.15, 1.65, 3.0, -0.28, amberAccentMat);
  createArmorModule("right-upper-anchor", 5.0, 11.7, 1.65, 3.8, 0.32, cyanAccentMat);

  const insertCoords = [
    [-4.4, -1.4], [-3.8, 0], [-3.25, 1.4],
    [4.4, -1.4], [3.8, 0], [3.25, 1.4],
    [-1.15, -2.2], [0, -2.45], [1.15, -2.2],
  ] as const;
  insertCoords.forEach(([x, z], index) => {
    const insert = CreateCylinder(`route-insert-${index}`, { height: 0.08, diameter: index > 5 ? 0.38 : 0.31, tessellation: 18 }, scene);
    insert.position.set(x, 0.05, z);
    insert.material = index % 3 === 0 ? cyanAccentMat : amberAccentMat;
    insert.parent = tableRoot;
  });

  // Three relay turbines: layered housings, isolation rings and recessed optical lenses.
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

    const lowerBase = CreateCylinder(`bumper-lower-base-${idx}`, { height: 0.26, diameter: 2.7, tessellation: 28 }, scene);
    lowerBase.position.y = 0.13;
    lowerBase.material = graphiteMat;
    lowerBase.parent = root;
    shadowGenerator?.addShadowCaster(lowerBase);

    const isolationRing = CreateTorus(`bumper-isolation-ring-${idx}`, { diameter: 2.35, thickness: 0.16, tessellation: 28 }, scene);
    isolationRing.position.y = 0.32;
    isolationRing.rotation.x = Math.PI / 2;
    isolationRing.material = amberAccentMat;
    isolationRing.parent = root;

    const skirt = CreateCylinder(
      `bumper-skirt-${idx}`,
      { height: 0.5, diameterTop: 2.0, diameterBottom: 2.45, tessellation: 24 },
      scene,
    );
    skirt.position.y = 0.55;
    skirt.material = railIvoryMat;
    skirt.parent = root;
    shadowGenerator?.addShadowCaster(skirt);

    const collar = CreateCylinder(`bumper-collar-${idx}`, { height: 0.25, diameter: 1.75, tessellation: 24 }, scene);
    collar.position.y = 0.88;
    collar.material = darkTitaniumMat;
    collar.parent = root;

    const filamentMat = emissiveMat(`bumper-filament-mat-${idx}`, new Color3(0.14, 0.61, 0.68), 0.82);
    const filament = CreateCylinder(`bumper-filament-${idx}`, { height: 0.18, diameter: 1.35, tessellation: 24 }, scene);
    filament.position.y = 1.03;
    filament.material = filamentMat;
    filament.parent = root;

    const cap = CreateCylinder(`bumper-cap-${idx}`, { height: 0.36, diameterTop: 1.35, diameterBottom: 1.62, tessellation: 16 }, scene);
    cap.position.y = 1.22;
    cap.material = smokedGlassMat;
    cap.parent = root;
    shadowGenerator?.addShadowCaster(cap);

    const finial = CreateTorus(`bumper-finial-${idx}`, { diameter: 1.15, thickness: 0.09, tessellation: 24 }, scene);
    finial.position.y = 1.42;
    finial.rotation.x = Math.PI / 2;
    finial.material = satinAlloyMat;
    finial.parent = root;

    for (let clampIndex = 0; clampIndex < 3; clampIndex += 1) {
      const angle = (clampIndex / 3) * Math.PI * 2;
      const clamp = CreateBox(`bumper-clamp-${idx}-${clampIndex}`, { width: 0.3, height: 0.22, depth: 0.62 }, scene);
      clamp.position.set(Math.cos(angle) * 1.03, 0.92, Math.sin(angle) * 1.03);
      clamp.rotation.y = -angle;
      clamp.material = ivoryInsetMat;
      clamp.parent = root;
    }

    // Radial Point Light
    const light = new PointLight(`bumper-light-${idx}`, new Vector3(0, 1.4, 0), scene);
    light.diffuse = new Color3(0.18, 0.68, 0.72);
    light.intensity = mobileTier ? 2.2 : 3.5;
    light.range = 5;
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

  const relayPostCoords = [
    [-5.45, 6.15], [-5.05, 9.55], [-3.85, 12.55],
    [5.35, 6.05], [5.1, 9.45], [3.8, 12.5],
  ] as const;
  relayPostCoords.forEach(([x, z], index) => {
    const post = CreateCylinder(`relay-guide-post-${index}`, { height: 1.05, diameter: 0.2, tessellation: 12 }, scene);
    post.position.set(x, 0.52, z);
    post.material = satinAlloyMat;
    post.parent = tableRoot;
    shadowGenerator?.addShadowCaster(post);

    const postCap = CreateCylinder(`relay-guide-post-cap-${index}`, { height: 0.12, diameter: 0.34, tessellation: 12 }, scene);
    postCap.position.set(x, 1.08, z);
    postCap.material = index % 2 === 0 ? railIvoryMat : darkTitaniumMat;
    postCap.parent = tableRoot;
  });

  [-1.6, 0, 1.6].forEach((x, index) => {
    const rollover = CreateCylinder(`upper-rollover-${index}`, { height: 0.08, diameter: 0.48, tessellation: 20 }, scene);
    rollover.position.set(x, 0.05, 13.2);
    rollover.material = index === 1 ? amberAccentMat : cyanAccentMat;
    rollover.parent = tableRoot;

    const rolloverRing = CreateTorus(`upper-rollover-ring-${index}`, { diameter: 0.68, thickness: 0.07, tessellation: 20 }, scene);
    rolloverRing.position.set(x, 0.1, 13.2);
    rolloverRing.rotation.x = Math.PI / 2;
    rolloverRing.material = satinAlloyMat;
    rolloverRing.parent = tableRoot;
  });

  // Asymmetric relay routes: a long orbital return on the left and a plated service bridge on
  // the right. Both keep the original trigger locations, so scoring and physics are unchanged.
  function createWireformRamp(name: string, isLeft: boolean) {
    const rampRoot = new TransformNode(name, scene);
    rampRoot.parent = tableRoot;

    const curvePoints = isLeft
      ? [
          new Vector3(-3.5, 0.22, 4.5),
          new Vector3(-4.7, 1.25, 6.8),
          new Vector3(-5.25, 2.35, 10.2),
          new Vector3(-4.3, 3.15, 13.2),
          new Vector3(-1.8, 3.55, 14.45),
          new Vector3(1.2, 3.5, 14.2),
          new Vector3(3.25, 2.8, 12.35),
          new Vector3(3.8, 1.7, 9.6),
          new Vector3(2.65, 0.42, 6.1),
        ]
      : [
          new Vector3(3.45, 0.22, 4.5),
          new Vector3(4.45, 1.15, 6.1),
          new Vector3(4.2, 2.05, 8.55),
          new Vector3(2.8, 2.55, 10.0),
          new Vector3(1.2, 2.32, 8.85),
          new Vector3(1.55, 1.35, 6.45),
          new Vector3(2.35, 0.4, 2.45),
          new Vector3(2.2, 0.24, -2.4),
        ];

    const leftRailPath = curvePoints.map((pt) => pt.add(new Vector3(-0.25, 0, 0)));
    const rightRailPath = curvePoints.map((pt) => pt.add(new Vector3(0.25, 0, 0)));

    const rTube1 = CreateTube(`${name}-rail-1`, { path: leftRailPath, radius: 0.06, tessellation: 8 }, scene);
    rTube1.material = satinAlloyMat;
    rTube1.parent = rampRoot;
    shadowGenerator?.addShadowCaster(rTube1);

    const rTube2 = CreateTube(`${name}-rail-2`, { path: rightRailPath, radius: 0.06, tessellation: 8 }, scene);
    rTube2.material = satinAlloyMat;
    rTube2.parent = rampRoot;
    shadowGenerator?.addShadowCaster(rTube2);

    // Smoked deck tiles make the ball route visually legible without turning it into a solid ramp.
    for (let segment = 0; segment < curvePoints.length - 1; segment += 2) {
      const start = curvePoints[segment];
      const end = curvePoints[Math.min(segment + 1, curvePoints.length - 1)];
      if (!start || !end) continue;
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const tile = CreateBox(
        `${name}-glass-tile-${segment}`,
        { width: 0.72, height: 0.08, depth: Math.sqrt(dx * dx + dz * dz) * 0.86 },
        scene,
      );
      tile.position.set((start.x + end.x) / 2, (start.y + end.y) / 2 - 0.09, (start.z + end.z) / 2);
      tile.rotation.y = Math.atan2(dx, dz);
      tile.material = smokedGlassMat;
      tile.parent = rampRoot;
    }

    const supportIndices = isLeft ? [1, 3, 5, 7] : [1, 3, 5];
    supportIndices.forEach((idx) => {
      const pt = curvePoints[idx];
      if (pt) {
        const post = CreateCylinder(`${name}-post-${idx}`, { height: pt.y, diameter: 0.12 }, scene);
        post.position.set(pt.x, pt.y / 2, pt.z);
        post.material = darkTitaniumMat;
        post.parent = rampRoot;
        shadowGenerator?.addShadowCaster(post);

        const bracket = CreateBox(`${name}-bracket-${idx}`, { width: 0.8, height: 0.18, depth: 0.34 }, scene);
        bracket.position.set(pt.x, pt.y + 0.08, pt.z);
        bracket.rotation.y = idx * 0.18;
        bracket.material = railIvoryMat;
        bracket.parent = rampRoot;
      }
    });

    // Entry coupler marks the real scoring threshold.
    const entrance = curvePoints[0] ?? Vector3.Zero();
    const arch = CreateTorus(`${name}-entrance-arch`, { diameter: 1.2, thickness: 0.1, tessellation: 20 }, scene);
    arch.position.set(entrance.x, 0.78, entrance.z + 0.25);
    arch.rotation.x = Math.PI / 2;
    arch.material = isLeft ? cyanAccentMat : amberAccentMat;
    arch.parent = rampRoot;

    if (!isLeft) {
      const serviceSpine = CreateBox(`${name}-service-spine`, { width: 1.15, height: 0.26, depth: 4.5 }, scene);
      serviceSpine.position.set(4.55, 1.35, 8.25);
      serviceSpine.rotation.y = -0.18;
      serviceSpine.material = railIvoryMat;
      serviceSpine.parent = rampRoot;
      shadowGenerator?.addShadowCaster(serviceSpine);

      const serviceRecess = CreateBox(`${name}-service-recess`, { width: 0.62, height: 0.12, depth: 2.8 }, scene);
      serviceRecess.position.set(4.55, 1.55, 8.25);
      serviceRecess.rotation.y = -0.18;
      serviceRecess.material = blackCeramicMat;
      serviceRecess.parent = rampRoot;
    }

    return rampRoot;
  }

  createWireformRamp("ramp-left-wireform", true);
  createWireformRamp("ramp-right-wireform", false);

  // Large orbital relay core — the table's visual and scoring focal point.
  const coreRoot = new TransformNode("orbital-relay-core", scene);
  coreRoot.position.set(0, 0, 4.2);
  coreRoot.parent = tableRoot;

  const corePlinth = CreateCylinder("core-plinth", { height: 0.22, diameter: 4.9, tessellation: 48 }, scene);
  corePlinth.position.y = 0.09;
  corePlinth.material = graphiteMat;
  corePlinth.parent = coreRoot;
  shadowGenerator?.addShadowCaster(corePlinth);

  const coreOuterRing = CreateTorus("core-outer-ring", { diameter: 4.35, thickness: 0.28, tessellation: 48 }, scene);
  coreOuterRing.position.y = 0.3;
  coreOuterRing.rotation.x = Math.PI / 2;
  coreOuterRing.material = satinAlloyMat;
  coreOuterRing.parent = coreRoot;
  shadowGenerator?.addShadowCaster(coreOuterRing);

  const coreHazardTeeth = CreateTorus("core-hazard-ring", { diameter: 3.75, thickness: 0.12, tessellation: 40 }, scene);
  coreHazardTeeth.position.y = 0.36;
  coreHazardTeeth.rotation.x = Math.PI / 2;
  coreHazardTeeth.material = hazardAmberMat;
  coreHazardTeeth.parent = coreRoot;

  const coreRotorRoot = new TransformNode("core-rotor", scene);
  coreRotorRoot.parent = coreRoot;
  for (let segment = 0; segment < 12; segment += 1) {
    const angle = (segment / 12) * Math.PI * 2;
    const module = CreateBox(
      `core-rotor-module-${segment}`,
      { width: segment % 3 === 0 ? 0.58 : 0.42, height: 0.32, depth: 0.82 },
      scene,
    );
    module.position.set(Math.cos(angle) * 1.78, 0.47, Math.sin(angle) * 1.78);
    module.rotation.y = -angle;
    module.material = segment % 3 === 0 ? railIvoryMat : darkTitaniumMat;
    module.parent = coreRotorRoot;
    shadowGenerator?.addShadowCaster(module);

    const marker = CreateBox(`core-rotor-marker-${segment}`, { width: 0.2, height: 0.06, depth: 0.34 }, scene);
    marker.position.set(Math.cos(angle) * 1.78, 0.67, Math.sin(angle) * 1.78);
    marker.rotation.y = -angle;
    marker.material = segment % 2 === 0 ? amberAccentMat : cyanAccentMat;
    marker.parent = coreRotorRoot;
  }

  const coreWell = CreateCylinder("core-well", { height: 0.28, diameter: 2.65, tessellation: 40 }, scene);
  coreWell.position.y = 0.22;
  coreWell.material = blackCeramicMat;
  coreWell.parent = coreRoot;

  const coreLensRing = CreateTorus("core-lens-ring", { diameter: 2.3, thickness: 0.12, tessellation: 40 }, scene);
  coreLensRing.position.y = 0.38;
  coreLensRing.rotation.x = Math.PI / 2;
  coreLensRing.material = cyanAccentMat;
  coreLensRing.parent = coreRoot;

  const coreLens = CreateCylinder("core-lens", { height: 0.13, diameter: 1.75, tessellation: 40 }, scene);
  coreLens.position.y = 0.39;
  coreLens.material = smokedGlassMat;
  coreLens.parent = coreRoot;

  const coreCenterLight = new PointLight("quantum-core-light", new Vector3(0, 1.2, 0), scene);
  coreCenterLight.diffuse = new Color3(0.22, 0.68, 0.72);
  coreCenterLight.intensity = mobileTier ? 2.2 : 3.8;
  coreCenterLight.range = 6;
  coreCenterLight.parent = coreRoot;

  // Four recessed routing shutters mounted in one substantial mechanical target bank.
  const targets: TargetAssembly[] = [];
  const targetBank = CreateBox("relay-target-bank", { width: 5.85, height: 0.34, depth: 1.2 }, scene);
  targetBank.position.set(0, 0.18, 1.25);
  targetBank.material = graphiteMat;
  targetBank.parent = tableRoot;
  shadowGenerator?.addShadowCaster(targetBank);

  const targetBankArmor = CreateBox("relay-target-bank-armor", { width: 5.35, height: 0.18, depth: 0.34 }, scene);
  targetBankArmor.position.set(0, 0.45, 1.55);
  targetBankArmor.material = railIvoryMat;
  targetBankArmor.parent = tableRoot;
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

    const casing = CreateBox(`target-casing-${idx}`, { width: 1.0, height: 0.72, depth: 0.34 }, scene);
    casing.position.y = 0.4;
    casing.material = darkTitaniumMat;
    casing.parent = tRoot;

    const tPlate = CreateBox(`target-plate-${idx}`, { width: 0.7, height: 0.52, depth: 0.16 }, scene);
    tPlate.position.set(0, 0.5, -0.12);
    tPlate.material = idx < 2 ? cyanAccentMat : amberAccentMat;
    tPlate.parent = tRoot;
    shadowGenerator?.addShadowCaster(tPlate);

    const targetCap = CreateBox(`target-cap-${idx}`, { width: 0.42, height: 0.08, depth: 0.18 }, scene);
    targetCap.position.set(0, 0.83, 0);
    targetCap.material = ivoryInsetMat;
    targetCap.parent = tRoot;

    targets.push({ root: tRoot, mesh: tPlate, label: cfg.label, x: cfg.x, y: 1.2, dropped: false });
  });

  // Machined tapered flippers with embedded route markers.
  const flipperLength = 2.4;

  function createDetailedFlipper(name: string, isLeft: boolean) {
    const root = new TransformNode(name, scene);
    root.position.set(isLeft ? -2.4 : 2.4, 0.35, -6.5);
    root.parent = tableRoot;

    const side = isLeft ? 1 : -1;

    const bat = CreateCylinder(
      `${name}-bat`,
      { height: flipperLength, diameterTop: 0.38, diameterBottom: 0.72, tessellation: 14 },
      scene,
    );
    bat.position.set(side * (flipperLength / 2), 0, 0);
    bat.rotation.z = -side * Math.PI / 2;
    bat.material = ivoryInsetMat;
    bat.parent = root;
    shadowGenerator?.addShadowCaster(bat);

    const underBat = CreateCylinder(
      `${name}-under-bat`,
      { height: flipperLength * 0.92, diameterTop: 0.28, diameterBottom: 0.54, tessellation: 14 },
      scene,
    );
    underBat.position.set(side * (flipperLength / 2), -0.13, 0);
    underBat.rotation.z = -side * Math.PI / 2;
    underBat.material = darkTitaniumMat;
    underBat.parent = root;

    const rubber = CreateBox(`${name}-rubber`, { width: flipperLength * 0.78, height: 0.1, depth: 0.18 }, scene);
    rubber.position.set(side * (flipperLength * 0.48), 0.24, 0.04);
    rubber.material = isLeft ? cyanAccentMat : amberAccentMat;
    rubber.parent = root;

    const hub = CreateCylinder(`${name}-hub`, { height: 0.5, diameter: 0.82, tessellation: 24 }, scene);
    hub.position.y = 0.02;
    hub.material = satinAlloyMat;
    hub.parent = root;
    shadowGenerator?.addShadowCaster(hub);

    const hubInset = CreateCylinder(`${name}-hub-inset`, { height: 0.12, diameter: 0.48, tessellation: 20 }, scene);
    hubInset.position.y = 0.33;
    hubInset.material = blackCeramicMat;
    hubInset.parent = root;

    return root;
  }

  const flipperLeftRoot = createDetailedFlipper("flipper-left", true);
  const flipperRightRoot = createDetailedFlipper("flipper-right", false);

  // Low-profile armored slingshots — layered mechanisms instead of the former white slabs.
  function createSlingshotBank(name: string, isLeft: boolean) {
    const side = isLeft ? -1 : 1;
    const slingRoot = new TransformNode(name, scene);
    slingRoot.position.set(side * 4.4, 0.35, -3.8);
    slingRoot.rotation.y = side * 0.3;
    slingRoot.parent = tableRoot;

    const base = CreateBox(`${name}-base`, { width: 1.85, height: 0.3, depth: 3.35 }, scene);
    base.position.y = 0.12;
    base.material = graphiteMat;
    base.parent = slingRoot;
    shadowGenerator?.addShadowCaster(base);

    const armor = CreateBox(`${name}-armor`, { width: 1.38, height: 0.3, depth: 2.55 }, scene);
    armor.position.set(side * 0.08, 0.42, 0.1);
    armor.material = railIvoryMat;
    armor.parent = slingRoot;
    shadowGenerator?.addShadowCaster(armor);

    const recess = CreateBox(`${name}-recess`, { width: 0.72, height: 0.1, depth: 1.45 }, scene);
    recess.position.set(-side * 0.12, 0.62, 0.1);
    recess.material = blackCeramicMat;
    recess.parent = slingRoot;

    const band = CreateBox(`${name}-band`, { width: 0.11, height: 0.16, depth: 2.75 }, scene);
    band.position.set(-side * 0.77, 0.5, 0.05);
    band.material = isLeft ? cyanAccentMat : amberAccentMat;
    band.parent = slingRoot;

    for (const z of [-1.2, 1.2]) {
      const pivot = CreateCylinder(`${name}-pivot-${z}`, { height: 0.56, diameter: 0.3, tessellation: 12 }, scene);
      pivot.position.set(side * 0.64, 0.34, z);
      pivot.material = satinAlloyMat;
      pivot.parent = slingRoot;
    }

    return slingRoot;
  }

  createSlingshotBank("sling-left-bank", true);
  createSlingshotBank("sling-right-bank", false);

  // Exposed plunger actuator, deliberately detached from any cabinet wall.
  const plungerRoot = new TransformNode("plunger-assembly", scene);
  plungerRoot.position.set(tableWidth / 2 - 0.85, 0.35, -8.2);
  plungerRoot.parent = tableRoot;

  const plungerRod = CreateCylinder("plunger-rod", { height: 3.6, diameter: 0.38, tessellation: 18 }, scene);
  plungerRod.rotation.x = Math.PI / 2;
  plungerRod.material = satinAlloyMat;
  plungerRod.parent = plungerRoot;
  shadowGenerator?.addShadowCaster(plungerRod);

  const plungerTip = CreateSphere("plunger-tip", { diameter: 0.6, segments: 16 }, scene);
  plungerTip.position.z = 1.8;
  plungerTip.material = hazardAmberMat;
  plungerTip.parent = plungerRoot;

  for (let coilIndex = 0; coilIndex < 8; coilIndex += 1) {
    const coil = CreateTorus(`plunger-coil-${coilIndex}`, { diameter: 0.72, thickness: 0.065, tessellation: 18 }, scene);
    coil.position.set(0, 0, -1.2 + coilIndex * 0.3);
    coil.rotation.x = Math.PI / 2;
    coil.material = darkTitaniumMat;
    coil.parent = plungerRoot;
  }

  for (const z of [-1.55, 1.55]) {
    const bracket = CreateBox(`plunger-bracket-${z}`, { width: 1.05, height: 0.72, depth: 0.32 }, scene);
    bracket.position.z = z;
    bracket.material = railIvoryMat;
    bracket.parent = plungerRoot;
    shadowGenerator?.addShadowCaster(bracket);
  }

  // Satin steel ball stays bright without mirroring the entire environment.
  const ballRadius = 0.45;
  const ball = CreateSphere("photonic-ball", { diameter: ballRadius * 2, segments: 32 }, scene);
  ball.material = satinAlloyMat;
  ball.parent = tableRoot;
  shadowGenerator?.addShadowCaster(ball);

  const ballCoreLight = new PointLight("ball-core-light", Vector3.Zero(), scene);
  ballCoreLight.diffuse = new Color3(0.18, 0.68, 0.72);
  ballCoreLight.intensity = mobileTier ? 2 : 3.5;
  ballCoreLight.range = 4;
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
  let callout = "ORBITAL RELAY ONLINE — PULL PLUNGER TO LAUNCH";
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
  let coreCapture = createCoreCaptureState();

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
    coreCapture = createCoreCaptureState();
    audio.setVortex(false);
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
    callout = "BALL LAUNCHED — RELAY POWER ACTIVE";
    calloutTimer = 2;
  }

  function updatePhysics(dt: number) {
    if (phase !== "in_play" || !ballInPlay) return;
    elapsed += dt;

    // Gravity Acceleration down incline table
    const gravity = 29;
    ballVz -= gravity * dt;

    // The well captures once, releases once, then rearms only after the ball leaves its outer ring.
    const distToCore = Math.sqrt(ballX * ballX + (ballZ - 4.2) * (ballZ - 4.2));
    const coreStep = stepCoreCapture(coreCapture, distToCore, dt);
    coreCapture = coreStep.state;

    if (coreStep.captured) {
      audio.setVortex(true, 1);
      multiplier = Math.min(10, multiplier + 1);
      if (multiplier > maxMultiplier) maxMultiplier = multiplier;
      score += 15000 * multiplier;
      renderPlayfieldTexture(multiplier);
      cameraShake = 0.12;
      callout = `CORE CAPTURE ×${multiplier} [ +${(15000 * multiplier).toLocaleString()} PTS ]`;
      calloutTimer = 2.4;
    }

    if (coreStep.holding) {
      const angle = coreStep.holdProgress * Math.PI * 6;
      ballX = Math.cos(angle) * 0.75;
      ballZ = 4.2 + Math.sin(angle) * 0.75;
      ballVx = 0;
      ballVz = 0;
      if (coreStep.released) {
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
          const nx = dist > 0.001 ? dx / dist : 0;
          const nz = dist > 0.001 ? dz / dist : -1;
          const bounceSpeed = 28;
          ballVx = nx * bounceSpeed;
          ballVz = nz * bounceSpeed;
          ballX = b.x + nx * (b.radius + ballRadius + 0.05);
          ballZ = b.y + nz * (b.radius + ballRadius + 0.05);

          bumperHits += 1;
          const pts = 1000 * multiplier;
          score += pts;
          b.flashTimer = 0.28;
          cameraShake = 0.1;
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
        cameraShake = 0.08;
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
        cameraShake = 0.08;
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
            cameraShake = 0.14;
            callout = `LOGIC GATES CLEARED! OVERCLOCK ×${multiplier}`;
            calloutTimer = 2.8;
            setTimeout(() => {
              targets.forEach((tgt) => {
                tgt.dropped = false;
                tgt.mesh.position.y = 0.5;
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
        cameraShake = 0.06;
        audio.targetHit();
      } else if (ballX > 3.2 && ballX < 4.8 && ballVx > 0) {
        ballVx = -24;
        ballVz = 13;
        score += 500;
        cameraShake = 0.06;
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

    if (!reducedMotion) {
      coreRotorRoot.rotation.y += dt * 0.18;
    }

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
        b.light.intensity = mobileTier ? 5 : 9;
      } else {
        b.light.intensity = mobileTier ? 2.5 : 4;
      }
    });

    // Camera Shake Decay
    if (cameraShake > 0) {
      cameraShake = Math.max(0, cameraShake - dt * 1.8);
      camera.position.x = (Math.random() - 0.5) * cameraShake * 0.4;
      camera.position.y = 21.2 + (Math.random() - 0.5) * cameraShake * 0.4;
    } else {
      camera.position.x = 0;
      camera.position.y = 21.2;
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
      cameraShake = 0.12;
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
      cameraShake = 0.12;
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
