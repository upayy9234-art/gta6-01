// Virelia Motors — the garage on the north road (y=388). Park within 110 px,
// press G, and spend Kai's cash on engine, armor and nitro upgrades plus six
// paint jobs. Upgrades apply to whatever car Kai climbs into next — and to the
// car he is already driving when he buys them. Garage state rides along in the
// save file, so a tuned ride survives a reload.
import { CAR, CAR_MODELS } from './config.js';
import { spendCash } from './player.js';

export const GARAGE_SPOT = { x: 700, y: 388, label: 'VIRELIA MOTORS — GARAGE' };

export const GARAGE_UPGRADES = {
  engine: { name: 'Engine', levels: 3, prices: [600, 1200, 2000], desc: '+12% top speed' },
  armor: { name: 'Armor', levels: 3, prices: [500, 1000, 1800], desc: '+60 car health' },
  nitro: { name: 'Nitro', levels: 1, prices: [1500], desc: 'Hold Shift while driving for a boost' },
};
export const GARAGE_UPGRADE_ORDER = ['engine', 'armor', 'nitro'];

export const PAINT_JOBS = [
  { name: 'Arctic White', color: '#e8ecff', price: 200 },
  { name: 'Harbor Gold', color: '#ffc53d', price: 250 },
  { name: 'Blood Red', color: '#e8452c', price: 250 },
  { name: 'Midnight Violet', color: '#a06bff', price: 300 },
  { name: 'Toxic Lime', color: '#7dd069', price: 300 },
  { name: 'Neon Pink', color: '#ff2e88', price: 400 },
];

export function createGarage() {
  return {
    open: false,
    upgrades: { engine: 0, armor: 0, nitro: 0 },
    paint: null,
    ownedPaints: [],
    carsOwned: 1,
  };
}

function garagePosition(state) {
  const p = state.player;
  return p.inCar ? { x: p.inCar.x, y: p.inCar.y } : { x: p.x, y: p.y };
}

export function nearGarage(state) {
  const pos = garagePosition(state);
  return Math.hypot(pos.x - GARAGE_SPOT.x, pos.y - GARAGE_SPOT.y) < 110;
}

export function toggleGarage(state) {
  if (!nearGarage(state)) {
    state.bannerText = 'Drive to Virelia Motors on the north road to open the garage.';
    state.bannerTimer = 2.5;
    return false;
  }
  state.garage.open = !state.garage.open;
  return true;
}

export function applyGarageToCar(state, car) {
  if (!car) return;
  const g = state.garage;
  car.speedMul = 1 + 0.12 * g.upgrades.engine;
  // Armor raises max health; buying a level also patches the car up by 60.
  const prevArmor = car._garageArmor ?? 0;
  car.maxHealth = 160 + 60 * g.upgrades.armor;
  if (g.upgrades.armor > prevArmor) {
    car.health = Math.min(car.maxHealth, car.health + 60 * (g.upgrades.armor - prevArmor));
  }
  if (car.health > car.maxHealth) car.health = car.maxHealth;
  car._garageArmor = g.upgrades.armor;
  car.nitroBoost = g.upgrades.nitro > 0;
  if (g.paint !== null && PAINT_JOBS[g.paint]) car.color = PAINT_JOBS[g.paint].color;
}

export function buyUpgrade(state, kind) {
  const g = state.garage;
  const up = GARAGE_UPGRADES[kind];
  if (!up) return false;
  const level = g.upgrades[kind];
  if (level >= up.levels) {
    state.bannerText = up.name + ' is already MAXED.';
    state.bannerTimer = 2.5;
    return false;
  }
  const price = up.prices[level];
  if (!spendCash(state.player, price)) {
    state.bannerText = 'Not enough cash — ' + up.name + ' Lv' + (level + 1) + ' costs $' + price + '.';
    state.bannerTimer = 2.5;
    return false;
  }
  g.upgrades[kind] = level + 1;
  state.audio?.buy();
  state.bannerText = up.name + ' upgraded to Lv' + (level + 1) + ' — ' + up.desc + '.';
  state.bannerTimer = 3;
  if (state.player.inCar) applyGarageToCar(state, state.player.inCar);
  return true;
}

