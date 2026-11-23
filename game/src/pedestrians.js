// pedestrians.js — the people of Solstice Bay. They stroll the sidewalks,
// mind their own business, and remember what they see: a crime committed in
// front of witnesses is what turns heat into stars (police.js does that part;
// peds here raise the alarm flag on the game state).

import { rand, choice, clamp, dist, angleTo, angleDiff } from './random.js';
import { isWater } from './city.js';

const SHIRTS = ['#ef6461', '#f2c14e', '#6fb3e0', '#95d5b2', '#e5989b', '#ffc8dd', '#a2d2ff', '#fdffb6', '#caffbf', '#bdb2ff'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export function makePed(x, y) {
  return {
    x, y, angle: rand(0, Math.PI * 2),
    speed: rand(38, 62), runSpeed: rand(150, 185),
    shirt: choice(SHIRTS), skin: choice(SKINS),
    state: 'walk',          // walk | flee | down | witness
    target: null, panic: 0, health: 30,
    walkCycle: rand(0, 6), witnessTimer: 0, dead: false,
  };
}

export function spawnPed(G, nearX, nearY) {
  // Peds hug the sidewalks: spawn near a road node, offset to the kerb.
  const node = G.city.nearestNode(nearX + rand(-650, 650), nearY + rand(-650, 650));
  if (!node) return null;
  const x = node.x + rand(-70, 70), y = node.y + rand(-70, 70);
  if (isWater(x, y)) return null;
  const ped = makePed(x, y);
  ped.target = pickWalkTarget(G, ped);
  return ped;
}

function pickWalkTarget(G, ped) {
  const node = G.city.nearestNode(ped.x + rand(-420, 420), ped.y + rand(-420, 420));
  if (!node) return { x: ped.x, y: ped.y };
  return { x: node.x + rand(-58, 58), y: node.y + rand(-58, 58) };
}

// Something scary happened at (x, y): nearby peds flee, and the closest ones
// become witnesses who will report it if the police module asks.
export function scarePeds(G, x, y, radius, crimeKind) {
  let witnesses = 0;
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    const d = dist(ped.x, ped.y, x, y);
    if (d > radius) continue;
    ped.state = 'flee';
    ped.panic = rand(1.6, 3.2);
    ped.angle = angleTo(x, y, ped.x, ped.y);
    if (d < 240) {
      witnesses++;
      if (crimeKind) G.pendingWitness = { kind: crimeKind, x, y, at: G.time };
    }
  }
  return witnesses;
}

export function hurtPed(G, ped, damage, angle) {
  if (ped.state === 'down') return;
  ped.health -= damage;
  G.fx.burst(ped.x, ped.y, { n: 6, color: '#d94f4f', speed: 120, life: 0.4, size: 2.6 });
  if (ped.health <= 0) {
    ped.state = 'down';
    ped.dead = true;
    scarePeds(G, ped.x, ped.y, 260, null);
  } else {
    ped.state = 'flee';
    ped.panic = 2.6;
    ped.angle = angle + Math.PI + rand(-0.5, 0.5);
  }
}

export function updatePeds(G, dt) {
  const px = G.player.x, py = G.player.y;
  for (let i = G.peds.length - 1; i >= 0; i--) {
    const ped = G.peds[i];
    if (ped.state === 'down') continue;
    ped.walkCycle += dt * (ped.state === 'flee' ? 11 : 6);

    if (ped.state === 'flee') {
      ped.panic -= dt;
      ped.x += Math.cos(ped.angle) * ped.runSpeed * dt;
      ped.y += Math.sin(ped.angle) * ped.runSpeed * dt;
      if (Math.random() < dt * 2) ped.angle += rand(-0.7, 0.7);
      if (ped.panic <= 0) { ped.state = 'walk'; ped.target = pickWalkTarget(G, ped); }
    } else {
      if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 12) {
        ped.target = pickWalkTarget(G, ped);
      }
      const want = angleTo(ped.x, ped.y, ped.target.x, ped.target.y);
      ped.angle += angleDiff(ped.angle, want) * Math.min(1, dt * 5);
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      // Dodge out of the way of an oncoming car.
      for (const v of G.vehicles) {
        if (v.wreck) continue;
        const d = dist(ped.x, ped.y, v.x, v.y);
        if (d < 44 && Math.hypot(v.vx, v.vy) > 90) {
          ped.state = 'flee';
          ped.panic = 1.1;
          ped.angle = angleTo(v.x, v.y, ped.x, ped.y);
          break;
        }
      }
    }

    // Keep peds out of the water and out of walls.
    if (isWater(ped.x, ped.y)) {
      ped.x -= Math.cos(ped.angle) * ped.runSpeed * dt * 1.2;
      ped.y -= Math.sin(ped.angle) * ped.runSpeed * dt * 1.2;
      ped.target = pickWalkTarget(G, ped);
    }
    const resolved = G.city.collideBuildings(ped.x, ped.y, 10);
    ped.x = clamp(resolved[0], 12, 4788);
    ped.y = clamp(resolved[1], 12, 3588);

    // Run over? A fast vehicle passing through a ped puts them down.
    for (const v of G.vehicles) {
      if (v.wreck) continue;
      const sp = Math.hypot(v.vx, v.vy);
      if (sp < 70) continue;
      if (dist(ped.x, ped.y, v.x, v.y) < v.def.size[1] * 0.8 + 8) {
        hurtPed(G, ped, sp > 220 ? 40 : 22, v.angle);
        if (v.driver === 'player') G.onPlayerHitPed(ped, sp);
        break;
      }
    }

    // Despawn the far ones; the spawner in main keeps the near count up.
    if (dist(ped.x, ped.y, px, py) > 1150) G.peds.splice(i, 1);
  }
}
