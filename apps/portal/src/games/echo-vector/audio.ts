import type { SimulationEvent } from "./rules.ts";

export type EchoAudio = {
  resume: () => Promise<void>;
  setMuted: (muted: boolean) => void;
  beat: (strength: number) => void;
  handleEvents: (events: readonly SimulationEvent[]) => void;
  destroy: () => void;
};

export function createEchoAudio(): EchoAudio {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = false;

  const ensureContext = () => {
    if (context) return context;
    const AudioCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    context = new AudioCtor();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.22;
    master.connect(context.destination);
    return context;
  };

  const tone = (frequency: number, duration: number, gainValue: number, type: OscillatorType = "sine") => {
    const active = ensureContext();
    if (!active || !master || muted) return;
    const oscillator = active.createOscillator();
    const gain = active.createGain();
    const now = active.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration);
  };

  return {
    async resume() {
      const active = ensureContext();
      if (active?.state === "suspended") await active.resume();
    },
    setMuted(nextMuted) {
      muted = nextMuted;
      if (master) master.gain.value = muted ? 0 : 0.22;
    },
    beat(strength) {
      if (strength < 0.9) return;
      tone(96, 0.08, 0.08, "sine");
    },
    handleEvents(events) {
      for (const event of events) {
        if (event.type === "node") tone(420 + event.strength * 120, 0.12, 0.11, "triangle");
        else if (event.type === "confluence") {
          tone(330, 0.18, 0.1, "sine");
          tone(495, 0.22, 0.075, "sine");
        } else if (event.type === "collision") tone(118, 0.16, 0.13, "sawtooth");
        else if (event.type === "cycle") tone(246, 0.28, 0.09, "triangle");
        else if (event.type === "complete") {
          tone(392, 0.32, 0.09, "sine");
          window.setTimeout(() => tone(523, 0.42, 0.08, "sine"), 110);
        } else if (event.type === "failed") tone(82, 0.34, 0.12, "sine");
      }
    },
    destroy() {
      const active = context;
      context = null;
      master = null;
      if (active) void active.close();
    },
  };
}
