// render.js — draws Solstice Bay: the bay, the sand, the road graph, the
// buildings with their dusk windows, every vehicle and person, and the
// light of whatever hour G.hour says it is. The camera follows the player;
// everything is culled to the view.

import { WORLD, COLORS } from './config.js';
import { clamp, dist } from './random.js';
import { coastX, PIERS, POIS, ROAD_HALF } from './city.js';

export function dayFactor(hour) {
  // 1 at midday, 0 through the night; the sun is up from 06:00 to 20:00,
  // so 17:00 is still afternoon and 18:30 is golden hour, not midnight.
  const t = Math.sin(((hour - 6) / 14) * Math.PI);
  return clamp(t, 0, 1);
}

export function render(G, ctx, W, H) {
  const cam = G.camera;
  const view = { x: cam.x - 90, y: cam.y - 90, w: W + 180, h: H + 180 };
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  drawWater(G, ctx, view);
  drawLand(G, ctx, view);
  drawRoads(G, ctx, view);
  drawShellsAndPois(G, ctx, view);
  drawSkids(G, ctx);
  drawBuildings(G, ctx, view);
  drawTrees(G, ctx, view);
  drawVehicles(G, ctx, view);
  drawPeople(G, ctx, view);
  drawObjectiveBeacon(G, ctx);
  drawParticles(G, ctx);
  drawTexts(G, ctx);

  ctx.restore();
  drawLighting(G, ctx, W, H);
  drawWeather(G, ctx, W, H);

  if (G.fx.flashRed > 0) {
    ctx.fillStyle = 'rgba(200,30,30,' + (G.fx.flashRed * 0.28) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

function inView(view, x, y, pad) {
  return x > view.x - pad && x < view.x + view.w + pad && y > view.y - pad && y < view.y + view.h + pad;
}

function drawWater(G, ctx, view) {
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  // Lazy wave strokes drifting with time.
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const y = view.y + ((i * 173 + G.time * 22) % view.h);
    const x = view.x + ((i * 389) % view.w);
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 26, y - 7, x + 52, y);
  }
  ctx.stroke();
  // Deep patch east.
  ctx.fillStyle = 'rgba(6,50,90,0.35)';
  ctx.fillRect(Math.max(view.x, 4150), view.y, view.w, view.h);
}