export function buyPaint(state, index) {
  const g = state.garage;
  const paint = PAINT_JOBS[index];
  if (!paint) return false;
  if (g.ownedPaints.includes(index)) {
    // Already bought: just spray it on.
    g.paint = index;
    state.bannerText = 'Paint applied: ' + paint.name + '.';
    state.bannerTimer = 2.5;
    if (state.player.inCar) applyGarageToCar(state, state.player.inCar);
    return true;
  }
  if (!spendCash(state.player, paint.price)) {
    state.bannerText = 'Not enough cash — ' + paint.name + ' costs $' + paint.price + '.';
    state.bannerTimer = 2.5;
    return false;
  }
  g.ownedPaints.push(index);
  g.paint = index;
  state.audio?.buy();
  state.bannerText = 'New paint: ' + paint.name + '! Your ride will never blend in again.';
  state.bannerTimer = 3;
  if (state.player.inCar) applyGarageToCar(state, state.player.inCar);
  return true;
}

// Digit keys 1–3 buy upgrades, 4–9 buy (or apply) paint jobs.
export function garageKey(state, digit) {
  if (digit >= 1 && digit <= 3) return buyUpgrade(state, GARAGE_UPGRADE_ORDER[digit - 1]);
  if (digit >= 4 && digit <= 9) return buyPaint(state, digit - 4);
  return false;
}

export function updateNitro(state, car, input, dt) {
  if (!car || !car.nitroBoost || !input.run()) return;
  // +260 speed per second while Shift is held; the physics cap in traffic.js
  // leaves 320 of headroom for nitro so the boost is real, not clamped away.
  car.speed += 260 * dt;
  const cap = CAR.maxSpeed * car.model.speed * (car.speedMul ?? 1) + 320;
  if (car.speed > cap) car.speed = cap;
  car.nitroCd = Math.max(0, (car.nitroCd ?? 0) - dt);
  if (car.nitroCd <= 0) {
    car.nitroCd = 0.12;
    state.audio?.nitro();
  }
  const bx = car.x - Math.cos(car.angle) * 34;
  const by = car.y - Math.sin(car.angle) * 34;
  for (let i = 0; i < 2; i += 1) {
    state.particles.push({
      x: bx, y: by,
      vx: -Math.cos(car.angle) * 120 + (state.random.next() - 0.5) * 80,
      vy: -Math.sin(car.angle) * 120 + (state.random.next() - 0.5) * 80,
      life: 0.35, max: 0.35, color: '#22e6ff', size: 3,
    });
  }
}

export function garageSummary(state) {
  const g = state.garage;
  if (!g) return 'stock ride';
  const parts = [];
  if (g.upgrades.engine > 0) parts.push('Engine Lv' + g.upgrades.engine);
  if (g.upgrades.armor > 0) parts.push('Armor Lv' + g.upgrades.armor);
  if (g.upgrades.nitro > 0) parts.push('Nitro');
  if (g.paint !== null && PAINT_JOBS[g.paint]) parts.push(PAINT_JOBS[g.paint].name + ' paint');
  return parts.length ? parts.join(' · ') : 'stock ride';
}

const CAR_OF_THE_DAY_LINES = [
  'handles like a dream and drinks like a fish',
  'one careful owner, zero questions asked',
  'fresh off the docks, still smells like sea air',
  'the VPD hates this one — that is the review',
  'purrs at idle, roars at full throttle',
  'sunset paint, golden-hour soul',
];

export function carOfTheDay(random) {
  const model = random.pick(CAR_MODELS);
  const line = random.pick(CAR_OF_THE_DAY_LINES);
  return 'Today\u2019s pick: ' + model.name + ' — ' + line + '.';
}

