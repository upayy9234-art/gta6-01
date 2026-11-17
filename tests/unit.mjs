// Neon Harbor round 5 — Node unit tests for the pure game modules.
// No browser needed: random, day/night, city gen, radio, shops and the Day 3
// mission engine are all exercised with stub states.
// Run: node tests/unit.mjs   (exit 0 = all pass)
import { createRandom } from '../game/src/random.js';
import { dayPhase, phaseLabel, daylight, goldenFactor, skyState, shadowStretch } from '../game/src/daynight.js';
import { MISSIONS, MISSION_REWARD, SHOPS, RADIO_STATIONS } from '../game/src/config.js';
import { buildCity } from '../game/src/world.js';
import { createRadio, updateRadio, radioTickerText, cycleStation } from '../game/src/radio.js';
import { createShops, buyShopItem, nearestShop } from '../game/src/shops.js';
import { createDay3, updateDay3Missions, day3Waypoint, day3ProgressText } from '../game/src/missions3.js';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures += 1;
}

// --- random: deterministic per seed ---
{
  const a = createRandom(1), b = createRandom(1);
  const seqA = [a.next(), a.next(), a.next(), a.int(1, 100), a.pick(['x', 'y', 'z'])];
  const seqB = [b.next(), b.next(), b.next(), b.int(1, 100), b.pick(['x', 'y', 'z'])];
  check('random is deterministic per seed', JSON.stringify(seqA) === JSON.stringify(seqB), JSON.stringify(seqA));
  const c = createRandom(2);
  check('random differs across seeds', c.next() !== createRandom(1).next());
}

// --- config: 12 missions, 3 days, 3 shops, 3 stations ---
{
  check('12 missions in the table', MISSIONS.length === 12, String(MISSIONS.length));
  check('12 mission rewards', MISSION_REWARD.length === 12);
  check('missions span 3 days', MISSIONS[0].day === 1 && MISSIONS[5].day === 2 && MISSIONS[6].day === 3 && MISSIONS[11].day === 3);
  check('3 shops, 3 items each', SHOPS.length === 3 && SHOPS.every((s) => s.items.length === 3));
  check('3 radio stations', RADIO_STATIONS.length === 3);
}

// --- daynight: golden hour at 18:05 ---
{
  check('18:05 is GOLDEN HOUR', phaseLabel(1085) === 'GOLDEN HOUR', phaseLabel(1085));
  check('golden factor peaks mid-hour', goldenFactor(1095) > 0.9, goldenFactor(1095).toFixed(2));
  check('daylight still high at 18:05', daylight(1085) > 0.5, daylight(1085).toFixed(2));
  check('sunset horizon is orange', skyState(1085).horizon === '#ff7a3d', skyState(1085).horizon);
  check('shadows stretch at golden hour', shadowStretch(1085) > 2, shadowStretch(1085).toFixed(2));
  check('night is dark at 22:00', daylight(1320) === 0 && dayPhase(1320) === 'night');
  check('warm wash only at golden hour', skyState(1085).warmAlpha > 0.05 && skyState(600).warmAlpha === 0);
}

// --- world: dense city with named signs and palms ---
{
  const city = buildCity(createRandom(1));
  check('dense city: 60+ buildings', city.buildings.length >= 60, String(city.buildings.length));
  check('8+ named signs', city.signs.length >= 8, String(city.signs.length));
  check('20+ palms', city.palms.length >= 20, String(city.palms.length));
  check('casino landmark present', city.casino && city.casino.cx === 1042);
  const city2 = buildCity(createRandom(1));
  check('same seed builds the same city', JSON.stringify(city.buildings) === JSON.stringify(city2.buildings));
}

// --- radio: ticker cycles, station changes ---
{
  const state = {
    radio: createRadio(), bannerText: '', bannerTimer: 0,
    audio: { tune() {} },
  };
  const seen = new Set();
  for (let i = 0; i < 8; i += 1) {
    updateRadio(state, 5.1);
    seen.add(radioTickerText(state));
  }
  check('radio ticker changes over time', seen.size >= 3, [...seen].slice(0, 3).join(' | '));
  const before = state.radio.station;
  cycleStation(state);
  check('R cycles the station', state.radio.station === (before + 1) % 3, `station=${state.radio.station}`);
}

// --- shops: buy ammo and food, money moves ---
{
  const state = {
    player: { money: 500, health: 50, x: 520, y: 430, inCar: null },
    weapons: { owned: { pistol: true, smg: false, shotgun: false, rifle: false }, ammo: { pistol: Infinity, smg: 0, shotgun: 0, rifle: 0 }, current: 'pistol' },
    shops: createShops(), score: 0, bannerText: '', bannerTimer: 0,
    audio: { buy() {} },
  };
  state.shops.open = 'arms';
  check('shop found near Harbor Arms', nearestShop(state)?.id === 'arms');
  const ok = buyShopItem(state, 1);
  check('buy SMG ammo: money down, ammo up', ok && state.player.money === 350 && state.weapons.ammo.smg === 120,
    `money=${state.player.money} ammo=${state.weapons.ammo.smg}`);
  state.shops.open = 'diner';
  state.player.money = 10;
  check('broke player cannot buy', buyShopItem(state, 1) === false && state.player.money === 10);
  state.player.money = 500;
  const healed = buyShopItem(state, 1);
  check('diner meal heals', healed && state.player.health === 90, `hp=${state.player.health}`);
  state.player.health = 100;
  check('full health refuses a meal', buyShopItem(state, 3) === false);
}

// --- missions3: Day 3 step machine, mission 7 and the finale ---
{
  const audio = { mission() {}, win() {}, crate() {}, pickup() {} };
  const state = {
    player: { x: 388, y: 388, inCar: null, money: 250, wanted: 0 },
    missions: { index: 6, stage: 'go', done: false, timer: 0 },
    day3: createDay3(), score: 0, screen: 'play',
    audio, saveGame: null,
  };
  check('mission 7 waypoint is the Strip rooftop', (() => { const w = day3Waypoint(state); return w.x === 1696 && w.y === 824; })());
  check('mission 7 progress shows STAGE 1/1', day3ProgressText(state).startsWith('STAGE 1/1'));
  state.player.x = 1696; state.player.y = 824;
  updateDay3Missions(state, 1 / 60);
  check('mission 7 completes at the waypoint', state.missions.index === 7, `index=${state.missions.index}`);
  // Finale: mission 12, three steps, win screen at the pier.
  state.missions.index = 11;
  state.day3 = createDay3();
  state.player.x = 824; state.player.y = 1696;
  updateDay3Missions(state, 1 / 60);
  check('finale step 1 done (vault door)', state.day3.step === 1, `step=${state.day3.step}`);
  updateDay3Missions(state, 1 / 60);
  check('finale grab pays $5000 and raises wanted 5', state.player.money >= 5250 && state.player.wanted === 5,
    `money=${state.player.money} wanted=${state.player.wanted}`);
  state.player.x = 3120; state.player.y = 668;
  updateDay3Missions(state, 1 / 60);
  check('finale ends at the East Pier: win screen', state.missions.done === true && state.screen === 'win',
    `done=${state.missions.done} screen=${state.screen}`);
}

console.log(failures === 0 ? '\nALL UNIT TESTS PASSED' : `\n${failures} UNIT TEST FAILURES`);
process.exit(failures === 0 ? 0 : 1);
