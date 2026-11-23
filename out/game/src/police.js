// police.js — the Solstice Bay PD. Crime raises heat; heat becomes stars;
// stars bring interceptors, then foot officers, roadblocks and gunfire.
// Heat decays while nobody in uniform can see the player, and hiding long
// enough loses the tail entirely. Officers shoot only at four stars and
// above, and a bust needs the player slow, close and seen — run and it
// drains away.

import { clamp } from './random.js';
import { createVehicle, controlToward, stepVehicle, damageVehicle } from './vehicles.js';
import { hurtPed } from './pedestrians.js';

const STAR_HEAT = [0, 12, 30, 55, 85, 120]; // heat needed for 1..5 stars

// Can an officer at (ox, oy) see the point (x, y)? Buildings block sight;
// range shrinks at night and in rain.
export function canSee(G, ox, oy, x, y) {
  const d = Math.hypot(x - ox, y - oy);
  let range = 430;
  if (G.weather.rain > 0.5) range *= 0.75;
  if (d > range) return false;
  const steps = Math.ceil(d / 46);
  for (let i = 1; i < steps; i++) {
    const sx = ox + ((x - ox) * i) / steps;
    const sy = oy + ((y - oy) * i) / steps;
    if (G.city.buildingPush(sx, sy, 4)) return false;
  }
  return true;
}

export function createPoliceSystem() {
  const P = {
    heat: 0,
    stars: 0,
    seen: 0,
    unseen: 99,
    bust: 0,
    units: [],
    officers: [],
    blockT: 0,
    shotT: 0,

    // A crime, reported. Unwitnessed crime still warms the air a little —
    // someone always hears a crash — but witnesses are what bring stars.
    report(G, severity, x, y, witnessed) {
      const near = G.peds.some((p) => Math.hypot(p.x - x, p.y - y) < 320);
      const seenByCop = P.units.some((u) => Math.hypot(u.x - x, u.y - y) < 460) || P.officers.some((o) => Math.hypot(o.x - x, o.y - y) < 380);
      const gain = severity * (witnessed || near || seenByCop ? 1 : 0.3);
      P.heat = Math.min(150, P.heat + gain);
      P.syncStars();
    },

    syncStars() {
      let s = 0;
      for (let i = 0; i < STAR_HEAT.length; i++) if (P.heat >= STAR_HEAT[i]) s = i;
      P.stars = s;
    },

    clear() {
      P.heat = 0;
      P.stars = 0;
      P.bust = 0;
      P.unseen = 99;
      for (const u of P.units) u.driver = 'traffic'; // they give up and patrol off
      P.units = [];
      P.officers = [];
    },

    wantedLevel() {
      return P.stars;
    },

    update(G, dt) {
      const player = G.player;
      const px = player.vehicle ? player.vehicle.x : player.x;
      const py = player.vehicle ? player.vehicle.y : player.y;

      // Sight: any unit or officer with line of sight counts.
      let visible = false;
      for (const u of P.units) if (canSee(G, u.x, u.y, px, py)) { visible = true; break; }
      if (!visible) for (const o of P.officers) if (canSee(G, o.x, o.y, px, py)) { visible = true; break; }
      if (P.stars > 0 && P.units.length === 0 && P.officers.length === 0) visible = false;

      if (visible) {
        P.seen += dt;
        P.unseen = 0;
        P.heat = Math.min(150, P.heat + dt * 1.1);
      } else {
        P.unseen += dt;
        P.seen = 0;
        if (P.stars > 0) P.heat -= dt * (P.unseen > 4 ? 3.4 : 0.8);
        if (P.heat <= 0.2 && P.stars > 0) {
          P.heat = 0;
          G.hud.notify('You lost the cops.');
          G.audio.play('objective');
        }
      }
      P.syncStars();

      // Force size follows the stars.
      const wantCars = P.stars === 0 ? 0 : [0, 1, 2, 3, 4, 5][P.stars];
      const wantFeet = P.stars >= 3 ? P.stars - 1 : 0;
      spawnUnits(G, P, wantCars, px, py);
      spawnOfficers(G, P, wantFeet, px, py);

      // Pursuit: aim ahead of the player's motion; ram at close quarters.
      // Roadblock cars hold their line and only settle.
      for (const u of P.units) {
        if (u.parked) {
          stepVehicle(G, u, { throttle: 0, steer: 0, handbrake: true }, dt);
          continue;
        }
        const lead = player.vehicle ? 0.55 : 0.25;
        const tx = px + (player.vehicle ? player.vehicle.vx : 0) * lead;
        const ty = py + (player.vehicle ? player.vehicle.vy : 0) * lead;
        const control = controlToward(u, tx, ty, { reach: 30 });
        if (Math.hypot(px - u.x, py - u.y) < 56) control.throttle = 1;
        stepVehicle(G, u, control, dt);
      }
      // Officers on foot chase and, at 4+ stars, shoot.
      P.shotT -= dt;
      for (const o of P.officers) {
        const d = Math.hypot(px - o.x, py - o.y);
        const want = Math.atan2(py - o.y, px - o.x);
        o.angle = want;
        if (d > 130) {
          o.x += Math.cos(want) * 150 * dt;
          o.y += Math.sin(want) * 150 * dt;
        }
        if (P.stars >= 4 && d < 330 && P.shotT <= 0 && canSee(G, o.x, o.y, px, py)) {
          P.shotT = 0.55;
          G.fx.muzzle(o.x, o.y, want);
          G.audio.play('shot');
          if (Math.random() < 0.42) G.hurtPlayer(7, want);
        }
        if (o.health <= 0) o.dead = true;
      }
      P.officers = P.officers.filter((o) => !o.dead);

      // Roadblocks at 3+ stars: parked interceptors across the road ahead.
      P.blockT -= dt;
      if (P.stars >= 3 && P.blockT <= 0) {
        P.blockT = 26;
        makeRoadblock(G, P, px, py);
      }

      // The bust meter: slow + close + seen fills it; speed or cover drains.
      const playerSpeed = player.vehicle ? Math.hypot(player.vehicle.vx, player.vehicle.vy) : (player.moving ? 150 : 0);
      const nearest = nearestCop(G, P, px, py);
      if (visible && playerSpeed < 55 && nearest < 120) P.bust += dt * 0.5;
      else P.bust = Math.max(0, P.bust - dt * 0.65);
      if (P.bust >= 1) {
        P.bust = 0;
        G.events.push({ type: 'busted' });
      }

      // Sirens follow the nearest chase.
      G.audio.setSiren(P.stars > 0 && nearest < 640);
    },
  };
  return P;
}

