// city.js — Solstice Bay itself: the avenue grid and its traffic graph, the blocks and
// buildings between them, the curving shoreline, the marina piers, the causeway and
// Lighthouse Isle. Everything is generated from one seed, so the bay is the same on
// every visit. Other modules ask this file where things are and what is solid.

import { WORLD, DISTRICTS, PALETTE } from './config.js';
import { makeRng, clamp, dist } from './random.js';

const ROAD_HALF = WORLD.roadWidth / 2;
const WALK = 16; // sidewalk width each side of the asphalt

// The shoreline is not straight: two slow sine swells push it in and out.
export function shoreXAt(y) {
  return WORLD.shoreX + Math.sin(y * 0.0016) * 130 + Math.sin(y * 0.004 + 1.7) * 60;
}

export function isWaterAt(x, y) {
  if (x < 0 || y < 0 || x > WORLD.width || y > WORLD.height) return true;
  const dIsland = dist(x, y, WORLD.islandX, WORLD.islandY);
  if (dIsland < WORLD.islandR) return false;                       // the isle is land
  if (onBridge(x, y)) return false;                                // so is the causeway deck
  if (onDock(x, y)) return false;                                  // and the marina piers
  return x > shoreXAt(y);
}

export function onBridge(x, y) {
  return Math.abs(y - WORLD.bridgeY) < 36 && x > shoreXAt(WORLD.bridgeY) - 30 && x < WORLD.islandX - WORLD.islandR + 40;
}

const DOCKS = [1500, 1760, 2020].map((y) => ({ y, w: 26, len: 210 }));
export function onDock(x, y) {
  for (const d of DOCKS) {
    const sx = shoreXAt(d.y);
    if (Math.abs(y - d.y) < d.w / 2 + 4 && x > sx - 10 && x < sx + d.len) return true;
  }
  return false;
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  return 'Solstice Bay';
}

