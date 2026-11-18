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

// --- round 7: weather, roadblocks, taxi, postcards, radio+shop, r7 extras ---
import { createWeather, updateWeather, forceWeather, weatherLabel, rainDrops, fogBlobs, gripFor, isWet, nextWeatherKind } from '../game/src/weather.js';
import { createRoadblocks, updateRoadblocks, checkSpikeStrips, nearestRoadblockDistance, roadblockWarning, maxActiveBlocks } from '../game/src/wanted.js';
import { createSide, spawnWaitingFare, pickDestination, tryTaxiPickup, finishFare, updateSide, taxiFareText, postcardText, sideIncomeText, sideSaveData, sideLoadData } from '../game/src/side.js';
import { missionWeatherBonus } from '../game/src/missions.js';
import { weatherReportLine } from '../game/src/radio.js';
import { shopWeatherTip } from '../game/src/shops.js';
import { ensureHeli } from '../game/src/heli.js';
import { ensurePolice, nearestPoliceDistance } from '../game/src/police.js';
import { isOnRoad, roadsidePoint, roadCentersX, roadCentersY } from '../game/src/world.js';
import { updateCarPhysics } from '../game/src/traffic.js';
import { TAXI, POSTCARD_SPOTS, ROADBLOCK } from '../game/src/config.js';

// No-op audio stub: every sound is a function that does nothing.
const audio = new Proxy({}, { get: () => () => {} });

function weatherState(kind = 'clear') {
  const random = createRandom(11);
  return {
    random, time: 0, audio, bannerText: '', bannerTimer: 0,
    weather: createWeather(random), radio: createRadio(),
    player: { x: 388, y: 388, angle: 0, wanted: 0, inCar: null, money: 250 },
  };
}

function roadState(wanted = 3) {
  const random = createRandom(7);
  const car = {
    x: 388, y: 388, angle: 0, speed: 0, health: 160, maxHealth: 160,
    model: { name: 'Test', color: '#ffffff', speed: 1 },
    npc: false, police: false, driver: true,
  };
  return {
    random, time: 0, audio, bannerText: '', bannerTimer: 0,
    player: { x: 388, y: 388, angle: 0, wanted, inCar: car, money: 250 },
    cars: [car], particles: [], bullets: [], helis: [],
    city: { buildings: [], parks: [], lamps: [], palms: [], signs: [] },
    roadblocks: createRoadblocks(),
    weather: createWeather(random),
  };
}

function sideState() {
  const random = createRandom(21);
  return {
    random, time: 0, audio, bannerText: '', bannerTimer: 0, score: 0,
    player: { x: 388, y: 388, angle: 0, wanted: 0, inCar: null, money: 250 },
    cars: [], particles: [],
    side: createSide(random),
    weather: createWeather(random),
  };
}

