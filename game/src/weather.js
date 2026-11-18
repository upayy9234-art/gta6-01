// Dynamic weather for Virelia: a small state machine that rolls a new sky
// every 90–150 game-seconds. Kinds: clear, rain, fog, storm. The only number
// gameplay reads is grip — rain and storm make the roads slick, fog mostly
// costs visibility. Everything else (rain streaks, fog banks, lightning) is
// presentation driven from the same state, so a screenshot and a save file
// always agree about what the sky is doing.
// Determinism: the spell timer and the kind roll use state.random (seeded);
// the raindrops and fog blobs are pure hash functions of time, so the
// renderer never eats the seeded random stream.
import { WEATHER } from './config.js';

export const WEATHER_KINDS = WEATHER.KINDS;

export function gripFor(kind) {
  return WEATHER.GRIP[kind] ?? 1;
}

export function isWet(kind) {
  return kind === 'rain' || kind === 'storm';
}

export function weatherLabelFor(kind) {
  switch (kind) {
    case 'rain': return '🌧️ RAIN — roads slick, grip down';
    case 'fog': return '🌫️ FOG — low visibility, drive careful';
    case 'storm': return '⛈️ STORM — lightning, worst grip';
    default: return '☀️ CLEAR — dry roads, full grip';
  }
}

export function weatherLabel(state) {
  return weatherLabelFor(state.weather ? state.weather.kind : 'clear');
}

function spellLength(random) {
  return random.range(WEATHER.MIN_SPELL, WEATHER.MAX_SPELL);
}

function rollKind(random, current) {
  const r = random.next();
  let next = r < 0.34 ? 'clear' : r < 0.62 ? 'rain' : r < 0.82 ? 'fog' : 'storm';
  // Never the same sky twice in a row: a repeat rolls over to the opposite.
  if (next === current) next = current === 'clear' ? 'rain' : 'clear';
  return next;
}

export function createWeather(random) {
  return {
    kind: 'clear',
    timer: spellLength(random),
    gripMul: 1,
    flash: 0,
    flashTimer: random.range(6, 14),
    spells: 0,
  };
}

function announceSpell(state, kind) {
  const w = state.weather;
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

export function updateWeather(state, dt) {
  const w = state.weather;
  if (!w) return;
  w.timer -= dt;
  if (w.timer <= 0) {
    const kind = rollKind(state.random, w.kind);
    w.kind = kind;
    w.timer = spellLength(state.random);
    w.gripMul = gripFor(kind);
    w.spells += 1;
    announceSpell(state, kind);
  }
  if (w.kind === 'storm') {
    w.flashTimer -= dt;
    if (w.flashTimer <= 0) {
      w.flash = 1;
      w.flashTimer = state.random.range(6, 18);
      state.audio?.thunder();
    }
  }
  if (w.flash > 0) w.flash = Math.max(0, w.flash - 1.8 * dt);
}

// Force one kind (screenshot staging and tests). Returns false for an
// unknown kind and leaves the weather untouched.
export function forceWeather(state, kind) {
  if (!WEATHER_KINDS.includes(kind)) return false;
  const w = state.weather;
  if (!w) return false;
  w.kind = kind;
  w.gripMul = gripFor(kind);
  w.timer = spellLength(state.random);
  w.flash = kind === 'storm' ? 0.8 : 0;
  w.flashTimer = state.random.range(6, 14);
  return true;
}

// --- Hash-driven precipitation (no RNG, safe to call every frame) ----------
// A cheap integer hash so each drop/blob is stable across frames.
function hash01(n) {
  let h = (Math.imul(n, 2654435761) ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function rainDrops(time, count, width, height) {
  const drops = [];
  for (let i = 0; i < count; i += 1) {
    const seed = hash01(i * 7 + 11);
    const speed = 620 + hash01(i * 13 + 3) * 260;
    const len = 14 + hash01(i * 17 + 5) * 12;
    const period = (height + 80) / speed;
    const phase = (time / period + seed) % 1;
    const y = -40 + phase * (height + 80);
    const x = (hash01(i * 19 + 23) * (width + 200) + time * 90) % (width + 200) - 100;
    drops.push({ x, y, len, speed });
  }
  return drops;
}

export function fogBlobs(time, count, width, height) {
  const blobs = [];
  for (let i = 0; i < count; i += 1) {
    const dir = i % 2 === 0 ? 1 : -1;
    const span = width + 500;
    const x = ((hash01(i * 29 + 7) * span + time * 12 * dir) % span + span) % span - 250;
    const y = 60 + hash01(i * 31 + 13) * (height - 120);
    const r = 160 + hash01(i * 37 + 17) * 180;
    blobs.push({ x, y, r });
  }
  return blobs;
}

// --- Mission score bonus for finishing a job in bad weather ----------------
// Rain pays +50, storm +100 (score only — cash never changes).
export function weatherBonus(state) {
  const kind = state.weather ? state.weather.kind : 'clear';
  if (kind === 'storm') return 100;
  if (kind === 'rain') return 50;
  return 0;
}
