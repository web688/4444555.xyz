export class HullwatchAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private lowVoice: OscillatorNode | null = null;
  private lowGain: GainNode | null = null;
  private highVoice: OscillatorNode | null = null;
  private highGain: GainNode | null = null;
  private cueVoice: OscillatorNode | null = null;
  private cueGain: GainNode | null = null;
  private muted = false;

  async arm() {
    try {
      if (!this.context) {
        const context = new AudioContext();
        const master = context.createGain();
        master.gain.value = this.muted ? 0 : 0.22;
        master.connect(context.destination);

        const makeVoice = (type: OscillatorType, frequency: number) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = type;
          oscillator.frequency.value = frequency;
          gain.gain.value = 0.0001;
          oscillator.connect(gain);
          gain.connect(master);
          oscillator.start();
          return { oscillator, gain };
        };

        const low = makeVoice("square", 92);
        const high = makeVoice("triangle", 640);
        const cue = makeVoice("sine", 920);

        this.context = context;
        this.master = master;
        this.lowVoice = low.oscillator;
        this.lowGain = low.gain;
        this.highVoice = high.oscillator;
        this.highGain = high.gain;
        this.cueVoice = cue.oscillator;
        this.cueGain = cue.gain;
      }
      if (this.context.state === "suspended") await this.context.resume();
    } catch {
      // Audio must never be able to stall or terminate the render loop.
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    const context = this.context;
    const master = this.master;
    if (!master || !context) return;
    try {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(muted ? 0 : 0.22, context.currentTime, 0.02);
    } catch {
      // Keep gameplay independent from WebAudio failures.
    }
  }

  private pulse(
    oscillator: OscillatorNode | null,
    envelope: GainNode | null,
    startFrequency: number,
    endFrequency: number,
    duration: number,
    peak: number,
    type?: OscillatorType,
  ) {
    const context = this.context;
    if (!context || !oscillator || !envelope || this.muted) return;
    try {
      const now = context.currentTime;
      if (type) oscillator.type = type;
      oscillator.frequency.cancelScheduledValues(now);
      oscillator.frequency.setValueAtTime(Math.max(20, startFrequency), now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
      envelope.gain.cancelScheduledValues(now);
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(peak, now + Math.min(0.01, duration * 0.2));
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    } catch {
      // A sound cue may be dropped, but simulation/rendering continues.
    }
  }

  shot() {
    this.pulse(this.lowVoice, this.lowGain, 92, 48, 0.07, 0.34, "square");
    this.pulse(this.highVoice, this.highGain, 640, 260, 0.035, 0.055, "triangle");
  }

  hit() {
    this.pulse(this.cueVoice, this.cueGain, 1180, 820, 0.035, 0.08, "sine");
  }

  kill() {
    this.pulse(this.lowVoice, this.lowGain, 180, 58, 0.16, 0.13, "sawtooth");
    this.pulse(this.cueVoice, this.cueGain, 920, 380, 0.08, 0.05, "triangle");
  }

  intercept() {
    this.pulse(this.cueVoice, this.cueGain, 1320, 540, 0.09, 0.08, "sine");
  }

  impact() {
    this.pulse(this.lowVoice, this.lowGain, 72, 30, 0.22, 0.25, "sawtooth");
  }

  overheat() {
    this.pulse(this.cueVoice, this.cueGain, 430, 160, 0.16, 0.08, "square");
  }

  destroy() {
    const context = this.context;
    const voices = [this.lowVoice, this.highVoice, this.cueVoice];
    this.context = null;
    this.master = null;
    this.lowVoice = null;
    this.lowGain = null;
    this.highVoice = null;
    this.highGain = null;
    this.cueVoice = null;
    this.cueGain = null;
    for (const voice of voices) {
      if (!voice) continue;
      try {
        voice.stop();
      } catch {
        // Already stopped/closed.
      }
    }
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
  }
}
