export class CourierAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private humGain: GainNode | null = null;
  private boostGain: GainNode | null = null;
  private muted = false;

  async arm() {
    if (!this.context) this.createGraph();
    if (this.context?.state === "suspended") await this.context.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.2, this.context.currentTime, 0.035);
    }
  }

  setBoost(active: boolean) {
    if (!this.context || !this.boostGain) return;
    this.boostGain.gain.setTargetAtTime(active ? 0.12 : 0.015, this.context.currentTime, 0.05);
  }

  nearMiss(intensity = 1) {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(980 + intensity * 180, now);
    oscillator.frequency.exponentialRampToValueAtTime(190, now + 0.28);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.31);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 0.33);
  }

  hit() {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(120, now);
    oscillator.frequency.exponentialRampToValueAtTime(32, now + 0.42);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 0.47);
    this.noiseBurst(0.18, 0.3);
  }

  complete() {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    [220, 330, 494, 660].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + index * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.08, now + index * 0.08 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
      oscillator.connect(gain).connect(this.master!);
      oscillator.start(now + index * 0.08);
      oscillator.stop(now + 0.75);
    });
  }

  fail() {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    [146, 110, 73].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.13);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.58, now + 0.72);
      gain.gain.setValueAtTime(0.0001, now + index * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.1, now + index * 0.13 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.78);
      oscillator.connect(gain).connect(this.master!);
      oscillator.start(now + index * 0.13);
      oscillator.stop(now + 0.8);
    });
  }

  destroy() {
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.humGain = null;
    this.boostGain = null;
  }

  private createGraph() {
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const master = context.createGain();
    master.gain.value = this.muted ? 0 : 0.2;
    master.connect(context.destination);

    const hum = context.createOscillator();
    const humGain = context.createGain();
    hum.type = "sawtooth";
    hum.frequency.value = 54;
    humGain.gain.value = 0.035;
    hum.connect(humGain).connect(master);
    hum.start();

    const overtone = context.createOscillator();
    const boostGain = context.createGain();
    overtone.type = "triangle";
    overtone.frequency.value = 112;
    boostGain.gain.value = 0.015;
    overtone.connect(boostGain).connect(master);
    overtone.start();

    this.context = context;
    this.master = master;
    this.humGain = humGain;
    this.boostGain = boostGain;
  }

  private noiseBurst(duration: number, volume: number) {
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
    filter.frequency.value = 850;
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
  }
}
