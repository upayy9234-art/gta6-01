// render.js — paints Solstice Bay: water and sand, avenues and crosswalks, rooftops
// with their neon, palms and lamps, then every car, boat and person, then the light
// of the hour over all of it. The camera transform is set by main.js; this file
// draws in world coordinates and culls to the visible rectangle.

import { WORLD, PALETTE } from './config.js';
import { clamp, dist } from './random.js';
import { shoreXAt } from './city.js';

const ROAD_HALF = WORLD.roadWidth / 2;
const WALK = 16;

function inView(game, x, y, pad = 90) {
  const r = game.viewRect;
  return x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
}

export function drawWorld(ctx, game) {
  const city = game.city;
  const r = game.viewRect;

  // ---- water, with slow moving wavelets ----
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = PALETTE.waterDeep;
  for (let i = 0; i < 7; i += 1) {
    const wx = 3560 + ((i * 613) % 1100);
    const wy = 240 + ((i * 977) % 3100);
    if (!inView(game, wx, wy, 320)) continue;
    ctx.beginPath();
    ctx.ellipse(wx, wy, 190, 60, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(210,240,250,0.20)';
  ctx.lineWidth = 2;
  const waveOff = (game.elapsed * 22) % 46;
  for (let wy = Math.floor(r.y / 46) * 46; wy < r.y + r.h; wy += 46) {
    ctx.beginPath();
    for (let wx = Math.floor(r.x / 60) * 60; wx < r.x + r.w + 60; wx += 60) {
      const sx = Math.max(wx, shoreXAt(wy) + 20);
      if (sx > r.x + r.w) continue;
      ctx.moveTo(sx, wy + ((wx + waveOff) % 23));
      ctx.lineTo(sx + 26, wy + ((wx + waveOff) % 23));
    }
    ctx.stroke();
  }

  // ---- land: the mainland west of the shore, and the isle ----
  ctx.fillStyle = PALETTE.grass;
  ctx.beginPath();
  ctx.moveTo(r.x - 40, r.y - 40);
  for (let wy = r.y - 60; wy <= r.y + r.h + 60; wy += 60) ctx.lineTo(shoreXAt(wy), wy);
  ctx.lineTo(r.x - 40, r.y + r.h + 40);
  ctx.closePath();
  ctx.fill();
  // the sand band, stroked along the waterline
  ctx.strokeStyle = PALETTE.sand;
  ctx.lineWidth = 84;
  ctx.beginPath();
  for (let wy = r.y - 60; wy <= r.y + r.h + 60; wy += 40) {
    const sx = shoreXAt(wy) - 26;
    if (wy === r.y - 60) ctx.moveTo(sx, wy); else ctx.lineTo(sx, wy);
  }
  ctx.stroke();
  // island: sand rim, grass heart
  ctx.fillStyle = PALETTE.sand;
  ctx.beginPath();
  ctx.arc(WORLD.islandX, WORLD.islandY, WORLD.islandR + 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.grass;
  ctx.beginPath();
  ctx.arc(WORLD.islandX, WORLD.islandY, WORLD.islandR - 10, 0, Math.PI * 2);
  ctx.fill();

  // ---- roads: sidewalks first, then asphalt, then paint ----
  ctx.fillStyle = PALETTE.sidewalk;
  for (const ax of city.avenuesX) ctx.fillRect(ax - ROAD_HALF - WALK, 0, WORLD.roadWidth + WALK * 2, WORLD.height);
  for (const ay of city.avenuesY) ctx.fillRect(0, ay - ROAD_HALF - WALK, shoreXAt(ay) + 30, WORLD.roadWidth + WALK * 2);
  ctx.fillStyle = PALETTE.asphalt;
  for (const ax of city.avenuesX) ctx.fillRect(ax - ROAD_HALF, 0, WORLD.roadWidth, WORLD.height);
  for (const ay of city.avenuesY) ctx.fillRect(0, ay - ROAD_HALF, shoreXAt(ay) + 30, WORLD.roadWidth);
  // parking lots
  for (const lot of city.lots) {
    if (!inView(game, lot.x + lot.w / 2, lot.y + lot.h / 2, 320)) continue;
    ctx.fillStyle = PALETTE.asphaltDark;
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(232,228,210,0.5)';
    ctx.lineWidth = 2;
    for (let x = lot.x + 22; x < lot.x + lot.w - 10; x += 46) {
      ctx.strokeRect(x, lot.y + 8, 34, 52);
      ctx.strokeRect(x, lot.y + lot.h - 60, 34, 52);
    }
  }
  // lane dashes
  ctx.strokeStyle = PALETTE.laneMark;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.globalAlpha = 0.75;
  for (const ax of city.avenuesX) {
    ctx.beginPath();
    ctx.moveTo(ax, 0);
    ctx.lineTo(ax, WORLD.height);
    ctx.stroke();
  }
  for (const ay of city.avenuesY) {
    ctx.beginPath();
    ctx.moveTo(0, ay);
    ctx.lineTo(shoreXAt(ay), ay);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  // crosswalks at the intersections near the view
  ctx.fillStyle = PALETTE.crosswalk;
  for (const ax of city.avenuesX) {
    for (const ay of city.avenuesY) {
      if (!inView(game, ax, ay, 60)) continue;
      for (let i = -2; i <= 2; i += 1) {
        ctx.fillRect(ax - ROAD_HALF - 12, ay + i * 17 - 5, 9, 10);
        ctx.fillRect(ax + ROAD_HALF + 3, ay + i * 17 - 5, 9, 10);
      }
    }
  }

  // ---- the causeway and the marina piers ----
  const by = WORLD.bridgeY;
  ctx.fillStyle = '#4a4f58';
  ctx.fillRect(shoreXAt(by) - 40, by - 36, WORLD.islandX - WORLD.islandR + 60 - shoreXAt(by) + 40, 72);
  ctx.fillStyle = '#2f333b';
  ctx.fillRect(shoreXAt(by) - 40, by - 40, WORLD.islandX - WORLD.islandR + 60 - shoreXAt(by) + 40, 6);
  ctx.fillRect(shoreXAt(by) - 40, by + 34, WORLD.islandX - WORLD.islandR + 60 - shoreXAt(by) + 40, 6);
  ctx.fillStyle = 'rgba(20,30,40,0.35)';
  for (let x = shoreXAt(by) + 60; x < WORLD.islandX - WORLD.islandR; x += 130) ctx.fillRect(x, by - 46, 12, 92);
  ctx.fillStyle = '#8a6b4a';
  for (const d of [1500, 1760, 2020]) {
    const sx = shoreXAt(d);
    ctx.fillRect(sx - 8, d - 15, 218, 30);
    ctx.strokeStyle = 'rgba(60,40,20,0.5)';
    ctx.lineWidth = 2;
    for (let x = sx; x < sx + 210; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, d - 15);
      ctx.lineTo(x, d + 15);
      ctx.stroke();
    }
  }

  // ---- buildings, palms, lamps, the lighthouse ----
  const dark = 1 - game.daylight;
  for (const b of city.buildings) {
    if (!inView(game, b.x + b.w / 2, b.y + b.h / 2, 300)) continue;
    const shx = b.height * 0.16;
    const shy = b.height * 0.11;
    ctx.fillStyle = 'rgba(15,18,24,0.28)';
    ctx.fillRect(b.x + shx, b.y + shy + b.h * 0.35, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y + b.h * 0.35, b.w, b.h * 0.65 + shy * 0.4);
    // lit windows on the wall band after dark
    if (dark > 0.35) {
      ctx.fillStyle = 'rgba(255,214,130,0.85)';
      const rows = Math.max(1, Math.floor(b.h / 34));
      const cols = Math.max(1, Math.floor(b.w / 30));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          if (((i * 7 + j * 13 + b.x) % 5) < 2) ctx.fillRect(b.x + 8 + i * 30, b.y + b.h * 0.45 + j * 30, 7, 9);
        }
      }
    }
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h * 0.72);
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h * 0.72 - 12);
    if (b.height > 130) { // rooftop plant on the towers
      ctx.fillStyle = 'rgba(30,34,44,0.5)';
      ctx.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.2, 22, 16);
      ctx.fillRect(b.x + b.w * 0.62, b.y + b.h * 0.4, 16, 12);
    }
    if (b.sign) {
      ctx.fillStyle = b.neon;
      ctx.globalAlpha = dark > 0.3 ? 0.95 : 0.55;
      ctx.fillRect(b.x + 4, b.y + 3, Math.min(b.w - 8, 64), 5);
      ctx.globalAlpha = 1;
    }
  }
  for (const palm of city.palms) {
    if (!inView(game, palm.x, palm.y, 60)) continue;
    ctx.strokeStyle = PALETTE.palmTrunk;
    ctx.lineWidth = 3.4 * palm.s;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.lineTo(palm.x + 3, palm.y - 4);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.palm;
    ctx.lineWidth = 2.6 * palm.s;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + palm.x * 0.01;
      ctx.beginPath();
      ctx.moveTo(palm.x + 3, palm.y - 4);
      ctx.quadraticCurveTo(palm.x + 3 + Math.cos(a) * 11 * palm.s, palm.y - 9 * palm.s, palm.x + 3 + Math.cos(a) * 17 * palm.s, palm.y - 2);
      ctx.stroke();
    }
  }
  // the lighthouse: striped tower and, after dark, its turning beam
  const lh = city.lighthouse;
  if (dark > 0.3) {
    const beamA = game.elapsed * 0.5;
    const grad = ctx.createRadialGradient(lh.x, lh.y, 10, lh.x, lh.y, 420);
    grad.addColorStop(0, 'rgba(255,244,190,0.30)');
    grad.addColorStop(1, 'rgba(255,244,190,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(lh.x, lh.y);
    ctx.arc(lh.x, lh.y, 420, beamA, beamA + 0.42);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#e8e4da';
  ctx.beginPath();
  ctx.arc(lh.x, lh.y, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c23b4e';
  ctx.beginPath();
  ctx.arc(lh.x, lh.y, 24, -0.4, 0.9);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(lh.x, lh.y, 24, Math.PI - 0.4, Math.PI + 0.9);
  ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(lh.x, lh.y, 8, 0, Math.PI * 2);
  ctx.fill();

  // ---- shells, pickups, points of interest ----
  for (const sh of city.shells) {
    if (sh.taken || !inView(game, sh.x, sh.y, 40)) continue;
    ctx.fillStyle = '#fff3f8';
    ctx.beginPath();
    ctx.arc(sh.x, sh.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff8fb5';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(sh.x, sh.y, 3.4, 0.4, 4.4);
    ctx.stroke();
  }
  for (const pk of game.pickups) {
    if (pk.taken || !inView(game, pk.x, pk.y, 40)) continue;
    const bob = Math.sin(game.elapsed * 3 + pk.x) * 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pk.x, pk.y + bob, 13 + Math.sin(game.elapsed * 4) * 2, 0, Math.PI * 2);
    ctx.stroke();
    drawPickupIcon(ctx, pk.kind, pk.x, pk.y + bob);
  }
  for (const poi of city.pois) {
    if (!inView(game, poi.x, poi.y, 60)) continue;
    const bob = Math.sin(game.elapsed * 2.4 + poi.x) * 3;
    ctx.fillStyle = 'rgba(8,10,16,0.72)';
    ctx.beginPath();
    ctx.arc(poi.x, poi.y - 34 + bob, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = poi.kind === 'clinic' ? '#ff6b81' : poi.kind === 'garage' ? '#ffd166' : poi.kind === 'armoury' ? '#c8b6ff' : poi.kind === 'club' ? '#ff5da2' : '#7bf1a8';
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(poi.kind === 'clinic' ? '+' : poi.kind === 'garage' ? 'G' : poi.kind === 'armoury' ? 'A' : poi.kind === 'club' ? 'M' : 'H', poi.x, poi.y - 29 + bob);
  }

  // ---- the objective: a pillar of gold light on the target ----
  const target = game.objectiveTarget();
  if (target && inView(game, target.x, target.y, 200)) {
    const pulse = 0.55 + Math.sin(game.elapsed * 4) * 0.2;
    const grad = ctx.createLinearGradient(0, target.y - 260, 0, target.y);
    grad.addColorStop(0, 'rgba(255,209,102,0)');
    grad.addColorStop(1, `rgba(255,209,102,${pulse})`);
    ctx.fillStyle = grad;
    ctx.fillRect(target.x - 13, target.y - 260, 26, 260);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 30 + Math.sin(game.elapsed * 4) * 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  // the next mission's start, a pink M beacon
  const avail = game.mission.available(game);
  if (!game.mission.active && avail && game.screen === 'play') {
    const s = avail.def.startAt;
    if (inView(game, s.x, s.y, 200)) {
      const bob = Math.sin(game.elapsed * 3) * 6;
      ctx.fillStyle = '#ff5da2';
      ctx.beginPath();
      ctx.arc(s.x, s.y - 40 + bob, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('M', s.x, s.y - 34 + bob);
    }
  }

  game.fx.drawWorld(ctx);

  // ---- people and vehicles ----
  for (const ped of game.peds) drawPerson(ctx, game, ped);
  for (const c of game.copPeds) drawPerson(ctx, game, c);
  for (const v of game.vehicles) {
    if (!inView(game, v.x, v.y, 160)) continue;
    if (v.kind === 'boat') drawBoat(ctx, game, v);
    else drawCar(ctx, game, v);
  }
  if (!game.player.inVehicle) drawPlayer(ctx, game);
  game.fx.drawTexts(ctx);

  // ---- the light of the hour over everything ----
  if (dark > 0.02) {
    ctx.fillStyle = game.tint;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    // lamp glow and neon bloom, added back over the tint
    ctx.globalCompositeOperation = 'lighter';
    for (const lamp of city.lamps) {
      if (!inView(game, lamp.x, lamp.y, 90)) continue;
      const grad = ctx.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 44);
      grad.addColorStop(0, `rgba(255,196,110,${0.20 * dark})`);
      grad.addColorStop(1, 'rgba(255,196,110,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 44, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawPickupIcon(ctx, kind, x, y) {
  ctx.fillStyle = kind === 'health' ? '#ff6b81' : kind === 'armour' ? '#7cc7ff' : kind === 'ammo' ? '#ffd166' : kind === 'bribe' ? '#ffd166' : '#7bf1a8';
  if (kind === 'health') {
    ctx.fillRect(x - 3, y - 9, 6, 18);
    ctx.fillRect(x - 9, y - 3, 18, 6);
  } else if (kind === 'bribe') {
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const rad = i % 2 === 0 ? 9 : 4;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = x + Math.cos(a) * rad;
      const py = y + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'cash') {
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', x, y + 5);
  } else {
    ctx.fillRect(x - 4, y - 8, 8, 16);
  }
}

function drawPerson(ctx, game, ped) {
  if (!inView(game, ped.x, ped.y, 50)) return;
  ctx.fillStyle = 'rgba(15,18,24,0.25)';
  ctx.beginPath();
  ctx.ellipse(ped.x + 3, ped.y + 5, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (ped.dead) {
    ctx.fillStyle = 'rgba(120,20,36,0.55)';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y, 11, 6, ped.angle, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const lying = ped.downT > 0;
  const bob = lying ? 0 : Math.abs(Math.sin(ped.walkPhase)) * 1.6;
  ctx.fillStyle = ped.pants;
  if (!lying) {
    const la = Math.sin(ped.walkPhase) * 5;
    ctx.fillRect(ped.x - 4 + Math.cos(ped.angle) * la * 0.4 - 2, ped.y - 2 + Math.sin(ped.angle) * la * 0.4, 4.4, 4.4);
    ctx.fillRect(ped.x - 4 - Math.cos(ped.angle) * la * 0.4 - 2, ped.y - 2 - Math.sin(ped.angle) * la * 0.4, 4.4, 4.4);
  }
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(ped.x, ped.y - bob * 0.3, 7.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(ped.x + Math.cos(ped.angle) * 2, ped.y + Math.sin(ped.angle) * 2 - bob * 0.3, 4.4, 0, Math.PI * 2);
  ctx.fill();
  if (ped.cop) {
    ctx.fillStyle = '#10161f';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 2, ped.y + Math.sin(ped.angle) * 2 - bob * 0.3, 4.8, ped.angle - 2.4, ped.angle + 2.4);
    ctx.fill();
  }
  if (ped.lookout) {
    ctx.strokeStyle = '#5b2333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 10.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPlayer(ctx, game) {
  const p = game.player;
  if (p.swimming) {
    ctx.strokeStyle = 'rgba(220,245,252,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13 + Math.sin(game.elapsed * 5) * 2.4, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawPerson(ctx, game, { ...p, dead: false, downT: 0, cop: false });
  // a fine white ring so the eye always finds Jax in a crowd
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 11.5, 0, Math.PI * 2);
  ctx.stroke();
  if (p.weapon === 'pistol' && p.hasPistol) {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16);
    ctx.lineTo(p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30);
    ctx.stroke();
    ctx.fillStyle = '#22262e';
    ctx.fillRect(p.x + Math.cos(p.angle) * 14 - 2, p.y + Math.sin(p.angle) * 14 - 2, 5, 5);
  }
  if (p.hurtT > 0) {
    ctx.strokeStyle = 'rgba(255,71,87,0.8)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawCar(ctx, game, v) {
  const m = v.model;
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.angle);
  ctx.fillStyle = 'rgba(12,14,20,0.35)';
  ctx.fillRect(-m.l / 2 + 4, -m.w / 2 + 5, m.l, m.w);
  // wheels, the front pair turned by the steering
  ctx.fillStyle = '#14161a';
  const wy = m.w / 2 - 1;
  for (const [wx, front] of [[m.l / 2 - 11, 1], [-m.l / 2 + 11, 0]]) {
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(wx, s * wy);
      if (front) ctx.rotate((v.steerVis ?? 0) * 0.42);
      ctx.fillRect(-5.5, -2.6, 11, 5.2);
      ctx.restore();
    }
  }
  const body = v.dead ? '#2b2b30' : v.color;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-m.l / 2, -m.w / 2, m.l, m.w, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,10,14,0.45)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  if (v.livery) { // SBPD: white doors and a light bar that never stops flashing
    ctx.fillStyle = '#eef1f5';
    ctx.fillRect(-m.l * 0.16, -m.w / 2 + 1.4, m.l * 0.34, m.w - 2.8);
    const flash = Math.floor(game.elapsed * 4) % 2 === 0;
    ctx.fillStyle = flash ? '#ff4757' : '#5b8cff';
    ctx.fillRect(-4, -m.w / 2 + 3, 8, m.w / 2 - 3);
    ctx.fillStyle = flash ? '#5b8cff' : '#ff4757';
    ctx.fillRect(-4, 0, 8, m.w / 2 - 3);
  }
  if (m.taxi) {
    ctx.fillStyle = '#14161a';
    ctx.fillRect(-m.l * 0.2, -m.w / 2 + 2, m.l * 0.4, 4);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-7, -6, 14, 12);
    ctx.fillStyle = '#14161a';
    ctx.font = '800 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  // cabin: windshield, roof, rear glass
  ctx.fillStyle = 'rgba(16,22,30,0.9)';
  ctx.beginPath();
  ctx.roundRect(-m.l * 0.08, -m.w / 2 + 3.4, m.l * 0.34, m.w - 6.8, 4);
  ctx.fill();
  ctx.fillStyle = v.dead ? '#3a3a40' : shade(v.color, 26);
  ctx.beginPath();
  ctx.roundRect(-m.l * 0.3, -m.w / 2 + 4.6, m.l * 0.24, m.w - 9.2, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(190,225,245,0.75)';
  ctx.fillRect(m.l * 0.2, -m.w / 2 + 4.4, 3.4, m.w - 8.8);
  // headlights after dark
  if (game.daylight < 0.45 && !v.dead) {
    ctx.fillStyle = 'rgba(255,240,190,0.9)';
    ctx.fillRect(m.l / 2 - 2, -m.w / 2 + 3, 3, 5);
    ctx.fillRect(m.l / 2 - 2, m.w / 2 - 8, 3, 5);
    const grad = ctx.createLinearGradient(m.l / 2, 0, m.l / 2 + 120, 0);
    grad.addColorStop(0, 'rgba(255,240,190,0.13)');
    grad.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(m.l / 2, -m.w / 2 + 4);
    ctx.lineTo(m.l / 2 + 120, -m.w / 2 - 16);
    ctx.lineTo(m.l / 2 + 120, m.w / 2 + 16);
    ctx.lineTo(m.l / 2, m.w / 2 - 4);
    ctx.closePath();
    ctx.fill();
  }
  if (v.marked) {
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(-m.l / 2 - 4, -m.w / 2 - 4, m.l + 8, m.w + 8, 9);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBoat(ctx, game, v) {
  const m = v.model;
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.angle);
  ctx.fillStyle = 'rgba(10,25,35,0.35)';
  ctx.beginPath();
  ctx.ellipse(3, 4, m.l / 2, m.w / 2 + 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = v.dead ? '#33333a' : v.color;
  ctx.beginPath();
  ctx.moveTo(m.l / 2 + 8, 0);
  ctx.lineTo(m.l * 0.2, -m.w / 2);
  ctx.lineTo(-m.l / 2, -m.w / 2 + 3);
  ctx.lineTo(-m.l / 2, m.w / 2 - 3);
  ctx.lineTo(m.l * 0.2, m.w / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,20,26,0.5)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = 'rgba(240,246,248,0.9)';
  ctx.beginPath();
  ctx.roundRect(-m.l * 0.32, -m.w / 2 + 4.4, m.l * 0.5, m.w - 8.8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(140,200,225,0.85)';
  ctx.fillRect(m.l * 0.08, -m.w / 2 + 5.4, 4, m.w - 10.8);
  ctx.fillStyle = '#22262e';
  ctx.fillRect(-m.l / 2 - 5, -4, 6, 8); // outboard motor
  if (v.marked) {
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, m.l / 2 + 10, m.w / 2 + 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// Lighten or darken a #rrggbb colour by an amount, for roofs and shading.
function shade(hex, amt) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}

// Rain, in screen space: slanted streaks whose count follows the weather.
export function drawRain(ctx, game) {
  if (game.weather !== 'rain' && game.weather !== 'storm') return;
  const n = game.weather === 'storm' ? 190 : 110;
  ctx.strokeStyle = 'rgba(190,220,245,0.4)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i < n; i += 1) {
    const x = ((i * 173 + game.elapsed * 620) % 1420) - 60;
    const y = (i * 269 + game.elapsed * 880) % 760;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 5, y + 15);
  }
  ctx.stroke();
}
