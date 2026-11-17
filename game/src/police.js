// Police: wanted stars drive how many patrol cars chase the player. Police cars
// steer toward the player, ram, and shoot when close; officers on foot appear at
// high wanted levels. Busted when health hits zero; escaping (out of sight) cools
// the wanted level down.
import { WANTED } from './config.js';
import { makeCar } from './traffic.js';

const POLICE_MODEL = { name: 'VPD Interceptor', color: '#1c1f2e', speed: 1.05 };

export function policeCountFor(wanted) {
  return wanted <= 0 ? 0 : wanted <= 1 ? 1 : wanted <= 2 ? 2 : wanted <= 3 ? 3 : wanted <= 4 ? 4 : 6;
}

export function ensurePolice(state, random) {
  const want = policeCountFor(state.player.wanted);
  const have = state.cars.filter((c) => c.police).length;
  for (let i = have; i < want; i += 1) {
    const a = random.next() * Math.PI * 2;
    const x = state.player.x + Math.cos(a) * 700;
    const y = state.player.y + Math.sin(a) * 700;
    const car = makeCar(Math.max(80, Math.min(3200, x)), Math.max(80, Math.min(2200, y)), a, POLICE_MODEL, { npc: true, police: true });
    car.speed = 300;
    state.cars.push(car);
  }
  // Remove surplus police when wanted falls.
  let surplus = have - want;
  for (let i = state.cars.length - 1; i >= 0 && surplus > 0; i -= 1) {
    if (state.cars[i].police) { state.cars.splice(i, 1); surplus -= 1; }
  }
}

export function updatePoliceCar(car, dt, state) {
  const px = state.player.inCar ? state.player.inCar.x : state.player.x;
  const py = state.player.inCar ? state.player.inCar.y : state.player.y;
  const target = Math.atan2(py - car.y, px - car.x);
  let diff = target - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  const wantSpeed = Math.min(WANTED.chaseSpeed, 380 + state.player.wanted * 30);
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
  if (state.player.wanted >= 3 && d < 420 && Math.random() < dt * 0.5) {
    const a = Math.atan2(py - car.y, px - car.x) + (Math.random() - 0.5) * 0.2;
    state.bullets.push({ x: car.x, y: car.y, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, life: 0.8, fromPolice: true });
    state.audio?.shoot();
  }
  return d;
}

export function nearestPoliceDistance(state) {
  let best = Infinity;
  for (const c of state.cars) {
    if (!c.police) continue;
    best = Math.min(best, Math.hypot(c.x - state.player.x, c.y - state.player.y));
  }
  return best;
}
