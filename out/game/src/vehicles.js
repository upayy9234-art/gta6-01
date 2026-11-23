// vehicles.js — one arcade physics model drives everything with wheels or a
// hull: the player's car, traffic, police interceptors, race rivals and the
// two boats. Velocity is split into forward and lateral parts each step;
// the tyres' grip eats the lateral part, and the handbrake loosens that grip
// so the car slides and leaves skid marks. Boats use the same sums with a
// loose grip and no handbrake, which is what makes them wallow.

import { VEHICLE_TYPES } from './config.js';
import { clamp, angleDelta } from './random.js';
import { isWater } from './city.js';

const TYPES = new Map(VEHICLE_TYPES.map((t) => [t.id, t]));
export function vehicleType(id) {
  return TYPES.get(id);
}

let nextId = 1;

export function createVehicle(typeId, x, y, angle, opts = {}) {
  const def = TYPES.get(typeId);
  return {
    id: nextId++,
    type: typeId,
    def,
    kind: def.kind,
    x, y, angle,
    vx: 0, vy: 0,
    health: def.health,
    color: opts.color || def.colors[0],
    driver: opts.driver || null, // null = parked; 'player' | 'traffic' | 'police' | 'rival' | 'escort'
    route: null,
    routeI: 0,
    cruise: opts.cruise || def.topSpeed * 0.45,
    stuck: 0,
    smokeT: 0,
    dead: false,
    wanted: opts.wanted || false, // mission-marked vehicle
    name: opts.name || def.name,
  };
}

export function speedOf(v) {
  return Math.hypot(v.vx, v.vy);
}

export function forwardSpeed(v) {
  return v.vx * Math.cos(v.angle) + v.vy * Math.sin(v.angle);
}

// Steer/throttle orders that take a vehicle toward a point. Shared by
// traffic, police pursuit, race rivals and the escort van.
export function controlToward(v, tx, ty, opts = {}) {
  const reach = opts.reach || 60;
  const d = Math.hypot(tx - v.x, ty - v.y);
  const want = Math.atan2(ty - v.y, tx - v.x);
  const delta = angleDelta(v.angle, want);
  const fs = forwardSpeed(v);
  let steer = clamp(delta * 2.4, -1, 1);
  let throttle = 1;
  if (Math.abs(delta) > 2.2 && fs < 60) {
    // Pointing the wrong way: reverse and swing round.
    throttle = -1;
    steer = -steer;
  }
  if (d < reach) throttle = 0.2;
  if (opts.stopAt && d < opts.stopAt) {
    throttle = fs > 12 ? -0.7 : 0;
    steer = 0;
  }
  return { throttle, steer, handbrake: Math.abs(delta) > 1.15 && fs > 200 };
}

export function damageVehicle(G, v, amount, angle) {
  if (v.dead) return;
  v.health -= amount;
  if (angle !== undefined) G.fx.spark(v.x, v.y, angle);
  if (v.health <= 0) {
    v.health = 0;
    v.dead = true;
    G.fx.smoke(v.x, v.y, true);
  }
}

export function stepVehicle(G, v, control, dt) {
  const def = v.def;
  const fx = Math.cos(v.angle);
  const fy = Math.sin(v.angle);
  const rx = -fy;
  const ry = fx;
  let fSpeed = v.vx * fx + v.vy * fy;
  let lat = v.vx * rx + v.vy * ry;

  const inWater = isWater(v.x, v.y);
  const beached = v.kind === 'boat' && !inWater;

  if (!v.dead && !beached) {
    const throttle = clamp(control.throttle || 0, -1, 1);
    if (throttle >= 0) fSpeed += def.accel * throttle * dt;
    else fSpeed += def.accel * 0.62 * throttle * dt;
    // Steering bites harder at speed, and reverses when backing up.
    const steerAuthority = clamp(Math.abs(fSpeed) / 130, 0, 1) * Math.sign(fSpeed || 1);
    v.angle += (control.steer || 0) * 2.25 * steerAuthority * dt * (v.kind === 'boat' ? 0.62 : 1);
  }

  // Drag and rolling resistance; water all but stops a car.
  let drag = v.kind === 'boat' ? 0.25 : 0.35;
  if (v.kind === 'car' && inWater) drag = 2.6;
  if (beached) drag = 4.5;
  fSpeed -= fSpeed * drag * dt;
  if (!control.throttle) fSpeed -= fSpeed * 0.7 * dt;
  fSpeed = clamp(fSpeed, -def.topSpeed * 0.38, def.topSpeed);

  // Grip eats lateral slide; the handbrake loosens it into a drift.
  let grip = def.grip;
  if (control.handbrake && v.kind === 'car') {
    grip *= 0.22;
    fSpeed -= fSpeed * 0.55 * dt;
    if (Math.abs(fSpeed) > 130) {
      G.fx.skid(v.x - fx * def.len * 0.32 + rx * 8, v.y - fy * def.len * 0.32 + ry * 8);
      G.fx.skid(v.x - fx * def.len * 0.32 - rx * 8, v.y - fy * def.len * 0.32 - ry * 8);
      if (Math.random() < 0.35) G.fx.smoke(v.x - fx * def.len * 0.3, v.y - fy * def.len * 0.3, false);
    }
  }
  lat -= lat * Math.min(1, grip * dt * 3.2);

  const nfx = Math.cos(v.angle);
  const nfy = Math.sin(v.angle);
  const nrx = -nfy;
  const nry = nfx;
  v.vx = nfx * fSpeed + nrx * lat;
  v.vy = nfy * fSpeed + nry * lat;
  v.x += v.vx * dt;
  v.y += v.vy * dt;

  // Buildings are solid. A hard arrival costs health and makes sparks.
  const push = G.city.buildingPush(v.x, v.y, def.wid * 0.95);
  if (push) {
    const impact = Math.hypot(push.x, push.y) / Math.max(dt, 0.001);
    v.x += push.x;
    v.y += push.y;
    const into = v.vx * (push.x !== 0 ? Math.sign(push.x) : 0) + v.vy * (push.y !== 0 ? Math.sign(push.y) : 0);
    if (into < 0) {
      if (push.x !== 0) v.vx = 0;
      if (push.y !== 0) v.vy = 0;
    }
    if (impact > 190) {
      damageVehicle(G, v, (impact - 190) * 0.055, v.angle + Math.PI);
      if (Math.hypot(v.x - G.player.x, v.y - G.player.y) < 700) G.audio.play('crash', impact > 340);
      if (v.driver === 'player' || G.player.vehicle === v) G.police.report(G, 1, v.x, v.y, true);
    }
  }

  // World edges.
  v.x = clamp(v.x, 24, 4776);
  v.y = clamp(v.y, 24, 3576);

  // A drowning car dies slowly; a healthy one throws spray.
  if (v.kind === 'car' && inWater) {
    if (Math.random() < dt * 2.2) G.fx.splash(v.x, v.y, 3);
    damageVehicle(G, v, dt * 7);
  }
  if (v.kind === 'boat' && inWater && Math.abs(fSpeed) > 60 && Math.random() < dt * 14) {
    G.fx.wake(v.x, v.y, v.angle);
  }

  // Damage smoke and fire.
  v.smokeT -= dt;
  if (!v.dead && v.health < 52 && v.smokeT <= 0) {
    G.fx.smoke(v.x, v.y, v.health < 26);
    if (v.health < 26) G.fx.fire(v.x, v.y);
    v.smokeT = 0.14;
  }
  if (v.dead && Math.random() < dt * 3) G.fx.smoke(v.x, v.y, true);
  return v;
}

