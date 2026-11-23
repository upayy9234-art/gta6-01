// vehicles.js — every car and boat in Solstice Bay: the shared arcade
// physics (throttle, drift, handbrake, damage), traffic that follows the
// road graph, and the ambient boats that wander the bay.

import { VEHICLES, TRAFFIC_MODELS } from './config.js';
import { rand, choice, clamp, dist, angleTo, angleDiff, turnToward } from './random.js';
import { isWater } from './city.js';

let nextVehicleId = 1;

export function makeVehicle(model, x, y, angle, driver) {
  const def = VEHICLES[model];
  return {
    id: nextVehicleId++,
    model, def,
    x, y, angle: angle || 0,
    vx: 0, vy: 0,
    health: def.health,
    color: choice(def.colors),
    driver: driver || null,      // null | 'player' | 'traffic' | 'police' | 'mission'
    control: { throttle: 0, steer: 0, handbrake: false },
    route: null, routeIdx: 0,
    panic: 0, stopped: 0, burnTimer: 0, dead: false, wreck: false,
    sirenPhase: Math.random() * 6,
    targetPoint: null, cruiseSpeed: 1,
  };
}

export function speedOf(v) {
  return Math.hypot(v.vx, v.vy);
}

export function forwardSpeed(v) {
  return v.vx * Math.cos(v.angle) + v.vy * Math.sin(v.angle);
}

// One physics step for a single vehicle. G supplies city, weather and fx.
export function stepVehicle(G, v, dt) {
  if (v.wreck) return;
  const def = v.def;
  const c = v.control;
  const fx = Math.cos(v.angle), fy = Math.sin(v.angle);
  let fwd = v.vx * fx + v.vy * fy;
  let lat = v.vx * -fy + v.vy * fx;

  const burning = v.health <= 0;
  if (burning) {
    c.throttle = 0;
    v.burnTimer += dt;
    if (Math.random() < dt * 8) G.fx.smoke(v.x, v.y, v.burnTimer > 2.5);
    if (Math.random() < dt * 5) G.fx.fire(v.x, v.y);
    if (v.burnTimer > 3.2) { v.dead = true; v.wreck = true; }
  }

  // Engine and brakes.
  const wet = G.weather.gripFactor();
  if (c.throttle > 0) fwd += def.accel * c.throttle * dt;
  else if (c.throttle < 0) fwd += def.accel * 0.62 * c.throttle * dt;
  const drag = def.kind === 'boat' ? 0.55 : 0.32;
  fwd -= fwd * drag * dt;
  const topSpeed = def.speed * (v.cruiseSpeed || 1) * (burning ? 0.25 : 1);
  fwd = clamp(fwd, -def.speed * 0.38, topSpeed);

  // Steering: sharper at low speed, drifty under the handbrake.
  const steerAuthority = clamp(Math.abs(fwd) / 90, 0, 1) * (fwd < 0 ? -1 : 1);
  const turnRate = (def.kind === 'boat' ? 1.55 : 2.45) * steerAuthority;
  v.angle += c.steer * turnRate * dt;

  // Lateral grip kills sideways slide; the handbrake lets it live.
  const grip = def.grip * wet * (c.handbrake ? 0.30 : 1);
  lat -= lat * Math.min(1, grip * dt);
  if (c.handbrake && Math.abs(fwd) > 130 && Math.abs(c.steer) > 0.2 && def.kind === 'car') {
    G.fx.skid(v.x - fx * 14, v.y - fy * 14, v.angle);
    if (Math.random() < dt * 6) G.fx.smoke(v.x, v.y, false);
  }

  const nfx = Math.cos(v.angle), nfy = Math.sin(v.angle);
  v.vx = nfx * fwd + -nfy * lat;
  v.vy = nfy * fwd + nfx * lat;

  let nx = v.x + v.vx * dt;
  let ny = v.y + v.vy * dt;

  // Terrain rules: cars drown, boats beach.
  const inWater = isWater(nx, ny);
  if (def.kind === 'car' && inWater) {
    // The shore is a wall for cars (the causeway and piers are dry land).
    if (!isWater(v.x, ny)) { ny = v.y; v.vy = 0; }
    else if (!isWater(nx, v.y)) { nx = v.x; v.vx = 0; }
    else { nx = v.x; ny = v.y; v.vx *= 0.4; v.vy *= 0.4; }
    damageVehicle(G, v, 14 * dt * 10 * 0.1, 'water');
  }
  if (def.kind === 'boat') {
    if (!inWater) {
      nx = v.x; ny = v.y;
      v.vx *= 0.35; v.vy *= 0.35;
      damageVehicle(G, v, 22 * dt, 'beach');
    } else if (Math.random() < dt * 9 && speedOf(v) > 60) {
      G.fx.wake(v.x, v.y, v.angle);
    }
  }

  // Buildings are solid.
  const radius = def.size[1] * 0.72;
  const resolved = G.city.collideBuildings(nx, ny, radius);
  if (resolved[0] !== nx || resolved[1] !== ny) {
    const impact = speedOf(v);
    if (impact > 120) {
      damageVehicle(G, v, (impact - 100) * 0.06, 'crash');
      G.fx.sparks(nx, ny, v.angle);
      G.audio.crash(impact > 260);
      G.fx.addShake(clamp((impact - 120) / 40, 0, 5));
      if (v.driver === 'player') G.onPlayerCrash(v, impact);
    }
    v.vx *= 0.45; v.vy *= 0.45;
    nx = resolved[0]; ny = resolved[1];
  }

  v.x = clamp(nx, 20, 4780);
  v.y = clamp(ny, 20, 3580);
}