function panel(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function drawGarage(ctx, state) {
  const g = state.garage;
  if (!g || !g.open) return;
  const p = state.player;
  ctx.save();
  ctx.fillStyle = 'rgba(4,6,16,0.72)';
  ctx.fillRect(0, 0, 1280, 720);
  const x = 340, y = 78, w = 600, h = 540;
  ctx.fillStyle = 'rgba(8,10,24,0.96)';
  panel(ctx, x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = '#ffc53d'; ctx.lineWidth = 3;
  panel(ctx, x, y, w, h, 14); ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffc53d'; ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('🔧 VIRELIA MOTORS', x + 28, y + 22);
  ctx.fillStyle = '#9aa3c7'; ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('garage · upgrades · paint', x + 28, y + 56);
  ctx.fillStyle = '#7CFC9A'; ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('CASH $' + p.money.toLocaleString('en-US'), x + w - 190, y + 26);
  let rowY = y + 96;
  ctx.fillStyle = '#22e6ff'; ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('UPGRADES — press 1–3', x + 28, rowY);
  rowY += 30;
  GARAGE_UPGRADE_ORDER.forEach((kind, i) => {
    const up = GARAGE_UPGRADES[kind];
    const level = g.upgrades[kind];
    const maxed = level >= up.levels;
    const price = maxed ? 'MAXED' : '$' + up.prices[level].toLocaleString('en-US');
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    panel(ctx, x + 28, rowY, w - 56, 44, 8); ctx.fill();
    ctx.fillStyle = '#f2f4ff'; ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('[' + (i + 1) + '] ' + up.name + '  Lv' + level + '/' + up.levels, x + 44, rowY + 8);
    ctx.fillStyle = '#9aa3c7'; ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(up.desc, x + 44, rowY + 27);
    ctx.fillStyle = maxed ? '#3ddc84' : '#ffc53d'; ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(price, x + w - 44, rowY + 13);
    ctx.textAlign = 'left';
    rowY += 54;
  });
  rowY += 6;
  ctx.fillStyle = '#22e6ff'; ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('PAINT — press 4–9', x + 28, rowY);
  rowY += 30;
  PAINT_JOBS.forEach((paint, i) => {
    const owned = g.ownedPaints.includes(i);
    const active = g.paint === i;
    const tag = active ? 'SPRAYED' : owned ? 'OWNED' : '$' + paint.price;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    panel(ctx, x + 28, rowY, w - 56, 34, 8); ctx.fill();
    ctx.fillStyle = paint.color;
    ctx.beginPath(); ctx.arc(x + 52, rowY + 17, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2f4ff'; ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('[' + (i + 4) + '] ' + paint.name, x + 70, rowY + 9);
    ctx.fillStyle = active ? '#3ddc84' : '#ffc53d'; ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(tag, x + w - 44, rowY + 10);
    ctx.textAlign = 'left';
    rowY += 40;
  });
  rowY += 8;
  // Pick once and keep it: drawing must never eat the seeded random stream.
  if (!g.carOfTheDay) g.carOfTheDay = carOfTheDay(state.random);
  ctx.fillStyle = '#9aa3c7'; ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(g.carOfTheDay, x + 28, rowY);
  // Round 6: the garage keeper warns about the weather outside — slick roads
  // punish a heavy foot, and a second heli is up there when the heat is maxed.
  const kind = state.weather ? state.weather.kind : 'clear';
  if (kind === 'rain' || kind === 'storm') {
    ctx.fillStyle = '#7cc7ff'; ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(kind === 'storm' ? '⛈️ Storm outside — grip is down, mind the slick roads.' : '🌧️ Rain outside — grip is down, mind the slick roads.', x + 28, rowY + 22);
  } else if (kind === 'fog') {
    ctx.fillStyle = '#7cc7ff'; ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('🌫️ Fog outside — keep your eyes on the road, not the sky.', x + 28, rowY + 22);
  }
  ctx.fillStyle = '#f2f4ff'; ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Press G to close the garage', x + w / 2, y + h - 30);
  ctx.restore();
}
