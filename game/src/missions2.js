// Missions 5 and 6 — the second half of Day 2 in Kai Mercer's story. Mission 5
// sends him into the Portside docks to lift three crates; mission 6 is the last
// stand: survive the full fury of the VPD, put six of their cars down, and run
// for the East Pier. Missions 1–4 live in missions.js; missions 7–12 (Day 3)
// live in missions3.js; this module plugs in when state.missions.index is 4–5.
// Both jobs share the crate/job state in state.extra: crates, a stage, a kill
// counter and a survival clock.
import { MISSION_REWARD, MISSIONS } from './config.js';
import { PORTSIDE, nextCrate } from './district.js';

export const HIDEOUT = { x: 420, y: 420 };
export const EAST_PIER = { x: 3120, y: 668 };
export const LAST_STAND_KILLS = 6;

export function createExtraMissions() {
  return {
    crates: PORTSIDE.crates.map((c) => ({ ...c })),
    cratesCollected: 0,
    stage: 'go',
    kills: 0,
    surviveTimer: 0,
    banner: '',
  };
}

function playerPosition(state) {
  const p = state.player;
  return p.inCar ? { x: p.inCar.x, y: p.inCar.y } : { x: p.x, y: p.y };
}

// Same wet-weather score bonus as missions 1–4 (rain +50, storm +100).
export function extraWeatherBonus(state) {
  const kind = state.weather ? state.weather.kind : 'clear';
  if (kind === 'storm') return 100;
  if (kind === 'rain') return 50;
  return 0;
}

function updatePortsideJob(state, dt) {
  const ex = state.extra;
  const p = state.player;
  const pos = playerPosition(state);
  void dt;
  if (ex.stage === 'go') {
    // Lift crates one at a time, on foot or behind the wheel.
    for (const crate of ex.crates) {
      if (crate.taken) continue;
      if (Math.hypot(pos.x - crate.x, pos.y - crate.y) > 56) continue;
      crate.taken = true;
      ex.cratesCollected += 1;
      state.score += 400;
      state.audio?.crate();
      if (ex.cratesCollected >= 3) {
        ex.stage = 'escape';
        p.money += 2500;
        p.wanted = Math.max(p.wanted, 4);
        state.audio?.siren();
        state.bannerText = 'All three crates secured! The VPD is coming — escape to the hideout!';
        state.bannerTimer = 4;
      } else {
        state.bannerText = 'Crate ' + ex.cratesCollected + ' of 3 secured.';
        state.bannerTimer = 3;
      }
      break; // one crate per frame
    }
  } else if (ex.stage === 'escape') {
    if (Math.hypot(pos.x - HIDEOUT.x, pos.y - HIDEOUT.y) < 80) {
      completeExtraMission(state, 'THE PORTSIDE JOB IS DONE! +$4,200');
    }
  }
}

function updateLastStand(state, dt) {
  const ex = state.extra;
  const p = state.player;
  const pos = playerPosition(state);
  if (ex.stage === 'go') {
    // The last stand begins the moment mission 6 starts: full heat, no way out
    // but through the VPD.
    ex.stage = 'survive';
    state.bannerText = 'THE LAST STAND — the whole VPD is coming. Put 6 of their cars down!';
    state.bannerTimer = 4;
  }
  if (ex.stage === 'survive') {
    // The whole VPD is on Kai until six of their cars are scrap.
    if (p.wanted < 5) p.wanted = 5;
    ex.surviveTimer += dt;
    if (ex.kills >= LAST_STAND_KILLS) {
      ex.stage = 'escape';
      state.audio?.siren();
      state.bannerText = 'Six VPD cars down! Run for the East Pier — Virelia is almost yours!';
      state.bannerTimer = 4;
    }
  } else if (ex.stage === 'escape') {
    if (Math.hypot(pos.x - EAST_PIER.x, pos.y - EAST_PIER.y) < 80) {
      completeExtraMission(state, 'VIRELIA IS YOURS! +$6,000');
    }
  }
}

export function updateExtraMissions(state, dt) {
  const m = state.missions;
  if (m.done) return;
  if (m.index === 4) updatePortsideJob(state, dt);
  else if (m.index === 5) updateLastStand(state, dt);
}

export function extraMissionWaypoint(state) {
  const m = state.missions;
  const ex = state.extra;
  if (m.index === 4) {
    if (ex.stage === 'escape') return { ...HIDEOUT };
    const crate = nextCrate(ex);
    if (crate) return { x: crate.x, y: crate.y };
    return { x: PORTSIDE.x + PORTSIDE.w / 2, y: PORTSIDE.y + PORTSIDE.h / 2 };
  }
  if (m.index === 5) {
    if (ex.stage === 'escape') return { ...EAST_PIER };
    const pos = playerPosition(state);
    return { x: pos.x, y: pos.y };
  }
  return null;
}

// Called from main.js whenever a police car is destroyed by Kai's bullets.
export function countPoliceKill(state) {
  if (state.missions.index !== 5) return;
  const ex = state.extra;
  ex.kills += 1;
  state.score += 500;
  state.bannerText = 'VPD car down — ' + ex.kills + '/' + LAST_STAND_KILLS + ' for the last stand.';
  state.bannerTimer = 3;
}

export function completeExtraMission(state, message) {
  const m = state.missions;
  const reward = MISSION_REWARD[m.index] ?? 0;
  state.player.money += reward;
  m.banner = message;
  state.audio?.mission();
  state.score += 1000 * (m.index + 1) + extraWeatherBonus(state);
  m.index += 1;
  m.stage = 'go';
  m.targetCar = null;
  m.timer = 0;
  state.extra = createExtraMissions();
  if (m.index >= MISSIONS.length) {
    m.done = true;
    state.screen = 'win';
    state.audio?.win();
  }
  // A finished mission is a save point: progress survives a reload.
  if (typeof state.saveGame === 'function') state.saveGame();
}

export function extraMissionProgressText(state) {
  const m = state.missions;
  const ex = state.extra;
  if (m.done) return 'ALL 12 MISSIONS COMPLETE';
  if (m.index === 4) {
    if (ex.stage === 'escape') return 'STAGE 2/2 · ESCAPE TO THE HIDEOUT!';
    return 'STAGE 1/2 · Secure the Portside crates — ' + ex.cratesCollected + '/3';
  }
  if (m.index === 5) {
    if (ex.stage === 'escape') return 'STAGE 2/2 · ESCAPE TO THE EAST PIER!';
    return 'STAGE 1/2 · Survive the last stand — ' + ex.kills + '/' + LAST_STAND_KILLS + ' VPD cars down';
  }
  return '';
}

export function extraMissionBriefings() {
  return MISSIONS.slice(4, 6);
}
