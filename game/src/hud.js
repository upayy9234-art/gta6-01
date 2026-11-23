// hud.js — everything drawn over the world: the HUD (cash, clock, district, wanted
// stars, health and armour, the speedometer), the GPS minimap, mission banners and
// dialogue subtitles, the bust meter, and the full-screen menus — title, pause,
// help, WASTED / BUSTED, mission failed and the campaign ending.

import { VIEW_W, VIEW_H } from './input.js';
import { clamp, dist } from './random.js';
import { shoreXAt } from './city.js';
import { WORLD } from './config.js';

export const RANKS = [
  [0, 'Nobody'], [25, 'Runner'], [60, 'Wheelman'], [110, 'Trusted Hand'], [175, 'Bay Legend'], [260, 'King of the Tide'],
];

export function rankFor(respect) {
  let name = RANKS[0][1];
  for (const [need, label] of RANKS) if (respect >= need) name = label;
  return name;
}

function fmtClock(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function bar(ctx, x, y, w, h, ratio, color, back = 'rgba(8,10,16,0.66)') {
  ctx.fillStyle = back;
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(ratio, 0, 1), h);
}

function star(ctx, cx, cy, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = '#ffd166';
    ctx.fill();
  }
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = filled ? '#ffdf8e' : 'rgba(255,255,255,0.5)';
  ctx.stroke();
}

