// Shops: three storefronts Kai can walk into — Harbor Arms (ammo), Pier 9 Diner
// (food / health) and Neon Mart (snacks + ammo). Press E near a shop to open
// its panel, press 1–3 to buy, E again (or Esc) to close. Buying spends cash
// and tops up ammo or health right away; the HUD shop panel shows the result.
import { PLAYER, SHOPS as SHOP_DEFS } from './config.js';
import { spendCash, healPlayer } from './player.js';
import { addAmmo } from './weapons.js';

export const SHOPS = SHOP_DEFS;
export const SHOP_RADIUS = 95;

export function createShops() {
  return { open: null, lastBought: '', list: SHOPS };
}

function playerPosition(state) {
  const p = state.player;
  return p.inCar ? { x: p.inCar.x, y: p.inCar.y } : { x: p.x, y: p.y };
}

export function nearestShop(state) {
  const pos = playerPosition(state);
  let best = null, bestD = SHOP_RADIUS;
  for (const shop of SHOPS) {
    const d = Math.hypot(pos.x - shop.x, pos.y - shop.y);
    if (d < bestD) { bestD = d; best = shop; }
  }
  return best;
}

export function toggleShop(state) {
  const shops = state.shops;
  if (!shops) return false;
  if (shops.open) {
    shops.open = null;
    return true;
  }
  const shop = nearestShop(state);
  if (!shop) {
    state.bannerText = 'No shop nearby — look for HARBOR ARMS, PIER 9 DINER or NEON MART.';
    state.bannerTimer = 2.5;
    return false;
  }
  shops.open = shop.id;
  state.audio?.tune();
  return true;
}

export function openShop(state) {
  return state.shops?.open ?? null;
}

export function buyShopItem(state, digit) {
  const shops = state.shops;
  if (!shops || !shops.open) return false;
  const shop = SHOPS.find((s) => s.id === shops.open);
  if (!shop) return false;
  const item = shop.items[digit - 1];
  if (!item) return false;
  const p = state.player;
  if (item.kind === 'heal' && p.health >= PLAYER.health) {
    state.bannerText = 'Already at full health — save your cash.';
    state.bannerTimer = 2;
    return false;
  }
  if (!spendCash(p, item.price)) {
    state.bannerText = 'Not enough cash — ' + item.name + ' costs $' + item.price + '.';
    state.bannerTimer = 2.5;
    return false;
  }
  if (item.kind === 'heal') {
    healPlayer(p, item.amount);
  } else if (item.kind === 'ammo') {
    addAmmo(state, item.weapon, item.amount);
    if (state.weapons.current !== item.weapon) state.weapons.current = item.weapon;
  }
  shops.lastBought = item.name;
  state.audio?.buy();
  state.bannerText = 'Bought: ' + item.name + ' at ' + shop.name + ' (-$' + item.price + ').';
  state.bannerTimer = 3;
  state.score += 10;
  return true;
}

// Digit keys 1–3 buy from the open shop panel.
export function shopKey(state, digit) {
  if (digit >= 1 && digit <= 3) return buyShopItem(state, digit);
  return false;
}

export function shopSummary(state) {
  const shops = state.shops;
  if (!shops) return '';
  if (shops.open) {
    const shop = SHOPS.find((s) => s.id === shops.open);
    return shop ? shop.name + ' — press 1–3 to buy' : '';
  }
  const near = nearestShop(state);
  return near ? 'Press E — ' + near.name + ' (' + near.tag + ')' : '';
}

// Round 6: the shopkeeper's weather tip — a line in the panel when the sky
// turns, so a shopping trip doubles as a forecast.
export function shopWeatherTip(state) {
  const kind = state.weather ? state.weather.kind : 'clear';
  if (kind === 'rain') return '🌧️ Rain outside — the streets are slick, take it slow.';
  if (kind === 'storm') return '⛈️ Storm outside — lightning over the harbour, stay sharp.';
  if (kind === 'fog') return '🌫️ Fog outside — you can barely see the next block.';
  return '';
}

export function drawShopPanel(ctx, state) {
  const shops = state.shops;
  if (!shops || !shops.open) return;
  const shop = SHOPS.find((s) => s.id === shops.open);
  if (!shop) return;
  const p = state.player;
  ctx.save();
  ctx.fillStyle = 'rgba(4,6,16,0.72)';
  ctx.fillRect(0, 0, 1280, 720);
  const x = 400, y = 170, w = 480, h = 330;
  ctx.fillStyle = 'rgba(8,10,24,0.96)';
  ctx.beginPath();
  ctx.moveTo(x + 14, y); ctx.arcTo(x + w, y, x + w, y + h, 14); ctx.arcTo(x + w, y + h, x, y + h, 14);
  ctx.arcTo(x, y + h, x, y, 14); ctx.arcTo(x, y, x + w, y, 14); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#22e6ff'; ctx.lineWidth = 3; ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#22e6ff'; ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('🛒 ' + shop.name, x + 28, y + 22);
  ctx.fillStyle = '#9aa3c7'; ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(shop.tag + ' · press 1–3 to buy · E to leave', x + 28, y + 56);
  ctx.fillStyle = '#7CFC9A'; ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('CASH $' + p.money.toLocaleString('en-US'), x + w - 190, y + 26);
  let rowY = y + 96;
  shop.items.forEach((item, i) => {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x + 28, rowY, w - 56, 44);
    ctx.fillStyle = '#f2f4ff'; ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('[' + (i + 1) + '] ' + item.name, x + 44, rowY + 8);
    ctx.fillStyle = '#9aa3c7'; ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(item.kind === 'heal' ? 'restores health' : 'ammo for the ' + item.weapon, x + 44, rowY + 27);
    ctx.fillStyle = '#ffc53d'; ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('$' + item.price, x + w - 44, rowY + 13);
    ctx.textAlign = 'left';
    rowY += 54;
  });
  if (shops.lastBought) {
    ctx.fillStyle = '#3ddc84'; ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('Last bought: ' + shops.lastBought, x + 28, rowY + 4);
  }
  const tip = shopWeatherTip(state);
  if (tip) {
    ctx.fillStyle = '#7cc7ff'; ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(tip, x + 28, rowY + 26);
  }
  ctx.fillStyle = '#f2f4ff'; ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Press E to leave the shop', x + w / 2, y + h - 30);
  ctx.restore();
}
