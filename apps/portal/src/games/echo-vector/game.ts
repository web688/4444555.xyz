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
  type EchoNode,
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
  instructionTitle: string;
  instructionBody: string;
  playerTarget: number;
  echoTarget: number;
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
const IN_POSITION_RADIUS = 48;

function calloutForEvents(events: readonly SimulationEvent[], cycle: number): string | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event) continue;
    if (event.type === "confluence") {
      if (event.actorCount >= 4) return "CHORUS · FOUR PATHS ALIGNED";
      if (event.actorCount === 3) return "TRIO · THREE PATHS ALIGNED";
      return "DUET · TWO PATHS ALIGNED";
    }
    if (event.type === "node") return event.echoOnly ? "YOUR ECHO ACTIVATED A NODE" : "NODE ACTIVATED";
    if (event.type === "collision") return "UNCONTROLLED CROSSING · COHERENCE LOST";
    if (event.type === "cycle") return `CYCLE ${cycle} · YOUR PREVIOUS ROUTE IS NOW AN ECHO`;
    if (event.type === "complete") return "SIX-CYCLE SEQUENCE COMPLETE";
    if (event.type === "failed") return "COHERENCE LOST";
  }
  return null;
}

type TargetSet = {
  primary?: EchoNode;
  player?: EchoNode;
  primaryReady: boolean;
  playerReady: boolean;
};

function targetsFor(state: EchoSimulation): TargetSet {
  let primary: EchoNode | undefined;
  let alternative: EchoNode | undefined;
  let primaryReady = false;
  let alternativeReady = false;

  for (const node of state.nodes) {
    const cue = getNodeCue(state, node.id);
    if (cue.intensity <= 0) continue;
    if (cue.primary) {
      primary = node;
      primaryReady = cue.ready;
    } else if (!alternative) {
      alternative = node;
      alternativeReady = cue.ready;
    }
  }

  const player = state.cycle >= 2 && alternative ? alternative : primary;
  return {
    ...(primary ? { primary } : {}),
    ...(player ? { player } : {}),
    primaryReady,
    playerReady: player === alternative ? alternativeReady : primaryReady,
  };
}

function isNear(state: EchoSimulation, node: EchoNode | undefined): boolean {
  if (!node) return false;
  const dx = state.player.x - node.x;
  const dy = state.player.y - node.y;
  return dx * dx + dy * dy <= IN_POSITION_RADIUS * IN_POSITION_RADIUS;
}

function lessonFor(state: EchoSimulation): {
  title: string;
  body: string;
  playerTarget: number;
  echoTarget: number;
} {
  const targets = targetsFor(state);
  const playerTarget = targets.player ? targets.player.id + 1 : 0;
  const echoTarget = state.cycle >= 2 && targets.primary && targets.player !== targets.primary ? targets.primary.id + 1 : 0;
  const near = isNear(state, targets.player);

  if (state.phase === "ready") {
    return {
      title: "THREE THINGS ONLY",
      body: "Move to the marked node. Phase when it turns bright blue. After 30 seconds, everything you did returns as a ghost.",
      playerTarget,
      echoTarget,
    };
  }

  if (state.cycle === 1) {
    if (near && targets.playerReady) {
      return {
        title: "3 · PHASE NOW",
        body: `Press Space while you are inside Node ${playerTarget}. This exact action will be replayed by your echo next cycle.`,
        playerTarget,
        echoTarget: 0,
      };
    }
    if (near) {
      return {
        title: "2 · WAIT INSIDE THE RING",
        body: `You are in position at Node ${playerTarget}. When it turns bright blue, press Space.`,
        playerTarget,
        echoTarget: 0,
      };
    }
    return {
      title: "1 · FOLLOW THE MARKED NODE",
      body: `Move to Node ${playerTarget}. The game is recording your entire 30-second route as you play.`,
      playerTarget,
      echoTarget: 0,
    };
  }

  if (state.cycle === 2 && state.tickInCycle < 240) {
    return {
      title: "WATCH THE TRANSLUCENT SHARD",
      body: "That ghost is Cycle 1 replaying exactly. You do not control it. It repeats every move and every Phase you made.",
      playerTarget,
      echoTarget,
    };
  }

  if (echoTarget > 0 && playerTarget > 0) {
    if (near && targets.playerReady) {
      return {
        title: "PHASE YOUR NODE NOW",
        body: `You are on Node ${playerTarget}. Press Space. Your echo is repeating its old job at Node ${echoTarget}.`,
        playerTarget,
        echoTarget,
      };
    }
    if (near) {
      return {
        title: `YOU → ${playerTarget}   ·   ECHO → ${echoTarget}`,
        body: `Hold Node ${playerTarget} until it turns bright blue. Let the ghost handle Node ${echoTarget}.`,
        playerTarget,
        echoTarget,
      };
    }
    return {
      title: `SPLIT THE WORK · YOU → ${playerTarget}   ·   ECHO → ${echoTarget}`,
      body: `Go to Node ${playerTarget}. Your recorded echo is already travelling the old route toward Node ${echoTarget}.`,
      playerTarget,
      echoTarget,
    };
  }

  return {
    title: state.cycle >= 3 ? "BUILD ON YOUR OLD ROUTES" : "FOLLOW THE NEXT NODE",
    body: state.cycle >= 3
      ? "Every translucent shard is an older cycle replaying automatically. Use them for old jobs while you position the current shard for new ones."
      : `Move to Node ${playerTarget} and Phase when it wakes.`,
    playerTarget,
    echoTarget,
  };
}

function cueLabel(state: EchoSimulation): string {
  const lesson = lessonFor(state);
  const targets = targetsFor(state);
  if (lesson.echoTarget > 0 && lesson.playerTarget > 0) {
    return targets.playerReady
      ? `PHASE · YOU ${lesson.playerTarget} · ECHO ${lesson.echoTarget}`
      : `YOU ${lesson.playerTarget} · ECHO ${lesson.echoTarget}`;
  }
  if (lesson.playerTarget > 0) {
    return targets.playerReady ? `PHASE · NODE ${lesson.playerTarget}` : `MOVE · NODE ${lesson.playerTarget}`;
  }
  return "NEXT NODE ACQUIRING";
}

function telemetryFrom(state: EchoSimulation, paused: boolean, callout: string): EchoTelemetry {
  const phase: EchoRuntimePhase = paused && state.phase === "running" ? "paused" : state.phase;
  const lesson = lessonFor(state);
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
    instructionTitle: lesson.title,
    instructionBody: lesson.body,
    playerTarget: lesson.playerTarget,
    echoTarget: lesson.echoTarget,
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
  let callout = "YOUR ROUTE WILL RETURN AS AN ECHO";
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
      callout = "CYCLE 1 · FOLLOW THE MARKED NODE";
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
      callout = "YOUR ROUTE WILL RETURN AS AN ECHO";
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
