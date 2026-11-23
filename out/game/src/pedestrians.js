// pedestrians.js — the people of Solstice Bay. They stroll the pavements
// (the strips just off the roads), chat in pairs, and panic properly:
// a gunshot, a crash or a car on the pavement scatters them, and a car that
// reaches one knocks them down. Downed peds get up again after a while
// unless the hit was hard.

import { clamp } from './random.js';
import { isWater, isRoad } from './city.js';

const SHIRTS = ['#d95f4b', '#4b7fd9', '#4bd97a', '#d9c84b', '#b44bd9', '#d9d9d9', '#4bd0d9', '#d98a4b'];

export function createPed(x, y, rng) {
  return {
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(38, 62),
    state: 'walk', // walk | panic | down
    timer: rng.range(1, 5),
    shirt: rng.pick(SHIRTS),
    skin: rng.pick(['#f0c8a0', '#c88a5a', '#8a5a34', '#f5d7b8']),
    health: 30,
    tx: x, ty: y,
  };
}

export function spawnPeds(G, count) {
  const peds = [];
  let guard = 0;
  while (peds.length < count && guard++ < count * 30) {
    const x = G.rng.range(140, 2380);
    const y = G.rng.range(140, 3460);
    // Pavements: near a road but not on it, and never inside a building.
    if (isWater(x, y) || isRoad(x, y)) continue;
    if (G.city.buildingPush(x, y, 16)) continue;
    peds.push(createPed(x, y, G.rng));
  }
  // A few beachgoers and island walkers too.
  for (let i = 0; i < 8; i++) {
    const y = G.rng.range(300, 3300);
    peds.push(createPed(2430 - G.rng.range(0, 60), y, G.rng));
  }
  return peds;
}

// Something frightening happened at (x, y): nearby peds run from it, and
// anyone close enough to see it is a witness for the police.
export function scarePeds(G, x, y, radius) {
  let witnessed = false;
  for (const p of G.peds) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < radius) {
      if (p.state === 'walk') {
        p.state = 'panic';
        p.timer = 2.6;
        p.angle = Math.atan2(p.y - y, p.x - x) + (Math.random() - 0.5) * 0.7;
      }
      if (d < 300) witnessed = true;
    }
  }
  return witnessed;
}

export function hurtPed(G, p, damage, angle) {
  p.health -= damage;
  if (p.health <= 0 && p.state !== 'down') {
    p.state = 'down';
    p.timer = 9;
    p.angle = angle || p.angle;
  } else if (p.state === 'walk') {
    p.state = 'panic';
    p.timer = 2.2;
  }
}

export function stepPeds(G, dt) {
  for (const p of G.peds) {
    if (p.hostile) continue; // mission lookouts are stepped by missions.js
    if (p.state === 'down') {
      p.timer -= dt;
      if (p.timer <= 0) {
        p.state = 'walk';
        p.health = 30;
      }
      continue;
    }
    p.timer -= dt;
    if (p.state === 'panic') {
      movePed(G, p, p.speed * 2.6, dt);
      if (p.timer <= 0) p.state = 'walk';
      continue;
    }
    // Strolling: pick a nearby pavement point and amble to it.
    if (p.timer <= 0 || Math.hypot(p.tx - p.x, p.ty - p.y) < 12) {
      p.timer = G.rng.range(3, 8);
      for (let tries = 0; tries < 8; tries++) {
        const tx = p.x + G.rng.range(-260, 260);
        const ty = p.y + G.rng.range(-260, 260);
        if (!isWater(tx, ty) && !G.city.buildingPush(tx, ty, 14)) {
          p.tx = tx;
          p.ty = ty;
          break;
        }
      }
    }
    const want = Math.atan2(p.ty - p.y, p.tx - p.x);
    let delta = want - p.angle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    p.angle += clamp(delta, -3.4 * dt, 3.4 * dt);
    movePed(G, p, p.speed, dt);
  }
}

function movePed(G, p, speed, dt) {
  const nx = p.x + Math.cos(p.angle) * speed * dt;
  const ny = p.y + Math.sin(p.angle) * speed * dt;
  if (isWater(nx, ny)) {
    p.angle += Math.PI * 0.9;
    return;
  }
  const push = G.city.buildingPush(nx, ny, 12);
  if (push) {
    p.x = nx + push.x;
    p.y = ny + push.y;
    p.angle += 1.7;
    return;
  }
  p.x = clamp(nx, 16, 4784);
  p.y = clamp(ny, 16, 3584);
}
