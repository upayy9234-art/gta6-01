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
import { createWeather, updateWeather, forceWeather, gripFor, weatherLabel } from '../game/src/weather.js';
import { createRoadblocks, updateRoadblocks, checkSpikeStrips, nearestRoadblockDistance } from '../game/src/wanted.js';
import { createSide, updateSide, tryTaxiPickup, sideSaveData, sideLoadData, postcardText } from '../game/src/side.js';
import { makeCar } from '../game/src/traffic.js';
import { ROADBLOCK, POSTCARD_SPOTS } from '../game/src/config.js';

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

// --- round 6: weather — transitions, grip, labels ---
{
  const random = createRandom(7);
  const state = {
    random, weather: createWeather(random),
    audio: { thunder() {} },
    bannerText: '', bannerTimer: 0,
  };
  check('weather opens clear with full grip', state.weather.kind === 'clear' && state.weather.gripMul === 1);
  check('rain grip is below 1 (slick roads)', gripFor('rain') === 0.82 && gripFor('rain') < 1);
  check('storm grip is the worst', gripFor('storm') === 0.78 && gripFor('storm') < gripFor('rain'));
  check('fog grip is nearly full', gripFor('fog') === 0.95);
  check('weather label names the rain', weatherLabel({ weather: { kind: 'rain' } }).text.includes('RAIN'));
  // Force a spell change: timer 0 rolls the state machine to a new kind.
  state.weather.timer = 0;
  updateWeather(state, 0.1);
  check('weather transitions off clear', state.weather.kind !== 'clear', state.weather.kind);
  check('weather grip follows the kind', state.weather.gripMul === gripFor(state.weather.kind));
  // forceWeather holds a kind for staging and tests.
  check('forceWeather sets storm + grip', forceWeather(state, 'storm') && state.weather.kind === 'storm' && state.weather.gripMul === 0.78);
  check('forceWeather refuses a bad kind', forceWeather(state, 'hail') === false && state.weather.kind === 'storm');
  // Storm lightning: flash decays and the flash timer re-arms.
  state.weather.flash = 1;
  updateWeather(state, 0.5);
  check('lightning flash decays', state.weather.flash < 1, state.weather.flash.toFixed(2));
}

// --- round 6: roadblocks — spawn at wanted 3, stand down below 3, spike strip bites ---
{
  const random = createRandom(11);
  const state = {
    random,
    player: { x: 388, y: 388, inCar: null, wanted: 0, money: 250, health: 100 },
    cars: [], roadblocks: createRoadblocks(), particles: [],
    audio: { siren() {}, crash() {} },
    bannerText: '', bannerTimer: 0,
  };
  updateRoadblocks(state, 0.1);
  check('no roadblock at wanted 0', state.roadblocks.list.length === 0 && state.cars.length === 0);
  state.player.wanted = 3;
  updateRoadblocks(state, 0.1);
  check('roadblock spawns at wanted 3', state.roadblocks.list.length === 1, `blocks=${state.roadblocks.list.length}`);
  check('roadblock parks 2 police cars', state.roadblocks.list[0].cars.length === 2 && state.cars.length === 2);
  check('roadblock cars are parked police', state.cars.every((c) => c.police && c.roadblock && c.speed === 0));
  check('roadblock has a spike strip + cones', state.roadblocks.list[0].strip && state.roadblocks.list[0].cones.length === 3);
  check('nearest roadblock is within warning range', nearestRoadblockDistance(state) < 700, String(Math.round(nearestRoadblockDistance(state))));
  // Second block appears after the spawn gap.
  updateRoadblocks(state, ROADBLOCK.SPAWN_GAP + 0.1);
  check('second roadblock spawns (max 2)', state.roadblocks.list.length === 2, `blocks=${state.roadblocks.list.length}`);
  updateRoadblocks(state, 60);
  check('never more than 2 roadblocks', state.roadblocks.list.length === 2);
  // Spike strip: roll the player's car over it.
  const strip = state.roadblocks.list[0].strip;
  const car = makeCar(strip.x, strip.y, 0, { name: 'Test', color: '#fff', speed: 1 }, {});
  car.health = 160; car.speed = 300; car.spikeCd = 0;
  state.player.inCar = car;
  const hit = checkSpikeStrips(state, car, 1 / 60);
  check('spike strip hits the car', hit === true);
  check('spike strip damages + halves speed', car.health === 160 - ROADBLOCK.SPIKE_DAMAGE && car.speed < 160,
    `health=${car.health} speed=${car.speed.toFixed(0)}`);
  check('spike strip cooldown blocks a second instant hit', checkSpikeStrips(state, car, 1 / 60) === false);
  // Wanted drops: the blocks stand down and their cars leave the street.
  state.player.wanted = 2;
  updateRoadblocks(state, 0.1);
  check('roadblocks stand down below wanted 3', state.roadblocks.list.length === 0 && state.cars.length === 0);
  check('no roadblock distance once clear', nearestRoadblockDistance(state) === Infinity);
}

