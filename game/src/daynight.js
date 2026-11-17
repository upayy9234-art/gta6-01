// Real day/night cycle for Virelia. timeOfDay is minutes after midnight; the
// sky, lamps, neon, stars, sun and moon all follow it, and the day counter
// ticks over every time the clock wraps past midnight.
export function dayPhase(t) {
  if (t < 300) return 'night';
  if (t < 420) return 'dawn';
  if (t < 1080) return 'day';
  if (t < 1260) return 'dusk';
  return 'night';
}

export function phaseLabel(t) {
  const phase = dayPhase(t);
  if (phase === 'dawn') return 'DAWN';
  if (phase === 'day') return 'DAY';
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
  if (t < 300 || t >= 1260) return 0;
  if (t < 420) return smooth(300, 420, t);
  if (t < 1080) return 1;
  return 1 - smooth(1080, 1260, t);
}

export function skyState(t) {
  const light = daylight(t);
  const phase = dayPhase(t);
  let horizon = '#1a2440';
  if (phase === 'dawn' || phase === 'dusk') horizon = '#c97a35';
  else if (phase === 'night') horizon = '#0a1030';
  return {
    light,
    phase,
    nightAlpha: 0.30 * (1 - light),
    lampGlow: 0.16 + 0.14 * (1 - light),
    lampRadius: 26 + 18 * (1 - light),
    neonBoost: 0.55 + 0.45 * (1 - light),
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
  ctx.save();
  ctx.globalAlpha = 0.25 * light;
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath(); ctx.arc(pos.x, pos.y, 44, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.9 * light;
  ctx.beginPath(); ctx.arc(pos.x, pos.y, 26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff3c0';
  ctx.beginPath(); ctx.arc(pos.x, pos.y, 17, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function clockText(state) {
  const hours = Math.floor(state.timeOfDay / 60);
  const mins = Math.floor(state.timeOfDay % 60);
  const hh = String(hours).padStart(2, '0');
  const mm = String(mins).padStart(2, '0');
  return hh + ':' + mm + '  ' + phaseLabel(state.timeOfDay) + ' · DAY ' + state.day;
}
