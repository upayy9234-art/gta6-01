// missions.js — Marisol Vega's twelve jobs: the campaign of Solstice Heat.
// Each mission is a small state machine with an objective marker and a GPS
// target. Finish one and the next unlocks; get wasted or busted and the job
// is off — Marisol will offer it again.

import { poi } from './city.js';
import { WANTED } from './config.js';
import { rand, clamp, dist, angleTo, angleDiff } from './random.js';
import { makeVehicle } from './vehicles.js';
import { makePed, scarePeds } from './pedestrians.js';
import { forceHeat, reportCrime } from './police.js';

export class Missions {
  constructor(G) {
    this.index = 0;          // next mission Marisol offers
    this.active = null;      // runtime state of the running mission
    this.campaignDone = false;
    this.defs = buildDefs();
    this.talkRange = 52;
  }

  currentDef() {
    return this.active ? this.active.def : this.defs[this.index] || null;
  }

  available() {
    return !this.active && this.index < this.defs.length;
  }

  start(G) {
    const def = this.defs[this.index];
    if (!def || this.active) return;
    const m = { def, t: 0, stage: 0, data: {} };
    this.active = m;
    if (def.setup) def.setup(G, m);
    G.notify('Mission: ' + def.title, '#ffd94a');
    if (def.intro) G.notify(def.intro, '#ffffff');
    G.audio.levelup();
    G.saveGame();
  }

  complete(G) {
    const m = this.active;
    if (!m) return;
    G.addCash(m.def.pay, G.player.x, G.player.y);
    G.notify(m.def.title + ' complete — ' + '$' + m.def.pay.toLocaleString('en-US'), '#7fe8a8');
    G.audio.cash();
    this.cleanup(G, m);
    this.active = null;
    this.index++;
    if (this.index >= this.defs.length) {
      this.campaignDone = true;
      G.notify('CAMPAIGN COMPLETE — Jax Marlin owns the Neon Tide.', '#ffd94a');
      G.audio.levelup();
    }
    G.saveGame();
  }

  fail(G, why) {
    if (!this.active) return;
    G.notify('Mission failed: ' + why, '#ff8a7a');
    G.audio.fail();
    this.cleanup(G, this.active);
    this.active = null;
    G.saveGame();
  }

  cleanup(G, m) {
    if (m.data.vehicles) {
      for (const v of m.data.vehicles) {
        const i = G.vehicles.indexOf(v);
        if (i >= 0 && v.driver !== 'player') G.vehicles.splice(i, 1);
      }
    }
    if (m.data.hostiles) {
      for (const h of m.data.hostiles) {
        const i = G.hostiles.indexOf(h);
        if (i >= 0) G.hostiles.splice(i, 1);
      }
    }
    G.objective = null;
  }

  onPlayerDown(G) {
    if (this.active) this.fail(G, 'you went down');
  }

  onEnterVehicle(G, v) {
    const m = this.active;
    if (m && m.def.onEnterVehicle) m.def.onEnterVehicle(G, m, v);
  }

  update(G, dt) {
    const p = G.player;
    // Talking to Marisol starts the next job.
    if (this.available() && !p.vehicle) {
      const mp = poi('marisol');
      if (dist(p.x, p.y, mp.x, mp.y) < this.talkRange) {
        G.prompt = 'E — Talk to Marisol Vega';
        if (G.input.hit('KeyE')) this.start(G);
      }
      G.missionMarker = { x: mp.x, y: mp.y, label: 'M' };
    } else if (this.active) {
      G.missionMarker = null;
    } else {
      G.missionMarker = null;
    }

    const m = this.active;
    if (!m) return;
    m.t += dt;
    if (m.def.update) {
      const result = m.def.update(G, m, dt);
      if (result === 'done') this.complete(G);
      else if (result && result.startsWith('fail')) this.fail(G, result.slice(5) || 'objective lost');
    }
    if (this.active && m.def.objective) {
      G.objective = m.def.objective(G, m);
    }
    updateHostiles(G, dt);
  }
}

