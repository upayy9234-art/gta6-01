// Solstice Heat: Neon Tide — config.js
// Central constants: world layout, districts, vehicles, balance, keys.
window.SH = window.SH || {};
SH.config = (function () {
  'use strict';
  var WORLD = {
    size: 900,            // playable ground extent (metres, centred on 0,0)
    seaLevel: 0,
    beachZ: 300,          // sand starts south of this z
    seaZ: 360,            // water plane south of this z
    islandX: 260, islandZ: 620, islandR: 90,
    bridgeZ: 470,
    block: 60,            // city block pitch
    roadHalf: 7,          // half road width
    gridMin: -360, gridMax: 240
  };
  var DISTRICTS = [
    { name: 'Boardwalk',    cx: -120, cz: 250, color: 0xffb36b, roof: 0xe2725b, neon: 0xff7ab6, density: 0.7 },
    { name: 'Neon Mile',    cx: -60,  cz: 60,  color: 0xff4fd8, roof: 0x3a2b5c, neon: 0x00e5ff, density: 1.0 },
    { name: 'Marina',       cx: 190,  cz: 250, color: 0x7fd4ff, roof: 0x2e6f8e, neon: 0x9be7ff, density: 0.5 },
    { name: 'Old Town',     cx: -260, cz: -60, color: 0xd9a066, roof: 0x8e5a3c, neon: 0xffd27f, density: 0.8 },
    { name: 'Palm Heights', cx: 140,  cz: -160, color: 0xa8e6a1, roof: 0x5c8a4d, neon: 0xc6ffb8, density: 0.45 },
    { name: 'Port',         cx: 300,  cz: 40,  color: 0x9aa7b8, roof: 0x54606e, neon: 0xffb84d, density: 0.6 },
    { name: 'University',   cx: -140, cz: -260, color: 0xb8c6ff, roof: 0x4d5a8a, neon: 0xdfe7ff, density: 0.55 },
    { name: 'Casino Row',   cx: 60,   cz: 150, color: 0xffd700, roof: 0x6e1f3c, neon: 0xffe14d, density: 0.9 }
  ];
  var VEHICLES = [
    { id: 'coupe',   name: 'Solstice Coupe',  top: 46, accel: 22, grip: 0.92, price: 0,     colors: [0xd7263d, 0x26547c, 0xffc914, 0x2ec4b6] },
    { id: 'sedan',   name: 'Bay Sedan',       top: 38, accel: 17, grip: 0.90, price: 0,     colors: [0x8d99ae, 0xedf2f4, 0x2b2d42, 0xef233c] },
    { id: 'muscle',  name: 'Marlowe Muscle',  top: 52, accel: 26, grip: 0.84, price: 1200,  colors: [0x111111, 0xf46036, 0x5bc0eb, 0x9bc53d] },
    { id: 'pickup',  name: 'Port Pickup',     top: 36, accel: 16, grip: 0.88, price: 600,   colors: [0x6a4c93, 0x1982c4, 0x8ac926, 0xffca3a] },
    { id: 'van',     name: 'Cargo Van',       top: 33, accel: 14, grip: 0.86, price: 500,   colors: [0xf1faee, 0xa8dadc, 0x457b9d, 0x1d3557] },
    { id: 'compact', name: 'Palm Compact',    top: 34, accel: 18, grip: 0.94, price: 300,   colors: [0xff70a6, 0xffd670, 0x70d6ff, 0xe9ff70] },
    { id: 'police',  name: 'SBPD Interceptor', top: 54, accel: 27, grip: 0.93, price: -1,   colors: [0x14213d] },
    { id: 'taxi',    name: 'Solstice Cab',    top: 40, accel: 18, grip: 0.90, price: -1,    colors: [0xffbe0b] },
    { id: 'boat',    name: 'Tide Runner',     top: 30, accel: 15, grip: 0.80, price: 2500,  colors: [0xffffff, 0xff5964, 0x00b4d8] }
  ];
  var BALANCE = {
    startCash: 250, startBank: 0,
    missionPay: [300, 450, 600, 500, 700, 800, 650, 1100, 900, 1000, 1200, 2500],
    missionXP:  [40, 55, 70, 60, 80, 90, 75, 130, 110, 120, 150, 300],
    taxiPayPerM: 0.09, courierPay: 180, medicPay: 220, towPay: 260,
    racePay: [600, 300, 150], stuntPay: 150, shellValue: 25, postcardValue: 100,
    armourCost: 200, healthCost: 50, ammoCost: 40, repairCostPerDamage: 2.2,
    ranks: [
      { name: 'Nobody', xp: 0 }, { name: 'Runner', xp: 150 }, { name: 'Wheelman', xp: 400 },
      { name: 'Fixer Friend', xp: 800 }, { name: 'Neon Royalty', xp: 1400 }
    ],
    bustFineRate: 0.25, wastedCost: 150
  };
  var KEYS = {
    forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    sprint: ['ShiftLeft', 'ShiftRight'], handbrake: ['Space'],
    interact: ['KeyE'], action: ['KeyF'], reload: ['KeyR'],
    radio: ['KeyM'], photo: ['KeyP'], pause: ['Escape']
  };
  var WEATHER_NAMES = ['clear', 'haze', 'rain', 'storm', 'fog'];
  var DAY_LENGTH = 600; // seconds per full day cycle
  return { WORLD: WORLD, DISTRICTS: DISTRICTS, VEHICLES: VEHICLES, BALANCE: BALANCE, KEYS: KEYS, WEATHER_NAMES: WEATHER_NAMES, DAY_LENGTH: DAY_LENGTH };
})();
