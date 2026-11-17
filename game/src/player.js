// Player state: on-foot movement with mouse aim, shooting, entering/exiting cars,
// health, money and the wanted level. Driving physics live in traffic.js.
// Shops heal Kai (see shops.js); the garage tunes his cars (see garage.js).
import { PLAYER, ROADBLOCK, WORLD } from './config.js';
import { collideBuildings, isInWater, isOnRoad } from './world.js';
import { burst } from './traffic.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0, health: PLAYER.health, money: 250,
    wanted: 0, wantedTimer: 0, inCar: null, fireCooldown: 0, invulnerable: 0,
    moving: false, onFoot: true, dead: false, meals: 0,
  };
}

export function updatePlayerOnFoot(player, input, dt, state) {
  const speed = input.run() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let mx = input.moveX(); let my = (input.down() ? 1 : 0) - (input.up() ? 1 : 0);
  const len = Math.hypot(mx, my) || 1;
  mx /= len; my /= len;
  player.moving = mx !== 0 || my !== 0;
  let nx = player.x + mx * speed * dt;
  let ny = player.y + my * speed * dt;
  nx = Math.max(PLAYER.radius, Math.min(WORLD.width - PLAYER.radius, nx));
  ny = Math.max(PLAYER.radius, Math.min(WORLD.height - PLAYER.radius, ny));
  if (!collideBuildings(state, nx, player.y, PLAYER.radius) && !isInWater(nx, player.y)) player.x = nx;
  if (!collideBuildings(state, player.x, ny, PLAYER.radius) && !isInWater(player.x, ny)) player.y = ny;
  // Aim at the mouse (screen space -> world space via camera stored on state).
  const cam = state.camera;
  const wx = cam.x + (input.mouse().x / cam.scale - 640);
  const wy = cam.y + (input.mouse().y / cam.scale - 360);
  player.angle = Math.atan2(wy - player.y, wx - player.x);
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
}

export function addWanted(player, amount) {
  player.wanted = Math.min(5, player.wanted + amount);
  player.wantedTimer = 0;
}

// Spend cash if Kai can afford it; returns false (and spends nothing) when broke.
export function spendCash(player, amount) {
  if (player.money < amount) return false;
  player.money -= amount;
  return true;
}

// Eating at the diner or the mart: heals now, and a full belly slows the
// next regen tick a little — flavour, not a penalty that matters.
export function healPlayer(player, amount) {
  if (player.health >= PLAYER.health) return 0;
  const healed = Math.min(PLAYER.health - player.health, amount);
  player.health += healed;
  player.meals += 1;
  return healed;
}

export function regenHealth(player, dt) {
  // Lying low with no heat slowly patches Kai up.
  if (player.wanted === 0 && player.health > 0 && player.health < PLAYER.health) {
    player.health = Math.min(PLAYER.health, player.health + 2.5 * dt);
  }
}

export function decayWanted(player, dt, hidden) {
  // Wanted cools off slowly while the player stays out of police sight.
  if (player.wanted > 0 && hidden) {
    player.wantedTimer += dt;
    if (player.wantedTimer > 14) { player.wanted -= 1; player.wantedTimer = 0; }
  } else player.wantedTimer = 0;
}

export function playerShoot(player, state) {
  if (player.fireCooldown > 0 || player.inCar) return;
  player.fireCooldown = PLAYER.fireInterval;
  state.bullets.push({
    x: player.x + Math.cos(player.angle) * 22, y: player.y + Math.sin(player.angle) * 22,
    vx: Math.cos(player.angle) * PLAYER.bulletSpeed, vy: Math.sin(player.angle) * PLAYER.bulletSpeed,
    life: 0.7, fromPolice: false,
  });
  state.audio?.shoot();
  state.particles.push({ x: player.x + Math.cos(player.angle) * 26, y: player.y + Math.sin(player.angle) * 26, vx: Math.cos(player.angle) * 60, vy: Math.sin(player.angle) * 60, life: 0.12, max: 0.12, color: '#ffe27a', size: 4 });
}

export function isPlayerOnRoad(player) { return isOnRoad(player.x, player.y); }

// Spike strip hit (round 6, VPD roadblocks): the tyres go, the car takes a
// chunk of damage and loses half its speed, then stays sluggish for a moment
// while Kai wrestles the shredded wheels. Called from wanted.js.
export function carHitSpikeStrip(state, car) {
  if (!car) return;
  car.health = Math.max(0, car.health - ROADBLOCK.SPIKE_DAMAGE);
  car.speed *= 0.45;
  car.spikeSlow = 1.6;
  burst(state, car.x, car.y, '#c9d2ff', 14);
  burst(state, car.x, car.y, '#ff7a3d', 8);
  state.audio?.crash(0.8);
  state.bannerText = 'Spike strip! Tyres shredded — the car is barely holding together.';
  state.bannerTimer = 3;
}
