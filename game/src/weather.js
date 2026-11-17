// Dynamic weather for Virelia: a seeded state machine that drifts between
// CLEAR, RAIN, FOG and STORM every ~90–150 game seconds. Rain and storm make
// the roads slick (the car physics grip multiplier drops), fog cuts the view,
// and storms throw lightning — a flash on screen plus a thunder rumble.
// The sky, the lamps and the golden hour all read the weather through
// daynight.js, so a rainy sunset looks different from a clear one.
import { WEATHER } from './config.js';
import { hash01 } from './random.js';

export const WEATHER_KINDS = ['clear', 'rain', 'fog', 'storm'];

// Grip multiplier per kind: how much of the car's normal grip survives.
// Rain and storm are genuinely slick — braking distances grow.
export const WEATHER_GRIP = { clear: 1, rain: 0.82, fog: 0.95, storm: 0.78 };

export const WEATHER_LABELS = {
  clear: { icon: '☀️', text: 'CLEAR — dry roads, full grip' },
  rain: { icon: '🌧️', text: 'RAIN — roads slick, grip down' },
  fog: { icon: '🌫️', text: 'FOG — low visibility, drive careful' },
  storm: { icon: '⛈️', text: 'STORM — lightning, worst grip' },
};

export function gripFor(kind) {
  return WEATHER_GRIP[kind] ?? 1;
}

export function isWet(kind) {
  return kind === 'rain' || kind === 'storm';
}

export function createWeather(random) {
  return {
    kind: 'clear',
    // Seconds of game time until the next change of weather.
    timer: random.range(WEATHER.MIN_SPELL, WEATHER.MAX_SPELL),
    gripMul: 1,
    // Lightning flash brightness 0..1, decays every tick in a storm.
    flash: 0,
    flashTimer: random.range(6, 14),
    // How many spells have rolled past — the HUD can quote the count.
    spells: 0,
  };
}

// Pick the next kind: never the same twice in a row, clear is the most
// likely landing spot so the sun keeps coming back to Virelia.
function nextKind(random, current) {
  const roll = random.next();
  let kind;
  if (roll < 0.34) kind = 'clear';
  else if (roll < 0.62) kind = 'rain';
  else if (roll < 0.82) kind = 'fog';
  else kind = 'storm';
  if (kind === current) kind = current === 'clear' ? 'rain' : 'clear';
  return kind;
}

export function updateWeather(state, dt) {
  const w = state.weather;
  if (!w) return;
  w.timer -= dt;
  if (w.timer <= 0) {
    w.kind = nextKind(state.random, w.kind);
    w.timer = state.random.range(WEATHER.MIN_SPELL, WEATHER.MAX_SPELL);
    w.gripMul = gripFor(w.kind);
    w.spells += 1;
    if (w.kind === 'storm') {
      w.flash = 1;
      w.flashTimer = state.random.range(5, 10);
      state.audio?.thunder();
      state.bannerText = '⛈️ Storm rolling in over the harbour — roads are treacherous.';
      state.bannerTimer = 3.5;
    } else if (w.kind === 'rain') {
      state.bannerText = '🌧️ Rain over Virelia — the streets are slick now.';
      state.bannerTimer = 3;
    } else if (w.kind === 'fog') {
      state.bannerText = '🌫️ Fog drifting in off the water — visibility is down.';
      state.bannerTimer = 3;
    } else {
      state.bannerText = '☀️ The rain clears — Virelia dries out under the sun.';
      state.bannerTimer = 2.5;
    }
  }
  // Lightning: in a storm the sky flashes every few seconds.
  if (w.kind === 'storm') {
    w.flashTimer -= dt;
    if (w.flashTimer <= 0) {
      w.flash = 1;
      w.flashTimer = state.random.range(6, 18);
      state.audio?.thunder();
    }
  }
  w.flash = Math.max(0, w.flash - dt * 1.8);
}

// Force a kind at once (screenshot staging, tests). Resets the spell timer
// so the forced weather holds for a while instead of flipping instantly.
export function forceWeather(state, kind) {
  const w = state.weather;
  if (!w || !WEATHER_KINDS.includes(kind)) return false;
  w.kind = kind;
  w.gripMul = gripFor(kind);
  w.timer = state.random.range(WEATHER.MIN_SPELL, WEATHER.MAX_SPELL);
  w.flash = kind === 'storm' ? 0.8 : 0;
  w.flashTimer = state.random.range(6, 14);
  return true;
}

export function weatherLabel(state) {
  const kind = state.weather ? state.weather.kind : 'clear';
  return WEATHER_LABELS[kind] ?? WEATHER_LABELS.clear;
}

// Rain streaks for the renderer: deterministic per frame from a hash, so the
// rain never flickers or eats the seeded random stream. Each drop falls
// diagonally (wind off the harbour) and wraps around the screen.
export function rainDrops(time, count, width, height) {
  const drops = [];
  const bucket = Math.floor(time * 24);
  for (let i = 0; i < count; i += 1) {
    const hx = hash01(i, 11);
    const hy = hash01(i, 29);
    const speed = 620 + hash01(i, 47) * 260;
    const fall = (hy * height + time * speed) % height;
    const x = (hx * (width + 200) + time * 90) % (width + 200) - 100;
    const len = 14 + hash01(i, 61) * 12;
    drops.push({ x, y: fall, len, bucket });
  }
  return drops;
}

// Fog drift: a few slow translucent blobs, also hash-driven, no RNG use.
export function fogBlobs(time, count, width, height) {
  const blobs = [];
  for (let i = 0; i < count; i += 1) {
    const hx = hash01(i, 101);
    const hy = hash01(i, 137);
    const x = (hx * (width + 400) + time * 12 * (i % 2 === 0 ? 1 : -1)) % (width + 400) - 200;
    const y = hy * height;
    const r = 160 + hash01(i, 173) * 180;
    blobs.push({ x, y, r });
  }
  return blobs;
}
