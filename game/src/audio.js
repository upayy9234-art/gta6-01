// Solstice Heat — audio.js
// Fully procedural WebAudio sound: two radio stations built from
// oscillators and chord sequencers, engine hum tied to speed, police
// sirens, weather noise (rain/wind) and short UI / gameplay effects.
// No audio assets are loaded; everything is synthesised lazily after
// the first user gesture unlocks the AudioContext.
(function () {
  "use strict";
  window.SH = window.SH || {};

  var ctx = null;
  var master = null;
  var radioGain = null;
  var engineOsc = null;
  var engineGain = null;
  var sirenOsc = null;
  var sirenGain = null;
  var noiseGain = null;
  var started = false;

  var radio = {
    station: 0,
    playing: false,
    step: 0,
    timer: null,
    nextNoteTime: 0
  };

  var STATIONS = [
    {
      name: "SOLSTICE FM",
      genre: "Sunset Pop",
      bpm: 104,
      wave: "triangle",
      scale: [0, 2, 4, 7, 9],
      root: 220,
      chords: [
        [0, 4, 7],
        [5, 9, 12],
        [7, 11, 14],
        [4, 7, 11]
      ]
    },
    {
      name: "NEON WIRE",
      genre: "Night Drive Synth",
      bpm: 122,
      wave: "sawtooth",
      scale: [0, 3, 5, 7, 10],
      root: 196,
      chords: [
        [0, 3, 7],
        [0, 3, 10],
        [8, 12, 15],
        [5, 8, 12]
      ]
    }
  ];

  function ensureContext() {
    if (ctx) {
      return true;
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        return false;
      }
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
      radioGain = ctx.createGain();
      radioGain.gain.value = 0.0;
      radioGain.connect(master);
      return true;
    } catch (err) {
      return false;
    }
  }

  function noteFreq(root, semitone) {
    return root * Math.pow(2, semitone / 12);
  }

  function playTone(freq, time, dur, wave, vol, dest) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    gain.connect(dest || radioGain);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  function playBass(freq, time, dur, vol) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq / 2;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    gain.connect(radioGain);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  function scheduleStep() {
    if (!radio.playing || !ctx) {
      return;
    }
    var st = STATIONS[radio.station];
    var spb = 60 / st.bpm / 2;
    while (radio.nextNoteTime < ctx.currentTime + 0.18) {
      var step = radio.step;
      var bar = Math.floor(step / 8) % st.chords.length;
      var chord = st.chords[bar];
      var t = radio.nextNoteTime;
      if (step % 8 === 0) {
        var i;
        for (i = 0; i < chord.length; i++) {
          playTone(noteFreq(st.root, chord[i]), t, spb * 7, st.wave, 0.05);
        }
        playBass(noteFreq(st.root, chord[0]), t, spb * 7, 0.16);
      }
      if (step % 2 === 0) {
        var degree = st.scale[step % st.scale.length];
        var oct = step % 16 >= 8 ? 12 : 0;
        playTone(noteFreq(st.root, degree + 12 + oct), t, spb * 0.9, st.wave, 0.07);
      }
      if (step % 4 === 2) {
        playNoiseBurst(t, 0.03, 0.05, 6000);
      }
      radio.step += 1;
      radio.nextNoteTime += spb;
    }
  }

  function playNoiseBurst(time, dur, vol, cutoff) {
    if (!ctx) {
      return;
    }
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    var i;
    for (i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    var src = ctx.createBufferSource();
    src.buffer = buffer;
    var filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = cutoff || 4000;
    var gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(radioGain);
    src.start(time);
  }

  function startEngine() {
    engineOsc = ctx.createOscillator();
    engineOsc.type = "sawtooth";
    engineOsc.frequency.value = 55;
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function startSiren() {
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = "triangle";
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
  }

  function startWeatherNoise() {
    var len = ctx.sampleRate * 2;
    var buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    var i;
    var last = 0;
    for (i = 0; i < len; i++) {
      var white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    var src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    var filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900;
    noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;
    src.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(master);
    src.start();
  }

  function unlock() {
    if (!ensureContext()) {
      return;
    }
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    if (!started) {
      started = true;
      startEngine();
      startSiren();
      startWeatherNoise();
      radio.timer = window.setInterval(scheduleStep, 40);
    }
  }

  function setRadio(on, stationIndex) {
    unlock();
    if (!ctx) {
      return;
    }
    if (typeof stationIndex === "number") {
      radio.station = stationIndex % STATIONS.length;
      radio.step = 0;
    }
    radio.playing = !!on;
    radioGain.gain.setTargetAtTime(on ? 0.5 : 0.0, ctx.currentTime, 0.2);
    if (on) {
      radio.nextNoteTime = ctx.currentTime + 0.06;
    }
  }

  function cycleRadio() {
    if (!radio.playing) {
      setRadio(true, 0);
      return STATIONS[0];
    }
    if (radio.station === 0) {
      setRadio(true, 1);
      return STATIONS[1];
    }
    setRadio(false);
    return null;
  }

  function setEngine(speedRatio, inCar) {
    if (!ctx || !engineOsc) {
      return;
    }
    var target = inCar ? 0.05 + Math.abs(speedRatio) * 0.08 : 0;
    engineOsc.frequency.setTargetAtTime(
      55 + Math.abs(speedRatio) * 130, ctx.currentTime, 0.08);
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
  }

  function setSiren(active, distance) {
    if (!ctx || !sirenOsc) {
      return;
    }
    if (!active) {
      sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      return;
    }
    var t = ctx.currentTime;
    var wail = 700 + Math.sin(t * 2.4) * 180;
    sirenOsc.frequency.setTargetAtTime(wail, t, 0.05);
    var vol = Math.max(0, 0.12 - (distance || 0) * 0.0012);
    sirenGain.gain.setTargetAtTime(vol, t, 0.1);
  }

  function setWeatherNoise(kind) {
    if (!ctx || !noiseGain) {
      return;
    }
    var vol = 0;
    if (kind === "rain") { vol = 0.05; }
    if (kind === "storm") { vol = 0.1; }
    if (kind === "haze") { vol = 0.012; }
    noiseGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.4);
  }

  function blip(freq, dur, vol, wave) {
    if (!ensureContext() || !started) {
      return;
    }
    playTone(freq, ctx.currentTime, dur || 0.12, wave || "square", vol || 0.08, master);
  }

  var sfx = {
    pickup: function () { blip(880, 0.12, 0.09); blip(1320, 0.16, 0.07); },
    cash: function () { blip(1046, 0.1, 0.09); blip(1568, 0.18, 0.08); },
    fail: function () { blip(196, 0.3, 0.1, "sawtooth"); },
    success: function () {
      blip(523, 0.12, 0.09);
      blip(659, 0.12, 0.09);
      blip(784, 0.22, 0.1);
    },
    shot: function () { playNoiseBurst(ctx ? ctx.currentTime : 0, 0.09, 0.22, 900); },
    punch: function () { playNoiseBurst(ctx ? ctx.currentTime : 0, 0.06, 0.16, 500); },
    crash: function () { playNoiseBurst(ctx ? ctx.currentTime : 0, 0.25, 0.2, 300); },
    door: function () { blip(240, 0.08, 0.07, "triangle"); },
    checkpoint: function () { blip(1174, 0.14, 0.09); },
    shutter: function () {
      playNoiseBurst(ctx ? ctx.currentTime : 0, 0.03, 0.18, 2500);
      blip(1800, 0.05, 0.05);
    },
    sirenOn: function () { blip(700, 0.2, 0.06, "triangle"); }
  };

  window.SH.audio = {
    unlock: unlock,
    setRadio: setRadio,
    cycleRadio: cycleRadio,
    setEngine: setEngine,
    setSiren: setSiren,
    setWeatherNoise: setWeatherNoise,
    stations: STATIONS,
    radioState: radio,
    sfx: sfx
  };
})();
