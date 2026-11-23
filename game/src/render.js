// render.js — the world on canvas. A top-down camera follows Jax (leading
// him by his velocity), and the bay is painted in layers: water, sand and
// shore, streets, the marina piers and causeway, buildings lifted into
// pseudo-3D by their floor count, palms and lamps, then vehicles, people,
// particles and weather. After dark a blue wash goes over everything and
// the lights — lamps, headlights, neon windows — are punched back through
// it, which is where the Neon Tide name earns its keep.

import { WORLD, ISLAND, MARINA, NEON } from './config.js';
import { skyAt, isNight } from './effects.js';
import { coastX, isWater, AVENUES, STREETS, AVENUE_W, STREET_W } from './city.js';
import { hash2, clamp, lerp } from './random.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function draw(G) {
    const cam = computeCamera(G, W, H);
    G.cam = cam;
    G.view = { w: W, h: H };
    const sky = skyAt(G.hour);
    const night = isNight(G.hour);
    ctx.fillStyle = mix('#0d2f4a', '#050914', sky.dark);
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    const view = {
      x0: cam.x - W / 2 / cam.zoom - 80,
      y0: cam.y - H / 2 / cam.zoom - 80,
      x1: cam.x + W / 2 / cam.zoom + 80,
      y1: cam.y + H / 2 / cam.zoom + 80,
    };

    drawWater(G, view, sky);
    drawLand(G, view, sky);
    drawRoads(G, view, sky);
    drawPiers(G, view);
    drawSkids(G, view);
    drawSites(G);
    drawShells(G);
    drawMarkers(G);
    drawPalms(G, view);
    drawBuildings(G, view, sky);
    for (const v of G.vehicles) if (inView(v.x, v.y, view, 120)) drawVehicle(G, v, night);
    for (const ped of G.peds) if (inView(ped.x, ped.y, view, 40)) drawPed(G, ped);
    for (const o of G.police.officers) if (inView(o.x, o.y, view, 40)) drawPed(G, o);
    if (!G.player.vehicle) drawPlayer(G);
    drawParticles(G, view);
    ctx.restore();

    if (sky.dark > 0.04) {
      ctx.fillStyle = 'rgba(8,12,44,' + (sky.dark * 0.5) + ')';
      ctx.fillRect(0, 0, W, H);
      drawLights(G, cam, night);
    }
    if (G.weather.flash > 0) {
      ctx.fillStyle = 'rgba(220,230,255,' + G.weather.flash * 0.35 + ')';
      ctx.fillRect(0, 0, W, H);
    }
    drawRain(G, W, H);
    drawTexts(G, cam);
  }

  return { draw, resize, get w() { return W; }, get h() { return H; }, ctx };
}

function computeCamera(G, W, H) {
  if (G.cameraOverride) return G.cameraOverride;
  const p = G.player;
  const vx = p.vehicle ? p.vehicle.vx : 0;
  const vy = p.vehicle ? p.vehicle.vy : 0;
  return {
    x: clamp(p.x + vx * 0.42, W / 2 - 200, WORLD.w - W / 2 + 200),
    y: clamp(p.y + vy * 0.42, H / 2 - 150, WORLD.h - H / 2 + 150),
    zoom: p.vehicle ? 0.92 : 1.05,
  };
}

function inView(x, y, v, pad) {
  return x > v.x0 - pad && x < v.x1 + pad && y > v.y0 - pad && y < v.y1 + pad;
}

function mix(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const r = Math.round(lerp(a >> 16, b >> 16, t));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
}

function drawWater(G, view, sky) {
  const ctx = G.ctx;
  ctx.fillStyle = mix('#17648c', '#071c33', sky.dark);
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  // Slow swell lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const t = performance.now() / 900;
  for (let y = Math.floor(view.y0 / 90) * 90; y < view.y1; y += 90) {
    for (let x = Math.max(coastX(y) + 30, Math.floor(view.x0 / 140) * 140); x < view.x1; x += 140) {
      if (!isWater(x, y)) continue;
      const off = Math.sin(t + (x + y) * 0.01) * 7;
      ctx.moveTo(x + off, y);
      ctx.lineTo(x + 44 + off, y);
    }
  }
  ctx.stroke();
}

