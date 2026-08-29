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
  createPulseLoomHost,
  createPulseLoomRunTicket,
  validateScoreClaim,
  validateIncomingMessage,
  sendPostMessageToGodot,
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

test("Pulse Loom GameHost maintains stable lifecycle and active ticket across settings updates", async () => {
  let exitReason = "";
  let acceptedClaim = null;
  const host = createPulseLoomHost({
    muted: false,
    reducedMotion: false,
    onExit: (reason) => {
      exitReason = reason;
    },
    onScoreClaimAccepted: (claim) => {
      acceptedClaim = claim;
    },
  });

  assert.equal(host.settings.audio.muted, false);
  assert.equal(host.settings.accessibility.reducedMotion, false);

  // Request run ticket
  const ticket = await host.requestRun();
  assert.ok(ticket.id.startsWith("run-pl-"));
  assert.equal(host.getActiveTicket()?.id, ticket.id);

  // Update settings (mute toggle, reduced motion toggle)
  host.updateSettings({ muted: true, reducedMotion: true });
  assert.equal(host.settings.audio.muted, true);
  assert.equal(host.settings.accessibility.reducedMotion, true);

  // Ticket must still remain active and unmodified
  assert.equal(host.getActiveTicket()?.id, ticket.id);

  // Submit score claim using active ticket
  const claim = {
    runTicketId: ticket.id,
    score: 55000,
    durationMs: 90000,
    endedAt: new Date().toISOString(),
    stats: {
      routesCompleted: 30,
      perfectRoutes: 20,
      maxMultiplier: 8,
      overloads: 1,
      completed: 1,
    },
  };

  const res = await host.submitScore(claim);
  assert.equal(res.accepted, true);
  assert.ok(acceptedClaim);
  assert.equal(acceptedClaim.runTicketId, ticket.id);

  host.exit("player");
  assert.equal(exitReason, "player");
});

test("Pulse Loom SDK RunTicket schema and ScoreClaim validation enforce contract end-to-end", () => {
  // Test run ticket creation
  const ticket = createPulseLoomRunTicket(2026);
  assert.equal(ticket.gameId, "pulse-loom");
  assert.equal(ticket.gameVersion, "0.1.0");
  assert.equal(ticket.ruleset, "conduit-v1");
  assert.equal(ticket.seed, "2026");
  assert.equal(ticket.signature, "local-unverified");
  assert.ok(ticket.id.startsWith("run-pl-"));
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

  // Test expired ticket rejection
  const expiredTicket = {
    ...ticket,
    expiresAt: new Date(Date.now() - 5000).toISOString(),
  };
  assert.equal(validateScoreClaim(expiredTicket, validClaim).valid, false);

  // Test claim ended after ticket expiry rejection
  const lateClaim = {
    ...validClaim,
    endedAt: new Date(Date.now() + 600_000).toISOString(),
  };
  assert.equal(validateScoreClaim(ticket, lateClaim).valid, false);

  // Test invalid score claims (ticket mismatch, negative score, non-integer score, overloads > 3, duration > 120s)
  assert.equal(validateScoreClaim(ticket, { ...validClaim, runTicketId: "wrong-id" }).valid, false);
  assert.equal(validateScoreClaim(ticket, { ...validClaim, score: -500 }).valid, false);
  assert.equal(validateScoreClaim(ticket, { ...validClaim, score: 123.45 }).valid, false);
  assert.equal(validateScoreClaim(ticket, { ...validClaim, durationMs: 150_000 }).valid, false);
  assert.equal(validateScoreClaim(ticket, { ...validClaim, stats: { ...validClaim.stats, overloads: 4 } }).valid, false);
  assert.equal(validateScoreClaim(ticket, { ...validClaim, stats: { ...validClaim.stats, maxMultiplier: 15 } }).valid, false);
});

test("Pulse Loom postMessage communication enforces exact same-origin and forbids wildcard", () => {
  const mockContentWindow = {
    postMessage(msg, targetOrigin) {
      this.lastMsg = msg;
      this.lastOrigin = targetOrigin;
    },
  };

  // Successful send with valid target origin
  sendPostMessageToGodot(mockContentWindow, { type: "RESUME" }, "http://localhost:5173");
  assert.equal(mockContentWindow.lastOrigin, "http://localhost:5173");
  assert.deepEqual(mockContentWindow.lastMsg, { type: "RESUME" });

  // Forbids wildcard '*' origin
  assert.throws(() => {
    sendPostMessageToGodot(mockContentWindow, { type: "RESUME" }, "*");
  }, /exact non-wildcard target origin/);

  // Forbids empty origin
  assert.throws(() => {
    sendPostMessageToGodot(mockContentWindow, { type: "RESUME" }, "");
  }, /exact non-wildcard target origin/);

  // Forbids 'null' origin
  assert.throws(() => {
    sendPostMessageToGodot(mockContentWindow, { type: "RESUME" }, "null");
  }, /exact non-wildcard target origin/);
});

