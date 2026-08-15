export class SlingshotAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private gravityDroneGain: GainNode | null = null;
  private gravityDroneOsc: OscillatorNode | null = null;
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

  updateGravityProximity(intensity: number) {
    if (!this.context || !this.gravityDroneGain || !this.gravityDroneOsc || this.muted) return;
    const clamped = Math.max(0, Math.min(1, intensity));
    const targetFreq = 48 + clamped * 72;
    const targetGain = 0.01 + clamped * 0.08;
    this.gravityDroneOsc.frequency.setTargetAtTime(targetFreq, this.context.currentTime, 0.08);
    this.gravityDroneGain.gain.setTargetAtTime(targetGain, this.context.currentTime, 0.08);
  }

  launch() {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.32);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  slingshot(multiplier = 1) {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(320 + multiplier * 60, now);
    osc.frequency.exponentialRampToValueAtTime(840 + multiplier * 80, now + 0.26);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  beaconPickup(index = 0) {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    const frequencies = [587.33, 659.25, 880.0, 1046.5, 1318.51];
    const freq = frequencies[index % frequencies.length] ?? 587.33;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.42);
  }

  thrusterBurn() {
    if (!this.context || !this.master || this.muted) return;
    this.noiseBurst(0.15, 0.12, 450);
  }

  hit() {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.45);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.5);
    this.noiseBurst(0.22, 0.25, 600);
  }

  dockingComplete() {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    [440, 554.37, 659.25, 880].forEach((frequency, index) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + index * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.12, now + index * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
      osc.connect(gain).connect(this.master!);
      osc.start(now + index * 0.07);
      osc.stop(now + 0.7);
    });
  }

  fail() {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    [160, 120, 80].forEach((frequency, index) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(frequency, now + index * 0.12);
      osc.frequency.exponentialRampToValueAtTime(frequency * 0.5, now + 0.7);
      gain.gain.setValueAtTime(0.0001, now + index * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.1, now + index * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
      osc.connect(gain).connect(this.master!);
      osc.start(now + index * 0.12);
      osc.stop(now + 0.78);
    });
  }

  destroy() {
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.gravityDroneGain = null;
    this.gravityDroneOsc = null;
  }

  private createGraph() {
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const master = context.createGain();
    master.gain.value = this.muted ? 0 : 0.22;
    master.connect(context.destination);

    const drone = context.createOscillator();
    const droneGain = context.createGain();
    drone.type = "sine";
    drone.frequency.value = 52;
    droneGain.gain.value = 0.015;
    drone.connect(droneGain).connect(master);
    drone.start();

    this.context = context;
    this.master = master;
    this.gravityDroneGain = droneGain;
    this.gravityDroneOsc = drone;
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
