// player.js — Jax Marlin, the player's man in Solstice Bay. On foot he
// walks, sprints, picks up seashells and fights with fists or the Harbor
// 9mm; E puts him in the nearest car or boat — stealing one with a driver
// in it is a crime, and the SBPD notice — and while driving he works the
// shared vehicle physics with the keyboard.

import { PLAYER, WEAPONS } from './config.js';
import { clamp, dist, angleTo } from './random.js';
import { isWater } from './city.js';
import { scarePeds, hurtPed } from './pedestrians.js';
import { damageVehicle } from './vehicles.js';
import { reportCrime } from './police.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, vx: 0, vy: 0,
    health: PLAYER.maxHealth, armor: 0,
    cash: PLAYER.startCash,
    weapon: 'fists', ammo: 0, hasPistol: false,
    vehicle: null, fireCd: 0, walkCycle: 0, moving: false,
    shellsFound: new Set(),
  };
}

export function hurtPlayer(G, amount, fromX, fromY) {
  const p = G.player;
  if (G.state !== 'playing' || p.health <= 0) return;
  const absorbed = Math.min(p.armor, amount * 0.6);
  p.armor -= absorbed;
  p.health -= (amount - absorbed);
  G.fx.hurtFlash();
  G.audio.punch();
  if (fromX !== undefined) {
    G.fx.burst(p.x, p.y, { n: 5, color: '#d94f4f', speed: 110, life: 0.35, size: 2.4 });
    void fromY;
  }
  if (p.health <= 0) {
    p.health = 0;
    G.onWasted();
  }
}

export function updatePlayer(G, dt) {
  const p = G.player;
  p.fireCd -= dt;
  if (p.vehicle) {
    driveVehicle(G, dt);
  } else {
    walkOnFoot(G, dt);
  }
  collectShells(G);
}

function walkOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  const mv = input.moveVector();
  const sprint = input.down('ShiftLeft', 'ShiftRight');
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  p.moving = mv.x !== 0 || mv.y !== 0;
  if (p.moving) {
    const len = Math.hypot(mv.x, mv.y);
    const nx = p.x + (mv.x / len) * speed * dt;
    const ny = p.y + (mv.y / len) * speed * dt;
    // The bay is for boats: on foot you stop at the waterline.
    if (!isWater(nx, p.y)) p.x = nx;
    if (!isWater(p.x, ny)) p.y = ny;
    const resolved = G.city.collideBuildings(p.x, p.y, PLAYER.radius);
    p.x = clamp(resolved[0], 16, 4784);
    p.y = clamp(resolved[1], 16, 3584);
    p.angle = Math.atan2(mv.y, mv.x);
    p.walkCycle += dt * (sprint ? 13 : 9);
    p.vx = (mv.x / len) * speed;
    p.vy = (mv.y / len) * speed;
  } else {
    p.vx = 0; p.vy = 0;
  }

  // Aim at the mouse while fighting; face the walk direction otherwise.
  const fighting = input.mouse.down || input.down('KeyF');
  if (fighting && G.mouseWorld) {
    p.angle = angleTo(p.x, p.y, G.mouseWorld.x, G.mouseWorld.y);
    tryAttack(G);
  }

  if (input.hit('KeyE')) {
    const v = nearestVehicle(G, PLAYER.enterRange);
    if (v) enterVehicle(G, v);
  }
}

function driveVehicle(G, dt) {
  const p = G.player;
  const v = p.vehicle;
  const input = G.input;
  v.control.throttle = (input.down('KeyW', 'ArrowUp') ? 1 : 0) + (input.down('KeyS', 'ArrowDown') ? -1 : 0);
  v.control.steer = (input.down('KeyA', 'ArrowLeft') ? -1 : 0) + (input.down('KeyD', 'ArrowRight') ? 1 : 0);
  v.control.handbrake = input.down('Space');
  p.x = v.x; p.y = v.y;
  p.angle = v.angle;
  p.walkCycle += dt * Math.min(10, Math.hypot(v.vx, v.vy) * 0.05);
  G.audio.engine(true, Math.min(1, Math.abs(Math.hypot(v.vx, v.vy)) / v.def.speed));

  if (input.hit('KeyE')) exitVehicle(G);
  void dt;
}

export function exitVehicle(G) {
  const p = G.player;
  const v = p.vehicle;
  if (!v) return;
  // Step out on the dry side.
  for (const side of [-1, 1, 0]) {
    const ex = v.x + Math.cos(v.angle + side * Math.PI / 2) * (v.def.size[1] + 18);
    const ey = v.y + Math.sin(v.angle + side * Math.PI / 2) * (v.def.size[1] + 18);
    if (v.def.kind === 'boat' || !isWater(ex, ey)) {
      p.x = ex; p.y = ey;
      break;
    }
  }
  if (v.def.kind === 'boat' && isWater(p.x, p.y)) {
    // Stepping off a boat means the pier or the shore; find dry ground.
    for (let r = 30; r < 200; r += 22) {
      let placed = false;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
        const ex = v.x + Math.cos(a) * r, ey = v.y + Math.sin(a) * r;
        if (!isWater(ex, ey)) { p.x = ex; p.y = ey; placed = true; break; }
      }
      if (placed) break;
    }
  }
  v.driver = null;
  v.control.throttle = 0; v.control.steer = 0; v.control.handbrake = false;
  p.vehicle = null;
  G.audio.engine(false, 0);
  G.audio.ui();
}

