import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Gravity Courier is lazy-loaded and version-aligned", async () => {
  const [app, portalPackage, manifest] = await Promise.all([
    read("../apps/portal/src/App.tsx"),
    read("../apps/portal/package.json"),
    read("../catalog/manifests/gravity-courier.json"),
  ]);
  assert.match(app, /lazy\(\(\) => import\("\.\/games\/gravity-courier\/GravityCourierGate"\)\)/);
  assert.equal(JSON.parse(portalPackage).dependencies["@babylonjs/core"], "9.20.0");
  assert.equal(JSON.parse(manifest).engine.version, "9.20.0");
  assert.equal(JSON.parse(manifest).version, "0.15.0");
  assert.equal(JSON.parse(manifest).status, "prototype");
});

test("production flight preserves accepted visuals and exposes a complete game loop", async () => {
  const [scene, gate, styles, progress] = await Promise.all([
    read("../apps/portal/src/games/gravity-courier/scene.ts"),
    read("../apps/portal/src/games/gravity-courier/GravityCourierGate.tsx"),
    read("../apps/portal/src/games/gravity-courier/gravity-courier.css"),
    read("../apps/portal/src/games/gravity-courier/progress.ts"),
  ]);
  for (const capability of ["start()", "pause()", "resume()", "restart()", "destroy()", "prefers-reduced-motion", "pointerdown", "keydown", "getGamepads", "lowFpsSeconds", "createRelayGate"]) {
    assert.ok(scene.includes(capability), `missing ${capability}`);
  }
  assert.match(scene, /scene\.fogMode = Scene\.FOGMODE_NONE/);
  assert.match(scene, /pipeline\.fxaaEnabled = false/);
  assert.match(scene, /ship\.position\.x \+ horizontal \* 1\.35/);
  assert.match(scene, /Math\.exp\(-delta \* 20\)/);
  assert.match(scene, /pressed\.clear\(\)/);
  assert.match(scene, /gamepadSteering/);
  assert.match(scene, /createDeepSpaceBackdrop/);
  assert.match(scene, /glow\?\.addExcludedMesh\(backdrop\)/);
  assert.match(scene, /starCount = mobileTier \? 520 : quality === "high" \? 1450 : 720/);
  assert.match(scene, /material\.emissiveColor = Color3\.Black\(\)/);
  assert.doesNotMatch(scene, /material\.emissiveColor = new Color3\(0\.92, 0\.96, 1\)/);
  assert.match(scene, /unlitMatte\(scene, "hazard-pbr-unlit-white", Color3\.White\(\)\)/);
  assert.match(scene, /material\.albedoColor = color/);
  assert.match(scene, /material\.metallic = 0/);
  assert.match(scene, /material\.roughness = 1/);
  assert.match(scene, /material\.unlit = true/);
  assert.doesNotMatch(scene, /hazard-unlit-matte-white/);
  assert.doesNotMatch(scene, /new Color3\(0\.34, 0\.36, 0\.4\), 0\.48, 0\.58/);
  assert.doesNotMatch(scene, /new Color3\(0\.12, 0\.1, 0\.09\), 0\.95, 0\.34/);
  assert.match(scene, /steerX: Scalar\.Clamp/);
  assert.match(gate, /courier-flight-vector/);
  assert.match(styles, /courier-flight-vector/);
  assert.match(scene, /const mobileTier = window\.matchMedia\("\(pointer: coarse\)"\)/);
  assert.match(scene, /engine\.setHardwareScalingLevel\(mobileTier \? 1/);
  assert.match(scene, /engine\.setHardwareScalingLevel\(1\.25\)/);
  assert.match(scene, /const glow = mobileTier \? null/);
  assert.match(scene, /const pipeline = mobileTier \? null/);
  assert.match(scene, /mobileTier \? 120 : 50/);
  assert.match(scene, /lane-connector-matte/);
  assert.match(scene, /light\.setEnabled\(!mobileTier\)/);
  assert.match(styles, /@media\(pointer:coarse\).*backdrop-filter:none/);
  for (const evidence of ["frameTimes", "buildReport()", "onePercentLowFps", "p95FrameMs", "p99FrameMs", "slowFramePercent", "deviceMemoryGb", "runNumber"]) {
    assert.ok(scene.includes(evidence), `missing evidence field ${evidence}`);
  }
  assert.match(scene, /GRAVITY_COURIER_ROUTE_SECONDS/);
  assert.match(scene, /failed = true/);
  assert.match(scene, /SECTOR_SECONDS/);
  assert.match(scene, /createSeededRandom/);
  assert.match(scene, /Math\.min\(12, multiplier \+ 1\)/);
  assert.match(gate, /recordCourierRun/);
  assert.match(gate, /courier-run-stats/);
  assert.match(gate, /Fly again/);
  assert.match(styles, /courier-medal/);
  assert.match(progress, /GRAVITY_COURIER_ROUTE_SECONDS = 120/);
  assert.match(progress, /MAX_RECENT_RUNS = 8/);
  assert.match(progress, /score >= 32_000 && integrity >= 2/);
  assert.match(progress, /GRAVITY_COURIER_PROGRESS_EVENT/);
  for (const cue of [
    'quality === "high" ? 280 : 140',
    'quality === "high" ? 72 : 34',
    'mobileTier ? 72 : quality === "high" ? 280 : 140',
    'mobileTier ? 18 : quality === "high" ? 72 : 34',
    'boost ? 1.12 : 1',
    'particles.maxSize = 0.052',
    'new Color4(0.62, 0.82, 1, 0.3)',
  ]) {
    assert.ok(scene.includes(cue), `missing restrained speed-cue setting ${cue}`);
  }
  assert.doesNotMatch(scene, /quality === "high" \? 420 : 190/);
});

test("Pages fallback contains true unlit obstacle correction 0.15", async () => {
  const [index, loader, ...parts] = await Promise.all([
    read("../index.html"),
    read("../assets/arcade-loader.js"),
    ...Array.from({ length: 5 }, (_, index) => read(`../assets/arcade.part${String(index).padStart(2, "0")}.b64`)),
  ]);
  const bundle = parts.map((part) => Buffer.from(part.trim(), "base64").toString("utf8")).join("");
  assert.match(index, /0\.15\.0/);
  assert.match(loader, /release = "0\.15\.0"/);
  assert.match(bundle, /PRODUCTION FLIGHT 01/);
  assert.match(bundle, /Deliver the signal/);
  assert.match(bundle, /LOCAL BEST/);
  assert.match(bundle, /MOBILE PERFORMANCE MODE/);
  assert.match(bundle, /hazard-pbr-unlit-white/);
  assert.match(bundle, /lane-connector-matte/);
});
