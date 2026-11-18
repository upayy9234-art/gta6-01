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

// --- round 8: weather, roadblocks, taxi + postcards ---
import { createWeather, updateWeather, forceWeather, gripFor, weatherLabel, rainDrops, fogBlobs, weatherBonus } from '../game/src/weather.js';
import { createRoadblocks, updateRoadblocks, checkSpikeStrips, nearestRoadblockDistance, roadblockWarning } from '../game/src/wanted.js';
import { createSide, tryTaxiPickup, finishFare, updateSide, taxiFareText, postcardText, sideSaveData, sideLoadData } from '../game/src/side.js';
import { weatherReportLine } from '../game/src/radio.js';
import { shopWeatherTip } from '../game/src/shops.js';
import { roadsidePoint, isOnRoad } from '../game/src/world.js';
import { ROADBLOCK, WEATHER, TAXI } from '../game/src/config.js';

function stubState(extra = {}) {
  return {
    random: createRandom(7),
    player: { x: 388, y: 388, inCar: null, money: 250, wanted: 0, health: 100 },
    cars: [], peds: [], bullets: [], particles: [],
    bannerText: '', bannerTimer: 0,
    audio: { siren() {}, crash() {}, thunder() {}, taxiPickup() {}, taxiPaid() {}, pickup() {} },
    time: 0, timeOfDay: 1085, score: 0,
    ...extra,
  };
}

{
  // weather: transitions, grip, labels, force, flash decay
  const state = stubState();
  state.weather = createWeather(state.random);
  check('weather starts clear with full grip', state.weather.kind === 'clear' && state.weather.gripMul === 1);
  check('grip rain 0.82 / storm 0.78 / fog 0.95', gripFor('rain') === 0.82 && gripFor('storm') === 0.78 && gripFor('fog') === 0.95);
  check('weather label names the kind', weatherLabel(state).includes('CLEAR'));
  state.weather.timer = 0.01;
  updateWeather(state, 0.02);
  check('weather rolls a new kind, never repeats', state.weather.kind !== 'clear' && state.weather.spells === 1, state.weather.kind);
  check('forceWeather rejects unknown kinds', forceWeather(state, 'hail') === false);
  check('forceWeather storm sets grip + flash', forceWeather(state, 'storm') && state.weather.gripMul === 0.78 && state.weather.flash > 0);
  state.weather.flash = 1;
  updateWeather(state, 0.5);
  check('lightning flash decays', state.weather.flash < 1 && state.weather.flash >= 0, state.weather.flash.toFixed(2));
  const drops = rainDrops(1.5, 10, 1280, 720);
  const drops2 = rainDrops(1.5, 10, 1280, 720);
  check('rain drops are deterministic', JSON.stringify(drops) === JSON.stringify(drops2) && drops.length === 10);
  const blobs = fogBlobs(2, 7, 1280, 720);
  check('fog blobs are deterministic', JSON.stringify(blobs) === JSON.stringify(fogBlobs(2, 7, 1280, 720)) && blobs.length === 7);
  state.weather.kind = 'rain';
  check('mission weather bonus rain +50 / storm +100', weatherBonus(state) === 50 && (() => { state.weather.kind = 'storm'; return weatherBonus(state) === 100; })());
}