function nearestCop(G, P, px, py) {
  let best = Infinity;
  for (const u of P.units) best = Math.min(best, Math.hypot(u.x - px, u.y - py));
  for (const o of P.officers) best = Math.min(best, Math.hypot(o.x - px, o.y - py));
  return best;
}

function spawnUnits(G, P, want, px, py) {
  // No stars: the chase is over — units peel off and become traffic.
  if (want === 0) {
    for (const u of P.units) u.driver = 'traffic';
    P.units = [];
    return;
  }
  // Retire units that fell too far behind.
  for (let i = P.units.length - 1; i >= 0; i--) {
    const u = P.units[i];
    if (Math.hypot(u.x - px, u.y - py) > 1500 || u.dead) {
      u.driver = 'traffic';
      const gi = G.vehicles.indexOf(u);
      if (gi !== -1) G.vehicles.splice(gi, 1);
      P.units.splice(i, 1);
    }
  }
  let guard = 0;
  while (P.units.length < want && guard++ < 8) {
    // Spawn on a road, off-screen but close.
    const a = G.rng.range(0, Math.PI * 2);
    const p = G.city.randomRoadPoint(G.rng);
    if (Math.hypot(p.x - px, p.y - py) < 560) continue;
    if (Math.hypot(p.x - px, p.y - py) > 1200) continue;
    const u = createVehicle('interceptor', p.x, p.y, a, { driver: 'police' });
    G.vehicles.push(u);
    P.units.push(u);
  }
}

function spawnOfficers(G, P, want, px, py) {
  for (let i = P.officers.length - 1; i >= 0; i--) {
    if (Math.hypot(P.officers[i].x - px, P.officers[i].y - py) > 1300) P.officers.splice(i, 1);
  }
  let guard = 0;
  while (P.officers.length < want && guard++ < 8) {
    const a = G.rng.range(0, Math.PI * 2);
    const d = G.rng.range(420, 560);
    const x = px + Math.cos(a) * d;
    const y = py + Math.sin(a) * d;
    if (x < 20 || y < 20 || x > 4780 || y > 3580) continue;
    P.officers.push({ x, y, angle: 0, health: 40, shirt: '#1c2f57', skin: '#c88a5a', state: 'walk', timer: 0, tx: x, ty: y, speed: 150 });
  }
}

function makeRoadblock(G, P, px, py) {
  // Two interceptors parked across the road in the player's heading.
  const heading = G.player.vehicle ? G.player.vehicle.angle : G.player.angle;
  const bx = px + Math.cos(heading) * 620;
  const by = py + Math.sin(heading) * 620;
  const node = G.city.nearestNode(bx, by);
  if (!node) return;
  for (let i = -1; i <= 1; i += 2) {
    const u = createVehicle('interceptor', node.x + i * 30, node.y + (i > 0 ? 14 : -14), heading + Math.PI / 2, { driver: 'police' });
    u.parked = true;
    G.vehicles.push(u);
    P.units.push(u);
  }
}

export { damageVehicle, hurtPed };
