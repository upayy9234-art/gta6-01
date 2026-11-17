// The city of Virelia: a road grid, dense procedural building blocks with named
// signs, a park, a river with two bridges, a palm-lined east coast, parked cars
// and street props. Helpers answer "is this point on a road / inside a building
// / in water". All geometry is derived from the seed, so every run of the same
// seed builds the same city.
import { SIGN_NAMES, WORLD } from './config.js';

export function roadCentersX() {
  const xs = [];
  for (let x = WORLD.road / 2 + WORLD.block; x < WORLD.width; x += WORLD.block + WORLD.road) xs.push(x);
  return xs;
}
export function roadCentersY() {
  const ys = [];
  for (let y = WORLD.road / 2 + WORLD.block; y < WORLD.height; y += WORLD.block + WORLD.road) ys.push(y);
  return ys;
}

export function isOnRoad(x, y) {
  for (const cx of roadCentersX()) if (Math.abs(x - cx) < WORLD.road / 2) return true;
  for (const cy of roadCentersY()) if (Math.abs(y - cy) < WORLD.road / 2) return true;
  return false;
}
export function isInWater(x, y) {
  // The Virelia river runs down the east side; two bridges cross it.
  if (x < 2960) return false;
  const onBridge = (y > 620 && y < 716) || (y > 1680 && y < 1776);
  return !onBridge;
}
export function isOnBeach(x, y) {
  return x >= 2900 && x < 2960 && y >= 0 && y <= WORLD.height;
}
export function nearestRoadPoint(x, y) {
  let best = { x, y, d: Infinity };
  for (const cx of roadCentersX()) {
    const d = Math.abs(x - cx);
    if (d < best.d) best = { x: cx, y, d };
  }
  for (const cy of roadCentersY()) {
    const d = Math.abs(y - cy);
    if (d < best.d) best = { x, y: cy, d };
  }
  return best;
}

// A point on a road shoulder — where a taxi passenger waits at the kerb, or
// a pedestrian hails a cab. Always on a road, never inside a building.
export function roadsidePoint(random) {
  const xs = roadCentersX();
  const ys = roadCentersY();
  if (random.next() < 0.5) {
    const cx = random.pick(xs);
    return { x: cx + (random.next() < 0.5 ? -1 : 1) * (WORLD.road / 2 + 16), y: random.range(200, WORLD.height - 200) };
  }
  const cy = random.pick(ys);
  return { x: random.range(200, WORLD.width - 600), y: cy + (random.next() < 0.5 ? -1 : 1) * (WORLD.road / 2 + 16) };
}

