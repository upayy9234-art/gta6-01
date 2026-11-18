// The day/night cycle for Virelia. timeOfDay is minutes after midnight; the
// sky, lamps, neon, stars, sun and moon all follow it, and the day counter
// ticks over every time the clock wraps past midnight. Golden hour runs
// 17:30–19:00: warm orange horizon, low sun, long shadows. The game opens
// at 18:05, right in the middle of it.
// Weather (weather.js) is an optional second argument to skyState and the
// celestial painters: a storm darkens the sky and dims the sun, rain dulls
// the gold, fog softens everything, and only a clear sky shows stars.
import { GOLDEN_END, GOLDEN_START } from './config.js';

const PHASES = [
  { until: 300, id: 'night', label: 'NIGHT' },
  { until: 420, id: 'dawn', label: 'DAWN' },
  { until: GOLDEN_START, id: 'day', label: 'DAY' },
  { until: GOLDEN_END, id: 'golden', label: 'GOLDEN HOUR' },
  { until: 1260, id: 'dusk', label: 'DUSK' },
  { until: 1440, id: 'night', label: 'NIGHT' },
];

export function dayPhase(t) {
  for (const phase of PHASES) if (t < phase.until) return phase.id;
  return 'night';
}

export function phaseLabel(t) {
  for (const phase of PHASES) if (t < phase.until) return phase.label;
  return 'NIGHT';
}

// Smoothstep between two minute marks — 0 before, 1 after, eased between.
function ramp(a, b, t) {
  if (t <= a) return 0;
  if (t >= b) return 1;
  const f = (t - a) / (b - a);
  return f * f * (3 - 2 * f);
}

export function daylight(t) {
  // 0 at night, smooth ramps through dawn (05:00–07:00) and dusk (18:00–21:00).
  // At the 18:05 golden-hour start the light is still high — warm, not dark.
  if (t < 300 || t >= 1260) return 0;
  if (t < 420) return ramp(300, 420, t);
  if (t < 1080) return 1;
  return 1 - ramp(1080, 1260, t);
}

// 0 outside golden hour, 1 at its heart (18:15), smooth shoulders.
export function goldenFactor(t) {
  if (t < GOLDEN_START || t > GOLDEN_END) return 0;
  const mid = (GOLDEN_START + GOLDEN_END) / 2;
  const half = (GOLDEN_END - GOLDEN_START) / 2;
  const d = 1 - Math.abs(t - mid) / half;
  return d * d * (3 - 2 * d);
}

// Shadow length multiplier: 1 at noon, ~3.4x at golden hour, 0 at night.
export function shadowStretch(t) {
  const light = daylight(t);
  if (light <= 0.02) return 0;
  return 1 + goldenFactor(t) * 2.4;
}

const HORIZON_BY_PHASE = {
  dawn: '#c97a35', golden: '#ff7a3d', dusk: '#b34a6e', night: '#0a1030', day: '#1a2440',
};

// How each weather kind bends the sky. `dim` scales the golden-hour gold,
// `dark` adds night tint, `sun` dims the sun disc, `stars` gates starlight.
const WEATHER_SKY = {
  clear: { dim: 1, dark: 0, sun: 1, stars: 1 },
  rain: { dim: 0.4, dark: 0.12, sun: 0.65, stars: 0 },
  fog: { dim: 0.7, dark: 0.06, sun: 0.85, stars: 0 },
  storm: { dim: 0.25, dark: 0.22, sun: 0.45, stars: 0 },
};

export function skyState(t, weather) {
  const light = daylight(t);
  const phase = dayPhase(t);
  const goldenRaw = goldenFactor(t);
  const w = WEATHER_SKY[weather?.kind] ?? WEATHER_SKY.clear;
  const golden = goldenRaw * w.dim;
  return {
    light,
    phase,
    golden,
    nightAlpha: 0.30 * (1 - light) + w.dark,
    // Warm wash over the whole frame while the sun is low.
    warmAlpha: 0.12 * golden,
    lampGlow: 0.16 + 0.14 * (1 - light) + 0.05 * golden,
    lampRadius: 26 + 18 * (1 - light),
    neonBoost: 0.55 + 0.45 * (1 - light) + 0.25 * golden,
    starAlpha: w.stars ? Math.max(0, 0.9 - light * 1.6) : 0,
    sunDim: w.sun,
    horizon: HORIZON_BY_PHASE[phase] ?? '#1a2440',
  };
}