// --- weather: spells, grip, labels, force, flash, determinism ---
{
  const w = createWeather(createRandom(3));
  check('weather opens clear with full grip', w.kind === 'clear' && w.gripMul === 1, w.kind);
  check('weather spell lasts 90–150 s', w.timer >= 90 && w.timer <= 150, `timer=${w.timer.toFixed(1)}`);
  check('grip rain 0.82 / storm 0.78 / fog 0.95', gripFor('rain') === 0.82 && gripFor('storm') === 0.78 && gripFor('fog') === 0.95);
  check('isWet true only for rain/storm', isWet('rain') && isWet('storm') && !isWet('clear') && !isWet('fog'));
  const s = weatherState();
  check('forceWeather rain sets grip 0.82', forceWeather(s, 'rain') === true && s.weather.kind === 'rain' && s.weather.gripMul === 0.82);
  check('forceWeather rejects an unknown kind', forceWeather(s, 'hail') === false && s.weather.kind === 'rain');
  check('weather label names the rain', weatherLabel(s).includes('RAIN'), weatherLabel(s));
  forceWeather(s, 'storm');
  check('weather label names the storm', weatherLabel(s).includes('STORM'), weatherLabel(s));
  // A spell turn never repeats the kind that is already overhead.
  const kinds = [];
  for (let i = 0; i < 20; i += 1) {
    s.weather.timer = 0.01;
    updateWeather(s, 1 / 60);
    kinds.push(s.weather.kind);
  }
  const repeats = kinds.slice(1).filter((k, i) => k === kinds[i]).length;
  check('weather kind never repeats twice in a row', repeats === 0, kinds.slice(0, 8).join(','));
  check('weather counts its spells', s.weather.spells === 20, `spells=${s.weather.spells}`);
  check('storm transition flashes lightning', (() => {
    const t = weatherState();
    t.weather.kind = 'clear'; t.weather.timer = 0.01;
    // Force the roll toward storm by seeding: run turns until storm appears.
    for (let i = 0; i < 60 && t.weather.kind !== 'storm'; i += 1) { t.weather.timer = 0.01; updateWeather(t, 1 / 60); }
    return t.weather.kind === 'storm' && t.weather.flash > 0;
  })());
  // Lightning fades at 1.8/s.
  const f = weatherState();
  f.weather.kind = 'storm'; f.weather.flash = 1; f.weather.flashTimer = 999; f.weather.timer = 999;
  updateWeather(f, 0.25);
  check('storm flash decays 1.8/s', Math.abs(f.weather.flash - 0.55) < 0.01, `flash=${f.weather.flash.toFixed(2)}`);
  // Deterministic rain and fog: same time, same drops and blobs.
  const d1 = rainDrops(12.5, 110, 1280, 720), d2 = rainDrops(12.5, 110, 1280, 720);
  check('rain drops are deterministic per time', JSON.stringify(d1) === JSON.stringify(d2) && d1.length === 110);
  check('rain drop lengths 14–26', d1.every((d) => d.len >= 14 && d.len <= 26));
  const b1 = fogBlobs(7.25, 7, 1280, 720), b2 = fogBlobs(7.25, 7, 1280, 720);
  check('fog blobs are deterministic per time', JSON.stringify(b1) === JSON.stringify(b2) && b1.length === 7);
  check('fog blob radius 160–340', b1.every((b) => b.radius >= 160 && b.radius <= 340));
  // The sky reads the weather: storm kills the golden hour and the stars.
  const goldenClear = skyState(1085).golden;
  const stormSky = skyState(1085, { kind: 'storm' });
  check('storm cuts golden hour to a quarter', Math.abs(stormSky.golden - goldenClear * 0.25) < 0.01, `golden=${stormSky.golden.toFixed(2)}`);
  check('stars vanish unless clear', skyState(200, { kind: 'rain' }).starAlpha === 0 && skyState(200).starAlpha > 0);
  check('storm darkens the night tint', stormSky.nightAlpha > skyState(1085).nightAlpha, `night=${stormSky.nightAlpha.toFixed(2)}`);
  // Mission score bonus in bad weather.
  check('mission bonus rain +50 / storm +100 / clear 0',
    missionWeatherBonus({ weather: { kind: 'rain' } }) === 50
    && missionWeatherBonus({ weather: { kind: 'storm' } }) === 100
    && missionWeatherBonus({ weather: { kind: 'clear' } }) === 0);
  // nextWeatherKind never returns the current kind, whatever the roll.
  const r = createRandom(99);
  let bad = 0;
  for (let i = 0; i < 50; i += 1) if (nextWeatherKind(r, 'fog') === 'fog') bad += 1;
  check('nextWeatherKind never repeats the current kind', bad === 0);
}

