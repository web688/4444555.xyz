import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Echo Vector is lazy-loaded, preview-playable, and manifest-aligned", async () => {
  const [app, catalog, manifest] = await Promise.all([
    read("../apps/portal/src/App.tsx"),
    read("../apps/portal/src/catalog.ts"),
    read("../catalog/manifests/echo-vector.json"),
  ]);

  assert.match(app, /lazy\(\(\) => import\("\.\/games\/echo-vector\/EchoVectorGate"\)\)/);
  assert.match(catalog, /slug: "echo-vector"[\s\S]*?mode: "visual-gate"[\s\S]*?playable: true/);

  const parsedManifest = JSON.parse(manifest);
  assert.equal(parsedManifest.id, "echo-vector");
  assert.equal(parsedManifest.sdk, "0.1.0");
  assert.equal(parsedManifest.engine.name, "PixiJS");
  assert.equal(parsedManifest.sessions.targetSeconds, 180);
});

test("Echo Vector keeps simulation, tape, renderer, input, and lifecycle separated", async () => {
  const [rules, recording, game, renderer, input] = await Promise.all([
    read("../apps/portal/src/games/echo-vector/rules.ts"),
    read("../apps/portal/src/games/echo-vector/recording.ts"),
    read("../apps/portal/src/games/echo-vector/game.ts"),
    read("../apps/portal/src/games/echo-vector/renderer.ts"),
    read("../apps/portal/src/games/echo-vector/input.ts"),
  ]);
  assert.ok(rules.includes("stepEchoSimulation"));
  assert.ok(recording.includes("sampleEchoFrame"));
  assert.ok(game.includes("STEP_MS"));
  assert.ok(renderer.includes("pixi.js@8.18.1"));
  assert.ok(input.includes("gamepadPhaseHeld"));
});
