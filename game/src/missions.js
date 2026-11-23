// missions.js — the story of Solstice Heat: twelve jobs for fixer Marisol Vega,
// from a first stolen coupe to the Neon Tide finale on Lighthouse Isle. Each
// mission is a list of objectives; this file runs them, spawns their actors
// (targets, escorts, rivals, attackers), and tells the HUD where the marker is.
// Side jobs live in sidejobs.js; this file is the campaign only.

import { WANTED } from './config.js';
import { clamp, dist, angleTo, angleDelta } from './random.js';
import { CAR_MODELS, BOAT_MODELS, makeVehicle, stepVehicle } from './vehicles.js';
import { addHeat, clearHeat } from './police.js';
import { sfx } from './audio.js';

const COUPE = CAR_MODELS[0];
const SEDAN = CAR_MODELS[1];
const VAN = CAR_MODELS[4];
const CABRIO = CAR_MODELS[5];
const HAULER = CAR_MODELS[6];
const RUNNER_BOAT = BOAT_MODELS[0];

// ---- special actors the campaign drives itself ----

function spawnActor(game, model, x, y, angle, color, driver, kind = 'car') {
  // Never leave an actor inside a building or the bay: spiral out to clear ground.
  if (kind === 'car') {
    let placed = false;
    for (let r = 0; r <= 130 && !placed; r += 18) {
      for (let a = 0; a < Math.PI * 2 && !placed; a += Math.PI / 5) {
        const nx = x + Math.cos(a) * r;
        const ny = y + Math.sin(a) * r;
        if (!game.city.collidesCircle(nx, ny, 24)) { x = nx; y = ny; placed = true; }
      }
    }
  }
  const v = makeVehicle(model, x, y, angle, color ?? model.colors[0], kind);
  v.driver = driver;
  v.mission = true;
  game.vehicles.push(v);
  return v;
}

// A target car that runs: it flees the player along the avenue graph.
function stepFleeCar(game, v, dt) {
  const p = game.player;
  const px = p.inVehicle && p.vehicle ? p.vehicle.x : p.x;
  const py = p.inVehicle && p.vehicle ? p.vehicle.y : p.y;
  if (!v.targetNode || dist(v.x, v.y, v.targetNode.x, v.targetNode.y) < 60) {
    const here = game.city.nearestNode(v.x, v.y);
    let best = null;
    let bestScore = -Infinity;
    for (const n of here.links) {
      const score = dist(n.x, n.y, px, py) - Math.random() * 120;
      if (score > bestScore) { bestScore = score; best = n; }
    }
    v.prevNode = here;
    v.targetNode = best ?? here;
  }
  const want = angleTo(v.x, v.y, v.targetNode.x, v.targetNode.y);
  stepVehicle(game, v, dt, { throttle: v.dead ? 0 : 0.94, steer: clamp(angleDelta(v.angle, want) * 2.4, -1, 1), brake: false, handbrake: false });
}

// A car driving a fixed list of waypoints (tail targets, the escort van, rivals).
function stepRouteCar(game, v, dt, speed = 0.62) {
  if (!v.routePts || v.routeIdx === undefined) return true;
  const pt = v.routePts[v.routeIdx];
  if (!pt) return true;
  if (dist(v.x, v.y, pt.x, pt.y) < 64) { v.routeIdx += 1; return v.routeIdx >= v.routePts.length; }
  const want = angleTo(v.x, v.y, pt.x, pt.y);
  let blocked = false;
  const ax = v.x + Math.cos(v.angle) * 66;
  const ay = v.y + Math.sin(v.angle) * 66;
  for (const o of game.vehicles) {
    if (o !== v && !o.dead && dist(ax, ay, o.x, o.y) < 40) blocked = true;
  }
  stepVehicle(game, v, dt, { throttle: blocked ? 0 : speed, steer: clamp(angleDelta(v.angle, want) * 2.4, -1, 1), brake: blocked, handbrake: false });
  return false;
}