export function buildCity(seed = 20261122) {
  const rng = makeRng(seed);
  const avenuesX = [];
  for (let x = 200; x <= 3000; x += WORLD.roadEvery) avenuesX.push(x);
  avenuesX.push(3160); // the coast road, last stop before the sand
  const avenuesY = [];
  for (let y = 200; y <= 3400; y += WORLD.roadEvery) avenuesY.push(y);

  // ---- traffic graph: one node per intersection, linked along each avenue ----
  const nodes = [];
  const nodeGrid = new Map();
  avenuesX.forEach((x, i) => {
    avenuesY.forEach((y, j) => {
      const node = { x, y, i, j, links: [] };
      nodes.push(node);
      nodeGrid.set(`${i},${j}`, node);
    });
  });
  for (const n of nodes) {
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const m = nodeGrid.get(`${n.i + di},${n.j + dj}`);
      if (m) n.links.push(m);
    }
  }
  const nearestNode = (x, y) => {
    let best = nodes[0];
    let bestD = Infinity;
    for (const n of nodes) {
      const d = (n.x - x) ** 2 + (n.y - y) ** 2;
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  };
  // Breadth-first route over the avenue graph, for the GPS line and AI errands.
  const route = (from, to) => {
    if (from === to) return [from];
    const prev = new Map([[from, null]]);
    const queue = [from];
    while (queue.length) {
      const cur = queue.shift();
      if (cur === to) break;
      for (const link of cur.links) {
        if (!prev.has(link)) { prev.set(link, cur); queue.push(link); }
      }
    }
    if (!prev.has(to)) return [from, to];
    const path = [];
    for (let n = to; n; n = prev.get(n)) path.unshift(n);
    return path;
  };

  // ---- blocks and buildings ----
  const buildings = [];
  const palms = [];
  const lamps = [];
  const lots = [];
  const heightFor = (district) => {
    if (district === 'Casino Row') return [120, 260];
    if (district === 'Neon Mile') return [80, 190];
    if (district === 'Palm Heights') return [60, 150];
    if (district === 'The Port') return [26, 60];
    if (district === 'Old Town') return [30, 80];
    return [40, 110];
  };
  for (let bi = 0; bi < avenuesX.length - 1; bi += 1) {
    for (let bj = 0; bj < avenuesY.length - 1; bj += 1) {
      const x0 = avenuesX[bi] + ROAD_HALF + WALK;
      const x1 = avenuesX[bi + 1] - ROAD_HALF - WALK;
      const y0 = avenuesY[bj] + ROAD_HALF + WALK;
      const y1 = avenuesY[bj + 1] - ROAD_HALF - WALK;
      if (x1 - x0 < 120 || y1 - y0 < 120) continue;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      const roll = rng.next();
      if (roll < 0.1) { // a pocket park: grass and palms, nothing solid
        for (let p = 0; p < 7; p += 1) palms.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), s: rng.range(0.8, 1.3) });
        continue;
      }
      if (roll < 0.2) { // an open parking lot: rows of stealable cars
        lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      const [hMin, hMax] = heightFor(district);
      const cols = rng.int(1, 2);
      const rows = rng.int(1, 2);
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const bw = (x1 - x0) / cols - rng.range(14, 34);
          const bh = (y1 - y0) / rows - rng.range(14, 34);
          const bx = x0 + (c * (x1 - x0)) / cols + rng.range(6, 16);
          const by = y0 + (r * (y1 - y0)) / rows + rng.range(6, 16);
          buildings.push({
            x: bx, y: by, w: bw, h: bh,
            height: rng.range(hMin, hMax),
            roof: rng.pick(PALETTE.roof),
            wall: rng.pick(PALETTE.wall),
            neon: rng.pick(PALETTE.neon),
            sign: rng.chance(0.4),
            district,
          });
        }
      }
      if (rng.chance(0.7)) palms.push({ x: x0 + 8, y: y0 + 8, s: rng.range(0.8, 1.2) });
    }
  }
  // Beach palms and boardwalk lamps along the sand.
  for (let y = 120; y < WORLD.height - 80; y += rng.range(90, 170)) {
    palms.push({ x: shoreXAt(y) - rng.range(26, 90), y, s: rng.range(0.9, 1.4) });
    lamps.push({ x: shoreXAt(y) - 16, y: y + 40 });
  }
  for (const ax of avenuesX) for (let y = 120; y < WORLD.height; y += 260) lamps.push({ x: ax - ROAD_HALF - 8, y });
  // Island: a ring of palms, the lighthouse and its keeper's hut.
  for (let a = 0; a < Math.PI * 2; a += 0.5) {
    palms.push({ x: WORLD.islandX + Math.cos(a) * (WORLD.islandR - 40), y: WORLD.islandY + Math.sin(a) * (WORLD.islandR - 40), s: rng.range(0.9, 1.3) });
  }
  const lighthouse = { x: WORLD.islandX, y: WORLD.islandY - 60, r: 30, h: 190 };

  // ---- points of interest ----
  const pois = [
    { kind: 'garage', name: 'Neon Bay Garage', x: 1740, y: 2620 },
    { kind: 'clinic', name: 'Solstice Clinic', x: 640, y: 1440 },
    { kind: 'armoury', name: 'Ammu-Bay', x: 2260, y: 1460 },
    { kind: 'club', name: "Marisol's — The Velvet Eel", x: 2060, y: 2060 },
    { kind: 'safehouse', name: 'Jax’s Boardwalk Flat', x: 2440, y: 3080 },
  ];

  // ---- seashell collectibles along the waterline ----
  const shells = [];
  for (let i = 0; i < 25; i += 1) {
    const y = rng.range(140, WORLD.height - 140);
    const onIsland = i >= 21;
    if (onIsland) {
      const a = rng.range(0, Math.PI * 2);
      shells.push({ x: WORLD.islandX + Math.cos(a) * (WORLD.islandR - 14), y: WORLD.islandY + Math.sin(a) * (WORLD.islandR - 14), taken: false });
    } else {
      shells.push({ x: shoreXAt(y) - rng.range(6, 30), y, taken: false });
    }
  }

  // Solid rectangles for on-foot collision: buildings and the lighthouse.
  const solids = buildings.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
  solids.push({ x: lighthouse.x - 26, y: lighthouse.y - 26, w: 52, h: 52 });

  function collidesCircle(x, y, r) {
    if (x < r || y < r || x > WORLD.width - r || y > WORLD.height - r) return true;
    for (const s of solids) {
      const nx = clamp(x, s.x, s.x + s.w);
      const ny = clamp(y, s.y, s.y + s.h);
      if ((x - nx) ** 2 + (y - ny) ** 2 < r * r) return true;
    }
    return false;
  }

  return {
    avenuesX, avenuesY, nodes, nearestNode, route,
    buildings, palms, lamps, lots, lighthouse, pois, shells, solids,
    collidesCircle, seed,
  };
}
