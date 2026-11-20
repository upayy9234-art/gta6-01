// ============================================================================
// SOLSTICE HEAT — audio.js
// Everything is synthesized with WebAudio, no audio files: a slow tropical
// synthwave pad loop for music, an oscillator engine that follows the car's
// rpm, a two-tone police siren, and one-shot effects (gunshot, crash, cash,
// door, footsteps, jingles). The context only starts after the first user
// gesture, as browsers require.
// Round 11: mission/job success stingers (a brighter four-note lift plus a
// level-up arpeggio), a second detuned engine oscillator whose hum tracks
// road speed (not just rpm), and a siren whose pitch centre and wail rate
// ease off as the nearest cruiser falls behind — distance you can hear.
// ============================================================================
(function () {
'use strict';
window.SH = window.SH || {};

var ctx = null;
var master = null;
var musicGain = null;
var engineOsc = null, engineFilter = null, engineGain = null;
var humOsc = null, humGain = null;          // Round 11: speed hum layer
var sirenOsc = null, sirenGain = null, sirenLfo = null;
var muted = false;
var musicTimer = null;
var chordStep = 0;
var sirenLevel = 0;                          // smoothed siren loudness 0..1

// Am7 — Fmaj7 — Cmaj7 — G6: warm, coastal, slightly melancholic.
var CHORDS = [
  [110.00, 164.81, 196.00, 261.63],   // Am7
  [87.31, 130.81, 174.61, 220.00],    // Fmaj7
  [130.81, 164.81, 196.00, 246.94],   // Cmaj7
  [98.00, 146.83, 196.00, 293.66]     // G6
];
var BASS = [55.00, 43.65, 65.41, 49.00]; // A1 F1 C2 G1

function ensureCtx() {
  if (ctx) return true;
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.55;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.5;
  musicGain.connect(master);
  return true;
}

function padChord(freqs, when, dur) {
  // Two detuned triangles per note through a gentle lowpass = cheap pad.
  var filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  filter.Q.value = 0.4;
  var g = ctx.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(0.05, when + dur * 0.3);
  g.gain.linearRampToValueAtTime(0.0001, when + dur);
  filter.connect(g); g.connect(musicGain);
  for (var i = 0; i < freqs.length; i++) {
    for (var d = -1; d <= 1; d += 2) {
      var o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freqs[i];
      o.detune.value = d * 6;
      o.connect(filter);
      o.start(when); o.stop(when + dur + 0.1);
    }
  }
}

function bassNote(freq, when, dur) {
  var o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = freq;
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.16, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + dur);
  o.connect(g); g.connect(musicGain);
  o.start(when); o.stop(when + dur + 0.05);
  // a soft fifth on top for movement
  var o2 = ctx.createOscillator();
  o2.type = 'triangle';
  o2.frequency.value = freq * 3;
  var g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.03, when);
  g2.gain.exponentialRampToValueAtTime(0.001, when + dur * 0.6);
  o2.connect(g2); g2.connect(musicGain);
  o2.start(when); o2.stop(when + dur);
}

function scheduleMusic() {
  if (!ctx) return;
  var stepDur = 4.2; // seconds per chord
  function tick() {
    if (!ctx) return;
    var when = ctx.currentTime + 0.08;
    var chord = CHORDS[chordStep % CHORDS.length];
    padChord(chord, when, stepDur * 1.05);
    bassNote(BASS[chordStep % BASS.length], when, stepDur * 0.9);
    bassNote(BASS[chordStep % BASS.length], when + stepDur / 2, stepDur * 0.4);
    chordStep++;
    musicTimer = setTimeout(tick, stepDur * 1000);
  }
  tick();
}

function startEngine() {
  if (!ctx || engineOsc) return;
  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 55;
  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 320;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  engineOsc.connect(engineFilter);
  engineFilter.connect(engineGain);
  engineGain.connect(master);
  engineOsc.start();
  // Round 11: a soft sine hum an octave-ish above the fundamental. Its
  // pitch follows *speed* (wind/tyre energy), so coasting downhill at
  // speed sounds different from revving at a standstill.
  humOsc = ctx.createOscillator();
  humOsc.type = 'sine';
  humOsc.frequency.value = 82;
  humGain = ctx.createGain();
  humGain.gain.value = 0;
  humOsc.connect(humGain);
  humGain.connect(master);
  humOsc.start();
}

function startSiren() {
  if (!ctx || sirenOsc) return;
  sirenOsc = ctx.createOscillator();
  sirenOsc.type = 'triangle';
  sirenOsc.frequency.value = 950;
  sirenLfo = ctx.createOscillator();
  sirenLfo.type = 'square';
  sirenLfo.frequency.value = 0.55; // slow wail toggle
  var lfoGain = ctx.createGain();
  lfoGain.gain.value = 260;
  sirenLfo.connect(lfoGain);
  lfoGain.connect(sirenOsc.frequency);
  sirenGain = ctx.createGain();
  sirenGain.gain.value = 0;
  sirenOsc.connect(sirenGain);
  sirenGain.connect(master);
  sirenOsc.start(); sirenLfo.start();
}

