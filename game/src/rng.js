// ============================================================================
// SOLSTICE HEAT — rng.js
// A tiny seeded PRNG (mulberry32) plus the everyday math helpers the rest of
// the game shares. City generation uses its own seeded instance so the world
// layout is deterministic; gameplay randomness uses SH.rng.
// Round 11: weighted picks (job-type rolls), string seeding (per-run job
// boards) and a couple of extra helpers (sign, smoothstep, money with
// cents-free bank formatting) used by the economy and jobs systems.
// ============================================================================
(function () {
'use strict';
window.SH = window.SH || {};

// mulberry32: fast 32-bit seeded generator, good enough for a city.
function RNG(seed) {
  this.state = (seed >>> 0) || 1;
}
RNG.prototype.next = function () {
  var t = (this.state += 0x6D2B79F5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
RNG.prototype.range = function (min, max) { return min + this.next() * (max - min); };
RNG.prototype.int = function (min, max) { return Math.floor(this.range(min, max + 1)); };
RNG.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length) % arr.length]; };
RNG.prototype.chance = function (p) { return this.next() < p; };
RNG.prototype.shuffle = function (arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(this.next() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
};
// Weighted pick: entries are [value, weight] pairs. Jobs use this so VIP
// rides stay rare and courier runs stay the bread and butter.
RNG.prototype.weighted = function (pairs) {
  var total = 0, i;
  for (i = 0; i < pairs.length; i++) total += pairs[i][1];
  var roll = this.next() * total;
  for (i = 0; i < pairs.length; i++) {
    roll -= pairs[i][1];
    if (roll <= 0) return pairs[i][0];
  }
  return pairs[pairs.length - 1][0];
};
// Seed from a short string (FNV-1a) — handy for naming a run's job board.
RNG.fromString = function (str) {
  var h = 0x811c9dc5;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return new RNG(h >>> 0);
};

SH.RNG = RNG;
// Gameplay-wide generator; main.js reseeds it from the ?seed= parameter.
SH.rng = new RNG(7);

// --- Shared math helpers ---------------------------------------------------
SH.U = {
  clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
  lerp: function (a, b, t) { return a + (b - a) * t; },
  sign: function (v) { return v > 0 ? 1 : (v < 0 ? -1 : 0); },
  smoothstep: function (a, b, v) {
    var t = SH.U.clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  },
  // shortest-path angle lerp, angles in radians
  lerpAngle: function (a, b, t) {
    var d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  },
  angleDiff: function (a, b) {
    var d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  },
  dist2: function (x1, z1, x2, z2) {
    var dx = x2 - x1, dz = z2 - z1;
    return dx * dx + dz * dz;
  },
  dist: function (x1, z1, x2, z2) { return Math.sqrt(SH.U.dist2(x1, z1, x2, z2)); },
  // forward vector for a heading: heading 0 faces +z (south), pi/2 faces +x
  fwdX: function (h) { return Math.sin(h); },
  fwdZ: function (h) { return Math.cos(h); },
  bearing: function (dx, dz) { return Math.atan2(dx, dz); },
  fmtMoney: function (n) {
    var s = String(Math.floor(Math.abs(n)));
    var out = '';
    while (s.length > 3) { out = ',' + s.slice(-3) + out; s = s.slice(0, -3); }
    return (n < 0 ? '-$' : '$') + s + out;
  },
  // Compact distance for HUD objective lines: "132 m" / "1.2 km".
  fmtDist: function (m) {
    if (m >= 1000) return (m / 1000).toFixed(1) + ' km';
    return Math.round(m) + ' m';
  }
};
})();
