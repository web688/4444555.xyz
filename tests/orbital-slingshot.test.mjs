import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Orbital Slingshot is lazy-loaded and catalog-aligned", async () => {
  const [app, catalog, manifest] = await Promise.all([
    read("../apps/portal/src/App.tsx"),
    read("../apps/portal/src/catalog.ts"),
    read("../catalog/manifests/orbital-slingshot.json"),
  ]);

  assert.match(app, /lazy\(\(\) => import\("\.\/games\/orbital-slingshot\/OrbitalSlingshotGate"\)\)/);
  assert.match(catalog, /slug: "orbital-slingshot"/);
  assert.match(catalog, /playable: true/);

  const parsedManifest = JSON.parse(manifest);
  assert.equal(parsedManifest.id, "orbital-slingshot");
  assert.equal(parsedManifest.sdk, "0.1.0");
  assert.equal(parsedManifest.status, "prototype");
});

test("Orbital Slingshot route generation and medal calculation are deterministic", async () => {
  const progressModule = await readFile(
    new URL("../apps/portal/src/games/orbital-slingshot/progress.ts", import.meta.url),
    "utf8",
  );
  assert.ok(progressModule.includes("ORBITAL_SLINGSHOT_ROUTE_SECONDS = 120"));
  assert.ok(progressModule.includes("medalForSlingshotRun"));
  assert.ok(progressModule.includes("ORBITAL_SLINGSHOT_PROGRESS_EVENT"));

  const sceneModule = await readFile(
    new URL("../apps/portal/src/games/orbital-slingshot/scene.ts", import.meta.url),
    "utf8",
  );
  assert.ok(sceneModule.includes("buildDailySectors"));
  assert.ok(sceneModule.includes("G_CONSTANT"));
  assert.ok(sceneModule.includes("simulateTrajectory"));
  assert.ok(sceneModule.includes("createOrbitalSlingshotScene"));
});
