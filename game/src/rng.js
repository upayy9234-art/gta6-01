// Solstice Heat — rng.js
// Deterministic seeded random number generation (mulberry32) plus
// small selection helpers. The city, collectibles and shot
// compositions all draw from seeded streams so that a given seed
// always builds the same Solstice Bay.
(function () {
  "use strict";
  window.SH = window.SH || {};

  function RNG(seed) {
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 0x9e3779b9;
    }
  }

  RNG.prototype.next = function () {
    var t = this.state += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  RNG.prototype.range = function (lo, hi) {
    return lo + (hi - lo) * this.next();
  };

  RNG.prototype.int = function (lo, hi) {
    return Math.floor(this.range(lo, hi + 1));
  };

  RNG.prototype.pick = function (arr) {
    if (!arr || arr.length === 0) {
      return null;
    }
    return arr[Math.floor(this.next() * arr.length)];
  };

  RNG.prototype.pickWeighted = function (entries) {
    var total = 0;
    var i;
    for (i = 0; i < entries.length; i++) {
      total += entries[i].weight;
    }
    var roll = this.next() * total;
    var acc = 0;
    for (i = 0; i < entries.length; i++) {
      acc += entries[i].weight;
      if (roll <= acc) {
        return entries[i].value;
      }
    }
    return entries[entries.length - 1].value;
  };

  RNG.prototype.chance = function (p) {
    return this.next() < p;
  };

  RNG.prototype.shuffle = function (arr) {
    var i;
    var j;
    var tmp;
    for (i = arr.length - 1; i > 0; i--) {
      j = Math.floor(this.next() * (i + 1));
      tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  };

  RNG.prototype.sign = function () {
    return this.next() < 0.5 ? -1 : 1;
  };

  // Hash a string seed into a 32-bit integer.
  function hashSeed(text) {
    var h = 2166136261;
    var i;
    for (i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Parse the ?seed= query parameter, defaulting to 7.
  function querySeed() {
    var fallback = 7;
    try {
      var params = new URLSearchParams(window.location.search);
      var raw = params.get("seed");
      if (raw === null) {
        return fallback;
      }
      var n = parseInt(raw, 10);
      if (isNaN(n)) {
        return hashSeed(raw);
      }
      return n;
    } catch (err) {
      return fallback;
    }
  }

  function queryParam(name) {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get(name);
    } catch (err) {
      return null;
    }
  }

  window.SH.RNG = RNG;
  window.SH.hashSeed = hashSeed;
  window.SH.querySeed = querySeed;
  window.SH.queryParam = queryParam;
  window.SH.rng = new RNG(querySeed() * 1000 + 17);
})();