export function enterVehicle(G, v) {
  const p = G.player;
  const wasOccupied = v.driver === 'traffic' || v.driver === 'police';
  if (v.driver === 'police') {
    // Dragging an officer out of an interceptor: very illegal.
    reportCrime(G, 'hitPolice', v.x, v.y, scarePeds(G, v.x, v.y, 240, null) + 1);
  } else if (wasOccupied) {
    const witnesses = scarePeds(G, v.x, v.y, 250, 'stealCar');
    reportCrime(G, 'stealCar', v.x, v.y, witnesses);
    G.notify('Vehicle stolen', '#ffb340');
  }
  if (v.driver === 'traffic') {
    // The driver bails and runs.
    const ped = { x: v.x + 20, y: v.y + 10, angle: 0, state: 'flee', panic: 3, health: 30, speed: 50, runSpeed: 165, shirt: '#cccccc', skin: '#e0ac69', walkCycle: 0, target: null, dead: false };
    G.peds.push(ped);
  }
  v.driver = 'player';
  v.parked = false;
  p.vehicle = v;
  p.x = v.x; p.y = v.y;
  G.audio.ui();
  if (G.missions) G.missions.onEnterVehicle(G, v);
}

function nearestVehicle(G, range) {
  let best = null, bestD = range;
  for (const v of G.vehicles) {
    if (v.wreck || v.driver === 'player') continue;
    const d = dist(G.player.x, G.player.y, v.x, v.y);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

function tryAttack(G) {
  const p = G.player;
  if (p.fireCd > 0) return;
  const w = WEAPONS[p.weapon];
  if (p.weapon === 'pistol') {
    if (p.ammo <= 0) {
      G.notify('Out of ammo — Fort Arms sells more', '#ff8a7a');
      p.fireCd = 0.45;
      return;
    }
    p.ammo--;
  }
  p.fireCd = w.rate;
  if (p.weapon === 'pistol') {
    G.audio.shot();
    G.fx.muzzle(p.x, p.y, p.angle);
  } else {
    G.audio.punch();
  }

  const witnesses = scarePeds(G, p.x, p.y, 300, null);
  const spread = (Math.random() - 0.5) * 2 * w.spread;
  const a = p.angle + spread;
  if (p.weapon === 'pistol') reportCrime(G, 'shootNear', p.x, p.y, witnesses);

  // Hitscan: walk the ray, the first solid thing takes the hit.
  const steps = Math.floor(w.range / 14);
  for (let i = 1; i <= steps; i++) {
    const hx = p.x + Math.cos(a) * i * 14;
    const hy = p.y + Math.sin(a) * i * 14;
    if (G.city.buildingAt(hx, hy)) break;
    let consumed = false;
    for (const ped of G.peds) {
      if (ped.state !== 'down' && dist(ped.x, ped.y, hx, hy) < 13) {
        hurtPed(G, ped, w.damage, a);
        if (ped.state === 'down') reportCrime(G, 'killPed', ped.x, ped.y, witnesses + 1);
        else reportCrime(G, 'shootHit', ped.x, ped.y, witnesses);
        consumed = true;
        break;
      }
    }
    if (consumed) break;
    for (const o of G.officers) {
      if (dist(o.x, o.y, hx, hy) < 13) {
        o.health -= w.damage;
        reportCrime(G, 'hitPolice', o.x, o.y, witnesses + 1);
        if (o.health <= 0) G.fx.burst(o.x, o.y, { n: 10, color: '#5a8cff', speed: 150, life: 0.4, size: 3 });
        consumed = true;
        break;
      }
    }
    if (consumed) break;
    for (const v of G.vehicles) {
      if (v !== p.vehicle && !v.wreck && Math.abs(hx - v.x) < v.def.size[0] / 2 + 4 && Math.abs(hy - v.y) < v.def.size[1] / 2 + 4) {
        damageVehicle(G, v, w.damage * 0.7, 'shot');
        G.fx.sparks(hx, hy, a + Math.PI);
        if (v.driver === 'police') reportCrime(G, 'hitPolice', v.x, v.y, witnesses + 1);
        consumed = true;
        break;
      }
    }
    if (consumed) break;
  }
}

function collectShells(G) {
  const p = G.player;
  if (p.vehicle) return;
  for (const s of G.city.shells) {
    if (s.taken || p.shellsFound.has(s.id)) continue;
    if (dist(p.x, p.y, s.x, s.y) < 26) {
      s.taken = true;
      p.shellsFound.add(s.id);
      G.addCash(40, s.x, s.y);
      G.audio.pickup();
      if (p.shellsFound.size >= 25) {
        G.addCash(1000, p.x, p.y);
        G.notify('Every seashell found! Bonus $1,000', '#ffd94a');
        G.audio.levelup();
      } else {
        G.notify('Seashell ' + p.shellsFound.size + ' / 25', '#bfe6ff');
      }
    }
  }
}
