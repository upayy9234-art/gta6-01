// missions.js — Marisol Vega's twelve jobs: the campaign of Solstice Heat.
// A small stage interpreter runs them. Each stage is an object with a label
// for the HUD, a marker for the world, an optional enter() that spawns what
// it needs (lookouts, a tail target, an escort van, race rivals) and a
// check() that reports done or failed. Missions unlock in order; failing
// one cleans up everything it spawned and Marisol offers it again.

import { MARINA, ISLAND } from './config.js';
import { createVehicle, controlToward, stepVehicle } from './vehicles.js';
import { coastX } from './city.js';

const S = (o) => o; // stage literal, for readability below

function gotoStage(x, y, label, r = 58) {
  return S({
    label, marker: { x, y },
    check(G) {
      const p = G.player;
      return Math.hypot(p.x - x, p.y - y) < r ? 'done' : null;
    },
  });
}

function vehicleStage(match, label) {
  return S({
    label,
    check(G) {
      const v = G.player.vehicle;
      return v && match(v) ? 'done' : null;
    },
  });
}

function deliverStage(match, x, y, label, time) {
  return S({
    label, marker: { x, y }, time,
    check(G) {
      const v = G.player.vehicle;
      return v && match(v) && Math.hypot(v.x - x, v.y - y) < 78 ? 'done' : null;
    },
  });
}

function shootoutStage(x, y, count, label) {
  return S({
    label, marker: { x, y },
    enter(G, sd) {
      sd.foes = [];
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + 0.5;
        const foe = {
          x: x + Math.cos(a) * 120, y: y + Math.sin(a) * 120, angle: a + Math.PI,
          state: 'walk', timer: 0, health: 46, hostile: true, shotT: 1 + i * 0.4,
          shirt: '#7a1f1f', skin: '#c88a5a', speed: 0, tx: x, ty: y,
        };
        G.peds.push(foe);
        sd.foes.push(foe);
      }
    },
    check(G, dt, sd) {
      stepFoes(G, dt, sd.foes);
      const left = sd.foes.filter((f) => f.state !== 'down').length;
      this.label = label + ' (' + (count - left) + '/' + count + ')';
      return left === 0 ? 'done' : null;
    },
    cleanup(G, sd) {
      for (const f of sd.foes) {
        const i = G.peds.indexOf(f);
        if (i !== -1) G.peds.splice(i, 1);
      }
    },
  });
}

// Hostile lookouts: stand their ground, shoot when the player is close and
// visible, and count as witnessed crime scenes for the SBPD.
function stepFoes(G, dt, foes) {
  const p = G.player;
  for (const f of foes) {
    if (f.state === 'down') continue;
    const d = Math.hypot(p.x - f.x, p.y - f.y);
    f.angle = Math.atan2(p.y - f.y, p.x - f.x);
    f.shotT -= dt;
    if (d < 400 && f.shotT <= 0) {
      f.shotT = 0.85;
      G.fx.muzzle(f.x, f.y, f.angle);
      G.audio.play('shot');
      if (Math.random() < 0.4) G.hurtPlayer(6, f.angle);
    }
    if (d > 460) {
      // Drift back toward their post if the player runs off.
      f.x += Math.cos(Math.atan2(f.ty - f.y, f.tx - f.x)) * 40 * dt;
      f.y += Math.sin(Math.atan2(f.ty - f.y, f.tx - f.x)) * 40 * dt;
    }
  }
}

function loseCopsStage(label) {
  return S({
    label,
    check(G) {
      return G.police.stars === 0 ? 'done' : null;
    },
  });
}

function surviveStage(minStars, seconds, label) {
  return S({
    label,
    enter(G, sd) {
      sd.held = 0;
    },
    check(G, dt, sd) {
      if (G.police.stars >= minStars) sd.held += dt;
      this.label = label + ' (' + Math.floor(sd.held) + '/' + seconds + 's)';
      return sd.held >= seconds ? 'done' : null;
    },
  });
}

function boatCourseStage(points, label) {
  return S({
    label,
    enter(G, sd) {
      sd.i = 0;
      this.marker = points[0];
    },
    check(G, dt, sd) {
      const v = G.player.vehicle;
      if (!v || v.kind !== 'boat') {
        this.label = label + ' — you need a boat';
        return null;
      }
      const t = points[sd.i];
      this.marker = t;
      this.label = label + ' (' + (sd.i + 1) + '/' + points.length + ')';
      if (Math.hypot(v.x - t.x, v.y - t.y) < 95) {
        sd.i++;
        G.audio.play('objective');
        if (sd.i >= points.length) return 'done';
        this.marker = points[sd.i];
      }
      return null;
    },
  });
}

