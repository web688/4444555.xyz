import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runGodotHeadlessTest } from "../scripts/test-godot.mjs";
import { exportPulseLoom } from "../scripts/export-pulse-loom.mjs";
import {
  medalForPulseLoomRun,
  createEmptyPulseLoomProgress,
} from "../apps/portal/src/games/pulse-loom/progress.ts";
import {
  createPulseLoomRunTicket,
  validateScoreClaim,
  validateIncomingMessage,
} from "../apps/portal/src/games/pulse-loom/host.ts";

test("Pulse Loom manifest metadata is valid and aligned with SDK contract", async () => {
  const rawManifest = await readFile(
    new URL("../catalog/manifests/pulse-loom.json", import.meta.url),
    "utf8",
  );
  const manifest = JSON.parse(rawManifest);

  assert.equal(manifest.id, "pulse-loom");
  assert.equal(manifest.version, "0.1.0");
  assert.equal(manifest.sdk, "0.1.0");
  assert.equal(manifest.status, "prototype");
  assert.equal(manifest.engine.name, "Godot");
  assert.equal(manifest.engine.version, "4.6.3");
  assert.equal(manifest.engine.rendering, "gl_compatibility");
  assert.equal(manifest.sessions.targetSeconds, 90);
  assert.deepEqual(manifest.input, ["keyboard", "touch", "gamepad"]);
});

test("Pulse Loom progress calculation and medal thresholds behave correctly", () => {
  // Gold threshold: >= 60,000
  assert.equal(medalForPulseLoomRun(75_000, true), "gold");
  assert.equal(medalForPulseLoomRun(60_000, true), "gold");

  // Silver threshold: 35,000 - 59,999
  assert.equal(medalForPulseLoomRun(59_999, true), "silver");
  assert.equal(medalForPulseLoomRun(35_000, true), "silver");

  // Bronze threshold: 15,000 - 34,999
  assert.equal(medalForPulseLoomRun(34_999, true), "bronze");
  assert.equal(medalForPulseLoomRun(15_000, true), "bronze");

  // Below bronze: < 15,000
  assert.equal(medalForPulseLoomRun(14_999, true), "none");
  assert.equal(medalForPulseLoomRun(0, true), "none");

  // Failed run behavior
  assert.equal(medalForPulseLoomRun(65_000, false), "gold");
  assert.equal(medalForPulseLoomRun(10_000, false), "none");

  // Initial progress baseline
  const empty = createEmptyPulseLoomProgress();
  assert.equal(empty.schemaVersion, 1);
  assert.equal(empty.bestScore, 0);
  assert.equal(empty.totalRuns, 0);
  assert.equal(empty.completions, 0);
  assert.deepEqual(empty.recentRuns, []);
});