// Hostile gunmen (shootout lookouts, truck guards): they hold ground, strafe
// a little, and shoot the player on sight.
function updateHostiles(G, dt) {
  const p = G.player;
  for (const h of G.hostiles) {
    if (h.health <= 0) continue;
    h.walkCycle += dt * 7;
    const d = dist(h.x, h.y, p.x, p.y);
    h.angle = angleTo(h.x, h.y, p.x, p.y);
    if (d > 200) {
      h.x += Math.cos(h.angle) * h.speed * dt;
      h.y += Math.sin(h.angle) * h.speed * dt;
    } else if (d < 90) {
      h.x -= Math.cos(h.angle) * h.speed * 0.6 * dt;
      h.y -= Math.sin(h.angle) * h.speed * 0.6 * dt;
    } else {
      h.x += Math.cos(h.angle + Math.PI / 2) * Math.sin(G.time * 1.3 + h.seed) * 34 * dt;
      h.y += Math.sin(h.angle + Math.PI / 2) * Math.sin(G.time * 1.3 + h.seed) * 34 * dt;
    }
    const resolved = G.city.collideBuildings(h.x, h.y, 10);
    h.x = resolved[0]; h.y = resolved[1];
    h.shootCd -= dt;
    if (d < 400 && h.shootCd <= 0) {
      h.shootCd = rand(0.8, 1.6);
      G.fx.muzzle(h.x, h.y, h.angle);
      G.audio.shot();
      if (Math.random() < 0.34) G.hurtPlayer(8, h.x, h.y);
    }
  }
}

function spawnHostiles(G, m, spots) {
  m.data.hostiles = spots.map(([x, y]) => {
    const ped = makePed(x, y);
    ped.health = 40;
    ped.speed = rand(80, 105);
    ped.shootCd = rand(0.5, 1.6);
    ped.seed = rand(0, 9);
    ped.hostile = true;
    ped.shirt = '#2b2f36';
    G.hostiles.push(ped);
    return ped;
  });
}

function marker(x, y, label) {
  return { x, y, label };
}

function reachObjective(x, y, label) {
  return () => marker(x, y, label);
}