export function stepMissionVehicle(game, v, dt) {
  if (v.driver === 'target') {
    if (v.mode === 'flee') stepFleeCar(game, v, dt);
    else if (v.mode === 'route') stepRouteCar(game, v, dt, v.cruiseSpeed ?? 0.6);
    else if (v.mode === 'attack') {
      const prey = v.prey && !v.prey.dead ? v.prey : game.player.vehicle ?? game.player;
      const want = angleTo(v.x, v.y, prey.x, prey.y);
      stepVehicle(game, v, dt, { throttle: 0.97, steer: clamp(angleDelta(v.angle, want) * 2.6, -1, 1), brake: false, handbrake: false });
    }
  } else if (v.driver === 'escort') {
    stepRouteCar(game, v, dt, 0.58);
  } else if (v.driver === 'rival') {
    stepRouteCar(game, v, dt, v.cruiseSpeed ?? 0.8);
    if (v.routePts && v.routeIdx >= v.routePts.length && !v.finished) {
      v.finished = true;
      if (game.mission) game.mission.rivalsDone = (game.mission.rivalsDone ?? 0) + 1;
    }
  }
}

// ---- the campaign ----

const CLUB = { x: 2060, y: 2060 };
const GARAGE = { x: 1740, y: 2620 };
const MARINA_DOCK = { x: 3520, y: 1760 };