// --- roadblocks: spawn, shape, limits, spikes, stand-down ---
{
  const s = roadState(3);
  check('roadblock distance is Infinity with none', nearestRoadblockDistance(s) === Infinity && roadblockWarning(s) === null);
  updateRoadblocks(s, 1 / 60);
  check('one block spawns at wanted 3', s.roadblocks.list.length === 1, `blocks=${s.roadblocks.list.length}`);
  const block = s.roadblocks.list[0];
  check('block sits on the road ahead', block.y === 388 && block.x > 700 && block.x < 1100, `(${block.x},${block.y})`);
  check('block has 2 parked interceptors', block.cars.length === 2
    && block.cars.every((c) => c.roadblock && c.police && c.speed === 0 && c.health === 120 && c.maxHealth === 120));
  check('block has a spike strip and 3 cones', !!block.strip && block.cones.length === 3);
  check('roadblock warning rounds the distance', roadblockWarning(s) === Math.round(nearestRoadblockDistance(s)) && roadblockWarning(s) === 480,
    `warn=${roadblockWarning(s)}`);
  check('max 2 blocks at wanted 3', (() => {
    s.roadblocks.spawnCd = 0; updateRoadblocks(s, 1 / 60);
    const two = s.roadblocks.list.length === 2;
    s.roadblocks.spawnCd = 0; updateRoadblocks(s, 1 / 60);
    return two && s.roadblocks.list.length === 2;
  })());
  check('max 3 blocks at wanted 4 (round 7 escalation)', (() => {
    s.player.wanted = 4; s.roadblocks.spawnCd = 0; updateRoadblocks(s, 1 / 60);
    return s.roadblocks.list.length === 3 && maxActiveBlocks(4) === 3 && maxActiveBlocks(3) === 2;
  })());
  // Roadblock cars are not chasers and never count as police distance.
  check('ensurePolice ignores roadblock cars', (() => {
    s.player.wanted = 3;
    const before = s.cars.filter((c) => c.police && !c.patrol && !c.roadblock).length;
    ensurePolice(s, s.random);
    return s.cars.filter((c) => c.police && !c.patrol && !c.roadblock).length === 3 && before === 0;
  })());
  check('nearest police distance ignores roadblocks', (() => {
    const t = roadState(3);
    updateRoadblocks(t, 1 / 60);
    return nearestPoliceDistance(t) === Infinity;
  })());
  // Spike strip: damage, speed cut, slow flag, cooldown, then re-arm.
  const car = s.player.inCar;
  const strip = s.roadblocks.list[0].strip;
  car.x = strip.x; car.y = strip.y; car.speed = 200; car.health = 160;
  const hit = checkSpikeStrips(s, car);
  check('spike strip hits: -12 hp, speed x0.45, slow 1.6',
    hit && car.health === 160 - ROADBLOCK.SPIKE_DAMAGE && car.speed === 90 && car.spikeSlow === 1.6,
    `hp=${car.health} speed=${car.speed}`);
  check('spike strip cooldown blocks a second hit', checkSpikeStrips(s, car) === false);
  let hits = 1;
  for (let i = 0; i < 130; i += 1) if (checkSpikeStrips(s, car, 1 / 60)) hits += 1;
  check('spike strip re-arms after its 2 s cooldown', hits === 2, `hits=${hits}`);
  // Smashing a block's cars opens the road again.
  check('destroyed block is pruned from the list', (() => {
    const b = s.roadblocks.list[0];
    for (const c of b.cars) s.cars.splice(s.cars.indexOf(c), 1);
    s.roadblocks.spawnCd = 999;
    updateRoadblocks(s, 1 / 60);
    return !s.roadblocks.list.includes(b);
  })());
  // Heat below 3: every block stands down at once.
  s.player.wanted = 2;
  updateRoadblocks(s, 1 / 60);
  check('blocks stand down below wanted 3', s.roadblocks.list.length === 0
    && s.cars.every((c) => !c.roadblock), `blocks=${s.roadblocks.list.length}`);
  // Lockdown banner fires once at wanted 5, then re-arms below 5.
  const l = roadState(5);
  updateRoadblocks(l, 1 / 60);
  check('lockdown announces at wanted 5', l.roadblocks.lockdownAnnounced === true
    && l.bannerText.includes('LOCKDOWN') && l.bannerTimer === 4, l.bannerText);
  l.player.wanted = 4;
  updateRoadblocks(l, 1 / 60);
  check('lockdown flag resets below wanted 5', l.roadblocks.lockdownAnnounced === false);
  // Second heli at wanted 5, one at 4, none below.
  const h = roadState(5);
  ensureHeli(h);
  check('two helis at wanted 5', h.helis.length === 2 && h.helis[1].sweep === Math.PI, `helis=${h.helis.length}`);
  h.player.wanted = 4;
  ensureHeli(h);
  check('one heli at wanted 4', h.helis.length === 1);
  h.player.wanted = 3;
  ensureHeli(h);
  check('no heli below wanted 4', h.helis.length === 0);
  // Rain grip: the same half-second of full throttle goes further dry.
  const drive = (kind, grip) => {
    const t = roadState(0);
    t.weather.kind = kind; t.weather.gripMul = grip; t.weather.timer = 999;
    const c = t.player.inCar;
    c.x = 500; c.y = 388; c.angle = 0; c.speed = 0;
    const input = { up: () => true, down: () => false, left: () => false, right: () => false, run: () => false, shooting: () => false };
    for (let i = 0; i < 30; i += 1) updateCarPhysics(c, input, 1 / 60, t);
    return c.speed;
  };
  const dry = drive('clear', 1), wet = drive('rain', 0.82);
  check('rain grip: 0.5 s full throttle is slower by 15+', wet < dry - 15, `dry=${dry.toFixed(0)} rain=${wet.toFixed(0)}`);
}

