// player.js — Jax Marlowe: walking, sprinting and swimming, stealing and driving
// cars and boats, fists and the pistol, taking damage, and picking things up.
// The Game object in main.js owns the rules around him; this file owns the man.

import { PLAYER, WANTED } from './config.js';
import { clamp, dist, angleTo } from './random.js';
import { isWaterAt, onDock } from './city.js';
import { down, justPressed, moveVector, mouse } from './input.js';
import { stepVehicle } from './vehicles.js';
import { hurtPed, panicPeds, makePed } from './pedestrians.js';
import { hurtCopPed, addHeat } from './police.js';
import { sfx, setEngine } from './audio.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, radius: PLAYER.radius,
    health: PLAYER.maxHealth, armour: 0,
    inVehicle: false, vehicle: null, swimming: false,
    weapon: 'fists', hasPistol: false, ammo: 0,
    punchCd: 0, shootCd: 0, hurtT: 0, walkPhase: 0, speedNow: 0,
    shirt: '#0e7c86', skin: '#a06a3b', pants: '#263238',
  };
}

export function damagePlayer(game, amount, fromX, fromY) {
  const p = game.player;
  if (p.health <= 0) return;
  let left = amount;
  if (p.armour > 0) {
    const absorbed = Math.min(p.armour, left);
    p.armour -= absorbed;
    left -= absorbed;
  }
  p.health -= left;
  p.hurtT = 0.35;
  sfx.hurt();
  game.shake = Math.min(9, game.shake + amount * 0.14);
  if (fromX !== undefined) panicPeds(game, p.x, p.y, 130);
  if (p.health <= 0) {
    p.health = 0;
    game.onPlayerWasted();
  }
}

