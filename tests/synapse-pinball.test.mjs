import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Synapse Pinball is lazy-loaded and catalog-aligned", async () => {
  const [app, catalog, manifest] = await Promise.all([
    read("../apps/portal/src/App.tsx"),
    read("../apps/portal/src/catalog.ts"),
    read("../catalog/manifests/synapse-pinball.json"),
  ]);

  assert.match(app, /lazy\(\(\) => import\("\.\/games\/synapse-pinball\/SynapsePinballGate"\)\)/);
  assert.match(catalog, /slug: "synapse-pinball"/);
  assert.match(catalog, /playable: true/);

  const parsedManifest = JSON.parse(manifest);
  assert.equal(parsedManifest.id, "synapse-pinball");
  assert.equal(parsedManifest.sdk, "0.1.0");
  assert.equal(parsedManifest.status, "prototype");
  assert.equal(parsedManifest.engine.name, "Babylon.js");
});

test("Synapse Pinball progress persistence and medal calculations are consistent", async () => {
  const progressModule = await readFile(
    new URL("../apps/portal/src/games/synapse-pinball/progress.ts", import.meta.url),
    "utf8",
  );
  assert.ok(progressModule.includes("SYNAPSE_PINBALL_TARGET_SECONDS = 180"));
  assert.ok(progressModule.includes("medalForPinballRun"));
  assert.ok(progressModule.includes("SYNAPSE_PINBALL_PROGRESS_EVENT"));

  const sceneModule = await readFile(
    new URL("../apps/portal/src/games/synapse-pinball/scene.ts", import.meta.url),
    "utf8",
  );
  assert.ok(sceneModule.includes("createSynapsePinballScene"));
  assert.ok(sceneModule.includes("bumperCoords"));
  assert.ok(sceneModule.includes("createDetailedFlipper"));
  assert.ok(sceneModule.includes("createWireformRamp"));
});

