// audio.js — a small WebAudio synth. No audio files: engine hum, sirens,
// gunshots, cash blips and the lo-fi neon bassline are all oscillators and
// filtered noise, generated live. Everything is guarded so the game runs
// silent where AudioContext does not exist (headless tests).

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicOn = false;
    this.musicStep = 0;
    this.musicTimer = 0;
    this.noiseBuffer = null;
  }

  // Must be called from a user gesture at least once.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch (e) {
      this.ctx = null;
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    // A shared white-noise buffer for shots, crashes and splashes.
    const len = this.ctx.sampleRate * 1;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  tone(freq, dur, type, vol, slideTo, delay = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol || 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  noise(dur, vol, filterFreq, delay = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  shot() { this.noise(0.16, 0.5, 2600); this.tone(150, 0.1, 'square', 0.25, 40); }
  punch() { this.noise(0.08, 0.3, 700); }
  crash(big) { this.noise(big ? 0.5 : 0.25, big ? 0.55 : 0.32, 900); }
  splash() { this.noise(0.4, 0.25, 1500); }
  pickup() { this.tone(880, 0.09, 'sine', 0.2); this.tone(1320, 0.14, 'sine', 0.2, null, 0.07); }
  cash() { this.tone(990, 0.08, 'triangle', 0.25); this.tone(1480, 0.16, 'triangle', 0.25, null, 0.06); }
  ui() { this.tone(660, 0.06, 'sine', 0.15); }
  fail() { this.tone(220, 0.3, 'sawtooth', 0.2, 110); }
  levelup() {
    this.tone(523, 0.1, 'triangle', 0.22);
    this.tone(659, 0.1, 'triangle', 0.22, null, 0.09);
    this.tone(784, 0.2, 'triangle', 0.22, null, 0.18);
  }

  // Continuous engine hum while driving; rpm 0..1.
  engine(on, rpm) {
    if (!this.ctx) return;
    if (on && !this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineGain.gain.value = 0.05;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 500;
      this.engineOsc.connect(filter); filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    if (!on && this.engineOsc) {
      try { this.engineOsc.stop(); } catch (e) { /* already stopped */ }
      this.engineOsc = null; this.engineGain = null;
    }
    if (on && this.engineOsc) {
      this.engineOsc.frequency.value = 55 + rpm * 165;
    }
  }

  // Two-tone police siren while wanted and police are near.
  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();
      this.sirenOsc.type = 'triangle';
      this.sirenGain.gain.value = 0.035;
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.7;
      lfoGain.gain.value = 160;
      lfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.frequency.value = 820;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start(); lfo.start();
      this.sirenLfo = lfo;
    }
    if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch (e) { /* noop */ }
      this.sirenOsc = null; this.sirenGain = null; this.sirenLfo = null;
    }
  }

  // The music: a slow synthwave loop — bass pulse plus a sparse lead.
  // Driven from the game loop so it needs no timers.
  updateMusic(dt, playing) {
    if (!this.ctx) return;
    const want = playing && !this.muted;
    if (!want) { this.musicOn = false; return; }
    this.musicOn = true;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    const stepDur = 0.235;
    this.musicTimer = stepDur;
    const bass = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 73.4, 0, 82.4, 0];
    const lead = [220, 0, 0, 261.6, 0, 0, 329.6, 0, 0, 0, 293.7, 0, 261.6, 0, 0, 0];
    const s = this.musicStep % 16;
    if (bass[s]) this.tone(bass[s], stepDur * 1.8, 'triangle', 0.30);
    if (lead[s]) this.tone(lead[s], stepDur * 1.4, 'sine', 0.10);
    if (s % 4 === 0) this.noise(0.03, 0.05, 6000);
    this.musicStep++;
  }
}