export function drawMinimap(ctx, game, x, y, size) {
  const s = size / WORLD.width;
  const sy = size / WORLD.width; // keep the bay's true shape; height follows width
  const h = WORLD.height * sy;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, h);
  ctx.clip();
  ctx.fillStyle = '#12546e';
  ctx.fillRect(x, y, size, h);
  // Land: mainland west of the shore, plus the isle.
  ctx.fillStyle = 'rgba(146,164,120,0.9)';
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let wy = 0; wy <= WORLD.height; wy += 120) ctx.lineTo(x + shoreXAt(wy) * s, y + wy * sy);
  for (let wy = WORLD.height; wy >= 0; wy -= 120) ctx.lineTo(x + shoreXAt(wy) * s, y + wy * sy);
  ctx.closePath();
  // (the path above traces the shoreline; fill the land side instead)
  ctx.fillStyle = 'rgba(146,164,120,0.9)';
  ctx.fillRect(x, y, shoreXAt(0) * s, h);
  ctx.beginPath();
  ctx.arc(x + WORLD.islandX * s, y + WORLD.islandY * sy, WORLD.islandR * s, 0, Math.PI * 2);
  ctx.fill();
  // Roads.
  ctx.strokeStyle = 'rgba(230,228,215,0.55)';
  ctx.lineWidth = 1;
  for (const ax of game.city.avenuesX) {
    ctx.beginPath();
    ctx.moveTo(x + ax * s, y);
    ctx.lineTo(x + ax * s, y + h);
    ctx.stroke();
  }
  for (const ay of game.city.avenuesY) {
    ctx.beginPath();
    ctx.moveTo(x, y + ay * sy);
    ctx.lineTo(x + shoreXAt(ay) * s, y + ay * sy);
    ctx.stroke();
  }
  // Points of interest.
  for (const poi of game.city.pois) {
    ctx.fillStyle = poi.kind === 'garage' ? '#ffd166' : poi.kind === 'clinic' ? '#ff6b81' : poi.kind === 'armoury' ? '#c8b6ff' : '#7bf1a8';
    ctx.fillRect(x + poi.x * s - 2, y + poi.y * sy - 2, 4, 4);
  }
  // Police blips flash red/blue.
  const flash = Math.floor(game.elapsed * 3) % 2 === 0;
  for (const v of game.vehicles) {
    if (v.driver !== 'cop' || v.dead) continue;
    ctx.fillStyle = flash ? '#ff4757' : '#3b82f6';
    ctx.beginPath();
    ctx.arc(x + v.x * s, y + v.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The objective, in gold, with its GPS route if the mission laid one.
  const target = game.objectiveTarget();
  if (target) {
    ctx.strokeStyle = 'rgba(255,209,102,0.65)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x + game.player.x * s, y + game.player.y * sy);
    ctx.lineTo(x + target.x * s, y + target.y * sy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(x + target.x * s, y + target.y * sy, 4.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player: a white arrow on his heading.
  const px = x + game.player.x * s;
  const py = y + game.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(game.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(10,12,20,0.8)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, size, h);
  return h;
}

export function drawHUD(ctx, game) {
  const p = game.player;
  ctx.textBaseline = 'alphabetic';
  // Cash and standing, top-left.
  ctx.textAlign = 'left';
  ctx.font = '700 25px system-ui, sans-serif';
  ctx.fillStyle = '#7bf1a8';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 5;
  ctx.fillText(`$${game.cash.toLocaleString('en-US')}`, 22, 38);
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`${rankFor(game.respect)} · ${game.shellsFound} / 25 shells`, 22, 60);
  // Clock and district, top-right, with the stars under them.
  ctx.textAlign = 'right';
  ctx.font = '700 21px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(fmtClock(game.hour), VIEW_W - 22, 36);
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(game.district, VIEW_W - 22, 58);
  for (let i = 0; i < 5; i += 1) {
    star(ctx, VIEW_W - 118 + i * 25, 82, 10.5, i < game.police.stars);
  }
  ctx.shadowBlur = 0;
  // Health and armour, bottom-right; the car gets a bar of its own.
  bar(ctx, VIEW_W - 232, VIEW_H - 34, 210, 13, p.health / 100, p.health > 30 ? '#3ddc84' : '#ff4757');
  if (p.armour > 0) bar(ctx, VIEW_W - 232, VIEW_H - 56, 210, 8, p.armour / 100, '#7cc7ff');
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('HEALTH', VIEW_W - 22, VIEW_H - 42);
  if (p.inVehicle && p.vehicle) {
    const v = p.vehicle;
    ctx.textAlign = 'right';
    ctx.font = '700 30px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.round(Math.abs(v.speed) * 0.36)}`, VIEW_W - 66, VIEW_H - 74);
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('km/h', VIEW_W - 22, VIEW_H - 74);
    ctx.fillText(v.model.name, VIEW_W - 22, VIEW_H - 96);
    bar(ctx, VIEW_W - 232, VIEW_H - 70, 130, 6, v.health / 100, '#ffd166');
  }
  // Minimap, bottom-left.
  drawMinimap(ctx, game, 20, VIEW_H - 208, 188);
  // The mission banner: title flashes, then the objective line stays.
  if (game.bannerT > 0) {
    ctx.textAlign = 'center';
    ctx.font = '800 34px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 8;
    ctx.globalAlpha = clamp(game.bannerT, 0, 1);
    ctx.fillText(game.bannerText, VIEW_W / 2, 74);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
  const objective = game.objectiveText();
  if (objective && game.screen === 'play') {
    ctx.textAlign = 'center';
    ctx.font = '600 18px system-ui, sans-serif';
    const w = ctx.measureText(objective).width + 34;
    ctx.fillStyle = 'rgba(8,10,16,0.55)';
    ctx.fillRect(VIEW_W / 2 - w / 2, 92, w, 30);
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText(objective, VIEW_W / 2, 114);
    const progress = game.objectiveProgress();
    if (progress) {
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(progress, VIEW_W / 2, 140);
    }
    const tl = game.objectiveTimeLeft();
    if (tl !== null && tl !== undefined) {
      ctx.font = '700 17px system-ui, sans-serif';
      ctx.fillStyle = tl < 15 ? '#ff6b81' : '#ffffff';
      ctx.fillText(`${Math.max(0, Math.ceil(tl))}s`, VIEW_W / 2, 164);
    }
  }
  // Dialogue subtitles.
  const line = game.mission.dialogue[0];
  if (line && game.screen === 'play') {
    ctx.textAlign = 'center';
    ctx.font = '600 18px system-ui, sans-serif';
    const label = `${line.who}: `;
    const w = ctx.measureText(label + line.text).width + 36;
    ctx.fillStyle = 'rgba(8,10,16,0.62)';
    ctx.fillRect(VIEW_W / 2 - w / 2, VIEW_H - 128, w, 34);
    ctx.fillStyle = '#ffd166';
    const lw = ctx.measureText(label).width;
    ctx.fillText(label, VIEW_W / 2 - ctx.measureText(line.text).width / 2 - lw / 2 + 8, VIEW_H - 105);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(line.text, VIEW_W / 2 - w / 2 + 18 + lw, VIEW_H - 105);
    ctx.textAlign = 'center';
  }
  // The interaction prompt.
  if (game.promptText && game.screen === 'play') {
    ctx.textAlign = 'center';
    ctx.font = '700 17px system-ui, sans-serif';
    const w = ctx.measureText(game.promptText).width + 30;
    ctx.fillStyle = 'rgba(8,10,16,0.66)';
    ctx.fillRect(VIEW_W / 2 - w / 2, VIEW_H - 84, w, 30);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(game.promptText, VIEW_W / 2, VIEW_H - 63);
  }
  // The bust meter, dead centre, when the law has its hands on you.
  if (game.police.bust > 0.02 && game.screen === 'play') {
    ctx.textAlign = 'center';
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.fillStyle = Math.floor(game.elapsed * 6) % 2 ? '#ff4757' : '#3b82f6';
    ctx.fillText('BUSTED?', VIEW_W / 2, VIEW_H / 2 - 60);
    bar(ctx, VIEW_W / 2 - 130, VIEW_H / 2 - 48, 260, 14, game.police.bust, '#ff4757');
  }
  if (game.muted) {
    ctx.textAlign = 'right';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('MUTED (M)', VIEW_W - 22, VIEW_H - 12);
  }
}

// ---- full-screen menus ----

function dim(ctx, alpha = 0.55) {
  ctx.fillStyle = `rgba(5,8,16,${alpha})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function bigTitle(ctx, game) {
  ctx.textAlign = 'center';
  const grad = ctx.createLinearGradient(0, 150, 0, 260);
  grad.addColorStop(0, '#ffd166');
  grad.addColorStop(0.55, '#ff5da2');
  grad.addColorStop(1, '#22d3ee');
  ctx.font = '900 92px system-ui, sans-serif';
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(255,93,162,0.55)';
  ctx.shadowBlur = 26;
  ctx.fillText('SOLSTICE HEAT', VIEW_W / 2, 238);
  ctx.shadowBlur = 0;
  ctx.font = '800 40px system-ui, sans-serif';
  ctx.fillStyle = '#e8fbff';
  ctx.fillText('· NEON TIDE ·', VIEW_W / 2, 292);
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('An original open-world crime game in the bay city of Solstice Bay', VIEW_W / 2, 330);
}

export function drawTitle(ctx, game) {
  bigTitle(ctx, game);
  ctx.textAlign = 'center';
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.fillStyle = '#ffd166';
  ctx.fillText(game.hasSave ? 'ENTER — Continue      N — New game' : 'ENTER — Start the story', VIEW_W / 2, 452);
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('H — How to play        M — Sound on/off', VIEW_W / 2, 488);
  ctx.font = '500 15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText('Twelve missions for fixer Marisol Vega · traffic, police, boats, races and one long neon night', VIEW_W / 2, 540);
  if (game.hasSave) {
    ctx.fillText(`Saved: ${game.mission.completed.size} of 12 missions · $${game.cash.toLocaleString('en-US')} · ${rankFor(game.respect)}`, VIEW_W / 2, 568);
  }
}

export function drawHelp(ctx, game) {
  dim(ctx, 0.78);
  ctx.textAlign = 'center';
  ctx.font = '800 40px system-ui, sans-serif';
  ctx.fillStyle = '#ffd166';
  ctx.fillText('HOW TO PLAY', VIEW_W / 2, 120);
  ctx.font = '600 19px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  const lines = [
    'WASD / arrows — walk and drive        Shift — sprint',
    'E — steal a car, board a boat, use a shop, take a job',
    'Mouse — aim        Click / F — punch or shoot        Q — fists / pistol',
    'Space — handbrake        P / Esc — pause        M — mute',
    '',
    'Follow the gold marker. Finish Marisol’s twelve jobs to rule the bay.',
    'Crime under watchful eyes raises your stars; lose the police to cool off,',
    'or pay the Neon Bay Garage to wipe the heat and fix the car.',
    'Taxi shifts start at the Port rank · boat courier at the marina dock.',
    'Shells on the beaches are worth $40 each. Clinics heal, Ammu-Bay arms.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 180 + i * 34));
  ctx.fillStyle = '#ffd166';
  ctx.fillText('ENTER — back', VIEW_W / 2, 180 + lines.length * 34 + 26);
}

export function drawPause(ctx, game) {
  dim(ctx, 0.5);
  ctx.textAlign = 'center';
  ctx.font = '800 46px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PAUSED', VIEW_W / 2, 300);
  ctx.font = '600 19px system-ui, sans-serif';
  ctx.fillText('P / Esc — resume        H — help        M — sound', VIEW_W / 2, 350);
}

export function drawEndCard(ctx, game, kind) {
  dim(ctx, kind === 'wasted' ? 0.62 : 0.5);
  ctx.textAlign = 'center';
  ctx.font = '900 84px system-ui, sans-serif';
  ctx.fillStyle = kind === 'wasted' ? '#ff4757' : '#3b82f6';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 18;
  ctx.fillText(kind === 'wasted' ? 'WASTED' : 'BUSTED', VIEW_W / 2, 320);
  ctx.shadowBlur = 0;
  ctx.font = '600 19px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(kind === 'wasted' ? 'The clinic patches you up — $100, and any job is blown.' : 'The SBPD takes its cut — and any job is blown.', VIEW_W / 2, 366);
}

export function drawMissionFailed(ctx, game) {
  dim(ctx, 0.45);
  ctx.textAlign = 'center';
  ctx.font = '800 44px system-ui, sans-serif';
  ctx.fillStyle = '#ff6b81';
  ctx.fillText('MISSION FAILED', VIEW_W / 2, 300);
  ctx.font = '600 19px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${game.mission.failed.title} — ${game.mission.failed.reason}`, VIEW_W / 2, 342);
  ctx.fillStyle = '#ffd166';
  ctx.fillText('R — try the job again        Esc — walk away', VIEW_W / 2, 384);
}

export function drawEnding(ctx, game) {
  dim(ctx, 0.55);
  bigTitle(ctx, game);
  ctx.textAlign = 'center';
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.fillStyle = '#7bf1a8';
  ctx.fillText('The Neon Tide is yours. The bay keeps turning — free roam, jobs and shells remain.', VIEW_W / 2, 430);
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('ENTER — back to the bay', VIEW_W / 2, 478);
}
