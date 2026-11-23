// effects.js — the short-lived sights of the city: tyre smoke, skid marks,
// splashes, muzzle flashes, sparks, floating cash text, and the sky itself —
// the day/night palette and the weather that rolls over the bay. Particles
// live in capped arrays so a long session never grows without bound.

import { clamp, lerp } from './random.js';

const MAX_PARTICLES = 900;
const MAX_SKIDS = 700;

export function createEffects() {
  const particles = [];
  const skids = [];
  const texts = [];

  function spawn(p) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push(p);
  }

  return {
    particles,
    skids,
    texts,
    smoke(x, y, big) {
      spawn({ kind: 'smoke', x, y, vx: (Math.random() - 0.5) * 22, vy: -18 - Math.random() * 22, life: 0, ttl: 0.9 + Math.random() * 0.7, size: big ? 15 : 9 });
    },
    fire(x, y) {
      spawn({ kind: 'fire', x, y, vx: (Math.random() - 0.5) * 16, vy: -34 - Math.random() * 26, life: 0, ttl: 0.4 + Math.random() * 0.3, size: 10 });
    },
    spark(x, y, angle) {
      for (let i = 0; i < 5; i++) {
        const a = angle + (Math.random() - 0.5) * 1.6;
        const sp = 90 + Math.random() * 190;
        spawn({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, ttl: 0.22 + Math.random() * 0.2, size: 2.4 });
      }
    },
    splash(x, y, n) {
      for (let i = 0; i < (n || 8); i++) {
        spawn({ kind: 'splash', x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 10, vx: (Math.random() - 0.5) * 130, vy: -40 - Math.random() * 120, life: 0, ttl: 0.5 + Math.random() * 0.3, size: 3 });
      }
    },
    wake(x, y, angle) {
      spawn({ kind: 'wake', x: x - Math.cos(angle) * 20, y: y - Math.sin(angle) * 20, vx: -Math.cos(angle) * 26, vy: -Math.sin(angle) * 26, life: 0, ttl: 1.15, size: 13 });
    },
    muzzle(x, y, angle) {
      spawn({ kind: 'muzzle', x: x + Math.cos(angle) * 20, y: y + Math.sin(angle) * 20, vx: 0, vy: 0, life: 0, ttl: 0.05, size: 13, angle });
    },
    skid(x, y) {
      skids.push({ x, y, life: 0 });
      if (skids.length > MAX_SKIDS) skids.splice(0, skids.length - MAX_SKIDS);
    },
    text(x, y, str, color) {
      texts.push({ x, y, str, color: color || '#a3e635', life: 0 });
      if (texts.length > 14) texts.shift();
    },
    update(dt) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.ttl) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'splash') p.vy += 420 * dt;
        if (p.kind === 'smoke' || p.kind === 'fire') p.size += 13 * dt;
      }
      for (let i = skids.length - 1; i >= 0; i--) {
        skids[i].life += dt;
        if (skids[i].life > 26) skids.splice(i, 1);
      }
      for (let i = texts.length - 1; i >= 0; i--) {
        texts[i].life += dt;
        texts[i].y -= 34 * dt;
        if (texts[i].life > 1.4) texts.splice(i, 1);
      }
    },
  };
}

// ---- The sky -------------------------------------------------------------
// Keyframes over 24 hours: [hour, sky tint darkness 0..1, warmth of light].
const SKY_KEYS = [
  [0.0, 0.88, 0.1],
  [5.0, 0.85, 0.12],
  [6.5, 0.45, 0.75],
  [8.0, 0.08, 0.35],
  [12.0, 0.0, 0.3],
  [16.5, 0.06, 0.45],
  [18.2, 0.38, 1.0],
  [19.6, 0.72, 0.55],
  [21.0, 0.88, 0.12],
  [24.0, 0.88, 0.1],
];

export function skyAt(hour) {
  let a = SKY_KEYS[0];
  let b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i + 1 < SKY_KEYS.length; i++) {
    if (hour >= SKY_KEYS[i][0] && hour <= SKY_KEYS[i + 1][0]) {
      a = SKY_KEYS[i];
      b = SKY_KEYS[i + 1];
      break;
    }
  }
  const t = b[0] === a[0] ? 0 : (hour - a[0]) / (b[0] - a[0]);
  return {
    dark: lerp(a[1], b[1], t),
    warm: lerp(a[2], b[2], t),
  };
}

export function isNight(hour) {
  return skyAt(hour).dark > 0.55;
}

// ---- Weather ---------------------------------------------------------------
// Weather drifts between clear, haze, rain and storm on its own clock; the
// renderer reads intensity for rain streaks and the audio-less thunder flash.
export function createWeather(rng) {
  const kinds = ['clear', 'clear', 'haze', 'clear', 'rain', 'haze', 'storm', 'rain'];
  let current = 'clear';
  let timer = 50;
  let flash = 0;
  return {
    get kind() {
      return current;
    },
    get rain() {
      return current === 'rain' ? 0.65 : current === 'storm' ? 1 : 0;
    },
    get flash() {
      return flash;
    },
    force(kind) {
      current = kind;
      timer = 9999;
    },
    update(dt) {
      timer -= dt;
      if (flash > 0) flash = Math.max(0, flash - dt * 3);
      if (current === 'storm' && rng.chance(dt * 0.25)) flash = 1;
      if (timer <= 0) {
        current = rng.pick(kinds);
        timer = rng.range(45, 110);
      }
    },
  };
}

export function formatClock(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + ':' + String(m).padStart(2, '0') + ' ' + suffix;
}

export { clamp };
