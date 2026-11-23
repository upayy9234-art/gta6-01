// hud.js — everything drawn over the world: cash and shells, health and
// armour, the wanted stars, the objective banner, notifications, the bust
// meter, and the minimap with its GPS route to the current objective.

import { WORLD } from './config.js';
import { clamp, dist, fmtMoney } from './random.js';
import { coastX } from './city.js';

let gpsCache = { key: '', route: null, t: 0 };

export function drawHUD(G, ctx, W, H) {
  const p = G.player;
  ctx.save();
  ctx.textBaseline = 'top';

  drawVitals(G, ctx);
  drawStars(G, ctx, W);
  drawObjective(G, ctx, W);
  drawNotifications(G, ctx, W);
  drawMinimap(G, ctx, W, H);

  if (G.prompt && G.state === 'playing') {
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(G.prompt).width + 30;
    ctx.fillStyle = 'rgba(8,12,20,0.72)';
    roundRect(ctx, W / 2 - w / 2, H - 118, w, 32, 9);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(G.prompt, W / 2, H - 111);
  }

  // Bust meter: the ring fills while the SBPD has you stopped.
  if (G.wanted.bust > 0.1) {
    const frac = clamp(G.wanted.bust / 2.6, 0, 1);
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a4e';
    ctx.fillText('BUSTED?', W / 2, H - 190);
    ctx.fillStyle = 'rgba(8,12,20,0.7)';
    roundRect(ctx, W / 2 - 90, H - 168, 180, 13, 6);
    ctx.fill();
    ctx.fillStyle = '#ff5a4e';
    roundRect(ctx, W / 2 - 88, H - 166, 176 * frac, 9, 5);
    ctx.fill();
  }

  // District name toast when crossing into a new part of town.
  if (G.districtToast && G.districtToast.t > 0) {
    const a = clamp(G.districtToast.t / 1.2, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText(G.districtToast.name, W / 2, 92);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  ctx.restore();
  void p;
}

function drawVitals(G, ctx) {
  const p = G.player;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(8,12,20,0.62)';
  roundRect(ctx, 14, 14, 218, 86, 10);
  ctx.fill();
  ctx.font = '700 21px system-ui, sans-serif';
  ctx.fillStyle = '#7fe8a8';
  ctx.fillText(fmtMoney(p.cash), 26, 21);
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillStyle = '#bfe6ff';
  ctx.fillText('◉ ' + p.shellsFound.size + ' / 25 shells', 128, 26);
  if (p.hasPistol) {
    ctx.fillStyle = '#ffd94a';
    ctx.fillText('Harbor 9mm · ' + p.ammo, 128, 66);
  }
  bar(ctx, 26, 48, 92, 11, p.health / 100, '#e84a5f');
  bar(ctx, 26, 65, 92, 11, p.armor / 100, '#5a8cff');
  ctx.font = '700 8.5px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText('HP', 30, 49.5);
  ctx.fillText('ARMOR', 30, 66.5);
}

function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = color;
    roundRect(ctx, x, y, w * clamp(frac, 0, 1), h, 4);
    ctx.fill();
  }
}

function drawStars(G, ctx, W) {
  const stars = G.wanted.stars;
  ctx.textAlign = 'right';
  ctx.font = '25px system-ui, sans-serif';
  let str = '';
  for (let i = 0; i < 5; i++) str += i < stars ? '★' : '☆';
  const flash = G.wanted.seen && Math.sin(G.time * 7) > 0;
  ctx.fillStyle = 'rgba(8,12,20,0.62)';
  roundRect(ctx, W - 178, 14, 164, 42, 10);
  ctx.fill();
  ctx.fillStyle = stars === 0 ? '#5a6672' : flash ? '#ff5a4e' : '#ffd23c';
  ctx.fillText(str, W - 24, 21);
  if (stars > 0 && !G.wanted.seen) {
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = '#bfe6ff';
    ctx.fillText('SEARCHING…', W - 24, 62);
  }
}

