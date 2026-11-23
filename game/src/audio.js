// audio.js — every sound is synthesised with WebAudio oscillators and noise, so the
// game ships no audio files at all. One small synth voice per effect; a siren and an
// engine hum run as loops whose pitch follows the action. Sound starts on the first
// user gesture, as browsers require, and M mutes.

let ctx = null;
let master = null;
let muted = false;
let engineNodes = null;
let sirenNodes = null;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch {
    ctx = null; // no audio on this browser: the game plays silently
  }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

function tone(freq, dur, type = 'square', vol = 0.2, slideTo = null, delay = 0) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur, vol = 0.25, freq = 1200, delay = 0) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
}

export const sfx = {
  shot() { noise(0.12, 0.5, 2600); tone(160, 0.1, 'square', 0.25, 60); },
  punch() { noise(0.07, 0.35, 700); },
  hurt() { tone(120, 0.16, 'sawtooth', 0.2, 70); },
  pickup() { tone(660, 0.09, 'sine', 0.25); tone(990, 0.14, 'sine', 0.25, null, 0.08); },
  cash() { tone(880, 0.08, 'triangle', 0.3); tone(1320, 0.16, 'triangle', 0.3, null, 0.07); },
  door() { tone(220, 0.07, 'square', 0.15, 180); tone(180, 0.09, 'square', 0.15, 140, 0.07); },
  crash(strength = 1) { noise(0.22, 0.3 * strength + 0.1, 900); tone(90, 0.2, 'sawtooth', 0.2, 45); },
  splash() { noise(0.3, 0.3, 1000); },
  splat() { noise(0.15, 0.4, 500); },
  alarm() { tone(520, 0.14, 'square', 0.22); tone(392, 0.14, 'square', 0.22, null, 0.16); },
  missionStart() { tone(523, 0.12, 'triangle', 0.3); tone(659, 0.12, 'triangle', 0.3, null, 0.11); tone(784, 0.22, 'triangle', 0.3, null, 0.22); },
  missionDone() { tone(659, 0.12, 'triangle', 0.3); tone(784, 0.12, 'triangle', 0.3, null, 0.11); tone(1046, 0.3, 'triangle', 0.32, null, 0.22); },
  fail() { tone(392, 0.18, 'sawtooth', 0.25, 380); tone(311, 0.18, 'sawtooth', 0.25, 300, 0.16); tone(233, 0.34, 'sawtooth', 0.25, 180, 0.32); },
  checkpoint() { tone(1046, 0.1, 'sine', 0.3); tone(1568, 0.16, 'sine', 0.28, null, 0.08); },
  star() { tone(740, 0.1, 'square', 0.2); tone(740, 0.1, 'square', 0.2, null, 0.14); },
};

// The engine loop: a low sawtooth whose pitch follows the driven car's speed.
export function setEngine(on, speedRatio = 0) {
  if (!ctx) return;
  if (on && !engineNodes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    gain.gain.value = 0.0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    osc.connect(filter).connect(gain).connect(master);
    osc.start();
    engineNodes = { osc, gain };
  }
  if (engineNodes) {
    const target = on ? 0.05 + Math.abs(speedRatio) * 0.05 : 0;
    engineNodes.gain.gain.setTargetAtTime(muted ? 0 : target, ctx.currentTime, 0.08);
    engineNodes.osc.frequency.setTargetAtTime(50 + Math.abs(speedRatio) * 130, ctx.currentTime, 0.08);
    if (!on) {
      const nodes = engineNodes;
      engineNodes = null;
      window.setTimeout(() => { try { nodes.osc.stop(); } catch { /* already stopped */ } }, 350);
    }
  }
}

// The police siren loop: two alternating tones while any star is lit.
export function setSiren(on) {
  if (!ctx) return;
  if (on && !sirenNodes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 760;
    lfo.type = 'square';
    lfo.frequency.value = 0.9;
    lfoGain.gain.value = 130;
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.value = 0.045;
    osc.connect(gain).connect(master);
    osc.start();
    lfo.start();
    sirenNodes = { osc, lfo, gain };
  }
  if (!on && sirenNodes) {
    const nodes = sirenNodes;
    sirenNodes = null;
    try { nodes.osc.stop(); nodes.lfo.stop(); } catch { /* already stopped */ }
  }
}