export const MISSIONS = [
  {
    title: 'First Wheels', from: 'Marisol Vega', startAt: CLUB, reward: 300, rep: 10,
    intro: [
      ['Marisol', 'Jax Marlowe. Heard you can drive. Prove it.'],
      ['Marisol', 'There is an orange Marlowe Coupe parked up in Palm Heights. Bring it to the Neon Bay Garage. Clean.'],
    ],
    objectives: [
      { type: 'custom', text: 'Steal the orange Marlowe Coupe in Palm Heights', setup(g) {
          this.car = spawnActor(g, COUPE, 2450, 620, Math.PI / 2, '#e8641e', 'parked');
          this.car.marked = true;
        },
        check(g) {
          if (this.car.dead) return 'fail';
          this.target = this.car;
          if (g.player.vehicle === this.car) return 'done';
          return null;
        } },
      { type: 'deliverMarked', text: 'Deliver the coupe to the Neon Bay Garage', at: GARAGE },
    ],
  },
  {
    title: 'Boardwalk Run', from: 'Marisol Vega', startAt: CLUB, reward: 420, rep: 12,
    intro: [
      ['Marisol', 'A package is waiting under the Boardwalk pier sign. Casino Row wants it before the tables open.'],
      ['Jax', 'On it. Nobody tails me, nobody sees me.'],
    ],
    objectives: [
      { type: 'goto', text: 'Pick up the package on the Boardwalk', at: { x: 3130, y: 3180 }, r: 62, mode: 'foot' },
      { type: 'goto', text: 'Deliver it to the Casino Row valet', at: { x: 2980, y: 1560 }, r: 80, time: 150 },
    ],
  },
  {
    title: 'Armed and Ready', from: 'Marisol Vega', startAt: CLUB, reward: 520, rep: 14,
    intro: [
      ['Marisol', 'The Corso family is watching my club. Time you carried more than a smile, Jax.'],
      ['Marisol', 'My friend in the Neon Mile alley has a pistol for you. Then clear three of their lookouts.'],
    ],
    objectives: [
      { type: 'custom', text: 'Meet the contact in the Neon Mile alley', setup(g) {
          this.at = { x: 1520, y: 1830 };
          this.target = this.at;
        },
        check(g) {
          this.target = this.at;
          if (dist(g.player.x, g.player.y, this.at.x, this.at.y) < 60 && !g.player.inVehicle) {
            g.player.hasPistol = true;
            g.player.weapon = 'pistol';
            g.player.ammo += 60;
            g.fx.addText(g.player.x, g.player.y - 30, 'Pistol + 60 rounds', '#ffd166', 18);
            sfx.pickup();
            return 'done';
          }
          return null;
        } },
      { type: 'custom', text: 'Clear the three Corso lookouts', setup(g) {
          this.count = 0;
          this.lookouts = [];
          for (const [x, y] of [[2520, 1420], [1980, 2380], [2980, 2080]]) {
            const ped = { x, y, angle: 0, speed: 0, hp: 60, dead: false, downT: 0, panicT: 0, threatX: 0, threatY: 0, wanderT: 9, chatT: 0, shirt: '#5b2333', skin: '#d9a066', pants: '#1d1d24', walkPhase: 0, lookout: true };
            this.lookouts.push(ped);
            g.peds.push(ped);
          }
        },
        check(g) {
          const alive = this.lookouts.filter((l) => !l.dead);
          this.target = alive[0] ?? null;
          this.progress = `${3 - alive.length} / 3`;
          if (!alive.length) return 'done';
          return null;
        } },
      { type: 'escape', text: 'Lose the heat' },
    ],
  },
  {
    title: 'Hot Pursuit', from: 'Marisol Vega', startAt: CLUB, reward: 650, rep: 16,
    intro: [
      ['Marisol', 'That cabrio at the University is hot — plates, prints, everything. The SBPD is already rolling.'],
      ['Marisol', 'Get it to my lockup by the Port. And Jax — they will be on you the whole way.'],
    ],
    objectives: [
      { type: 'custom', text: 'Take the Solana Cabrio at the University', setup(g) {
          this.car = spawnActor(g, CABRIO, 700, 1560, 0, '#22d3ee', 'parked');
          this.car.marked = true;
        },
        check(g) {
          this.target = this.car;
          if (this.car.dead) return 'fail';
          if (g.player.vehicle === this.car) {
            addHeat(g, 300, g.player.x, g.player.y, true);
            return 'done';
          }
          return null;
        } },
      { type: 'deliverMarked', text: 'Reach the Port lockup with the cabrio', at: { x: 620, y: 2980 } },
      { type: 'escape', text: 'Now lose the SBPD' },
    ],
  },
  {
    title: 'Marina Blues', from: 'Marisol Vega', startAt: MARINA_DOCK, reward: 700, rep: 16,
    intro: [
      ['Marisol', 'Three of my buoys in the bay are stuffed with product. The coast guard swept the marina twice this week.'],
      ['Marisol', 'Take the Tide Runner from the dock. Empty every buoy. Bring it all back wet and quiet.'],
    ],
    objectives: [
      { type: 'boatRun', text: 'Empty the three bay buoys by boat', buoys: [{ x: 3980, y: 1180 }, { x: 4350, y: 2050 }, { x: 3900, y: 2750 }] },
      { type: 'goto', text: 'Return to the marina dock', at: MARINA_DOCK, r: 110 },
    ],
  },
  {
    title: 'Tail the Tail', from: 'Marisol Vega', startAt: CLUB, reward: 780, rep: 18,
    intro: [
      ['Marisol', 'A Corso bagman leaves the casino at dusk. Follow him home — close enough to learn, far enough to live.'],
      ['Jax', 'Too close he bolts, too far I lose him. I know the dance.'],
    ],
    objectives: [
      { type: 'custom', text: 'Pick up the bagman’s sedan at Casino Row', setup(g) {
          this.car = spawnActor(g, SEDAN, 3050, 1480, Math.PI, '#7a4a56', 'target');
          this.car.mode = 'route';
          this.car.cruiseSpeed = 0.52;
          const a = g.city.nearestNode(3050, 1480);
          const b = g.city.nearestNode(900, 700);
          this.car.routePts = g.city.route(a, b).map((n) => ({ x: n.x, y: n.y }));
          this.car.routePts.push({ x: 880, y: 660 });
          this.car.routeIdx = 0;
          this.spottedT = 0;
          this.lostT = 0;
        },
        check(g, dt) {
          this.target = this.car;
          const d = dist(g.player.x, g.player.y, this.car.x, this.car.y);
          if (d < 95) { this.spottedT += dt; this.progress = 'TOO CLOSE — back off!'; }
          else if (d > 330) { this.lostT += dt; this.progress = 'LOSING HIM — close in!'; }
          else { this.spottedT = Math.max(0, this.spottedT - dt); this.lostT = Math.max(0, this.lostT - dt); this.progress = 'On his tail'; }
          if (this.spottedT > 2.5 || this.lostT > 6) return 'fail';
          if (this.car.routeIdx >= this.car.routePts.length) return 'done';
          if (this.car.dead) return 'fail';
          return null;
        } },
      { type: 'goto', text: 'Slip away to the club', at: CLUB, r: 90 },
    ],
  },
  {
    title: 'Neon Convoy', from: 'Marisol Vega', startAt: CLUB, reward: 950, rep: 20,
    intro: [
      ['Marisol', 'My van carries tonight’s take to the Port. The Corsos know the route. They do not know about you.'],
      ['Marisol', 'Keep that van rolling, Jax. Whatever it costs them.'],
    ],
    objectives: [
      { type: 'custom', text: 'Escort Marisol’s van to the Port warehouse', setup(g) {
          const a = g.city.nearestNode(2060, 2200);
          const b = g.city.nearestNode(760, 3060);
          this.van = spawnActor(g, VAN, 2060, 2200, Math.PI / 2, '#c9a227', 'escort');
          this.van.routePts = g.city.route(a, b).map((n) => ({ x: n.x, y: n.y }));
          this.van.routePts.push({ x: 760, y: 3020 });
          this.van.routeIdx = 0;
          this.van.marked = true;
          this.wave = 0;
          this.waveT = 14;
        },
        check(g, dt) {
          this.target = this.van;
          if (this.van.dead) return 'fail';
          this.waveT -= dt;
          const attackersAlive = g.vehicles.some((v) => v.driver === 'target' && v.mode === 'attack' && !v.dead);
          if (this.waveT <= 0 && this.wave < 3 && !attackersAlive) {
            this.wave += 1;
            this.waveT = 26;
            for (let i = 0; i < 2; i += 1) {
              const atk = spawnActor(g, SEDAN, this.van.x + 420 + i * 60, this.van.y - 320 + i * 90, Math.PI, '#5b2333', 'target');
              atk.mode = 'attack';
              atk.prey = this.van;
            }
            g.banner('Corsos inbound — protect the van!', 2.6);
          }
          this.progress = `Van health ${Math.max(0, Math.round(this.van.health))}%`;
          if (this.van.routeIdx >= this.van.routePts.length) return 'done';
          return null;
        } },
    ],
  },
  {
    title: 'Island Drop', from: 'Marisol Vega', startAt: CLUB, reward: 880, rep: 18,
    intro: [
      ['Marisol', 'The lighthouse keeper on the isle takes a package every new moon. Tonight is the night.'],
      ['Marisol', 'Across the causeway, up to the light, and home before the tide turns. Clock is running.'],
    ],
    objectives: [
      { type: 'goto', text: 'Collect the package at the club', at: CLUB, r: 70 },
      { type: 'goto', text: 'Take it across the causeway to the lighthouse', at: { x: 4180, y: 940 }, r: 95, time: 170 },
      { type: 'goto', text: 'Get back to the club', at: CLUB, r: 90, time: 150 },
    ],
  },
  {
    title: 'Pink Slip', from: 'Rico Sandoval', startAt: { x: 1868, y: 2060 }, reward: 1100, rep: 22,
    intro: [
      ['Rico', 'Jax! Street race, winner takes the pink slips. Three of us, eight checkpoints, one king.'],
      ['Jax', 'Hope you like walking home, Rico.'],
    ],
    objectives: [
      { type: 'race', text: 'Win the street race', points: [
        { x: 1800, y: 1400 }, { x: 2600, y: 1400 }, { x: 3000, y: 1800 }, { x: 3000, y: 2600 },
        { x: 2200, y: 3000 }, { x: 1400, y: 3000 }, { x: 1400, y: 2200 }, { x: 1800, y: 1800 },
      ] },
    ],
  },
  {
    title: 'Five-Star Heat', from: 'Marisol Vega', startAt: CLUB, reward: 1250, rep: 24,
    intro: [
      ['Marisol', 'Tonight you are the distraction, Jax. Every badge in the bay chasing you is one not watching my boats.'],
      ['Marisol', 'Draw them out. Survive ninety seconds of everything they have. Then vanish to your flat.'],
    ],
    objectives: [
      { type: 'custom', text: 'Draw the SBPD out', setup(g) {
          addHeat(g, 480, g.player.x, g.player.y, true);
          this.t = 90;
        },
        check(g, dt) {
          if (g.police.stars < 3 && this.t < 84) addHeat(g, 300, g.player.x, g.player.y, true); // they keep coming
          this.t -= dt;
          this.progress = `${Math.max(0, Math.ceil(this.t))}s — stay alive, stay moving`;
          if (this.t <= 0) return 'done';
          return null;
        } },
      { type: 'escape', text: 'Lose them' },
      { type: 'goto', text: 'Reach your Boardwalk flat', at: { x: 2440, y: 3080 }, r: 90 },
    ],
  },
  {
    title: 'Port Authority', from: 'Marisol Vega', startAt: CLUB, reward: 1400, rep: 26,
    intro: [
      ['Marisol', 'A Port Hauler full of untaxed everything sits in the Port yard. The SBPD watches the gates now.'],
      ['Marisol', 'By the time you read this, they have roadblocks planned. Bring me that truck anyway.'],
    ],
    objectives: [
      { type: 'custom', text: 'Steal the Port Hauler from the Port yard', setup(g) {
          this.car = spawnActor(g, HAULER, 480, 2820, 0, '#8a4b2a', 'parked');
          this.car.marked = true;
        },
        check(g) {
          this.target = this.car;
          if (this.car.dead) return 'fail';
          if (g.player.vehicle === this.car) {
            addHeat(g, 260, g.player.x, g.player.y, true);
            return 'done';
          }
          return null;
        } },
      { type: 'deliverMarked', text: 'Deliver the hauler to the Old Town depot', at: { x: 1080, y: 620 } },
      { type: 'escape', text: 'Lose the heat' },
    ],
  },
  {
    title: 'Neon Tide', from: 'Marisol Vega', startAt: CLUB, reward: 2500, rep: 40,
    intro: [
      ['Marisol', 'One last tide, Jax. The Corso don himself lands at the marina tonight to end our little war.'],
      ['Marisol', 'Pick up my crew at the casino, run the bay by boat, and be standing at the lighthouse when he comes. End it.'],
    ],
    objectives: [
      { type: 'goto', text: 'Pick up the crew at Casino Row', at: { x: 2980, y: 1560 }, r: 85 },
      { type: 'boatRun', text: 'Run the bay — three buoys, no lights, no noise', buoys: [{ x: 4050, y: 1500 }, { x: 4420, y: 1150 }, { x: 4330, y: 700 }] },
      { type: 'goto', text: 'Beach the boat and reach the lighthouse', at: { x: 4180, y: 940 }, r: 100 },
      { type: 'custom', text: 'Hold the isle until the Don’s men give up', setup(g) {
          this.t = 45;
          addHeat(g, 200, g.player.x, g.player.y, true);
          for (let i = 0; i < 3; i += 1) {
            const ped = { x: 4040 + i * 90, y: 1080 - i * 30, angle: 0, speed: 0, hp: 70, dead: false, downT: 0, panicT: 0, threatX: 0, threatY: 0, wanderT: 9, chatT: 0, shirt: '#5b2333', skin: '#f2c9a0', pants: '#1d1d24', walkPhase: 0, lookout: true };
            g.peds.push(ped);
          }
        },
        check(g, dt) {
          this.t -= dt;
          this.progress = `${Math.max(0, Math.ceil(this.t))}s — hold the lighthouse`;
          if (this.t <= 0) return 'done';
          return null;
        } },
      { type: 'escape', text: 'Let the bay go quiet' },
    ],
  },
];

