// police.js — the SBPD and the wanted system. Crimes add heat when someone
// sees them (a fleeing witness, or an officer in range). Heat makes stars,
// stars make interceptors, roadblocks and foot officers, and all of them
// want one thing: the player stopped, boxed in, and busted.

import { WANTED } from './config.js';
import { rand, clamp, dist, angleTo, angleDiff } from './random.js';
import { makeVehicle } from './vehicles.js';

export function createWanted() {
  return {
    heat: 0, stars: 0,
    seen: false, lastSeenX: 0, lastSeenY: 0, unseenFor: 0,
    bust: 0, escaped: false, roadblockStars: 0,
  };
}

export function starsForHeat(heat) {
  let s = 0;
  for (let i = 0; i < WANTED.thresholds.length; i++) {
    if (heat >= WANTED.thresholds[i]) s = i;
  }
  return s;
}

// A crime happened at (x, y). It only counts if somebody saw it: a witness
// count from pedestrians, or an officer already close enough to see.
export function reportCrime(G, kind, x, y, witnesses) {
  const officerNear = G.vehicles.some((v) => v.driver === 'police' && dist(v.x, v.y, x, y) < 430)
    || G.officers.some((o) => dist(o.x, o.y, x, y) < 380);
  if (!witnesses && !officerNear) return false;
  const points = WANTED.crimes[kind] || 10;
  G.wanted.heat = Math.min(460, G.wanted.heat + points);
  G.wanted.lastSeenX = x;
  G.wanted.lastSeenY = y;
  G.wanted.unseenFor = 0;
  G.wanted.escaped = false;
  return true;
}

// Missions can force a wanted level (survival stages).
export function forceHeat(G, stars) {
  const target = WANTED.thresholds[stars] + 12;
  if (G.wanted.heat < target) G.wanted.heat = target;
  G.wanted.unseenFor = 0;
  G.wanted.lastSeenX = G.player.x;
  G.wanted.lastSeenY = G.player.y;
}

function spawnInterceptor(G) {
  const p = G.player;
  for (let tries = 0; tries < 8; tries++) {
    const node = G.city.nearestNode(p.x + rand(-760, 760), p.y + rand(-760, 760));
    if (!node) continue;
    const d = dist(node.x, node.y, p.x, p.y);
    if (d < 430 || d > 900) continue;
    const v = makeVehicle('interceptor', node.x, node.y, rand(0, 6.28), 'police');
    v.cruiseSpeed = 1;
    G.vehicles.push(v);
    return v;
  }
  return null;
}

function spawnOfficer(G) {
  const p = G.player;
  const a = rand(0, Math.PI * 2);
  const x = p.x + Math.cos(a) * rand(300, 420);
  const y = p.y + Math.sin(a) * rand(300, 420);
  G.officers.push({ x, y, angle: 0, health: 46, speed: rand(150, 172), state: 'chase', shootCd: rand(0.4, 1.4), walkCycle: 0 });
}

function spawnRoadblock(G) {
  const p = G.player;
  const heading = p.vehicle ? p.vehicle.angle : p.angle;
  const tx = p.x + Math.cos(heading) * 560;
  const ty = p.y + Math.sin(heading) * 560;
  const node = G.city.nearestNode(tx, ty);
  if (!node) return;
  const across = heading + Math.PI / 2;
  for (const off of [-30, 30]) {
    const v = makeVehicle('interceptor', node.x + Math.cos(across) * off, node.y + Math.sin(across) * off, across, 'police');
    v.parked = true;
    v.cruiseSpeed = 0;
    G.vehicles.push(v);
    G.roadblocks.push(v);
  }
  G.wanted.roadblockStars = G.wanted.stars;
}

export function updatePolice(G, dt) {
  const W = G.wanted;
  const p = G.player;

  // Visibility: any unit with eyes on the player refreshes the search.
  let seen = false;
  for (const v of G.vehicles) {
    if (v.driver === 'police' && dist(v.x, v.y, p.x, p.y) < 500) seen = true;
  }
  for (const o of G.officers) {
    if (dist(o.x, o.y, p.x, p.y) < 400) seen = true;
  }
  W.seen = seen;
  if (seen) {
    W.unseenFor = 0;
    W.lastSeenX = p.x; W.lastSeenY = p.y;
  } else {
    W.unseenFor += dt;
    if (W.heat > 0) W.heat = Math.max(0, W.heat - WANTED.decayPerSec * dt);
    if (W.heat <= 0 && W.stars > 0 && W.unseenFor > WANTED.searchTime) {
      W.stars = 0;
      W.escaped = true;
      G.notify('You lost the SBPD. Heat cleared.', '#7fe8a8');
      G.audio.pickup();
      clearPolice(G);
    }
  }
  // Stars follow heat down as it decays, but hold while a search is live:
  // heat at zero with the search timer still running keeps the last level
  // until the escape branch above clears it.
  const heatStars = starsForHeat(W.heat);
  if (heatStars > 0) W.stars = heatStars;
  else if (W.unseenFor > WANTED.searchTime) W.stars = 0;

  const cops = G.vehicles.filter((v) => v.driver === 'police' && !v.parked);
  const desired = [0, 1, 2, 3, 4, 6][W.stars] || 0;
  if (W.stars > 0 && cops.length < desired) {
    if (Math.random() < dt * 1.4) spawnInterceptor(G);
  }
  if (W.stars >= 3 && G.officers.length < W.stars - 1) {
    if (Math.random() < dt * 1.1) spawnOfficer(G);
  }
  if (W.stars >= 3 && W.roadblockStars < W.stars && Math.random() < dt * 0.5) {
    spawnRoadblock(G);
  }
  if (W.stars < 3) {
    for (const v of G.roadblocks) v.parked = false;
    G.roadblocks.length = 0;
    W.roadblockStars = 0;
  }

  // Despawn distant units so the chase can breathe.
  for (let i = G.vehicles.length - 1; i >= 0; i--) {
    const v = G.vehicles[i];
    if (v.driver === 'police' && !v.parked && dist(v.x, v.y, p.x, p.y) > 1250) G.vehicles.splice(i, 1);
  }
  for (let i = G.officers.length - 1; i >= 0; i--) {
    if (dist(G.officers[i].x, G.officers[i].y, p.x, p.y) > 1250) G.officers.splice(i, 1);
  }

  drivePolice(G, dt);
  updateOfficers(G, dt);
  updateBust(G, dt);
  G.audio.siren(W.stars > 0 && (cops.length > 0 || G.officers.length > 0));
}

