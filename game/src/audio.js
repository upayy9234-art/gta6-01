// audio.js — every sound is synthesised with WebAudio: no audio files, no
// network. Short one-shots (shots, crashes, pickups, sirens blips) are built
// from oscillators and filtered noise; the engine and the police siren are
// looping nodes whose pitch follows the game. A tiny two-oscillator music
// loop plays a slow synthwave figure on the title screen and at low volume
// in the world. Everything is created lazily on the first user gesture, and
// every entry point is safe to call when no AudioContext exists.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engine = null; // { osc, gain, filter }
  let siren = null; // { osc, gain, lfo }
  let music = null; // { timer, step }
  let noiseBuffer = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    // One shared noise buffer for shots, crashes, surf and rain.
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }

  function tone({ freq = 440, freqEnd = null, type = 'sine', dur = 0.15, vol = 0.2, delay = 0 }) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur = 0.2, vol = 0.25, freq = 1200, q = 0.8, delay = 0, type = 'bandpass' }) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.02);
  }

  const sounds = {
    shot() {
      noise({ dur: 0.13, vol: 0.5, freq: 2600, q: 0.4 });
      tone({ freq: 160, freqEnd: 50, type: 'square', dur: 0.09, vol: 0.3 });
    },
    punch() {
      noise({ dur: 0.07, vol: 0.3, freq: 500, q: 1 });
    },
    crash(big) {
      noise({ dur: big ? 0.5 : 0.25, vol: big ? 0.6 : 0.35, freq: 300, q: 0.5, type: 'lowpass' });
      tone({ freq: 90, freqEnd: 35, type: 'triangle', dur: 0.3, vol: 0.3 });
    },
    pickup() {
      tone({ freq: 660, type: 'sine', dur: 0.09, vol: 0.22 });
      tone({ freq: 990, type: 'sine', dur: 0.14, vol: 0.22, delay: 0.07 });
    },
    cash() {
      tone({ freq: 880, type: 'triangle', dur: 0.08, vol: 0.2 });
      tone({ freq: 1320, type: 'triangle', dur: 0.16, vol: 0.2, delay: 0.06 });
    },
    door() {
      tone({ freq: 190, freqEnd: 120, type: 'triangle', dur: 0.1, vol: 0.25 });
    },
    splash() {
      noise({ dur: 0.4, vol: 0.3, freq: 900, q: 0.6 });
    },
    objective() {
      tone({ freq: 523, type: 'triangle', dur: 0.1, vol: 0.2 });
      tone({ freq: 784, type: 'triangle', dur: 0.18, vol: 0.2, delay: 0.09 });
    },
    fail() {
      tone({ freq: 220, freqEnd: 110, type: 'sawtooth', dur: 0.35, vol: 0.18 });
    },
    shell() {
      tone({ freq: 1174, type: 'sine', dur: 0.1, vol: 0.18 });
      tone({ freq: 1568, type: 'sine', dur: 0.2, vol: 0.18, delay: 0.08 });
    },
  };

  function setEngine(on, rpm) {
    if (!ensure()) return;
    if (on && !engine) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = ctx.createGain();
      gain.gain.value = 0.0;
      osc.connect(filter).connect(gain).connect(master);
      osc.start();
      engine = { osc, gain, filter };
    }
    if (engine) {
      const target = on ? 0.05 + rpm * 0.05 : 0;
      engine.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engine.osc.frequency.setTargetAtTime(55 + rpm * 165, ctx.currentTime, 0.05);
      engine.filter.frequency.setTargetAtTime(300 + rpm * 900, ctx.currentTime, 0.1);
    }
  }

  function setSiren(on) {
    if (!ensure()) return;
    if (on && !siren) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 800;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.7;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 160;
      lfo.connect(lfoGain).connect(osc.frequency);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(master);
      osc.start();
      lfo.start();
      siren = { osc, gain, lfo };
    }
    if (siren) siren.gain.gain.setTargetAtTime(on ? 0.028 : 0, ctx.currentTime, 0.2);
  }

  // A slow minor-key bass figure with a soft lead — synthwave wallpaper.
  const BASS = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 73.4, 0, 82.4, 0];
  function setMusic(on) {
    if (!ensure()) return;
    if (on && !music) {
      music = { step: 0, timer: setInterval(() => {
        if (!ctx || muted) return;
        const f = BASS[music.step % BASS.length];
        if (f) tone({ freq: f, type: 'triangle', dur: 0.32, vol: 0.16 });
        if (music.step % 8 === 0) tone({ freq: f * 4, type: 'sine', dur: 0.5, vol: 0.05 });
        music.step++;
      }, 240) };
    }
    if (!on && music) {
      clearInterval(music.timer);
      music = null;
    }
  }

  return {
    ensure,
    play(name, arg) {
      const fn = sounds[name];
      if (fn) fn(arg);
    },
    setEngine,
    setSiren,
    setMusic,
    toggleMute() {
      muted = !muted;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.03);
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