function buildDefs() {
  return [
    {
      title: 'First Wheels',
      intro: 'Steal the marked Meridian and drop it at the Tide Garage.',
      pay: 400,
      setup(G, m) {
        const v = makeVehicle('meridian', 1330, 900, Math.PI / 2, null);
        v.color = '#8a2f35';
        G.vehicles.push(v);
        m.data.car = v;
        m.data.drop = poi('garage');
      },
      onEnterVehicle(G, m, v) {
        if (v === m.data.car && m.stage === 0) {
          m.stage = 1;
          G.notify('Got it — take it to the Tide Garage.', '#ffffff');
        }
      },
      update(G, m) {
        if (m.stage === 1) {
          const d = m.data.drop;
          if (G.player.vehicle === m.data.car && dist(G.player.x, G.player.y, d.x, d.y) < 90) return 'done';
          if (m.data.car.wreck) return 'fail:the car is wrecked';
        }
        return null;
      },
      objective(G, m) {
        if (m.stage === 0) return marker(m.data.car.x, m.data.car.y, 'STEAL');
        return marker(m.data.drop.x, m.data.drop.y, 'DROP');
      },
    },
    {
      title: 'Hot Package',
      intro: 'Pick up the package at Old Market. The clock is not your friend.',
      pay: 600,
      setup(G, m) {
        m.data.pickup = { x: 620, y: 1900 };
        m.data.drop = { x: 3300, y: 2020 };
        m.data.timer = 0;
      },
      update(G, m, dt) {
        if (m.stage === 0 && dist(G.player.x, G.player.y, m.data.pickup.x, m.data.pickup.y) < 55) {
          m.stage = 1;
          m.data.timer = 120;
          G.notify('Package aboard — get it to the Marina dock!', '#ffd94a');
          G.audio.pickup();
        }
        if (m.stage === 1) {
          m.data.timer -= dt;
          if (m.data.timer <= 0) return 'fail:out of time';
          if (dist(G.player.x, G.player.y, m.data.drop.x, m.data.drop.y) < 70) {
            if (!G.player.hasPistol) {
              G.player.hasPistol = true;
              G.player.weapon = 'pistol';
              G.player.ammo += 40;
              G.notify('Marisol slips you a Harbor 9mm. Keep it close.', '#ffd94a');
            }
            return 'done';
          }
        }
        return null;
      },
      objective(G, m) {
        if (m.stage === 0) return marker(m.data.pickup.x, m.data.pickup.y, 'PICKUP');
        const t = Math.max(0, Math.ceil(m.data.timer));
        return marker(m.data.drop.x, m.data.drop.y, 'DROP ' + t + 's');
      },
    },
    {
      title: 'Lookouts',
      intro: 'Three lookouts at the Portside warehouses. Quiet them down.',
      pay: 800,
      setup(G, m) {
        if (!G.player.hasPistol) { G.player.hasPistol = true; G.player.weapon = 'pistol'; }
        G.player.ammo = Math.max(G.player.ammo, 36);
        spawnHostiles(G, m, [[1980, 3030], [2240, 3120], [2470, 3040]]);
      },
      update(G) {
        const alive = G.hostiles.filter((h) => h.health > 0).length;
        if (alive === 0) return 'done';
        return null;
      },
      objective(G, m) {
        const alive = G.hostiles.filter((h) => h.health > 0);
        if (!alive.length) return null;
        return marker(alive[0].x, alive[0].y, 'LOOKOUTS ' + alive.length);
      },
    },
    {
      title: 'Hold the Heat',
      intro: 'Marisol needs a distraction. Keep the SBPD busy for 90 seconds.',
      pay: 900,
      setup(G, m) { m.data.need = 90; },
      update(G, m, dt) {
        forceHeat(G, 2);
        m.data.need -= dt;
        if (m.data.need <= 0) return 'done';
        return null;
      },
      objective(G, m) {
        return marker(G.player.x, G.player.y, 'SURVIVE ' + Math.max(0, Math.ceil(m.data.need)) + 's');
      },
    },
    {
      title: 'Buoy Run',
      intro: 'A Marlin is moored at the marina. Thread the buoys, all eight.',
      pay: 1000,
      setup(G, m) {
        const boat = makeVehicle('marlin', 3560, 2050, 0, null);
        G.vehicles.push(boat);
        m.data.boat = boat;
        m.data.buoys = [];
        for (let i = 0; i < 8; i++) {
          m.data.buoys.push({ x: 3750 + (i % 4) * 210 + rand(-30, 30), y: 1500 + Math.floor(i / 4) * 780 + rand(-40, 40) });
        }
        m.data.next = 0;
        m.data.vehicles = [boat];
      },
      update(G, m) {
        const b = m.data.buoys[m.data.next];
        if (!b) return 'done';
        if (G.player.vehicle && G.player.vehicle.def.kind === 'boat' && dist(G.player.x, G.player.y, b.x, b.y) < 85) {
          m.data.next++;
          G.audio.pickup();
          G.notify('Buoy ' + m.data.next + ' / 8', '#bfe6ff');
          if (m.data.next >= m.data.buoys.length) return 'done';
        }
        return null;
      },
      objective(G, m) {
        const b = m.data.buoys[Math.min(m.data.next, m.data.buoys.length - 1)];
        return marker(b.x, b.y, 'BUOY ' + (m.data.next + 1));
      },
    },
    {
      title: 'Quiet Tail',
      intro: 'Follow the black Bronto. Close enough to watch, far enough to live.',
      pay: 1100,
      setup(G, m) {
        const car = makeVehicle('bronto', 850, 850, 0, 'mission');
        car.color = '#20242c';
        car.cruiseSpeed = 0.4;
        G.vehicles.push(car);
        m.data.car = car;
        m.data.vehicles = [car];
        m.data.dest = { x: 2450, y: 3050 };
        car.route = G.city.route(car.x, car.y, m.data.dest.x, m.data.dest.y);
        car.routeIdx = 0;
        m.data.spotted = 0;
      },
      update(G, m, dt) {
        const car = m.data.car;
        driveMissionCar(G, car, dt, 0.4);
        const d = dist(G.player.x, G.player.y, car.x, car.y);
        if (d < 58) {
          m.data.spotted += dt;
          G.notify('Too close — he is made you!', '#ff8a7a');
          if (m.data.spotted > 2.2) return 'fail:you were spotted';
        } else {
          m.data.spotted = Math.max(0, m.data.spotted - dt * 0.7);
        }
        if (d > 620) return 'fail:you lost him';
        if (dist(car.x, car.y, m.data.dest.x, m.data.dest.y) < 60) return 'done';
        return null;
      },
      objective(G, m) {
        return marker(m.data.car.x, m.data.car.y, 'TAIL');
      },
    },
    {
      title: 'Convoy',
      intro: 'Ride shotgun for Marisol\'s van. Company is coming, and not the good kind.',
      pay: 1400,
      setup(G, m) {
        const van = makeVehicle('cargo', 1650, 2950, 0, 'mission');
        van.color = '#4a6b8a';
        van.cruiseSpeed = 0.5;
        G.vehicles.push(van);
        m.data.van = van;
        m.data.dest = { x: 2050, y: 620 };
        van.route = G.city.route(van.x, van.y, m.data.dest.x, m.data.dest.y);
        van.routeIdx = 0;
        m.data.vehicles = [van];
        m.data.ambushAt = 0.45;   // fraction of route where the ambush hits
        m.data.ambushed = false;
      },
      update(G, m, dt) {
        const van = m.data.van;
        if (van.wreck) return 'fail:the van is wrecked';
        driveMissionCar(G, van, dt, 0.5);
        const total = van.route ? van.route.length : 0;
        if (!m.data.ambushed && total && van.routeIdx > total * m.data.ambushAt) {
          m.data.ambushed = true;
          for (const off of [[-140, -80], [150, 60]]) {
            const h = makeVehicle('bronto', van.x + off[0], van.y + off[1], 0, 'hostile');
            h.cruiseSpeed = 0.92;
            G.vehicles.push(h);
            m.data.vehicles.push(h);
          }
          G.notify('Ambush! Keep the van rolling!', '#ff8a7a');
          G.audio.fail();
        }
        for (const v of m.data.vehicles) {
          if (v.driver === 'hostile' && !v.wreck) driveHostileCar(G, v, van, dt);
        }
        if (dist(van.x, van.y, m.data.dest.x, m.data.dest.y) < 80) return 'done';
        if (dist(G.player.x, G.player.y, van.x, van.y) > 700) return 'fail:you abandoned the van';
        return null;
      },
      objective(G, m) {
        return marker(m.data.van.x, m.data.van.y, 'ESCORT');
      },
    },
    {
      title: 'Island Drop',
      intro: 'Take the package out to Lighthouse Isle. By water, obviously.',
      pay: 1300,
      setup(G, m) {
        m.data.pickup = { x: 3450, y: 2920 };
        m.data.drop = { x: 4150, y: 880 };
        const boat = makeVehicle('skiff', 3620, 2950, 0, null);
        G.vehicles.push(boat);
        m.data.vehicles = [boat];
      },
      update(G, m) {
        if (m.stage === 0 && dist(G.player.x, G.player.y, m.data.pickup.x, m.data.pickup.y) < 60) {
          m.stage = 1;
          G.notify('Package aboard — Lighthouse Isle, north shore.', '#ffd94a');
          G.audio.pickup();
        }
        if (m.stage === 1 && dist(G.player.x, G.player.y, m.data.drop.x, m.data.drop.y) < 80) return 'done';
        return null;
      },
      objective(G, m) {
        if (m.stage === 0) return marker(m.data.pickup.x, m.data.pickup.y, 'PICKUP');
        return marker(m.data.drop.x, m.data.drop.y, 'ISLAND DROP');
      },
    },
    {
      title: 'Pink Slip Run',
      intro: 'Eight checkpoints, three rivals, one pink slip. Win it.',
      pay: 1800,
      setup(G, m) {
        m.data.checkpoints = [
          { x: 800, y: 300 }, { x: 1800, y: 300 }, { x: 2800, y: 800 }, { x: 2300, y: 1300 },
          { x: 2800, y: 2300 }, { x: 1800, y: 2800 }, { x: 800, y: 2300 }, { x: 1300, y: 1300 },
        ];
        m.data.next = 0;
        m.data.rivals = [];
        const models = ['bronto', 'vessia', 'aurelion'];
        for (let i = 0; i < 3; i++) {
          const r = makeVehicle(models[i], 420 + i * 46, 350 + (i % 2) * 40, 0, 'mission');
          r.cruiseSpeed = rand(0.78, 0.9);
          r.raceCp = 0;
          G.vehicles.push(r);
          m.data.rivals.push(r);
          m.data.vehicles.push(r);
        }
        if (!G.player.vehicle) {
          const mine = makeVehicle('vessia', 400, 420, 0, null);
          G.vehicles.push(mine);
          m.data.vehicles.push(mine);
          G.notify('A Vessia waits at the start line for you.', '#ffffff');
        }
      },
      update(G, m, dt) {
        // Rivals chase the same checkpoints.
        for (const r of m.data.rivals) {
          if (r.wreck) continue;
          const cp = m.data.checkpoints[Math.min(r.raceCp, m.data.checkpoints.length - 1)];
          drivePointCar(G, r, cp.x, cp.y, dt, r.cruiseSpeed);
          if (dist(r.x, r.y, cp.x, cp.y) < 95) r.raceCp++;
        }
        const cp = m.data.checkpoints[m.data.next];
        if (cp && G.player.vehicle && dist(G.player.x, G.player.y, cp.x, cp.y) < 95) {
          m.data.next++;
          G.audio.pickup();
          G.notify('Checkpoint ' + m.data.next + ' / 8', '#bfe6ff');
        }
        const rivalBest = Math.max(...m.data.rivals.map((r) => r.raceCp));
        if (m.data.next >= m.data.checkpoints.length) {
          if (rivalBest >= m.data.checkpoints.length) return 'fail:a rival finished first';
          return 'done';
        }
        if (rivalBest >= m.data.checkpoints.length) return 'fail:a rival finished first';
        return null;
      },
      objective(G, m) {
        const cp = m.data.checkpoints[Math.min(m.data.next, m.data.checkpoints.length - 1)];
        return marker(cp.x, cp.y, 'RACE ' + (m.data.next + 1) + '/8');
      },
    },
    {
      title: 'Five Star Funeral',
      intro: 'Two minutes. Five stars. Do not stop moving.',
      pay: 2200,
      setup(G, m) { m.data.need = 120; },
      update(G, m, dt) {
        forceHeat(G, 5);
        m.data.need -= dt;
        if (m.data.need <= 0) return 'done';
        return null;
      },
      objective(G, m) {
        return marker(G.player.x, G.player.y, 'SURVIVE ' + Math.max(0, Math.ceil(m.data.need)) + 's');
      },
    },
    {
      title: 'Roadblock Heist',
      intro: 'The Vault Truck sits at Solstice Bank. Take it to Portside. All of it.',
      pay: 2600,
      setup(G, m) {
        const truck = makeVehicle('truck', 1010, 560, Math.PI, null);
        G.vehicles.push(truck);
        m.data.truck = truck;
        m.data.drop = { x: 1750, y: 3180 };
        spawnHostiles(G, m, [[930, 520], [1100, 610]]);
      },
      onEnterVehicle(G, m, v) {
        if (v === m.data.truck && m.stage === 0) {
          m.stage = 1;
          reportCrime(G, 'stealCar', v.x, v.y, 3);
          forceHeat(G, 3);
          G.notify('That did it — every unit in the city is awake.', '#ff8a7a');
        }
      },
      update(G, m) {
        if (m.data.truck.wreck) return 'fail:the truck is wrecked';
        if (m.stage === 1 && G.player.vehicle === m.data.truck && dist(G.player.x, G.player.y, m.data.drop.x, m.data.drop.y) < 95) return 'done';
        return null;
      },
      objective(G, m) {
        if (m.stage === 0) return marker(m.data.truck.x, m.data.truck.y, 'STEAL TRUCK');
        return marker(m.data.drop.x, m.data.drop.y, 'DROP');
      },
    },
    {
      title: 'Neon Tide',
      intro: 'The last job. Pick Marisol up, and get her to the lighthouse. Fast.',
      pay: 5000,
      setup(G, m) {
        m.data.drop = { x: 4280, y: 760 };
        m.data.timer = 0;
      },
      update(G, m, dt) {
        const mp = poi('marisol');
        if (m.stage === 0 && G.player.vehicle && dist(G.player.x, G.player.y, mp.x, mp.y) < 80) {
          m.stage = 1;
          m.data.timer = 180;
          forceHeat(G, 4);
          G.notify('Marisol is in! Lighthouse Isle — GO!', '#ffd94a');
          G.audio.levelup();
        }
        if (m.stage === 1) {
          m.data.timer -= dt;
          forceHeat(G, 4);
          if (m.data.timer <= 0) return 'fail:out of time';
          if (dist(G.player.x, G.player.y, m.data.drop.x, m.data.drop.y) < 95) return 'done';
        }
        return null;
      },
      objective(G, m) {
        const mp = poi('marisol');
        if (m.stage === 0) return marker(mp.x, mp.y, 'PICK UP MARISOL');
        return marker(m.data.drop.x, m.data.drop.y, 'LIGHTHOUSE ' + Math.max(0, Math.ceil(m.data.timer)) + 's');
      },
    },
  ];
}

