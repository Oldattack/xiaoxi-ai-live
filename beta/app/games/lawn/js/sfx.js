// 很小的合成音效，避免加载音频文件；OBS 里默认能出声。
export class Sfx {
  constructor(muted = false) {
    this.enabled = !muted;
    this.ctx = null;
    this.last = {};
  }

  ensure() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { this.enabled = false; return null; }
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.6;
        this.master.connect(this.ctx.destination);
      } catch {
        this.enabled = false;
        return null;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  gate(key, ms) {
    const now = performance.now();
    if (this.last[key] && now - this.last[key] < ms) return false;
    this.last[key] = now;
    return true;
  }

  tone(freq, dur, type = 'sine', gain = 0.05, slideTo = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(this.master);
      o.start();
      o.stop(ctx.currentTime + dur + 0.01);
    } catch { /* 音频失败不影响画面 */ }
  }

  noise(dur, gain = 0.08) {
    const ctx = this.ensure();
    if (!ctx) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = gain;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start();
    } catch { /* ignore */ }
  }

  blip(freq = 700, dur = 0.04) { this.tone(freq, dur, 'triangle', 0.03); }
  plant() { this.tone(320, 0.09, 'triangle', 0.06, 520); }
  shovel() { this.tone(300, 0.08, 'square', 0.03, 160); }
  shoot(icy = false) {
    if (!this.gate('shoot', 90)) return;
    this.tone(icy ? 720 : 540, 0.05, 'square', 0.018, icy ? 900 : 420);
  }
  hit() {
    if (!this.gate('hit', 70)) return;
    this.tone(180, 0.04, 'square', 0.02, 120);
  }
  chomp() {
    if (!this.gate('chomp', 260)) return;
    this.tone(110, 0.07, 'sawtooth', 0.022, 70);
  }
  ding() { this.tone(1180, 0.09, 'sine', 0.035, 1560); }
  boom() { this.noise(0.35, 0.12); this.tone(70, 0.3, 'sine', 0.12, 40); }
  mower() { this.noise(0.5, 0.06); this.tone(90, 0.4, 'sawtooth', 0.05, 60); }
  foeDie() { this.tone(150, 0.12, 'sawtooth', 0.035, 60); }
  gameOver() { this.tone(220, 0.5, 'sawtooth', 0.09, 70); }
  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) this.ensure();
    return this.enabled;
  }
}