const anyCar = (v) => v.kind === 'car';
const anyBoat = (v) => v.kind === 'boat';

export const MISSIONS = [
  {
    title: 'First Rides',
    reward: 300,
    intro: 'Marisol: "Jax. You drive, I pay, nobody asks names. Start by bringing me a car — any car — to the Harbor Garage."',
    outro: 'Marisol: "Clean work. There is more where that came from."',
    stages: () => [
      vehicleStage(anyCar, 'Steal any car'),
      deliverStage(anyCar, 1560, 1180, 'Deliver the car to the Harbor Garage'),
    ],
  },
  {
    title: 'Hot Delivery',
    reward: 450,
    intro: 'Marisol: "A package waits at the Portside docks. The Neon Mile clinic needs it in two and a half minutes. Do not open it."',
    outro: 'Marisol: "On time and unopened. The clinic sends its thanks."',
    stages: () => [
      gotoStage(1980, 1560, 'Pick up the package at Portside'),
      { ...gotoStage(1560, 380, 'Deliver to the Neon Mile Clinic'), time: 150 },
    ],
  },
  {
    title: 'Harbor Teeth',
    reward: 600,
    intro: 'Marisol: "Dock rats are taxing my boats. Take this Harbor 9mm and clear the Portside warehouse yard. Then disappear."',
    outro: 'Marisol: "The docks are quiet again. Keep the pistol."',
    setup(G) {
      if (G.player.weapon === 'fists') G.player.weapon = 'pistol';
      G.player.ammo += 48;
    },
    stages: () => [
      gotoStage(2050, 1290, 'Reach the Portside warehouse yard'),
      shootoutStage(2050, 1290, 3, 'Clear the lookouts'),
      loseCopsStage('Lose the cops'),
    ],
  },
  {
    title: 'Marked Heat',
    reward: 700,
    intro: 'Marisol: "I need the SBPD looking at you, not at my boats. Hold two stars for forty-five seconds, then shake them."',
    outro: 'Marisol: "Every cruiser in the bay was watching you. Perfect."',
    setup(G) {
      G.police.report(G, 34, G.player.x, G.player.y, true);
    },
    stages: () => [
      surviveStage(2, 45, 'Hold 2+ stars'),
      loseCopsStage('Now lose them'),
    ],
  },
  {
    title: 'Marina Blues',
    reward: 800,
    intro: 'Marisol: "Three buoys, one boat, no questions. Run the course from the marina to Lighthouse Isle."',
    outro: 'Marisol: "Fast on water too. Noted."',
    stages: () => [
      vehicleStage(anyBoat, 'Take a boat from the marina'),
      boatCourseStage(
        [{ x: 3350, y: 2500 }, { x: 3900, y: 1700 }, { x: ISLAND.x - 260, y: ISLAND.y + 260 }],
        'Run the buoy course',
      ),
    ],
  },
  {
    title: 'Long Shadow',
    reward: 850,
    intro: 'Marisol: "A Vista sedan leaves the Neon Mile with my money in the boot. Follow it home. Not too close, not too far."',
    outro: 'Marisol: "Now I know where he sleeps. That is worth plenty."',
    stages: () => [{
      label: 'Tail the sedan',
      enter(G, sd) {
        const car = createVehicle('sedan', 1520, 300, 0, { driver: 'tail', color: '#4a5560' });
        G.vehicles.push(car);
        sd.car = car;
        sd.close = 0;
        sd.far = 0;
        sd.route = G.city.findPath(1520, 300, 2050, 1140) || [{ x: 2050, y: 1140 }];
        sd.i = 0;
        this.marker = { x: car.x, y: car.y };
      },
      check(G, dt, sd) {
        const car = sd.car;
        const target = sd.route[Math.min(sd.i, sd.route.length - 1)];
        if (Math.hypot(car.x - target.x, car.y - target.y) < 60 && sd.i < sd.route.length - 1) sd.i++;
        stepVehicle(G, car, controlToward(car, target.x, target.y, { reach: 120 }), dt);
        this.marker = { x: car.x, y: car.y };
        const d = Math.hypot(G.player.x - car.x, G.player.y - car.y);
        if (d < 55) sd.close += dt; else sd.close = Math.max(0, sd.close - dt);
        if (d > 430) sd.far += dt; else sd.far = Math.max(0, sd.far - dt);
        if (sd.close > 4) return 'fail:He saw you. Marisol wanted a shadow, not a dance partner.';
        if (sd.far > 7) return 'fail:You lost the sedan in traffic.';
        const arrived = sd.i >= sd.route.length - 1 && Math.hypot(car.x - 2050, car.y - 1140) < 90;
        return arrived && d < 400 ? 'done' : null;
      },
      cleanup(G, sd) {
        if (sd.car) sd.car.driver = 'traffic';
      },
    }],
  },
  {
    title: 'Convoy',
    reward: 1000,
    intro: 'Marisol: "My Hauler rolls from Little Marisol to the Old Fort safehouse. Ride shotgun — there will be trouble at the Flats."',
    outro: 'Marisol: "The Hauler made it. So did you. Both surprise me."',
    stages: () => [{
      label: 'Escort the Hauler to the Old Fort safehouse',
      marker: { x: 360, y: 2620 },
      enter(G, sd) {
        const van = createVehicle('van', 720, 2400, 0, { driver: 'escort', color: '#cfd4d8' });
        G.vehicles.push(van);
        sd.van = van;
        sd.route = G.city.findPath(720, 2400, 360, 2620) || [{ x: 360, y: 2620 }];
        sd.i = 0;
        sd.ambushed = false;
        sd.rammer = null;
      },
      check(G, dt, sd) {
        const van = sd.van;
        if (van.dead) return 'fail:The Hauler was wrecked.';
        const target = sd.route[Math.min(sd.i, sd.route.length - 1)];
        if (Math.hypot(van.x - target.x, van.y - target.y) < 64 && sd.i < sd.route.length - 1) sd.i++;
        stepVehicle(G, van, controlToward(van, target.x, target.y, { reach: 130 }), dt);
        this.marker = { x: van.x, y: van.y };
        if (!sd.ambushed && sd.i >= 2) {
          sd.ambushed = true;
          G.hud.notify('Ambush! Protect the Hauler!');
          const ram = createVehicle('muscle', van.x + 260, van.y + 120, Math.PI, { driver: 'rammer', color: '#20242c' });
          G.vehicles.push(ram);
          sd.rammer = ram;
          const foe = { x: van.x + 150, y: van.y - 130, angle: 0, state: 'walk', timer: 0, health: 46, hostile: true, shotT: 1, shirt: '#7a1f1f', skin: '#8a5a34', speed: 0, tx: van.x, ty: van.y };
          G.peds.push(foe);
          sd.foes = [foe];
        }
        if (sd.rammer && !sd.rammer.dead) {
          stepVehicle(G, sd.rammer, controlToward(sd.rammer, van.x, van.y, { reach: 10 }), dt);
        }
        if (sd.foes) stepFoes(G, dt, sd.foes);
        if (Math.hypot(G.player.x - van.x, G.player.y - van.y) > 620) {
          return 'fail:You left the Hauler behind.';
        }
        return Math.hypot(van.x - 360, van.y - 2620) < 95 ? 'done' : null;
      },
      cleanup(G, sd) {
        if (sd.van) sd.van.driver = 'traffic';
        if (sd.rammer) sd.rammer.driver = 'traffic';
        if (sd.foes) for (const f of sd.foes) {
          const i = G.peds.indexOf(f);
          if (i !== -1) G.peds.splice(i, 1);
        }
      },
    }],
  },
  {
    title: 'Island Drop',
    reward: 1100,
    intro: 'Marisol: "A quiet package for the lighthouse keeper. Boat it out, boat back. The bay is calm and so should you be."',
    outro: 'Marisol: "The keeper lit the lamp twice. That means thank you."',
    stages: () => [
      gotoStage(coastX(MARINA.pierYs[1]) + 120, MARINA.pierYs[1], 'Collect the package at the marina pier'),
      vehicleStage(anyBoat, 'Take a boat'),
      gotoStage(ISLAND.x - 355, ISLAND.y + 140, 'Deliver to Lighthouse Isle', 85),
      gotoStage(coastX(MARINA.pierYs[1]) + 60, MARINA.pierYs[1], 'Return to the marina'),
    ],
  },
  {
    title: 'Pink Slip',
    reward: 1200,
    intro: 'Marisol: "Eight checkpoints, three loudmouths, one pink slip. Win and the Kestrel money is yours. Lose and you still get paid — less."',
    outro: 'Marisol: "The Mile will talk about that race for a week."',
    stages: () => [{
      label: 'Pink Slip — checkpoint 1/8',
      enter(G, sd) {
        sd.points = [
          { x: 1920, y: 720 }, { x: 2320, y: 1140 }, { x: 1920, y: 1560 }, { x: 1520, y: 1140 },
          { x: 1120, y: 1560 }, { x: 720, y: 1140 }, { x: 1120, y: 720 }, { x: 1520, y: 300 },
        ];
        sd.i = 0;
        sd.rivals = [];
        for (let k = 0; k < 3; k++) {
          const r = createVehicle('racer', 1520 + (k - 1) * 40, 420 + k * 6, Math.PI, { driver: 'rival', color: ['#1ec2c2', '#c21e7f', '#d8d8e0'][k] });
          r.raceI = 0;
          G.vehicles.push(r);
          sd.rivals.push(r);
        }
        this.marker = sd.points[0];
      },
      check(G, dt, sd) {
        for (const r of sd.rivals) {
          const t = sd.points[Math.min(r.raceI, sd.points.length - 1)];
          if (r.raceI < sd.points.length) {
            stepVehicle(G, r, controlToward(r, t.x, t.y, { reach: 110 }), dt);
            if (Math.hypot(r.x - t.x, r.y - t.y) < 85) r.raceI++;
          }
        }
        const mine = G.player.vehicle;
        const t = sd.points[sd.i];
        if (t && mine && Math.hypot(mine.x - t.x, mine.y - t.y) < 85) {
          sd.i++;
          G.audio.play('objective');
          if (sd.i >= sd.points.length) {
            const pos = 1 + sd.rivals.filter((r) => r.raceI >= sd.points.length).length;
            sd.position = pos;
            return 'done';
          }
          this.marker = sd.points[sd.i];
        }
        const ahead = sd.rivals.filter((r) => r.raceI > sd.i).length;
        this.label = 'Pink Slip — checkpoint ' + Math.min(sd.i + 1, 8) + '/8 · P' + (ahead + 1);
        return null;
      },
      cleanup(G, sd) {
        for (const r of sd.rivals) r.driver = 'traffic';
      },
      bonus(sd) {
        return sd.position === 1 ? 600 : sd.position === 2 ? 250 : 0;
      },
    }],
  },
  {
    title: 'Five Star Funeral',
    reward: 1500,
    intro: 'Marisol: "Tonight the whole bay watches you. Five stars, ninety seconds, and live to tell it. Then vanish."',
    outro: 'Marisol: "Ninety seconds of legend. Drinks are on the house."',
    setup(G) {
      G.police.report(G, 130, G.player.x, G.player.y, true);
    },
    stages: () => [
      surviveStage(5, 90, 'Survive at 5 stars'),
      loseCopsStage('Now lose them all'),
    ],
  },
  {
    title: 'Longhaul',
    reward: 1600,
    intro: 'Marisol: "A Longhaul truck at Portside carries a safe that is not theirs. Take the truck to the safehouse. Expect roadblocks."',
    outro: 'Marisol: "The safe is home. The truck is a bonus."',
    stages: () => [
      {
        label: 'Steal the Longhaul truck at Portside',
        marker: { x: 2050, y: 1700 },
        enter(G, sd) {
          const truck = createVehicle('truck', 2050, 1700, 0.3, { driver: null, color: '#9c3d2e' });
          truck.wanted = true;
          G.vehicles.push(truck);
          sd.truck = truck;
        },
        check(G) {
          return G.player.vehicle === sd.truck ? 'done' : null;
        },
        cleanup(G, sd) {
          if (sd.truck && G.player.vehicle !== sd.truck) sd.truck.wanted = false;
        },
      },
      {
        ...deliverStage((v) => v.type === 'truck', 360, 2620, 'Deliver the truck to the safehouse'),
        enter(G) {
          G.police.report(G, 60, G.player.x, G.player.y, true);
          G.hud.notify('Roadblocks ahead — punch through or go around!');
        },
      },
    ],
  },
  {
    title: 'Neon Tide',
    reward: 3000,
    intro: 'Marisol: "Last job, Jax. My ledger is on Lighthouse Isle and every badge in the bay knows it. Bring it home and we are both ghosts."',
    outro: 'Marisol: "It is done. Solstice Bay is ours — quietly. You were magnificent."',
    stages: () => [
      gotoStage(coastX(MARINA.pierYs[0]) + 110, MARINA.pierYs[0], 'Reach the marina pier'),
      vehicleStage(anyBoat, 'Take a boat'),
      gotoStage(ISLAND.x - 355, ISLAND.y + 140, 'Take the ledger from Lighthouse Isle', 85),
      gotoStage(coastX(MARINA.pierYs[1]) + 60, MARINA.pierYs[1], 'Bring the ledger back to the marina'),
      {
        ...deliverStage(anyCar, 360, 2620, 'Deliver the ledger to the Old Fort safehouse'),
        enter(G) {
          G.police.report(G, 88, G.player.x, G.player.y, true);
        },
      },
      loseCopsStage('Lose the cops for good'),
    ],
  },
];

