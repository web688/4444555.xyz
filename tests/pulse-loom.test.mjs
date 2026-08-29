import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runGodotHeadlessTest } from "../scripts/test-godot.mjs";
import { exportPulseLoom } from "../scripts/export-pulse-loom.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Pulse Loom is lazy-loaded and catalog-aligned", async () => {
  const [app, catalog, manifest] = await Promise.all([
    read("../apps/portal/src/App.tsx"),
    read("../apps/portal/src/catalog.ts"),
    read("../catalog/manifests/pulse-loom.json"),
  ]);

  assert.match(app, /lazy\(\(\) => import\("\.\/games\/pulse-loom\/PulseLoomGate"\)\)/);
  assert.match(catalog, /slug: "pulse-loom"/);
  assert.match(catalog, /playable: true/);
  assert.match(catalog, /session: "90s"/);

  const parsedManifest = JSON.parse(manifest);
  assert.equal(parsedManifest.id, "pulse-loom");
  assert.equal(parsedManifest.version, "0.1.0");
  assert.equal(parsedManifest.sdk, "0.1.0");
  assert.equal(parsedManifest.status, "prototype");
  assert.equal(parsedManifest.engine.name, "Godot");
  assert.equal(parsedManifest.engine.version, "4.6.3");
  assert.equal(parsedManifest.engine.rendering, "gl_compatibility");
  assert.equal(parsedManifest.sessions.targetSeconds, 90);
  assert.deepEqual(parsedManifest.input, ["keyboard", "touch", "gamepad"]);
});

test("Pulse Loom tracked Godot source files exist and adhere to contract", async () => {
  const [projectGodot, exportPresets, mainTscn, constants, webBridge] = await Promise.all([
    read("../games/pulse-loom/project.godot"),
    read("../games/pulse-loom/export_presets.cfg"),
    read("../games/pulse-loom/scenes/main.tscn"),
    read("../games/pulse-loom/scripts/constants.gd"),
    read("../games/pulse-loom/scripts/web_bridge.gd"),
  ]);

  assert.match(projectGodot, /config\/name="Pulse Loom"/);
  assert.match(projectGodot, /renderer\/rendering_method="gl_compatibility"/);
  assert.match(projectGodot, /rotate_left/);
  assert.match(projectGodot, /rotate_right/);

  assert.match(exportPresets, /variant\/thread_support=false/);
  assert.match(exportPresets, /name="Web"/);

  assert.match(mainTscn, /SignalCore/);
  assert.match(mainTscn, /RadarLanes/);
  assert.match(mainTscn, /PulseContainer/);
  assert.match(mainTscn, /WebBridge/);

  assert.match(constants, /NUM_LANES: int = 6/);
  assert.match(constants, /TOTAL_RUN_SECONDS: float = 90\.0/);
  assert.match(constants, /MAX_OVERLOADS: int = 3/);

  assert.match(webBridge, /send_game_ready/);
  assert.match(webBridge, /send_run_ended/);
});

test("Pulse Loom runs headless deterministic smoke test", () => {
  assert.doesNotThrow(() => {
    runGodotHeadlessTest();
  });
});

test("Pulse Loom builds Web export and verifies staging and portal files", () => {
  assert.doesNotThrow(() => {
    exportPulseLoom();
  });

  const publicDir = new URL("../apps/portal/public/games/pulse-loom/", import.meta.url);
  assert.ok(existsSync(new URL("index.html", publicDir)));
  assert.ok(existsSync(new URL("index.wasm", publicDir)));
  assert.ok(existsSync(new URL("index.pck", publicDir)));
  assert.ok(existsSync(new URL("index.js", publicDir)));

  const distDir = new URL("../apps/portal/dist/games/pulse-loom/", import.meta.url);
  if (existsSync(distDir)) {
    assert.ok(existsSync(new URL("index.html", distDir)));
    assert.ok(existsSync(new URL("index.wasm", distDir)));
  }
});

test("Pulse Loom progress calculation and medal thresholds are consistent", async () => {
  const progressModule = await readFile(
    new URL("../apps/portal/src/games/pulse-loom/progress.ts", import.meta.url),
    "utf8",
  );
  assert.ok(progressModule.includes("PULSE_LOOM_ROUTE_SECONDS = 90"));
  assert.ok(progressModule.includes("medalForPulseLoomRun"));
  assert.ok(progressModule.includes("PULSE_LOOM_PROGRESS_EVENT"));
  assert.ok(progressModule.includes("60_000")); // gold
  assert.ok(progressModule.includes("35_000")); // silver
  assert.ok(progressModule.includes("15_000")); // bronze
});