// The nearest vehicle the player could climb into, if any.
function enterableNear(game) {
  const p = game.player;
  let best = null;
  let bestD = 60;
  for (const v of game.vehicles) {
    if (v.dead || v.driver === 'player' || v.driver === 'cop') continue;
    const d = dist(p.x, p.y, v.x, v.y) - v.model.l / 2;
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

export function currentPrompt(game) {
  const p = game.player;
  if (p.inVehicle) return 'E — get out';
  const v = enterableNear(game);
  if (v) return v.kind === 'boat' ? `E — take the ${v.model.name}` : `E — steal the ${v.model.name}`;
  for (const poi of game.city.pois) {
    if (dist(p.x, p.y, poi.x, poi.y) < 58) {
      if (poi.kind === 'garage') return 'E — Neon Bay Garage: repairs, and heat off ($250 in a car)';
      if (poi.kind === 'clinic') return 'E — Solstice Clinic: patch up ($100)';
      if (poi.kind === 'armoury') return 'E — Ammu-Bay: armour $150 · pistol ammo $40';
    }
  }
  return null;
}

function enterVehicle(game, v) {
  const p = game.player;
  if (v.driver === 'traffic') {
    // A driver was in there: he bails out and runs, and somebody usually sees it.
    const driver = makePed(v.x + 18, v.y + 8, game.rng);
    driver.panicT = 3;
    driver.threatX = p.x;
    driver.threatY = p.y;
    game.peds.push(driver);
    addHeat(game, WANTED.heatFor.carjack, v.x, v.y);
    game.onCarjacked(v);
  } else if (v.driver === 'parked') {
    addHeat(game, WANTED.heatFor.stealCar, v.x, v.y);
  }
  v.driver = 'player';
  v.blockMode = false;
  p.inVehicle = true;
  p.vehicle = v;
  p.swimming = false;
  sfx.door();
}

function exitVehicle(game) {
  const p = game.player;
  const v = p.vehicle;
  if (!v) return;
  const side = Math.PI / 2;
  for (const s of [1, -1]) {
    const ex = v.x + Math.cos(v.angle + side * s) * (v.model.w / 2 + 18);
    const ey = v.y + Math.sin(v.angle + side * s) * (v.model.w / 2 + 18);
    if (!game.city.collidesCircle(ex, ey, p.radius)) {
      p.x = ex;
      p.y = ey;
      break;
    }
  }
  if (v.driver === 'player') v.driver = 'parked';
  p.inVehicle = false;
  p.vehicle = null;
  p.swimming = isWaterAt(p.x, p.y) && !onDock(p.x, p.y);
  setEngine(false);
  sfx.door();
}

function firePistol(game) {
  const p = game.player;
  p.ammo -= 1;
  p.shootCd = PLAYER.pistolCooldown;
  const aim = p.angle;
  const x0 = p.x + Math.cos(aim) * 18;
  const y0 = p.y + Math.sin(aim) * 18;
  game.fx.muzzle(p.x, p.y, aim);
  sfx.shot();
  panicPeds(game, p.x, p.y, 240);
  game.onPlayerShot(p.x, p.y);

  // Walk the shot out: the first thing it meets — wall, car, person — takes it.
  let hitX = x0 + Math.cos(aim) * PLAYER.pistolRange;
  let hitY = y0 + Math.sin(aim) * PLAYER.pistolRange;
  let victim = null;
  let victimKind = null;
  const steps = Math.floor(PLAYER.pistolRange / 12);
  for (let i = 1; i <= steps; i += 1) {
    const sx = x0 + Math.cos(aim) * i * 12;
    const sy = y0 + Math.sin(aim) * i * 12;
    if (game.city.collidesCircle(sx, sy, 2)) { hitX = sx; hitY = sy; break; }
    let stop = false;
    for (const ped of [...game.peds, ...game.copPeds]) {
      if (ped.dead) continue;
      if (dist(sx, sy, ped.x, ped.y) < 15) { victim = ped; victimKind = ped.cop ? 'cop' : 'ped'; hitX = sx; hitY = sy; stop = true; break; }
    }
    if (stop) break;
    for (const v of game.vehicles) {
      if (v.dead || v === p.vehicle) continue;
      if (dist(sx, sy, v.x, v.y) < v.model.l / 2.4) { victim = v; victimKind = 'vehicle'; hitX = sx; hitY = sy; stop = true; break; }
    }
    if (stop) break;
  }
  game.fx.sparks(hitX, hitY, 3);
  if (!victim) return;
  if (victimKind === 'ped') hurtPed(game, victim, PLAYER.pistolDamage, p.x, p.y);
  else if (victimKind === 'cop') hurtCopPed(game, victim, PLAYER.pistolDamage, p.x, p.y);
  else {
    victim.health -= PLAYER.pistolDamage * 0.5;
    if (victim.driver === 'traffic') victim.panicT = 4;
    if (victim.health <= 0 && !victim.dead) { victim.dead = true; game.fx.smoke(victim.x, victim.y, 6, true); }
  }
}

function throwPunch(game) {
  const p = game.player;
  p.punchCd = 0.34;
  sfx.punch();
  const reach = PLAYER.punchRange;
  const tx = p.x + Math.cos(p.angle) * reach * 0.7;
  const ty = p.y + Math.sin(p.angle) * reach * 0.7;
  for (const ped of [...game.peds, ...game.copPeds]) {
    if (ped.dead) continue;
    if (dist(tx, ty, ped.x, ped.y) < reach * 0.8) {
      if (ped.cop) hurtCopPed(game, ped, PLAYER.punchDamage, p.x, p.y);
      else hurtPed(game, ped, PLAYER.punchDamage, p.x, p.y);
      ped.x += Math.cos(p.angle) * 10;
      ped.y += Math.sin(p.angle) * 10;
      return;
    }
  }
  for (const v of game.vehicles) {
    if (!v.dead && dist(tx, ty, v.x, v.y) < v.model.l / 2.2) game.fx.sparks(tx, ty, 2);
  }
}

export function stepPlayer(game, dt) {
  const p = game.player;
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);

  if (p.inVehicle && p.vehicle) {
    const v = p.vehicle;
    if (v.dead) { exitVehicle(game); return; }
    const ctrl = {
      throttle: (down('KeyW', 'ArrowUp') ? 1 : 0) + (down('KeyS', 'ArrowDown') ? -1 : 0),
      steer: (down('KeyA', 'ArrowLeft') ? -1 : 0) + (down('KeyD', 'ArrowRight') ? 1 : 0),
      brake: down('Space'),
      handbrake: down('Space'),
    };
    stepVehicle(game, v, dt, ctrl);
    p.x = v.x;
    p.y = v.y;
    p.angle = v.angle;
    p.speedNow = Math.abs(v.speed);
    setEngine(true, v.speed / v.model.topSpeed);
    if (justPressed('KeyE')) exitVehicle(game);
    return;
  }

  setEngine(false);
  // On foot: face the mouse, move with the keys.
  const mw = game.mouseWorld;
  if (mw) p.angle = angleTo(p.x, p.y, mw.x, mw.y);
  const mv = moveVector();
  p.swimming = isWaterAt(p.x, p.y) && !onDock(p.x, p.y);
  const sprinting = down('ShiftLeft', 'ShiftRight');
  const speed = p.swimming ? PLAYER.swimSpeed : sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const vx = mv.x * speed;
  const vy = mv.y * speed;
  p.speedNow = Math.hypot(vx, vy);
  if (vx || vy) {
    const nx = p.x + vx * dt;
    const ny = p.y + vy * dt;
    if (!game.city.collidesCircle(nx, p.y, p.radius)) p.x = nx;
    if (!game.city.collidesCircle(p.x, ny, p.radius)) p.y = ny;
    p.walkPhase += dt * (sprinting ? 12 : 9);
    if (p.swimming && Math.random() < 0.12) game.fx.splash(p.x, p.y, 1);
  }
  // Cars shove the player aside; a fast one knocks him down and hurts.
  for (const v of game.vehicles) {
    if (v.dead || v.kind !== 'car') continue;
    const rr = v.model.l / 2.1;
    const d = dist(p.x, p.y, v.x, v.y);
    if (d < rr && d > 0.01) {
      const push = (rr - d);
      p.x += ((p.x - v.x) / d) * push;
      p.y += ((p.y - v.y) / d) * push;
      if (Math.abs(v.speed) > 120 && v.driver !== 'player') damagePlayer(game, 16, v.x, v.y);
    }
  }
  p.x = clamp(p.x, 14, 4800 - 14);
  p.y = clamp(p.y, 14, 3600 - 14);

  if (justPressed('KeyQ') && p.hasPistol) {
    p.weapon = p.weapon === 'pistol' ? 'fists' : 'pistol';
    game.fx.addText(p.x, p.y - 26, p.weapon === 'pistol' ? 'Pistol' : 'Fists', '#ffd166', 14);
  }
  const m = mouse();
  if ((m.down || down('KeyF')) && !p.swimming) {
    if (p.weapon === 'pistol' && p.hasPistol && p.ammo > 0) {
      if (p.shootCd <= 0) firePistol(game);
    } else if (p.punchCd <= 0) throwPunch(game);
  }

  if (justPressed('KeyE')) {
    const v = enterableNear(game);
    if (v) { enterVehicle(game, v); return; }
    game.usePoiAtPlayer();
  }

  // Pickups scattered by the world: shells, and the odd dropped good thing.
  for (const pk of game.pickups) {
    if (pk.taken) continue;
    if (dist(p.x, p.y, pk.x, pk.y) < 27) {
      pk.taken = true;
      game.onPickup(pk);
    }
  }
  for (const sh of game.city.shells) {
    if (sh.taken) continue;
    if (dist(p.x, p.y, sh.x, sh.y) < 26) {
      sh.taken = true;
      game.onShell(sh);
    }
  }
}
