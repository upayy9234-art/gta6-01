// Traffic, pedestrians and car physics. NPC cars cruise the road grid and turn at
// intersections; pedestrians stroll the sidewalks and the beach. The player's
// car uses simple arcade physics: accelerate, steer, drift a little, crash into
// buildings. Round 5 runs more traffic (14 cars, 30 pedestrians) plus parked
// cars from world.js, so the streets read busy even at golden hour.
import { CAR, CAR_MODELS, WORLD } from './config.js';
import { isInWater, nearestRoadPoint, roadCentersX, roadCentersY } from './world.js';

let carId = 0;
export function makeCar(x, y, angle, model, opts = {}) {
  return {
    id: carId += 1, x, y, angle, speed: 0, model, color: model.color,
    health: CAR.health, maxHealth: CAR.health, speedMul: 1, nitroBoost: false,
    npc: !!opts.npc, police: !!opts.police, patrol: !!opts.patrol, target: null,
    vx: 0, vy: 0, stuck: 0, honk: 0, driver: opts.driver ?? true,
  };
}

export function makeParkedCar(spot) {
  const car = makeCar(spot.x, spot.y, spot.angle, { name: 'Parked', color: spot.color, speed: 0.9 }, { npc: false, driver: false });
  car.speed = 0;
  return car;
}