// --- round 6: taxi fares — pickup, dropoff pays, timeout fails ---
{
  const random = createRandom(21);
  const mkState = () => ({
    random,
    player: { x: 388, y: 388, inCar: null, money: 250, health: 100, wanted: 0 },
    side: createSide(random), score: 0,
    audio: { taxiPickup() {}, taxiPaid() {}, pickup() {} },
    bannerText: '', bannerTimer: 0,
  });
  const state = mkState();
  check('3 passengers wait at the start', state.side.fares.length === 3);
  check('no active fare at the start', state.side.activeFare === null);
  check('no pickup when nobody is near', tryTaxiPickup(state) === false);
  // Stand next to the first waiting fare and press E.
  const fare = state.side.fares[0];
  state.player.x = fare.x; state.player.y = fare.y;
  check('E picks up a nearby passenger', tryTaxiPickup(state) === true);
  check('fare has a destination + timer + pay', state.side.activeFare.dest !== null && state.side.activeFare.timer > 0 && state.side.activeFare.pay >= 150,
    `pay=$${state.side.activeFare?.pay} timer=${state.side.activeFare?.timer.toFixed(0)}s`);
  const pay = state.side.activeFare.pay;
  const moneyBefore = state.player.money;
  // Drive to the drop-off and the fare pays out.
  state.player.x = state.side.activeFare.dest.x; state.player.y = state.side.activeFare.dest.y;
  updateSide(state, 0.1);
  check('dropoff pays the fare', state.player.money === moneyBefore + pay && state.side.activeFare === null,
    `money=${state.player.money} pay=$${pay}`);
  check('fare counter counts the completed trip', state.side.faresDone === 1);
  // A second fare, left to time out, fails instead of paying.
  const fare2 = state.side.fares[0];
  state.player.x = fare2.x; state.player.y = fare2.y;
  tryTaxiPickup(state);
  state.side.activeFare.timer = 0.05;
  updateSide(state, 0.1);
  check('expired fare fails without paying', state.side.activeFare === null && state.player.money === moneyBefore + pay,
    `money=${state.player.money}`);
  check('failed fare counted', state.side.faresFailed === 1);
  // Waiting pool refills back toward 3.
  for (let i = 0; i < 30; i += 1) updateSide(state, 1);
  check('waiting pool refills', state.side.fares.length === 3, `fares=${state.side.fares.length}`);
}

// --- round 6: postcards — collect, counter, save/load ---
{
  const random = createRandom(31);
  const state = {
    random,
    player: { x: 388, y: 388, inCar: null, money: 250, health: 100, wanted: 0 },
    side: createSide(random), score: 0,
    audio: { taxiPickup() {}, taxiPaid() {}, pickup() {} },
    bannerText: '', bannerTimer: 0,
  };
  check('10 postcards hidden', POSTCARD_SPOTS.length === 10 && state.side.postcards.length === 10);
  check('postcard counter starts 0/10', postcardText(state) === 'POSTCARDS 0/10', postcardText(state));
  const spot = state.side.postcards[0];
  state.player.x = spot.x; state.player.y = spot.y;
  updateSide(state, 0.1);
  check('walking over a postcard collects it', spot.taken === true && state.side.collected === 1);
  check('postcard pays $150 + score', state.player.money === 400 && state.score === 200, `money=${state.player.money} score=${state.score}`);
  check('postcard counter reads 1/10', postcardText(state) === 'POSTCARDS 1/10');
  updateSide(state, 0.1);
  check('collected postcard does not pay twice', state.player.money === 400 && state.side.collected === 1);
  // Save/load round-trips the collection.
  const saved = sideSaveData(state);
  const state2 = {
    random: createRandom(31),
    player: { x: 388, y: 388, inCar: null, money: 250, health: 100, wanted: 0 },
    side: createSide(createRandom(31)), score: 0,
    audio: {}, bannerText: '', bannerTimer: 0,
  };
  sideLoadData(state2, saved);
  check('save/load restores collected postcards', state2.side.collected === 1 && state2.side.postcards[0].taken === true,
    `collected=${state2.side.collected}`);
}

console.log(failures === 0 ? '\nALL UNIT TESTS PASSED' : `\n${failures} UNIT TEST FAILURES`);
process.exit(failures === 0 ? 0 : 1);
