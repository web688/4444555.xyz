export class HullwatchAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  async arm() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.22;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") await this.context.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.22, this.context.currentTime, 0.02);
    }
  }

  private tone(frequency: number, duration: number, gain: number, type: OscillatorType, endFrequency?: number) {
    const context = this.context;
    const master = this.master;
    if (!context || !master || this.muted) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + Math.min(0.012, duration * 0.2));
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  shot() {
    this.tone(92, 0.07, 0.34, "square", 48);
    this.tone(640, 0.035, 0.055, "triangle", 260);
  }

  hit() {
    this.tone(1180, 0.035, 0.08, "sine", 820);
  }

  kill() {
    this.tone(180, 0.16, 0.13, "sawtooth", 58);
    this.tone(920, 0.08, 0.05, "triangle", 380);
  }

  intercept() {
    this.tone(1320, 0.09, 0.08, "sine", 540);
  }

  impact() {
    this.tone(72, 0.22, 0.25, "sawtooth", 30);
  }

  overheat() {
    this.tone(430, 0.16, 0.08, "square", 160);
  }

  destroy() {
    const context = this.context;
    this.context = null;
    this.master = null;
    if (context && context.state !== "closed") void context.close();
  }
}
