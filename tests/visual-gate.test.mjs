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
  assert.equal(JSON.parse(manifest).version, "0.11.0");
});

test("visual candidate exposes lifecycle cleanup, clear depth and adaptive controls", async () => {
  const [scene, gate, styles] = await Promise.all([
    read("../apps/portal/src/games/gravity-courier/scene.ts"),
    read("../apps/portal/src/games/gravity-courier/GravityCourierGate.tsx"),
    read("../apps/portal/src/games/gravity-courier/gravity-courier.css"),
  ]);
  for (const capability of ["pause()", "resume()", "restart()", "destroy()", "prefers-reduced-motion", "pointerdown", "keydown", "getGamepads", "lowFpsSeconds", "createRelayGate"]) {
    assert.ok(scene.includes(capability), `missing ${capability}`);
  }
  assert.match(scene, /scene\.fogMode = Scene\.FOGMODE_NONE/);
  assert.match(scene, /pipeline\.fxaaEnabled = false/);
  assert.match(scene, /ship\.position\.x \+ horizontal \* 1\.35/);
  assert.match(scene, /Math\.exp\(-delta \* 20\)/);
  assert.match(scene, /pressed\.clear\(\)/);
  assert.match(scene, /gamepadSteering/);
  assert.match(scene, /createDeepSpaceBackdrop/);
  assert.match(scene, /glow\.addExcludedMesh\(backdrop\)/);
  assert.match(scene, /starCount = quality === "high" \? 1450 : 720/);
  assert.match(scene, /material\.emissiveColor = Color3\.Black\(\)/);
  assert.doesNotMatch(scene, /material\.emissiveColor = new Color3\(0\.92, 0\.96, 1\)/);
  assert.match(scene, /new Color3\(0\.34, 0\.36, 0\.4\), 0\.48, 0\.58/);
  assert.doesNotMatch(scene, /new Color3\(0\.12, 0\.1, 0\.09\), 0\.95, 0\.34/);
  assert.match(scene, /steerX: Scalar\.Clamp/);
  assert.match(gate, /courier-flight-vector/);
  assert.match(styles, /courier-flight-vector/);
  for (const evidence of ["frameTimes", "buildReport()", "onePercentLowFps", "p95FrameMs", "p99FrameMs", "slowFramePercent", "deviceMemoryGb", "runNumber"]) {
    assert.ok(scene.includes(evidence), `missing evidence field ${evidence}`);
  }
  assert.match(gate, /courier-review-report/);
  assert.match(styles, /courier-review-report/);
  for (const cue of [
    'quality === "high" ? 280 : 140',
    'quality === "high" ? 72 : 34',
    'boost ? 1.12 : 1',
    'particles.maxSize = 0.052',
    'new Color4(0.62, 0.82, 1, 0.3)',
  ]) {
    assert.ok(scene.includes(cue), `missing restrained speed-cue setting ${cue}`);
  }
  assert.doesNotMatch(scene, /quality === "high" \? 420 : 190/);
});

test("Pages fallback contains candidate 0.11 evidence UI", async () => {
  const [index, loader, ...parts] = await Promise.all([
    read("../index.html"),
    read("../assets/arcade-loader.js"),
    ...Array.from({ length: 5 }, (_, index) => read(`../assets/arcade.part${String(index).padStart(2, "0")}.b64`)),
  ]);
  const bundle = parts.map((part) => Buffer.from(part.trim(), "base64").toString("utf8")).join("");
  assert.match(index, /0\.11\.0/);
  assert.match(loader, /release = "0\.11\.0"/);
  assert.match(bundle, /RUN EVIDENCE/);
  assert.match(bundle, /Visual gate performance report/);
});
