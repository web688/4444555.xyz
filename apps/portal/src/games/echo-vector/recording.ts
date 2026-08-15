export const ECHO_TAPE_TICKS = 30 * 60;

export type EchoTape = {
  cycle: number;
  x: Float32Array;
  y: Float32Array;
  phase: Uint8Array;
  length: number;
};

export type TapeSample = {
  x: number;
  y: number;
  phase: boolean;
};

export function createEchoTape(cycle: number, capacity = ECHO_TAPE_TICKS): EchoTape {
  return {
    cycle,
    x: new Float32Array(capacity),
    y: new Float32Array(capacity),
    phase: new Uint8Array(capacity),
    length: 0,
  };
}

export function recordEchoFrame(
  tape: EchoTape,
  tick: number,
  x: number,
  y: number,
  phase: boolean,
): void {
  if (tick < 0 || tick >= tape.x.length) return;
  tape.x[tick] = Math.fround(x);
  tape.y[tick] = Math.fround(y);
  tape.phase[tick] = phase ? 1 : 0;
  if (tick + 1 > tape.length) tape.length = tick + 1;
}

export function sampleEchoFrame(tape: EchoTape, tick: number, out: TapeSample): boolean {
  if (tick < 0 || tick >= tape.length) return false;
  out.x = tape.x[tick] ?? 0;
  out.y = tape.y[tick] ?? 0;
  out.phase = (tape.phase[tick] ?? 0) === 1;
  return true;
}
