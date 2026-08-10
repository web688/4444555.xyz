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
  assert.match(scene, /scene\.fogStart = 140/);
  assert.match(scene, /steerX: Scalar\.Clamp/);
  assert.match(gate, /courier-flight-vector/);
  assert.match(styles, /courier-flight-vector/);
});
