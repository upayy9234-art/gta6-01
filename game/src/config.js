// Solstice Heat — config.js
// Global tuning constants, district definitions and shared helpers.
// Every system reads its numbers from window.SH.config so the whole
// game can be balanced from one place.
(function () {
  "use strict";
  window.SH = window.SH || {};

  var config = {};

  // World dimensions -------------------------------------------------
  config.WORLD = {
    blockSize: 60,
    roadWidth: 16,
    blocksX: 8,
    blocksZ: 8,
    seaLevel: 0,
    beachZ: 300,
    pierX: 40,
    pierLength: 90
  };
  config.WORLD.width = config.WORLD.blocksX * config.WORLD.blockSize;
  config.WORLD.depth = config.WORLD.blocksZ * config.WORLD.blockSize;

  // Time -------------------------------------------------------------
  config.TIME = {
    startHour: 15.5,
    dayLengthSeconds: 600,
    dawnHour: 6,
    noonHour: 12,
    duskHour: 19,
    midnightHour: 0
  };

  // Player -----------------------------------------------------------
  config.PLAYER = {
    walkSpeed: 6,
    sprintSpeed: 10,
    swimSpeed: 4,
    turnRate: 3.2,
    radius: 0.7,
    maxHealth: 100,
    maxArmor: 100,
    meleeRange: 2.2,
    meleeDamage: 18,
    meleeCooldown: 0.45,
    pistolDamage: 26,
    pistolRange: 60,
    pistolCooldown: 0.28,
    pistolAmmoStart: 48,
    regenDelay: 6,
    regenRate: 4
  };

  // Vehicles ---------------------------------------------------------
  config.VEHICLE = {
    accel: 22,
    brake: 34,
    reverseAccel: 10,
    maxSpeed: 46,
    maxReverse: 12,
    steerRate: 1.9,
    grip: 8.5,
    driftGrip: 2.4,
    drag: 0.35,
    damageScale: 1.0,
    trafficCount: 14,
    trafficSpeed: 13
  };

  // Police -----------------------------------------------------------
  config.POLICE = {
    maxStars: 5,
    heatPerCrime: 22,
    heatDecayPerSecond: 2.2,
    hiddenDecayBonus: 2.5,
    bustFillRate: 26,
    bustDrainRate: 18,
    bustDistance: 3.2,
    copSpeed: 15,
    copCarSpeed: 40,
    roadblockStars: 3,
    helicopterStars: 4,
    spawnInterval: 4
  };

  // Economy ----------------------------------------------------------
  config.ECONOMY = {
    startCash: 120,
    startBank: 0,
    hospitalCost: 150,
    bustFinePercent: 0.25,
    ranks: [
      { name: "Runner", xp: 0 },
      { name: "Courier", xp: 150 },
      { name: "Wheelman", xp: 400 },
      { name: "Smuggler", xp: 900 },
      { name: "Kingpin", xp: 1800 }
    ],
    shop: [
      { id: "snack", name: "Snack Bar", price: 15, kind: "health", amount: 30 },
      { id: "meal", name: "Pier Meal", price: 40, kind: "health", amount: 70 },
      { id: "vest", name: "Kevlar Vest", price: 120, kind: "armor", amount: 60 },
      { id: "plate", name: "Plate Carrier", price: 220, kind: "armor", amount: 100 },
      { id: "ammo", name: "Pistol Ammo x24", price: 35, kind: "ammo", amount: 24 },
      { id: "repair", name: "Full Repair", price: 90, kind: "repair", amount: 100 },
      { id: "paint", name: "Respray", price: 60, kind: "heat", amount: 40 },
      { id: "deposit", name: "Deposit Cash", price: 0, kind: "deposit", amount: 0 }
    ]
  };

  // Districts --------------------------------------------------------
  config.DISTRICTS = [
    {
      id: "boardwalk",
      name: "Boardwalk",
      minX: -240, maxX: 240, minZ: 190, maxZ: 300,
      tint: 0xf2c078, density: 0.5, palmHeavy: true
    },
    {
      id: "neonmile",
      name: "Neon Mile",
      minX: -120, maxX: 120, minZ: 60, maxZ: 190,
      tint: 0xff5da2, density: 1.0, palmHeavy: false
    },
    {
      id: "marina",
      name: "Marina",
      minX: 120, maxX: 240, minZ: 60, maxZ: 190,
      tint: 0x6ec6d8, density: 0.6, palmHeavy: true
    },
    {
      id: "oldtown",
      name: "Old Town",
      minX: -240, maxX: -120, minZ: -60, maxZ: 60,
      tint: 0xd8a06a, density: 0.8, palmHeavy: false
    },
    {
      id: "palmheights",
      name: "Palm Heights",
      minX: -120, maxX: 120, minZ: -190, maxZ: -60,
      tint: 0x9fd86e, density: 0.7, palmHeavy: true
    },
    {
      id: "port",
      name: "Port",
      minX: 120, maxX: 240, minZ: -190, maxZ: -60,
      tint: 0x8a93a8, density: 0.55, palmHeavy: false
    },
    {
      id: "university",
      name: "University",
      minX: -240, maxX: -120, minZ: -190, maxZ: -60,
      tint: 0xb49fe0, density: 0.65, palmHeavy: true
    }
  ];

  config.districtAt = function (x, z) {
    var i;
    var d;
    for (i = 0; i < config.DISTRICTS.length; i++) {
      d = config.DISTRICTS[i];
      if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) {
        return d;
      }
    }
    return config.DISTRICTS[0];
  };

  // Building palettes --------------------------------------------------
  config.PALETTES = {
    deco: [0xf7e3b0, 0xf2c078, 0xe88ca0, 0x9fd8d0, 0xf5f0e6, 0xd8b4e2],
    neon: [0xff5da2, 0x5df2ff, 0xffe95d, 0x9dff5d, 0xff8a5d],
    trim: [0x8a5a2b, 0x2b6a8a, 0x6a2b4a, 0x2b8a5a, 0x555f6e]
  };

  // Car colours --------------------------------------------------------
  config.CAR_COLORS = [
    0xe2452c, 0x2c7de2, 0xf2c018, 0x38b24a, 0xf5f0e6,
    0x22242c, 0x8a2be2, 0xff7f2c, 0x2cd8c8, 0xc0c6ce
  ];

  // Weather kinds ------------------------------------------------------
  config.WEATHER_KINDS = ["clear", "haze", "rain", "storm", "fog"];

  // Save key -----------------------------------------------------------
  config.SAVE_KEY = "solstice-heat-save-v1";

  // Small numeric helpers ----------------------------------------------
  config.clamp = function (v, lo, hi) {
    if (v < lo) { return lo; }
    if (v > hi) { return hi; }
    return v;
  };
  config.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };
  config.dist2d = function (ax, az, bx, bz) {
    var dx = ax - bx;
    var dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  };
  config.angleLerp = function (a, b, t) {
    var d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) { d -= Math.PI * 2; }
    if (d < -Math.PI) { d += Math.PI * 2; }
    return a + d * t;
  };
  config.formatMoney = function (n) {
    var s = String(Math.floor(Math.abs(n)));
    var out = "";
    var i;
    for (i = 0; i < s.length; i++) {
      out += s[i];
      var remaining = s.length - i - 1;
      if (remaining > 0 && remaining % 3 === 0) { out += ","; }
    }
    return (n < 0 ? "-$" : "$") + out;
  };
  config.formatClock = function (hourFloat) {
    var h = Math.floor(hourFloat) % 24;
    var m = Math.floor((hourFloat - Math.floor(hourFloat)) * 60);
    var hs = h < 10 ? "0" + h : String(h);
    var ms = m < 10 ? "0" + m : String(m);
    return hs + ":" + ms;
  };

  window.SH.config = config;
})();