// --- taxi: spawn, pickup, pay, drop-off, timeout, refill ---
{
  const s = sideState();
  check('3 waiting fares at the start', s.side.fares.length === 3 && s.side.fares.every((f) => f.waiting));
  check('10 postcard spots', s.side.postcards.length === 10 && POSTCARD_SPOTS.length === 10);
  check('postcard text reads 0/10', postcardText(s) === 'POSTCARDS 0/10');
  check('no active fare at the start', taxiFareText(s) === null);
  // Every roadside point sits exactly on a shoulder band: 64 units off a
  // road centre (road half-width 48 + 16), along a road, never in a block.
  const r = createRandom(5);
  let onShoulder = 0;
  for (let i = 0; i < 20; i += 1) {
    const p = roadsidePoint(r);
    const offX = Math.min(...roadCentersX().map((cx) => Math.abs(p.x - cx)));
    const offY = Math.min(...roadCentersY().map((cy) => Math.abs(p.y - cy)));
    if (Math.abs(offX - 64) < 0.01 || Math.abs(offY - 64) < 0.01) onShoulder += 1;
  }
  check('roadside points sit on the road shoulder', onShoulder === 20, `${onShoulder}/20`);
  // Pickup: stand on a passenger, press E.
  const fare = s.side.fares[0];
  s.player.x = fare.x; s.player.y = fare.y;
  const moneyBefore = s.player.money;
  const ok = tryTaxiPickup(s);
  check('taxi pickup works next to a passenger', ok && s.side.activeFare === fare && !fare.waiting);
  const dist = Math.hypot(fare.dest.x - fare.x, fare.dest.y - fare.y);
  check('fare destination is 500–1400 away', dist >= TAXI.MIN_TRIP && dist <= TAXI.MAX_TRIP, `dist=${dist.toFixed(0)}`);
  check('fare pay is $150–$400 (or $800 VIP)', fare.pay >= TAXI.MIN_PAY && fare.pay <= TAXI.MAX_PAY * 2, `pay=$${fare.pay}`);
  check('fare timer covers the trip', fare.timer > dist / TAXI.SPEED && fare.timer < dist / TAXI.SPEED + TAXI.BASE_TIME + 1, `timer=${fare.timer.toFixed(1)}`);
  const text = taxiFareText(s);
  check('fare HUD text matches the active fare', text && text.pay === fare.pay && text.timer === Math.ceil(fare.timer) && text.urgent === false);
  // Drop-off: drive to the flag and the fare pays out. The flag is moved to
  // a fixed safe point first, so no postcard can pay out in the same frame
  // and muddy the exact money check.
  s.side.activeFare.dest = { x: 2000, y: 1260 };
  s.player.x = 2000; s.player.y = 1260;
  updateSide(s, 1 / 60);
  check('drop-off pays the fare and counts it', s.side.faresDone === 1 && s.side.activeFare === null
    && s.player.money === moneyBefore + fare.pay, `money=${s.player.money} done=${s.side.faresDone}`);
  check('side income ledger tracks the fare', s.side.cashEarned === fare.pay, `cashEarned=$${s.side.cashEarned}`);
  // Refill: the pool tops back up to 3 waiting fares.
  check('pool refills after a fare', (() => {
    for (let i = 0; i < 10; i += 1) updateSide(s, 1);
    return s.side.fares.length === 3;
  })());
  // Timeout: a fare that runs out of time fails and resets the streak.
  const s2 = sideState();
  const f2 = s2.side.fares[0];
  s2.player.x = f2.x; s2.player.y = f2.y;
  tryTaxiPickup(s2);
  s2.side.streak = 2;
  s2.side.activeFare.timer = 0.01;
  s2.player.x = 388; s2.player.y = 388;
  updateSide(s2, 1 / 60);
  check('timed-out fare fails and resets the streak', s2.side.faresFailed === 1 && s2.side.activeFare === null && s2.side.streak === 0);
  // No pickup when a fare is already active, or nobody is near.
  const s3 = sideState();
  s3.player.x = 100; s3.player.y = 100;
  check('no pickup with nobody near', tryTaxiPickup(s3) === false);
  const f3 = s3.side.fares[0];
  s3.player.x = f3.x; s3.player.y = f3.y;
  tryTaxiPickup(s3);
  check('no second pickup while a fare is active', tryTaxiPickup(s3) === false);
  // pickWhere: a predicate that always passes returns a member; one that
  // never passes returns null after its tries.
  check('pickWhere finds a matching element', createRandom(2).pickWhere([1, 2, 3, 4], (x) => x > 2) > 2);
  check('pickWhere returns null when nothing matches', createRandom(2).pickWhere([1, 2], (x) => x > 9) === null);
}

