import {
  ECHO_TAPE_TICKS,
  createEchoTape,
  recordEchoFrame,
  sampleEchoFrame,
  type EchoTape,
  type TapeSample,
} from "./recording.ts";

export const ECHO_TICK_RATE = 60;
export const ECHO_CYCLE_SECONDS = 30;
export const ECHO_TOTAL_CYCLES = 6;
export const ECHO_CYCLE_TICKS = ECHO_TAPE_TICKS;
export const ECHO_ARENA_WIDTH = 1000;
export const ECHO_ARENA_HEIGHT = 620;
export const ECHO_PLAYER_RADIUS = 13;
export const ECHO_NODE_RADIUS = 34;

const PLAYER_SPEED = 310 / ECHO_TICK_RATE;
const PHASE_DURATION_TICKS = 12;
const PHASE_COOLDOWN_TICKS = 24;
const COLLISION_COOLDOWN_TICKS = 42;
const CONFLUENCE_COOLDOWN_TICKS = 48;
const CYCLE_GRACE_TICKS = 72;
const CUE_LENGTH_TICKS = 150;
const CUE_WINDOW_START = 34;
const CUE_WINDOW_END = 102;
const CUE_CENTER = 68;
const GLOBAL_BEAT_TICKS = 45;

export type InputFrame = {
  moveX: number;
  moveY: number;
  phasePressed: boolean;
};

export type EchoPhase = "ready" | "running" | "complete" | "failed";

export type EchoNode = {
  id: number;
  x: number;
  y: number;
  lastCueHit: number;
  activations: number;
};

export type EchoStats = {
  nodeActivations: number;
  echoAssists: number;
  duets: number;
  trios: number;
  choruses: number;
  confluences: number;
  collisions: number;
  maxChain: number;
};

export type SimulationEvent =
  | { type: "node"; strength: number; actorCount: number; echoOnly: boolean }
  | { type: "confluence"; strength: number; actorCount: number }
  | { type: "collision"; strength: number }
  | { type: "cycle"; strength: number; cycle: number }
  | { type: "complete"; strength: number }
  | { type: "failed"; strength: number };

export type EchoSimulation = {
  seed: number;
  phase: EchoPhase;
  cycle: number;
  tickInCycle: number;
  totalTicks: number;
  score: number;
  coherence: number;
  chain: number;
  lastScoreTick: number;
  player: {
    x: number;
    y: number;
    phaseTicks: number;
    phaseCooldown: number;
  };
  nodes: EchoNode[];
  tapes: EchoTape[];
  recording: EchoTape;
  echoCollisionCooldowns: Int16Array;
  echoConfluenceCooldowns: Int16Array;
  stats: EchoStats;
  events: SimulationEvent[];
};

export type NodeCue = {
  cueId: number;
  ready: boolean;
  intensity: number;
  timingAccuracy: number;
  primary: boolean;
};

export type ActorSample = {
  x: number;
  y: number;
  phase: boolean;
  echoIndex: number;
};

const NODE_LAYOUT = [
  [170, 150],
  [365, 112],
  [630, 112],
  [830, 150],
  [865, 388],
  [665, 500],
  [335, 500],
  [135, 388],
] as const;

