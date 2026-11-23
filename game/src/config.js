// config.js — every tuning number and colour for Solstice Heat: Neon Tide lives here,
// so the rest of the game reads like prose and the feel can be adjusted in one place.

export const WORLD = {
  width: 4800,          // whole map, in world units (roughly metres at zoom 1)
  height: 3600,
  roadEvery: 400,       // avenues are laid out on this grid
  roadWidth: 92,        // asphalt width: two lanes each way plus parking
  shoreX: 3420,         // the bay's waterline at its straightest; the shore curves around this
  islandX: 4180,        // lighthouse island, out in the bay
  islandY: 860,
  islandR: 300,
  bridgeY: 860,         // the causeway runs along this latitude to the island
};

export const TIME = {
  dayLength: 260,       // real seconds for one full in-game day
  startHour: 16.4,      // the story opens in late golden afternoon
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 172,
  sprintSpeed: 272,
  swimSpeed: 98,
  maxHealth: 100,
  maxArmour: 100,
  punchRange: 36,
  punchDamage: 26,
  pistolDamage: 34,
  pistolRange: 470,
  pistolCooldown: 0.24,
};

export const WANTED = {
  maxStars: 5,
  decayPerSecond: 1.7,        // heat bleeds off while no cop can see the player
  sightRange: 580,            // a cop inside this with line of sight refreshes the heat
  bustFillTime: 2.4,          // seconds pinned before BUSTED
  heatFor: {                  // heat points per crime (100 points ~ one star)
    stealCar: 34,
    carjack: 55,
    hitPed: 70,
    killPed: 130,
    shootNearCop: 45,
    hitCopCar: 60,
    killCop: 170,
    collision: 12,
    missionCrime: 40,
  },
};

export const ECONOMY = {
  sprayCost: 250,             // Neon Bay Garage: clears heat, repairs the car
  armourCost: 150,
  healCost: 100,
  shellValue: 40,
};

export const PALETTE = {
  water: '#1b6f8f',
  waterDeep: '#12546e',
  sand: '#e8cf9e',
  grass: '#79a75a',
  sidewalk: '#b9b3a4',
  asphalt: '#3c4149',
  asphaltDark: '#33373f',
  laneMark: '#e8e4d2',
  crosswalk: '#d8d4c6',
  roof: ['#c96f4a', '#b8573f', '#d98a5b', '#a34a52', '#c4516b', '#8f5f8f', '#4a7d96', '#3f6d7a'],
  wall: ['#e6d3ae', '#dfc39a', '#e8b98a', '#d9a06b', '#c98d6b', '#b8c4c9'],
  neon: ['#ff5da2', '#22d3ee', '#facc15', '#a78bfa', '#34d399', '#fb7185', '#38bdf8'],
  palm: '#3e7d44',
  palmTrunk: '#8a6b4a',
};

// The districts of Solstice Bay, west to east, north to south. The HUD names the
// one the player stands in; the minimap tints each one faintly differently.
export const DISTRICTS = [
  { name: 'Old Town',        x0: 0,    y0: 0,    x1: 1600, y1: 1200 },
  { name: 'Palm Heights',    x0: 1600, y0: 0,    x1: 3420, y1: 1200 },
  { name: 'University',      x0: 0,    y0: 1200, x1: 1200, y1: 2400 },
  { name: 'Neon Mile',       x0: 1200, y0: 1200, x1: 2600, y1: 2400 },
  { name: 'Casino Row',      x0: 2600, y0: 1200, x1: 3420, y1: 2400 },
  { name: 'The Port',        x0: 0,    y0: 2400, x1: 1400, y1: 3600 },
  { name: 'Boardwalk',       x0: 1400, y0: 2400, x1: 3420, y1: 3600 },
  { name: 'The Marina',      x0: 3420, y0: 1200, x1: 4800, y1: 2400 },
  { name: 'Lighthouse Isle', x0: 3420, y0: 0,    x1: 4800, y1: 1200 },
];

export const SAVE_KEY = 'solstice-heat-neon-tide-save-v1';
