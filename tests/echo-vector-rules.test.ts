import assert from "node:assert/strict";
import test from "node:test";
import {
  ECHO_CYCLE_TICKS,
  createEchoSimulation,
  launchEchoSimulation,
  sampleEchoActor,
  stepEchoSimulation,
  type ActorSample,
  type InputFrame,
} from "../apps/portal/src/games/echo-vector/rules.ts";

function scriptedInput(tick: number): InputFrame {
  const segment = Math.floor(tick / 120) % 4;
  return {
    moveX: segment === 0 ? 1 : segment === 2 ? -1 : 0,
    moveY: segment === 1 ? 1 : segment === 3 ? -1 : 0,
    phasePressed: tick % 90 === 20,
  };
}

test("identical seed and input tape produce identical deterministic state", () => {
  const a = createEchoSimulation(12345);
  const b = createEchoSimulation(12345);
  launchEchoSimulation(a);
  launchEchoSimulation(b);

  for (let tick = 0; tick < 900; tick += 1) {
    const input = scriptedInput(tick);
    stepEchoSimulation(a, input);
    stepEchoSimulation(b, input);
  }

  assert.equal(a.player.x, b.player.x);
  assert.equal(a.player.y, b.player.y);
  assert.equal(a.score, b.score);
  assert.equal(a.coherence, b.coherence);
  assert.equal(a.chain, b.chain);
  assert.deepEqual(a.stats, b.stats);
});

test("echo tick N reproduces the recorded player state at tick N", () => {
  const state = createEchoSimulation(77);
  launchEchoSimulation(state);

  for (let tick = 0; tick < ECHO_CYCLE_TICKS; tick += 1) {
    stepEchoSimulation(state, scriptedInput(tick));
  }

  assert.equal(state.cycle, 2);
  assert.equal(state.tapes.length, 1);
  const tape = state.tapes[0];
  assert.ok(tape);
  const sample: ActorSample = { x: 0, y: 0, phase: false, echoIndex: -1 };
  for (const tick of [0, 37, 418, 911, 1433, 1799]) {
    state.tickInCycle = tick;
    assert.equal(sampleEchoActor(state, 0, sample), true);
    assert.equal(sample.x, tape.x[tick]);
    assert.equal(sample.y, tape.y[tick]);
    assert.equal(sample.phase, (tape.phase[tick] ?? 0) === 1);
  }
});

test("a completed 30-second cycle creates exactly one replay tape", () => {
  const state = createEchoSimulation(999);
  launchEchoSimulation(state);
  for (let tick = 0; tick < ECHO_CYCLE_TICKS; tick += 1) {
    stepEchoSimulation(state, { moveX: 0, moveY: 0, phasePressed: false });
  }
  assert.equal(state.cycle, 2);
  assert.equal(state.tapes.length, 1);
  assert.equal(state.tapes[0]?.length, ECHO_CYCLE_TICKS);
  assert.equal(state.tickInCycle, 0);
});
