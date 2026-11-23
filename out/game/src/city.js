// city.js — Solstice Bay, grown from a seed. A street grid fills the west of
// the map; a sinusoidal shoreline cuts it off from the bay in the east.
// Three marina piers reach into the water, a causeway runs out to
// Lighthouse Isle, and every intersection joins a road graph that traffic,
// police and mission routing all share (breadth-first search over it).

import { WORLD, DISTRICTS, MARINA, ISLAND } from './config.js';
import { Rng, clamp, dist2 } from './random.js';

export const AVENUES = [320, 720, 1120, 1520, 1920, 2320]; // vertical roads, x
export const STREETS = [300, 720, 1140, 1560, 1980, 2400, 2820, 3240]; // horizontal roads, y
export const AVENUE_W = 96;
export const STREET_W = 88;

// The shoreline: east of this x the bay begins. It wanders with y so the
// coast feels grown, not ruled.
export function coastX(y) {
  return 2540 + Math.sin(y * 0.0011) * 90 + Math.sin(y * 0.0037 + 1.7) * 34;
}

function onIsland(x, y) {
  return dist2(x, y, ISLAND.x, ISLAND.y) < ISLAND.r * ISLAND.r;
}

// The causeway is a straight land strip from the shore to the island.
const CAUSEWAY_Y = ISLAND.y;
const CAUSEWAY_HALF = 30;
function onCauseway(x, y) {
  return Math.abs(y - CAUSEWAY_Y) < CAUSEWAY_HALF && x > coastX(CAUSEWAY_Y) - 40 && x < ISLAND.x;
}

function onPier(x, y) {
  for (const py of MARINA.pierYs) {
    if (Math.abs(y - py) < 16 && x > coastX(py) - 30 && x < coastX(py) + MARINA.pierLen) return true;
  }
  return false;
}

export function isWater(x, y) {
  if (x < 0 || y < 0 || x > WORLD.w || y > WORLD.h) return true;
  if (onIsland(x, y) || onCauseway(x, y) || onPier(x, y)) return false;
  return x > coastX(y);
}

export function isBeach(x, y) {
  return !isWater(x, y) && x > coastX(y) - 90 && x < coastX(y) + 4 && !onIsland(x, y);
}

function nearLine(v, lines, half) {
  for (const c of lines) if (Math.abs(v - c) < half) return true;
  return false;
}

export function isRoad(x, y) {
  if (isWater(x, y)) return onCauseway(x, y);
  if (nearLine(x, AVENUES, AVENUE_W / 2)) return true;
  if (nearLine(y, STREETS, STREET_W / 2)) return true;
  // The shore drive follows the coast.
  if (Math.abs(x - (coastX(y) - 130)) < 48) return true;
  if (onCauseway(x, y)) return true;
  return false;
}