export function createMissionSystem() {
  const sys = {
    done: [],
    current: null, // { def, index, stageI, stage, sd }
    failedNote: 0,

    nextIndex() {
      for (let i = 0; i < MISSIONS.length; i++) if (!sys.done.includes(i)) return i;
      return -1;
    },

    get allDone() {
      return sys.done.length >= MISSIONS.length;
    },

    // The pulsing M on the map when work is waiting.
    startMarker(G) {
      if (sys.current || sys.allDone) return null;
      return G.city.sites.marisol;
    },

    start(G, index) {
      const def = MISSIONS[index];
      sys.current = { def, index, stageI: 0, stage: null, sd: {} };
      if (def.setup) def.setup(G);
      sys.enterStage(G);
      G.hud.subtitle(def.intro);
      G.hud.notify('Mission started: ' + def.title);
      G.audio.play('objective');
    },

    enterStage(G) {
      const c = sys.current;
      const stages = c.def.stages();
      c.stage = stages[c.stageI];
      c.sd = {};
      c.stageT = 0;
      if (c.stage.enter) c.stage.enter(G, c.sd);
    },

    cleanupStage(G) {
      const c = sys.current;
      if (c && c.stage && c.stage.cleanup) c.stage.cleanup(G, c.sd);
    },

    fail(G, reason) {
      const c = sys.current;
      if (!c) return;
      sys.cleanupStage(G);
      sys.current = null;
      G.hud.notify('Mission failed — ' + (reason || 'Marisol is not pleased.'));
      G.hud.subtitle('Marisol: "Again. And this time, like you mean it."');
      G.audio.play('fail');
    },

    complete(G) {
      const c = sys.current;
      let pay = c.def.reward;
      if (c.stage && c.stage.bonus) pay += c.stage.bonus(c.sd);
      sys.cleanupStage(G);
      sys.done.push(c.index);
      sys.current = null;
      G.player.cash += pay;
      G.hud.notify(c.def.title + ' complete! +$' + pay);
      G.hud.subtitle(c.def.outro);
      G.audio.play('cash');
      G.save();
    },

    objective() {
      const c = sys.current;
      if (!c) return null;
      let text = c.stage.label || '';
      if (c.stage.time) text += ' — ' + Math.max(0, Math.ceil(c.stage.time - (c.stageElapsed || 0))) + 's';
      return { title: c.def.title, text, marker: c.stage.marker };
    },

    onEnterVehicle(G, v) {
      // Stage checks read the player's vehicle each frame; nothing to do.
    },

    update(G, dt) {
      const c = sys.current;
      // Offer work when Jax steps to Marisol's corner on foot.
      if (!c && !sys.allDone) {
        const s = G.city.sites.marisol;
        if (!G.player.vehicle && Math.hypot(G.player.x - s.x, G.player.y - s.y) < 40) {
          sys.start(G, sys.nextIndex());
          return;
        }
      }
      if (!c) return;
      c.stageElapsed = (c.stageElapsed || 0) + dt;
      if (c.stage.time && c.stageElapsed > c.stage.time) {
        sys.fail(G, 'Out of time.');
        return;
      }
      let result = null;
      if (c.stage.check) result = c.stage.check(G, dt, c.sd);
      if (typeof result === 'string' && result.startsWith('fail:')) {
        sys.fail(G, result.slice(5));
        return;
      }
      if (result === 'done') {
        sys.cleanupStage(G);
        c.stageI++;
        c.stageElapsed = 0;
        const stages = c.def.stages();
        if (c.stageI >= stages.length) sys.complete(G);
        else sys.enterStage(G);
      }
    },
  };
  return sys;
}