// ---- the runner ----

export function createMissionRunner() {
  return {
    active: null,        // { def, idx, objState, vehicles:Set, t }
    completed: new Set(),
    dialogue: [],
    failed: null,
    rivalsDone: 0,

    available(game) {
      for (let i = 0; i < MISSIONS.length; i += 1) {
        if (this.completed.has(i)) continue;
        if (i > 0 && !this.completed.has(i - 1)) return null; // strictly in story order
        return { index: i, def: MISSIONS[i] };
      }
      return null;
    },

    start(game, index) {
      const def = MISSIONS[index];
      this.active = { index, def, idx: 0, obj: null, state: {}, target: null, progress: '', timeLeft: null, vehicles: new Set() };
      this.rivalsDone = 0;
      for (const [who, text] of def.intro) this.dialogue.push({ who, text, t: 0 });
      sfx.missionStart();
      game.banner(def.title, 3);
      this.beginObjective(game);
    },

    beginObjective(game) {
      const a = this.active;
      const obj = a.def.objectives[a.idx];
      a.obj = obj;
      a.state = {};
      a.target = obj.at ?? null;
      a.timeLeft = obj.time ?? null;
      if (obj.type === 'race') this.setupRace(game, obj);
      if (obj.type === 'boatRun') { a.state.buoyIdx = 0; a.target = obj.buoys[0]; }
      if (obj.setup) obj.setup.call(a.state, game);
    },

    setupRace(game, obj) {
      const a = this.active;
      a.state.cpIdx = 0;
      a.target = obj.points[0];
      const grid = [[1742, 2030], [1858, 2030], [1800, 2102]];
      const models = [SEDAN, CABRIO, COUPE];
      for (let i = 0; i < 3; i += 1) {
        const v = spawnActor(game, models[i], grid[i][0], grid[i][1], -Math.PI / 2, null, 'rival');
        v.routePts = obj.points.map((p) => ({ ...p }));
        v.routeIdx = 0;
        v.cruiseSpeed = 0.78 + i * 0.05;
        v.finished = false;
        a.vehicles.add(v);
      }
    },

    currentTarget() {
      if (!this.active) return null;
      const t = this.active.state.target ?? this.active.target;
      return t ? { x: t.x, y: t.y } : null;
    },

    currentText() {
      if (!this.active) return null;
      return this.active.obj.text;
    },

    fail(game, reason) {
      if (!this.active) return;
      this.failed = { title: this.active.def.title, reason, index: this.active.index };
      this.cleanup(game);
      this.active = null;
      sfx.fail();
    },

    cleanup(game) {
      // Mission actors that are still rolling become ordinary traffic or stay parked.
      for (const v of game.vehicles) {
        if (!v.mission) continue;
        v.marked = false;
        if (v.driver === 'target' || v.driver === 'escort' || v.driver === 'rival') {
          v.driver = 'traffic';
          v.targetNode = null;
        }
        v.mission = false;
      }
    },

    complete(game) {
      const a = this.active;
      this.completed.add(a.index);
      game.addCash(a.def.reward);
      game.addRespect(a.def.rep);
      game.fx.confetti(game.player.x, game.player.y);
      sfx.missionDone();
      game.banner(`Mission complete — ${a.def.title} · $${a.def.reward}`, 3.4);
      this.cleanup(game);
      this.active = null;
      game.saveGame();
      if (a.index === MISSIONS.length - 1) game.onCampaignComplete();
    },

    update(game, dt) {
      // Dialogue ticks down on its own clock.
      if (this.dialogue.length) {
        this.dialogue[0].t += dt;
        if (this.dialogue[0].t > 3.8) this.dialogue.shift();
      }
      const a = this.active;
      if (!a) return;
      const obj = a.obj;
      if (a.timeLeft !== null && a.timeLeft !== undefined) {
        a.timeLeft -= dt;
        if (a.timeLeft <= 0) { this.fail(game, 'Out of time.'); return; }
      }
      let result = null;
      const p = game.player;
      const px = p.inVehicle && p.vehicle ? p.vehicle.x : p.x;
      const py = p.inVehicle && p.vehicle ? p.vehicle.y : p.y;
      switch (obj.type) {
        case 'goto': {
          a.target = obj.at;
          const okMode = !obj.mode || (obj.mode === 'foot' ? !p.inVehicle : p.inVehicle);
          if (okMode && dist(px, py, obj.at.x, obj.at.y) < (obj.r ?? 70)) result = 'done';
          break;
        }
        case 'deliverMarked': {
          a.target = obj.at;
          const marked = game.vehicles.find((v) => v.marked);
          if (marked) {
            a.state.target = marked;
            if (marked.dead) result = 'fail';
            else if (p.vehicle === marked && dist(marked.x, marked.y, obj.at.x, obj.at.y) < 105) result = 'done';
          }
          break;
        }
        case 'escape': {
          a.target = null;
          if (game.police.stars === 0) result = 'done';
          break;
        }
        case 'boatRun': {
          const buoy = obj.buoys[a.state.buoyIdx];
          a.target = buoy;
          a.progress = `Buoy ${a.state.buoyIdx + 1} of ${obj.buoys.length}`;
          if (buoy && dist(px, py, buoy.x, buoy.y) < 85) {
            sfx.checkpoint();
            game.fx.addText(buoy.x, buoy.y - 24, 'Collected', '#7bf1a8', 16);
            a.state.buoyIdx += 1;
            if (a.state.buoyIdx >= obj.buoys.length) result = 'done';
          }
          break;
        }
        case 'race': {
          const cp = obj.points[a.state.cpIdx];
          a.target = cp;
          a.progress = `Checkpoint ${Math.min(a.state.cpIdx + 1, obj.points.length)} of ${obj.points.length} · P${this.rivalsDone + 1}`;
          if (cp && dist(px, py, cp.x, cp.y) < 95) {
            sfx.checkpoint();
            a.state.cpIdx += 1;
            if (a.state.cpIdx >= obj.points.length) {
              if (this.rivalsDone === 0) game.addCash(400); // winner's bonus on top of the fee
              result = 'done';
            }
          }
          break;
        }
        case 'custom': {
          result = obj.check.call(a.state, game, dt);
          a.target = a.state.target ?? null;
          a.progress = a.state.progress ?? '';
          break;
        }
        default: break;
      }
      if (result === 'done') {
        a.idx += 1;
        if (a.idx >= a.def.objectives.length) this.complete(game);
        else {
          sfx.checkpoint();
          this.beginObjective(game);
        }
      } else if (result === 'fail') {
        this.fail(game, 'The job fell apart.');
      }
    },
  };
}
