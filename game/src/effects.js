// effects.js — the juice: particles (sparks, smoke, splashes, muzzle flashes, rain
// handled by the renderer), skid marks that fade slowly, and floating world text
// ("+$250", "BUSTED?" warnings, fare tips). Nothing here knows the rules; it just
// makes actions visible.

import { clamp } from './random.js';

const MAX_PARTS = 700;
const MAX_SKIDS = 1100;

export function createEffects() {
  const parts = [];
  const texts = [];
  const skids = [];

  function spawn(p) {
    if (parts.length >= MAX_PARTS) parts.shift();
    parts.push({ life: 0, maxLife: 0.6, vx: 0, vy: 0, grav: 0, drag: 0, size: 3, shrink: 1, ...p });
  }

  function burst(x, y, { count = 10, color = '#ffd166', speed = 160, size = 3, life = 0.5, grav = 0, drag = 0 } = {}) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, size: size * (0.6 + Math.random() * 0.8), maxLife: life * (0.6 + Math.random() * 0.8), grav, drag });
    }
  }

  return {
    parts, texts, skids,
    sparks(x, y, n = 8) { burst(x, y, { count: n, color: '#ffd166', speed: 220, size: 2.4, life: 0.35 }); },
    smoke(x, y, n = 2, dark = false) {
      for (let i = 0; i < n; i += 1) {
        spawn({ x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 22, vy: -28 - Math.random() * 26, color: dark ? 'rgba(40,40,46,0.5)' : 'rgba(200,200,205,0.45)', size: 7 + Math.random() * 7, maxLife: 0.9 + Math.random() * 0.7, shrink: -0.6 });
      }
    },
    fire(x, y) {
      burst(x, y, { count: 3, color: Math.random() < 0.5 ? '#ff8c42' : '#ff5d5d', speed: 40, size: 4.5, life: 0.4, grav: -60 });
    },
    splash(x, y, n = 10) { burst(x, y, { count: n, color: '#bfe8f5', speed: 150, size: 2.6, life: 0.55, grav: 320 }); },
    wake(x, y, angle) {
      spawn({ x: x - Math.cos(angle) * 16, y: y - Math.sin(angle) * 16, vx: -Math.cos(angle) * 30 + (Math.random() - 0.5) * 30, vy: -Math.sin(angle) * 30 + (Math.random() - 0.5) * 30, color: 'rgba(220,245,252,0.5)', size: 5 + Math.random() * 4, maxLife: 0.8, shrink: -0.8 });
    },
    muzzle(x, y, angle) {
      burst(x + Math.cos(angle) * 20, y + Math.sin(angle) * 20, { count: 4, color: '#ffe08a', speed: 90, size: 2.6, life: 0.12 });
    },
    blood(x, y) { burst(x, y, { count: 7, color: '#b03046', speed: 110, size: 2.8, life: 0.5, grav: 130 }); },
    confetti(x, y) { burst(x, y, { count: 26, color: ['#ff5da2', '#22d3ee', '#facc15', '#34d399'][Math.floor(Math.random() * 4)], speed: 240, size: 3, life: 0.9, grav: 200 }); },
    addText(x, y, str, color = '#ffffff', size = 17) {
      texts.push({ x, y, str, color, size, life: 0, maxLife: 1.5 });
      if (texts.length > 14) texts.shift();
    },
    addSkid(x, y, angle, strength) {
      skids.push({ x, y, angle, alpha: clamp(strength, 0.08, 0.5), life: 0 });
      if (skids.length > MAX_SKIDS) skids.shift();
    },
    update(dt) {
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const p = parts[i];
        p.life += dt;
        if (p.life >= p.maxLife) { parts.splice(i, 1); continue; }
        p.vy += p.grav * dt;
        if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (let i = texts.length - 1; i >= 0; i -= 1) {
        const t = texts[i];
        t.life += dt;
        t.y -= 26 * dt;
        if (t.life >= t.maxLife) texts.splice(i, 1);
      }
      for (let i = skids.length - 1; i >= 0; i -= 1) {
        skids[i].life += dt;
        if (skids[i].life > 26) skids.splice(i, 1);
      }
    },
    drawWorld(ctx) {
      // Skid marks first, under everything that moves.
      for (const s of skids) {
        const fade = clamp(1 - s.life / 26, 0, 1) * s.alpha;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        ctx.fillStyle = `rgba(22,22,26,${fade.toFixed(3)})`;
        ctx.fillRect(-7, -2.4, 14, 4.8);
        ctx.restore();
      }
      for (const p of parts) {
        const t = 1 - p.life / p.maxLife;
        ctx.globalAlpha = clamp(t + 0.15, 0, 1);
        ctx.fillStyle = p.color;
        const size = Math.max(0.4, p.size * (p.shrink >= 0 ? t * p.shrink + (1 - p.shrink) : 1 - p.shrink * (p.life / p.maxLife)));
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    drawTexts(ctx) {
      ctx.textAlign = 'center';
      for (const t of texts) {
        const a = clamp(1 - t.life / t.maxLife, 0, 1);
        ctx.font = `700 ${t.size}px system-ui, sans-serif`;
        ctx.globalAlpha = a;
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(10,10,18,0.8)';
        ctx.strokeText(t.str, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    },
  };
}
