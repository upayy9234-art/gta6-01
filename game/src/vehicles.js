// vehicles.js — every car and boat in Solstice Bay: the model catalogue, the shared
// driving physics (used by the player, traffic and the police alike), traffic that
// follows the avenue graph, parked cars waiting to be stolen, and collision and
// damage. A vehicle is a plain object; this file owns how it moves.

import { WORLD } from './config.js';
import { clamp, dist, angleTo, angleDelta } from './random.js';
import { isWaterAt, onBridge, onDock } from './city.js';
import { sfx } from './audio.js';

export const CAR_MODELS = [
  { name: 'Marlowe Coupe', w: 26, l: 52, topSpeed: 342, accel: 218, colors: ['#e8641e', '#c22f4e', '#274b9f', '#20242c'] },
  { name: 'Solace Sedan', w: 27, l: 54, topSpeed: 272, accel: 168, colors: ['#b8bec9', '#5b7fa6', '#7a4a56', '#3f4a3a', '#d8d3c3'] },
  { name: 'Bayline Hatch', w: 25, l: 46, topSpeed: 252, accel: 178, colors: ['#e3b505', '#3fa7a0', '#8e6cc8', '#d96c33'] },
  { name: 'Palma Pickup', w: 29, l: 58, topSpeed: 258, accel: 160, colors: ['#96714a', '#546e7a', '#a63d2a', '#445544'] },
  { name: 'Vanta Van', w: 30, l: 62, topSpeed: 232, accel: 138, colors: ['#e8e8e8', '#7fb3d5', '#c9a227', '#666e7a'] },
  { name: 'Solana Cabrio', w: 26, l: 50, topSpeed: 318, accel: 205, colors: ['#ff5da2', '#22d3ee', '#f5f0e6', '#ffd166'] },
  { name: 'Port Hauler', w: 32, l: 74, topSpeed: 208, accel: 118, colors: ['#8a4b2a', '#4a6741', '#5d6d7e'] },
  { name: 'Bay Cab', w: 27, l: 54, topSpeed: 268, accel: 170, colors: ['#f7c948'], taxi: true },
  { name: 'SBPD Interceptor', w: 27, l: 55, topSpeed: 330, accel: 216, colors: ['#1c2733'], police: true },
];

export const BOAT_MODELS = [
  { name: 'Tide Runner', w: 24, l: 56, topSpeed: 268, accel: 132, colors: ['#f2f5f7', '#ff7847', '#2ec4b6'] },
  { name: 'Harbour Skiff', w: 26, l: 50, topSpeed: 188, accel: 102, colors: ['#d9c9a3', '#7fb069', '#90a8c8'] },
];

let nextId = 1;

export function makeVehicle(model, x, y, angle, color, kind = 'car') {
  return {
    id: nextId++, kind, model, x, y, angle,
    speed: 0, steerVis: 0, color,
    health: 100, dead: false, driver: 'parked', // parked | traffic | player | cop | mission
    prevNode: null, targetNode: null, stuckT: 0, panicT: 0,
    cruise: 0.5 + Math.random() * 0.2, smokeT: 0, fireT: 0, hornT: 0,
    waypoint: null, marked: false, lastHitT: -9,
  };
}

export function spawnTraffic(city, rng, count, avoidX, avoidY) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const node = rng.pick(city.nodes);
    if (dist(node.x, node.y, avoidX, avoidY) < 420) continue;
    const model = rng.pick(CAR_MODELS.filter((m) => !m.police));
    const link = rng.pick(node.links);
    const v = makeVehicle(model, node.x, node.y, angleTo(node.x, node.y, link.x, link.y), rng.pick(model.colors));
    v.driver = 'traffic';
    v.prevNode = node;
    v.targetNode = link;
    out.push(v);
  }
  return out;
}

