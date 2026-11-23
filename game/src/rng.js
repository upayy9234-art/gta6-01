// Solstice Heat - deterministic RNG (mulberry32) and math helpers.
window.SH = window.SH || {};
(function (SH) {
  'use strict';
  function hashString(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function RNG(seed) {
    if (typeof seed === 'string') seed = hashString(seed);
    this.next = mulberry32(seed == null ? 7 : seed); this.seed = seed;
  }
  RNG.prototype.range = function (a, b) { return a + this.next() * (b - a); };
  RNG.prototype.int = function (a, b) { return Math.floor(this.range(a, b + 1)); };
  RNG.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length) % arr.length]; };
  RNG.prototype.chance = function (p) { return this.next() < p; };
  RNG.prototype.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(this.next() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };
  var U = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    damp: function (a, b, l, dt) { return U.lerp(a, b, 1 - Math.exp(-l * dt)); },
    dist2d: function (ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); },
    angleLerp: function (a, b, t) { var d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; },
    headingTo: function (ax, az, bx, bz) { return Math.atan2(bx - ax, bz - az); },
    fmtMoney: function (n) { n = Math.round(n); var s = String(Math.abs(n)), o = ''; while (s.length > 3) { o = ',' + s.slice(-3) + o; s = s.slice(0, -3); } return (n < 0 ? '-$' : '$') + s + o; },
    fmtTime: function (sec) { sec = Math.max(0, Math.ceil(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  };
  SH.RNG = RNG; SH.U = U; SH.hashString = hashString;
})(window.SH);
