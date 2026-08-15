import { createEchoAudio } from "./audio.ts";
import { createEchoInput } from "./input.ts";
import { createEchoRenderer } from "./renderer.ts";
import {
  ECHO_CYCLE_SECONDS,
  ECHO_TOTAL_CYCLES,
  createEchoSimulation,
  getBeatPulse,
  getEchoEfficiency,
  getNodeCue,
  getSecondsRemaining,
  launchEchoSimulation,
  stepEchoSimulation,
  type EchoSimulation,
  type SimulationEvent,
} from "./rules.ts";

export type EchoRuntimePhase = "ready" | "running" | "paused" | "complete" | "failed";

export type EchoTelemetry = {
  phase: EchoRuntimePhase;
  cycle: number;
  totalCycles: number;
  cycleSeconds: number;
  remaining: number;
  score: number;
  coherence: number;
  chain: number;
  echoes: number;
  phaseReady: boolean;
  cue: string;
  callout: string;
  nodeActivations: number;
  echoAssists: number;
  confluences: number;
  duets: number;
  trios: number;
  choruses: number;
  collisions: number;
  maxChain: number;
  echoEfficiency: number;
};

export type EchoVectorRuntime = {
  launch: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  setMuted: (muted: boolean) => void;
  setVirtualMove: (x: number, y: number) => void;
  clearVirtualMove: () => void;
  pressPhase: () => void;
  destroy: () => void;
};

const STEP_MS = 1000 / 60;

function calloutForEvents(events: readonly SimulationEvent[], cycle: number): string | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event) continue;
    if (event.type === "confluence") {
      if (event.actorCount >= 4) return "CHORUS CONFLUENCE";
      if (event.actorCount === 3) return "TRIO CONFLUENCE";
      return "DUET CONFLUENCE";
    }
    if (event.type === "node") return event.echoOnly ? "ECHO ASSIST" : "RESONANCE LOCK";
    if (event.type === "collision") return "COHERENCE FRACTURE";
    if (event.type === "cycle") return `ECHO ${Math.max(1, cycle - 1)} COMMITTED`;
    if (event.type === "complete") return "SEQUENCE RESOLVED";
    if (event.type === "failed") return "TEMPORAL INTEGRITY LOST";
  }
  return null;
}

function cueLabel(state: EchoSimulation): string {
  const ready: number[] = [];
  for (const node of state.nodes) {
    if (getNodeCue(state, node.id).ready) ready.push(node.id + 1);
  }
  if (ready.length === 0) return "LISTEN FOR THE NEXT WAKE";
  if (ready.length === 1) return `NODE ${ready[0]} READY`;
  return `NODES ${ready.join(" · ")} READY`;
}

function telemetryFrom(state: EchoSimulation, paused: boolean, callout: string): EchoTelemetry {
  const phase: EchoRuntimePhase = paused && state.phase === "running" ? "paused" : state.phase;
  return {
    phase,
    cycle: state.cycle,
    totalCycles: ECHO_TOTAL_CYCLES,
    cycleSeconds: ECHO_CYCLE_SECONDS,
    remaining: getSecondsRemaining(state),
    score: state.score,
    coherence: state.coherence,
    chain: state.chain,
    echoes: state.tapes.length,
    phaseReady: state.player.phaseCooldown <= 0,
    cue: cueLabel(state),
    callout,
    nodeActivations: state.stats.nodeActivations,
    echoAssists: state.stats.echoAssists,
    confluences: state.stats.confluences,
    duets: state.stats.duets,
    trios: state.stats.trios,
    choruses: state.stats.choruses,
    collisions: state.stats.collisions,
    maxChain: state.stats.maxChain,
    echoEfficiency: getEchoEfficiency(state),
  };
}

export async function createEchoVectorGame(
  canvas: HTMLCanvasElement,
  onTelemetry: (telemetry: EchoTelemetry) => void,
): Promise<EchoVectorRuntime> {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = await createEchoRenderer(canvas, reducedMotion);
  const input = createEchoInput(canvas);
  const audio = createEchoAudio();
  let state = createEchoSimulation(4_444_555);
  let paused = false;
  let autoPaused = false;
  let destroyed = false;
  let frameId = 0;
  let accumulator = 0;
  let lastFrameTime = performance.now();
  let lastTelemetryTime = 0;
  let callout = "BUILD A ROUTE YOUR FUTURE SELF CAN USE";
  let calloutTicks = 180;
  let lastBeatTick = -1;

  const publish = (force = false) => {
    const now = performance.now();
    if (!force && now - lastTelemetryTime < 90) return;
    lastTelemetryTime = now;
    onTelemetry(telemetryFrom(state, paused, calloutTicks > 0 ? callout : ""));
  };

  const processEvents = () => {
    audio.handleEvents(state.events);
    const nextCallout = calloutForEvents(state.events, state.cycle);
    if (nextCallout) {
      callout = nextCallout;
      calloutTicks = 110;
    }
  };

  const tick = () => {
    const frame = input.readFrame(state.player.x, state.player.y);
    stepEchoSimulation(state, frame);
    processEvents();
    const beatTick = Math.floor(state.totalTicks / 45);
    if (beatTick !== lastBeatTick && getBeatPulse(state) > 0.9) {
      lastBeatTick = beatTick;
      audio.beat(1);
    }
    if (calloutTicks > 0) calloutTicks -= 1;
  };

  const animate = (now: number) => {
    if (destroyed) return;
    const delta = Math.min(100, Math.max(0, now - lastFrameTime));
    lastFrameTime = now;

    if (!paused && state.phase === "running") {
      accumulator += delta;
      while (accumulator >= STEP_MS) {
        tick();
        accumulator -= STEP_MS;
      }
    } else {
      accumulator = 0;
    }

    renderer.render(state);
    publish();
    frameId = requestAnimationFrame(animate);
  };

  const onVisibility = () => {
    if (document.hidden && state.phase === "running" && !paused) {
      paused = true;
      autoPaused = true;
      publish(true);
    } else if (!document.hidden && autoPaused && state.phase === "running") {
      autoPaused = false;
      paused = false;
      lastFrameTime = performance.now();
      publish(true);
    }
  };

  document.addEventListener("visibilitychange", onVisibility);
  renderer.render(state);
  publish(true);
  frameId = requestAnimationFrame(animate);

  return {
    launch() {
      if (state.phase !== "ready") return;
      launchEchoSimulation(state);
      void audio.resume();
      callout = "CYCLE 1 · AUTHOR THE FIRST ECHO";
      calloutTicks = 150;
      paused = false;
      lastFrameTime = performance.now();
      publish(true);
    },
    pause() {
      if (state.phase !== "running") return;
      paused = true;
      autoPaused = false;
      publish(true);
    },
    resume() {
      if (state.phase !== "running") return;
      paused = false;
      autoPaused = false;
      lastFrameTime = performance.now();
      publish(true);
    },
    restart() {
      state = createEchoSimulation(4_444_555);
      paused = false;
      autoPaused = false;
      accumulator = 0;
      callout = "BUILD A ROUTE YOUR FUTURE SELF CAN USE";
      calloutTicks = 180;
      lastBeatTick = -1;
      renderer.render(state);
      publish(true);
    },
    setMuted(muted) {
      audio.setMuted(muted);
    },
    setVirtualMove(x, y) {
      input.setVirtualMove(x, y);
    },
    clearVirtualMove() {
      input.clearVirtualMove();
    },
    pressPhase() {
      input.pressPhase();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(frameId);
      document.removeEventListener("visibilitychange", onVisibility);
      input.destroy();
      audio.destroy();
      renderer.destroy();
    },
  };
}