export function spawnParked(city, rng, count) {
  const out = [];
  const spots = [];
  for (const lot of city.lots) {
    for (let x = lot.x + 30; x < lot.x + lot.w - 20; x += 46) {
      spots.push({ x, y: lot.y + 30, angle: Math.PI / 2 });
      spots.push({ x, y: lot.y + lot.h - 30, angle: -Math.PI / 2 });
    }
  }
  for (const ax of city.avenuesX) {
    for (let y = 320; y < WORLD.height - 200; y += 300) spots.push({ x: ax - 34, y, angle: Math.PI / 2 });
  }
  for (let i = 0; i < count && spots.length; i += 1) {
    const s = spots.splice(rng.int(0, spots.length - 1), 1)[0];
    const model = rng.pick(CAR_MODELS.filter((m) => !m.police));
    out.push(makeVehicle(model, s.x, s.y, s.angle, rng.pick(model.colors)));
  }
  return out;
}

export function spawnBoats(city, rng, count) {
  const out = [];
  const moorings = [
    { x: 3560, y: 1500 }, { x: 3620, y: 1760 }, { x: 3560, y: 2020 }, { x: 3750, y: 1640 },
  ];
  for (let i = 0; i < count; i += 1) {
    const m = moorings[i % moorings.length];
    const model = BOAT_MODELS[i % BOAT_MODELS.length];
    const v = makeVehicle(model, m.x + rng.range(-16, 16), m.y + rng.range(-10, 10), rng.range(0, Math.PI * 2), rng.pick(model.colors), 'boat');
    v.driver = i < 2 ? 'parked' : 'traffic';
    v.waypoint = { x: 3950 + rng.range(-260, 380), y: 1300 + rng.range(0, 1500) };
    out.push(v);
  }
  return out;
}

// ---- shared driving ----

