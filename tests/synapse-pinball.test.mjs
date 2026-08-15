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

});

test("the center core releases once and cannot immediately recapture the ball", async () => {
  const {
    CORE_HOLD_SECONDS,
    CORE_REARM_RADIUS,
    createCoreCaptureState,
    stepCoreCapture,
  } = await importTypeScriptModule(
    "../apps/portal/src/games/synapse-pinball/core-capture.ts",
  );

  let state = createCoreCaptureState();
  const firstEntry = stepCoreCapture(state, 1, 1 / 60);
  state = firstEntry.state;
  assert.equal(firstEntry.captured, true);
  assert.equal(firstEntry.holding, true);

  let release;
  for (let elapsed = 1 / 60; elapsed <= CORE_HOLD_SECONDS + 1 / 60; elapsed += 1 / 60) {
    release = stepCoreCapture(state, 0.75, 1 / 60);
    state = release.state;
    if (release.released) break;
  }

  assert.equal(release?.released, true);
  assert.equal(state.armed, false);
  assert.equal(state.holdRemaining, 0);

  const stillInside = stepCoreCapture(state, 0.75, 1 / 60);
  assert.equal(stillInside.captured, false);
  assert.equal(stillInside.holding, false);

  const outside = stepCoreCapture(stillInside.state, CORE_REARM_RADIUS + 0.1, 1 / 60);
  assert.equal(outside.state.armed, true);
  assert.equal(outside.captured, false);

  const laterReentry = stepCoreCapture(outside.state, 1, 1 / 60);
  assert.equal(laterReentry.captured, true);
});
