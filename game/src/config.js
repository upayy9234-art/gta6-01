// Neon Harbor — every tuning number, colour and story constant in one place.
// Original city: Virelia, a neon harbour city. Original hero: KAI MERCER, a courier
// pulled into one last job by fixer MARA VOSS. No Rockstar / GTA names anywhere.
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const WORLD = { width: 3400, height: 2400, block: 340, road: 96 };
export const SAVE_KEY = 'neon-harbor.save.v1';
export const BEST_KEY = 'neon-harbor.best';

export const PLAYER = {
  radius: 13, walkSpeed: 205, runSpeed: 285, health: 100,
  punchDamage: 12, bulletDamage: 34, fireInterval: 0.22, bulletSpeed: 780,
};
export const CAR = {
  length: 64, width: 30, accel: 420, brake: 620, reverse: 190,
  maxSpeed: 560, turnRate: 2.6, drag: 0.55, grip: 6.5, health: 160,
};
export const WANTED = { decay: 0.045, perCrime: 1, max: 5, chaseSpeed: 500 };
export const MISSION_REWARD = [400, 900, 2200, 3000, 4200, 6000];
export const GARAGE = { x: 700, y: 388, label: 'VIRELIA MOTORS — GARAGE' };
export const WEAPON_SHOP = { x: 500, y: 388, label: 'HARBOR ARMS — WEAPONS' };
export const HELI = { speed: 430, hoverLag: 0.9, bobAmp: 12, shootRange: 520, fireInterval: 0.9, bulletSpeed: 700 };

export const PALETTE = {
  sky: '#0b0e1a', ground: '#171a2e', block: '#1d2140', block2: '#232748',
  road: '#23263c', roadLine: '#e8c34a', sidewalk: '#2e3252', park: '#123626',
  water: '#0e3a5c', bridge: '#3a3f66', neonPink: '#ff2e88', neonCyan: '#22e6ff',
  neonGold: '#ffc53d', player: '#ffd23d', police: '#2f7bff', policeLight: '#ff3b30',
  text: '#f2f4ff', muted: '#9aa3c7', panel: 'rgba(8,10,24,0.82)', danger: '#ff4d5e',
  health: '#3ddc84', money: '#7CFC9A',
};
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// Car models available in Virelia (all invented names).
export const CAR_MODELS = [
  { name: 'Comet Sprint', color: '#e8452c', speed: 1.0 },
  { name: 'Aurora GT', color: '#22e6ff', speed: 1.12 },
  { name: 'Harbor Taxi', color: '#ffc53d', speed: 0.92 },
  { name: 'Dune Pickup', color: '#7dd069', speed: 0.95 },
  { name: 'Virelia Van', color: '#b9c0e8', speed: 0.85 },
  { name: 'Midnight Coupe', color: '#a06bff', speed: 1.08 },
  { name: 'Sunset Cruiser', color: '#ff7a3d', speed: 0.98 },
];

export const MISSIONS = [
  {
    id: 'parcel', title: 'MISSION 1 — THE LAST PARCEL',
    briefing: 'Mara Voss: "Kai, one parcel, one drop-off. Take it to the neon pier. No questions."',
    objective: 'Deliver the parcel to the glowing marker at the East Pier.',
    complete: 'Parcel delivered. Mara trusts you now — barely.',
  },
  {
    id: 'tail', title: 'MISSION 2 — THE INFORMANT',
    briefing: 'Mara Voss: "A rat named Dario is leaving town. Chase his car down and stop him — before he talks."',
    objective: 'Ram Dario\u2019s violet coupe until it stops. Get a car first!',
    complete: 'Dario is done talking. The crew owes you.',
  },
  {
    id: 'vault', title: 'MISSION 3 — THE HARBOR VAULT',
    briefing: 'Mara Voss: "The Harbor Vault. One night, one crew, one big score. Grab the cash and vanish."',
    objective: 'Reach the vault, grab the cash, then escape to the hideout marker.',
    complete: 'THE SCORE IS YOURS. Virelia is yours now, Kai Mercer.',
  },
  {
    id: 'neon-strip', title: 'MISSION 4 — THE NEON STRIP',
    briefing: 'Mara Voss: "One last score, Kai. The Neon Strip casino counts its cash at dawn. Take it — then vanish before the heli finds you."',
    objective: 'Reach the Neon Strip casino, grab the cash, then escape to the hideout marker.',
    complete: 'THE NEON STRIP IS YOURS. Four jobs, one legend — Kai Mercer.',
  },
  {
    id: 'portside', title: 'MISSION 5 — THE PORTSIDE JOB',
    briefing: 'Mara Voss: "Kai, the docks. Three crates of \u2018imported goods\u2019 sitting in Portside. Lift them, then lose the VPD at the hideout. And Kai — don\u2019t ask what\u2019s inside."',
    objective: 'Lift all 3 crates in the Portside docks, then escape to the hideout marker.',
    complete: 'THE PORTSIDE JOB IS DONE. Three crates, zero questions asked.',
  },
  {
    id: 'last-stand', title: 'MISSION 6 — THE LAST STAND',
    briefing: 'Mara Voss: "Last one, Kai. The whole VPD is coming for you. Survive the storm, put six of their cars down, and run for the East Pier. Virelia is yours after this."',
    objective: 'Survive wanted level 5: destroy 6 VPD cars, then escape to the East Pier.',
    complete: 'VIRELIA IS YOURS! Six jobs done — Kai Mercer is a legend now.',
  },
];
