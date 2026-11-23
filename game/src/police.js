// police.js — the Solstice Bay Police Department: the wanted heat that crimes raise,
// the stars it shows as, the interceptors that answer it, roadblocks at three stars,
// foot officers at four, and the bust meter that ends a chase when they pin you.
// Heat only counts in full when somebody saw the crime — slip away unseen and it fades.

import { WANTED } from './config.js';
import { clamp, dist, angleTo, angleDelta } from './random.js';
import { CAR_MODELS, makeVehicle, stepVehicle, damageVehicle } from './vehicles.js';
import { sfx } from './audio.js';

const INTERCEPTOR = CAR_MODELS.find((m) => m.police);

export function createPoliceState() {
  return { heat: 0, stars: 0, bust: 0, seenT: 0, spawnT: 0, blockSet: false };
}

export function starsForHeat(heat) {
  if (heat <= 0) return 0;
  return Math.min(WANTED.maxStars, 1 + Math.floor(heat / 110));
}

// Was the crime witnessed? A pedestrian or officer within earshot makes it count.
function witnessed(game, x, y) {
  for (const ped of game.peds) if (!ped.dead && dist(ped.x, ped.y, x, y) < 300) return true;
  for (const v of game.vehicles) if (v.driver === 'cop' && dist(v.x, v.y, x, y) < 460) return true;
  for (const c of game.copPeds) if (!c.dead && dist(c.x, c.y, x, y) < 380) return true;
  return false;
}

export function addHeat(game, points, x, y, always = false) {
  const before = game.police.stars;
  const full = always || witnessed(game, x ?? game.player.x, y ?? game.player.y);
  game.police.heat = clamp(game.police.heat + points * (full ? 1 : 0.35), 0, 560);
  game.police.stars = starsForHeat(game.police.heat);
  if (game.police.stars > before) sfx.star();
}

export function clearHeat(game) {
  game.police.heat = 0;
  game.police.stars = 0;
  game.police.bust = 0;
}

export function stepWanted(game, dt) {
  const pol = game.police;
  const p = game.player;
  // Does any officer currently have eyes on the player?
  let seen = false;
  const px = p.inVehicle && p.vehicle ? p.vehicle.x : p.x;
  const py = p.inVehicle && p.vehicle ? p.vehicle.y : p.y;
  for (const v of game.vehicles) {
    if (v.driver === 'cop' && !v.dead && dist(v.x, v.y, px, py) < WANTED.sightRange) seen = true;
  }
  for (const c of game.copPeds) if (!c.dead && dist(c.x, c.y, px, py) < 300) seen = true;
  pol.seenT = seen ? 0 : pol.seenT + dt;
  if (!seen && pol.heat > 0) {
    pol.heat = Math.max(0, pol.heat - WANTED.decayPerSecond * dt * (1 + pol.stars * 0.35));
    pol.stars = starsForHeat(pol.heat);
  }
  if (pol.stars === 0) pol.bust = Math.max(0, pol.bust - dt * 1.5);

  // Keep the response sized to the stars: two cars a star, plus foot officers late on.
  const wantCars = pol.stars === 0 ? 0 : Math.min(2 + pol.stars * 2, 9);
  const copCars = game.vehicles.filter((v) => v.driver === 'cop');
  pol.spawnT -= dt;
  if (copCars.length < wantCars && pol.spawnT <= 0) {
    pol.spawnT = 1.1;
    spawnCopCar(game, px, py);
  }
  if (pol.stars === 0) {
    for (const v of copCars) if (dist(v.x, v.y, px, py) > 1300) v.removeMe = true;
    for (const c of game.copPeds) if (dist(c.x, c.y, px, py) > 900) c.removeMe = true;
  }
  // Foot officers bail out of stopped interceptors when the player is on foot.
  if (pol.stars >= 3 && !p.inVehicle && game.copPeds.length < pol.stars - 1) {
    const near = copCars.find((v) => !v.dead && Math.abs(v.speed) < 30 && dist(v.x, v.y, px, py) < 300);
    if (near) {
      game.copPeds.push({
        x: near.x + 20, y: near.y + 10, angle: 0, speed: 0, hp: 100, dead: false,
        downT: 0, panicT: 0, threatX: 0, threatY: 0, wanderT: 0, chatT: 0,
        shirt: '#1c2733', skin: '#d9a066', pants: '#141c26', walkPhase: 0, cop: true, shootT: 0,
      });
    }
  }
}

