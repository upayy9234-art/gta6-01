// hud.js — everything drawn over the world: cash and shells, the clock and
// the wanted stars, health and armour, the mission banner and Marisol's
// subtitles, the notification feed, the GPS minimap (a cached painting of
// the whole bay with live blips), and the title, pause, WASTED and BUSTED
// screens. Pure canvas, no DOM beyond the one game canvas.

import { WORLD } from './config.js';
import { formatClock } from './effects.js';
import { coastX, AVENUES, STREETS } from './city.js';
import { ISLAND } from './config.js';

export function createHud() {
  const notes = [];
  let sub = null;
  let red = 0;
  let mapCache = null;

  const hud = {
    notify(text) {
      notes.push({ text, t: 0 });
      if (notes.length > 5) notes.shift();
    },
    subtitle(text) {
      sub = { text, t: 0 };
    },
    flashRed() {
      red = Math.min(1, red + 0.55);
    },
    update(dt) {
      for (const n of notes) n.t += dt;
      while (notes.length && notes[0].t > 4.6) notes.shift();
      if (sub) {
        sub.t += dt;
        if (sub.t > 7.5) sub = null;
      }
      red = Math.max(0, red - dt * 1.6);
    },

    draw(ctx, G, w, h) {
      const p = G.player;
      ctx.save();
      ctx.textBaseline = 'top';

      // Cash and shells, top-left.
      panel(ctx, 14, 14, 208, 58);
      ctx.fillStyle = '#a3e635';
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.fillText('$' + p.cash.toLocaleString('en-US'), 26, 20);
      ctx.fillStyle = '#facc15';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText('◉ Shells ' + p.shells + '/25', 26, 50);

      // Clock and wanted stars, top-right.
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.fillText(formatClock(G.hour), w - 22, 18);
      drawStars(ctx, w - 22, 44, G.police.stars);
      if (G.police.bust > 0.03) {
        ctx.fillStyle = '#f87171';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillText('BUSTED?', w - 22, 74);
        bar(ctx, w - 142, 92, 120, 7, G.police.bust, '#f87171');
      }
      ctx.textAlign = 'left';

      // Mission banner, top-centre.
      const obj = G.shotBanner || G.missions.objective();
      const side = G.sidejobs.label();
      if (obj || side) {
        const title = obj ? obj.title : 'Side work';
        const text = obj ? obj.text : side;
        ctx.font = 'bold 14px system-ui, sans-serif';
        const tw = Math.max(ctx.measureText(title).width, ctx.measureText(text).width) + 36;
        panel(ctx, (w - tw) / 2, 14, tw, 52);
        ctx.fillStyle = '#facc15';
        ctx.textAlign = 'center';
        ctx.fillText(title, w / 2, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '13.5px system-ui, sans-serif';
        ctx.fillText(text, w / 2, 42);
        ctx.textAlign = 'left';
      }

      // Notifications under the banner.
      ctx.font = '13px system-ui, sans-serif';
      let ny = 76;
      for (const n of notes) {
        const alpha = n.t > 3.8 ? Math.max(0, 1 - (n.t - 3.8) / 0.8) : 1;
        ctx.globalAlpha = alpha;
        const tw = ctx.measureText(n.text).width + 24;
        panel(ctx, (w - tw) / 2, ny, tw, 24);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(n.text, w / 2, ny + 5);
        ctx.textAlign = 'left';
        ny += 29;
      }
      ctx.globalAlpha = 1;

      // Health, armour, weapon and speed, bottom-right.
      const bx = w - 232;
      const by = h - 76;
      panel(ctx, bx, by, 218, 62);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText('HEALTH', bx + 12, by + 8);
      ctx.fillText('ARMOUR', bx + 118, by + 8);
      bar(ctx, bx + 12, by + 23, 94, 9, p.health / 100, '#4ade80');
      bar(ctx, bx + 118, by + 23, 88, 9, p.armor / 100, '#60a5fa');
      ctx.font = '12.5px system-ui, sans-serif';
      ctx.fillStyle = '#e2e8f0';
      let right = p.vehicle
        ? Math.round(Math.hypot(p.vehicle.vx, p.vehicle.vy) * 0.24) + ' mph · ' + p.vehicle.def.name
        : p.weapon === 'pistol'
          ? 'Harbor 9mm · ' + p.ammo + ' rds'
          : 'Fists';
      ctx.fillText(right, bx + 12, by + 40);

      // Context hint, bottom-centre.
      ctx.textAlign = 'center';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const hint = contextHint(G);
      if (hint) ctx.fillText(hint, w / 2, h - 26);
      ctx.textAlign = 'left';

      // Subtitle — Marisol and the story speak here.
      if (sub) {
        ctx.font = 'italic 15.5px system-ui, sans-serif';
        const wrapped = wrap(ctx, sub.text, Math.min(760, w - 120));
        const sh = wrapped.length * 21 + 18;
        panel(ctx, (w - Math.min(800, w - 80)) / 2, h - 116 - sh, Math.min(800, w - 80), sh);
        ctx.fillStyle = '#fde68a';
        ctx.textAlign = 'center';
        wrapped.forEach((line, i) => ctx.fillText(line, w / 2, h - 116 - sh + 9 + i * 21));
        ctx.textAlign = 'left';
      }

      hud.drawMinimap(ctx, G, 16, h - 196, 180);

      // Damage vignette.
      if (red > 0) {
        ctx.fillStyle = 'rgba(190,18,40,' + (red * 0.28) + ')';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();
    },

    drawMinimap(ctx, G, x, y, size) {
      if (!mapCache) mapCache = paintMap(G);
      ctx.save();
      roundRect(ctx, x, y, size, size * 0.78, 10);
      ctx.clip();
      ctx.drawImage(mapCache, x, y, size, size * 0.78);
      const sx = size / WORLD.w;
      const sy = (size * 0.78) / WORLD.h;
      const dot = (wx, wy, color, r) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + wx * sx, y + wy * sy, r, 0, Math.PI * 2);
        ctx.fill();
      };
      // Shells still on the ground.
      ctx.fillStyle = 'rgba(250,204,21,0.8)';
      for (const s of G.city.shells) if (!s.taken) ctx.fillRect(x + s.x * sx - 1, y + s.y * sy - 1, 2, 2);
      // Police blips flash blue/red.
      const flash = Math.floor(performance.now() / 380) % 2 === 0;
      for (const u of G.police.units) dot(u.x, u.y, flash ? '#3b82f6' : '#ef4444', 2.6);
      // Mission start and objective.
      const start = G.missions.startMarker(G);
      if (start) dot(start.x, start.y, '#facc15', 4);
      const obj = G.missions.objective();
      if (obj && obj.marker) {
        const pulse = 4 + Math.sin(performance.now() / 240) * 1.4;
        dot(obj.marker.x, obj.marker.y, '#fb923c', pulse);
      }
      const side = G.sidejobs.marker();
      if (side) dot(side.x, side.y, '#4ade80', 3.6);
      // The player: a white arrow on his heading.
      const px = x + G.player.x * sx;
      const py = y + G.player.y * sy;
      ctx.translate(px, py);
      ctx.rotate(G.player.angle);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-4, -3.6);
      ctx.lineTo(-4, 3.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // Frame.
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, size, size * 0.78, 10);
      ctx.stroke();
    },

    drawTitle(ctx, G, w, h) {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#1b1035');
      grad.addColorStop(0.55, '#7c2d4e');
      grad.addColorStop(0.78, '#e8641e');
      grad.addColorStop(1, '#0b1020');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.fillText('S O L S T I C E   B A Y', w / 2, h * 0.16);
      ctx.fillStyle = '#fff';
      ctx.font = '900 84px system-ui, sans-serif';
      ctx.fillText('SOLSTICE HEAT', w / 2, h * 0.24);
      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 40px system-ui, sans-serif';
      ctx.fillText('— NEON TIDE —', w / 2, h * 0.24 + 64);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = '16.5px system-ui, sans-serif';
      const lines = [
        'Jax Marlin owes the bay a fortune and Marisol Vega holds the note.',
        'Twelve jobs stand between him and a clean slate: stolen cars, boat runs,',
        'a street race, a five-star funeral — and the SBPD at every corner.',
      ];
      lines.forEach((l, i) => ctx.fillText(l, w / 2, h * 0.48 + i * 24));
      ctx.font = '14.5px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      const controls = [
        'WASD drive & walk · E enter/exit vehicle · Space handbrake · Shift sprint',
        'Mouse aim, click or F to fight · P pause · M mute · Walk to the M for work',
        'Garages repair · the Clinic heals · Fort Arms sells the Harbor 9mm',
      ];
      controls.forEach((l, i) => ctx.fillText(l, w / 2, h * 0.66 + i * 22));
      ctx.fillStyle = '#a3e635';
      ctx.font = 'bold 22px system-ui, sans-serif';
      const blink = Math.floor(performance.now() / 600) % 2 === 0;
      if (blink) ctx.fillText(G.hasSave ? 'Press ENTER — continue    ·    N — new game' : 'Press ENTER to play', w / 2, h * 0.84);
      ctx.textAlign = 'left';
    },

    drawPause(ctx, w, h) {
      ctx.fillStyle = 'rgba(5,8,18,0.72)';
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = '900 52px system-ui, sans-serif';
      ctx.fillText('PAUSED', w / 2, h * 0.36);
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('P or Esc to resume · your game saves itself as you play', w / 2, h * 0.36 + 52);
      ctx.textAlign = 'left';
    },

    drawEnd(ctx, kind, w, h) {
      ctx.fillStyle = kind === 'wasted' ? 'rgba(60,4,10,0.66)' : 'rgba(8,10,26,0.7)';
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.fillStyle = kind === 'wasted' ? '#f87171' : '#93c5fd';
      ctx.font = '900 76px system-ui, sans-serif';
      ctx.fillText(kind === 'wasted' ? 'WASTED' : 'BUSTED', w / 2, h * 0.4);
      ctx.fillStyle = '#fff';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(kind === 'wasted' ? 'The clinic patched you up and sent the bill.' : 'The SBPD took their cut and let you walk.', w / 2, h * 0.4 + 58);
      ctx.fillStyle = '#a3e635';
      ctx.font = 'bold 19px system-ui, sans-serif';
      if (Math.floor(performance.now() / 600) % 2 === 0) ctx.fillText('Press ENTER', w / 2, h * 0.4 + 104);
      ctx.textAlign = 'left';
    },
  };
  return hud;
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(6,10,22,0.62)';
  roundRect(ctx, x, y, w, h, 9);
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
}

