// Real day/night cycle for Virelia, opening at golden hour. timeOfDay is minutes
// after midnight; the sky, lamps, neon, stars, sun and moon all follow it, and the
// day counter ticks over every time the clock wraps past midnight.
// Golden hour runs 17:30–19:00: warm orange horizon, low sun, long shadows.
import { GOLDEN_END, GOLDEN_START } from './config.js';

export function dayPhase(t) {
  if (t < 300) return 'night';
  if (t < 420) return 'dawn';
  if (t < GOLDEN_START) return 'day';
  if (t < GOLDEN_END) return 'golden';
  if (t < 1260) return 'dusk';
  return 'night';
}

export function phaseLabel(t) {
  const phase = dayPhase(t);
  if (phase === 'dawn') return 'DAWN';
  if (phase === 'day') return 'DAY';
  if (phase === 'golden') return 'GOLDEN HOUR';
  if (phase === 'dusk') return 'DUSK';
  return 'NIGHT';
}

function smooth(a, b, t) {
  if (t <= a) return 0;
  if (t >= b) return 1;
  const f = (t - a) / (b - a);
  return f * f * (3 - 2 * f);
}

export function daylight(t) {
  // 0 at night, smooth ramps through dawn (05:00–07:00) and dusk (18:00–21:00).
  // At the 18:05 golden-hour start the light is still high — warm, not dark.
  if (t < 300 || t >= 1260) return 0;
  if (t < 420) return smooth(300, 420, t);
  if (t < 1080) return 1;
  return 1 - smooth(1080, 1260, t);
}

// 0 outside golden hour, 1 at its heart (18:15), smooth shoulders.
export function goldenFactor(t) {
  if (t < GOLDEN_START || t > GOLDEN_END) return 0;
  const mid = (GOLDEN_START + GOLDEN_END) / 2;
  const half = (GOLDEN_END - GOLDEN_START) / 2;
  const d = 1 - Math.abs(t - mid) / half;
  return d * d * (3 - 2 * d);
}

// Shadow length multiplier: 1 at noon, ~3.2x at golden hour, 0 at night.
export function shadowStretch(t) {
  const light = daylight(t);
  if (light <= 0.02) return 0;
  return 1 + goldenFactor(t) * 2.4;
}

export function skyState(t) {
  const light = daylight(t);
  const phase = dayPhase(t);
  const golden = goldenFactor(t);
  let horizon = '#1a2440';
  if (phase === 'dawn') horizon = '#c97a35';
  else if (phase === 'golden') horizon = '#ff7a3d';
  else if (phase === 'dusk') horizon = '#b34a6e';
  else if (phase === 'night') horizon = '#0a1030';
  return {
    light,
    phase,
    golden,
    nightAlpha: 0.30 * (1 - light),
    // Warm wash over the whole frame while the sun is low.
    warmAlpha: 0.12 * golden,
    lampGlow: 0.16 + 0.14 * (1 - light) + 0.05 * golden,
    lampRadius: 26 + 18 * (1 - light),
    neonBoost: 0.55 + 0.45 * (1 - light) + 0.25 * golden,
    starAlpha: Math.max(0, 0.9 - light * 1.6),
    horizon,
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
  const sky = skyState(state.timeOfDay);
  if (sky.starAlpha <= 0.02) return;
  const stars = starPositions(90, w, h);
  ctx.save();
  for (const star of stars) {
    const twinkle = 0.55 + 0.45 * Math.sin(state.time * 2 + star.tw);
    ctx.globalAlpha = sky.starAlpha * twinkle;
    ctx.fillStyle = '#e8ecff';
    ctx.beginPath(); ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawMoon(ctx, state, width) {
  const sky = skyState(state.timeOfDay);
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
  ctx.beginPath(); ctx.arc(mx - 9, my - 6, 6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + 8, my + 8, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + 3, my - 13, 3.5, 0, Math.PI * 2); ctx.fill();
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
  const pos = sunPosition(state.timeOfDay, width);
  const golden = goldenFactor(state.timeOfDay);
  ctx.save();
  // Golden-hour sun: bigger, lower, orange — it hangs over the harbour.
  const r = 26 + golden * 22;
  ctx.globalAlpha = (0.25 + golden * 0.25) * light;
  ctx.fillStyle = golden > 0.3 ? '#ff8a3d' : '#ffd76a';
  ctx.beginPath(); ctx.arc(pos.x, Math.min(190, pos.y + golden * 60), 44 + golden * 26, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.9 * light;
  ctx.fillStyle = golden > 0.3 ? '#ffab5e' : '#fff3c0';
  ctx.beginPath(); ctx.arc(pos.x, Math.min(190, pos.y + golden * 60), r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function clockText(state) {
  const hours = Math.floor(state.timeOfDay / 60);
  const mins = Math.floor(state.timeOfDay % 60);
  const hh = String(hours).padStart(2, '0');
  const mm = String(mins).padStart(2, '0');
  return hh + ':' + mm + '  ' + phaseLabel(state.timeOfDay) + ' · DAY ' + state.day;
}