// Deterministic stars from a fixed LCG seed, so the sky is identical every
// frame and every run — no flicker, no per-frame randomness.
export function starPositions(count, width, height) {
  let s = 20261118;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: next() * width,
      y: next() * height * 0.62,
      r: 0.6 + next() * 1.4,
      tw: next() * Math.PI * 2,
    });
  }
  return stars;
}

export function createDayNight() {
  return { prev: null };
}

export function updateDayNight(state) {
  const dn = state.dayNight;
  if (!dn) return;
  if (dn.prev === null) { dn.prev = state.timeOfDay; return; }
  // The clock wrapped past midnight: a new day in Virelia.
  if (state.timeOfDay < dn.prev) state.day += 1;
  dn.prev = state.timeOfDay;
}

export function drawStars(ctx, state, w, h) {
  const sky = skyState(state.timeOfDay, state.weather);
  if (sky.starAlpha <= 0.02) return;
  const stars = starPositions(90, w, h);
  ctx.save();
  for (const star of stars) {
    const twinkle = 0.55 + 0.45 * Math.sin(state.time * 2 + star.tw);
    ctx.globalAlpha = sky.starAlpha * twinkle;
    ctx.fillStyle = '#e8ecff';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawMoon(ctx, state, width) {
  const sky = skyState(state.timeOfDay, state.weather);
  if (sky.starAlpha <= 0.05) return;
  const mx = width - 190, my = 96;
  ctx.save();
  ctx.globalAlpha = 0.22 * sky.starAlpha + 0.08;
  ctx.fillStyle = '#cdd6ff';
  ctx.beginPath(); ctx.arc(mx, my, 46, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = Math.min(1, 0.55 + sky.starAlpha * 0.5);
  ctx.fillStyle = '#e8ecf7';
  ctx.beginPath(); ctx.arc(mx, my, 30, 0, Math.PI * 2); ctx.fill();
  // Craters.
  ctx.fillStyle = '#c3cbdd';
  for (const [dx, dy, r] of [[-9, -6, 6], [8, 8, 4.5], [3, -13, 3.5]]) {
    ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function sunPosition(t, width) {
  const frac = Math.max(0, Math.min(1, (t - 420) / 660));
  return {
    x: 80 + frac * (width - 160),
    y: 150 - Math.sin(frac * Math.PI) * 70,
    frac,
  };
}

export function drawSun(ctx, state, width) {
  const light = daylight(state.timeOfDay);
  if (light <= 0.02) return;
  const sky = skyState(state.timeOfDay, state.weather);
  const pos = sunPosition(state.timeOfDay, width);
  const golden = goldenFactor(state.timeOfDay);
  const y = Math.min(190, pos.y + golden * 60);
  ctx.save();
  // Golden-hour sun: bigger, lower, orange — it hangs over the harbour.
  // Storm and rain dim the disc; fog leaves it pale.
  const r = 26 + golden * 22;
  ctx.globalAlpha = (0.25 + golden * 0.25) * light * sky.sunDim;
  ctx.fillStyle = golden > 0.3 ? '#ff8a3d' : '#ffd76a';
  ctx.beginPath(); ctx.arc(pos.x, y, 44 + golden * 26, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.9 * light * sky.sunDim;
  ctx.fillStyle = golden > 0.3 ? '#ffab5e' : '#fff3c0';
  ctx.beginPath(); ctx.arc(pos.x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function clockText(state) {
  const hours = Math.floor(state.timeOfDay / 60);
  const mins = Math.floor(state.timeOfDay % 60);
  const hh = String(hours).padStart(2, '0');
  const mm = String(mins).padStart(2, '0');
  return hh + ':' + mm + '  ' + phaseLabel(state.timeOfDay) + ' · DAY ' + state.day;
}