test("Pulse Loom SDK host boundary, run ticket, and score claim validation behave correctly", () => {
  // Test run ticket creation
  const ticket = createPulseLoomRunTicket(2026);
  assert.equal(ticket.gameId, "pulse-loom");
  assert.equal(ticket.gameVersion, "0.1.0");
  assert.equal(ticket.ruleset, "conduit-v1");
  assert.equal(ticket.seed, "2026");
  assert.ok(ticket.id.startsWith("run-pl-"));
  assert.ok(ticket.signature.startsWith("sig_pl_"));
  assert.ok(new Date(ticket.issuedAt).getTime() > 0);
  assert.ok(new Date(ticket.expiresAt).getTime() > new Date(ticket.issuedAt).getTime());

  // Test valid score claim
  const validClaim = {
    runTicketId: ticket.id,
    score: 42000,
    durationMs: 88500,
    endedAt: new Date().toISOString(),
    stats: {
      routesCompleted: 24,
      perfectRoutes: 12,
      maxMultiplier: 7,
      overloads: 1,
      completed: 1,
    },
  };
  const validResult = validateScoreClaim(ticket, validClaim);
  assert.equal(validResult.valid, true);

  // Test invalid score claims (ticket mismatch, negative score, non-integer score, overloads > 3, duration > 120s)
  assert.equal(validateScoreClaim(ticket, { ...validClaim, runTicketId: "wrong-id" }).valid, false);
  assert.equal(validateScoreClaim(ticket, { ...validClaim, score: -500 }).valid, false);
  assert.equal(validateScoreClaim(ticket, { ...validClaim, score: 123.45 }).valid, false);
  assert.equal(validateScoreClaim(ticket, { ...validClaim, durationMs: 150_000 }).valid, false);
  assert.equal(validateScoreClaim(ticket, { ...validClaim, stats: { ...validClaim.stats, overloads: 4 } }).valid, false);

  // Test incoming message parser and validator
  const mockWindow = {};
  const gameReadyEvent = {
    source: mockWindow,
    origin: "http://localhost:5173",
    data: { type: "GAME_READY", game: "pulse-loom", version: "0.1.0", sdk: "0.1.0", engine: "Godot 4.6.3" },
  };
  const parsedReady = validateIncomingMessage(gameReadyEvent, mockWindow);
  assert.ok(parsedReady);
  assert.equal(parsedReady?.type, "GAME_READY");

  const telemetryEvent = {
    source: mockWindow,
    origin: "http://localhost:5173",
    data: {
      type: "TELEMETRY",
      data: {
        score: 1500,
        multiplier: 3,
        maxMultiplier: 3,
        overloads: 0,
        maxOverloads: 3,
        timeRemaining: 82.5,
        stage: 1,
        routesCompleted: 4,
        perfectRoutes: 2,
        fps: 60,
      },
    },
  };
  const parsedTelemetry = validateIncomingMessage(telemetryEvent, mockWindow);
  assert.ok(parsedTelemetry);
  assert.equal(parsedTelemetry?.type, "TELEMETRY");

  // Rejects invalid source window or unknown payload
  assert.equal(validateIncomingMessage(gameReadyEvent, {}), null);
  assert.equal(
    validateIncomingMessage({ source: mockWindow, origin: "http://localhost:5173", data: { type: "UNKNOWN" } }, mockWindow),
    null
  );
});

test("Pulse Loom tracked Godot project files and scenes exist on disk", () => {
  const files = [
    "../games/pulse-loom/project.godot",
    "../games/pulse-loom/export_presets.cfg",
    "../games/pulse-loom/scenes/main.tscn",
    "../games/pulse-loom/scripts/constants.gd",
    "../games/pulse-loom/scripts/game_manager.gd",
    "../games/pulse-loom/scripts/web_bridge.gd",
    "../games/pulse-loom/scripts/signal_core.gd",
    "../games/pulse-loom/scripts/pulse.gd",
    "../games/pulse-loom/scripts/radar_lanes.gd",
    "../games/pulse-loom/scripts/audio_synth.gd",
    "../games/pulse-loom/scripts/headless_smoke_test.gd",
  ];

  for (const rel of files) {
    const fullUrl = new URL(rel, import.meta.url);
    assert.ok(existsSync(fullUrl), `Expected tracked file missing: ${rel}`);
  }
});

test("Pulse Loom runs headless deterministic smoke test", () => {
  assert.doesNotThrow(() => {
    runGodotHeadlessTest();
  });
});

test("Pulse Loom builds single-threaded Web export and produces all required artifacts", () => {
  assert.doesNotThrow(() => {
    exportPulseLoom();
  });

  const publicDir = new URL("../apps/portal/public/games/pulse-loom/", import.meta.url);
  for (const artifact of ["index.html", "index.js", "index.wasm", "index.pck"]) {
    const fileUrl = new URL(artifact, publicDir);
    assert.ok(existsSync(fileUrl), `Expected export artifact missing: ${artifact}`);
    const stat = statSync(fileUrl);
    assert.ok(stat.size > 0, `Export artifact ${artifact} is empty (0 bytes)`);
  }
});