// --- one-shots ---------------------------------------------------------------
function blip(freqA, freqB, dur, type, vol, when) {
  if (!ctx) return;
  var t = ctx.currentTime + (when || 0);
  var o = ctx.createOscillator();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freqA, t);
  if (freqB) o.frequency.exponentialRampToValueAtTime(freqB, t + dur);
  var g = ctx.createGain();
  g.gain.setValueAtTime(vol || 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noiseBurst(dur, filterFreq, vol, type) {
  if (!ctx) return;
  var t = ctx.currentTime;
  var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  var buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  var data = buffer.getChannelData(0);
  for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  var src = ctx.createBufferSource();
  src.buffer = buffer;
  var f = ctx.createBiquadFilter();
  f.type = type || 'lowpass';
  f.frequency.value = filterFreq;
  var g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
}

SH.Audio = {
  // Called from the first click / keypress on the title screen.
  unlock: function () {
    if (!ensureCtx()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!musicTimer) scheduleMusic();
    startEngine();
    startSiren();
  },
  setMuted: function (m) {
    muted = m;
    if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.05);
    return muted;
  },
  isMuted: function () { return muted; },
  // rpm 0..1 while driving, -1 when on foot (engine silent). The optional
  // speedKmh argument drives the Round 11 hum layer.
  setEngine: function (rpm, speedKmh) {
    if (!ctx || !engineGain) return;
    var t = ctx.currentTime;
    if (rpm < 0) {
      engineGain.gain.setTargetAtTime(0, t, 0.1);
      if (humGain) humGain.gain.setTargetAtTime(0, t, 0.12);
      return;
    }
    engineOsc.frequency.setTargetAtTime(55 + rpm * 165, t, 0.05);
    engineFilter.frequency.setTargetAtTime(300 + rpm * 1400, t, 0.05);
    engineGain.gain.setTargetAtTime(0.05 + rpm * 0.05, t, 0.08);
    if (humOsc && humGain) {
      var spd = Math.abs(speedKmh || 0);
      humOsc.frequency.setTargetAtTime(70 + spd * 1.15, t, 0.09);
      humGain.gain.setTargetAtTime(Math.min(0.028, spd * 0.00045), t, 0.12);
    }
  },
  // level 0..1 by nearest police distance. Round 11: the wail also sags —
  // as level drops the centre pitch and toggle rate fall, so a cruiser
  // dropping behind literally sounds like it is giving up.
  setSiren: function (level) {
    if (!ctx || !sirenGain) return;
    sirenLevel += (level - sirenLevel) * 0.25;
    var t = ctx.currentTime;
    sirenGain.gain.setTargetAtTime(sirenLevel * 0.045, t, 0.15);
    if (sirenOsc) sirenOsc.frequency.setTargetAtTime(830 + sirenLevel * 190, t, 0.3);
    if (sirenLfo) sirenLfo.frequency.setTargetAtTime(0.34 + sirenLevel * 0.34, t, 0.3);
  },
  shot: function () { noiseBurst(0.16, 2600, 0.5, 'highpass'); blip(220, 40, 0.12, 'square', 0.25); },
  crash: function (hard) { noiseBurst(hard ? 0.4 : 0.2, 500, hard ? 0.6 : 0.3); blip(90, 35, 0.25, 'sine', 0.3); },
  cash: function () { blip(1320, 1320, 0.09, 'sine', 0.22); blip(1760, 1760, 0.14, 'sine', 0.22, 0.08); },
  door: function () { noiseBurst(0.07, 900, 0.25); blip(140, 90, 0.08, 'sine', 0.15); },
  pickup: function () { blip(660, 990, 0.12, 'triangle', 0.25); },
  step: function () { noiseBurst(0.045, 500, 0.05); },
  complete: function () {
    blip(523, 523, 0.14, 'triangle', 0.25);
    blip(659, 659, 0.14, 'triangle', 0.25, 0.12);
    blip(784, 784, 0.22, 'triangle', 0.28, 0.24);
  },
  // Round 11 stingers: a job lands softer than a story mission; a level-up
  // gets the full rising arpeggio so the player hears the rung change.
  jobDone: function () {
    blip(587, 587, 0.11, 'triangle', 0.22);
    blip(880, 880, 0.17, 'triangle', 0.24, 0.09);
  },
  levelUp: function () {
    blip(523, 523, 0.12, 'triangle', 0.24);
    blip(659, 659, 0.12, 'triangle', 0.24, 0.10);
    blip(784, 784, 0.12, 'triangle', 0.26, 0.20);
    blip(1046, 1046, 0.3, 'triangle', 0.28, 0.30);
  },
  nearMiss: function () { blip(1180, 1560, 0.07, 'sine', 0.10); },
  fail: function () { blip(330, 196, 0.35, 'sawtooth', 0.15); },
  busted: function () { blip(392, 392, 0.2, 'square', 0.15); blip(311, 233, 0.4, 'square', 0.15, 0.2); },
  wasted: function () { blip(220, 55, 0.9, 'sawtooth', 0.2); },
  wantedUp: function () { blip(880, 1174, 0.1, 'square', 0.12); }
};
})();