const START_X = 500;
const START_Y = 310;
const scratchTapeSample: TapeSample = { x: 0, y: 0, phase: false };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distanceSquared(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function normalizeInput(x: number, y: number): [number, number] {
  const length = Math.hypot(x, y);
  if (length <= 1 || length === 0) return [x, y];
  return [x / length, y / length];
}

function seededOffset(seed: number, cueIndex: number): number {
  let value = (seed ^ Math.imul(cueIndex + 1, 0x45d9f3b)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  value ^= value >>> 16;
  return value >>> 0;
}

export function createEchoSimulation(seed = 4_444_555): EchoSimulation {
  return {
    seed,
    phase: "ready",
    cycle: 1,
    tickInCycle: 0,
    totalTicks: 0,
    score: 0,
    coherence: 100,
    chain: 0,
    lastScoreTick: -10_000,
    player: {
      x: START_X,
      y: START_Y,
      phaseTicks: 0,
      phaseCooldown: 0,
    },
    nodes: NODE_LAYOUT.map(([x, y], id) => ({ id, x, y, lastCueHit: -1, activations: 0 })),
    tapes: [],
    recording: createEchoTape(1),
    echoCollisionCooldowns: new Int16Array(ECHO_TOTAL_CYCLES - 1),
    echoConfluenceCooldowns: new Int16Array(ECHO_TOTAL_CYCLES - 1),
    stats: {
      nodeActivations: 0,
      echoAssists: 0,
      duets: 0,
      trios: 0,
      choruses: 0,
      confluences: 0,
      collisions: 0,
      maxChain: 0,
    },
    events: [],
  };
}

export function launchEchoSimulation(state: EchoSimulation): void {
  if (state.phase === "ready") state.phase = "running";
}

export function getNodeCue(
  state: Pick<EchoSimulation, "seed" | "cycle" | "tickInCycle">,
  nodeId: number,
): NodeCue {
  const cueIndex = Math.floor(state.tickInCycle / CUE_LENGTH_TICKS);
  const localTick = state.tickInCycle % CUE_LENGTH_TICKS;
  const hash = seededOffset(state.seed + state.cycle * 97, cueIndex);
  const primary = hash % NODE_LAYOUT.length;
  const secondary = (primary + 2 + ((hash >>> 7) % 4)) % NODE_LAYOUT.length;
  const tertiary = (primary + 5 + ((hash >>> 11) % 2)) % NODE_LAYOUT.length;
  const nodeIsPrimary = nodeId === primary;
  const nodeIsSecondary = state.cycle >= 2 && cueIndex % 2 === 1 && nodeId === secondary;
  const nodeIsTertiary = state.cycle >= 4 && cueIndex % 3 === 2 && nodeId === tertiary;
  const selected = nodeIsPrimary || nodeIsSecondary || nodeIsTertiary;
  const inWindow = localTick >= CUE_WINDOW_START && localTick <= CUE_WINDOW_END;
  const distanceFromCenter = Math.abs(localTick - CUE_CENTER);
  const halfWindow = Math.max(1, CUE_WINDOW_END - CUE_CENTER);
  const timingAccuracy = selected && inWindow ? clamp(1 - distanceFromCenter / halfWindow, 0, 1) : 0;
  const intensity = selected ? clamp(1 - Math.abs(localTick - CUE_CENTER) / 70, 0.08, 1) : 0;
  return {
    cueId: state.cycle * 100 + cueIndex,
    ready: selected && inWindow,
    intensity,
    timingAccuracy,
    primary: nodeIsPrimary,
  };
}

export function getBeatPulse(state: Pick<EchoSimulation, "tickInCycle">): number {
  const local = state.tickInCycle % GLOBAL_BEAT_TICKS;
  return clamp(1 - local / 12, 0, 1);
}

export function getSecondsRemaining(state: Pick<EchoSimulation, "tickInCycle">): number {
  return Math.max(0, ECHO_CYCLE_SECONDS - state.tickInCycle / ECHO_TICK_RATE);
}

export function sampleEchoActor(
  state: Pick<EchoSimulation, "tapes" | "tickInCycle">,
  echoIndex: number,
  out: ActorSample,
): boolean {
  const tape = state.tapes[echoIndex];
  if (!tape) return false;
  if (!sampleEchoFrame(tape, state.tickInCycle, scratchTapeSample)) return false;
  out.x = scratchTapeSample.x;
  out.y = scratchTapeSample.y;
  out.phase = scratchTapeSample.phase;
  out.echoIndex = echoIndex;
  return true;
}

function tickCooldowns(values: Int16Array): void {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] ?? 0;
    if (value > 0) values[index] = value - 1;
  }
}

