// HUD: cash, wanted stars, health bar, mission objective, minimap, clock and
// banners. All drawn on the same canvas, top-down, neon style.
import { PALETTE, VIEW, WORLD, MISSIONS } from './config.js';
import { missionProgressText, missionWaypoint } from './missions.js';

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

  // Wanted stars top-right.
  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, VIEW.width - 232, 12, 220, 48, 10); ctx.fill();
  ctx.font = 'bold 13px system-ui, sans-serif'; ctx.fillStyle = PALETTE.muted;
  ctx.fillText('WANTED', VIEW.width - 220, 18);
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < p.wanted ? '#ffd23d' : '#3a3f66';
    drawStar(ctx, VIEW.width - 150 + i * 26, 36, 11);
  }

  // Mission objective bar (top centre).
  const mission = MISSIONS[state.missions.index];
  ctx.fillStyle = PALETTE.panel;
  const label = state.missions.done ? 'ALL MISSIONS COMPLETE — VIRELIA IS YOURS' : (mission ? mission.title : '');
  ctx.font = 'bold 14px system-ui, sans-serif';
  const w = Math.max(320, ctx.measureText(label).width + 32);
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

  // Controls hint bottom-left.
  ctx.fillStyle = 'rgba(8,10,24,0.6)';
  roundRect(ctx, 12, VIEW.height - 58, 330, 46, 8); ctx.fill();
  ctx.fillStyle = PALETTE.muted; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(p.inCar ? 'WASD drive · E exit car · Space handbrake · H honk' : 'WASD move · Mouse aim · Click/Space shoot · E enter car', 22, VIEW.height - 46);
  ctx.fillText('Shift run · Esc pause · M sound · Cash: steal cars, finish missions', 22, VIEW.height - 28);

  // Clock + day/night label, left of the minimap so it never overlaps it.
  ctx.fillStyle = PALETTE.text; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'right';
  const hours = Math.floor(state.timeOfDay / 60); const mins = Math.floor(state.timeOfDay % 60);
  ctx.fillText(String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0') + '  ' + (state.timeOfDay < 360 || state.timeOfDay > 1080 ? 'NIGHT' : 'DAY'), VIEW.width - 200, VIEW.height - 188);

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
