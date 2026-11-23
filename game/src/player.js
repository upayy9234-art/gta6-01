// player.js — Jax Marlin, the player's man in Solstice Bay. On foot he
// walks, sprints, swims nowhere (the bay is for boats), picks up seashells
// and fights with fists or the Harbor 9mm; E puts him in the nearest car or
// boat — stealing one with a driver in it is a crime, and the SBPD notice —
// and while driving he works the shared vehicle physics with the keyboard.

import { PLAYER, WEAPONS, SHELLS_TOTAL } from './config.js';
import { clamp } from './random.js';
import { moveVector } from './input.js';
import { isWater } from './city.js';
import { stepVehicle, damageVehicle } from './vehicles.js';
import { scarePeds, hurtPed } from './pedestrians.js';

export function createPlayer(x, y) {
  return {
    name: 'Jax Marlin',
    x, y,
    angle: -Math.PI / 2,
    health: PLAYER.maxHealth,
    armor: 0,
    cash: PLAYER.startCash,
    weapon: 'fists',
    ammo: 0,
    vehicle: null,
    moving: false,
    fireT: 0,
    hitT: 0, // grace timer between vehicle-contact hits
    shells: 0,
    walkCycle: 0,
  };
}

// Damage lands on armour first; death is reported as an event for main.
export function hurtPlayer(G, amount, fromAngle) {
  const p = G.player;
  if (G.state !== 'playing') return;
  const absorbed = Math.min(p.armor, amount * 0.6);
  p.armor -= absorbed;
  p.health -= amount - absorbed;
  G.hud.flashRed();
  if (p.health <= 0) {
    p.health = 0;
    G.events.push({ type: 'wasted' });
  }
}

export function stepPlayer(G, dt) {
  const p = G.player;
  p.fireT -= dt;
  p.hitT = Math.max(0, p.hitT - dt);
  if (p.vehicle) stepDriving(G, dt);
  else stepOnFoot(G, dt);
}

function stepOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  const mv = moveVector(input);
  const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  p.moving = mv.x !== 0 || mv.y !== 0;
  if (p.moving) {
    const len = Math.hypot(mv.x, mv.y);
    const nx = p.x + (mv.x / len) * speed * dt;
    const ny = p.y + (mv.y / len) * speed * dt;
    if (!isWater(nx, p.y)) p.x = nx;
    if (!isWater(p.x, ny)) p.y = ny;
    const push = G.city.buildingPush(p.x, p.y, PLAYER.radius);
    if (push) {
      p.x += push.x;
      p.y += push.y;
    }
    p.x = clamp(p.x, 16, 4784);
    p.y = clamp(p.y, 16, 3584);
    p.angle = Math.atan2(mv.y, mv.x);
    p.walkCycle += dt * (sprint ? 13 : 9);
  }

  // Aim with the mouse while fighting; otherwise face the walk direction.
  const aim = G.aimWorld;
  const fighting = input.mouse.down || input.down('KeyF');
  if (fighting && aim) p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);
  if (fighting) tryAttack(G);

  // Seashells are picked up by walking over them.
  for (const s of G.city.shells) {
    if (!s.taken && Math.hypot(s.x - p.x, s.y - p.y) < 26) {
      s.taken = true;
      p.shells++;
      p.cash += 40;
      G.audio.play('shell');
      G.fx.text(p.x, p.y - 24, 'Shell ' + p.shells + '/' + SHELLS_TOTAL + '  +$40', '#facc15');
      if (p.shells === SHELLS_TOTAL) {
        p.cash += 500;
        G.hud.notify('Every shell found! Bonus +$500.');
        G.audio.play('cash');
      }
    }
  }

  // E: get into the nearest vehicle, or board a boat from the pier.
  if (input.hit('KeyE')) {
    const v = nearestVehicle(G, 64);
    if (v) enterVehicle(G, v);
  }
}

