// Solstice Heat: Neon Tide — random.js
// Seeded RNG (mulberry32) + helpers + value noise. Deterministic per seed.
window.SH = window.SH || {};
SH.random = (function () {
  'use strict';
  var state = 1234567;
  function seed(n) { state = (n >>> 0) || 1; }
  function next() {
    state |= 0; state = (state + 0x6D2B79F5) | 0;
    var t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function range(a, b) { return a + next() * (b - a); }
  function int(a, b) { return Math.floor(range(a, b + 1)); }
  function chance(p) { return next() < p; }
  function choice(arr) { return arr[Math.floor(next() * arr.length) % arr.length]; }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(next() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  // Deterministic 2D value noise (hash based, seed independent of stream).
  function hash2(x, y) {
    var h = Math.sin(x * 127.1 + y * 311.7 + 74.7) * 43758.5453;
    return h - Math.floor(h);
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function noise2(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    var u = smooth(xf), v = smooth(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct) {
    var s = 0, amp = 0.5, f = 1;
    for (var i = 0; i < (oct || 3); i++) { s += amp * noise2(x * f, y * f); amp *= 0.5; f *= 2.03; }
    return s;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist2(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
  function angleLerp(a, b, t) {
    var d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }
  return { seed: seed, next: next, range: range, int: int, chance: chance, choice: choice, shuffle: shuffle, noise2: noise2, fbm: fbm, clamp: clamp, lerp: lerp, dist2: dist2, angleLerp: angleLerp };
})();
