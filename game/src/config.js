// config.js — the numbers and names of Solstice Bay: world size, districts,
// vehicles, prices, palettes. Everything tunable lives here so the rest of
// the code reads as rules, not magic numbers.

export const WORLD = { w: 4800, h: 3600 };

// One full day/night cycle in seconds of play.
export const DAY_LENGTH = 600;
// The clock starts at golden hour on day one.
export const START_HOUR = 17.4;

export const PLAYER = {
  radius: 13,
  walkSpeed: 168,
  sprintSpeed: 268,
  maxHealth: 100,
  maxArmor: 100,
  startCash: 120,
};

export const SHELLS_TOTAL = 25;
export const SHELL_VALUE = 40;

// The eight districts, west (downtown) to east (the bay). Rects are in world
// units; city.js grows the streets and buildings inside them.
export const DISTRICTS = [
  { name: 'Old Fort', x: 120, y: 120, w: 980, h: 780, tone: '#8a7f70', roof: '#6e6257' },
  { name: 'Cielo Heights', x: 120, y: 1020, w: 980, h: 780, tone: '#7d7468', roof: '#5f574e' },
  { name: 'Little Marisol', x: 120, y: 1920, w: 980, h: 780, tone: '#96826a', roof: '#77644c' },
  { name: 'The Flats', x: 120, y: 2820, w: 980, h: 660, tone: '#84766a', roof: '#66584e' },
  { name: 'Neon Mile', x: 1220, y: 120, w: 1080, h: 780, tone: '#7c7264', roof: '#5d5348' },
  { name: 'Portside', x: 1220, y: 1020, w: 1080, h: 780, tone: '#757a72', roof: '#585d55' },
  { name: 'Coral Gables', x: 1220, y: 1920, w: 1080, h: 780, tone: '#8d8272', roof: '#6d6152' },
  { name: 'Boardwalk', x: 1220, y: 2820, w: 1080, h: 660, tone: '#978a76', roof: '#786a56' },
];

// The marina sits on the Boardwalk shore; its three piers reach east.
export const MARINA = { x: 2650, y: 2740, pierYs: [2780, 2960, 3140], pierLen: 330 };

// Lighthouse Isle, out in the bay, joined to the shore by the causeway.
export const ISLAND = { x: 4150, y: 820, r: 300 };

// Nine cars and two boats. topSpeed in px/s, accel in px/s^2, grip is how
// hard the tyres bite before the car starts to slide.
export const VEHICLE_TYPES = [
  { id: 'coupe', name: 'Marlowe Coupe', kind: 'car', topSpeed: 430, accel: 300, grip: 6.4, len: 46, wid: 22, health: 130, colors: ['#e8641e', '#c22f4e', '#e8b81e', '#2e7fc2'] },
  { id: 'sedan', name: 'Vista Sedan', kind: 'car', topSpeed: 360, accel: 240, grip: 6.0, len: 48, wid: 23, health: 140, colors: ['#b9bec6', '#4a5560', '#7a4a56', '#3f6157'] },
  { id: 'taxi', name: 'Solstice Cab', kind: 'car', topSpeed: 350, accel: 235, grip: 6.0, len: 48, wid: 23, health: 140, colors: ['#f2b705'] },
  { id: 'van', name: 'Hauler Van', kind: 'car', topSpeed: 300, accel: 200, grip: 5.4, len: 56, wid: 26, health: 190, colors: ['#cfd4d8', '#5b6b73', '#8a6d3b'] },
  { id: 'truck', name: 'Longhaul Truck', kind: 'car', topSpeed: 285, accel: 175, grip: 5.0, len: 66, wid: 28, health: 240, colors: ['#9c3d2e', '#33566e', '#6e6e5e'] },
  { id: 'muscle', name: 'Barracuda GT', kind: 'car', topSpeed: 465, accel: 335, grip: 5.6, len: 48, wid: 23, health: 125, colors: ['#20242c', '#5e1f6e', '#0f5e4d'] },
  { id: 'compact', name: 'Pico Hatch', kind: 'car', topSpeed: 320, accel: 225, grip: 6.6, len: 38, wid: 20, health: 105, colors: ['#7fc24a', '#c2c24a', '#4ac2b8', '#c27fb0'] },
  { id: 'interceptor', name: 'SBPD Interceptor', kind: 'car', topSpeed: 450, accel: 320, grip: 6.6, len: 47, wid: 23, health: 170, colors: ['#14181f'] },
  { id: 'racer', name: 'Kestrel R', kind: 'car', topSpeed: 480, accel: 350, grip: 6.1, len: 46, wid: 22, health: 120, colors: ['#d8d8e0', '#1ec2c2', '#c21e7f'] },
  { id: 'speedboat', name: 'Tide Runner', kind: 'boat', topSpeed: 400, accel: 260, grip: 2.6, len: 44, wid: 18, health: 130, colors: ['#e8e4da', '#c22f4e', '#1e6ec2'] },
  { id: 'skiff', name: 'Bay Skiff', kind: 'boat', topSpeed: 300, accel: 200, grip: 2.9, len: 36, wid: 16, health: 110, colors: ['#b8a888', '#6e8a5e', '#887858'] },
];

export const WEAPONS = {
  fists: { name: 'Fists', damage: 9, range: 34, rate: 0.34, spread: 0.05, ammo: Infinity },
  pistol: { name: 'Harbor 9mm', damage: 22, range: 460, rate: 0.26, spread: 0.035, ammo: 0 },
};

export const PRICES = {
  heal: 60,
  armor: 120,
  pistol: 250,
  ammoBox: 40,
  repairPerPoint: 1.2,
  bustFineRate: 0.25,
  wastedFee: 90,
};

// Neon signs and lit windows borrow from this palette after dark.
export const NEON = ['#ff2e88', '#22d3ee', '#facc15', '#a3e635', '#f97316', '#e879f9'];

export const SAVE_KEY = 'solstice-heat-neon-tide-save-v1';
