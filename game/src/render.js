// Renderer: draws the city (roads, blocks, park, river, lamps), cars, pedestrians,
// the player, bullets, particles and the waypoint arrow, then the title / pause /
// game-over / win screens. Camera follows the player and zooms out while driving.
import { PALETTE, VIEW, WORLD } from './config.js';
import { drawHUD, roundRect } from './hud.js';
import { missionWaypoint } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
  }
  resize();
  window.addEventListener('resize', resize);
  return {
    draw(state, screen, best) {
      const cw = canvas.width, ch = canvas.height;
      const scale = Math.min(cw / VIEW.width, ch / VIEW.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = PALETTE.sky; ctx.fillRect(0, 0, cw, ch);
      ctx.setTransform(scale, 0, 0, scale, (cw - VIEW.width * scale) / 2, (ch - VIEW.height * scale) / 2);
      const cam = state.camera;
      const zoom = state.player.inCar ? 0.78 : 1;
      ctx.save();
      ctx.translate(VIEW.width / 2 - cam.x * zoom, VIEW.height / 2 - cam.y * zoom);
      ctx.scale(zoom, zoom);
      drawWorld(ctx, state);
      drawEntities(ctx, state);
      ctx.restore();
      // Night tint.
      const night = state.timeOfDay < 360 || state.timeOfDay > 1080;
      if (night) { ctx.fillStyle = 'rgba(10,12,40,0.22)'; ctx.fillRect(0, 0, VIEW.width, VIEW.height); }
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHUD(ctx, state);
      if (screen === SCREEN_TITLE) drawTitle(ctx, state, best);
      if (screen === SCREEN_PAUSED) drawPause(ctx);
      if (screen === SCREEN_OVER) drawGameOver(ctx, state, best);
      if (screen === SCREEN_WIN) drawWin(ctx, state);
    },
  };
}

