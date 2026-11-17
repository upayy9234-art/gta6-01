// Missions 7–12 — Day 3 of Kai Mercer's story: the Harbor Vault heist finale.
// Mara Voss gathers the crew, the inside man hands over the vault codes, the
// getaway route is timed, and then the vault itself — twice. Each mission is a
// short list of steps (go / grab / escape); the HUD shows "STAGE s/t" so the
// player always knows how far through the job they are. Missions 1–4 live in
// missions.js, 5–6 in missions2.js.
import { MISSION_REWARD, MISSIONS } from './config.js';

export const HIDEOUT = { x: 420, y: 420 };
export const EAST_PIER = { x: 3120, y: 668 };
export const HARBOR_VAULT = { x: 824, y: 1696 };

// Step lists, keyed by mission index (6 = mission 7, …, 11 = mission 12).
export const DAY3_STEPS = {
  6: [
    { kind: 'go', x: 1696, y: 824, label: 'MEET THE CREW — NEON STRIP ROOFTOP' },
  ],
  7: [
    { kind: 'go', x: 1042, y: 800, label: 'PICK UP THE INSIDE MAN — CASINO' },
    { kind: 'go', x: 420, y: 420, label: 'BRING HIM TO THE HIDEOUT' },
  ],
  8: [
    { kind: 'go', x: 2132, y: 1260, label: 'REACH AZURA BANK' },
    { kind: 'grab', x: 2132, y: 1260, cash: 800, label: 'GRAB THE VAULT CODES' },
    { kind: 'escape', x: 420, y: 420, label: 'ESCAPE TO THE HIDEOUT' },
  ],
  9: [
    { kind: 'go', x: 700, y: 388, label: 'CHECK THE GETAWAY CAR — GARAGE' },
    { kind: 'go', x: 3120, y: 668, label: 'RUN THE ROUTE — EAST PIER' },
  ],
  10: [
    { kind: 'go', x: 824, y: 1696, label: 'REACH THE HARBOR VAULT' },
    { kind: 'grab', x: 824, y: 1696, cash: 3000, wanted: 5, label: 'GRAB THE VAULT CASH' },
    { kind: 'escape', x: 420, y: 420, label: 'ESCAPE TO THE HIDEOUT' },
  ],
  11: [
    { kind: 'go', x: 824, y: 1696, label: 'REACH THE VAULT INNER ROOM' },
    { kind: 'grab', x: 824, y: 1696, cash: 5000, wanted: 5, label: 'GRAB THE FINAL SCORE' },
    { kind: 'escape', x: 3120, y: 668, label: 'ESCAPE TO THE EAST PIER — HELI ON YOU' },
  ],
};

export const DAY3_COMPLETE = {
  6: 'The crew is in. Tonight, the Harbor Vault. +$800',
  7: 'The inside man is safe. He knows the vault codes. +$1,500',
  8: 'Codes in hand. The vault is just a door now. +$2,600',
  9: 'Route timed, car ready. Tomorrow night, we go. +$1,800',
  10: 'THE HARBOR VAULT IS OPEN! +$5,000',
  11: 'TWELVE JOBS DONE — VIRELIA IS YOURS! +$10,000',
};

export function createDay3() {
  return { step: 0, kills: 0 };
}

function playerPosition(state) {
  const p = state.player;
  return p.inCar ? { x: p.inCar.x, y: p.inCar.y } : { x: p.x, y: p.y };
}

export function day3Steps(state) {
  return DAY3_STEPS[state.missions.index] ?? [];
}

export function day3Waypoint(state) {
  const steps = day3Steps(state);
  const d3 = state.day3;
  if (!d3 || steps.length === 0) return null;
  const step = steps[Math.min(d3.step, steps.length - 1)];
  return { x: step.x, y: step.y };
}

export function updateDay3Missions(state, dt) {
  const m = state.missions;
  if (m.done) return;
  const d3 = state.day3;
  if (!d3) return;
  const steps = day3Steps(state);
  if (steps.length === 0) return;
  const step = steps[Math.min(d3.step, steps.length - 1)];
  const pos = playerPosition(state);
  const reach = step.kind === 'escape' ? 80 : 70;
  if (Math.hypot(pos.x - step.x, pos.y - step.y) > reach) return;
  void dt;
  if (step.kind === 'grab') {
    state.player.money += step.cash ?? 0;
    if (step.wanted) state.player.wanted = Math.max(state.player.wanted, step.wanted);
    state.audio?.crate();
    state.bannerText = step.label + ' — $' + (step.cash ?? 0).toLocaleString('en-US') + '!';
    state.bannerTimer = 3;
  } else if (step.kind === 'escape') {
    completeDay3Mission(state);
    return;
  } else {
    state.bannerText = step.label + ' — done.';
    state.bannerTimer = 2.5;
    state.audio?.pickup();
  }
  d3.step += 1;
  state.score += 250;
  // Stepping past the last step without an escape step still completes.
  if (d3.step >= steps.length) completeDay3Mission(state);
}

export function completeDay3Mission(state) {
  const m = state.missions;
  const reward = MISSION_REWARD[m.index] ?? 0;
  state.player.money += reward;
  m.banner = DAY3_COMPLETE[m.index] ?? 'Mission complete!';
  state.audio?.mission();
  state.score += 1000 * (m.index + 1);
  m.index += 1;
  m.stage = 'go'; m.targetCar = null; m.timer = 0;
  state.day3 = createDay3();
  if (m.index >= MISSIONS.length) {
    m.done = true;
    state.screen = 'win';
    state.audio?.win();
  }
  // A finished mission is a save point: progress survives a reload.
  if (typeof state.saveGame === 'function') state.saveGame();
}

export function day3ProgressText(state) {
  const m = state.missions;
  const d3 = state.day3;
  if (m.done) return 'ALL 12 MISSIONS COMPLETE';
  const steps = day3Steps(state);
  if (!d3 || steps.length === 0) return MISSIONS[m.index]?.objective ?? '';
  const step = steps[Math.min(d3.step, steps.length - 1)];
  const s = Math.min(d3.step + 1, steps.length);
  return 'STAGE ' + s + '/' + steps.length + ' · ' + step.label;
}

export function day3Briefings() {
  return MISSIONS.slice(6);
}