function drivePolice(G, dt) {
  const p = G.player;
  const W = G.wanted;
  const units = G.vehicles.filter((v) => v.driver === 'police');
  let idx = 0;
  for (const v of units) {
    if (v.parked) { v.control.throttle = 0; v.control.steer = 0; continue; }
    if (v.health <= 0) { v.control.throttle = 0; continue; }
    // Box-in behaviour: the lead car rams the player's position, the next
    // aims ahead of the player, the rest aim at the flanks.
    let tx = W.seen ? p.x : W.lastSeenX;
    let ty = W.seen ? p.y : W.lastSeenY;
    if (p.vehicle && idx === 1) {
      tx += Math.cos(p.vehicle.angle) * 130;
      ty += Math.sin(p.vehicle.angle) * 130;
    } else if (p.vehicle && idx >= 2) {
      const side = idx % 2 === 0 ? 1 : -1;
      tx += Math.cos(p.vehicle.angle + Math.PI / 2) * side * 90;
      ty += Math.sin(p.vehicle.angle + Math.PI / 2) * side * 90;
    }
    const want = angleTo(v.x, v.y, tx, ty);
    const diff = angleDiff(v.angle, want);
    v.control.steer = clamp(diff * 2.6, -1, 1);
    const d = dist(v.x, v.y, tx, ty);
    const playerSlow = !p.vehicle || Math.hypot(p.vehicle.vx, p.vehicle.vy) < 40;
    if (d < 60 && playerSlow) {
      v.control.throttle = 0;             // sit on the player: bust pressure
    } else if (Math.abs(diff) > 2.2 && d < 120) {
      v.control.throttle = -0.7;          // reverse out of a bad angle
    } else {
      v.control.throttle = 1;
    }
    v.control.handbrake = Math.abs(diff) > 0.9 && d < 200;
    v.sirenPhase += dt * 9;
    idx++;
  }
}

function updateOfficers(G, dt) {
  const p = G.player;
  const W = G.wanted;
  for (let i = G.officers.length - 1; i >= 0; i--) {
    const o = G.officers[i];
    if (o.health <= 0) { G.officers.splice(i, 1); continue; }
    o.walkCycle += dt * 9;
    const tx = W.seen ? p.x : W.lastSeenX;
    const ty = W.seen ? p.y : W.lastSeenY;
    const d = dist(o.x, o.y, tx, ty);
    if (d > 34) {
      o.angle = angleTo(o.x, o.y, tx, ty);
      o.x += Math.cos(o.angle) * o.speed * dt;
      o.y += Math.sin(o.angle) * o.speed * dt;
    }
    const resolved = G.city.collideBuildings(o.x, o.y, 10);
    o.x = resolved[0]; o.y = resolved[1];
    // Gunfire at four stars and up, when the player is on foot and close.
    o.shootCd -= dt;
    if (W.stars >= 4 && !p.vehicle && dist(o.x, o.y, p.x, p.y) < 265 && o.shootCd <= 0) {
      o.shootCd = rand(0.7, 1.5);
      G.fx.muzzle(o.x, o.y, angleTo(o.x, o.y, p.x, p.y));
      G.audio.shot();
      if (Math.random() < 0.42) G.hurtPlayer(9, o.x, o.y);
    }
  }
}

function updateBust(G, dt) {
  const p = G.player;
  const W = G.wanted;
  if (W.stars === 0) { W.bust = 0; return; }
  const playerSpeed = p.vehicle ? Math.hypot(p.vehicle.vx, p.vehicle.vy) : Math.hypot(p.vx || 0, p.vy || 0);
  let pressure = false;
  if (playerSpeed < 42) {
    for (const v of G.vehicles) {
      if (v.driver === 'police' && dist(v.x, v.y, p.x, p.y) < 74) pressure = true;
    }
    for (const o of G.officers) {
      if (dist(o.x, o.y, p.x, p.y) < 40) pressure = true;
    }
  }
  if (pressure) {
    W.bust += dt;
    if (W.bust >= 2.6) {
      W.bust = 0;
      G.onBusted();
    }
  } else {
    W.bust = Math.max(0, W.bust - dt * 1.6);
  }
}

export function clearPolice(G) {
  for (let i = G.vehicles.length - 1; i >= 0; i--) {
    if (G.vehicles[i].driver === 'police') G.vehicles.splice(i, 1);
  }
  G.officers.length = 0;
  G.roadblocks.length = 0;
  G.wanted.heat = 0;
  G.wanted.stars = 0;
  G.wanted.roadblockStars = 0;
  G.audio.siren(false);
}
