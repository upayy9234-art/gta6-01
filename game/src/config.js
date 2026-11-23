// Solstice Heat - Round 12 configuration. All tuning in one place.
window.SH = window.SH || {};
(function (SH) {
  'use strict';
  var C = {}; SH.Config = C;
  C.WORLD_SIZE = 960; C.BLOCK = 80; C.ROAD_W = 16; C.SIDEWALK_W = 4;
  C.BEACH_X = 330; C.WATER_X = 400; C.SEED_DEFAULT = 7;
  C.DISTRICTS = [
    { name: 'Boardwalk', cx: 360, cz: 0, r: 150, minH: 8, maxH: 22, density: 0.55 },
    { name: 'Downtown', cx: -60, cz: -60, r: 190, minH: 26, maxH: 74, density: 0.92 },
    { name: 'Neon Mile', cx: -40, cz: 190, r: 150, minH: 14, maxH: 40, density: 0.85 },
    { name: 'Marina', cx: 250, cz: -260, r: 140, minH: 6, maxH: 18, density: 0.6 },
    { name: 'Portside', cx: -280, cz: -280, r: 150, minH: 10, maxH: 26, density: 0.7 },
    { name: 'Old Town', cx: -280, cz: 130, r: 140, minH: 8, maxH: 20, density: 0.8 },
    { name: 'The Hills', cx: 120, cz: 330, r: 150, minH: 6, maxH: 16, density: 0.5 }
  ];
  C.STREET_NAMES_NS = ['Calle Ocho','Solstice Ave','Palmera Blvd','Neon Way','Marina Drive','Canal Street','Deco Lane','Sunset Strip','Harbor Road','Flamingo Court','Vice Avenue','Coral Way'];
  C.STREET_NAMES_EW = ['Ocean Drive','Biscayne Row','Golden Hour Blvd','Starfish Lane','Pier Avenue','Mango Street','Tropicana Way','Seabreeze Blvd','Lummus Park Rd','Collins Avenue','Meridian Ave','Palm Court'];
  C.BUILDING_COLORS = [0xf7c8d8,0xfde8c9,0xbfe3dd,0xcfe0f5,0xf9e2ae,0xe6d7f2,0xffd1b3,0xd8f0c8,0xfff3f0,0xb8e0e8,0xf5b8c4,0xaed9c5];
  C.ROOF_COLORS = [0xe88ca0,0x7fb5b0,0xd9a05b,0x8fa8c8,0xc97b8a,0x6b9e8f];
  C.NEON_COLORS = [0xff2e88,0x00e5ff,0xffe14d,0x7cff4d,0xff7a1a,0xb44dff];
  C.CAR_COLORS = [0xe63946,0xf1fa8c,0x2ec4b6,0xff9f1c,0x4361ee,0xf72585,0xffffff,0x222222,0x90e0a8,0xffd166,0x8ecae6,0xef476f];
  C.SHIRT_COLORS = [0xff6b9d,0xffd93d,0x6bcb77,0x4d96ff,0xff9f45,0x9b5de5,0x00f5d4,0xf15bb5];
  C.CAR_MODELS = [
    { name: 'Solstice Convertible', w: 1.9, l: 4.4, h: 0.62, cabinH: 0.5, topSpeed: 34, accel: 16, grip: 0.92 },
    { name: 'Deco Sedan', w: 1.85, l: 4.6, h: 0.66, cabinH: 0.62, topSpeed: 30, accel: 13, grip: 0.9 },
    { name: 'Marina Coupe', w: 1.8, l: 4.2, h: 0.6, cabinH: 0.5, topSpeed: 38, accel: 19, grip: 0.94 },
    { name: 'Portside Pickup', w: 2.0, l: 5.0, h: 0.8, cabinH: 0.66, topSpeed: 27, accel: 12, grip: 0.86 },
    { name: 'Neon Hatch', w: 1.7, l: 3.9, h: 0.64, cabinH: 0.6, topSpeed: 29, accel: 14, grip: 0.9 },
    { name: 'Hills Van', w: 2.0, l: 5.2, h: 1.0, cabinH: 0.8, topSpeed: 25, accel: 11, grip: 0.84 },
    { name: 'SBPD Interceptor', w: 1.9, l: 4.7, h: 0.66, cabinH: 0.6, topSpeed: 40, accel: 20, grip: 0.95, police: true },
    { name: 'Taxi Cab', w: 1.85, l: 4.6, h: 0.66, cabinH: 0.62, topSpeed: 30, accel: 13, grip: 0.9, taxi: true }
  ];
  C.PLAYER = { walkSpeed: 5.2, runSpeed: 9.5, swimSpeed: 3.4, radius: 0.55, maxHealth: 100, meleeRange: 2.2, meleeDamage: 18, pistolAmmoStart: 24, pistolDamage: 34, enterRange: 4.2, bustTime: 2.6 };
  C.POLICE = { spawnInterval: 2.2, maxCarsByStars: [0,2,3,5,7,9], heliStars: 4, roadblockStars: 3, heatDecayPerSec: 0.05, bustRange: 7, sightRange: 46, loseSightAfter: 6 };
  C.RANKS = [ { name: 'Street Rat', xp: 0 }, { name: 'Runner', xp: 120 }, { name: 'Fixer', xp: 320 }, { name: 'Operator', xp: 700 }, { name: 'Solstice Legend', xp: 1400 } ];
  C.SHOP = [
    { id: 'tires', name: 'Sport Tires', price: 350, desc: 'Better grip for every car you drive.' },
    { id: 'armor', name: 'Car Armor', price: 600, desc: 'Your current ride takes half damage.' },
    { id: 'medkit', name: 'Medkit', price: 80, desc: 'Restore 50 health instantly.' },
    { id: 'shirt', name: 'New Hawaiian Shirt', price: 120, desc: 'Fresh colours, fresh start.' },
    { id: 'paint', name: 'Neon Respray', price: 200, desc: 'Respray your current car neon.' },
    { id: 'ammo', name: 'Pistol Ammo x12', price: 60, desc: 'Twelve more rounds.' }
  ];
  C.FOODS = [ { name: 'Cuban Sandwich', price: 18, heal: 25 }, { name: 'Key Lime Pie', price: 12, heal: 15 }, { name: 'Cafecito', price: 8, heal: 8 } ];
  C.WEATHER_TYPES = ['clear','breeze','overcast','rain','storm','fog'];
  C.WEATHER_WEIGHTS = [0.34,0.2,0.16,0.14,0.07,0.09];
  C.DAY_LENGTH_SEC = 480; C.START_HOUR = 17.4;
  C.SHELL_COUNT = 30; C.POSTCARD_COUNT = 6; C.STUNT_COUNT = 8;
  C.SHELL_REWARD_EVERY = 10; C.SHELL_REWARD = 250; C.POSTCARD_REWARD = 120; C.STUNT_BASE_REWARD = 15;
  C.RACE_REWARDS = [500,300,150,50]; C.RACE_XP = [60,40,25,10];
  C.TICKER = [
    'SBPD reminds drivers that the Neon Mile is not a racetrack.',
    'Golden hour over Solstice Bay rated best sunset on the coast, again.',
    'Marina Pier festival this weekend: food trucks and live synth.',
    'Beach crews report thirty lost shells washed up around the bay.',
    'Traffic: smooth on Calle Ocho, slow near the Portside cranes.',
    'Local fixer Marisol Vega denies everything, charmingly.',
    'Weather desk: watch the sky, Solstice storms roll in fast.',
    'Stunt ramps inspected and declared technically legal-ish.'
  ];
  C.RADIO_STATIONS = [ { name: 'SOLSTICE FM', kind: 'synth' }, { name: 'BAYWAVE NEWS', kind: 'news' } ];
  C.SAVE_KEY = 'solstice-heat-r12-save'; C.AUTOSAVE_SEC = 20;
})(window.SH);