export function spawnTrafficCar(random, state) {
  const xs = roadCentersX(); const ys = roadCentersY();
  const horizontal = random.next() < 0.5;
  const x = horizontal ? random.range(200, WORLD.width - 500) : random.pick(xs);
  const y = horizontal ? random.pick(ys) : random.range(200, WORLD.height - 200);
  const angle = horizontal ? (random.next() < 0.5 ? 0 : Math.PI) : (random.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
  const car = makeCar(x, y, angle, random.pick(CAR_MODELS), { npc: true });
  car.speed = random.range(120, 210);
  return car;
}

export function spawnPedestrian(random, state) {
  // One in five pedestrians strolls the beach instead of a sidewalk.
  if (random.next() < 0.2) {
    return {
      x: random.range(2910, 2950), y: random.range(150, WORLD.height - 150),
      angle: random.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2, speed: random.range(24, 44),
      color: ['#e8e4d8', '#d86a6a', '#6ad8a0', '#d8b36a', '#8a9ae8'][random.int(0, 4)],
      walkPhase: random.next() * 6, scared: 0, beach: true,
    };
  }
  const p = nearestRoadPoint(random.range(200, WORLD.width - 600), random.range(200, WORLD.height - 200));
  return {
    x: p.x + random.range(-70, 70), y: p.y + random.range(-70, 70),
    angle: random.next() * Math.PI * 2, speed: random.range(28, 55),
    color: ['#e8e4d8', '#d86a6a', '#6ad8a0', '#d8b36a', '#8a9ae8'][random.int(0, 4)],
    walkPhase: random.next() * 6, scared: 0, beach: false,
  };
}

export function updateCarPhysics(car, input, dt, state) {
  // Player-driven car. Wet roads grip less: steering dulls, acceleration
  // drops and the drag rises, so rain and storm really change the drive.
  // A car on shredded tyres (spikeSlow) drags and cannot hold its speed.
  const grip = state.weather?.gripMul ?? 1;
  if (car.spikeSlow > 0) {
    car.spikeSlow -= dt;
    car.speed *= Math.max(0, 1 - 1.1 * dt);
  }
  const forward = Math.cos(car.angle), right = Math.sin(car.angle);
  void forward; void right;
  let throttle = 0;
  if (input.up()) throttle = 1;
  else if (input.down()) throttle = car.speed > 5 ? -1 : -0.55;
  const steering = (input.left() ? -1 : 0) + (input.right() ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steering * CAR.turnRate * (0.65 + 0.35 * grip) * dt * Math.min(1, Math.abs(car.speed) / 120) * dir;
  car.speed += throttle * (throttle > 0 ? CAR.accel : CAR.brake) * car.model.speed * grip * dt;
  car.speed -= car.speed * CAR.drag * (1 + (1 - grip) * 1.2) * dt;
  // Garage engine upgrades raise the cap; fitted nitro leaves 320 of
  // headroom while Shift is held so the boost is not clamped away.
  const nitroHeadroom = (car.nitroBoost && input.run()) ? 320 : 0;
  car.speed = Math.max(-CAR.reverse, Math.min(CAR.maxSpeed * car.model.speed * (car.speedMul ?? 1) + nitroHeadroom, car.speed));
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = crashCheck(state, nx, ny);
  car.crashCd = Math.max(0, (car.crashCd ?? 0) - dt);
  if (hit) {
    car.speed *= -0.25;
    if (car.crashCd <= 0) {
      car.crashCd = 0.4;
      state.audio?.crash(Math.min(1, Math.abs(car.speed) / 400));
      burst(state, car.x, car.y, '#ffb347', 8);
      if (Math.abs(car.speed) > 260) { car.health -= 8; }
    }
  } else { car.x = nx; car.y = ny; }
  car.x = Math.max(20, Math.min(WORLD.width - 20, car.x));
  car.y = Math.max(20, Math.min(WORLD.height - 20, car.y));
  return car;
}

export function crashCheck(state, x, y) {
  for (const b of state.city.buildings) {
    if (x + 26 > b.x && x - 26 < b.x + b.w && y + 26 > b.y && y - 26 < b.y + b.h) return true;
  }
  return isInWater(x, y);
}

export function updateTrafficCar(car, dt, state, random) {
  // Cruise along its road; at an intersection sometimes turn. On wet roads
  // traffic cruises slower — and a car above the wet cruise speed eases
  // down toward it instead of snapping.
  const grip = state.weather?.gripMul ?? 1;
  const wetCruise = 210 * grip;
  if (car.speed > wetCruise) car.speed += (wetCruise - car.speed) * 0.6 * dt;
  const nearX = roadCentersX().some((cx) => Math.abs(car.x - cx) < 14);
  const nearY = roadCentersY().some((cy) => Math.abs(car.y - cy) < 14);
  if ((nearX || nearY) && random.bool(dt * 0.35)) {
    const turns = [0, Math.PI / 2, -Math.PI / 2];
    car.angle += random.pick(turns);
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Slow for a car ahead on the same road — and honk at it while stuck.
  car.honk = Math.max(0, car.honk - dt);
  for (const other of state.cars) {
    if (other === car || other.police) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    if (Math.hypot(dx, dy) < 90 && Math.abs(Math.atan2(dy, dx) - car.angle) < 0.6) {
      car.speed = Math.max(60, car.speed - 200 * dt);
      if (car.honk <= 0) { car.honk = 0.9; state.audio?.honk(); }
    }
  }
  if (car.x < 40 || car.x > WORLD.width - 480 || car.y < 40 || car.y > WORLD.height - 40) {
    // Recycle far-away traffic back onto a road near the player.
    const fresh = spawnTrafficCar(random, state);
    car.x = fresh.x; car.y = fresh.y; car.angle = fresh.angle; car.speed = fresh.speed;
  }
}

export function updatePedestrian(ped, dt, state, random) {
  if (ped.scared > 0) { ped.scared -= dt; ped.speed = 150; }
  else ped.speed = ped.beach ? 34 : 45;
  ped.x += Math.cos(ped.angle) * ped.speed * dt;
  ped.y += Math.sin(ped.angle) * ped.speed * dt;
  ped.walkPhase += dt * 8;
  if (random.next() < dt * 0.2) ped.angle += random.range(-1.2, 1.2);
  if (ped.beach) {
    // Beach walkers stroll up and down the sand, never into the water.
    if (ped.y < 80 || ped.y > WORLD.height - 80) ped.angle += Math.PI;
    ped.x = Math.max(2908, Math.min(2952, ped.x));
  } else if (ped.x < 60 || ped.x > WORLD.width - 500 || ped.y < 60 || ped.y > WORLD.height - 60) {
    ped.angle += Math.PI;
  }
}

export function burst(state, x, y, color, n) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    state.particles.push({ x, y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, life: 0.5, max: 0.5, color, size: 3 + Math.random() * 3 });
  }
}
