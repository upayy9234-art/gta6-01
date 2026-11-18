// Neon Harbor — one tuning table for the whole game.
// Virelia is an invented neon harbour city. The hero is KAI MERCER, a courier
// dragged into one last job by fixer MARA VOSS: twelve missions over three
// days, ending in the Harbor Vault heist. Nothing here borrows Rockstar / GTA
// names, art or music — every name, place and line is original.
// This module is pure data: no functions, no side effects, no imports. Every
// other module reads its numbers from here, so a balance tweak is one edit.
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const WORLD = { width: 3400, height: 2400, block: 340, road: 96 };
export const SAVE_KEY = 'neon-harbor.save.v1';
export const BEST_KEY = 'neon-harbor.best';

// The clock opens at 18:05 — golden hour, sun low over the harbour. The day
// counter and the sky both read this start as sunset, not night.
export const SUNSET_START = 1085;
export const GOLDEN_START = 1050;
export const GOLDEN_END = 1140;

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// --- Player and cars -------------------------------------------------------
export const PLAYER = {
  radius: 13,
  walkSpeed: 205,
  runSpeed: 285,
  health: 100,
  punchDamage: 12,
  bulletDamage: 34,
  fireInterval: 0.22,
  bulletSpeed: 780,
};
export const CAR = {
  length: 64,
  width: 30,
  accel: 420,
  brake: 620,
  reverse: 190,
  maxSpeed: 560,
  turnRate: 2.6,
  drag: 0.55,
  grip: 6.5,
  health: 160,
};
export const WANTED = { decay: 0.045, perCrime: 1, max: 5, chaseSpeed: 500 };
export const MISSION_REWARD = [400, 900, 2200, 3000, 4200, 6000, 800, 1500, 2600, 1800, 5000, 10000];
export const GARAGE = { x: 700, y: 388, label: 'VIRELIA MOTORS — GARAGE' };
export const WEAPON_SHOP = { x: 500, y: 388, label: 'HARBOR ARMS — WEAPONS' };
export const HELI = {
  speed: 430, hoverLag: 0.9, bobAmp: 12,
  shootRange: 520, fireInterval: 0.9, bulletSpeed: 700,
};

// --- VPD roadblocks and lockdown (wanted.js) -------------------------------
// Roadblocks seal the road ahead of Kai once the heat hits 3 stars; at 5
// stars the whole city locks down — faster chasers and a second helicopter.
export const ROADBLOCK = {
  MIN_WANTED: 3,
  MAX_ACTIVE: 2,
  MAX_ACTIVE_LOCKDOWN: 3,
  AHEAD: 480,
  WARN_DIST: 600,
  SPAWN_GAP: 6,
  STRIP_RADIUS: 46,
  SPIKE_DAMAGE: 12,
};

// --- Dynamic weather (weather.js) ------------------------------------------
// A spell lasts 90–150 game-seconds, then the sky rolls a new kind. Grip is
// the only number gameplay reads; the rest is presentation.
export const WEATHER = {
  MIN_SPELL: 90,
  MAX_SPELL: 150,
  GRIP: { clear: 1, rain: 0.82, fog: 0.95, storm: 0.78 },
  KINDS: ['clear', 'rain', 'fog', 'storm'],
};

// --- Taxi fares and postcards (side.js) ------------------------------------
export const TAXI = {
  MAX_WAITING: 3,
  PICKUP_DIST: 80,
  DROPOFF_DIST: 80,
  MIN_TRIP: 500,
  MAX_TRIP: 1400,
  SPEED: 200,
  BASE_TIME: 25,
  MIN_PAY: 150,
  MAX_PAY: 400,
  SCORE: 100,
  RESPAWN_DELAY: 8,
  POSTCARD_PAY: 150,
  POSTCARD_SCORE: 200,
  HUNTER_BONUS_CASH: 1000,
  HUNTER_BONUS_SCORE: 1000,
  STREAK_BONUS: 50,
  STREAK_BONUS_CAP: 200,
  VIP_CHANCE: 0.25,
  VIP_PAY_CAP: 800,
};
export const POSTCARD_SPOTS = [
  { x: 2930, y: 500, label: 'PALM BOULEVARD' },
  { x: 1914, y: 1478, label: 'HARBOR PARK' },
  { x: 3120, y: 668, label: 'EAST PIER' },
  { x: 1042, y: 800, label: 'NEON STRIP' },
  { x: 700, y: 388, label: 'VIRELIA MOTORS' },
  { x: 2640, y: 2090, label: 'PORTSIDE DOCKS' },
  { x: 560, y: 560, label: 'OLD TOWN' },
  { x: 2568, y: 388, label: 'UPTOWN' },
  { x: 824, y: 1696, label: 'HARBOR VAULT' },
  { x: 1300, y: 860, label: 'NEON MART' },
];