function drawStars(ctx, rightX, y, stars) {
  ctx.font = '21px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#facc15' : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', rightX - (5 - i) * 24 + 24, y);
  }
}

function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? line + ' ' + word : word;
    if (ctx.measureText(trial).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = trial;
  }
  if (line) lines.push(line);
  return lines;
}

function contextHint(G) {
  const p = G.player;
  if (p.vehicle) return 'E — step out · Space — handbrake';
  // Near a vehicle he could take?
  for (const v of G.vehicles) {
    if (Math.hypot(v.x - p.x, v.y - p.y) < 64) return 'E — take the ' + v.def.name;
  }
  const s = G.city.sites;
  if (Math.hypot(p.x - s.marisol.x, p.y - s.marisol.y) < 60 && !G.missions.current && !G.missions.allDone) return 'Marisol has work for you';
  if (Math.hypot(p.x - s.garage.x, p.y - s.garage.y) < 80 && p.vehicle) return '';
  return 'WASD — walk · Shift — sprint · F — fight';
}

// The minimap's static layer: painted once from the same city data the
// world is built from, so the GPS can never disagree with the streets.
function paintMap(G) {
  const c = document.createElement('canvas');
  c.width = 480;
  c.height = 360;
  const m = c.getContext('2d');
  const sx = 480 / WORLD.w;
  const sy = 360 / WORLD.h;
  m.fillStyle = '#14486e';
  m.fillRect(0, 0, 480, 360);
  // Land: everything west of the coast, plus the island.
  m.fillStyle = '#3f4a3a';
  m.beginPath();
  m.moveTo(0, 0);
  for (let y = 0; y <= WORLD.h; y += 60) m.lineTo(coastX(y) * sx, y * sy);
  for (let y = WORLD.h; y >= 0; y -= 60) m.lineTo(coastX(y) * sx, y * sy);
  m.closePath();
  m.fill();
  m.beginPath();
  m.arc(ISLAND.x * sx, ISLAND.y * sy, ISLAND.r * sx, 0, Math.PI * 2);
  m.fillStyle = '#46543f';
  m.fill();
  // Buildings as pale blocks, then the road grid over them.
  for (const b of G.city.buildings) {
    m.fillStyle = 'rgba(200,200,210,0.45)';
    m.fillRect(b.x * sx, b.y * sy, Math.max(1.4, b.w * sx), Math.max(1.4, b.h * sy));
  }
  m.strokeStyle = '#c8ccd2';
  m.lineWidth = 1.6;
  m.beginPath();
  for (const a of AVENUES) {
    m.moveTo(a * sx, 0);
    m.lineTo(a * sx, 360);
  }
  for (const s of STREETS) {
    m.moveTo(0, s * sy);
    m.lineTo(coastX(s) * sx, s * sy);
  }
  // The shore drive and the causeway.
  for (let y = 0; y < WORLD.h; y += 120) m.lineTo((coastX(y) - 130) * sx, y * sy);
  m.moveTo((coastX(ISLAND.y) - 130) * sx, ISLAND.y * sy);
  m.lineTo(ISLAND.x * sx, ISLAND.y * sy);
  m.stroke();
  return c;
}