function awardNode(
  state: EchoSimulation,
  node: EchoNode,
  cue: NodeCue,
  actorCount: number,
  includesPlayer: boolean,
): void {
  const echoOnly = !includesPlayer;
  const timing = Math.round(90 * cue.timingAccuracy);
  const cooperation = actorCount <= 1 ? 0 : actorCount === 2 ? 180 : actorCount === 3 ? 360 : 620;
  const chainMultiplier = 1 + Math.min(state.chain, 10) * 0.12;
  const base = 120 + timing + cooperation + (echoOnly ? 70 : 0);
  state.score += Math.round(base * chainMultiplier);
  state.chain += 1;
  state.stats.maxChain = Math.max(state.stats.maxChain, state.chain);
  state.lastScoreTick = state.totalTicks;
  state.stats.nodeActivations += 1;
  node.activations += 1;
  node.lastCueHit = cue.cueId;
  if (echoOnly) state.stats.echoAssists += 1;
  if (actorCount === 2) state.stats.duets += 1;
  else if (actorCount === 3) state.stats.trios += 1;
  else if (actorCount >= 4) state.stats.choruses += 1;
  if (actorCount >= 2) state.stats.confluences += 1;
  state.events.push({ type: actorCount >= 2 ? "confluence" : "node", strength: cue.timingAccuracy, actorCount, ...(actorCount >= 2 ? {} : { echoOnly }) } as SimulationEvent);
}

function handleNodeActivations(state: EchoSimulation): void {
  const actorCount = state.tapes.length + 1;
  for (const node of state.nodes) {
    const cue = getNodeCue(state, node.id);
    if (!cue.ready || node.lastCueHit === cue.cueId) continue;

    let activeActors = 0;
    let includesPlayer = false;
    const activationRadiusSq = ECHO_NODE_RADIUS * ECHO_NODE_RADIUS;
    if (
      state.player.phaseTicks > 0 &&
      distanceSquared(state.player.x, state.player.y, node.x, node.y) <= activationRadiusSq
    ) {
      activeActors += 1;
      includesPlayer = true;
    }

    for (let echoIndex = 0; echoIndex < state.tapes.length; echoIndex += 1) {
      const tape = state.tapes[echoIndex];
      if (!tape || !sampleEchoFrame(tape, state.tickInCycle, scratchTapeSample)) continue;
      if (
        scratchTapeSample.phase &&
        distanceSquared(scratchTapeSample.x, scratchTapeSample.y, node.x, node.y) <= activationRadiusSq
      ) {
        activeActors += 1;
      }
    }

    if (activeActors > 0) awardNode(state, node, cue, Math.min(activeActors, actorCount), includesPlayer);
  }
}

function handleEchoCrossings(state: EchoSimulation): void {
  if (state.tickInCycle < CYCLE_GRACE_TICKS) return;
  const collisionRadiusSq = (ECHO_PLAYER_RADIUS * 2.1) ** 2;
  for (let echoIndex = 0; echoIndex < state.tapes.length; echoIndex += 1) {
    const tape = state.tapes[echoIndex];
    if (!tape || !sampleEchoFrame(tape, state.tickInCycle, scratchTapeSample)) continue;
    if (distanceSquared(state.player.x, state.player.y, scratchTapeSample.x, scratchTapeSample.y) > collisionRadiusSq) continue;

    const collisionCooldown = state.echoCollisionCooldowns[echoIndex] ?? 0;
    const confluenceCooldown = state.echoConfluenceCooldowns[echoIndex] ?? 0;
    if (state.player.phaseTicks > 0) {
      if (confluenceCooldown <= 0) {
        const beat = getBeatPulse(state);
        const bonus = Math.round(180 + 240 * beat);
        state.score += bonus;
        state.chain += 1;
        state.stats.maxChain = Math.max(state.stats.maxChain, state.chain);
        state.stats.confluences += 1;
        state.lastScoreTick = state.totalTicks;
        state.echoConfluenceCooldowns[echoIndex] = CONFLUENCE_COOLDOWN_TICKS;
        state.events.push({ type: "confluence", strength: Math.max(0.25, beat), actorCount: 2 });
      }
    } else if (collisionCooldown <= 0) {
      state.coherence = Math.max(0, state.coherence - 11);
      state.chain = 0;
      state.stats.collisions += 1;
      state.echoCollisionCooldowns[echoIndex] = COLLISION_COOLDOWN_TICKS;
      state.events.push({ type: "collision", strength: 1 });
    }
  }
}