// --- Shops -----------------------------------------------------------------
// Three storefronts. Each sells three things; E opens the panel nearby.
function shop(id, name, tag, x, y, items) {
  return { id, name, tag, x, y, items };
}
export const SHOPS = [
  shop('arms', 'HARBOR ARMS', 'guns · ammo', 520, 430, [
    { name: 'SMG mags +120', price: 150, kind: 'ammo', weapon: 'smg', amount: 120 },
    { name: 'Shells +20', price: 120, kind: 'ammo', weapon: 'shotgun', amount: 20 },
    { name: 'Rifle rounds +30', price: 180, kind: 'ammo', weapon: 'rifle', amount: 30 },
  ]),
  shop('diner', 'PIER 9 DINER', 'food · health', 3050, 720, [
    { name: 'Pier meal +40 HP', price: 80, kind: 'heal', amount: 40 },
    { name: 'Black coffee +15 HP', price: 30, kind: 'heal', amount: 15 },
    { name: 'Full course +100 HP', price: 200, kind: 'heal', amount: 100 },
  ]),
  shop('mart', 'NEON MART', 'snacks · ammo', 1300, 860, [
    { name: 'Snack pack +25 HP', price: 50, kind: 'heal', amount: 25 },
    { name: 'SMG mags +60', price: 90, kind: 'ammo', weapon: 'smg', amount: 60 },
    { name: 'Energy drink +10 HP', price: 25, kind: 'heal', amount: 10 },
  ]),
];

// --- Radio -----------------------------------------------------------------
function station(id, name, desc, tracks) {
  return { id, name, desc, tracks };
}
export const RADIO_STATIONS = [
  station('vnl', 'VNL 88.5', 'Virelia Nights Live', [
    'Neon Tide — Midnight Run', 'Glass Palms — Sunset Drive',
    'Mara’s Theme — One Last Job', 'Ferry Lights — Slow Burn',
  ]),
  station('wave', 'WAVE 101.2', 'Harbor FM', [
    'Salt Air — Coastline', 'Pelican Blues — Dockside',
    'Harbor Lights — Last Ferry', 'Boardwalk — Golden Hour',
  ]),
  station('vpd', 'VPD 7', 'Police dispatch', [
    'Dispatch — all units stand by', 'Dispatch — patrol the Strip',
    'Dispatch — pier watch tonight',
  ]),
];
export const RADIO_DISPATCH = [
  'Unit 12: suspicious Comet Sprint near the East Pier',
  'All units: violet coupe last seen on the Neon Strip',
  'Unit 7: report of a courier running the docks',
  'Dispatch: keep the boulevard clear for the evening ferry',
  'Unit 3: harbor vault alarm test at dawn — ignore the bells',
  'All units: Mara Voss is back in town. Eyes open.',
];

// --- Palette ---------------------------------------------------------------
export const PALETTE = {
  sky: '#0b0e1a',
  ground: '#171a2e',
  block: '#1d2140',
  block2: '#232748',
  road: '#23263c',
  roadLine: '#e8c34a',
  sidewalk: '#2e3252',
  park: '#123626',
  water: '#0e3a5c',
  bridge: '#3a3f66',
  neonPink: '#ff2e88',
  neonCyan: '#22e6ff',
  neonGold: '#ffc53d',
  player: '#ffd23d',
  police: '#2f7bff',
  policeLight: '#ff3b30',
  text: '#f2f4ff',
  muted: '#9aa3c7',
  panel: 'rgba(8,10,24,0.82)',
  danger: '#ff4d5e',
  health: '#3ddc84',
  money: '#7CFC9A',
  // Golden hour: warm sunset wash, sand and sea for the east coast.
  sunsetOrange: '#ff7a3d',
  sunsetPink: '#ff5e8a',
  sunsetGold: '#ffb347',
  sunsetSky: '#ff9a5e',
  sand: '#d9b380',
  sea: '#1d6f9e',
  seaDeep: '#0e3a5c',
  palm: '#1d5c36',
  shadow: 'rgba(20,8,30,0.28)',
};