{
  // roadblocks: spawn at wanted 3, contents, escalation, spike strip, stand-down
  const state = stubState();
  state.roadblocks = createRoadblocks();
  state.player.wanted = 3;
  updateRoadblocks(state, 0);
  check('roadblock spawns at wanted 3', state.roadblocks.list.length === 1, String(state.roadblocks.list.length));
  const block = state.roadblocks.list[0];
  check('block has 2 parked interceptor cars', block.cars.length === 2 && block.cars.every((c) => c.police && c.roadblock && c.speed === 0));
  check('block has a spike strip + 3 cones', !!block.strip && block.cones.length === 3);
  check('roadblock cars joined state.cars', state.cars.filter((c) => c.roadblock).length === 2);
  check('roadblock warning reports a distance', typeof roadblockWarning(state) === 'number', String(roadblockWarning(state)));
  state.roadblocks.spawnCd = 0;
  updateRoadblocks(state, 0);
  check('second block after SPAWN_GAP', state.roadblocks.list.length === 2);
  state.roadblocks.spawnCd = 0;
  updateRoadblocks(state, 0);
  check('max 2 blocks at wanted 3', state.roadblocks.list.length === 2);
  state.player.wanted = 4;
  state.roadblocks.spawnCd = 0;
  updateRoadblocks(state, 0);
  check('escalation: 3rd block at wanted 4', state.roadblocks.list.length === 3);
  // spike strip: drive the player car over the first strip
  const car = { x: block.strip.x, y: block.strip.y, health: 160, speed: 300, spikeCd: 0 };
  state.player.inCar = car;
  const hit = checkSpikeStrips(state, car, 1 / 60);
  check('spike strip bites: damage + speed loss', hit && car.health === 148 && car.speed === 135, `hp=${car.health} speed=${car.speed}`);
  check('spike strip cooldown blocks a second bite', checkSpikeStrips(state, car, 1 / 60) === false);
  check('nearest roadblock distance is finite', nearestRoadblockDistance(state) < Infinity);
  state.player.wanted = 0;
  updateRoadblocks(state, 0);
  check('blocks stand down below wanted 3', state.roadblocks.list.length === 0 && state.cars.filter((c) => c.roadblock).length === 0);
  check('no roadblock left: distance Infinity', nearestRoadblockDistance(state) === Infinity);
}

