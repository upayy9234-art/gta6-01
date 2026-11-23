// Solstice Heat: Neon Tide — audio.js
// WebAudio synth only: engine, sirens, impacts, gunfire, pickups, procedural radio.
window.SH = window.SH || {};
SH.audio = (function () {
  'use strict';
  var ctx = null, master = null, muted = false;
  var engineOsc = null, engineGain = null, engineFilter = null;
  var sirenOsc = null, sirenGain = null, sirenPhase = 0;
  var rainNode = null, rainGain = null;
  var radioTimer = 0, radioStep = 0, radioOn = true, station = 0;
  var STATIONS = [
    { name: 'Neon Waves FM', bpm: 96, root: 45, scale: [0, 3, 5, 7, 10, 12], wave: 'sawtooth', bass: [0, 0, 7, 5] },
    { name: 'Sol Latina', bpm: 112, root: 50, scale: [0, 2, 4, 7, 9, 12], wave: 'triangle', bass: [0, 7, 4, 9] },
    { name: 'Tide Rock', bpm: 128, root: 40, scale: [0, 2, 3, 5, 7, 8, 10], wave: 'square', bass: [0, 0, 3, 5] }
  ];
  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      startEngine(); startRain();
    } catch (e) { ctx = null; }
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!ctx || muted) return;
    var t = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noiseBurst(dur, vol, freq, delay) {
    if (!ctx || muted) return;
    var t = ctx.currentTime + (delay || 0);
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = 0.8;
    var g = ctx.createGain(); g.gain.value = vol || 0.25;
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }
  function startEngine() {
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
    engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 320;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
    engineOsc.start();
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
  }
  function startRain() {
    var len = ctx.sampleRate * 2;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    rainNode = ctx.createBufferSource(); rainNode.buffer = buf; rainNode.loop = true;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    rainGain = ctx.createGain(); rainGain.gain.value = 0;
    rainNode.connect(f); f.connect(rainGain); rainGain.connect(master); rainNode.start();
  }
  function setEngine(rpm01, active) {
    if (!ctx) return;
    var target = active ? 0.05 + rpm01 * 0.09 : 0;
    engineGain.gain.setTargetAtTime(muted ? 0 : target, ctx.currentTime, 0.08);
    engineOsc.frequency.setTargetAtTime(50 + rpm01 * 160, ctx.currentTime, 0.05);
    engineFilter.frequency.setTargetAtTime(280 + rpm01 * 900, ctx.currentTime, 0.1);
  }
  function setSiren(on, dist) {
    if (!ctx) return;
    sirenPhase += 0.12;
    var v = on ? Math.max(0, 0.06 - (dist || 0) * 0.0004) : 0;
    sirenGain.gain.setTargetAtTime(muted ? 0 : v, ctx.currentTime, 0.1);
    sirenOsc.frequency.setTargetAtTime(650 + Math.sin(sirenPhase) * 220, ctx.currentTime, 0.05);
  }
  function setRain(amount) { if (ctx && rainGain) rainGain.gain.setTargetAtTime(muted ? 0 : amount * 0.10, ctx.currentTime, 0.4); }
  function skid(v) { if (v > 0.3) noiseBurst(0.08, 0.05 * v, 2400); }
  function crash(v) { noiseBurst(0.25, Math.min(0.5, 0.12 + v * 0.03), 300); tone(70, 0.3, 'sine', 0.3, 35); }
  function gunshot() { noiseBurst(0.09, 0.4, 1800); tone(160, 0.08, 'square', 0.15, 60); }
  function melee() { noiseBurst(0.07, 0.2, 500); }
  function pickup() { tone(880, 0.12, 'sine', 0.18); tone(1320, 0.18, 'sine', 0.16, null, 0.07); }
  function cash() { tone(1200, 0.08, 'triangle', 0.2); tone(1600, 0.14, 'triangle', 0.18, null, 0.06); }
  function click() { tone(660, 0.05, 'square', 0.08); }
  function fail() { tone(220, 0.25, 'sawtooth', 0.15, 110); }
  function success() { tone(523, 0.12, 'triangle', 0.2); tone(659, 0.12, 'triangle', 0.2, null, 0.1); tone(784, 0.25, 'triangle', 0.22, null, 0.2); }
  function horn() { tone(370, 0.3, 'square', 0.12); tone(466, 0.3, 'square', 0.10); }
  function splash() { noiseBurst(0.3, 0.2, 700); }
  function cycleStation() { station = (station + 1) % (STATIONS.length + 1); radioOn = station < STATIONS.length; return radioOn ? STATIONS[station].name : 'Radio Off'; }
  function stationName() { return radioOn ? STATIONS[station].name : 'Radio Off'; }
  function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function updateRadio(dt, driving) {
    if (!ctx || muted || !radioOn || !driving) return;
    radioTimer -= dt;
    if (radioTimer > 0) return;
    var st = STATIONS[station];
    radioTimer = 60 / st.bpm / 2;
    var bar = Math.floor(radioStep / 8) % 4;
    if (radioStep % 2 === 0) tone(midiHz(st.root + st.bass[bar] - 12), 0.22, 'triangle', 0.10);
    if (radioStep % 4 === 2) tone(midiHz(st.root + st.scale[(radioStep * 3) % st.scale.length] + 12), 0.18, st.wave, 0.045);
    if (radioStep % 8 === 6) noiseBurst(0.03, 0.03, 6000);
    radioStep++;
  }
  function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.55; return muted; }
  return {
    init: init, resume: resume, tone: tone, noiseBurst: noiseBurst,
    setEngine: setEngine, setSiren: setSiren, setRain: setRain,
    skid: skid, crash: crash, gunshot: gunshot, melee: melee, pickup: pickup,
    cash: cash, click: click, fail: fail, success: success, horn: horn, splash: splash,
    cycleStation: cycleStation, stationName: stationName, updateRadio: updateRadio,
    toggleMute: toggleMute, isMuted: function () { return muted; },
    stations: STATIONS
  };
})();
