// HUD: cash, wanted stars, health bar, mission objective (MISSION n/12 + stage),
// radio ticker, shop hint, minimap, clock and banners. All drawn on the same
// canvas, top-down, neon style.
import { PALETTE, VIEW, WORLD, MISSIONS } from './config.js';
import { missionProgressText, missionWaypoint, missionCounterText } from './missions.js';
import { clockText } from './daynight.js';
import { weaponHudText } from './weapons.js';
import { garageSummary } from './garage.js';
import { nearestPoliceCar } from './police.js';
import { radioTickerText, radioStationName } from './radio.js';
import { shopSummary } from './shops.js';
import { weatherLabel } from './weather.js';
import { roadblockWarning } from './wanted.js';
import { taxiFareText, postcardText, sideIncomeText, nearestWaitingFare } from './side.js';

export function drawHUD(ctx, state) {
  const p = state.player;
  ctx.save();
  // Top-left panel: cash, score, health.
  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, 12, 12, 250, 92, 10); ctx.fill();
  ctx.fillStyle = PALETTE.money; ctx.font = 'bold 24px ' + 'system-ui, sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('$' + p.money.toLocaleString('en-US'), 24, 20);
  ctx.fillStyle = PALETTE.text; ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('SCORE ' + state.score.toLocaleString('en-US'), 24, 50);
  ctx.fillStyle = '#333'; roundRect(ctx, 24, 72, 180, 12, 6); ctx.fill();
  ctx.fillStyle = p.health > 30 ? PALETTE.health : PALETTE.danger;
  roundRect(ctx, 24, 72, 180 * Math.max(0, p.health) / 100, 12, 6); ctx.fill();
  ctx.fillStyle = PALETTE.text; ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('HP ' + Math.max(0, Math.ceil(p.health)), 210, 72);

  // Weapon panel under the cash panel: current gun + ammo, owned guns, garage.
  const weapon = weaponHudText(state);
  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, 12, 112, 250, 78, 10); ctx.fill();
  ctx.fillStyle = '#9ae8ff'; ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText('🔫 ' + weapon.current, 24, 120);
  ctx.fillStyle = PALETTE.text; ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(weapon.owned, 24, 142);
  ctx.fillStyle = PALETTE.muted; ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('🚗 ' + garageSummary(state), 24, 164);

  // Weather + postcards panel: the sky right now, and how many of Virelia's
  // ten postcards Kai has found.
  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, 12, 198, 250, 52, 10); ctx.fill();
  ctx.fillStyle = '#7cc7ff'; ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(weatherLabel(state), 24, 206);
  ctx.fillStyle = '#ff5e8a'; ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('✉ ' + postcardText(state), 24, 228);

  // Side income panel: fares done and failed, the current streak, and the
  // total cash the taxi + postcard hustle has earned so far.
  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, 12, 258, 250, 52, 10); ctx.fill();
  ctx.fillStyle = PALETTE.text; ctx.font = 'bold 13px system-ui, sans-serif';
  const income = sideIncomeText(state);
  const incomeParts = income.split(' — ');
  ctx.fillText(incomeParts[0] ?? income, 24, 266);
  ctx.fillStyle = '#7CFC9A'; ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(incomeParts[1] ?? '', 24, 288);

  // Wanted stars top-right, with the nearest VPD car distance.
  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, VIEW.width - 232, 12, 220, 66, 10); ctx.fill();
  ctx.font = 'bold 13px system-ui, sans-serif'; ctx.fillStyle = PALETTE.muted;
  ctx.fillText('WANTED', VIEW.width - 220, 18);
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < p.wanted ? '#ffd23d' : '#3a3f66';
    drawStar(ctx, VIEW.width - 150 + i * 26, 36, 11);
  }
  const nearestVpd = nearestPoliceCar(state);
  ctx.fillStyle = PALETTE.text; ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(
    nearestVpd ? 'NEAREST VPD ' + Math.round(Math.hypot(nearestVpd.x - p.x, nearestVpd.y - p.y)) + 'm' : 'VPD CLEAR',
    VIEW.width - 220, 56,
  );

  // Mission objective bar (top centre): "MISSION 7/12 · DAY 3" + stage text.
  const mission = MISSIONS[state.missions.index];
  ctx.fillStyle = PALETTE.panel;
  const label = state.missions.done ? 'ALL 12 MISSIONS COMPLETE — VIRELIA IS YOURS' : missionCounterText(state);
  ctx.font = 'bold 14px system-ui, sans-serif';
  const w = Math.max(360, ctx.measureText(label).width + 32);
  roundRect(ctx, (VIEW.width - w) / 2, 12, w, 52, 10); ctx.fill();
  ctx.fillStyle = PALETTE.neonCyan; ctx.textAlign = 'center';
  ctx.fillText(label, VIEW.width / 2, 20);
  ctx.fillStyle = PALETTE.text; ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(missionProgressText(state), VIEW.width / 2, 40);

  // Banner (mission updates).
  if (state.bannerTimer > 0 && state.bannerText) {
    ctx.globalAlpha = Math.min(1, state.bannerTimer);
    ctx.fillStyle = 'rgba(8,10,24,0.9)';
    const bw = ctx.measureText(state.bannerText).width + 40;
    roundRect(ctx, (VIEW.width - bw) / 2, 84, bw, 34, 8); ctx.fill();
    ctx.fillStyle = PALETTE.neonGold; ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(state.bannerText, VIEW.width / 2, 93);
    ctx.globalAlpha = 1;
  }

  // Roadblock warning, centred under the banner: how far the seal is.
  const blockWarn = roadblockWarning(state);
  if (blockWarn !== null) {
    const warnText = '⚠ ROADBLOCK AHEAD — ' + blockWarn + 'm';
    ctx.fillStyle = 'rgba(60,8,12,0.9)';
    const ww = ctx.measureText(warnText).width + 40;
    roundRect(ctx, (VIEW.width - ww) / 2, 126, ww, 30, 8); ctx.fill();
    ctx.fillStyle = '#ff4d5e'; ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(warnText, VIEW.width / 2, 134);
    ctx.textAlign = 'left';
  }

  // Taxi fare panel, under the wanted stars: the clock, the distance and
  // the pay — orange when the clock is about to run out, gold otherwise.
  const fare = taxiFareText(state);
  if (fare) {
    const fareText = '🚕 FARE ' + fare.timer + 's · ' + fare.dist + 'm to go · $' + fare.pay + (fare.vip ? ' · VIP' : '');
    ctx.font = 'bold 13px system-ui, sans-serif';
    const fw = ctx.measureText(fareText).width + 24;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, VIEW.width - fw - 12, 86, fw, 30, 8); ctx.fill();
    ctx.fillStyle = fare.urgent ? '#ff7a3d' : '#ffc53d';
    ctx.fillText(fareText, VIEW.width - fw, 94);
  } else if (nearestWaitingFare(state, 260)) {
    // No fare aboard, but a passenger is close: say so, centred above the
    // radio ticker, so Kai knows E is worth pressing.
    const hint = '🚕 Taxi passenger nearby — press E to pick them up';
    ctx.fillStyle = 'rgba(8,10,24,0.78)';
    const hw = ctx.measureText(hint).width + 24;
    roundRect(ctx, (VIEW.width - hw) / 2, VIEW.height - 140, hw, 26, 8); ctx.fill();
    ctx.fillStyle = '#ffc53d'; ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(hint, VIEW.width / 2, VIEW.height - 132);
    ctx.textAlign = 'left';
  }

  // Radio ticker: station + current track / dispatch line, bottom centre.
  const ticker = radioTickerText(state);
  ctx.fillStyle = 'rgba(8,10,24,0.78)';
  const tw = Math.min(VIEW.width - 420, ctx.measureText('♪ ' + ticker).width + 120);
  roundRect(ctx, (VIEW.width - tw) / 2, VIEW.height - 104, tw, 30, 8); ctx.fill();
  ctx.fillStyle = '#ff5e8a'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('♪ ' + ticker, VIEW.width / 2, VIEW.height - 95);
  ctx.fillStyle = PALETTE.muted; ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(radioStationName(state) + ' · press R to change station', VIEW.width / 2, VIEW.height - 80);

  // Shop hint (when a shop is near) — right above the controls hint.
  const shopHint = shopSummary(state);
  if (shopHint) {
    ctx.fillStyle = 'rgba(8,10,24,0.78)';
    const sw = ctx.measureText(shopHint).width + 24;
    roundRect(ctx, 12, VIEW.height - 92, sw, 26, 8); ctx.fill();
    ctx.fillStyle = '#22e6ff'; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(shopHint, 24, VIEW.height - 84);
  }

  // Controls hint bottom-left.
  ctx.fillStyle = 'rgba(8,10,24,0.6)';
  roundRect(ctx, 12, VIEW.height - 58, 380, 46, 8); ctx.fill();
  ctx.fillStyle = PALETTE.muted; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(p.inCar ? 'WASD drive · E exit car · Space handbrake · H honk · G garage' : 'WASD move · Mouse aim · Click/Space shoot · E enter car / shop / taxi · G garage', 22, VIEW.height - 46);
  ctx.fillText('Shift run / nitro · 1–4 switch weapon · R radio · Esc pause · M sound · Cash: steal cars, finish missions', 22, VIEW.height - 28);

  // Clock + day/night label, left of the minimap so it never overlaps it.
  ctx.fillStyle = PALETTE.text; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(clockText(state), VIEW.width - 200, VIEW.height - 188);

  drawMinimap(ctx, state);
  ctx.restore();
}