export function generateCity(seed) {
  const rng = new Rng(seed * 7919 + 13);
  const buildings = [];
  const palms = [];
  const lamps = [];

  // Special sites are claimed first so no random block lands on them.
  const sites = {
    garage: { x: 1560, y: 1180, label: 'Harbor Garage' },
    clinic: { x: 1560, y: 380, label: 'Neon Mile Clinic' },
    armoury: { x: 360, y: 380, label: "Fort Arms" },
    marisol: { x: 360, y: 2060, label: "Marisol's Corner" },
    hideout: { x: 360, y: 2620, label: 'Old Fort Safehouse' },
  };
  const reserved = Object.values(sites).map((s) => ({ x: s.x - 90, y: s.y - 90, w: 180, h: 180 }));

  // Blocks sit between neighbouring roads; each block holds 1–4 buildings
  // or, sometimes, a pocket park.
  const xEdges = [60, ...AVENUES.flatMap((a) => [a - AVENUE_W / 2, a + AVENUE_W / 2]), 2460];
  const yEdges = [60, ...STREETS.flatMap((s) => [s - STREET_W / 2, s + STREET_W / 2]), 3540];
  for (let i = 0; i + 1 < xEdges.length; i += 2) {
    for (let j = 0; j + 1 < yEdges.length; j += 2) {
      const bx = xEdges[i];
      const by = yEdges[j];
      const bw = xEdges[i + 1] - bx;
      const bh = yEdges[j + 1] - by;
      if (bw < 120 || bh < 120) continue;
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      if (cx > coastX(cy) - 170) continue; // keep the shore drive clear
      const district = DISTRICTS.find((d) => cx >= d.x && cx < d.x + d.w && cy >= d.y && cy < d.y + d.h) || DISTRICTS[0];
      if (reserved.some((r) => cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h)) continue;
      if (rng.chance(0.14)) {
        // Pocket park: palms and open grass, no building.
        const n = rng.int(3, 7);
        for (let k = 0; k < n; k++) palms.push({ x: bx + rng.range(24, bw - 24), y: by + rng.range(24, bh - 24), s: rng.range(0.8, 1.3) });
        continue;
      }
      const cols = bw > 300 ? 2 : 1;
      const rows = bh > 300 ? 2 : 1;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const w = (bw / cols) * rng.range(0.52, 0.72);
          const h = (bh / rows) * rng.range(0.52, 0.72);
          const x = bx + (bw / cols) * c + (bw / cols - w) / 2;
          const y = by + (bh / rows) * r + (bh / rows - h) / 2;
          buildings.push({
            x, y, w, h,
            floors: rng.int(2, district.name === 'Neon Mile' ? 14 : 8),
            tone: district.tone,
            roof: district.roof,
            district: district.name,
            seed: rng.int(1, 1e9),
          });
        }
      }
    }
  }

  // The island gets a lighthouse and a ring of palms, no buildings to hit.
  const lighthouse = { x: ISLAND.x + 60, y: ISLAND.y - 40 };
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    palms.push({ x: ISLAND.x + Math.cos(a) * (ISLAND.r - 46), y: ISLAND.y + Math.sin(a) * (ISLAND.r - 46), s: rng.range(0.9, 1.4) });
  }
  // Palms parade down the beach.
  for (let y = 140; y < WORLD.h - 120; y += rng.range(90, 170)) {
    palms.push({ x: coastX(y) - rng.range(36, 70), y, s: rng.range(0.85, 1.35) });
  }
  // Street lamps along the avenues.
  for (const a of AVENUES) for (let y = 120; y < WORLD.h; y += 210) lamps.push({ x: a + AVENUE_W / 2 + 8, y });
  for (const s of STREETS) for (let x = 160; x < 2400; x += 230) lamps.push({ x, y: s + STREET_W / 2 + 8 });

  // The road graph: a node at every avenue/street crossing, strung along
  // each road, plus the shore drive and the causeway chain to the island.
  const nodes = new Map();
  const adj = new Map();
  const key = (x, y) => x + ',' + y;
  function addNode(x, y) {
    const k = key(Math.round(x), Math.round(y));
    if (!nodes.has(k)) {
      nodes.set(k, { key: k, x: Math.round(x), y: Math.round(y) });
      adj.set(k, []);
    }
    return k;
  }
  function link(a, b) {
    if (a === b) return;
    if (!adj.get(a).includes(b)) adj.get(a).push(b);
    if (!adj.get(b).includes(a)) adj.get(b).push(a);
  }
  for (const a of AVENUES) {
    let prev = null;
    for (const s of STREETS) {
      const k = addNode(a, s);
      if (prev) link(prev, k);
      prev = k;
    }
  }
  for (const s of STREETS) {
    let prev = null;
    for (const a of AVENUES) {
      const k = addNode(a, s);
      if (prev) link(prev, k);
      prev = k;
    }
  }
  // Shore drive nodes where each street meets the coast road.
  for (const s of STREETS) {
    const k = addNode(coastX(s) - 130, s);
    link(k, key(AVENUES[AVENUES.length - 1], s));
  }
  let prevShore = null;
  for (const s of STREETS) {
    const k = key(Math.round(coastX(s) - 130), s);
    if (prevShore) link(prevShore, k);
    prevShore = k;
  }
  // Causeway: from the shore drive at island height out to the island.
  const causeStart = addNode(coastX(CAUSEWAY_Y) - 130, CAUSEWAY_Y);
  const mid = addNode((coastX(CAUSEWAY_Y) + ISLAND.x) / 2, CAUSEWAY_Y);
  const isle = addNode(ISLAND.x - 120, ISLAND.y);
  // Join the causeway to the shore drive at the streets above and below it.
  link(causeStart, key(Math.round(coastX(720) - 130), 720));
  link(causeStart, key(Math.round(coastX(1140) - 130), 1140));
  link(causeStart, mid);
  link(mid, isle);

  function nearestNode(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const n of nodes.values()) {
      const d = dist2(x, y, n.x, n.y);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  // Breadth-first search over the road graph; returns world points to drive
  // through, or null when there is no route (e.g. out on the water).
  function findPath(x0, y0, x1, y1) {
    const start = nearestNode(x0, y0);
    const goal = nearestNode(x1, y1);
    if (!start || !goal) return null;
    if (start.key === goal.key) return [{ x: x1, y: y1 }];
    const came = new Map([[start.key, null]]);
    const queue = [start.key];
    while (queue.length) {
      const cur = queue.shift();
      if (cur === goal.key) break;
      for (const nxt of adj.get(cur)) {
        if (!came.has(nxt)) {
          came.set(nxt, cur);
          queue.push(nxt);
        }
      }
    }
    if (!came.has(goal.key)) return null;
    const points = [];
    let cur = goal.key;
    while (cur) {
      const n = nodes.get(cur);
      points.push({ x: n.x, y: n.y });
      cur = came.get(cur);
    }
    points.reverse();
    points.push({ x: x1, y: y1 });
    return points;
  }

  // Circle-vs-buildings: returns a push-out vector or null.
  function buildingPush(x, y, r) {
    for (const b of buildings) {
      const nx = clamp(x, b.x, b.x + b.w);
      const ny = clamp(y, b.y, b.y + b.h);
      const d2 = dist2(x, y, nx, ny);
      if (d2 < r * r) {
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          return { x: ((x - nx) / d) * (r - d), y: ((y - ny) / d) * (r - d) };
        }
        // Centre inside the rect: push out through the nearest face.
        const left = x - b.x;
        const right = b.x + b.w - x;
        const top = y - b.y;
        const bottom = b.y + b.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) return { x: -(left + r), y: 0 };
        if (m === right) return { x: right + r, y: 0 };
        if (m === top) return { x: 0, y: -(top + r) };
        return { x: 0, y: bottom + r };
      }
    }
    return null;
  }

  function randomRoadPoint(r) {
    if (r.chance(0.12)) {
      const y = r.pick(STREETS);
      return { x: coastX(y) - 130, y };
    }
    if (r.chance(0.5)) return { x: r.pick(AVENUES), y: r.range(200, WORLD.h - 200) };
    return { x: r.range(200, 2300), y: r.pick(STREETS) };
  }

  // Twenty-five seashells: beach, piers, island and parks.
  const shells = [];
  while (shells.length < 25) {
    let p;
    const roll = rng.next();
    if (roll < 0.45) {
      const y = rng.range(200, WORLD.h - 200);
      p = { x: coastX(y) - rng.range(20, 80), y };
    } else if (roll < 0.65) {
      const a = rng.range(0, Math.PI * 2);
      p = { x: ISLAND.x + Math.cos(a) * rng.range(60, ISLAND.r - 60), y: ISLAND.y + Math.sin(a) * rng.range(60, ISLAND.r - 60) };
    } else if (roll < 0.8) {
      const py = rng.pick(MARINA.pierYs);
      p = { x: coastX(py) + rng.range(60, MARINA.pierLen - 20), y: py };
    } else {
      p = { x: rng.range(200, 2200), y: rng.range(200, WORLD.h - 200) };
      if (isRoad(p.x, p.y) || buildingPush(p.x, p.y, 20)) continue;
    }
    if (!isWater(p.x, p.y)) shells.push({ x: p.x, y: p.y, taken: false });
  }

  return {
    buildings, palms, lamps, sites, lighthouse, shells,
    nodes, adj, nearestNode, findPath, buildingPush, randomRoadPoint,
  };
}
