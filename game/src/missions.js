// Missions and story: twelve sequential jobs for fixer Mara Voss across three
// days, each with a glowing waypoint, an on-screen objective, and a cash reward.
// Progress saves. Jobs 1–4 live here; jobs 5–6 (Portside docks, the last stand)
// live in missions2.js; jobs 7–12 (Day 3, the Harbor Vault heist finale) live
// in missions3.js. The HUD always shows "MISSION n/12" plus the stage.
// Round 6: finishing a job in rain or storm pays a small score bonus
// (missionWeatherBonus) — the city notices hard work in bad weather.
import { MISSIONS, MISSION_REWARD, WORLD } from './config.js';
import { makeCar } from './traffic.js';
import { updateExtraMissions, extraMissionWaypoint, extraMissionProgressText } from './missions2.js';
import { updateDay3Missions, day3Waypoint, day3ProgressText } from './missions3.js';

export const MISSION_WAYPOINTS = [
  { x: 3120, y: 668 },   // East Pier (across the north bridge)
  { x: 1500, y: 1200 },  // Dario's escape route, mid-city
  { x: 824, y: 1696 },   // Harbor Vault, south-west intersection
  { x: 1042, y: 800 },   // Neon Strip casino entrance (road south of the casino)
];
export const HIDEOUT = { x: 420, y: 420 };

export function createMissions() {
  return { index: 0, stage: 'go', done: false, targetCar: null, grabbed: false, timer: 0, banner: '' };
}

export function currentMission(missions) { return MISSIONS[missions.index] ?? null; }

// "MISSION 7/12 — THE CREW CALLS" for the panel header.
export function missionCounterText(state) {
  const m = state.missions;
  if (m.done) return 'MISSION 12/12 — DONE';
  const mission = MISSIONS[m.index];
  const day = mission ? mission.day : 1;
  return 'MISSION ' + (m.index + 1) + '/12 · DAY ' + day + ' — ' + (mission ? mission.title.replace(/^MISSION \d+ — /, '') : '');
}

export function missionWaypoint(state) {
  const m = state.missions;
  if (m.done) return null;
  // Jobs 7–12 are owned by missions3.js (Day 3 heist steps).
  if (m.index >= 6) return day3Waypoint(state);
  // Jobs 5–6 are owned by missions2.js (Portside crates, the last stand).
  if (m.index >= 4) return extraMissionWaypoint(state);
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
  // Day 3 (jobs 7–12) is owned by missions3.js — hand the update over.
  if (m.index >= 6) { updateDay3Missions(state, dt); return; }
  // Jobs 5–6 are owned by missions2.js — hand the whole update over.
  if (m.index >= 4) { updateExtraMissions(state, dt); return; }
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

// Bad-weather pay (round 6): finishing a job in the rain or a storm is
// harder work, so the score gets a small bonus. Cash rewards never change.
export function missionWeatherBonus(state) {
  const kind = state.weather ? state.weather.kind : 'clear';
  return kind === 'storm' ? 100 : kind === 'rain' ? 50 : 0;
}

export function completeMission(state, message) {
  const m = state.missions;
  const reward = MISSION_REWARD[m.index] ?? 0;
  state.player.money += reward;
  m.banner = message;
  state.audio?.mission();
  state.score += 1000 * (m.index + 1) + missionWeatherBonus(state);
  m.index += 1;
  m.stage = 'go'; m.targetCar = null; m.timer = 0;
  if (m.index >= MISSIONS.length) {
    m.done = true;
    state.screen = 'win';
    state.audio?.win();
  } else if (m.index === 1) {
    startMissionTwo(state, state.random);
  }
  // A finished mission is a save point: progress survives a reload.
  if (typeof state.saveGame === 'function') state.saveGame();
}

export function missionProgressText(state) {
  const m = state.missions;
  if (m.done) return 'ALL 12 MISSIONS COMPLETE — VIRELIA IS YOURS';
  // Day 3 reports its own step progress ("STAGE 2/3").
  if (m.index >= 6) return day3ProgressText(state);
  // Jobs 5–6 report their own progress (crates secured, VPD cars down).
  if (m.index >= 4) return extraMissionProgressText(state);
  const mission = MISSIONS[m.index];
  if ((m.index === 2 || m.index === 3) && m.stage === 'escape') return 'STAGE 3/3 · ESCAPE TO THE HIDEOUT!';
  if ((m.index === 2 || m.index === 3) && m.stage === 'grab') return 'STAGE 2/3 · GRAB THE CASH!';
  if (m.index === 1) return 'STAGE 1/2 · STOP DARIO’S COUPE';
  if (m.index === 0) return 'STAGE 1/1 · ' + mission.objective;
  return mission.objective;
}
