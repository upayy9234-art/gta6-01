// ============================================================================
// SOLSTICE HEAT — config.js
// Central data + tuning for the whole game. Every other module reads its
// constants from here so the city layout, the mission chain, the radio
// playlist and the physics tuning all live in exactly one place.
// Round 11 adds: the reputation ladder + economy tuning, the side-job
// economy (courier / checkpoint race / VIP runs), police radio chatter
// lines, pedestrian barks and the billboard copy for the new city props.
// ============================================================================
(function () {
'use strict';
window.SH = window.SH || {};

// --- Road grid -------------------------------------------------------------
// Vertical roads run north-south (along +z), horizontal roads east-west.
// Intersections of VX x HZ form the traffic network. Blocks sit between
// roads; each block interior is PITCH - ROAD wide.
var VX = [-174, -116, -58, 0, 58, 116, 174];
var HZ = [-145, -87, -29, 29, 87, 145];

SH.Config = {
  // Fixed seed for city generation: the layout is identical on every load,
  // which keeps colliders, named buildings and mission spots consistent.
  citySeed: 1337,

  world: {
    vx: VX,
    hz: HZ,
    pitch: 58,          // distance between neighbouring road centrelines
    roadHalf: 7,        // half the width of a road
    lane: 3.4,          // lane offset from road centreline (right-hand traffic)
    blockSize: 44,      // buildable square inside the sidewalk ring
    slabX1: -188, slabX2: 196,   // paved city slab (promenade at east edge)
    slabZ1: -160, slabZ2: 160,
    sandX: 250,         // where the beach gives up and the sea begins
    pierX: 262,         // walkable end of the marina pier
    pierHalfZ: 4.6,     // pier deck half width
    worldX1: -186, worldX2: 244,
    worldZ1: -158, worldZ2: 158
  },

  palette: {
    sand: 0xe8cf9e,
    water: 0x1f8a9e,
    waterDeep: 0x146b80,
    asphalt: 0x3c4148,
    sidewalk: 0x9aa0a3,
    slab: 0x8d9299,
    grass: 0x69a85c,
    palmTrunk: 0x8a6b48,
    palmLeaf: 0x2f9e5f,
    // pastel art-deco building colours
    deco: [0xf6d8b1, 0xf3b8c6, 0xa8d8d8, 0xf9e79f, 0xd5c6e8, 0xf5c396,
           0xbfe3c0, 0xf2a7a7, 0x9fc6e8, 0xf6e3ce, 0xcfe0b8, 0xe8b4d8],
    carPaint: [0xc0392b, 0x2471a3, 0xf39c12, 0x27ae60, 0x8e44ad, 0xecf0f1,
               0x2c3e50, 0xe67e22, 0x16a085, 0xd35400, 0xf1c40f, 0x7fb3d5],
    shirt: [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0xe67e22, 0x9b59b6,
            0xecf0f1, 0x1abc9c, 0xfd79a8, 0x00cec9],
    skin: [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac],
    pants: [0x2c3e50, 0x5d6d7e, 0x784212, 0x1a5276, 0x616a6b, 0x922b21]
  },

  districts: {
    cols: ['Old Portside', 'Calle Palma', 'Downtown', 'Solstice Heights', 'Neon Mile', 'Marina District'],
    rows: ['Aurora Row', 'Flamingo Quarter', 'Calle Ocho', 'Bayfront', 'Marina Row', 'Tidewater']
  },

  streetsV: ['Harbor Ave', 'Calle Palma', 'Meridian Blvd', 'Solstice Ave', 'Neon Mile', 'Coral Drive', 'Boardwalk'],
  streetsH: ['Aurora Way', 'Flamingo Rd', 'Calle Ocho', 'Bayfront Pkwy', 'Marina Blvd', 'Tidewater Ln'],

  // Named buildings placed on fixed blocks: [col, row, name, sign colour].
  namedBuildings: [
    [4, 1, 'HOTEL DEL SOL', '#ffb347'],
    [2, 2, 'BANCO SOLSTICE', '#7fd4ff'],
    [3, 1, 'PALMS CASINO', '#ff5e8a'],
    [1, 3, 'STARFISH DINER', '#ffe66d'],
    [5, 2, 'MARINA AZUL', '#5ee8d2'],
    [3, 3, 'CLUB SIRENA', '#c77dff'],
    [2, 4, 'SOLSTICE MOTORS', '#ffa94d'],
    [0, 2, 'CAFE BRISA', '#a3e635'],
    [5, 0, 'THE GILDED PALM', '#ffd700'],
    [4, 4, 'TIDEWATER INN', '#7dd3fc']
  ],

  // Round 11: rooftop + roadside billboard copy [col, row, headline, colour].
  // city.js mounts these on existing blocks — flat planes, no new draw
  // call storms (one shared geometry, one canvas texture each).
  billboards: [
    [1, 1, 'SOLSTICE COLA — TASTE THE SUNSET', '#ff5e8a'],
    [3, 2, 'PALMS CASINO · JACKPOT NIGHTS', '#ffd94d'],
    [5, 3, 'MARINA AZUL BOAT RENTALS', '#5ee8d2'],
    [0, 4, 'CAFE BRISA · OPEN TIL DAWN', '#a3e635'],
    [4, 0, 'GILDED PALM — STAY GOLDEN', '#ffd700']
  ],

  // Named places missions and taxi jobs point at. Coordinates sit on the
  // sidewalk ring of the matching block (or on the promenade for the marina)
  // so both the player on foot and a car can always reach them.
  locations: {
    marina:  { x: 200,  z: 0,    label: 'Marina Pier' },
    garage:  { x: -30,  z: 98,   label: 'Solstice Motors' },
    diner:   { x: -87,  z: 39,   label: 'Starfish Diner' },
    bank:    { x: -102, z: -50,  label: 'Banco Solstice' },
    casino:  { x: 87,   z: 39,   label: 'Palms Casino' },
    hotel:   { x: 87,   z: -50,  label: 'Hotel Del Sol' },
    club:    { x: 30,   z: 97,   label: 'Club Sirena' },
    cafe:    { x: -145, z: -20,  label: 'Cafe Brisa' },
    inn:     { x: 87,   z: 97,   label: 'Tidewater Inn' },
    gilded:  { x: 145,  z: -97,  label: 'The Gilded Palm' },
    depot:   { x: 168,  z: 138,  label: 'Taxi Depot' }
  },

  // Briefcase spots for mission 4 (alleys and block corners).
  caseSpots: [
    { x: -64, z: -36 }, { x: 60, z: 90 }, { x: 118, z: -30 }
  ],

  tuning: {
    trafficCount: 12,
    parkedCount: 10,
    pedCount: 20,
    maxPolice: 5,
    playerWalk: 5.2,
    playerSprint: 8.6,
    playerHealth: 100,
    dayLength: 420,        // seconds for a full sun cycle (slow, golden-anchored)
    dayStart: 0.44,        // start in warm late afternoon, sliding into golden hour
    shotSeed: 7,
    driftSmokeMax: 90,     // hard cap on live drift-smoke sprites (FPS guard)
    nearMissDist: 3.1,     // metres: closer than this at speed = near miss
    nearMissSpeed: 11,     // m/s minimum speed for a near miss to count
    nearMissCooldown: 1.6  // seconds between near-miss bonuses per car pair run
  },

  // --- Reputation + economy (Round 11, economy.js) -------------------------
  // Five rungs from Street Rat to Solstice Legend. XP comes from missions,
  // side jobs and taxi fares; each rung raises every payout by payoutBonus
  // per level and unlocks bragging rights on the title screen.
  economy: {
    levels: [
      { name: 'Street Rat',      xp: 0 },
      { name: 'Runner',          xp: 400 },
      { name: 'Fixer',           xp: 1200 },
      { name: 'Kingpin',         xp: 2800 },
      { name: 'Solstice Legend', xp: 5500 }
    ],
    payoutBonusPerLevel: 0.08,  // +8% cash per reputation level
    bankShare: 0.15,            // 15% of every payout is banked automatically
    xpPerMission: 220,
    xpPerJob: 90,
    xpPerFare: 45,
    xpPerNearMiss: 2
  },

  // --- Side jobs (Round 11, jobs.js) ---------------------------------------
  // Repeatable work picked up at glowing job boards scattered over the bay.
  // Payouts scale with distance, reputation level and the current streak.
  jobs: {
    pickupPoints: [
      { x: -145, z: -97, label: 'Portside Job Board' },
      { x: -30,  z: -50, label: 'Downtown Job Board' },
      { x: 87,   z: 39,  label: 'Casino Job Board' },
      { x: 30,   z: 138, label: 'Tidewater Job Board' },
      { x: 168,  z: 138, label: 'Depot Job Board' },
      { x: 196,  z: -58, label: 'Marina Job Board' }
    ],
    types: {
      courier: { label: 'Courier Run',   base: 60,  perMeter: 0.55, timePerMeter: 0.42, timeBase: 35 },
      race:    { label: 'Checkpoint Rush', base: 80, perMeter: 0.35, timePerMeter: 0.30, timeBase: 22 },
      vip:     { label: 'VIP Ride',      base: 95,  perMeter: 0.75, timePerMeter: 0.55, timeBase: 45 }
    },
    streakBonus: 0.12,       // +12% per consecutive completed job (cap +60%)
    streakCap: 5,
    raceCheckpoints: 3,      // gates per checkpoint-rush job
    pickupRadius: 9          // metres: press J inside this ring to take a job
  },

  // SBPD radio chatter (police.js): ambient lines per wanted tier.
  policeChatter: {
    low: [
      'Dispatch: unit responding to a disturbance in the bay.',
      'Dispatch: keep eyes open, suspect vehicle in the area.',
      'Unit 4: rolling through downtown, nothing yet.'
    ],
    mid: [
      'Dispatch: all units, suspect is actively evading.',
      'Unit 2: I have eyes on the suspect — moving to intercept.',
      'Dispatch: road spikes are NOT authorised. Repeat, not authorised.'
    ],
    high: [
      'Dispatch: ALL UNITS — suspect is a bay-wide priority.',
      'Unit 7: he is not stopping. Repeat, he is NOT stopping.',
      'Dispatch: contain the suspect. The bay is watching.'
    ]
  },

  // Pedestrian barks (people.js): overheard flavour lines.
  barks: {
    calm: [
      'Nice night for it.', 'Golden hour never misses.', 'You smell that salt air?',
      'Marina party tonight, you going?', 'Best tacos on Calle Ocho, fight me.'
    ],
    job: [
      'Heard the job boards pay better if you behave.', 'Courier work? Fast money, friend.',
      'My cousin does VIP runs. Says the tips are unreal.'
    ],
    wanted: [
      'Whoa — SBPD is really after that one!', 'Get out of the road!',
      'Somebody call the police! …oh. They are here.', 'I saw nothing. NOTHING.'
    ]
  },

  // --- Story chain ---------------------------------------------------------
  // type: goto | deliver | chase | collect | escape | finale | jobs | crown
  missions: [
    {
      id: 'errand', title: 'First Errand', type: 'goto', payout: 250,
      from: 'Marisol Vega',
      intro: [
        'Marisol: You came. Good. I fix problems for people in this bay, and tonight you are my solution.',
        'Marisol: A package is waiting at Marina Pier. Pick it up, bring your manners, come back rich-ish.'
      ],
      objective: 'Pick up the package at Marina Pier',
      target: 'marina'
    },
    {
      id: 'hotwheels', title: 'Hot Wheels', type: 'deliver', payout: 600, time: 150,
      from: 'Marisol Vega',
      intro: [
        'Marisol: A gold sedan near the Starfish Diner has... changed owners. Paperwork is boring.',
        'Marisol: Take it to Solstice Motors before the clock eats your fee. Do not scratch the paint.'
      ],
      objective: 'Steal the gold sedan and deliver it to Solstice Motors',
      target: 'garage'
    },
    {
      id: 'tailspin', title: 'Tailspin', type: 'chase', payout: 900,
      from: 'Marisol Vega',
      intro: [
        'Marisol: A courier for the Ortega crew is running a red coupe out of Hotel Del Sol.',
        'Marisol: Stop that car. Bump it, box it, beach it — I do not care how. Just stop it.'
      ],
      objective: 'Stop the red coupe fleeing Hotel Del Sol',
      target: 'hotel'
    },
    {
      id: 'roofmoney', title: 'Roof Money', type: 'collect', payout: 1200,
      from: 'Marisol Vega',
      intro: [
        'Marisol: Three cash cases got scattered across downtown when a deal went loud.',
        'Marisol: Alleys, corners, rooftops — find all three before someone else does.'
      ],
      objective: 'Collect the cash cases (0/3)',
      target: null
    },
    {
      id: 'cooloff', title: 'Cool Off', type: 'escape', payout: 1500,
      from: 'Marisol Vega',
      intro: [
        'Marisol: The bay is watching you now. Three stars of attention, all of it mine to clean up.',
        'Marisol: Lose the heat completely and I will make it worth your while. Stay out of sight.'
      ],
      objective: 'Lose the police completely',
      target: null
    },
    {
      id: 'finaltide', title: 'Final Tide', type: 'finale', payout: 3000,
      from: 'Marisol Vega',
      intro: [
        'Marisol: Last run, partner. One case leaves Banco Solstice tonight — heavy, hot, and mine.',
        'Marisol: The whole bay will chase you. Bring it to Marina Pier and we are legends.'
      ],
      objective: 'Take the case from Banco Solstice',
      target: 'bank'
    },
    {
      id: 'nightledger', title: 'Night Ledger', type: 'jobs', payout: 1800, jobsNeeded: 2,
      from: 'Marisol Vega',
      intro: [
        'Marisol: New books, partner. The bay runs on side work now — couriers, checkpoints, VIPs.',
        'Marisol: Work the job boards. Finish two jobs, any two, and the ledger opens for you.'
      ],
      objective: 'Complete side jobs (0/2) — press J at a job board',
      target: null
    },
    {
      id: 'crown', title: 'Solstice Crown', type: 'crown', payout: 5000, time: 240,
      from: 'Marisol Vega',
      intro: [
        'Marisol: One last crown to lift. The Gilded Palm keeps a jeweled case in its lobby.',
        'Marisol: Take it, outrun five stars AND the clock, and set it down at Marina Pier. Legend stuff.'
      ],
      objective: 'Take the crown case from The Gilded Palm',
      target: 'gilded'
    }
  ],

  radio: [
    { name: 'SOLSTICE FM', freq: '98.1', tracks: [
      'Golden Hour Drive — The Palms', 'Salt on the Wind — Vera Coast',
      'Convertible Weather — Dario Luz', 'Bay Lights — Nena Mar'
    ] },
    { name: 'PALM WAVE', freq: '102.7', tracks: [
      'Tropic Static — Mono Club', 'Ice in July — Carla Fenn',
      'Slow Tide — The Breakwaters', 'Marina Moon — Sol Y Mar'
    ] },
    { name: 'NEON NIGHTS', freq: '88.5', tracks: [
      'Sirena — Violet Arcade', 'Midnight Boardwalk — KAIRO',
      'Chrome Palms — LUXE', 'Last Ferry — Ana Solace'
    ] }
  ],

  taxiNames: ['Rosa', 'Tito', 'Ana', 'Marco', 'Lena', 'Yusuf', 'Priya', 'Diego', 'Mina', 'Omar'],
  vipNames: ['Senator Voss', 'DJ Marlin', 'Chef Aurelia', 'Countess Rey', 'Captain Ilya', 'Madame Noor']
};
})();