// --- Car models (all invented names) ---------------------------------------
export const CAR_MODELS = [
  { name: 'Comet Sprint', color: '#e8452c', speed: 1.0 },
  { name: 'Aurora GT', color: '#22e6ff', speed: 1.12 },
  { name: 'Harbor Taxi', color: '#ffc53d', speed: 0.92 },
  { name: 'Dune Pickup', color: '#7dd069', speed: 0.95 },
  { name: 'Virelia Van', color: '#b9c0e8', speed: 0.85 },
  { name: 'Midnight Coupe', color: '#a06bff', speed: 1.08 },
  { name: 'Sunset Cruiser', color: '#ff7a3d', speed: 0.98 },
  { name: 'Pier Runner', color: '#3ddc84', speed: 1.03 },
];

// --- Named buildings the renderer paints signs for --------------------------
export const SIGN_NAMES = [
  'HOTEL BRISA', 'AZURA BANK', 'NEON GYM', 'SURF SHACK', 'PALM COURT HOTEL',
  'SUNSET MOTEL', 'DOCKSIDE WAREHOUSE', 'HARBOUR BOOKS', 'TACO PIER', 'VELVET ROOM',
  'PIER 9 DINER', 'NEON MART', 'HARBOR ARMS', 'VIRELIA MOTORS', 'GOLDEN ANCHOR',
  'THE LANTERN', 'CORAL BAR', 'SEASIDE PHARMACY', 'MARINA LOUNGE', 'BYTE CAFE',
  'HOTEL MIRAMAR', 'THE ROOFTOP', 'SAILOR’S REST', 'NEON BOWL', 'PIER 22',
  'HARBOUR GRILL', 'THE VAULT BAR', 'PALM READINGS', 'SUNSET TATTOO', 'COFFEE DOCK',
  'BAYSIDE HOTEL', 'THE GILDED EEL', 'FERRY TERMINAL', 'ORANGE GROVE', 'NEON NAILS',
  'THE CROWS NEST', 'HARBOR FLOWERS', 'TIDE POOL CAFE', 'MARA’S PLACE', 'KAI’S GARAGE',
];

// --- Districts: every one gets a name label painted on the map --------------
export const DISTRICTS = [
  { x: 1042, y: 606, label: 'NEON STRIP', sub: 'casino · lights all night' },
  { x: 2640, y: 2090, label: 'PORTSIDE DOCKS', sub: 'containers · no questions' },
  { x: 1914, y: 1478, label: 'HARBOR PARK', sub: 'the green heart of Virelia' },
  { x: 560, y: 560, label: 'OLD TOWN', sub: 'where Kai grew up' },
  { x: 2900, y: 1100, label: 'PALM BOULEVARD', sub: 'palms · beach · ocean' },
  { x: 3120, y: 668, label: 'EAST PIER', sub: 'ferries · the last stop' },
  { x: 824, y: 1696, label: 'HARBOR VAULT', sub: 'one night, one big score' },
  { x: 2568, y: 388, label: 'UPTOWN', sub: 'glass towers · old money' },
];