function drawLand(G, ctx, view) {
  // Mainland: grass with a sand rim along the coast path.
  ctx.beginPath();
  ctx.moveTo(view.x - 60, -60);
  for (let y = -60; y <= WORLD.height + 60; y += 60) {
    ctx.lineTo(coastX(y), y);
  }
  ctx.lineTo(view.x - 60, WORLD.height + 60);
  ctx.closePath();
  ctx.fillStyle = COLORS.grass;
  ctx.fill();
  ctx.strokeStyle = COLORS.sand;
  ctx.lineWidth = WORLD.beachWidth * 2;
  ctx.beginPath();
  for (let y = -60; y <= WORLD.height + 60; y += 60) {
    const x = coastX(y);
    if (y === -60) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Lighthouse Isle.
  ctx.fillStyle = COLORS.grass;
  ctx.beginPath();
  ctx.arc(WORLD.island.x, WORLD.island.y, WORLD.island.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.sand;
  ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.arc(WORLD.island.x, WORLD.island.y, WORLD.island.r - 8, 0, Math.PI * 2);
  ctx.stroke();
  // Marina piers.
  ctx.fillStyle = COLORS.pier;
  for (const p of PIERS) {
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = p.x + 22; x < p.x + p.w; x += 44) ctx.fillRect(x, p.y, 3, p.h);
    ctx.fillStyle = COLORS.pier;
  }
}

function drawRoads(G, ctx, view) {
  // Sidewalk underlay, asphalt, then centre dashes — all from the graph.
  for (const pass of [0, 1, 2]) {
    ctx.beginPath();
    for (const [a, b] of G.city.edges) {
      const na = G.city.nodes[a], nb = G.city.nodes[b];
      if (!inView(view, (na.x + nb.x) / 2, (na.y + nb.y) / 2, 420)) continue;
      ctx.moveTo(na.x, na.y);
      ctx.lineTo(nb.x, nb.y);
    }
    if (pass === 0) { ctx.strokeStyle = COLORS.sidewalk; ctx.lineWidth = ROAD_HALF * 2 + 16; }
    if (pass === 1) { ctx.strokeStyle = COLORS.road; ctx.lineWidth = ROAD_HALF * 2; }
    if (pass === 2) {
      ctx.strokeStyle = 'rgba(232,227,200,0.5)';
      ctx.lineWidth = 2.4;
      ctx.setLineDash([18, 22]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // The causeway deck reads as a bridge over the bay.
  ctx.fillStyle = '#4a4f57';
  const cwY = WORLD.causewayY;
  ctx.fillRect(coastX(cwY) - 40, cwY - ROAD_HALF, WORLD.island.x - coastX(cwY) + 60, ROAD_HALF * 2);
}

function drawShellsAndPois(G, ctx, view) {
  for (const s of G.city.shells) {
    if (s.taken || !inView(view, s.x, s.y, 30)) continue;
    const pulse = 1 + Math.sin(G.time * 4 + s.id) * 0.25;
    ctx.fillStyle = '#fff3c9';
    ctx.strokeStyle = '#d9a441';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 6.5 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  for (const poi of POIS) {
    if (!inView(view, poi.x, poi.y, 60)) continue;
    const bob = Math.sin(G.time * 2.4) * 3;
    ctx.fillStyle = poi.color;
    ctx.beginPath();
    ctx.arc(poi.x, poi.y - 26 + bob, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10151d';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(poi.letter, poi.x, poi.y - 25 + bob);
    ctx.beginPath();
    ctx.moveTo(poi.x - 5, poi.y - 17 + bob);
    ctx.lineTo(poi.x + 5, poi.y - 17 + bob);
    ctx.lineTo(poi.x, poi.y - 8 + bob);
    ctx.closePath();
    ctx.fillStyle = poi.color;
    ctx.fill();
  }
}

function drawSkids(G, ctx) {
  ctx.fillStyle = 'rgba(20,20,22,0.4)';
  for (const s of G.fx.skids) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.globalAlpha = Math.min(0.4, s.life / 20);
    ctx.fillRect(-7, -2.4, 14, 4.8);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawBuildings(G, ctx, view) {
  const night = dayFactor(G.hour) < 0.35;
  for (const b of G.city.buildings) {
    if (!inView(view, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
    // Shadow + extruded wall give the flat roofs their height.
    const lift = b.height * 0.42;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x - lift * 0.3, b.y + lift * 0.5, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x - lift * 0.3, b.y - lift * 0.22, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(b.x - lift * 0.3, b.y - lift * 0.22, b.w, b.h);
    if (b.lighthouse) {
      ctx.fillStyle = '#e2483d';
      const lx = b.x + b.w / 2 - lift * 0.3, ly = b.y - lift * 0.22;
      ctx.fillRect(lx - 5, ly + 6, 10, 12);
      const beam = 0.5 + 0.5 * Math.sin(G.time * 1.4);
      ctx.fillStyle = 'rgba(255,240,170,' + (0.25 + beam * 0.4) + ')';
      ctx.beginPath();
      ctx.arc(lx, ly + 4, 10 + beam * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Windows: dark by day, lit amber at night.
    ctx.fillStyle = night ? 'rgba(255,196,86,0.95)' : 'rgba(30,42,56,0.5)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        if ((cx * 7 + cy * 13 + b.windows) % 3 === 0) continue;
        if (night && (cx * 5 + cy * 11) % 4 === 0) continue;
        ctx.fillRect(b.x - lift * 0.3 + 8 + cx * 26, b.y - lift * 0.22 + 8 + cy * 26, 9, 12);
      }
    }
    if (b.neon && night) {
      ctx.fillStyle = 'rgba(255,79,163,0.85)';
      ctx.fillRect(b.x - lift * 0.3 + 6, b.y - lift * 0.22 + 4, Math.min(60, b.w - 12), 5);
    }
  }
}

function drawTrees(G, ctx, view) {
  for (const t of G.city.trees) {
    if (!inView(view, t.x, t.y, 40)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2);
    ctx.fill();
    if (t.palm) {
      ctx.strokeStyle = '#7a5c38';
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(t.x + 3, t.y - 7);
      ctx.stroke();
      ctx.strokeStyle = '#3f9142';
      ctx.lineWidth = 2.6;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.moveTo(t.x + 3, t.y - 7);
        ctx.quadraticCurveTo(
          t.x + 3 + Math.cos(a) * t.r * 0.8, t.y - 7 + Math.sin(a) * t.r * 0.8 - 3,
          t.x + 3 + Math.cos(a) * t.r * 1.25, t.y - 7 + Math.sin(a) * t.r * 1.25 + 5);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#3f9142';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#55a856';
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawVehicles(G, ctx, view) {
  for (const v of G.vehicles) {
    if (!inView(view, v.x, v.y, 90)) continue;
    const [len, wid] = v.def.size;
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
    if (v.def.kind === 'boat') {
      ctx.fillStyle = v.wreck ? '#3a3f45' : v.color;
      ctx.beginPath();
      ctx.moveTo(len / 2, 0);
      ctx.lineTo(len / 4, -wid / 2);
      ctx.lineTo(-len / 2, -wid / 2 + 3);
      ctx.lineTo(-len / 2, wid / 2 - 3);
      ctx.lineTo(len / 4, wid / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f4f6f7';
      ctx.fillRect(-len * 0.08, -wid * 0.26, len * 0.3, wid * 0.52);
    } else {
      ctx.fillStyle = v.wreck ? '#33373d' : v.color;
      roundRectPath(ctx, -len / 2, -wid / 2, len, wid, 6);
      ctx.fill();
      // Cabin + glass.
      ctx.fillStyle = 'rgba(16,24,34,0.85)';
      roundRectPath(ctx, -len * 0.1, -wid * 0.38, len * 0.34, wid * 0.76, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(140,190,225,0.5)';
      ctx.fillRect(len * 0.2, -wid * 0.34, len * 0.07, wid * 0.68);
      // Wheels.
      ctx.fillStyle = '#14161a';
      const ww = 7, wh = 4.6;
      ctx.fillRect(-len / 2 + 5, -wid / 2 - 2, ww, wh);
      ctx.fillRect(-len / 2 + 5, wid / 2 - 2.6, ww, wh);
      ctx.fillRect(len / 2 - 12, -wid / 2 - 2, ww, wh);
      ctx.fillRect(len / 2 - 12, wid / 2 - 2.6, ww, wh);
      if (v.def.taxi) {
        ctx.fillStyle = '#14161a';
        ctx.fillRect(-6, -5, 12, 10);
        ctx.fillStyle = '#ffd23c';
        ctx.fillRect(-4.5, -3.5, 9, 7);
      }
      if (v.def.police) {
        ctx.fillStyle = '#f2f4f6';
        ctx.fillRect(-len * 0.32, -wid / 2, len * 0.6, wid);
        ctx.fillStyle = '#14181f';
        ctx.fillRect(-len * 0.3, -wid / 2, len * 0.14, wid);
        ctx.fillRect(len * 0.16, -wid / 2, len * 0.14, wid);
        const phase = Math.floor(v.sirenPhase) % 2;
        ctx.fillStyle = phase ? '#ff3b30' : '#2e7dff';
        ctx.beginPath();
        ctx.arc(-4, 0, 4.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = phase ? '#2e7dff' : '#ff3b30';
        ctx.beginPath();
        ctx.arc(5, 0, 4.4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (v.model === 'truck') {
        ctx.fillStyle = '#59636e';
        ctx.fillRect(-len / 2, -wid / 2, len * 0.62, wid);
        ctx.fillStyle = '#ffd94a';
        ctx.fillRect(-len / 2 + 6, -3, 20, 6);
      }
    }
    ctx.restore();
    // Damage smoke is emitted by physics; a health tick for the player's car
    // is drawn by the HUD. Mission markers:
    if (v.missionMark) drawMarker(ctx, v.x, v.y - 44, v.missionMark, G.time);
  }
}

function drawPeople(G, ctx, view) {
  const drawPerson = (x, y, angle, shirt, skin, cycle, gun) => {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.arc(x + 2, y + 3, 9, 0, Math.PI * 2);
    ctx.fill();
    const step = Math.sin(cycle) * 3;
    ctx.strokeStyle = '#2e3138';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle + 0.5) * (6 + step), y + Math.sin(angle + 0.5) * (6 + step));
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle - 0.5) * (6 - step), y + Math.sin(angle - 0.5) * (6 - step));
    ctx.stroke();
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * 3, y + Math.sin(angle) * 3, 4.6, 0, Math.PI * 2);
    ctx.fill();
    if (gun) {
      ctx.strokeStyle = '#14161a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * 7, y + Math.sin(angle) * 7);
      ctx.lineTo(x + Math.cos(angle) * 16, y + Math.sin(angle) * 16);
      ctx.stroke();
    }
  };

  for (const ped of G.peds) {
    if (!inView(view, ped.x, ped.y, 30)) continue;
    if (ped.state === 'down') {
      ctx.fillStyle = ped.shirt;
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(ped.angle);
      ctx.fillRect(-10, -4.5, 20, 9);
      ctx.restore();
      continue;
    }
    drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.skin, ped.walkCycle, false);
  }
  for (const h of G.hostiles) {
    if (h.health <= 0 || !inView(view, h.x, h.y, 30)) continue;
    drawPerson(h.x, h.y, h.angle, '#2b2f36', h.skin, h.walkCycle, true);
  }
  for (const o of G.officers) {
    if (!inView(view, o.x, o.y, 30)) continue;
    drawPerson(o.x, o.y, o.angle, '#22355e', o.skin || '#e0ac69', o.walkCycle, G.wanted.stars >= 4);
  }
  // Marisol at her club door.
  const mp = POIS[0];
  if (inView(view, mp.x, mp.y, 40)) {
    drawPerson(mp.x, mp.y + 16, Math.PI / 2, '#ff4fa3', '#c68642', G.time * 2, false);
  }
  // The player (not while driving — the car is drawn instead).
  const p = G.player;
  if (!p.vehicle) {
    drawPerson(p.x, p.y, p.angle, '#ffb340', '#e0ac69', p.walkCycle, p.weapon === 'pistol');
  }
}

function drawObjectiveBeacon(G, ctx) {
  const obj = G.objective || G.sideObjective;
  if (!obj || G.state !== 'playing') return;
  const pulse = 1 + Math.sin(G.time * 5) * 0.18;
  ctx.strokeStyle = G.objective ? 'rgba(255,217,74,0.9)' : 'rgba(159,232,112,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(obj.x, obj.y, 26 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = G.objective ? 'rgba(255,217,74,0.16)' : 'rgba(159,232,112,0.16)';
  ctx.beginPath();
  ctx.moveTo(obj.x - 9, obj.y - 120);
  ctx.lineTo(obj.x + 9, obj.y - 120);
  ctx.lineTo(obj.x, obj.y);
  ctx.closePath();
  ctx.fill();
  if (G.missionMarker) drawMarker(ctx, G.missionMarker.x, G.missionMarker.y - 52, 'M', G.time);
}

function drawMarker(ctx, x, y, label, t) {
  const bob = Math.sin(t * 3) * 3;
  ctx.fillStyle = '#ff4fa3';
  ctx.beginPath();
  ctx.arc(x, y + bob, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + bob + 0.5);
}

function drawParticles(G, ctx) {
  for (const pt of G.fx.particles) {
    const a = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTexts(G, ctx) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 14px system-ui, sans-serif';
  for (const t of G.fx.texts) {
    ctx.globalAlpha = clamp(t.life / 1.2, 0, 1);
    ctx.fillStyle = t.color;
    ctx.fillText(t.str, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawLighting(G, ctx, W, H) {
  const df = dayFactor(G.hour);
  const dark = (1 - df) * 0.52;
  if (dark > 0.01) {
    ctx.fillStyle = 'rgba(8,10,38,' + dark.toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
    // Lamp pools and neon bleed, punched back in with 'lighter'.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cam = G.camera;
    for (const lamp of G.city.lamps) {
      const sx = lamp.x - cam.x, sy = lamp.y - cam.y;
      if (sx < -70 || sy < -70 || sx > W + 70 || sy > H + 70) continue;
      const grad = ctx.createRadialGradient(sx, sy, 2, sx, sy, 52);
      grad.addColorStop(0, 'rgba(255,190,90,0.20)');
      grad.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, 52, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  // Golden-hour warmth near dawn and dusk.
  const golden = Math.max(0, 1 - Math.abs(df - 0.45) * 3.2) * 0.12;
  if (golden > 0.01) {
    ctx.fillStyle = 'rgba(255,150,60,' + golden.toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

function drawWeather(G, ctx, W, H) {
  const w = G.weather;
  if (w.kind === 'haze') {
    ctx.fillStyle = 'rgba(230,228,210,0.13)';
    ctx.fillRect(0, 0, W, H);
  }
  if (w.isWet()) {
    ctx.strokeStyle = w.kind === 'storm' ? 'rgba(190,220,255,0.55)' : 'rgba(190,220,255,0.38)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const d of w.rainDrops) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 3, d.y + 13);
    }
    ctx.stroke();
    if (w.kind === 'storm' && Math.random() < 0.006) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(0, 0, W, H);
    }
  }
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
