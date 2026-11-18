// Police: wanted stars drive how many patrol cars chase the player. Police cars
// steer toward the player, ram, and shoot when close; officers on foot appear at
// high wanted levels. Busted when health hits zero; escaping (out of sight) cools
// the wanted level down. At wanted 0 two patrol cars still cruise the boulevard
// and the Strip — the city feels watched even before Kai does anything wrong.
// Roadblock cars (wanted.js) are parked barricades: they are never counted as
// chasers, never removed as surplus, and never block the wanted cooldown.
import { WANTED } from './config.js';
import { makeCar } from './traffic.js';

const POLICE_MODEL = { name: 'VPD Interceptor', color: '#1c1f2e', speed: 1.05 };

export function policeCountFor(wanted) {
  if (wanted <= 0) return 0;
  if (wanted <= 1) return 1;
  if (wanted <= 2) return 2;
  if (wanted <= 3) return 3;
  if (wanted <= 4) return 4;
  return 6;
}

function spawnPoliceCar(state, random, distance) {
  const a = random.next() * Math.PI * 2;
  const x = state.player.x + Math.cos(a) * distance;
  const y = state.player.y + Math.sin(a) * distance;
  const car = makeCar(
    Math.max(80, Math.min(3200, x)),
    Math.max(80, Math.min(2200, y)),
    a, POLICE_MODEL,
    { npc: true, police: true },
  );
  car.speed = 300;
  return car;
}

// Two patrol cars cruise even with no heat; they only chase once wanted > 0.
export function ensurePatrol(state, random) {
  const patrol = state.cars.filter((c) => c.police && c.patrol).length;
  for (let i = patrol; i < 2; i += 1) {
    const a = random.angle();
    const x = state.player.x + Math.cos(a) * 500;
    const y = state.player.y + Math.sin(a) * 500;
    const car = makeCar(
      Math.max(80, Math.min(3200, x)),
      Math.max(80, Math.min(2200, y)),
      a, POLICE_MODEL,
      { npc: true, police: true, patrol: true },
    );
    car.speed = 200;
    state.cars.push(car);
  }
}

export function ensurePolice(state, random) {
  const want = policeCountFor(state.player.wanted);
  // Roadblock cars are parked barricades, not chasers — never count them.
  const have = state.cars.filter((c) => c.police && !c.patrol && !c.roadblock).length;
  for (let i = have; i < want; i += 1) {
    state.cars.push(spawnPoliceCar(state, random, 700));
  }
  // Remove surplus police when wanted falls (patrol and roadblock cars are
  // never removed here).
  let surplus = have - want;
  for (let i = state.cars.length - 1; i >= 0 && surplus > 0; i -= 1) {
    const c = state.cars[i];
    if (c.police && !c.patrol && !c.roadblock) {
      state.cars.splice(i, 1);
      surplus -= 1;
    }
  }
}

function wrapAngle(diff) {
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export function updatePoliceCar(car, dt, state) {
  // A patrol car with no heat just cruises its road like any other traffic.
  if (car.patrol && state.player.wanted === 0) {
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (car.x < 60 || car.x > 3200 || car.y < 60 || car.y > 2200) car.angle += Math.PI;
    return Infinity;
  }
  car.patrol = false;
  const px = state.player.inCar ? state.player.inCar.x : state.player.x;
  const py = state.player.inCar ? state.player.inCar.y : state.player.y;
  const target = Math.atan2(py - car.y, px - car.x);
  const diff = wrapAngle(target - car.angle);
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  // At wanted 5 the VPD drives harder and shoots farther and faster. In a
  // full lockdown (wanted 5) chasers get another +40 on top of the +60,
  // with the speed cap rising by the same amount.
  const lockdown = state.player.wanted >= 5 ? 40 : 0;
  const base = state.player.wanted >= 5 ? WANTED.chaseSpeed + 60 : WANTED.chaseSpeed;
  const wantSpeed = Math.min(base + lockdown, 380 + state.player.wanted * 30 + lockdown);
  car.speed += (wantSpeed - car.speed) * dt * 0.8;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Ram the player (with a cooldown so one touch is not a death sentence).
  car.ramCd = Math.max(0, (car.ramCd ?? 0) - dt);
  const d = Math.hypot(px - car.x, py - car.y);
  if (d < 55 && car.ramCd <= 0) {
    car.ramCd = 1.5;
    if (state.player.inCar) {
      state.player.inCar.health -= 6;
      state.player.inCar.speed *= 0.9;
      state.audio?.crash(0.5);
    } else if (state.player.invulnerable <= 0) {
      state.player.health -= 10;
      state.player.invulnerable = 0.6;
      state.audio?.hurt();
    }
  }
  // Police shoot at high wanted levels when close.
  const shootRange = state.player.wanted >= 5 ? 520 : 420;
  const shootRate = state.player.wanted >= 5 ? 1.1 : 0.5;
  if (state.player.wanted >= 3 && d < shootRange && Math.random() < dt * shootRate) {
    const a = Math.atan2(py - car.y, px - car.x) + (Math.random() - 0.5) * 0.2;
    state.bullets.push({
      x: car.x, y: car.y,
      vx: Math.cos(a) * 640, vy: Math.sin(a) * 640,
      life: 0.8, fromPolice: true,
    });
    state.audio?.shoot();
  }
  return d;
}

export function nearestPoliceDistance(state) {
  let best = Infinity;
  for (const c of state.cars) {
    // Roadblock cars are parked — they must not block the wanted cooldown.
    if (!c.police || c.patrol || c.roadblock) continue;
    best = Math.min(best, Math.hypot(c.x - state.player.x, c.y - state.player.y));
  }
  return best;
}

// Closest VPD patrol car to the player (or null when none is on the road).
export function nearestPoliceCar(state) {
  let best = null;
  let bestD = Infinity;
  for (const c of state.cars) {
    if (!c.police) continue;
    const d = Math.hypot(c.x - state.player.x, c.y - state.player.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