// --- Story: twelve missions, three days -------------------------------------
function mission(id, day, title, briefing, objective, complete) {
  return { id, day, title, briefing, objective, complete };
}
export const MISSIONS = [
  mission('parcel', 1, 'MISSION 1 — THE LAST PARCEL',
    'Mara Voss: "Kai, one parcel, one drop-off. Take it to the neon pier. No questions."',
    'Deliver the parcel to the glowing marker at the East Pier.',
    'Parcel delivered. Mara trusts you now — barely.'),
  mission('tail', 1, 'MISSION 2 — THE INFORMANT',
    'Mara Voss: "A rat named Dario is leaving town. Chase his car down and stop him — before he talks."',
    'Ram Dario\u2019s violet coupe until it stops. Get a car first!',
    'Dario is done talking. The crew owes you.'),
  mission('vault', 1, 'MISSION 3 — THE HARBOR VAULT',
    'Mara Voss: "The Harbor Vault. One night, one crew, one big score. Grab the cash and vanish."',
    'Reach the vault, grab the cash, then escape to the hideout marker.',
    'THE SCORE IS YOURS. Virelia is yours now, Kai Mercer.'),
  mission('neon-strip', 2, 'MISSION 4 — THE NEON STRIP',
    'Mara Voss: "One last score, Kai. The Neon Strip casino counts its cash at dawn. Take it — then vanish before the heli finds you."',
    'Reach the Neon Strip casino, grab the cash, then escape to the hideout marker.',
    'THE NEON STRIP IS YOURS. Four jobs, one legend — Kai Mercer.'),
  mission('portside', 2, 'MISSION 5 — THE PORTSIDE JOB',
    'Mara Voss: "Kai, the docks. Three crates of \u2018imported goods\u2019 sitting in Portside. Lift them, then lose the VPD at the hideout. And Kai — don\u2019t ask what\u2019s inside."',
    'Lift all 3 crates in the Portside docks, then escape to the hideout marker.',
    'THE PORTSIDE JOB IS DONE. Three crates, zero questions asked.'),
  mission('last-stand', 2, 'MISSION 6 — THE LAST STAND',
    'Mara Voss: "Last one, Kai. The whole VPD is coming for you. Survive the storm, put six of their cars down, and run for the East Pier. Virelia is yours after this."',
    'Survive wanted level 5: destroy 6 VPD cars, then escape to the East Pier.',
    'VIRELIA IS YOURS! Six jobs done — Kai Mercer is a legend now.'),
  mission('crew-calls', 3, 'MISSION 7 — THE CREW CALLS',
    'Mara Voss: "Day three, Kai. The city remembers everything — and so do I. Meet the crew on the Strip rooftop. The Harbor Vault heist starts tonight."',
    'Meet the crew at the Neon Strip rooftop.',
    'The crew is in. Tonight, the Harbor Vault.'),
  mission('inside-man', 3, 'MISSION 8 — THE INSIDE MAN',
    'Mara Voss: "Our man inside the vault works the casino floor. Pick him up at the Strip, then get him to the hideout before the VPD notices."',
    'Pick up the inside man at the casino, then bring him to the hideout.',
    'The inside man is safe. He knows the vault codes.'),
  mission('vault-codes', 3, 'MISSION 9 — THE VAULT CODES',
    'Mara Voss: "Azura Bank holds the vault codes in a safety box. Walk in quiet, walk out with the codes — then vanish to the hideout."',
    'Reach Azura Bank, grab the vault codes, then escape to the hideout.',
    'Codes in hand. The vault is just a door now.'),
  mission('getaway-plan', 3, 'MISSION 10 — THE GETAWAY PLAN',
    'Mara Voss: "A heist is only as good as its getaway. Check the ride at Virelia Motors, then run the escape route to the East Pier — timed."',
    'Check the getaway car at the garage, then run the route to the East Pier.',
    'Route timed, car ready. Tomorrow night, we go.'),
  mission('harbor-heist', 3, 'MISSION 11 — THE HARBOR VAULT HEIST',
    'Mara Voss: "This is it, Kai. The Harbor Vault, the whole crew, one night. Grab the cash and run — the whole VPD will be on you."',
    'Reach the Harbor Vault, grab the cash, then escape to the hideout.',
    'THE HARBOR VAULT IS OPEN. The biggest score in Virelia history.'),
  mission('final-score', 3, 'MISSION 12 — THE FINAL SCORE',
    'Mara Voss: "Last door, Kai. The vault\u2019s inner room holds the final score — and every cop in Virelia knows it. Grab it, outrun the heli, and meet me at the East Pier. A city that remembers… remembers you."',
    'Grab the final score at the vault, then escape to the East Pier with the heli on you.',
    'TWELVE JOBS DONE. Kai Mercer walks away a legend — Virelia is yours.'),
];
