// config.js — every shared constant for Solstice Heat: Neon Tide.
// World geometry, district flavour, vehicle and weapon definitions, and the
// tuning numbers the rest of the game reads. Nothing here touches the DOM.

export const WORLD = {
  width: 4800,
  height: 3600,
  // The bay bites into the east side of the map. Land is x < coastX(y).
  coastBase: 3420,
  coastAmpA: 430,
  coastFreqA: 0.0016,
  coastAmpB: 170,
  coastFreqB: 0.0041,
  beachWidth: 46,
  island: { x: 4280, y: 700, r: 330 },
  causewayY: 700,
  causewayHalf: 55,
};

export const TIME = {
  dayLength: 240,          // seconds for a full day/night cycle
  startHour: 10.5,         // the game opens mid-morning
  weatherMin: 55,          // seconds between weather rolls
  weatherMax: 95,
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 168,
  sprintSpeed: 268,
  swimSpeed: 0,            // the bay is for boats; wading stops at the shore
  maxHealth: 100,
  maxArmor: 100,
  startCash: 120,
  bustTime: 2.6,           // seconds boxed in before the cuffs go on
  enterRange: 64,
};

// The eight districts of Solstice Bay. Rects are flavour + building palettes;
// the road grid in city.js is what actually shapes the streets.
export const DISTRICTS = [
  { name: 'Palm Heights',    x: 0,    y: 0,    w: 1500, h: 1100, roof: ['#e8b04b', '#d98e4a', '#c96f4a'], wall: '#f2d8a7' },
  { name: 'Sunset Terrace',  x: 1500, y: 0,    w: 1940, h: 1100, roof: ['#ef8354', '#e56b6f', '#c95d63'], wall: '#f7c8a0' },
  { name: 'Old Market',      x: 0,    y: 1100, w: 1300, h: 1200, roof: ['#b5654d', '#9c6644', '#8a7f5c'], wall: '#e6cfa3' },
  { name: 'Neon Mile',       x: 1300, y: 1100, w: 1400, h: 1200, roof: ['#5c4b8a', '#7b4b94', '#3f6d9e'], wall: '#cdbcf2', neon: true },
  { name: 'Marina District', x: 2700, y: 1100, w: 900,  h: 1200, roof: ['#4a90a4', '#5ba8a0', '#6fb3c9'], wall: '#dff3f2' },
  { name: 'University Quarter', x: 0, y: 2300, w: 1400, h: 1300, roof: ['#7a9e5f', '#5f8a6d', '#87a96b'], wall: '#eef0d5' },
  { name: 'Portside',        x: 1400, y: 2300, w: 1500, h: 1300, roof: ['#6d7c8a', '#596673', '#7d6a58'], wall: '#cfd6da' },
  { name: 'Harbour Point',   x: 2900, y: 2300, w: 700,  h: 1300, roof: ['#4f7f8c', '#3f6d7c', '#5c8a94'], wall: '#d8ecec' },
];

