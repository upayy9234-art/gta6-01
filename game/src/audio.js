// Solstice Heat - procedural WebAudio: engine, sirens, music, ambience.
// Nothing is sampled; every sound is synthesized so the game ships as
// static files with zero network requests.
window.SH = window.SH || {};
(function (SH) {
  'use strict';
  var A = { ctx: null, muted: false, started: false, station: 0, musicTimer: 0, step: 0 };
  SH.Audio = A;
  A.init = function () {
    if (A.started) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      A.ctx = new AC(); A.started = true;
      A.master = A.ctx.createGain(); A.master.gain.value = 0.5; A.master.connect(A.ctx.destination);
      A.engineOsc = A.ctx.createOscillator(); A.engineOsc.type = 'sawtooth'; A.engineOsc.frequency.value = 60;
      A.engineGain = A.ctx.createGain(); A.engineGain.gain.value = 0;
      A.engineOsc.connect(A.engineGain); A.engineGain.connect(A.master); A.engineOsc.start();
      A.sirenOsc = A.ctx.createOscillator(); A.sirenOsc.type = 'triangle'; A.sirenOsc.frequency.value = 700;
      A.sirenGain = A.ctx.createGain(); A.sirenGain.gain.value = 0;
      A.sirenOsc.connect(A.sirenGain); A.sirenGain.connect(A.master); A.sirenOsc.start();
    } catch (e) { /* audio is optional */ }
  };
  function beep(freq, dur, type, vol, slideTo) {
    if (!A.ctx || A.muted) return;
    var t = A.ctx.currentTime, o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(A.master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq) {
    if (!A.ctx || A.muted) return;
    var t = A.ctx.currentTime, len = Math.floor(A.ctx.sampleRate * dur);
    var buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = A.ctx.createBufferSource(); src.buffer = buf;
    var f = A.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 800;
    var g = A.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(A.master); src.start(t);
  }
  A.blip = function () { beep(880, 0.07, 'square', 0.08); };
  A.cash = function () { beep(990, 0.09, 'square', 0.1); setTimeout(function () { beep(1320, 0.12, 'square', 0.1); }, 70); };
  A.shot = function () { noise(0.14, 0.3, 400); beep(160, 0.1, 'sawtooth', 0.15, 60); };
  A.hit = function () { noise(0.1, 0.2, 300); };
  A.crash = function (hard) { noise(hard ? 0.4 : 0.2, hard ? 0.4 : 0.2, 220); beep(90, 0.25, 'sawtooth', 0.15, 40); };
  A.skid = function () { noise(0.18, 0.06, 2400); };
  A.step = function () { noise(0.05, 0.04, 500); };
  A.thunder = function () { noise(1.4, 0.5, 120); beep(55, 1.1, 'sine', 0.3, 30); };
  A.collect = function () { beep(660, 0.08, 'sine', 0.12); setTimeout(function () { beep(990, 0.14, 'sine', 0.12); }, 80); };
  A.door = function () { beep(220, 0.08, 'square', 0.07, 180); };
  A.countBeep = function (final) { beep(final ? 880 : 440, final ? 0.3 : 0.12, 'square', 0.14); };
  // Procedural music sequencer: bass + pad + hats, two stations.
  var BASS = [55, 55, 65.4, 49, 55, 55, 73.4, 82.4];
  var PAD = [220, 261.6, 196, 246.9];
  A.update = function (dt, speed, inCar, sirenNear) {
    if (!A.ctx) return;
    var t = A.ctx.currentTime;
    if (A.engineGain) A.engineGain.gain.value = A.muted ? 0 : (inCar ? 0.05 + Math.min(0.1, Math.abs(speed) * 0.003) : 0);
    if (A.engineOsc && inCar) A.engineOsc.frequency.value = 55 + Math.abs(speed) * 3.2;
    if (A.sirenGain) A.sirenGain.gain.value = A.muted ? 0 : (sirenNear ? 0.035 : 0);
    if (A.sirenOsc) A.sirenOsc.frequency.value = 650 + Math.sin(t * 4.2) * 220;
    A.musicTimer -= dt;
    if (A.musicTimer <= 0 && !A.muted) {
      A.musicTimer = 0.24; A.step++;
      var bar = Math.floor(A.step / 8) % 4;
      if (A.step % 2 === 0) beep(BASS[bar * 2 % BASS.length], 0.22, 'triangle', 0.09);
      if (A.step % 8 === 0) beep(PAD[bar], 0.9, 'sine', 0.05);
      if (A.step % 2 === 1) noise(0.03, 0.02, 6000);
      if (A.station === 1 && A.step % 16 === 0) beep(520, 0.1, 'sine', 0.05, 390);
    }
  };
  A.toggleMute = function () { A.muted = !A.muted; if (A.master) A.master.gain.value = A.muted ? 0 : 0.5; return A.muted; };
  A.cycleStation = function () { A.station = (A.station + 1) % SH.Config.RADIO_STATIONS.length; return SH.Config.RADIO_STATIONS[A.station]; };
})(window.SH);