function drawMinimap(ctx, state) {
  const size = 168, x0 = VIEW.width - size - 14, y0 = VIEW.height - size - 14;
  const sx = size / WORLD.width, sy = size / WORLD.height;
  ctx.fillStyle = 'rgba(8,10,24,0.85)';
  roundRect(ctx, x0 - 4, y0 - 4, size + 8, size + 8, 8); ctx.fill();
  ctx.fillStyle = '#1b1e33'; ctx.fillRect(x0, y0, size, size);
  // Water + park (Harbor Park sits in the block between roads x 1696/2132, y 1260/1696).
  ctx.fillStyle = '#0e3a5c'; ctx.fillRect(x0 + 2960 * sx, y0, (WORLD.width - 2960) * sx, size);
  ctx.fillStyle = '#123626'; ctx.fillRect(x0 + 1758 * sx, y0 + 1322 * sy, 312 * sx, 312 * sy);
  // Roads.
  ctx.strokeStyle = '#3a3f66'; ctx.lineWidth = 3;
  for (let x = 388; x < WORLD.width; x += 436) { ctx.beginPath(); ctx.moveTo(x0 + x * sx, y0); ctx.lineTo(x0 + x * sx, y0 + size); ctx.stroke(); }
  for (let y = 388; y < WORLD.height; y += 436) { ctx.beginPath(); ctx.moveTo(x0, y0 + y * sy); ctx.lineTo(x0 + size, y0 + y * sy); ctx.stroke(); }
  // Neon Strip casino district (gold) on the minimap.
  const casino = state.city.casino;
  if (casino) {
    ctx.fillStyle = '#ffc53d';
    ctx.fillRect(x0 + casino.x * sx, y0 + casino.y * sy, casino.w * sx, casino.h * sy);
  }
  // Shops on the minimap (cyan squares).
  ctx.fillStyle = '#22e6ff';
  for (const shop of state.shops?.list ?? []) {
    ctx.fillRect(x0 + shop.x * sx - 2, y0 + shop.y * sy - 2, 4, 4);
  }
  // Waypoint.
  const wp = missionWaypoint(state);
  if (wp && !state.missions.done) {
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath(); ctx.arc(x0 + wp.x * sx, y0 + wp.y * sy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff2e88'; ctx.beginPath(); ctx.arc(x0 + wp.x * sx, y0 + wp.y * sy, 10 + Math.sin(state.time * 4) * 3, 0, Math.PI * 2); ctx.stroke();
  }
  // Police dots.
  ctx.fillStyle = '#2f7bff';
  for (const c of state.cars) if (c.police) { ctx.beginPath(); ctx.arc(x0 + c.x * sx, y0 + c.y * sy, 3, 0, Math.PI * 2); ctx.fill(); }
  // Roadblocks: red squares, so a sealed road reads at a glance.
  ctx.fillStyle = '#ff3b30';
  for (const block of state.roadblocks?.list ?? []) {
    ctx.fillRect(x0 + block.x * sx - 3, y0 + block.y * sy - 3, 6, 6);
  }
  // Taxi: waiting passengers are gold dots, the active drop-off a gold ring.
  ctx.fillStyle = '#ffc53d';
  for (const fare of state.side?.fares ?? []) {
    if (!fare.waiting) continue;
    ctx.beginPath(); ctx.arc(x0 + fare.x * sx, y0 + fare.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  const dest = state.side?.activeFare?.dest;
  if (dest) {
    ctx.strokeStyle = '#ffc53d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x0 + dest.x * sx, y0 + dest.y * sy, 6, 0, Math.PI * 2); ctx.stroke();
  }
  // Postcards not yet found: pink dots.
  ctx.fillStyle = '#ff5e8a';
  for (const card of state.side?.postcards ?? []) {
    if (card.taken) continue;
    ctx.beginPath(); ctx.arc(x0 + card.x * sx, y0 + card.y * sy, 2, 0, Math.PI * 2); ctx.fill();
  }
  // Police helicopter dots (white).
  ctx.fillStyle = '#ffffff';
  for (const heli of state.helis ?? []) { ctx.beginPath(); ctx.arc(x0 + heli.x * sx, y0 + heli.y * sy, 4, 0, Math.PI * 2); ctx.fill(); }
  // Player arrow.
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x, py = p.inCar ? p.inCar.y : p.y;
  ctx.fillStyle = '#ffd23d';
  ctx.beginPath(); ctx.arc(x0 + px * sx, y0 + py * sy, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffd23d'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x0 + px * sx, y0 + py * sy, 8, 0, Math.PI * 2); ctx.stroke();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function drawStar(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
}