function drawObjective(G, ctx, W) {
  const obj = G.objective || G.sideObjective;
  if (!obj || G.state !== 'playing') return;
  const d = Math.round(dist(G.player.x, G.player.y, obj.x, obj.y));
  const text = obj.label + '  ·  ' + d + 'm';
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const w = ctx.measureText(text).width + 34;
  ctx.fillStyle = 'rgba(8,12,20,0.66)';
  roundRect(ctx, W / 2 - w / 2, 14, w, 34, 9);
  ctx.fill();
  ctx.fillStyle = G.objective ? '#ffd94a' : '#9fe870';
  ctx.fillText(text, W / 2, 22);
}

function drawNotifications(G, ctx, W) {
  ctx.textAlign = 'center';
  ctx.font = '600 15px system-ui, sans-serif';
  let y = 58;
  for (const n of G.notifications) {
    const a = clamp(n.t / 0.7, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = n.color;
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 5;
    ctx.fillText(n.text, W / 2, y);
    y += 21;
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawMinimap(G, ctx, W, H) {
  const mw = 196, mh = 148;
  const x0 = W - mw - 14, y0 = H - mh - 14;
  const sx = mw / WORLD.width, sy = mh / WORLD.height;
  const px = (x) => x0 + x * sx;
  const py = (y) => y0 + y * sy;

  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x0, y0, mw, mh, 10);
  ctx.clip();
  ctx.fillStyle = '#14507e';
  ctx.fillRect(x0, y0, mw, mh);
  // Land mass: the coast polygon plus the island.
  ctx.fillStyle = '#5d9153';
  ctx.beginPath();
  ctx.moveTo(px(0), py(0));
  for (let y = 0; y <= WORLD.height; y += 120) ctx.lineTo(px(coastX(y)), py(y));
  ctx.lineTo(px(0), py(WORLD.height));
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px(WORLD.island.x), py(WORLD.island.y), WORLD.island.r * sx, 0, Math.PI * 2);
  ctx.fill();
  // Roads.
  ctx.strokeStyle = 'rgba(230,228,210,0.55)';
  ctx.lineWidth = 1;
  for (const [a, b] of G.city.edges) {
    const na = G.city.nodes[a], nb = G.city.nodes[b];
    ctx.beginPath();
    ctx.moveTo(px(na.x), py(na.y));
    ctx.lineTo(px(nb.x), py(nb.y));
    ctx.stroke();
  }
  // GPS route to the objective.
  const obj = G.objective || G.sideObjective;
  if (obj) {
    const route = gpsRoute(G, obj);
    if (route) {
      ctx.strokeStyle = '#ffd23c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      route.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(px(pt.x), py(pt.y));
        else ctx.lineTo(px(pt.x), py(pt.y));
      });
      ctx.stroke();
    }
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath();
    ctx.arc(px(obj.x), py(obj.y), 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police blips.
  ctx.fillStyle = '#5a8cff';
  for (const v of G.vehicles) {
    if (v.driver !== 'police') continue;
    ctx.fillRect(px(v.x) - 1.5, py(v.y) - 1.5, 3, 3);
  }
  // Player arrow.
  const p = G.player;
  ctx.translate(px(p.x), py(p.y));
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -3.6);
  ctx.lineTo(-4, 3.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  roundRect(ctx, x0, y0, mw, mh, 10);
  ctx.stroke();
}

function gpsRoute(G, obj) {
  const key = Math.round(obj.x) + ',' + Math.round(obj.y);
  gpsCache.t -= 1 / 60;
  if (gpsCache.key === key && gpsCache.t > 0 && gpsCache.route) return gpsCache.route;
  gpsCache.key = key;
  gpsCache.t = 0.6;
  // Water objectives get a straight line; land ones follow the roads.
  const p = G.player;
  gpsCache.route = G.city.route(p.x, p.y, obj.x, obj.y);
  return gpsCache.route;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
