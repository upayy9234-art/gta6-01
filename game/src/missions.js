// Missions and story: four sequential jobs for fixer Mara Voss, each with a
// glowing waypoint, an on-screen objective, and a cash reward. Progress saves.
import { MISSIONS, MISSION_REWARD, WORLD } from './config.js';
import { makeCar } from './traffic.js';

export const MISSION_WAYPOINTS = [
  { x: 3120, y: 668 },   // East Pier (across the north bridge)
  { x: 1500, y: 1200 },  // Dario's escape route, mid-city
  { x: 824, y: 1696 },   // Harbor Vault, south-west intersection
  { x: 1042, y: 800 },  // Neon Strip casino entrance (road south of the casino)
];
export const HIDEOUT = { x: 420, y: 420 };

export function createMissions() {
  return { index: 0, stage: 'go', done: false, targetCar: null, grabbed: false, timer: 0, banner: '' };
}

export function currentMission(missions) { return MISSIONS[missions.index] ?? null; }

export function missionWaypoint(state) {
  const m = state.missions;
  if (m.done) return null;
  if (m.index === 1 && m.targetCar) return { x: m.targetCar.x, y: m.targetCar.y };
  if ((m.index === 2 || m.index === 3) && m.stage === 'escape') return HIDEOUT;
  return MISSION_WAYPOINTS[m.index];
}

export function startMissionTwo(state, random) {
  // Dario's violet coupe spawns ahead of the player and flees.
  const car = makeCar(state.player.x + 260, state.player.y - 60, 0, { name: 'Violet Coupe', color: '#c94dff', speed: 1.0 }, { npc: true });
  car.speed = 240; car.health = 60; car.target = 'dario';
  state.cars.push(car);
  state.missions.targetCar = car;
  state.missions.banner = 'Dario is fleeing in the violet coupe — ram him!';
}

export function updateMissions(state, dt) {
  const m = state.missions;
  if (m.done) return;
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  m.timer += dt;
  if (m.index === 0) {
    const w = MISSION_WAYPOINTS[0];
    if (Math.hypot(px - w.x, py - w.y) < 70) completeMission(state, 'Parcel delivered! +$400');
  } else if (m.index === 1) {
    const t = m.targetCar;
    if (t && t.health <= 0) completeMission(state, 'Dario stopped! +$900');
    else if (t) {
      // Dario flees away from the player along roads.
      const away = Math.atan2(t.y - py, t.x - px);
      t.angle += (away - t.angle) * dt * 0.5;
      t.speed = Math.min(430, t.speed + 40 * dt);
      t.x += Math.cos(t.angle) * t.speed * dt;
      t.y += Math.sin(t.angle) * t.speed * dt;
    }
  } else if (m.index === 2 || m.index === 3) {
    // Vault (3) and Neon Strip (4) share the go -> grab -> escape shape.
    const isStrip = m.index === 3;
    if (m.stage === 'go') {
      const w = MISSION_WAYPOINTS[m.index];
      if (Math.hypot(px - w.x, py - w.y) < 80) {
        m.stage = 'grab'; m.grabbed = true;
        p.money += isStrip ? 2000 : 1500;
        m.banner = isStrip
          ? 'Casino cash grabbed! The heli is on you — escape to the hideout!'
          : 'Cash grabbed! Now escape to the hideout — the whole VPD is coming!';
        p.wanted = Math.max(p.wanted, isStrip ? 5 : 3);
      }
    } else if (m.stage === 'grab') {
      m.stage = 'escape';
    } else if (m.stage === 'escape') {
      if (Math.hypot(px - HIDEOUT.x, py - HIDEOUT.y) < 80) {
        completeMission(state, isStrip ? 'THE NEON STRIP IS YOURS! +$3,000' : 'THE SCORE IS YOURS! +$2,200');
      }
    }
  }
}

function completeMission(state, message) {
  const m = state.missions;
  const reward = MISSION_REWARD[m.index] ?? 0;
  state.player.money += reward;
  m.banner = message;
  state.audio?.mission();
  state.score += 1000 * (m.index + 1);
  m.index += 1;
  m.stage = 'go'; m.targetCar = null; m.timer = 0;
  if (m.index >= MISSIONS.length) {
    m.done = true;
    state.screen = 'win';
    state.audio?.win();
  } else if (m.index === 1) {
    startMissionTwo(state, state.random);
  }
}

export function missionProgressText(state) {
  const m = state.missions;
  if (m.done) return 'ALL MISSIONS COMPLETE';
  const mission = MISSIONS[m.index];
  if ((m.index === 2 || m.index === 3) && m.stage === 'escape') return 'ESCAPE TO THE HIDEOUT!';
  if ((m.index === 2 || m.index === 3) && m.stage === 'grab') return 'GRAB THE CASH!';
  return mission.objective;
}