{
  // taxi + postcards: pool, pickup, pay, timeout, refill, VIP, streak, hunter
  const state = stubState();
  state.side = createSide(state.random);
  check('3 waiting fares at start', state.side.fares.length === 3 && state.side.fares.every((f) => f.waiting));
  check('10 postcards, none taken', state.side.postcards.length === 10 && state.side.collected === 0);
  const fare = state.side.fares[0];
  state.player.x = fare.x; state.player.y = fare.y;
  const picked = tryTaxiPickup(state);
  check('E picks up a waiting passenger', picked && state.side.activeFare === fare && state.side.fares.length === 2);
  const info = taxiFareText(state);
  check('fare text has timer, distance, pay', info && info.timer > 0 && info.pay >= 150 && info.pay <= 800, JSON.stringify(info));
  state.player.x = fare.dest.x; state.player.y = fare.dest.y;
  const moneyBefore = state.player.money;
  updateSide(state, 1 / 60);
  check('drop-off pays the fare', state.side.activeFare === null && state.side.faresDone === 1 && state.player.money === moneyBefore + fare.pay, `money=${state.player.money}`);
  // timeout: a second fare that never reaches its destination
  const fare2 = state.side.fares[0];
  state.player.x = fare2.x; state.player.y = fare2.y;
  tryTaxiPickup(state);
  state.side.activeFare.timer = 0.01;
  updateSide(state, 0.02);
  check('timeout fails the fare', state.side.activeFare === null && state.side.faresFailed === 1 && state.side.streak === 0);
  // streak bonus: two clean fares in a row, second pays +$50
  state.side.fares = [{ x: 500, y: 500, waiting: true, dest: null, timer: 0, pay: 0, vip: false, id: 99 }];
  state.player.x = 500; state.player.y = 500;
  tryTaxiPickup(state);
  const pay1 = state.side.activeFare.pay;
  state.player.x = state.side.activeFare.dest.x; state.player.y = state.side.activeFare.dest.y;
  updateSide(state, 1 / 60);
  state.side.fares = [{ x: 600, y: 600, waiting: true, dest: null, timer: 0, pay: 0, vip: false, id: 100 }];
  state.player.x = 600; state.player.y = 600;
  tryTaxiPickup(state);
  const pay2 = state.side.activeFare.pay;
  const m2 = state.player.money;
  state.player.x = state.side.activeFare.dest.x; state.player.y = state.side.activeFare.dest.y;
  updateSide(state, 1 / 60);
  check('streak bonus +$50 on the 2nd clean fare', state.player.money === m2 + pay2 + 50 && state.side.streak === 2, `pay2=${pay2}`);
  void pay1;
  // VIP fare pays double (cap $800)
  state.side.fares = [{ x: 700, y: 700, waiting: true, dest: null, timer: 0, pay: 0, vip: true, id: 101 }];
  state.player.x = 700; state.player.y = 700;
  tryTaxiPickup(state);
  check('VIP fare pays at least $300, at most $800', state.side.activeFare.pay >= 300 && state.side.activeFare.pay <= 800, `$${state.side.activeFare.pay}`);
  // postcards: Palm Boulevard pays +$150/+200, no double collect
  const cardState = stubState();
  cardState.side = createSide(cardState.random);
  cardState.player.x = 2930; cardState.player.y = 500;
  const cm = cardState.player.money, cs = cardState.score;
  updateSide(cardState, 1 / 60);
  check('postcard Palm Boulevard +$150/+200', cardState.side.collected === 1 && cardState.player.money === cm + 150 && cardState.score === cs + 200);
  updateSide(cardState, 1 / 60);
  check('postcard cannot be collected twice', cardState.side.collected === 1);
  check('postcard HUD text counts', postcardText(cardState) === 'POSTCARDS 1/10');
  // hunter bonus on the 10th card
  for (const c of cardState.side.postcards) { if (!c.taken) { c.taken = true; } }
  cardState.side.postcards[9].taken = false;
  cardState.side.collected = 9;
  cardState.player.x = cardState.side.postcards[9].x;
  cardState.player.y = cardState.side.postcards[9].y;
  const hm = cardState.player.money;
  updateSide(cardState, 1 / 60);
  check('10th postcard pays $1000 hunter bonus once', cardState.side.collected === 10 && cardState.player.money === hm + 150 + 1000 && cardState.side.hunterBonusPaid);
  // save / load round-trips the side state
  const saved = sideSaveData(cardState);
  const fresh = stubState();
  fresh.side = createSide(fresh.random);
  sideLoadData(fresh, saved);
  check('side save/load restores 10/10 + hunter flag', fresh.side.collected === 10 && fresh.side.hunterBonusPaid === true);
  check('side cashEarned tracked', cardState.side.cashEarned > 1000, String(cardState.side.cashEarned));
  // roadside point is always on a road shoulder
  const pt = roadsidePoint(createRandom(3));
  check('roadside point sits on a road', isOnRoad(pt.x, pt.y), `(${Math.round(pt.x)},${Math.round(pt.y)})`);
}

{
  // radio weather reports + shop weather tips, per kind
  const state = stubState();
  state.radio = createRadio();
  state.weather = createWeather(state.random);
  check('radio quiet on clear weather', weatherReportLine(state) === '');
  forceWeather(state, 'rain');
  const rainLine = weatherReportLine(state);
  check('radio reports rain', rainLine.includes('Rain'), rainLine);
  forceWeather(state, 'storm');
  check('radio reports storm', weatherReportLine(state).includes('Storm'));
  forceWeather(state, 'fog');
  check('radio reports fog', weatherReportLine(state).includes('Fog'));
  state.weather.kind = 'rain';
  check('shop tip warns about rain', shopWeatherTip(state).includes('Rain'));
  state.weather.kind = 'storm';
  check('shop tip warns about storm', shopWeatherTip(state).includes('Storm'));
  state.weather.kind = 'clear';
  check('shop tip silent on clear', shopWeatherTip(state) === '');
}

console.log(failures === 0 ? '\nALL UNIT TESTS PASSED' : `\n${failures} UNIT TEST FAILURES`);
process.exit(failures === 0 ? 0 : 1);