function beginNextCycle(state: EchoSimulation): void {
  state.tapes.push(state.recording);
  state.cycle += 1;
  state.tickInCycle = 0;
  state.player.x = START_X;
  state.player.y = START_Y;
  state.player.phaseTicks = 0;
  state.player.phaseCooldown = 0;
  state.chain = 0;
  state.recording = createEchoTape(state.cycle);
  state.coherence = Math.min(100, state.coherence + 4);
  state.echoCollisionCooldowns.fill(0);
  state.echoConfluenceCooldowns.fill(0);
  state.events.push({ type: "cycle", strength: 1, cycle: state.cycle });
}

function finishRun(state: EchoSimulation): void {
  const echoEfficiency = state.stats.echoAssists + state.stats.duets * 2 + state.stats.trios * 3 + state.stats.choruses * 4;
  state.score += echoEfficiency * 55 + Math.round(state.coherence * 18);
  state.phase = "complete";
  state.events.push({ type: "complete", strength: 1 });
}

export function stepEchoSimulation(state: EchoSimulation, input: InputFrame): void {
  state.events.length = 0;
  if (state.phase !== "running") return;

  tickCooldowns(state.echoCollisionCooldowns);
  tickCooldowns(state.echoConfluenceCooldowns);
  if (state.player.phaseTicks > 0) state.player.phaseTicks -= 1;
  if (state.player.phaseCooldown > 0) state.player.phaseCooldown -= 1;

  const [moveX, moveY] = normalizeInput(clamp(input.moveX, -1, 1), clamp(input.moveY, -1, 1));
  state.player.x = Math.fround(clamp(state.player.x + moveX * PLAYER_SPEED, 42, ECHO_ARENA_WIDTH - 42));
  state.player.y = Math.fround(clamp(state.player.y + moveY * PLAYER_SPEED, 42, ECHO_ARENA_HEIGHT - 42));

  if (input.phasePressed && state.player.phaseCooldown <= 0) {
    state.player.phaseTicks = PHASE_DURATION_TICKS;
    state.player.phaseCooldown = PHASE_COOLDOWN_TICKS;
  }

  recordEchoFrame(
    state.recording,
    state.tickInCycle,
    state.player.x,
    state.player.y,
    state.player.phaseTicks > 0,
  );

  handleNodeActivations(state);
  handleEchoCrossings(state);

  if (state.totalTicks - state.lastScoreTick > 4 * ECHO_TICK_RATE) state.chain = 0;

  state.tickInCycle += 1;
  state.totalTicks += 1;

  if (state.coherence <= 0) {
    state.phase = "failed";
    state.events.push({ type: "failed", strength: 1 });
    return;
  }

  if (state.tickInCycle >= ECHO_CYCLE_TICKS) {
    if (state.cycle >= ECHO_TOTAL_CYCLES) finishRun(state);
    else beginNextCycle(state);
  }
}

export function getEchoEfficiency(state: Pick<EchoSimulation, "stats">): number {
  const useful = state.stats.echoAssists + state.stats.duets * 2 + state.stats.trios * 3 + state.stats.choruses * 4;
  const total = Math.max(1, state.stats.nodeActivations + state.stats.collisions);
  return clamp(Math.round((useful / total) * 100), 0, 100);
}
