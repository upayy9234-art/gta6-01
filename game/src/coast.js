// The east coast of Virelia: Palm Boulevard, a sandy beach, and the open ocean.
// The boulevard runs down x ~2900 with palms and beachfront buildings; the sand
// strip sits at x 2900–2960; east of 2960 is water (see world.js isInWater).
// Waves roll in on a slow sine so the shoreline is never a dead flat line —
// and the weather reads them: a storm throws the waves high and fast, rain
// lifts them a little, anything else rolls slow and low.
import { WORLD } from './config.js';

export const COAST = {
  boulevardX: 2900,
  beachX0: 2900,
  beachX1: 2960,
  waterX: 2960,
  label: 'PALM BOULEVARD',
};

const BEACHFRONT_SIGNS = ['SURF SHACK', 'HOTEL BRISA', 'PIER 9 DINER', 'MARINA LOUNGE', 'GOLDEN ANCHOR'];
const UMBRELLA_COLORS = ['#ff2e88', '#ffc53d', '#22e6ff', '#ff7a3d'];
const FRONT_COLORS = ['#2a2f55', '#1f3a52', '#40304a', '#3d2b4d'];
const FRONT_NEONS = ['#ff2e88', '#22e6ff', '#ffc53d'];

export function buildCoast(city, random) {
  // Beachfront buildings face the ocean along the boulevard, between the
  // roads — each gets a sign the renderer paints.
  const fronts = [];
  const rows = [500, 940, 1380, 1820, 2260];
  for (let k = 0; k < rows.length; k += 1) {
    const y = rows[k];
    const sign = BEACHFRONT_SIGNS[k % BEACHFRONT_SIGNS.length];
    const b = {
      x: 2620, y, w: 190, h: 150,
      color: random.pick(FRONT_COLORS),
      neon: random.pick(FRONT_NEONS),
      height: random.int(2, 3),
      windows: random.int(10, 20),
      sign,
      beachfront: true,
    };
    city.buildings.push(b);
    fronts.push(b);
    city.signs.push({ x: b.x + b.w / 2, y: b.y + 2, text: sign, color: b.neon });
  }
  // Deck chairs and umbrellas on the sand, so the beach reads as a beach.
  const props = [];
  for (let k = 0; k < 10; k += 1) {
    props.push({
      x: random.range(2915, 2945),
      y: random.range(120, WORLD.height - 120),
      color: random.pick(UMBRELLA_COLORS),
    });
  }
  const coast = { fronts, props, wavePhase: random.next() * 6 };
  city.coast = coast;
  return coast;
}

function waveSettings(state) {
  // Waves read the weather: a storm throws them high and fast, rain lifts
  // them a little, anything else rolls slow and low.
  const kind = state.weather ? state.weather.kind : 'clear';
  if (kind === 'storm') return { amp: 24, speed: 1.6 };
  if (kind === 'rain') return { amp: 18, speed: 0.9 };
  return { amp: 14, speed: 0.9 };
}

export function drawCoast(ctx, state) {
  const coast = state.city.coast;
  const t = state.time;
  const waves = waveSettings(state);
  // Sand strip along the east edge.
  ctx.fillStyle = '#d9b380';
  ctx.fillRect(COAST.beachX0, 0, COAST.beachX1 - COAST.beachX0, WORLD.height);
  // Wet sand: a darker band that breathes with the waves.
  ctx.fillStyle = 'rgba(160,120,70,0.55)';
  const wet = 8 + Math.sin(t * 0.7) * 4;
  ctx.fillRect(COAST.beachX1 - wet, 0, wet, WORLD.height);
  // Ocean: deep blue with three rolling wave lines.
  ctx.fillStyle = '#1d6f9e';
  ctx.fillRect(COAST.waterX, 0, WORLD.width - COAST.waterX, WORLD.height);
  ctx.strokeStyle = 'rgba(232,244,255,0.5)';
  ctx.lineWidth = 3;
  for (let w = 0; w < 3; w += 1) {
    ctx.beginPath();
    for (let y = 0; y <= WORLD.height; y += 60) {
      const x = COAST.waterX + 40 + w * 90 + Math.sin(y * 0.01 + t * waves.speed + w * 2) * waves.amp;
      if (y === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  if (!coast) return;
  // Beach umbrellas: a coloured canopy on a pole.
  for (const prop of coast.props) {
    ctx.fillStyle = prop.color;
    ctx.beginPath();
    ctx.arc(prop.x, prop.y, 12, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#5a3b2e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(prop.x, prop.y);
    ctx.lineTo(prop.x, prop.y + 14);
    ctx.stroke();
  }
  // Palm Boulevard label painted on the boulevard itself.
  ctx.save();
  ctx.translate(COAST.boulevardX - 14, 1150);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#22e6ff';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PALM BOULEVARD', 0, 0);
  ctx.restore();
}

// Palms: trunk with a lean, five fronds. Drawn in world space.
export function drawPalm(ctx, palm, t) {
  const sway = Math.sin(t * 0.8 + palm.y * 0.01) * 0.06;
  const lean = palm.lean + sway;
  const topX = palm.x + Math.sin(lean) * palm.h;
  const topY = palm.y - Math.cos(lean) * palm.h;
  ctx.strokeStyle = '#6b4a2f';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(palm.x, palm.y);
  ctx.lineTo(topX, topY);
  ctx.stroke();
  ctx.strokeStyle = '#2a7a44';
  ctx.lineWidth = 4;
  for (let f = 0; f < 5; f += 1) {
    const a = -Math.PI / 2 + (f - 2) * 0.55 + sway;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(a) * 16, topY + Math.sin(a) * 16 - 4,
      topX + Math.cos(a) * 28, topY + Math.sin(a) * 28 + 8,
    );
    ctx.stroke();
  }
}