function drawWorld(ctx, state) {
  const cam = state.camera;
  const vw = VIEW.width + 200, vh = VIEW.height + 200;
  const x0 = Math.max(0, cam.x - vw / 2), y0 = Math.max(0, cam.y - vh / 2);
  // Ground (unclamped so the view never shows void past the world edge).
  ctx.fillStyle = PALETTE.ground; ctx.fillRect(cam.x - vw / 2, cam.y - vh / 2, vw, vh);
  // River (east).
  ctx.fillStyle = PALETTE.water; ctx.fillRect(2960, cam.y - vh / 2, WORLD.width - 2960, vh);
  // Bridges.
  ctx.fillStyle = PALETTE.bridge;
  ctx.fillRect(2900, 620, 500, 96); ctx.fillRect(2900, 1680, 500, 96);
  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (let x = 388; x < WORLD.width; x += 436) ctx.fillRect(x - WORLD.road / 2, y0, WORLD.road, vh);
  for (let y = 388; y < WORLD.height; y += 436) ctx.fillRect(x0, y - WORLD.road / 2, vw, WORLD.road);
  // Road centre dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (let x = 388; x < WORLD.width; x += 436) for (let y = y0; y < y0 + vh; y += 56) ctx.fillRect(x - 2, y, 4, 26);
  for (let y = 388; y < WORLD.height; y += 436) for (let x = x0; x < x0 + vw; x += 56) ctx.fillRect(x, y - 2, 26, 4);
  // Parks.
  for (const park of state.city.parks) {
    ctx.fillStyle = '#123626'; ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = '#1d5c36';
    for (let i = 0; i < 8; i += 1) {
      const tx = park.x + 30 + (i % 4) * 70, ty = park.y + 30 + Math.floor(i / 4) * 120;
      ctx.beginPath(); ctx.arc(tx, ty, 22, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Buildings with lit windows and neon signs.
  for (const b of state.city.buildings) {
    if (b.x > cam.x + vw / 2 + 100 || b.x + b.w < cam.x - vw / 2 - 100 || b.y > cam.y + vh / 2 + 100 || b.y + b.h < cam.y - vh / 2 - 100) continue;
    ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(b.x, b.y, b.w, 6);
    ctx.fillStyle = '#ffd76a';
    const cols = Math.max(2, Math.floor(b.w / 34)), rows = Math.max(2, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i += 1) for (let j = 0; j < rows; j += 1) {
      if ((i * 7 + j * 13 + b.windows) % 3 === 0) ctx.fillRect(b.x + 8 + i * 34, b.y + 10 + j * 34, 12, 16);
    }
    if (b.neon) {
      ctx.fillStyle = b.neon; ctx.globalAlpha = 0.85;
      ctx.fillRect(b.x + b.w / 2 - 26, b.y - 4, 52, 8);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  // Street lamps glow.
  for (const lamp of state.city.lamps) {
    if (Math.abs(lamp.x - cam.x) > vw / 2 || Math.abs(lamp.y - cam.y) > vh / 2) continue;
    ctx.fillStyle = 'rgba(255,214,106,0.16)';
    ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd76a'; ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 4, 0, Math.PI * 2); ctx.fill();
  }
  // Waypoint marker on the ground.
  const wp = missionWaypoint(state);
  if (wp && !state.missions.done) {
    const pulse = 1 + Math.sin(state.time * 5) * 0.12;
    ctx.strokeStyle = '#ff2e88'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(wp.x, wp.y, 46 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,46,136,0.18)';
    ctx.beginPath(); ctx.arc(wp.x, wp.y, 46 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath(); ctx.moveTo(wp.x, wp.y - 58); ctx.lineTo(wp.x - 12, wp.y - 34); ctx.lineTo(wp.x + 12, wp.y - 34); ctx.closePath(); ctx.fill();
  }
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y); ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-34, -18, 68, 36);
  ctx.fillStyle = car.color;
  roundRect(ctx, -32, -15, 64, 30, 8); ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  ctx.fillRect(-8, -12, 18, 24);
  ctx.fillStyle = '#222';
  ctx.fillRect(-30, -17, 10, 5); ctx.fillRect(-30, 12, 10, 5);
  ctx.fillRect(20, -17, 10, 5); ctx.fillRect(20, 12, 10, 5);
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(30, -11, 3, 6); ctx.fillRect(30, 5, 3, 6);
  if (car.police) {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('VPD', 0, 4);
    const blink = Math.floor(performance.now() / 180) % 2 === 0;
    ctx.fillStyle = blink ? '#ff3b30' : '#2f7bff';
    ctx.beginPath(); ctx.arc(-4, -13, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = blink ? '#2f7bff' : '#ff3b30';
    ctx.beginPath(); ctx.arc(6, -13, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawEntities(ctx, state) {
  // Pedestrians.
  for (const ped of state.peds) {
    ctx.save(); ctx.translate(ped.x, ped.y);
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Cars (NPC first, player car last so it draws on top).
  for (const car of state.cars) if (car !== state.player.inCar) drawCar(ctx, car);
  if (state.player.inCar) drawCar(ctx, state.player.inCar);
  // Bullets.
  for (const b of state.bullets) {
    ctx.fillStyle = b.fromPolice ? '#ff6b6b' : '#ffe27a';
    ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
  }
  // Particles.
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Player on foot.
  const p = state.player;
  if (!p.inCar && !p.dead) {
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 8, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(p.angle);
    ctx.fillStyle = '#2b6cb0'; roundRect(ctx, -10, -8, 20, 16, 6); ctx.fill();
    ctx.fillStyle = '#ffd23d'; ctx.beginPath(); ctx.arc(6, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#333'; ctx.fillRect(10, -2, 14, 4);
    ctx.restore();
    // Aim line.
    ctx.strokeStyle = 'rgba(255,210,61,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.angle) * 44, p.y + Math.sin(p.angle) * 44); ctx.stroke();
  }
  // Off-screen waypoint arrow at the view edge.
  const wp = missionWaypoint(state);
  if (wp && !state.missions.done) {
    const cam = state.camera;
    const dx = wp.x - cam.x, dy = wp.y - cam.y;
    if (Math.abs(dx) > VIEW.width / 2 - 60 || Math.abs(dy) > VIEW.height / 2 - 60) {
      const a = Math.atan2(dy, dx);
      const ax = VIEW.width / 2 + Math.cos(a) * (VIEW.width / 2 - 70);
      const ay = VIEW.height / 2 + Math.sin(a) * (VIEW.height / 2 - 70);
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
      ctx.fillStyle = '#ff2e88';
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ff2e88'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(Math.round(Math.hypot(dx, dy)) + 'm', ax, ay + 30);
    }
  }
}

function drawTitle(ctx, state, best) {
  ctx.fillStyle = 'rgba(6,8,20,0.58)'; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.neonPink;
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText('NEON HARBOR', VIEW.width / 2, 170);
  ctx.fillStyle = PALETTE.neonCyan; ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('AN OPEN-WORLD CRIME STORY  ·  VIRELIA', VIEW.width / 2, 212);
  ctx.fillStyle = PALETTE.text; ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Kai Mercer. One last job for fixer Mara Voss. Steal cars, outrun the VPD,', VIEW.width / 2, 268);
  ctx.fillText('finish three missions and take the Harbor Vault score.', VIEW.width / 2, 292);
  ctx.fillStyle = PALETTE.muted; ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('WASD move / drive  ·  Mouse aim  ·  Click or Space shoot  ·  E enter / exit car', VIEW.width / 2, 340);
  ctx.fillText('Shift run  ·  Esc pause  ·  M sound  ·  Progress saves automatically', VIEW.width / 2, 364);
  const pulse = 0.7 + Math.sin(state.time * 3) * 0.3;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = PALETTE.neonGold; ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('▶  CLICK OR PRESS SPACE TO START', VIEW.width / 2, 440);
  ctx.globalAlpha = 1;
  if (best > 0) {
    ctx.fillStyle = PALETTE.text; ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('Best score: ' + best.toLocaleString('en-US'), VIEW.width / 2, 480);
  }
  ctx.fillStyle = PALETTE.muted; ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('A fully original game — city, characters, story and music made for this bounty.', VIEW.width / 2, 640);
}

function drawPause(ctx) {
  ctx.fillStyle = 'rgba(6,8,20,0.7)'; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = PALETTE.text; ctx.textAlign = 'center'; ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW.width / 2, 330);
  ctx.font = '16px system-ui, sans-serif'; ctx.fillStyle = PALETTE.muted;
  ctx.fillText('Press Esc or P to keep playing', VIEW.width / 2, 372);
}

function drawGameOver(ctx, state, best) {
  ctx.fillStyle = 'rgba(20,4,10,0.78)'; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = PALETTE.danger; ctx.textAlign = 'center'; ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('BUSTED', VIEW.width / 2, 300);
  ctx.fillStyle = PALETTE.text; ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('The VPD caught Kai Mercer. Virelia keeps its secrets — this time.', VIEW.width / 2, 350);
  ctx.fillText('Score ' + state.score.toLocaleString('en-US') + '   ·   Best ' + best.toLocaleString('en-US'), VIEW.width / 2, 390);
  ctx.fillStyle = PALETTE.neonGold; ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('CLICK OR PRESS SPACE TO TRY AGAIN', VIEW.width / 2, 460);
}

function drawWin(ctx, state) {
  ctx.fillStyle = 'rgba(6,20,12,0.8)'; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = PALETTE.neonGold; ctx.textAlign = 'center'; ctx.font = 'bold 60px system-ui, sans-serif';
  ctx.fillText('THE SCORE IS YOURS', VIEW.width / 2, 280);
  ctx.fillStyle = PALETTE.text; ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Kai Mercer walks away from the Harbor Vault with the whole score.', VIEW.width / 2, 330);
  ctx.fillText('Mara Voss smiles. Virelia is yours now.', VIEW.width / 2, 358);
  ctx.fillText('Final score ' + state.score.toLocaleString('en-US') + '   ·   Cash $' + state.player.money.toLocaleString('en-US'), VIEW.width / 2, 400);
  ctx.fillStyle = PALETTE.neonCyan; ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('CLICK OR PRESS SPACE TO PLAY AGAIN', VIEW.width / 2, 470);
}
