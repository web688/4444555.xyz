export class PinballAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private vortexGain: GainNode | null = null;
  private vortexOsc: OscillatorNode | null = null;
  private muted = false;

  async arm() {
    if (!this.context) this.createGraph();
    if (this.context?.state === "suspended") await this.context.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.22, this.context.currentTime, 0.035);
    }
  }

  setVortex(active: boolean, intensity = 1) {
    if (!this.context || !this.vortexGain || !this.vortexOsc || this.muted) return;
    const clamped = Math.max(0, Math.min(1, intensity));
    const targetGain = active ? 0.02 + clamped * 0.06 : 0.0001;
    const targetFreq = 64 + clamped * 120;
    this.vortexOsc.frequency.setTargetAtTime(targetFreq, this.context.currentTime, 0.05);
    this.vortexGain.gain.setTargetAtTime(targetGain, this.context.currentTime, 0.05);
  }

  flipper() {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.06);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  bumper(index = 0) {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    const scale = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    const freq = scale[index % scale.length] ?? 523.25;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.22);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  rampWhoosh() {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.35);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.42);
  }

  targetHit() {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  plungerRelease() {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.12);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.2);
    this.noiseBurst(0.08, 0.18, 1200);
  }

  drain() {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    [220, 164.81, 110].forEach((freq, idx) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + idx * 0.12 + 0.28);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.32);
      osc.connect(gain).connect(this.master!);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.35);
    });
  }

  complete() {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
      osc.connect(gain).connect(this.master!);
      osc.start(now + idx * 0.08);
      osc.stop(now + 0.75);
    });
  }

  destroy() {
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.vortexGain = null;
    this.vortexOsc = null;
  }

  private createGraph() {
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const master = context.createGain();
    master.gain.value = this.muted ? 0 : 0.22;
    master.connect(context.destination);

    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "sine";
    osc.frequency.value = 64;
    gain.gain.value = 0.0001;
    osc.connect(gain).connect(master);
    osc.start();

    this.context = context;
    this.master = master;
    this.vortexGain = gain;
    this.vortexOsc = osc;
  }

  private noiseBurst(duration: number, volume: number, cutoff = 800) {
    if (!this.context || !this.master) return;
    const length = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) channel[index] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
  }
}