// Advance one vehicle by its controls. ctrl: {throttle -1..1, steer -1..1, brake, handbrake}.
// Returns the impact speed if it struck the world this step, else 0.
export function stepVehicle(game, v, dt, ctrl) {
  const m = v.model;
  if (v.dead) { v.speed = 0; return 0; }
  const maxF = m.topSpeed;
  const maxR = -m.topSpeed * 0.34;
  if (ctrl.throttle > 0) v.speed += m.accel * ctrl.throttle * dt * (v.speed < 0 ? 2.2 : 1);
  else if (ctrl.throttle < 0) {
    if (v.speed > 12 && !ctrl.brake) v.speed -= m.accel * 1.5 * dt; // brake lights, not reverse
    else v.speed += m.accel * 0.62 * ctrl.throttle * dt;
  }
  if (ctrl.brake) v.speed -= Math.sign(v.speed) * 330 * dt;
  const drag = v.kind === 'boat' ? 0.55 : 0.35;
  v.speed -= v.speed * drag * dt * (ctrl.handbrake ? 2.6 : 1);
  if (!ctrl.throttle && Math.abs(v.speed) < 4) v.speed = 0;
  v.speed = clamp(v.speed, maxR, maxF);

  const speedRatio = v.speed / maxF;
  const steerAuthority = v.kind === 'boat' ? 0.85 : clamp(Math.abs(speedRatio) * 2.4, 0, 1) * (ctrl.handbrake ? 1.5 : 1);
  v.angle += ctrl.steer * (v.kind === 'boat' ? 1.15 : 2.05) * steerAuthority * dt * (v.speed < 0 ? -1 : 1);
  v.steerVis = ctrl.steer;

  const nx = v.x + Math.cos(v.angle) * v.speed * dt;
  const ny = v.y + Math.sin(v.angle) * v.speed * dt;
  let impact = 0;

  if (v.kind === 'boat') {
    const wet = isWaterAt(nx, ny) || onDock(nx, ny); // moored boats sit in the dock's shallows
    if (!wet || game.city.collidesCircle(nx, ny, 10)) {
      impact = Math.abs(v.speed) * 0.5;
      v.speed *= -0.25;
      game.fx.splash(v.x, v.y, 8);
    } else {
      v.x = nx; v.y = ny;
      if (Math.abs(v.speed) > 40 && Math.random() < 0.5) game.fx.wake(v.x, v.y, v.angle);
    }
  } else {
    const noseX = nx + Math.cos(v.angle) * (m.l / 2 - 6);
    const noseY = ny + Math.sin(v.angle) * (m.l / 2 - 6);
    const tailX = nx - Math.cos(v.angle) * (m.l / 2 - 6);
    const tailY = ny - Math.sin(v.angle) * (m.l / 2 - 6);
    const blocked = (px, py) => game.city.collidesCircle(px, py, m.w / 2 - 3) || (isWaterAt(px, py) && !onBridge(px, py));
    if (blocked(noseX, noseY) || blocked(tailX, tailY)) {
      impact = Math.abs(v.speed);
      if (impact > 60) damageVehicle(game, v, impact * 0.11, nx, ny);
      v.speed *= -0.28;
    } else {
      v.x = clamp(nx, 20, WORLD.width - 20);
      v.y = clamp(ny, 20, WORLD.height - 20);
    }
    // Tyre smoke and skids when the car is worked hard.
    if (Math.abs(v.speed) > 60 && (ctrl.handbrake || Math.abs(ctrl.steer) > 0.85)) {
      const bx = v.x - Math.cos(v.angle) * (m.l / 2 - 8);
      const by = v.y - Math.sin(v.angle) * (m.l / 2 - 8);
      const px = Math.cos(v.angle + Math.PI / 2) * (m.w / 2 - 4);
      const py = Math.sin(v.angle + Math.PI / 2) * (m.w / 2 - 4);
      game.fx.addSkid(bx + px, by + py, v.angle, Math.abs(speedRatio));
      game.fx.addSkid(bx - px, by - py, v.angle, Math.abs(speedRatio));
      if (Math.random() < 0.35) game.fx.smoke(bx, by, 1);
    }
  }
  if (v.health < 55 && Math.random() < 0.3) game.fx.smoke(v.x, v.y, 1, v.health < 30);
  if (v.health < 26 && !v.dead) {
    game.fx.fire(v.x, v.y);
    v.fireT += dt;
    if (v.fireT > 2.4) { v.health = 0; }
  }
  if (v.health <= 0 && !v.dead) {
    v.dead = true;
    v.health = 0;
    game.fx.sparks(v.x, v.y, 22);
    game.fx.smoke(v.x, v.y, 8, true);
    sfx.crash(1);
    if (v.driver === 'player') game.onPlayerVehicleDestroyed(v);
  }
  return impact;
}

export function damageVehicle(game, v, amount, x, y) {
  v.health = Math.max(0, v.health - amount);
  game.fx.sparks(x ?? v.x, y ?? v.y, Math.min(14, 3 + amount));
  if (amount > 4) sfx.crash(clamp(amount / 14, 0.3, 1));
}

// ---- traffic behaviour ----

function obstacleAhead(game, v, lookDist) {
  const ax = v.x + Math.cos(v.angle) * lookDist;
  const ay = v.y + Math.sin(v.angle) * lookDist;
  for (const o of game.vehicles) {
    if (o === v || o.dead) continue;
    if (dist(ax, ay, o.x, o.y) < o.model.l / 2 + 12) return o;
  }
  const p = game.player;
  if (!p.inVehicle && dist(ax, ay, p.x, p.y) < 24) return p;
  if (p.vehicle && p.vehicle !== v && dist(ax, ay, p.vehicle.x, p.vehicle.y) < 34) return p.vehicle;
  for (const ped of game.peds) {
    if (!ped.dead && dist(ax, ay, ped.x, ped.y) < 22) return ped;
  }
  return null;
}