// Vehicle definitions. kind: 'car' drives on land, 'boat' on water.
// speed/accel in px/s and px/s^2, grip is lateral retention per second,
// size is [length, width] in px.
export const VEHICLES = {
  pico:      { name: 'Pico Compact',   kind: 'car', speed: 305, accel: 235, grip: 7.5, health: 90,  size: [44, 24], colors: ['#d94f4f', '#4f79d9', '#e0e0e0', '#57b25e'] },
  meridian:  { name: 'Meridian Sedan', kind: 'car', speed: 345, accel: 250, grip: 7.8, health: 110, size: [52, 26], colors: ['#2e3a46', '#6b7a89', '#8a2f35', '#274156'] },
  bronto:    { name: 'Bronto Muscle',  kind: 'car', speed: 395, accel: 330, grip: 6.2, health: 120, size: [54, 27], colors: ['#e07b26', '#20242c', '#7a1f2b', '#20503c'] },
  vessia:    { name: 'Vessia Coupe',   kind: 'car', speed: 430, accel: 355, grip: 8.4, health: 100, size: [52, 25], colors: ['#e8c832', '#d94f8f', '#32b8c6', '#f2f2f2'] },
  aurelion:  { name: 'Aurelion GT',    kind: 'car', speed: 490, accel: 410, grip: 9.0, health: 100, size: [54, 26], colors: ['#ff5a3c', '#ffd23c', '#3cd6ff', '#ececec'] },
  terra:     { name: 'Terra SUV',      kind: 'car', speed: 330, accel: 240, grip: 7.0, health: 160, size: [56, 29], colors: ['#4a5560', '#77543a', '#37503f', '#8c97a3'] },
  mulehorn:  { name: 'Mulehorn Pickup', kind: 'car', speed: 320, accel: 235, grip: 6.8, health: 150, size: [56, 28], colors: ['#a33e31', '#31597a', '#c7c7c7', '#4f612f'] },
  cabrio:    { name: 'Cabrio Taxi',    kind: 'car', speed: 350, accel: 260, grip: 7.8, health: 110, size: [52, 26], colors: ['#f7b731'], taxi: true },
  cargo:     { name: 'Cargo Van',      kind: 'car', speed: 300, accel: 215, grip: 6.6, health: 170, size: [58, 29], colors: ['#dfe3e6', '#7f8b94', '#4a6b8a'] },
  truck:     { name: 'Vault Truck',    kind: 'car', speed: 285, accel: 195, grip: 6.4, health: 320, size: [64, 30], colors: ['#3c4652'] },
  interceptor: { name: 'SBPD Interceptor', kind: 'car', speed: 445, accel: 380, grip: 8.8, health: 150, size: [53, 26], colors: ['#14181f'], police: true },
  skiff:     { name: 'Harbour Skiff',  kind: 'boat', speed: 265, accel: 190, grip: 4.6, health: 90,  size: [40, 20], colors: ['#e8e4da', '#7fb3c8', '#c85f4f'] },
  marlin:    { name: 'Marlin Racer',   kind: 'boat', speed: 385, accel: 300, grip: 5.4, health: 110, size: [48, 22], colors: ['#ff7847', '#2ec4b6', '#f7f7f7'] },
};

export const TRAFFIC_MODELS = ['pico', 'meridian', 'bronto', 'vessia', 'terra', 'mulehorn', 'cabrio', 'cargo', 'pico', 'meridian'];

export const WEAPONS = {
  fists:  { name: 'Fists',  damage: 9,  range: 30,  rate: 0.34, spread: 0.02 },
  pistol: { name: 'Harbor 9mm', damage: 26, range: 430, rate: 0.27, spread: 0.045, ammoPrice: 4 },
};

export const SERVICES = {
  garage:  { name: 'Tide Garage', price: 150, blip: 'G' },
  clinic:  { name: 'Bay Clinic', price: 100, blip: '+' },
  armoury: { name: 'Fort Arms', price: 250, blip: 'A' },
};

export const ECONOMY = {
  shellValue: 40,
  shellBonus: 1000,
  shellTotal: 25,
  wastedFine: 0.10,
  bustedFine: 0.15,
  taxiPerPx: 0.055,
  courierPay: [260, 420],
};

export const WANTED = {
  // heat points needed to hold each star level (index = stars)
  thresholds: [0, 30, 85, 160, 260, 400],
  decayPerSec: 4.5,        // heat lost while unseen
  searchTime: 9,           // seconds unseen at 0 heat before stars clear
  crimes: {
    stealCar: 26,
    hitPed: 34,
    killPed: 70,
    shootNear: 18,
    shootHit: 30,
    hitCar: 8,
    hitPolice: 45,
    ramPolice: 55,
    mission: 0,
  },
};

export const SAVE_KEY = 'solstice-heat-neon-tide-save-v1';

export const COLORS = {
  water: '#1668a8',
  waterDeep: '#0d4d80',
  sand: '#ecd28f',
  grass: '#79b657',
  road: '#3c4148',
  roadLine: '#e8e3c8',
  sidewalk: '#b9b3a4',
  pier: '#9a744e',
  night: '#0b1030',
};