export function buildCity(random) {
  const buildings = [];
  const parks = [];
  const lamps = [];
  const palms = [];
  const signs = [];
  const xs = roadCentersX(); const ys = roadCentersY();
  const palette = random.shuffle(['#2a2f55', '#33284f', '#1f3a52', '#3d2b4d', '#27395e', '#40304a']);
  const signPool = random.shuffle(SIGN_NAMES.slice());
  // The Neon Strip: block (i=1, j=0) becomes the casino district — one landmark
  // casino building in purple and gold instead of ordinary blocks.
  const casino = { x: 886, y: 450, w: 312, h: 312, cx: 1042, cy: 606 };
  // Blocks sit between neighbouring roads. Round 5 packs each block with a
  // 2x2 grid of buildings instead of 1–2, so the city reads dense from above.
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const x0 = xs[i] + WORLD.road / 2 + 14, y0 = ys[j] + WORLD.road / 2 + 14;
      const x1 = xs[i + 1] - WORLD.road / 2 - 14, y1 = ys[j + 1] - WORLD.road / 2 - 14;
      if (x0 > 2900) continue; // river side stays open waterfront
      // South-east blocks belong to the Portside docks (district.js) — no
      // ordinary buildings here, or they would overlap the container yard.
      if (x0 > 2100 && y0 > 1700) continue;
      // Central block becomes Harbor Park.
      if (i === 3 && j === 2) { parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }); continue; }
      // North-west block becomes the Neon Strip casino district.
      if (i === 1 && j === 0) {
        buildings.push({
          x: casino.x + 26, y: casino.y + 26, w: casino.w - 52, h: casino.h - 52,
          color: '#3b1d6e', neon: '#ffc53d', height: 4, windows: 20, casino: true,
          sign: 'NEON STRIP CASINO',
        });
        signs.push({ x: casino.cx, y: casino.y + 2, text: 'NEON STRIP CASINO', color: '#ffc53d' });
        continue;
      }
      const cols = 2, rows = 2;
      const cw = (x1 - x0) / cols, ch = (y1 - y0) / rows;
      for (let c = 0; c < cols; c += 1) for (let r = 0; r < rows; r += 1) {
        const w = cw * random.range(0.6, 0.84), h = ch * random.range(0.6, 0.84);
        const bx = x0 + c * cw + (cw - w) / 2, by = y0 + r * ch + (ch - h) / 2;
        // The north row (j=0) always gets a sign — it is the opening frame's
        // street — other rows get one half the time, while the pool lasts.
        const named = (j === 0 || random.bool(0.5)) && signPool.length > 0;
        const sign = named ? signPool.pop() : null;
        const entry = {
          x: bx, y: by, w, h, color: random.pick(palette),
          neon: random.pick(['#ff2e88', '#22e6ff', '#ffc53d', '#a06bff', null, null]),
          height: random.int(1, 4),
          windows: random.int(6, 26),
          sign,
        };
        buildings.push(entry);
        if (sign) signs.push({ x: bx + w / 2, y: by + 2, text: sign, color: entry.neon ?? '#e8ecff' });
      }
    }
  }
  // Street lamps along every road, plus a denser second row on the boulevard.
  for (const cx of xs) for (let y = 60; y < WORLD.height; y += 260) lamps.push({ x: cx + WORLD.road / 2 - 6, y });
  for (const cy of ys) for (let x = 60; x < WORLD.width; x += 260) lamps.push({ x, y: cy + WORLD.road / 2 - 6 });
  // Palm boulevard: two rows of palms down the east edge, x ~2870 and ~2930.
  for (let y = 80; y < WORLD.height; y += 130) {
    palms.push({ x: 2872 + random.range(-8, 8), y: y + random.range(-14, 14), lean: random.range(-0.25, 0.25), h: random.range(26, 40) });
    if (random.bool(0.6)) palms.push({ x: 2932 + random.range(-6, 6), y: y + 65 + random.range(-14, 14), lean: random.range(-0.25, 0.25), h: random.range(24, 36) });
  }
  // A few palms shade Harbor Park too.
  for (let k = 0; k < 6; k += 1) {
    palms.push({ x: random.range(1800, 2040), y: random.range(1360, 1600), lean: random.range(-0.2, 0.2), h: random.range(26, 38) });
  }
  return { buildings, parks, lamps, palms, signs, casino };
}

// Parked cars: static, stealable, no driver — taking one raises no heat.
// Spots sit on the road shoulders so they never block an intersection.
export function buildParkedCars(random) {
  const spots = [];
  const xs = roadCentersX(); const ys = roadCentersY();
  const models = ['#e8452c', '#22e6ff', '#ffc53d', '#7dd069', '#b9c0e8', '#a06bff', '#ff7a3d', '#3ddc84'];
  for (const cx of xs) {
    for (const cy of ys) {
      if (random.bool(0.55)) {
        spots.push({
          x: cx + 62 + random.range(-6, 6), y: cy + random.range(-300, 300),
          angle: Math.PI / 2, color: random.pick(models),
        });
      }
    }
  }
  // A busy row along the north road, right by the garage and the arms shop.
  for (let k = 0; k < 4; k += 1) {
    spots.push({ x: 560 + k * 90, y: 436, angle: 0, color: random.pick(models) });
  }
  return spots.slice(0, 14);
}

export function collideBuildings(state, x, y, radius) {
  for (const b of state.city.buildings) {
    if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return b;
  }
  return null;
}
export function pointInBuilding(state, x, y) {
  return state.city.buildings.some((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h);
}
