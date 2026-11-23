// city.js — Solstice Bay itself: coastline, road graph, buildings, piers,
// the causeway to Lighthouse Isle, points of interest and collectibles.
// Everything is generated once from the seeded RNG in random.js, so the city
// is identical on every load. Movement and rendering both read this model.

import { WORLD, DISTRICTS } from './config.js';
import { rng, rand, randInt, choice, clamp, dist } from './random.js';

export const AVENUES = [300, 800, 1300, 1800, 2300, 2800];
export const STREETS = [300, 800, 1300, 1800, 2300, 2800, 3300];
export const ROAD_HALF = 46;

export function coastX(y) {
  return WORLD.coastBase
    + WORLD.coastAmpA * Math.sin(y * WORLD.coastFreqA)
    + WORLD.coastAmpB * Math.sin(y * WORLD.coastFreqB + 1.7);
}

export function onIsland(x, y) {
  return dist(x, y, WORLD.island.x, WORLD.island.y) < WORLD.island.r;
}

export function onCauseway(x, y) {
  return Math.abs(y - WORLD.causewayY) < WORLD.causewayHalf
    && x > coastX(WORLD.causewayY) - 80
    && x < WORLD.island.x + 40;
}

export const PIERS = [1150, 2050, 2950].map((y) => {
  const x0 = coastX(y) - 24;
  return { x: x0, y: y - 27, w: 360, h: 54, cx: x0 + 360, cy: y };
});