// A mission car that follows a precomputed road route (tail target, van).
export function driveMissionCar(G, v, dt, speedScale) {
  if (v.wreck) { v.control.throttle = 0; return; }
  if (!v.route || v.routeIdx >= v.route.length) {
    v.control.throttle = 0;
    v.control.steer = 0;
    return;
  }
  const target = v.route[v.routeIdx];
  if (dist(v.x, v.y, target.x, target.y) < 46) { v.routeIdx++; return; }
  const want = angleTo(v.x, v.y, target.x, target.y);
  const diff = angleDiff(v.angle, want);
  v.control.steer = clamp(diff * 2.4, -1, 1);
  v.control.throttle = Math.abs(diff) > 1.3 ? -0.3 : 1;
  v.cruiseSpeed = speedScale;
  void dt;
}

// A car that steers straight at a point (race rivals, ambushers).
export function drivePointCar(G, v, tx, ty, dt, speedScale) {
  if (v.wreck) { v.control.throttle = 0; return; }
  const want = angleTo(v.x, v.y, tx, ty);
  const diff = angleDiff(v.angle, want);
  v.control.steer = clamp(diff * 2.6, -1, 1);
  v.control.throttle = Math.abs(diff) > 1.6 ? -0.4 : 1;
  v.control.handbrake = Math.abs(diff) > 1.0;
  v.cruiseSpeed = speedScale;
  void dt;
}

// Ambush cars hunt the van and try to ram it off the road.
export function driveHostileCar(G, v, target, dt) {
  drivePointCar(G, v, target.x, target.y, dt, 0.92);
}
