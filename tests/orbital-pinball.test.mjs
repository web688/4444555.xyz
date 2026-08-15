import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

async function importTypeScriptModule(path) {
  const source = await read(path);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const encoded = Buffer.from(output).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

test("Orbital Pinball replaces Synapse Pinball in the lazy-loaded catalog", async () => {
  const [app, catalog, manifest] = await Promise.all([
    read("../apps/portal/src/App.tsx"),
    read("../apps/portal/src/catalog.ts"),
    read("../catalog/manifests/orbital-pinball.json"),
  ]);

  assert.match(app, /lazy\(\(\) => import\("\.\/games\/orbital-pinball\/OrbitalPinballGate"\)\)/);
  assert.match(catalog, /slug: "orbital-pinball"/);
  assert.match(catalog, /mode: "visual-gate"/);
  assert.match(catalog, /playable: true/);
  assert.doesNotMatch(app, /synapse-pinball/i);
  assert.doesNotMatch(catalog, /synapse-pinball/i);

  const parsedManifest = JSON.parse(manifest);
  assert.equal(parsedManifest.id, "orbital-pinball");
  assert.equal(parsedManifest.sdk, "0.1.0");
  assert.equal(parsedManifest.status, "prototype");
  assert.equal(parsedManifest.engine.name, "Babylon.js");
  assert.deepEqual(parsedManifest.input, ["keyboard", "touch", "gamepad"]);
});

test("Orbital Pinball starts with a fresh persistence namespace and score ladder", async () => {
  const progress = await importTypeScriptModule("../apps/portal/src/games/orbital-pinball/progress.ts");

  assert.equal(progress.ORBITAL_PINBALL_TARGET_SECONDS, 180);
  assert.equal(progress.medalForPinballRun(19_999, false), "none");
  assert.equal(progress.medalForPinballRun(20_000, false), "bronze");
  assert.equal(progress.medalForPinballRun(50_000, true), "silver");
  assert.equal(progress.medalForPinballRun(100_000, true), "gold");

  const empty = progress.emptyPinballProgress();
  assert.equal(empty.bestScore, 0);
  assert.equal(empty.totalRuns, 0);
  assert.deepEqual(empty.recentRuns, []);
});

test("Orbital Pinball scene is a new frameless relay field without center capture code", async () => {
  const scene = await read("../apps/portal/src/games/orbital-pinball/scene.ts");
  assert.match(scene, /floating-playfield/);
  assert.match(scene, /relay-orbit/);
  assert.match(scene, /AUTO NUDGE/);
  assert.match(scene, /setLeftFlipper/);
  assert.match(scene, /setRightFlipper/);
  assert.doesNotMatch(scene, /core-capture|CORE_HOLD_SECONDS|capture threshold/i);
});
