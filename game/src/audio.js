// Procedural WebAudio: no audio files. Tiny synth blips for shots, crashes and
// mission jingles, plus a slow looping bassline that plays while driving.
// Everything is created lazily on the first user gesture.
// Radio: each station has a track list (see radio.js); the bassline swaps its
// root note per station so the music follows the dial. Storms get thunder,
// taxi rides get a chime and a payout arpeggio.
import { RADIO_STATIONS } from './config.js';

export const RADIO_TRACKS = RADIO_STATIONS.flatMap((st) => st.tracks.map((t) => st.name + ' · ' + t));

export function createAudio() {
  let ctx = null;
  let muted = false;
  let musicTimer = 0;
  let note = 0;
  const bass = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
  // One bass root per station: VNL low and warm, WAVE brighter, VPD terse.
  const stationRoots = [55, 65.41, 49];

  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain, when = 0) {
    const c = ensure();
    if (!c || muted) return;
    const t = c.currentTime + when;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, gain) {
    const c = ensure();
    if (!c || muted) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(c.destination);
    src.start();
  }

  function arpeggio(freqs, dur, type, gain, step) {
    freqs.forEach((f, i) => tone(f, dur, type, gain, i * step));
  }

  return {
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() { return muted; },
    shoot() {
      tone(880, 0.09, 'square', 0.08);
      noise(0.05, 0.05);
    },
    crash(strength = 0.5) {
      noise(0.18, 0.12 + strength * 0.15);
      tone(70, 0.2, 'sawtooth', 0.1);
    },
    hurt() { tone(160, 0.25, 'sawtooth', 0.12); },
    pickup() {
      tone(660, 0.08, 'sine', 0.1);
      tone(990, 0.12, 'sine', 0.1, 0.08);
    },
    mission() { arpeggio([523, 659, 784, 1046], 0.18, 'triangle', 0.12, 0.1); },
    siren() {
      tone(660, 0.22, 'square', 0.07);
      tone(520, 0.22, 'square', 0.07, 0.22);
      tone(660, 0.22, 'square', 0.07, 0.44);
    },
    rotor() {
      noise(0.3, 0.05);
      tone(58, 0.3, 'sawtooth', 0.05);
    },
    honk() {
      tone(370, 0.16, 'square', 0.09);
      tone(466, 0.16, 'square', 0.07);
    },
    // Cash register: two bright tones when Kai buys an upgrade or paint.
    buy() {
      tone(1320, 0.09, 'triangle', 0.12);
      tone(1760, 0.16, 'triangle', 0.12, 0.09);
    },
    // Low thud when a Portside crate is lifted.
    crate() {
      tone(90, 0.22, 'sawtooth', 0.14);
      noise(0.12, 0.1);
    },
    // Filtered-noise whoosh while the nitro is burning.
    nitro() {
      noise(0.35, 0.06);
      tone(220, 0.3, 'sawtooth', 0.04);
      tone(440, 0.28, 'sawtooth', 0.03, 0.1);
    },
    // Radio dial click + a short station-ident jingle when the station changes.
    tune() {
      noise(0.06, 0.08);
      tone(1046, 0.1, 'triangle', 0.09, 0.05);
      tone(1318, 0.14, 'triangle', 0.09, 0.15);
    },
    win() { arpeggio([523, 659, 784, 1046, 1318], 0.3, 'triangle', 0.14, 0.13); },
    // Thunder: long filtered noise plus a low roll, for storm flashes.
    thunder() {
      noise(1.4, 0.14);
      tone(55, 1.2, 'sawtooth', 0.08);
      tone(38, 1.4, 'sine', 0.1, 0.15);
    },
    // Taxi chime when a passenger climbs in; arpeggio when the fare pays.
    taxiPickup() {
      tone(880, 0.12, 'sine', 0.1);
      tone(1174, 0.18, 'sine', 0.1, 0.12);
    },
    taxiPaid() { arpeggio([988, 1174, 1318, 1568], 0.16, 'triangle', 0.11, 0.09); },
    update(dt, driving, station = 0) {
      if (muted) return;
      musicTimer -= dt;
      if (musicTimer <= 0) {
        musicTimer = driving ? 0.42 : 0.85;
        const root = stationRoots[station % stationRoots.length] ?? 55;
        const f = bass[note % bass.length] * (root / 55);
        tone(f, 0.35, 'triangle', driving ? 0.06 : 0.035);
        if (note % 4 === 2) tone(f * 2, 0.15, 'sine', 0.03);
        note += 1;
      }
    },
  };
}
