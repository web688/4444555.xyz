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

test("visual candidate exposes lifecycle cleanup and adaptive controls", async () => {
  const scene = await read("../apps/portal/src/games/gravity-courier/scene.ts");
  for (const capability of ["pause()", "resume()", "restart()", "destroy()", "prefers-reduced-motion", "pointerdown", "keydown"]) {
    assert.ok(scene.includes(capability), `missing ${capability}`);
  }
});