function stepDriving(G, dt) {
  const p = G.player;
  const v = p.vehicle;
  const input = G.input;
  const control = G.shotDrive || {
    throttle: (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) + (input.down('KeyS') || input.down('ArrowDown') ? -1 : 0),
    steer: (input.down('KeyA') || input.down('ArrowLeft') ? -1 : 0) + (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0),
    handbrake: input.down('Space'),
  };
  stepVehicle(G, v, control, dt);
  p.x = v.x;
  p.y = v.y;
  p.angle = v.angle;
  const rpm = Math.min(1, Math.abs(v.vx * Math.cos(v.angle) + v.vy * Math.sin(v.angle)) / v.def.topSpeed);
  G.audio.setEngine(true, rpm);

  if (input.hit('KeyE')) {
    // Step out beside the vehicle, on the dry side if it's a boat.
    let ex = v.x + Math.cos(v.angle - Math.PI / 2) * (v.def.wid + 16);
    let ey = v.y + Math.sin(v.angle - Math.PI / 2) * (v.def.wid + 16);
    if (isWater(ex, ey)) {
      ex = v.x + Math.cos(v.angle + Math.PI / 2) * (v.def.wid + 16);
      ey = v.y + Math.sin(v.angle + Math.PI / 2) * (v.def.wid + 16);
    }
    if (!isWater(ex, ey)) {
      p.x = ex;
      p.y = ey;
      v.driver = null;
      p.vehicle = null;
      G.audio.setEngine(false, 0);
      G.audio.play('door');
    } else {
      G.hud.notify('Too deep to step out here — bring her alongside a pier.');
    }
  }
}

function nearestVehicle(G, range) {
  let best = null;
  let bestD = range;
  for (const v of G.vehicles) {
    if (v.driver === 'player') continue;
    const d = Math.hypot(v.x - G.player.x, v.y - G.player.y);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

function enterVehicle(G, v) {
  const p = G.player;
  const stolen = v.driver === 'traffic' || v.driver === 'police';
  if (v.driver === 'police') G.police.units.splice(G.police.units.indexOf(v), 1);
  v.driver = 'player';
  p.vehicle = v;
  G.audio.play('door');
  if (stolen) {
    const witnessed = scarePeds(G, v.x, v.y, 240);
    G.police.report(G, v.type === 'interceptor' ? 5 : 2.5, v.x, v.y, witnessed);
    G.hud.notify('Vehicle stolen!');
  }
  if (G.missions) G.missions.onEnterVehicle(G, v);
}

function tryAttack(G) {
  const p = G.player;
  const w = WEAPONS[p.weapon];
  if (p.fireT > 0) return;
  if (p.weapon === 'pistol' && p.ammo <= 0) {
    G.hud.notify('Out of ammo — Fort Arms sells more.');
    p.fireT = 0.4;
    return;
  }
  p.fireT = w.rate;
  if (p.weapon === 'pistol') {
    p.ammo--;
    G.audio.play('shot');
  } else {
    G.audio.play('punch');
  }
  G.fx.muzzle(p.x, p.y, p.angle);
  const spread = (Math.random() - 0.5) * 2 * w.spread;
  const a = p.angle + spread;
  const witnessed = scarePeds(G, p.x, p.y, 330);
  if (p.weapon === 'pistol') G.police.report(G, 3, p.x, p.y, witnessed);

  // Hitscan: walk the ray and take the first thing it meets.
  const steps = Math.floor(w.range / 14);
  for (let i = 1; i <= steps; i++) {
    const hx = p.x + Math.cos(a) * i * 14;
    const hy = p.y + Math.sin(a) * i * 14;
    if (G.city.buildingPush(hx, hy, 3)) break;
    let hit = false;
    for (const ped of G.peds) {
      if (ped.state !== 'down' && Math.hypot(ped.x - hx, ped.y - hy) < 13) {
        hurtPed(G, ped, w.damage, a);
        if (ped.state === 'down') G.police.report(G, 4, ped.x, ped.y, witnessed);
        hit = true;
        break;
      }
    }
    if (hit) break;
    for (const o of G.police.officers) {
      if (Math.hypot(o.x - hx, o.y - hy) < 13) {
        o.health -= w.damage;
        if (o.health <= 0) G.police.report(G, 6, o.x, o.y, true);
        hit = true;
        break;
      }
    }
    if (hit) break;
    for (const v of G.vehicles) {
      if (v !== p.vehicle && Math.abs(hx - v.x) < v.def.len / 2 + 4 && Math.abs(hy - v.y) < v.def.wid / 2 + 4) {
        damageVehicle(G, v, w.damage * 0.7, a);
        G.fx.spark(hx, hy, a + Math.PI);
        if (v.driver) G.police.report(G, 2, v.x, v.y, witnessed);
        hit = true;
        break;
      }
    }
    if (hit) break;
  }
}
