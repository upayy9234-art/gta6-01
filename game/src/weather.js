// Dynamic weather: Virelia's sky rolls through spells of clear, rain, fog
// and storm, each lasting a couple of game minutes and each changing how the
// city drives. Rain and storm make the roads slick (grip down, longer stops),
// fog cuts visibility, storms flash lightning and rumble thunder. The kind
// never repeats twice in a row, and a spell change always tells Kai with a
// banner — the weather is a system the player plans around, not wallpaper.
import { WEATHER, WEATHER_GRIP } from './config.js';
import { hash01 } from './random.js';

export const WEATHER_KINDS = ['clear', 'rain', 'fog', 'storm'];
export const WEATHER_LABELS = {
  clear: '☀️ CLEAR — dry roads, full grip',
  rain: '🌧️ RAIN — roads slick, grip down',
  fog: '🌫️ FOG — low visibility, drive careful',
  storm: '⛈️ STORM — lightning, worst grip',
};

export function gripFor(kind) {
  return WEATHER_GRIP[kind] ?? 1;
}

export function isWet(kind) {
  return kind === 'rain' || kind === 'storm';
}

function randomSpell(random) {
  return random.range(WEATHER.MIN_SPELL, WEATHER.MAX_SPELL);
}

export function createWeather(random) {
  return {
    kind: 'clear',
    timer: randomSpell(random),
    gripMul: 1,
    flash: 0,
    flashTimer: random.range(6, 14),
    spells: 0,
  };
}

// Pick the next kind: a weighted roll that never lands on the kind that is
// already overhead — a repeat folds into rain after clear, clear otherwise.
export function nextWeatherKind(random, current) {
  const roll = random.next();
  let kind = roll < 0.34 ? 'clear' : roll < 0.62 ? 'rain' : roll < 0.82 ? 'fog' : 'storm';
  if (kind === current) kind = current === 'clear' ? 'rain' : 'clear';
  return kind;
}

export function updateWeather(state, dt) {
  const w = state.weather;
  if (!w) return;
  // Lightning fades fast once it has flashed.
  w.flash = Math.max(0, w.flash - 1.8 * dt);
  // A storm keeps throwing bolts while it lasts.
  if (w.kind === 'storm') {
    w.flashTimer -= dt;
    if (w.flashTimer <= 0) {
      w.flash = 1;
      w.flashTimer = state.random.range(6, 18);
      state.audio?.thunder();
    }
  }
  w.timer -= dt;
  if (w.timer > 0) return;
  // The spell turns: new kind, fresh timer, a banner Kai can plan around.
  const kind = nextWeatherKind(state.random, w.kind);
  w.kind = kind;
  w.timer = randomSpell(state.random);
  w.gripMul = gripFor(kind);
  w.spells += 1;
  if (kind === 'storm') {
    state.bannerText = '⛈️ Storm rolling in over the harbour — roads are treacherous.';
    state.bannerTimer = 3.5;
    w.flash = 1;
    w.flashTimer = state.random.range(5, 10);
    state.audio?.thunder();
  } else if (kind === 'rain') {
    state.bannerText = '🌧️ Rain over Virelia — the streets are slick now.';
    state.bannerTimer = 3;
  } else if (kind === 'fog') {
    state.bannerText = '🌫️ Fog drifting in off the water — visibility is down.';
    state.bannerTimer = 3;
  } else {
    state.bannerText = '☀️ The rain clears — Virelia dries out under the sun.';
    state.bannerTimer = 2.5;
  }
}

// Force a kind (screenshot staging, tests, save restore). Returns false for
// an unknown kind and changes nothing.
export function forceWeather(state, kind) {
  const w = state.weather;
  if (!w || !WEATHER_KINDS.includes(kind)) return false;
  w.kind = kind;
  w.gripMul = gripFor(kind);
  w.timer = randomSpell(state.random);
  w.flash = kind === 'storm' ? 0.8 : 0;
  w.flashTimer = state.random.range(6, 14);
  return true;
}

export function weatherLabel(state) {
  const kind = state.weather?.kind ?? 'clear';
  return WEATHER_LABELS[kind] ?? WEATHER_LABELS.clear;
}

// Deterministic rain: every drop's home comes from a hash, so the same time
// always paints the same streaks — no per-frame random stream use. Drops
// fall fast and drift sideways with the wind, wrapping around the screen.
export function rainDrops(time, count, width, height) {
  const drops = [];
  for (let i = 0; i < count; i += 1) {
    const speed = 620 + hash01(i, 11) * 260;
    const len = 14 + hash01(i, 23) * 12;
    const x = (hash01(i, 3) * width + time * 90) % width;
    const y = (hash01(i, 7) * height + time * speed) % height;
    drops.push({ x, y, len });
  }
  return drops;
}

// Deterministic fog: big soft blobs that drift slowly, alternating direction
// so the haze never slides as one sheet.
export function fogBlobs(time, count, width, height) {
  const blobs = [];
  for (let i = 0; i < count; i += 1) {
    const radius = 160 + hash01(i, 31) * 180;
    const dir = i % 2 === 0 ? 1 : -1;
    const x = (hash01(i, 5) * (width + 400) + time * 12 * dir) % (width + 400) - 200;
    const y = hash01(i, 13) * height;
    blobs.push({ x, y, radius });
  }
  return blobs;
}
