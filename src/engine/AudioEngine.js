/**
 * Fully synthetic Web Audio sound engine — no external audio files.
 * All effects are generated from oscillators and filtered noise buffers.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;

    this._windGain = null;
    this._flameGain = null;
    this._heartbeatTimer = 0;
    this._heartbeatOn = false;
    this._crackleTimer = 0;
    this._crackleLevel = 0;
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    // 2 seconds of white noise, reused by every noise-based effect
    const len = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this._startWind();
  }

  get ready() {
    return !!this.ctx;
  }

  _now() {
    return this.ctx.currentTime;
  }

  _noiseSource() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.loopStart = Math.random() * 1.5;
    return src;
  }

  /** Filtered noise burst — the backbone of gunshots, impacts, whooshes. */
  _noiseBurst({ dur = 0.1, vol = 0.3, type = 'lowpass', freq = 1200, freqEnd = null, q = 0.8, delay = 0 }) {
    const t = this._now() + delay;
    const src = this._noiseSource();
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t);
    if (freqEnd !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  _tone({ dur = 0.2, vol = 0.2, type = 'sine', freq = 440, freqEnd = null, delay = 0 }) {
    const t = this._now() + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // ------------------------------------------------ weapons

  shoot(type) {
    if (!this.ctx) return;
    if (type === 'rifle') {
      this._noiseBurst({ dur: 0.09, vol: 0.28, type: 'highpass', freq: 900 });
      this._tone({ dur: 0.08, vol: 0.25, type: 'triangle', freq: 180, freqEnd: 50 });
    } else if (type === 'shotgun') {
      this._noiseBurst({ dur: 0.22, vol: 0.42, type: 'lowpass', freq: 2400, freqEnd: 200 });
      this._tone({ dur: 0.18, vol: 0.35, type: 'sine', freq: 120, freqEnd: 35 });
    }
  }

  emptyClick() {
    if (!this.ctx) return;
    this._noiseBurst({ dur: 0.03, vol: 0.15, type: 'highpass', freq: 2500 });
  }

  reload() {
    if (!this.ctx) return;
    this._noiseBurst({ dur: 0.05, vol: 0.18, type: 'bandpass', freq: 1800, q: 5 });
    this._noiseBurst({ dur: 0.05, vol: 0.2, type: 'bandpass', freq: 1200, q: 5, delay: 0.16 });
  }

  setFlame(on) {
    if (!this.ctx) return;
    if (on && !this._flameGain) {
      const src = this._noiseSource();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, this._now());
      g.gain.exponentialRampToValueAtTime(0.3, this._now() + 0.15);
      src.connect(filter).connect(g).connect(this.master);
      src.start();
      this._flameGain = { g, src };
    } else if (!on && this._flameGain) {
      const { g, src } = this._flameGain;
      g.gain.setTargetAtTime(0.001, this._now(), 0.08);
      src.stop(this._now() + 0.4);
      this._flameGain = null;
    }
  }

  // ------------------------------------------------ creatures

  roar(kind) {
    if (!this.ctx) return;
    if (kind === 'bear') {
      this._tone({ dur: 0.7, vol: 0.3, type: 'sawtooth', freq: 110, freqEnd: 55 });
      this._noiseBurst({ dur: 0.6, vol: 0.18, type: 'lowpass', freq: 500, freqEnd: 150 });
    } else if (kind === 'wolf') {
      this._tone({ dur: 0.9, vol: 0.16, type: 'sine', freq: 380, freqEnd: 620 });
      this._tone({ dur: 0.5, vol: 0.12, type: 'sine', freq: 620, freqEnd: 300, delay: 0.85 });
    } else if (kind === 'goliath') {
      this._tone({ dur: 1.2, vol: 0.4, type: 'sawtooth', freq: 60, freqEnd: 32 });
      this._noiseBurst({ dur: 1.0, vol: 0.25, type: 'lowpass', freq: 300, freqEnd: 60 });
    }
  }

  enemyDie(kind) {
    if (!this.ctx) return;
    if (kind === 'goliath') {
      this._noiseBurst({ dur: 0.8, vol: 0.4, type: 'lowpass', freq: 900, freqEnd: 80 });
      this._tone({ dur: 0.7, vol: 0.3, type: 'sine', freq: 90, freqEnd: 25 });
    } else {
      this._tone({ dur: 0.35, vol: 0.18, type: 'sawtooth', freq: 200, freqEnd: 60 });
      this._noiseBurst({ dur: 0.25, vol: 0.12, type: 'lowpass', freq: 800, freqEnd: 200 });
    }
  }

  // ------------------------------------------------ survival

  pickup() {
    if (!this.ctx) return;
    this._tone({ dur: 0.08, vol: 0.15, type: 'sine', freq: 880 });
    this._tone({ dur: 0.12, vol: 0.15, type: 'sine', freq: 1320, delay: 0.07 });
  }

  gather() {
    if (!this.ctx) return;
    this._noiseBurst({ dur: 0.1, vol: 0.25, type: 'bandpass', freq: 400, q: 2 });
    this._tone({ dur: 0.08, vol: 0.1, type: 'triangle', freq: 220, freqEnd: 140 });
  }

  stoke() {
    if (!this.ctx) return;
    this._noiseBurst({ dur: 0.6, vol: 0.3, type: 'lowpass', freq: 400, freqEnd: 2000 });
  }

  playerHurt() {
    if (!this.ctx) return;
    this._tone({ dur: 0.25, vol: 0.3, type: 'square', freq: 200, freqEnd: 70 });
  }

  buy() {
    if (!this.ctx) return;
    this._tone({ dur: 0.07, vol: 0.15, type: 'square', freq: 520 });
    this._tone({ dur: 0.1, vol: 0.15, type: 'square', freq: 780, delay: 0.08 });
  }

  deny() {
    if (!this.ctx) return;
    this._tone({ dur: 0.15, vol: 0.15, type: 'square', freq: 180, freqEnd: 120 });
  }

  waveHorn() {
    if (!this.ctx) return;
    this._tone({ dur: 0.8, vol: 0.22, type: 'sawtooth', freq: 220, freqEnd: 175 });
    this._tone({ dur: 0.8, vol: 0.22, type: 'sawtooth', freq: 224, freqEnd: 178 });
    this._tone({ dur: 1.1, vol: 0.18, type: 'sawtooth', freq: 165, freqEnd: 130, delay: 0.7 });
  }

  barrierBreak() {
    if (!this.ctx) return;
    this._noiseBurst({ dur: 0.35, vol: 0.3, type: 'highpass', freq: 1500 });
    this._tone({ dur: 0.2, vol: 0.15, type: 'triangle', freq: 900, freqEnd: 300 });
  }

  gameOver() {
    if (!this.ctx) return;
    this._tone({ dur: 1.6, vol: 0.3, type: 'sawtooth', freq: 160, freqEnd: 40 });
    this._noiseBurst({ dur: 1.4, vol: 0.2, type: 'lowpass', freq: 600, freqEnd: 60 });
  }

  // ------------------------------------------------ ambient loops

  _startWind() {
    const src = this._noiseSource();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const g = this.ctx.createGain();
    g.gain.value = 0.045;
    src.connect(filter).connect(g).connect(this.master);
    src.start();
    this._windGain = g;
    this._windFilter = filter;
  }

  /** storm: 0..1 blizzard intensity */
  setWind(storm) {
    if (!this._windGain) return;
    const t = this._now();
    this._windGain.gain.setTargetAtTime(0.045 + storm * 0.16, t, 0.8);
    this._windFilter.frequency.setTargetAtTime(320 + storm * 500, t, 0.8);
  }

  _cracklePop() {
    this._noiseBurst({
      dur: 0.02 + Math.random() * 0.04,
      vol: 0.05 + this._crackleLevel * 0.12 * Math.random(),
      type: 'bandpass',
      freq: 800 + Math.random() * 2500,
      q: 3,
    });
  }

  _heartThump() {
    this._tone({ dur: 0.1, vol: 0.35, type: 'sine', freq: 65, freqEnd: 40 });
    this._tone({ dur: 0.08, vol: 0.25, type: 'sine', freq: 60, freqEnd: 38, delay: 0.18 });
  }

  /**
   * Frame update for ambient layers.
   * crackle: 0..1 proximity to fire · lowHealth: heartbeats on/off
   */
  update(dt, crackle, lowHealth) {
    if (!this.ctx) return;
    this._crackleLevel = crackle;
    if (crackle > 0.05) {
      this._crackleTimer -= dt;
      if (this._crackleTimer <= 0) {
        this._cracklePop();
        this._crackleTimer = 0.04 + Math.random() * 0.3;
      }
    }
    if (lowHealth) {
      this._heartbeatTimer -= dt;
      if (this._heartbeatTimer <= 0) {
        this._heartThump();
        this._heartbeatTimer = 1.0;
      }
    } else {
      this._heartbeatTimer = 0;
    }
  }
}
