// pedestrians.js — the people of Solstice Bay: they stroll the sidewalks and the
// boardwalk, chat in pairs, flee from gunfire and crashes, and dive out of the way
// of cars — most of the time. The wanted system hears about it when they don't.

import { clamp, dist, angleTo, angleDelta } from './random.js';
import { isWaterAt } from './city.js';
import { sfx } from './audio.js';

const SHIRTS = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#f78c6b', '#c8b6ff', '#f1fa8c', '#8ecae6', '#ffffff', '#2a9d8f'];
const SKIN = ['#f2c9a0', '#d9a066', '#a06a3b', '#6f4525', '#ffe0bd'];

export function makePed(x, y, rng) {
  return {
    x, y, angle: rng.range(0, Math.PI * 2), speed: 0,
    hp: 100, dead: false, downT: 0, panicT: 0, threatX: 0, threatY: 0,
    wanderT: rng.range(0, 3), chatT: 0,
    shirt: rng.pick(SHIRTS), skin: rng.pick(SKIN), pants: rng.pick(['#33415c', '#5c677d', '#7f5539', '#e0e1dd', '#22333b']),
    walkPhase: rng.range(0, 6),
  };
}

export function spawnPeds(city, rng, count, avoidX, avoidY) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard < count * 30) {
    guard += 1;
    const alongY = rng.chance(0.6);
    const avenue = alongY ? rng.pick(city.avenuesX) : rng.pick(city.avenuesY);
    const t = rng.range(120, 3480);
    const side = rng.sign() * 62;
    const x = alongY ? avenue + side : t;
    const y = alongY ? t : avenue + side;
    if (isWaterAt(x, y) || city.collidesCircle(x, y, 12)) continue;
    if (dist(x, y, avoidX, avoidY) < 200) continue;
    out.push(makePed(x, y, rng));
  }
  return out;
}

export function panicPeds(game, x, y, radius) {
  for (const ped of game.peds) {
    if (ped.dead) continue;
    if (dist(ped.x, ped.y, x, y) < radius) {
      ped.panicT = Math.max(ped.panicT, 2.6);
      ped.threatX = x;
      ped.threatY = y;
    }
  }
}

export function stepPed(game, ped, dt, rng) {
  if (ped.dead) return;
  if (ped.downT > 0) { // knocked down: lie still, then get up shaken
    ped.downT -= dt;
    ped.speed = 0;
    return;
  }
  let wantAngle = ped.angle;
  let wantSpeed = 62;
  if (ped.panicT > 0) {
    ped.panicT -= dt;
    wantAngle = angleTo(ped.threatX, ped.threatY, ped.x, ped.y); // straight away from the threat
    wantSpeed = 208;
  } else {
    ped.wanderT -= dt;
    if (ped.wanderT <= 0) {
      ped.wanderT = rng.range(1.6, 4.5);
      // Prefer to keep to the grid: turn in quarter turns most of the time.
      const quarter = Math.round(ped.angle / (Math.PI / 2)) * (Math.PI / 2);
      wantAngle = rng.chance(0.65) ? quarter + rng.pick([0, Math.PI / 2, -Math.PI / 2]) : rng.range(0, Math.PI * 2);
    }
  }
  ped.angle += clamp(angleDelta(ped.angle, wantAngle), -3.4 * dt, 3.4 * dt);
  ped.speed += (wantSpeed - ped.speed) * Math.min(1, dt * 5);
  const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
  if (game.city.collidesCircle(nx, ny, 11) || isWaterAt(nx, ny)) {
    ped.angle += Math.PI * 0.75; // bounce off walls and the waterline
  } else {
    ped.x = nx;
    ped.y = ny;
  }
  ped.walkPhase += dt * (ped.speed > 120 ? 13 : 8);

  // Traffic is dangerous: a fast car through a crowd is the city's worst crime.
  for (const v of game.vehicles) {
    if (v.dead || v.kind !== 'car' || Math.abs(v.speed) < 26) continue;
    const rr = v.model.l / 2 + 6;
    if (dist(ped.x, ped.y, v.x, v.y) < rr) {
      const lethal = Math.abs(v.speed) > 120;
      ped.hp -= lethal ? 100 : 45;
      ped.downT = lethal ? 0 : 1.6;
      if (ped.hp <= 0) ped.dead = true;
      game.fx.blood(ped.x, ped.y);
      sfx.splat();
      game.onPedHit(ped, v, lethal || ped.dead);
      break;
    }
  }
}

export function hurtPed(game, ped, damage, fromX, fromY) {
  if (ped.dead) return;
  ped.hp -= damage;
  ped.panicT = 3;
  ped.threatX = fromX;
  ped.threatY = fromY;
  game.fx.blood(ped.x, ped.y);
  if (ped.hp <= 0) {
    ped.dead = true;
    game.onPedKilled(ped);
  }
}
