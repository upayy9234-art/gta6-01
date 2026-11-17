// The city of Virelia: a road grid, procedural building blocks, a park, a river
// with two bridges, and helpers that answer "is this point on a road / inside a
// building / in water". All geometry is derived from the seed, so every run of
// the same seed builds the same city.
import { WORLD } from './config.js';

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

export function buildCity(random) {
  const buildings = [];
  const parks = [];
  const lamps = [];
  const xs = roadCentersX(); const ys = roadCentersY();
  const palette = ['#2a2f55', '#33284f', '#1f3a52', '#3d2b4d', '#27395e', '#40304a'];
  // Blocks sit between neighbouring roads.
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const x0 = xs[i] + WORLD.road / 2 + 14, y0 = ys[j] + WORLD.road / 2 + 14;
      const x1 = xs[i + 1] - WORLD.road / 2 - 14, y1 = ys[j + 1] - WORLD.road / 2 - 14;
      if (x0 > 2900) continue; // river side stays open waterfront
      // Central block becomes Harbor Park.
      if (i === 3 && j === 2) { parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }); continue; }
      const cols = random.int(1, 2); const rows = random.int(1, 2);
      const cw = (x1 - x0) / cols, ch = (y1 - y0) / rows;
      for (let c = 0; c < cols; c += 1) for (let r = 0; r < rows; r += 1) {
        const w = cw * random.range(0.62, 0.86), h = ch * random.range(0.62, 0.86);
        const bx = x0 + c * cw + (cw - w) / 2, by = y0 + r * ch + (ch - h) / 2;
        buildings.push({
          x: bx, y: by, w, h, color: random.pick(palette),
          neon: random.pick(['#ff2e88', '#22e6ff', '#ffc53d', '#a06bff', null, null]),
          height: random.int(1, 4),
          windows: random.int(6, 26),
        });
      }
    }
  }
  // Street lamps along every road.
  for (const cx of xs) for (let y = 60; y < WORLD.height; y += 260) lamps.push({ x: cx + WORLD.road / 2 - 6, y });
  for (const cy of ys) for (let x = 60; x < WORLD.width; x += 260) lamps.push({ x, y: cy + WORLD.road / 2 - 6 });
  return { buildings, parks, lamps };
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