test("Pulse Loom incoming message validation enforces exact origin and rejects cross-origin/opaque messages", () => {
  const mockWindow = {};
  const validOrigin = "http://localhost:5173";

  const validReadyEvent = {
    source: mockWindow,
    origin: validOrigin,
    data: { type: "GAME_READY", game: "pulse-loom", version: "0.1.0", sdk: "0.1.0", engine: "Godot 4.6.3" },
  };

  // Valid origin and window -> PASS
  const parsed = validateIncomingMessage(validReadyEvent, mockWindow, validOrigin);
  assert.ok(parsed);
  assert.equal(parsed?.type, "GAME_READY");

  // Origin mismatch -> REJECT (null)
  assert.equal(
    validateIncomingMessage(validReadyEvent, mockWindow, "https://evil.com"),
    null
  );
  assert.equal(
    validateIncomingMessage({ ...validReadyEvent, origin: "https://evil.com" }, mockWindow, validOrigin),
    null
  );

  // Missing, null, 'null', or '*' origin -> REJECT
  assert.equal(validateIncomingMessage({ ...validReadyEvent, origin: "" }, mockWindow, validOrigin), null);
  assert.equal(validateIncomingMessage({ ...validReadyEvent, origin: "null" }, mockWindow, validOrigin), null);
  assert.equal(validateIncomingMessage({ ...validReadyEvent, origin: "*" }, mockWindow, validOrigin), null);

  // Source window mismatch -> REJECT
  const otherWindow = {};
  assert.equal(validateIncomingMessage(validReadyEvent, otherWindow, validOrigin), null);
});

test("Pulse Loom strictly validates payload schemas and rejects malformed payloads without coercion", () => {
  const mockWindow = {};
  const origin = "http://localhost:5173";

  // Arrays must be rejected
  assert.equal(
    validateIncomingMessage({ source: mockWindow, origin, data: ["malicious", "array"] }, mockWindow, origin),
    null
  );

  // Wrong GAME_READY parameters
  assert.equal(
    validateIncomingMessage(
      { source: mockWindow, origin, data: { type: "GAME_READY", game: "other", version: "0.1.0", sdk: "0.1.0" } },
      mockWindow,
      origin
    ),
    null
  );
  assert.equal(
    validateIncomingMessage(
      { source: mockWindow, origin, data: { type: "GAME_READY", game: "pulse-loom", version: "0.2.0", sdk: "0.1.0" } },
      mockWindow,
      origin
    ),
    null
  );
  assert.equal(
    validateIncomingMessage(
      { source: mockWindow, origin, data: { type: "GAME_READY", game: "pulse-loom", version: "0.1.0", sdk: "0.2.0" } },
      mockWindow,
      origin
    ),
    null
  );

  // Invalid STATE_CHANGE
  assert.equal(
    validateIncomingMessage(
      { source: mockWindow, origin, data: { type: "STATE_CHANGE", state: "invalid_state" } },
      mockWindow,
      origin
    ),
    null
  );

  // Valid TELEMETRY
  const validTelemetry = {
    type: "TELEMETRY",
    data: {
      score: 1500,
      multiplier: 3,
      maxMultiplier: 3,
      overloads: 1,
      maxOverloads: 3,
      timeRemaining: 82.5,
      stage: 1,
      routesCompleted: 4,
      perfectRoutes: 2,
      fps: 60,
    },
  };
  assert.ok(
    validateIncomingMessage({ source: mockWindow, origin, data: validTelemetry }, mockWindow, origin)
  );

  // Malformed TELEMETRY (string numbers, negative, overloads > 3, invalid stage)
  assert.equal(
    validateIncomingMessage(
      { source: mockWindow, origin, data: { type: "TELEMETRY", data: { ...validTelemetry.data, score: "1500" } } },
      mockWindow,
      origin
    ),
    null
  );
  assert.equal(
    validateIncomingMessage(
      { source: mockWindow, origin, data: { type: "TELEMETRY", data: { ...validTelemetry.data, overloads: 4 } } },
      mockWindow,
      origin
    ),
    null
  );
  assert.equal(
    validateIncomingMessage(
      { source: mockWindow, origin, data: { type: "TELEMETRY", data: { ...validTelemetry.data, stage: 5 } } },
      mockWindow,
      origin
    ),
    null
  );

  // Valid RUN_ENDED
  const validRunEnded = {
    type: "RUN_ENDED",
    data: {
      ticketId: "run-pl-12345-abcde",
      outcome: "complete",
      score: 45000,
      durationSeconds: 90,
      routesCompleted: 20,
      perfectRoutes: 10,
      maxMultiplier: 6,
      overloads: 0,
      medal: "silver",
    },
  };
  const parsedRunEnded = validateIncomingMessage(
    { source: mockWindow, origin, data: validRunEnded },
    mockWindow,
    origin
  );
  assert.ok(parsedRunEnded);
  assert.equal(parsedRunEnded?.type, "RUN_ENDED");

  // Malformed RUN_ENDED (bad ticketId prefix, bad outcome, non-integer score, bad medal)
  assert.equal(
    validateIncomingMessage(
      { source: mockWindow, origin, data: { type: "RUN_ENDED", data: { ...validRunEnded.data, ticketId: "bad-ticket" } } },
      mockWindow,
      origin
    ),
    null
  );
  assert.equal(
    validateIncomingMessage(
      { source: mockWindow, origin, data: { type: "RUN_ENDED", data: { ...validRunEnded.data, outcome: "unknown" } } },
      mockWindow,
      origin
    ),
    null
  );
  assert.equal(
    validateIncomingMessage(
      { source: mockWindow, origin, data: { type: "RUN_ENDED", data: { ...validRunEnded.data, score: 45000.5 } } },
      mockWindow,
      origin
    ),
    null
  );
  assert.equal(
    validateIncomingMessage(
      { source: mockWindow, origin, data: { type: "RUN_ENDED", data: { ...validRunEnded.data, medal: "platinum" } } },
      mockWindow,
      origin
    ),
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