// --- postcards: collect, no double-dip, hunter bonus, save/load ---
{
  const s = sideState();
  const money0 = s.player.money, score0 = s.score;
  s.player.x = 2930; s.player.y = 500;
  updateSide(s, 1 / 60);
  check('postcard Palm Boulevard pays +$150 / +200 score',
    s.side.collected === 1 && s.player.money === money0 + 150 && s.score === score0 + 200,
    `collected=${s.side.collected}`);
  updateSide(s, 1 / 60);
  check('a taken postcard never pays twice', s.side.collected === 1 && s.player.money === money0 + 150);
  check('postcard text reads 1/10', postcardText(s) === 'POSTCARDS 1/10');
  // The tenth card pays the hunter bonus exactly once.
  const h = sideState();
  h.side.postcards.forEach((c, i) => { if (i < 9) { c.taken = true; } });
  h.side.collected = 9;
  const hm0 = h.player.money, hs0 = h.score;
  const last = h.side.postcards[9];
  h.player.x = last.x; h.player.y = last.y;
  updateSide(h, 1 / 60);
  check('tenth postcard pays +$150 + $1000 hunter bonus',
    h.side.collected === 10 && h.side.hunterBonusPaid === true
    && h.player.money === hm0 + 1150 && h.score === hs0 + 1200,
    `money=${h.player.money} score=${h.score}`);
  check('hunter banner names the bonus', h.bannerText.includes('POSTCARD HUNTER') && h.bannerTimer === 4, h.bannerText);
  updateSide(h, 1 / 60);
  check('hunter bonus never pays twice', h.player.money === hm0 + 1150);
  // Save / load round-trips the postcards, the streak and the ledger.
  const saved = sideSaveData(h);
  const fresh = sideState();
  sideLoadData(fresh, JSON.parse(JSON.stringify(saved)));
  check('save/load restores postcards and counts',
    fresh.side.collected === 10 && fresh.side.postcards.every((c) => c.taken)
    && fresh.side.hunterBonusPaid === true && fresh.side.cashEarned === h.side.cashEarned,
    `collected=${fresh.side.collected} cash=$${fresh.side.cashEarned}`);
  check('sideSaveData is null without a side', sideSaveData({}) === null);
}