export function onPier(x, y) {
  return PIERS.some((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
}

export function isWater(x, y) {
  if (onIsland(x, y) || onCauseway(x, y) || onPier(x, y)) return false;
  return x > coastX(y);
}

export function onLand(x, y) {
  return x >= 0 && y >= 0 && x < WORLD.width && y < WORLD.height && !isWater(x, y);
}

// Points of interest: doors on the sidewalk where the city's services and
// story live. Positions sit just off intersections so they are easy to reach.
export const POIS = [
  { id: 'marisol', name: 'Marisol Vega — Club Sirena', x: 1420, y: 1420, color: '#ff4fa3', letter: 'M' },
  { id: 'garage', name: 'Tide Garage', x: 2060, y: 2660, color: '#ffb340', letter: 'G' },
  { id: 'clinic', name: 'Bay Clinic', x: 640, y: 1420, color: '#ff5a5a', letter: '+' },
  { id: 'armoury', name: 'Fort Arms', x: 720, y: 2660, color: '#9fe870', letter: 'A' },
  { id: 'bank', name: 'Solstice Bank', x: 960, y: 640, color: '#ffd94a', letter: '$' },
  { id: 'police', name: 'SBPD Headquarters', x: 2460, y: 1420, color: '#5a8cff', letter: 'P' },
];

export function poi(id) {
  return POIS.find((p) => p.id === id);
}

export class City {
  constructor() {
    this.buildings = [];
    this.trees = [];
    this.lamps = [];
    this.shells = [];
    this.nodes = [];       // road graph nodes {id, x, y}
    this.edges = [];       // [aId, bId]
    this.adj = new Map();  // id -> [id]
    this.buildGraph();
    this.buildBlocks();
    this.buildNature();
  }

  addNode(x, y) {
    const id = this.nodes.length;
    this.nodes.push({ id, x, y });
    this.adj.set(id, []);
    return id;
  }

  addEdge(a, b) {
    this.edges.push([a, b]);
    this.adj.get(a).push(b);
    this.adj.get(b).push(a);
  }

  buildGraph() {
    const grid = new Map(); // "ax,sy" -> node id, only where the corner is land
    for (const ax of AVENUES) {
      for (const sy of STREETS) {
        if (onLand(ax, sy)) grid.set(ax + ',' + sy, this.addNode(ax, sy));
      }
    }
    const link = (a, b) => { if (a !== undefined && b !== undefined) this.addEdge(a, b); };
    for (const ax of AVENUES) {
      for (let i = 0; i < STREETS.length - 1; i++) {
        link(grid.get(ax + ',' + STREETS[i]), grid.get(ax + ',' + STREETS[i + 1]));
      }
    }
    for (const sy of STREETS) {
      for (let i = 0; i < AVENUES.length - 1; i++) {
        link(grid.get(AVENUES[i] + ',' + sy), grid.get(AVENUES[i + 1] + ',' + sy));
      }
    }
    // The causeway: a special street at y=700 from the coast road to the
    // island, plus a small ring on Lighthouse Isle itself.
    const cw = [];
    const cwX = [2800, 3150, 3500, 3850, 4100];
    for (const x of cwX) cw.push(this.addNode(x, WORLD.causewayY));
    link(grid.get('2800,800'), cw[0]);
    link(grid.get('2800,300'), cw[0]);
    for (let i = 0; i < cw.length - 1; i++) this.addEdge(cw[i], cw[i + 1]);
    const isl = WORLD.island;
    const ring = [
      this.addNode(isl.x, isl.y),
      this.addNode(isl.x - 210, isl.y),
      this.addNode(isl.x + 210, isl.y),
      this.addNode(isl.x, isl.y - 210),
      this.addNode(isl.x, isl.y + 210),
    ];
    this.addEdge(cw[cw.length - 1], ring[1]);
    this.addEdge(ring[1], ring[0]);
    this.addEdge(ring[0], ring[2]);
    this.addEdge(ring[1], ring[3]);
    this.addEdge(ring[3], ring[0]);
    this.addEdge(ring[0], ring[4]);
    this.addEdge(ring[4], ring[2]);
    this.causewayNodes = cw;
    this.islandCenterNode = ring[0];
  }

  nearestNode(x, y) {
    let best = null, bestD = Infinity;
    for (const n of this.nodes) {
      const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  // Breadth-first route between two graph nodes; returns node list or null.
  findPath(fromId, toId) {
    if (fromId === toId) return [this.nodes[fromId]];
    const prev = new Map([[fromId, -1]]);
    const queue = [fromId];
    while (queue.length) {
      const cur = queue.shift();
      for (const nxt of this.adj.get(cur)) {
        if (prev.has(nxt)) continue;
        prev.set(nxt, cur);
        if (nxt === toId) {
          const path = [];
          let c = toId;
          while (c !== -1) { path.push(this.nodes[c]); c = prev.get(c); }
          return path.reverse();
        }
        queue.push(nxt);
      }
    }
    return null;
  }

  // A world-space route: from (x1,y1) to (x2,y2) along the road graph.
  route(x1, y1, x2, y2) {
    const a = this.nearestNode(x1, y1);
    const b = this.nearestNode(x2, y2);
    const path = this.findPath(a.id, b.id);
    if (!path) return [{ x: x2, y: y2 }];
    return [{ x: x1, y: y1 }, ...path.map((n) => ({ x: n.x, y: n.y })), { x: x2, y: y2 }];
  }

  districtAt(x, y) {
    if (onIsland(x, y)) return { name: 'Lighthouse Isle', neon: false };
    for (const d of DISTRICTS) {
      if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
    }
    return DISTRICTS[2];
  }

  buildBlocks() {
    const vLines = [90, ...AVENUES, 3330];
    const hLines = [90, ...STREETS, 3510];
    for (let i = 0; i < vLines.length - 1; i++) {
      for (let j = 0; j < hLines.length - 1; j++) {
        const bx = vLines[i] + ROAD_HALF + 14;
        const by = hLines[j] + ROAD_HALF + 14;
        const bw = vLines[i + 1] - vLines[i] - (ROAD_HALF + 14) * 2;
        const bh = hLines[j + 1] - hLines[j] - (ROAD_HALF + 14) * 2;
        if (bw < 120 || bh < 120) continue;
        const cx = bx + bw / 2, cy = by + bh / 2;
        if (!onLand(cx, cy)) continue;
        if (bx + bw > coastX(cy) - 24 && !onIsland(cx, cy)) continue;
        const district = this.districtAt(cx, cy);
        const count = bw > 340 && bh > 340 ? randInt(2, 4) : randInt(1, 2);
        for (let k = 0; k < count; k++) {
          const w = rand(70, Math.min(190, bw / (count > 2 ? 2 : 1) - 18));
          const h = rand(70, Math.min(190, bh / (count > 2 ? 2 : 1) - 18));
          const x = clamp(cx + rand(-bw / 2 + w / 2 + 8, bw / 2 - w / 2 - 8), bx, bx + bw - w);
          const y = clamp(cy + rand(-bh / 2 + h / 2 + 8, bh / 2 - h / 2 - 8), by, by + bh - h);
          this.buildings.push({
            x, y, w, h,
            roof: choice(district.roof),
            wall: district.wall,
            height: rand(14, 64),
            neon: !!district.neon && rng() < 0.4,
            windows: randInt(2, 5),
          });
        }
      }
    }
    // Warehouses down in Portside: long, low, grey.
    for (let k = 0; k < 7; k++) {
      const x = 1500 + k * 190 + rand(-20, 20);
      const y = 3050 + rand(-30, 30);
      if (onLand(x, y)) {
        this.buildings.push({ x, y, w: 150, h: 84, roof: '#596673', wall: '#cfd6da', height: 16, neon: false, windows: 1, warehouse: true });
      }
    }
    // The lighthouse itself, on the island's east point.
    this.buildings.push({
      x: WORLD.island.x + 190, y: WORLD.island.y - 30, w: 44, h: 44,
      roof: '#f4f1e6', wall: '#e8e4da', height: 90, neon: false, windows: 1, lighthouse: true,
    });
  }

  buildNature() {
    // Palms along the beach and the avenues.
    for (let y = 140; y < WORLD.height - 100; y += rand(120, 260)) {
      const x = coastX(y) - rand(56, 110);
      if (onLand(x, y)) this.trees.push({ x, y, r: rand(15, 24), palm: true });
    }
    for (let k = 0; k < 130; k++) {
      const x = rand(80, 3300), y = rand(80, 3520);
      if (!onLand(x, y)) continue;
      const nearRoad = AVENUES.some((a) => Math.abs(x - a) < 70) || STREETS.some((s) => Math.abs(y - s) < 70);
      if (nearRoad) continue;
      if (this.buildings.some((b) => x > b.x - 16 && x < b.x + b.w + 16 && y > b.y - 16 && y < b.y + b.h + 16)) continue;
      this.trees.push({ x, y, r: rand(13, 22), palm: rng() < 0.5 });
    }
    // Street lamps at intersections.
    for (const n of this.nodes) {
      if (n.x < 3400) this.lamps.push({ x: n.x + ROAD_HALF - 6, y: n.y + ROAD_HALF - 6 });
    }
    // Seashells: mostly on the sand, a few on piers and the island shore.
    const spots = [];
    for (let k = 0; k < 17; k++) {
      const y = rand(160, 3480);
      spots.push({ x: coastX(y) - rand(14, 40), y });
    }
    for (const p of PIERS) spots.push({ x: p.x + rand(60, 320), y: p.cy + rand(-16, 16) });
    for (let k = 0; k < 5; k++) {
      const a = rand(0, Math.PI * 2);
      spots.push({
        x: WORLD.island.x + Math.cos(a) * (WORLD.island.r - rand(16, 44)),
        y: WORLD.island.y + Math.sin(a) * (WORLD.island.r - rand(16, 44)),
      });
    }
    this.shells = spots.slice(0, 25).map((s, i) => ({ id: i, x: s.x, y: s.y, taken: false }));
  }

  // Solid-building collision for a circle; returns corrected [x, y].
  collideBuildings(x, y, radius) {
    let out = null;
    for (const b of this.buildings) {
      if (x < b.x - radius || x > b.x + b.w + radius || y < b.y - radius || y > b.y + b.h + radius) continue;
      const nx = clamp(x, b.x, b.x + b.w);
      const ny = clamp(y, b.y, b.y + b.h);
      const dx = x - nx, dy = y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < radius * radius) {
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * radius;
          y = ny + (dy / d) * radius;
        } else {
          y = b.y - radius;
        }
        out = [x, y];
      }
    }
    return out || [x, y];
  }

  buildingAt(x, y, pad = 0) {
    return this.buildings.find((b) => x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) || null;
  }
}