function spawnCopCar(game, px, py) {
  const city = game.city;
  let best = null;
  let bestScore = -Infinity;
  for (const n of city.nodes) {
    const d = dist(n.x, n.y, px, py);
    if (d < 620 || d > 1250) continue;
    const score = -Math.abs(d - 880) + Math.random() * 60;
    if (score > bestScore) { bestScore = score; best = n; }
  }
  if (!best) return;
  const v = makeVehicle(INTERCEPTOR, best.x, best.y, angleTo(best.x, best.y, px, py), '#1c2733');
  v.driver = 'cop';
  v.livery = true;
  v.blockMode = false;
  game.vehicles.push(v);
  sfx.alarm();
}

// One interceptor's pursuit: aim where the player is heading, lean on the bumper,
// and at three stars send some cars ahead to park across the road instead.
export function stepCopCar(game, v, dt) {
  const p = game.player;
  const target = p.inVehicle && p.vehicle ? p.vehicle : p;
  const lead = clamp(dist(v.x, v.y, target.x, target.y) / 300, 0, 1.2);
  const tx = target.x + Math.cos(target.angle ?? 0) * (target.speed ?? 0) * 0.45 * lead;
  const ty = target.y + Math.sin(target.angle ?? 0) * (target.speed ?? 0) * 0.45 * lead;
  const stars = game.police.stars;

  if (stars >= 3 && v.blockMode === false && Math.random() < 0.004) v.blockMode = true;
  if (v.blockMode) {
    const ahead = game.city.nearestNode(tx + Math.cos(target.angle ?? 0) * 320, ty + Math.sin(target.angle ?? 0) * 320);
    const d = dist(v.x, v.y, ahead.x, ahead.y);
    if (d < 30) {
      v.angle += (((Math.atan2(ahead.y - v.y, ahead.x - v.x)) + Math.PI / 2) - v.angle) * dt; // settle across the road
      stepVehicle(game, v, dt, { throttle: 0, steer: 0, brake: true, handbrake: true });
      return;
    }
    const want = angleTo(v.x, v.y, ahead.x, ahead.y);
    stepVehicle(game, v, dt, { throttle: 0.95, steer: clamp(angleDelta(v.angle, want) * 2.4, -1, 1), brake: false, handbrake: false });
    return;
  }

  const want = angleTo(v.x, v.y, tx, ty);
  const steer = clamp(angleDelta(v.angle, want) * 2.6, -1, 1);
  const d = dist(v.x, v.y, target.x, target.y);
  let throttle = 1;
  if (d < 60) throttle = 0.55;                       // sit on the bumper, don't orbit
  if (d > 700) throttle = 1;                          // far behind: flat out
  const ctrl = { throttle, steer, brake: d < 34 && Math.abs(v.speed) > 120, handbrake: Math.abs(angleDelta(v.angle, want)) > 2.2 };
  const before = v.speed;
  stepVehicle(game, v, dt, ctrl);
  if (p.inVehicle && p.vehicle && dist(v.x, v.y, p.vehicle.x, p.vehicle.y) < (v.model.l + p.vehicle.model.l) / 2.4) {
    if (Math.abs(before) > 130) addHeat(game, 0, v.x, v.y, true); // ramming is already priced in stars
  }
}

// Foot officers run the player down and, at four stars, shoot to stop the car.
export function stepCopPed(game, c, dt) {
  if (c.dead) return;
  if (c.downT > 0) { c.downT -= dt; return; }
  const p = game.player;
  const tx = p.inVehicle && p.vehicle ? p.vehicle.x : p.x;
  const ty = p.inVehicle && p.vehicle ? p.vehicle.y : p.y;
  const d = dist(c.x, c.y, tx, ty);
  const want = angleTo(c.x, c.y, tx, ty);
  c.angle += clamp(angleDelta(c.angle, want), -4 * dt, 4 * dt);
  const speed = d > 26 ? 196 : 0;
  c.x += Math.cos(c.angle) * speed * dt;
  c.y += Math.sin(c.angle) * speed * dt;
  c.walkPhase += dt * 11;
  if (!p.inVehicle && d < 30) {
    game.police.bust = Math.min(1, game.police.bust + dt / WANTED.bustFillTime * 1.5);
  }
  if (game.police.stars >= 4 && d < 330 && d > 60) {
    c.shootT -= dt;
    if (c.shootT <= 0) {
      c.shootT = 0.9 + Math.random() * 0.5;
      game.fx.muzzle(c.x, c.y, c.angle);
      sfx.shot();
      if (Math.random() < 0.42) game.damagePlayer(6 + Math.random() * 6, c.x, c.y);
    }
  }
}

export function hurtCopPed(game, c, damage, fromX, fromY) {
  if (c.dead) return;
  c.hp -= damage;
  game.fx.blood(c.x, c.y);
  if (c.hp <= 0) {
    c.dead = true;
    addHeat(game, WANTED.heatFor.killCop, c.x, c.y, true);
    game.addCash(0); // no reward for this; the stars are the price
  }
}