// ---- Traffic ---------------------------------------------------------------
// Traffic cars follow the road graph from node to node, choosing a new
// neighbour at each junction, and brake for whatever is ahead of them.

export function spawnTraffic(G, count) {
  const kinds = ['sedan', 'sedan', 'compact', 'coupe', 'van', 'taxi', 'muscle', 'truck'];
  const out = [];
  for (let i = 0; i < count; i++) {
    const p = G.city.randomRoadPoint(G.rng);
    const node = G.city.nearestNode(p.x, p.y);
    if (!node) continue;
    const v = createVehicle(G.rng.pick(kinds), node.x, node.y, 0, {
      driver: 'traffic',
      color: null,
    });
    v.color = G.rng.pick(v.def.colors);
    v.route = [node.key];
    v.routeI = 0;
    out.push(v);
  }
  // Two boats cruise the bay between the marina and the island.
  for (let i = 0; i < 2; i++) {
    const b = createVehicle(i ? 'skiff' : 'speedboat', 3050 + i * 500, 2950 - i * 900, -0.4, { driver: 'traffic' });
    b.color = G.rng.pick(b.def.colors);
    b.cruise = 120;
    out.push(b);
  }
  return out;
}

const BAY_POINTS = [
  { x: 3100, y: 2900 }, { x: 3900, y: 2500 }, { x: 4250, y: 1250 },
  { x: 3850, y: 700 }, { x: 3050, y: 1100 }, { x: 2950, y: 2000 },
];

export function stepTraffic(G, v, dt) {
  if (v.kind === 'boat') {
    if (!v.route || v.routeI >= v.route.length) {
      const target = G.rng.pick(BAY_POINTS);
      v.route = [target];
      v.routeI = 0;
    }
    const t = v.route[0];
    if (Math.hypot(t.x - v.x, t.y - v.y) < 90) v.route = null;
    else stepVehicle(G, v, controlToward(v, t.x, t.y, { reach: 200 }), dt);
    return;
  }
  // Pick the next graph node when the current one is reached.
  if (!v.route || v.routeI >= v.route.length) {
    const node = G.city.nearestNode(v.x, v.y);
    if (!node) return;
    const options = G.city.adj.get(node.key).filter((k) => k !== v.lastNode);
    const nextKey = options.length ? G.rng.pick(options) : node.key;
    v.lastNode = node.key;
    const n = G.city.nodes.get(nextKey);
    v.route = [{ x: n.x, y: n.y }];
    v.routeI = 0;
  }
  const target = v.route[v.routeI];
  const d = Math.hypot(target.x - v.x, target.y - v.y);
  if (d < 46) {
    v.route = null;
    return;
  }
  // Brake for anything solid ahead.
  let throttleMul = 1;
  const fx = Math.cos(v.angle);
  const fy = Math.sin(v.angle);
  for (const other of G.vehicles) {
    if (other === v) continue;
    const ahead = (other.x - v.x) * fx + (other.y - v.y) * fy;
    const side = Math.abs((other.x - v.x) * -fy + (other.y - v.y) * fx);
    if (ahead > 0 && ahead < 74 && side < 26) {
      throttleMul = ahead < 40 ? -0.4 : 0.25;
      break;
    }
  }
  if (!G.player.vehicle && Math.hypot(G.player.x - v.x, G.player.y - v.y) < 60) throttleMul = 0;
  const control = controlToward(v, target.x, target.y, { reach: 90 });
  control.throttle *= throttleMul * (v.cruise / v.def.topSpeed) * 2.1;
  stepVehicle(G, v, control, dt);
}