export function stepTraffic(game, v, dt, rng) {
  if (v.kind === 'boat') return stepBoatTraffic(game, v, dt, rng);
  if (!v.targetNode) {
    v.targetNode = game.city.nearestNode(v.x, v.y);
    v.prevNode = v.targetNode;
  }
  // Aim at a point on our lane, a little before the node, so turns cut cleanly.
  const from = v.prevNode ?? v.targetNode;
  const dirA = Math.atan2(v.targetNode.y - from.y, v.targetNode.x - from.x);
  const laneX = v.targetNode.x - Math.cos(dirA) * 26 + Math.cos(dirA + Math.PI / 2) * 14;
  const laneY = v.targetNode.y - Math.sin(dirA) * 26 + Math.sin(dirA + Math.PI / 2) * 14;
  const d = dist(v.x, v.y, laneX, laneY);
  if (d < 42) {
    const options = v.targetNode.links.filter((n) => n !== v.prevNode);
    const next = options.length ? rng.pick(options) : v.prevNode;
    v.prevNode = v.targetNode;
    v.targetNode = next ?? v.targetNode;
    v.stuckT = 0;
  }
  const want = angleTo(v.x, v.y, laneX, laneY);
  const steer = clamp(angleDelta(v.angle, want) * 2.2, -1, 1);
  const blockedBy = obstacleAhead(game, v, 62 + Math.abs(v.speed) * 0.35);
  let throttle = blockedBy ? 0 : v.cruise * (v.panicT > 0 ? 1.5 : 1);
  if (blockedBy && Math.abs(v.speed) > 30) throttle = -0.6;
  if (v.panicT > 0) v.panicT -= dt;
  if (Math.abs(v.speed) < 6 && !blockedBy) v.stuckT += dt; else v.stuckT = 0;
  if (v.stuckT > 3.5) { // hopelessly boxed in: pick another way at the next junction
    v.targetNode = v.prevNode ?? v.targetNode;
    v.stuckT = 0;
  }
  stepVehicle(game, v, dt, { throttle, steer, brake: !!blockedBy && Math.abs(v.speed) > 60, handbrake: false });
}

function stepBoatTraffic(game, v, dt, rng) {
  if (!v.waypoint || dist(v.x, v.y, v.waypoint.x, v.waypoint.y) < 90) {
    v.waypoint = { x: 3650 + rng.range(0, 950), y: 300 + rng.range(0, 2900) };
    if (!isWaterAt(v.waypoint.x, v.waypoint.y)) v.waypoint = { x: 4050, y: 1500 };
  }
  const want = angleTo(v.x, v.y, v.waypoint.x, v.waypoint.y);
  const steer = clamp(angleDelta(v.angle, want) * 1.8, -1, 1);
  stepVehicle(game, v, dt, { throttle: 0.55, steer, brake: false, handbrake: false });
}

// ---- vehicle against vehicle ----

export function collideVehicles(game, dt) {
  const vs = game.vehicles;
  for (let i = 0; i < vs.length; i += 1) {
    const a = vs[i];
    if (a.dead) continue;
    for (let j = i + 1; j < vs.length; j += 1) {
      const b = vs[j];
      if (b.dead || a.kind !== b.kind) continue;
      const rr = (a.model.l + b.model.l) / 2.6;
      const d = dist(a.x, a.y, b.x, b.y);
      if (d > rr || d === 0) continue;
      const push = (rr - d) / 2;
      const ux = (b.x - a.x) / d;
      const uy = (b.y - a.y) / d;
      if (a.driver !== 'parked') { a.x -= ux * push; a.y -= uy * push; }
      if (b.driver !== 'parked') { b.x += ux * push; b.y += uy * push; }
      const closing = Math.abs(a.speed - b.speed) + Math.abs(a.speed) * 0.3;
      if (closing > 55) {
        damageVehicle(game, a, closing * 0.09, (a.x + b.x) / 2, (a.y + b.y) / 2);
        damageVehicle(game, b, closing * 0.09, (a.x + b.x) / 2, (a.y + b.y) / 2);
        a.speed *= 0.55;
        b.speed *= 0.55;
        game.onVehiclesCrashed(a, b, closing);
      } else {
        a.speed *= 0.9;
        b.speed *= 0.9;
      }
    }
  }
}