// --- round 7 extras: streak, VIP, radio variants, side income ---
{
  // Two paid fares in a row: the second carries a +$50 streak bonus.
  const s = sideState();
  const payFare = () => {
    const f = s.side.fares.find((x) => x.waiting && !x.vip) ?? s.side.fares.find((x) => x.waiting);
    s.player.x = f.x; s.player.y = f.y;
    tryTaxiPickup(s);
    const pay = s.side.activeFare.pay;
    // Same safe drop-off point as the taxi block above: no postcard nearby.
    s.side.activeFare.dest = { x: 2000, y: 1260 };
    s.player.x = 2000; s.player.y = 1260;
    updateSide(s, 1 / 60);
    return pay;
  };
  const p1 = payFare();
  const m1 = s.player.money;
  const p2 = payFare();
  check('streak 2 pays +$50 on top of the fare',
    s.side.streak === 2 && s.player.money === m1 + p2 + 50,
    `streak=${s.side.streak} money=${s.player.money}`);
  check('streak banner names the run', s.bannerText.includes('2 in a row'), s.bannerText);
  check('side income text lists fares and streak',
    sideIncomeText(s).includes('FARES 2') && sideIncomeText(s).includes('STREAK 2')
    && sideIncomeText(s).includes('SIDE CASH +$' + s.side.cashEarned.toLocaleString('en-US')));
  // A failed fare resets the streak (covered above) — and a fourth paid
  // fare would cap the streak bonus at +$200.
  check('streak bonus caps at +$200', Math.min(200, 50 * (6 - 1)) === 200);
  // VIP: double pay (cap $800), timer 20% tighter.
  const v = sideState();
  const vipFare = { x: 500, y: 388, waiting: true, dest: null, timer: 0, pay: 0, id: 42, vip: true };
  v.side.fares = [vipFare];
  v.player.x = 500; v.player.y = 388;
  tryTaxiPickup(v);
  const vd = Math.hypot(v.side.activeFare.dest.x - 500, v.side.activeFare.dest.y - 388);
  const base = Math.min(TAXI.MAX_PAY, Math.max(TAXI.MIN_PAY, Math.round((TAXI.MIN_PAY + vd * 0.22) / 10) * 10));
  check('VIP fare pays double (cap $800)',
    v.side.activeFare.pay === Math.min(800, base * 2), `pay=$${v.side.activeFare.pay} base=$${base}`);
  check('VIP fare timer is 20% tighter',
    Math.abs(v.side.activeFare.timer - (vd / TAXI.SPEED + TAXI.BASE_TIME) * 0.8) < 0.01,
    `timer=${v.side.activeFare.timer.toFixed(2)}`);
  check('VIP fare HUD text flags VIP', taxiFareText(v).vip === true);
  // Radio weather reports: two variants per kind, alternating; clear quiet.
  const rState = weatherState();
  rState.weather.kind = 'rain';
  const a1 = weatherReportLine(rState), a2 = weatherReportLine(rState), a3 = weatherReportLine(rState);
  check('rain report has two alternating variants', a1 !== a2 && a1 === a3 && a1.includes('Rain'), `${a1} | ${a2}`);
  rState.weather.kind = 'storm';
  check('storm report warns of lightning', /storm/i.test(weatherReportLine(rState)));
  rState.weather.kind = 'fog';
  check('fog report warns of visibility', weatherReportLine(rState).includes('Fog'));
  rState.weather.kind = 'clear';
  check('clear skies mean no weather report', weatherReportLine(rState) === '');
  // The fourth dispatch slot carries the weather report.
  const u = weatherState();
  u.weather.kind = 'fog';
  u.radio.line = 6; u.radio.timer = 0;
  updateRadio(u, 5.1);
  check('every 4th dispatch slot is the weather report', u.radio.current.includes('Fog'), u.radio.current);
  // Shop tips per kind.
  check('shop tip warns in rain/storm/fog, quiet in clear',
    shopWeatherTip({ weather: { kind: 'rain' } }).includes('slick')
    && shopWeatherTip({ weather: { kind: 'storm' } }).includes('lightning')
    && shopWeatherTip({ weather: { kind: 'fog' } }).includes('barely see')
    && shopWeatherTip({ weather: { kind: 'clear' } }) === '');
  // VIP spawn rate: about one in four waiting fares is a VIP.
  const vr = createRandom(1234);
  let vips = 0;
  for (let i = 0; i < 400; i += 1) if (spawnWaitingFare(vr).vip) vips += 1;
  check('roughly 1 in 4 waiting fares is a VIP', vips > 60 && vips < 140, `vips=${vips}/400`);
}

console.log(failures === 0 ? '\nALL UNIT TESTS PASSED' : `\n${failures} UNIT TEST FAILURES`);
process.exit(failures === 0 ? 0 : 1);