function drawLand(G, view, sky) {
  const ctx = G.ctx;
  // The mainland: urban ground west of the shore.
  ctx.fillStyle = mix('#5c6058', '#23272b', sky.dark);
  ctx.beginPath();
  ctx.moveTo(view.x0, view.y0);
  for (let y = view.y0; y <= view.y1; y += 40) ctx.lineTo(coastX(y), y);
  ctx.lineTo(view.x0, view.y1);
  ctx.closePath();
  ctx.fill();
  // Sand along the waterline.
  ctx.strokeStyle = mix('#d9bd8a', '#4d4230', sky.dark);
  ctx.lineWidth = 74;
  ctx.beginPath();
  for (let y = view.y0; y <= view.y1; y += 40) {
    const x = coastX(y) - 30;
    if (y === view.y0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Lighthouse Isle.
  ctx.fillStyle = mix('#6a7263', '#2a2f28', sky.dark);
  ctx.beginPath();
  ctx.arc(ISLAND.x, ISLAND.y, ISLAND.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = mix('#d9bd8a', '#4d4230', sky.dark);
  ctx.lineWidth = 26;
  ctx.stroke();
  // The lighthouse itself.
  const lh = G.city.lighthouse;
  ctx.fillStyle = '#e8e4da';
  ctx.fillRect(lh.x - 11, lh.y - 11, 22, 22);
  ctx.fillStyle = '#c22f4e';
  ctx.fillRect(lh.x - 11, lh.y - 4, 22, 7);
  // The causeway.
  ctx.fillStyle = mix('#7a7d80', '#33363a', sky.dark);
  ctx.fillRect(coastX(ISLAND.y) - 30, ISLAND.y - 30, ISLAND.x - coastX(ISLAND.y) + 30, 60);
}

function drawRoads(G, view, sky) {
  const ctx = G.ctx;
  ctx.fillStyle = mix('#3c3f45', '#1d1f24', sky.dark);
  for (const a of AVENUES) ctx.fillRect(a - AVENUE_W / 2, view.y0, AVENUE_W, view.y1 - view.y0);
  for (const s of STREETS) {
    const end = coastX(s) + 10;
    ctx.fillRect(view.x0, s - STREET_W / 2, end - view.x0, STREET_W);
  }
  // The shore drive.
  ctx.strokeStyle = mix('#3c3f45', '#1d1f24', sky.dark);
  ctx.lineWidth = 92;
  ctx.beginPath();
  for (let y = view.y0; y <= view.y1; y += 40) {
    const x = coastX(y) - 130;
    if (y === view.y0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Centre dashes.
  ctx.strokeStyle = 'rgba(250,204,21,0.5)';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (const a of AVENUES) {
    ctx.moveTo(a, view.y0);
    ctx.lineTo(a, view.y1);
  }
  for (const s of STREETS) {
    ctx.moveTo(view.x0, s);
    ctx.lineTo(coastX(s), s);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPiers(G, view) {
  const ctx = G.ctx;
  ctx.fillStyle = '#7d6248';
  for (const py of MARINA.pierYs) {
    const x0 = coastX(py) - 26;
    ctx.fillRect(x0, py - 15, MARINA.pierLen + 26, 30);
    ctx.fillStyle = '#6b5138';
    for (let x = x0 + 12; x < x0 + MARINA.pierLen; x += 30) ctx.fillRect(x, py - 15, 3, 30);
    ctx.fillStyle = '#7d6248';
  }
}

function drawSkids(G, view) {
  const ctx = G.ctx;
  ctx.fillStyle = 'rgba(12,12,14,0.5)';
  for (const s of G.fx.skids) {
    if (!inView(s.x, s.y, view, 10)) continue;
    ctx.globalAlpha = Math.max(0, 0.55 - s.life / 40);
    ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
  }
  ctx.globalAlpha = 1;
}

const SITE_STYLE = {
  garage: ['#fb923c', 'G'],
  clinic: ['#4ade80', '+'],
  armoury: ['#f87171', 'A'],
  marisol: ['#facc15', 'M'],
  hideout: ['#93c5fd', 'H'],
};

function drawSites(G) {
  const ctx = G.ctx;
  for (const [key, site] of Object.entries(G.city.sites)) {
    const [color, letter] = SITE_STYLE[key];
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(site.x, site.y, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = 'bold 21px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(letter, site.x, site.y - 10);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(site.label, site.x, site.y + 40);
    ctx.textAlign = 'left';
  }
  // Marisol's marker breathes when she has work.
  const start = G.missions.startMarker(G);
  if (start) {
    const r = 44 + Math.sin(performance.now() / 260) * 7;
    ctx.strokeStyle = 'rgba(250,204,21,0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(start.x, start.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawShells(G) {
  const ctx = G.ctx;
  for (const s of G.city.shells) {
    if (s.taken) continue;
    const bob = Math.sin(performance.now() / 500 + s.x) * 2;
    ctx.fillStyle = '#fdf2f8';
    ctx.beginPath();
    ctx.arc(s.x, s.y + bob, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y + bob, 3.6, 0.4, 4.6);
    ctx.stroke();
  }
}

function drawMarkers(G) {
  const ctx = G.ctx;
  const t = performance.now() / 1000;
  const draw = (m, color) => {
    if (!m) return;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 26 + Math.sin(t * 4) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = color;
    ctx.fillRect(m.x - 13, m.y - 700, 26, 700);
    ctx.globalAlpha = 1;
  };
  const obj = G.missions.objective();
  if (obj) draw(obj.marker, '#fb923c');
  draw(G.sidejobs.marker(), '#4ade80');
}

function drawPalms(G, view) {
  const ctx = G.ctx;
  for (const p of G.city.palms) {
    if (!inView(p.x, p.y, view, 40)) continue;
    ctx.strokeStyle = '#6b5138';
    ctx.lineWidth = 4 * p.s;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 5 * p.s, p.y - 15 * p.s);
    ctx.stroke();
    ctx.strokeStyle = '#3f7d3a';
    ctx.lineWidth = 3 * p.s;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + p.x;
      ctx.beginPath();
      ctx.moveTo(p.x + 5 * p.s, p.y - 15 * p.s);
      ctx.quadraticCurveTo(
        p.x + 5 * p.s + Math.cos(a) * 13 * p.s, p.y - 15 * p.s + Math.sin(a) * 6 * p.s - 3,
        p.x + 5 * p.s + Math.cos(a) * 20 * p.s, p.y - 15 * p.s + Math.sin(a) * 10 * p.s + 5,
      );
      ctx.stroke();
    }
  }
}

function drawBuildings(G, view, sky) {
  const ctx = G.ctx;
  for (const b of G.city.buildings) {
    if (!inView(b.x + b.w / 2, b.y + b.h / 2, view, Math.max(b.w, b.h))) continue;
    const lift = b.floors * 1.35;
    // Shadow, then the side wall, then the roof — the poor man's 3D.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = mix(shade(b.tone, 0.62), '#14161c', sky.dark);
    ctx.fillRect(b.x, b.y - lift, b.w, b.h + lift);
    ctx.fillStyle = mix(b.roof, '#1a1c22', sky.dark);
    ctx.fillRect(b.x + 3, b.y - lift + 3, b.w - 6, b.h - 6);
    // Windows: a hash-lit grid; after dark some burn neon.
    const cols = Math.max(2, Math.floor(b.w / 17));
    const rows = Math.max(2, Math.floor(b.h / 15));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        const h1 = hash2(b.seed + cx * 31, cy * 57);
        const lit = sky.dark > 0.4 ? h1 > 0.52 : h1 > 0.86;
        if (!lit) continue;
        const wx = b.x + 6 + cx * ((b.w - 10) / cols);
        const wy = b.y - lift + 6 + cy * ((b.h - 10) / rows);
        ctx.fillStyle = sky.dark > 0.4
          ? (h1 > 0.93 ? NEON[Math.floor(h1 * 997) % NEON.length] : 'rgba(255,214,130,0.9)')
          : 'rgba(230,240,250,0.55)';
        ctx.fillRect(wx, wy, 5.5, 7);
      }
    }
  }
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round((n >> 16) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function drawVehicle(G, v, night) {
  const ctx = G.ctx;
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.angle);
  const L = v.def.len;
  const Wd = v.def.wid;
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fillRect(-L / 2 + 3, -Wd / 2 + 5, L, Wd);
  if (v.kind === 'boat') {
    ctx.fillStyle = v.color;
    ctx.beginPath();
    ctx.moveTo(L / 2, 0);
    ctx.lineTo(L / 4, -Wd / 2);
    ctx.lineTo(-L / 2, -Wd / 2 + 3);
    ctx.lineTo(-L / 2, Wd / 2 - 3);
    ctx.lineTo(L / 4, Wd / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(20,26,34,0.85)';
    ctx.fillRect(-L * 0.08, -Wd * 0.26, L * 0.3, Wd * 0.52);
  } else {
    ctx.fillStyle = v.dead ? '#2c2c30' : v.color;
    roundRectPath(ctx, -L / 2, -Wd / 2, L, Wd, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(16,20,28,0.9)';
    roundRectPath(ctx, -L * 0.12, -Wd * 0.4, L * 0.34, Wd * 0.8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(190,225,245,0.75)';
    ctx.fillRect(L * 0.2, -Wd * 0.36, 3.4, Wd * 0.72);
    if (v.type === 'taxi') {
      ctx.fillStyle = '#141414';
      ctx.fillRect(-6, -5, 12, 10);
      ctx.fillStyle = '#f2b705';
      ctx.font = 'bold 7px system-ui';
      ctx.fillText('TAXI', -8, 2.5);
    }
    if (v.type === 'interceptor') {
      const flash = Math.floor(performance.now() / 240) % 2 === 0;
      ctx.fillStyle = flash ? '#ef4444' : '#3b82f6';
      ctx.fillRect(-9, -Wd / 2 + 2, 8, 5);
      ctx.fillStyle = flash ? '#3b82f6' : '#ef4444';
      ctx.fillRect(1, -Wd / 2 + 2, 8, 5);
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-L / 2 + 4, -Wd * 0.3, L * 0.2, Wd * 0.6);
    }
    if (v.wanted) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.4;
      roundRectPath(ctx, -L / 2 - 4, -Wd / 2 - 4, L + 8, Wd + 8, 8);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPed(G, p) {
  const ctx = G.ctx;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.state === 'down') {
    ctx.rotate(p.angle);
    ctx.fillStyle = p.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(13, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.arc(1.5, 2.5, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 8.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(0, 0, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = p.shirt;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(p.angle) * 9, Math.sin(p.angle) * 9);
  ctx.stroke();
  if (p.hostile) {
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, 12.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer(G) {
  const p = G.player;
  const ctx = G.ctx;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(2, 3, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0e7490';
  ctx.beginPath();
  ctx.arc(0, 0, 9.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0e7490';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(p.angle) * 10, Math.sin(p.angle) * 10);
  ctx.stroke();
  if (p.weapon === 'pistol') {
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(p.angle) * 8, Math.sin(p.angle) * 8);
    ctx.lineTo(Math.cos(p.angle) * 17, Math.sin(p.angle) * 17);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(G, view) {
  const ctx = G.ctx;
  for (const pt of G.fx.particles) {
    if (!inView(pt.x, pt.y, view, 30)) continue;
    const lifeFrac = 1 - pt.life / pt.ttl;
    if (pt.kind === 'smoke') {
      ctx.fillStyle = 'rgba(70,70,76,' + (lifeFrac * 0.5) + ')';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.kind === 'fire') {
      ctx.fillStyle = 'rgba(249,115,22,' + lifeFrac + ')';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * lifeFrac, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.kind === 'spark') {
      ctx.strokeStyle = 'rgba(253,224,71,' + lifeFrac + ')';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x - pt.vx * 0.03, pt.y - pt.vy * 0.03);
      ctx.stroke();
    } else if (pt.kind === 'splash') {
      ctx.fillStyle = 'rgba(186,230,253,' + lifeFrac + ')';
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    } else if (pt.kind === 'wake') {
      ctx.strokeStyle = 'rgba(230,246,255,' + (lifeFrac * 0.5) + ')';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size + pt.life * 22, 0, Math.PI * 2);
      ctx.stroke();
    } else if (pt.kind === 'muzzle') {
      ctx.fillStyle = 'rgba(253,186,34,0.95)';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// After the night wash: lamp pools, headlight cones, the lighthouse beam.
function drawLights(G, cam, night) {
  if (!night) return;
  const ctx = G.ctx;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const toScreen = (x, y) => ({ x: (x - cam.x) * cam.zoom + G.view.w / 2, y: (y - cam.y) * cam.zoom + G.view.h / 2 });
  for (const lamp of G.city.lamps) {
    const s = toScreen(lamp.x, lamp.y);
    if (s.x < -70 || s.y < -70 || s.x > G.view.w + 70 || s.y > G.view.h + 70) continue;
    const g = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, 52 * cam.zoom);
    g.addColorStop(0, 'rgba(255,196,90,0.20)');
    g.addColorStop(1, 'rgba(255,196,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(s.x - 55 * cam.zoom, s.y - 55 * cam.zoom, 110 * cam.zoom, 110 * cam.zoom);
  }
  for (const v of G.vehicles) {
    if (v.kind !== 'car' || v.dead) continue;
    const s = toScreen(v.x, v.y);
    if (s.x < -160 || s.y < -160 || s.x > G.view.w + 160 || s.y > G.view.h + 160) continue;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(v.angle);
    ctx.scale(cam.zoom, cam.zoom);
    const g = ctx.createLinearGradient(20, 0, 165, 0);
    g.addColorStop(0, 'rgba(255,240,190,0.16)');
    g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(20, -9);
    ctx.lineTo(165, -34);
    ctx.lineTo(165, 34);
    ctx.lineTo(20, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // The lighthouse beam sweeps the bay.
  const lh = G.city.lighthouse;
  const s = toScreen(lh.x, lh.y);
  const beamAngle = performance.now() / 2600;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(beamAngle);
  ctx.scale(cam.zoom, cam.zoom);
  const g = ctx.createLinearGradient(0, 0, 620, 0);
  g.addColorStop(0, 'rgba(255,250,210,0.20)');
  g.addColorStop(1, 'rgba(255,250,210,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(620, -52);
  ctx.lineTo(620, 52);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawRain(G, W, H) {
  const rain = G.weather.rain;
  if (!rain) return;
  const ctx = G.ctx;
  ctx.strokeStyle = 'rgba(174,194,224,' + (0.25 + rain * 0.3) + ')';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const n = Math.floor(130 * rain);
  const t = performance.now() / 16;
  for (let i = 0; i < n; i++) {
    const x = ((i * 173.3 + t * 9) % (W + 60)) - 30;
    const y = ((i * 269.7 + t * 26) % (H + 40)) - 20;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3.4, y + 13);
  }
  ctx.stroke();
}

function drawTexts(G, cam) {
  const ctx = G.ctx;
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const t of G.fx.texts) {
    const sx = (t.x - cam.x) * cam.zoom + G.view.w / 2;
    const sy = (t.y - cam.y) * cam.zoom + G.view.h / 2;
    ctx.globalAlpha = Math.max(0, 1 - t.life / 1.4);
    ctx.fillStyle = t.color;
    ctx.fillText(t.str, sx, sy);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
