// effects.js — the juice: particles, skid marks, floating text, splashes,
// rain and screen shake. Purely visual; nothing here changes game state.

import { rand, clamp } from './random.js';

export class Effects {
  constructor() {
    this.particles = [];
    this.texts = [];
    this.skids = [];       // {x, y, angle, life}
    this.shake = 0;
    this.flashRed = 0;     // damage vignette timer, read by the renderer
  }

  burst(x, y, opts = {}) {
    const n = opts.n || 10;
    const color = opts.color || '#ffd23c';
    const speed = opts.speed || 190;
    const life = opts.life || 0.5;
    const size = opts.size || 3;
    const gravity = opts.gravity || 0;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(speed * 0.3, speed);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(life * 0.5, life), maxLife: life,
        color, size: rand(size * 0.5, size * 1.4), gravity,
      });
    }
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
  }

  sparks(x, y, angle) {
    this.burst(x, y, { n: 9, color: '#ffcf5a', speed: 260, life: 0.35, size: 2.4 });
    this.burst(x, y, { n: 4, color: '#ff7a3c', speed: 150, life: 0.3, size: 3 });
    void angle;
  }

  smoke(x, y, dark) {
    this.particles.push({
      x: x + rand(-4, 4), y: y + rand(-4, 4),
      vx: rand(-12, 12), vy: rand(-46, -22),
      life: rand(0.7, 1.3), maxLife: 1.3,
      color: dark ? 'rgba(40,40,44,0.5)' : 'rgba(200,200,205,0.45)',
      size: rand(6, 12), gravity: -30, grow: true,
    });
  }

  fire(x, y) {
    this.burst(x, y, { n: 3, color: '#ff6a2a', speed: 60, life: 0.4, size: 5 });
    this.burst(x, y, { n: 2, color: '#ffc93c', speed: 40, life: 0.3, size: 4 });
  }

  muzzle(x, y, angle) {
    const mx = x + Math.cos(angle) * 20, my = y + Math.sin(angle) * 20;
    this.burst(mx, my, { n: 5, color: '#ffe98a', speed: 120, life: 0.12, size: 2.6 });
  }

  splash(x, y, big) {
    this.burst(x, y, { n: big ? 22 : 10, color: '#bfe6ff', speed: big ? 240 : 150, life: 0.55, size: 3, gravity: 420 });
  }

  wake(x, y, angle) {
    this.particles.push({
      x: x - Math.cos(angle) * 18, y: y - Math.sin(angle) * 18,
      vx: -Math.cos(angle) * 30 + rand(-14, 14), vy: -Math.sin(angle) * 30 + rand(-14, 14),
      life: rand(0.5, 0.9), maxLife: 0.9,
      color: 'rgba(220,242,255,0.5)', size: rand(4, 8), gravity: 0, grow: true,
    });
  }

  skid(x, y, angle) {
    this.skids.push({ x, y, angle, life: 14 });
    if (this.skids.length > 700) this.skids.splice(0, this.skids.length - 700);
  }

  text(x, y, str, color) {
    this.texts.push({ x, y, str, color: color || '#ffffff', life: 1.6 });
  }

  addShake(amount) {
    this.shake = Math.min(16, this.shake + amount);
  }

  hurtFlash() {
    this.flashRed = Math.max(this.flashRed, 0.55);
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.grow) p.size += 14 * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.skids.length - 1; i >= 0; i--) {
      this.skids[i].life -= dt;
      if (this.skids[i].life <= 0) this.skids.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - dt * 26);
    this.flashRed = Math.max(0, this.flashRed - dt * 1.4);
  }

  shakeOffset() {
    if (this.shake <= 0) return { x: 0, y: 0 };
    return { x: rand(-this.shake, this.shake), y: rand(-this.shake, this.shake) };
  }
}

// Weather: a slow-rolling state machine the renderer and physics both read.
export class Weather {
  constructor() {
    this.kind = 'clear';   // clear | haze | rain | storm
    this.timer = 40;
    this.rainDrops = [];
    for (let i = 0; i < 130; i++) {
      this.rainDrops.push({ x: Math.random() * 1280, y: Math.random() * 720, s: rand(620, 980) });
    }
  }

  update(dt) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = rand(55, 95);
      const roll = Math.random();
      this.kind = roll < 0.45 ? 'clear' : roll < 0.65 ? 'haze' : roll < 0.87 ? 'rain' : 'storm';
    }
    const wet = this.kind === 'rain' || this.kind === 'storm';
    if (wet) {
      const fall = this.kind === 'storm' ? 1.5 : 1;
      for (const d of this.rainDrops) {
        d.y += d.s * fall * dt;
        d.x += 130 * dt;
        if (d.y > 730) { d.y = -10; d.x = Math.random() * 1280; }
      }
    }
  }

  gripFactor() {
    if (this.kind === 'rain') return 0.82;
    if (this.kind === 'storm') return 0.68;
    return 1;
  }

  isWet() {
    return this.kind === 'rain' || this.kind === 'storm';
  }
}

export { clamp };
