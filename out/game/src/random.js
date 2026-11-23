// random.js — a seeded RNG plus the small math helpers every system shares.
// The city is generated from a fixed seed so Solstice Bay is the same city on
// every visit (and in every screenshot).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rng = mulberry32(0x501571ce);

export function rand(a, b) {
  if (a === undefined) return rng();
  if (b === undefined) { b = a; a = 0; }
  return a + rng() * (b - a);
}

export function randInt(a, b) {
  return Math.floor(rand(a, b + 1));
}

export function choice(list) {
  return list[Math.floor(rng() * list.length)];
}

export function chance(p) {
  return rng() < p;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function dist2(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  return dx * dx + dy * dy;
}

export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

// Shortest signed difference from a to b, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function turnToward(angle, target, maxStep) {
  const d = angleDiff(angle, target);
  if (Math.abs(d) <= maxStep) return target;
  return angle + Math.sign(d) * maxStep;
}

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// Push a circle out of a rect; returns the corrected [x, y] or null if outside.
export function circleRectResolve(x, y, radius, r) {
  const nx = clamp(x, r.x, r.x + r.w);
  const ny = clamp(y, r.y, r.y + r.h);
  const dx = x - nx, dy = y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 > radius * radius) return null;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    return [nx + (dx / d) * radius, ny + (dy / d) * radius];
  }
  // Centre inside the rect: push out along the smallest exit.
  const left = x - r.x, right = r.x + r.w - x, top = y - r.y, bot = r.y + r.h - y;
  const m = Math.min(left, right, top, bot);
  if (m === left) return [r.x - radius, y];
  if (m === right) return [r.x + r.w + radius, y];
  if (m === top) return [x, r.y - radius];
  return [x, r.y + r.h + radius];
}

export function fmtMoney(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}