// Vehicle-on-vehicle bumps: soft push-apart plus damage at speed.
export function collideVehicles(G, list, dt) {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.wreck) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.wreck) continue;
      const rr = (a.def.size[1] + b.def.size[1]) * 0.95;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > rr * rr || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      const push = (rr - d) / 2;
      const ux = dx / d, uy = dy / d;
      a.x -= ux * push; a.y -= uy * push;
      b.x += ux * push; b.y += uy * push;
      const rel = Math.abs((a.vx - b.vx) * ux + (a.vy - b.vy) * uy);
      if (rel > 95) {
        damageVehicle(G, a, rel * 0.05, 'crash');
        damageVehicle(G, b, rel * 0.05, 'crash');
        G.fx.sparks((a.x + b.x) / 2, (a.y + b.y) / 2, 0);
        G.audio.crash(rel > 240);
        const playerInvolved = a.driver === 'player' || b.driver === 'player';
        if (playerInvolved) {
          const other = a.driver === 'player' ? b : a;
          G.onPlayerHitVehicle(other, rel);
        } else if (a.driver === 'traffic' && b.driver !== 'police') {
          a.panic = Math.max(a.panic, 3);
        } else if (b.driver === 'traffic' && a.driver !== 'police') {
          b.panic = Math.max(b.panic, 3);
        }
      }
    }
  }
  void dt;
}

export function damageVehicle(G, v, amount, cause) {
  if (v.wreck) return;
  const before = v.health;
  v.health -= amount;
  if (before > 34 && v.health <= 34 && v.health > 0) {
    G.fx.text(v.x, v.y - 26, 'SMOKING', '#ffb340');
  }
  if (v.health <= 0 && before > 0) {
    G.fx.burst(v.x, v.y, { n: 26, color: '#ff8a3c', speed: 280, life: 0.6, size: 4 });
    G.fx.addShake(4);
    if (v.driver === 'traffic') v.driver = 'fleeing';
    if (cause === 'crash' || cause === 'shot') void 0;
  }
}

// --- Traffic ---------------------------------------------------------------

