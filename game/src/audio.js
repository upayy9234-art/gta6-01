// Procedural WebAudio: no audio files. Tiny synth blips for shots, crashes and
// mission jingles, plus a slow looping bassline that plays while driving.
// Everything is created lazily on the first user gesture.
export function createAudio() {
  let ctx = null; let muted = false; let musicTimer = 0; let note = 0;
  const bass = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, gain, when = 0) {
    const c = ensure(); if (!c || muted) return;
    const t = c.currentTime + when;
    const osc = c.createOscillator(); const g = c.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  function noise(dur, gain) {
    const c = ensure(); if (!c || muted) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain(); g.gain.value = gain;
    src.connect(g); g.connect(c.destination); src.start();
  }
  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
    shoot() { tone(880, 0.09, 'square', 0.08); noise(0.05, 0.05); },
    crash(strength = 0.5) { noise(0.18, 0.12 + strength * 0.15); tone(70, 0.2, 'sawtooth', 0.1); },
    hurt() { tone(160, 0.25, 'sawtooth', 0.12); },
    pickup() { tone(660, 0.08, 'sine', 0.1); tone(990, 0.12, 'sine', 0.1, 0.08); },
    mission() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.12, i * 0.1)); },
    siren() { tone(660, 0.22, 'square', 0.07); tone(520, 0.22, 'square', 0.07, 0.22); tone(660, 0.22, 'square', 0.07, 0.44); },
    rotor() { noise(0.3, 0.05); tone(58, 0.3, 'sawtooth', 0.05); },
    honk() { tone(370, 0.16, 'square', 0.09); tone(466, 0.16, 'square', 0.07); },
    // Cash register: two bright tones when Kai buys an upgrade or paint.
    buy() { tone(1320, 0.09, 'triangle', 0.12); tone(1760, 0.16, 'triangle', 0.12, 0.09); },
    // Low thud when a Portside crate is lifted.
    crate() { tone(90, 0.22, 'sawtooth', 0.14); noise(0.12, 0.1); },
    // Filtered-noise whoosh while the nitro is burning.
    nitro() { noise(0.35, 0.06); tone(220, 0.3, 'sawtooth', 0.04); tone(440, 0.28, 'sawtooth', 0.03, 0.1); },
    win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.14, i * 0.13)); },
    update(dt, driving) {
      if (muted) return;
      musicTimer -= dt;
      if (musicTimer <= 0) {
        musicTimer = driving ? 0.42 : 0.85;
        tone(bass[note % bass.length], 0.35, 'triangle', driving ? 0.06 : 0.035);
        if (note % 4 === 2) tone(bass[note % bass.length] * 2, 0.15, 'sine', 0.03);
        note += 1;
      }
    },
  };
}