export function spawnTrafficCar(G, nearX, nearY) {
  const node = G.city.nearestNode(nearX + rand(-700, 700), nearY + rand(-700, 700));
  if (!node) return null;
  const model = choice(TRAFFIC_MODELS);
  const v = makeVehicle(model, node.x + rand(-14, 14), node.y + rand(-14, 14), rand(0, Math.PI * 2), 'traffic');
  v.cruiseSpeed = rand(0.42, 0.62);
  giveTrafficRoute(G, v);
  return v;
}

export function giveTrafficRoute(G, v) {
  const from = G.city.nearestNode(v.x, v.y);
  let target = G.city.nodes[Math.floor(Math.random() * G.city.nodes.length)];
  if (!target || target.id === from.id) target = G.city.nodes[(from.id + 7) % G.city.nodes.length];
  const path = G.city.findPath(from.id, target.id);
  v.route = path ? path.map((n) => ({ x: n.x, y: n.y })) : [{ x: target.x, y: target.y }];
  v.routeIdx = 0;
}

export function updateTraffic(G, v, dt) {
  if (v.driver !== 'traffic') return;
  if (v.panic > 0) {
    v.panic -= dt;
    v.control.throttle = 1;
    v.control.steer = clamp(angleDiff(v.angle, v.angle + Math.sin(G.time * 2.2) * 0.6) * 2, -1, 1);
    v.cruiseSpeed = 0.95;
    return;
  }
  v.cruiseSpeed = v.def.taxi && G.sidejobs && G.sidejobs.taxiCar === v ? 0.6 : Math.min(v.cruiseSpeed + dt * 0.05, 0.62);
  if (!v.route || v.routeIdx >= v.route.length) giveTrafficRoute(G, v);
  const target = v.route[v.routeIdx];
  const d = dist(v.x, v.y, target.x, target.y);
  if (d < 42) { v.routeIdx++; return; }
  const want = angleTo(v.x, v.y, target.x, target.y);
  const diff = angleDiff(v.angle, want);
  v.control.steer = clamp(diff * 2.4, -1, 1);
  v.control.throttle = Math.abs(diff) > 1.25 ? -0.4 : 1;
  v.control.handbrake = false;
  // Slow down if something is right ahead.
  for (const other of G.vehicles) {
    if (other === v || other.wreck) continue;
    const ahead = dist(v.x + Math.cos(v.angle) * 52, v.y + Math.sin(v.angle) * 52, other.x, other.y);
    if (ahead < 34) { v.control.throttle = -0.55; break; }
  }
  if (v.stopped > 0) { v.stopped -= dt; v.control.throttle = 0; }
  else if (Math.random() < dt * 0.02) v.stopped = rand(0.4, 1.4);
}

// --- Ambient boats -----------------------------------------------------------

export function spawnBoat(G) {
  const spots = [
    { x: 3900, y: 1500 }, { x: 4050, y: 2400 }, { x: 3700, y: 3100 }, { x: 4300, y: 1200 },
  ];
  const s = choice(spots);
  const v = makeVehicle(Math.random() < 0.5 ? 'skiff' : 'marlin', s.x + rand(-80, 80), s.y + rand(-80, 80), rand(0, 6.28), 'traffic');
  v.cruiseSpeed = rand(0.4, 0.6);
  v.targetPoint = { x: rand(3650, 4650), y: rand(300, 3300) };
  return v;
}

export function updateBoat(G, v, dt) {
  if (!v.targetPoint || dist(v.x, v.y, v.targetPoint.x, v.targetPoint.y) < 70) {
    v.targetPoint = { x: rand(3600, 4680), y: rand(240, 3360) };
    if (!isWater(v.targetPoint.x, v.targetPoint.y)) return;
  }
  const want = angleTo(v.x, v.y, v.targetPoint.x, v.targetPoint.y);
  v.control.steer = clamp(angleDiff(v.angle, want) * 2, -1, 1);
  v.control.throttle = 1;
  void dt;
}
