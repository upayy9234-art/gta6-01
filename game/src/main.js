// Neon Harbor — boot and the one loop. The world advances in fixed 1/60 s steps;
// the renderer paints what is there. Screens: title, play, paused, busted, win.
// ?seed=N fixes the city. ?shot=start|play|chase|win (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
// The title screen is an ATTRACT MODE: the city lives behind it — traffic
// drives, VPD patrol cars cruise, pedestrians stroll, the radio ticker turns —
// with no input at all. The clock opens at 18:05 golden hour.
import { BEST_KEY, SAVE_KEY, STEP, SUNSET_START, VIEW, WORLD } from './config.js';
import { createRandom } from './random.js';
import { buildCity, buildParkedCars } from './world.js';
import { buildPortside } from './district.js';
import { buildCoast } from './coast.js';
import { createDayNight, updateDayNight } from './daynight.js';
import { createGarage, applyGarageToCar, updateNitro, toggleGarage, garageKey } from './garage.js';
import { createWeapons, switchWeapon, fireWeapon, updateWeaponPickups, WEAPON_ORDER } from './weapons.js';
import { createExtraMissions, countPoliceKill } from './missions2.js';
import { createDay3 } from './missions3.js';
import { createRadio, updateRadio, cycleStation } from './radio.js';
import { createShops, nearestShop, toggleShop, shopKey } from './shops.js';
import { createPlayer, updatePlayerOnFoot, addWanted, decayWanted, regenHealth } from './player.js';
import { spawnTrafficCar, spawnPedestrian, updateCarPhysics, updateTrafficCar, updatePedestrian, burst, makeCar, makeParkedCar } from './traffic.js';
import { ensurePolice, ensurePatrol, updatePoliceCar, nearestPoliceDistance } from './police.js';
import { ensureHeli, updateHeli } from './heli.js';
import { createWeather, updateWeather, forceWeather } from './weather.js';
import { createRoadblocks, updateRoadblocks, checkSpikeStrips } from './wanted.js';
import { createSide, updateSide, tryTaxiPickup, sideSaveData, sideLoadData } from './side.js';
import { createMissions, updateMissions, missionWaypoint } from './missions.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER_CAR, ACTION_MUTE, ACTION_HONK, ACTION_GARAGE, ACTION_RADIO, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const audio = createAudio();

function createState() {
  const state = {
    random, audio, time: 0, timeOfDay: SUNSET_START, // 18:05 — golden hour
    score: 0, screen: SCREEN_TITLE, bannerText: '', bannerTimer: 0,
    camera: { x: 388, y: 388, scale: 1 },
    city: buildCity(random),
    player: createPlayer(388, 388),
    cars: [], peds: [], bullets: [], particles: [], helis: [], prevWanted: 0,
    missions: createMissions(),
    day: 1, dayNight: createDayNight(),
    extra: createExtraMissions(), day3: createDay3(),
    garage: createGarage(), weapons: createWeapons(),
    radio: createRadio(), shops: createShops(),
    // Round 6 systems: dynamic weather, VPD roadblocks + lockdown, and the
    // side activities (taxi fares + hidden postcards) that pay between jobs.
    weather: createWeather(random),
    roadblocks: createRoadblocks(),
    side: createSide(random),
  };
  // The east coast (beach, palms, beachfront signs) and the Portside docks
  // district own their corners of the city.
  buildCoast(state.city, random);
  buildPortside(state.city, random);
  // Denser streets: 16 moving cars, 8 parked, 30 pedestrians + a busy crowd
  // along the north road, so the opening frames read alive.
  for (let i = 0; i < 16; i += 1) state.cars.push(spawnTrafficCar(random, state));
  for (const spot of buildParkedCars(random)) state.cars.push(makeParkedCar(spot));
  for (let i = 0; i < 30; i += 1) state.peds.push(spawnPedestrian(random, state));
  for (let i = 0; i < 10; i += 1) {
    const ped = spawnPedestrian(random, state);
    ped.x = random.range(500, 1800); ped.y = random.range(320, 460); ped.beach = false;
    state.peds.push(ped);
  }
  state.reset = function reset() {
    const fresh = createState();
    for (const key of Object.keys(fresh)) state[key] = fresh[key];
    state.reset = reset;
    state.saveGame = saveGame;
  };
  state.saveGame = saveGame;
  return state;
}

let state = createState();

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.player.money, score: state.score, mission: state.missions.index,
      x: state.player.x, y: state.player.y, day: state.day,
      garage: { upgrades: state.garage.upgrades, paint: state.garage.paint, ownedPaints: state.garage.ownedPaints },
      weapons: { owned: state.weapons.owned, ammo: state.weapons.ammo },
      radioStation: state.radio ? state.radio.station : 0,
      weather: state.weather ? state.weather.kind : 'clear',
      side: sideSaveData(state),
    }));
  } catch { /* storage off: progress lasts this visit only */ }
}

function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    state.player.money = data.money ?? 250;
    state.score = data.score ?? 0;
    state.player.x = data.x ?? 388; state.player.y = data.y ?? 388;
    if (Number.isInteger(data.mission) && data.mission > 0 && data.mission < 12) state.missions.index = data.mission;
    if (Number.isInteger(data.day) && data.day >= 1 && data.day <= 3) state.day = data.day;
    if (data.garage) {
      Object.assign(state.garage.upgrades, data.garage.upgrades ?? {});
      if (data.garage.paint !== undefined) state.garage.paint = data.garage.paint;
      if (Array.isArray(data.garage.ownedPaints)) state.garage.ownedPaints = data.garage.ownedPaints;
    }
    if (data.weapons) {
      Object.assign(state.weapons.owned, data.weapons.owned ?? {});
      Object.assign(state.weapons.ammo, data.weapons.ammo ?? {});
      // JSON turns Infinity into null — the pistol's ammo is always infinite.
      state.weapons.ammo.pistol = Infinity;
      if (!state.weapons.owned[state.weapons.current]) state.weapons.current = 'pistol';
    }
    if (state.radio && Number.isInteger(data.radioStation)) state.radio.station = data.radioStation % 3;
    // Round 6: the last weather and the collected postcards ride along too.
    if (typeof data.weather === 'string') forceWeather(state, data.weather);
    if (data.side) sideLoadData(state, data.side);
    return true;
  } catch { return false; }
}

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* ignore */ }
}

function nearestCar(maxDist) {
  let best = null, bestD = maxDist;
  for (const car of state.cars) {
    if (car.police) continue;
    const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterOrExitCar() {
  const p = state.player;
  if (p.inCar) {
    const car = p.inCar;
    p.inCar = null; p.x = car.x - 40; p.y = car.y; p.onFoot = true;
    return;
  }
  // Near a shop on foot? E opens the shop instead of stealing a car.
  if (nearestShop(state)) { toggleShop(state); return; }
  const car = nearestCar(70);
  if (car) {
    // Stealing a parked / NPC car raises the wanted level.
    if (car.npc && car.driver) { addWanted(p, 1); state.bannerText = 'Car stolen! The VPD is on to you.'; state.bannerTimer = 3; }
    car.npc = false; car.driver = false;
    p.inCar = car; p.x = car.x; p.y = car.y;
    // The garage's upgrades and paint ride with the car Kai climbs into.
    applyGarageToCar(state, car);
    audio.pickup();
  }
}

function updateBullets(dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) { state.bullets.splice(i, 1); continue; }
    if (!b.fromPolice) {
      for (const car of state.cars) {
        if (car === state.player.inCar) continue;
        if (Math.abs(b.x - car.x) < 34 && Math.abs(b.y - car.y) < 20) {
          car.health -= b.damage ?? 34;
          burst(state, b.x, b.y, b.color ?? '#ffb347', 6);
          if (car.health <= 0) {
            burst(state, car.x, car.y, '#ff6b3d', 26);
            audio.crash(1);
            // A destroyed police car counts toward the last stand (mission 6).
            if (car.police) countPoliceKill(state);
            if (car.target === 'dario') { /* mission 2 resolves in updateMissions */ }
            else { addWanted(state.player, 1); state.score += 50; }
            const idx = state.cars.indexOf(car);
            if (idx >= 0) state.cars.splice(idx, 1);
          }
          state.bullets.splice(i, 1);
          break;
        }
      }
    } else {
      const p = state.player;
      const px = p.inCar ? p.inCar.x : p.x, py = p.inCar ? p.inCar.y : p.y;
      if (Math.hypot(b.x - px, b.y - py) < 22) {
        if (p.inCar) p.inCar.health -= 6; else if (p.invulnerable <= 0) { p.health -= 8; p.invulnerable = 0.4; }
        state.bullets.splice(i, 1);
      }
    }
  }
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const pt = state.particles[i];
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }
}

// Attract mode: the city lives behind the title screen. Traffic drives,
// patrol cars cruise, pedestrians stroll, the radio ticker turns and the
// golden-hour clock creeps on — all with no input at all.
function updateAttract(state, dt) {
  state.time += dt;
  state.timeOfDay = (state.timeOfDay + dt * 0.6) % 1440;
  updateDayNight(state);
  updateWeather(state, dt);
  updateRadio(state, dt);
  for (const car of state.cars) {
    if (car.police) updatePoliceCar(car, dt, state);
    else if (car.npc) updateTrafficCar(car, dt, state, random);
  }
  for (const ped of state.peds) updatePedestrian(ped, dt, state, random);
  ensurePatrol(state, random);
  // Keep traffic topped up near the player.
  if (state.cars.filter((c) => c.npc && !c.police).length < 12) state.cars.push(spawnTrafficCar(random, state));
}

state.stepWorld = function stepWorld(dt, input) {
  const p = state.player;
  state.time += dt;
  state.timeOfDay = (state.timeOfDay + dt * 0.6) % 1440;
  updateDayNight(state);
  updateWeather(state, dt);
  updateRoadblocks(state, dt);
  updateSide(state, dt);
  updateRadio(state, dt);
  updateWeaponPickups(state);
  state.bannerTimer = Math.max(0, state.bannerTimer - dt);
  if (p.inCar) {
    updateCarPhysics(p.inCar, input, dt, state);
    checkSpikeStrips(state, p.inCar, dt);
    updateNitro(state, p.inCar, input, dt);
    p.x = p.inCar.x; p.y = p.inCar.y; p.angle = p.inCar.angle;
    if (p.inCar.health <= 0) {
      burst(state, p.inCar.x, p.inCar.y, '#ff6b3d', 30);
      audio.crash(1);
      const idx = state.cars.indexOf(p.inCar);
      if (idx >= 0) state.cars.splice(idx, 1);
      p.inCar = null; p.health -= 25;
    }
    if (input.shooting()) { /* handbrake */ p.inCar.speed *= Math.max(0, 1 - 3 * dt); }
  } else {
    updatePlayerOnFoot(p, input, dt, state);
    if (input.shooting()) fireWeapon(p, state);
  }
  // Traffic + pedestrians.
  for (const car of [...state.cars]) {
    if (car === p.inCar) continue;
    // Roadblock cars are parked across the road — they never chase.
    if (car.roadblock) continue;
    if (car.police) updatePoliceCar(car, dt, state);
    else if (car.npc) updateTrafficCar(car, dt, state, random);
    else if (car.target === 'dario') { /* driven by missions */ }
  }
  for (const ped of state.peds) updatePedestrian(ped, dt, state, random);
  // Pedestrians scatter when a car barrels at them.
  for (const ped of state.peds) {
    for (const car of state.cars) {
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 46 && Math.abs(car.speed) > 150) ped.scared = 1.2;
    }
  }
  // Car-vs-car bumps.
  for (let i = 0; i < state.cars.length; i += 1) for (let j = i + 1; j < state.cars.length; j += 1) {
    const a = state.cars[i], b = state.cars[j];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d < 52 && d > 0.01) {
      const push = (52 - d) / 2;
      const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
      if (a === p.inCar || b === p.inCar) { a.speed *= 0.9; b.speed *= 0.9; }
    }
  }
  // Keep traffic topped up near the player.
  if (state.cars.filter((c) => c.npc && !c.police).length < 12) state.cars.push(spawnTrafficCar(random, state));
  ensurePatrol(state, random);
  ensurePolice(state, random);
  // Wanted siren on heat rising; police helicopter at wanted 4+.
  if (p.wanted > state.prevWanted) state.audio?.siren();
  state.prevWanted = p.wanted;
  ensureHeli(state);
  for (const heli of state.helis) updateHeli(heli, dt, state);
  regenHealth(p, dt);
  updateMissions(state, dt);
  decayWanted(p, dt, nearestPoliceDistance(state) > 520);
  updateBullets(dt);
  updateParticles(dt);
  audio.update(dt, !!p.inCar, state.radio ? state.radio.station : 0);
  // Camera follows the player, clamped so the view stays inside the city.
  const tx = p.inCar ? p.inCar.x : p.x, ty = p.inCar ? p.inCar.y : p.y;
  state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 5);
  state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 5);
  const zoom = p.inCar ? 0.78 : 1;
  state.camera.x = Math.max(640 / zoom, Math.min(WORLD.width - 640 / zoom, state.camera.x));
  state.camera.y = Math.max(360 / zoom, Math.min(WORLD.height - 360 / zoom, state.camera.y));
  // Autosave every ~10 s of play.
  if (Math.floor(state.time) % 10 === 0 && Math.floor((state.time - dt)) % 10 !== 0) saveGame();
  if (p.health <= 0) { p.dead = true; state.screen = SCREEN_OVER; }
  if (state.missions.done) state.screen = SCREEN_WIN;
};

const renderer = createRenderer(canvas);
// Small debug hook for automated play-testing (read-only state access).
window.__neonHarbor = () => state;

function runShot(name) {
  const scene = stageShot(name, state);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, readBest());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let started = false;

  function announce(message) { status.textContent = message; }
  function startGame() {
    if (!started) { loadGame(); started = true; }
    state.screen = SCREEN_PLAY; screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Mission: ' + (state.missions.index + 1) + ' of 12.');
  }
  function endGame() {
    screen = SCREEN_OVER;
    if (state.score > best) { best = state.score; saveBest(best); }
    announce('Busted. Score ' + state.score + '. Best ' + best + '.');
  }
  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) { const muted = audio.toggleMute(); announce(muted ? 'Sound off.' : 'Sound on.'); }
    if (actions & ACTION_HONK && screen === SCREEN_PLAY && state.player.inCar) audio.honk();
    if (actions & ACTION_RADIO && screen === SCREEN_PLAY) cycleStation(state);
    if (actions & ACTION_GARAGE && screen === SCREEN_PLAY) toggleGarage(state);
    if (actions & ACTION_ENTER_CAR && screen === SCREEN_PLAY) {
      // With a shop open, E closes the shop instead of entering a car.
      // Round 6: a waiting taxi passenger beats stealing a car — E picks
      // the fare up first (shop > taxi > car).
      if (state.shops.open) { state.shops.open = null; }
      else if (!tryTaxiPickup(state)) enterOrExitCar();
    }
    // Digit keys: with the garage open they buy (1–3 upgrades, 4–9 paint);
    // with a shop open they buy (1–3 items); otherwise 1–4 switch guns.
    const digit = input.takeDigit();
    if (digit > 0 && screen === SCREEN_PLAY) {
      if (state.garage.open) garageKey(state, digit);
      else if (state.shops.open) shopKey(state, digit);
      else if (digit >= 1 && digit <= 4) switchWeapon(state, WEAPON_ORDER[digit - 1]);
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
        const stepFn = state.stepWorld;
        state = createState();
        state.stepWorld = stepFn;
      }
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
    else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    // The world freezes while the garage menu or a shop panel is open.
    if (screen === SCREEN_PLAY && !state.garage.open && !state.shops.open) {
      while (accumulator >= STEP) { state.stepWorld(STEP, input); accumulator -= STEP; if (state.screen === SCREEN_OVER) { endGame(); break; } if (state.screen === SCREEN_WIN) { screen = SCREEN_WIN; saveBest(Math.max(best, state.score)); break; } }
    } else if (screen === SCREEN_TITLE) {
      // Attract mode: the living city plays behind the title screen.
      while (accumulator >= STEP) { updateAttract(state, STEP); accumulator -= STEP; }
    } else accumulator = 0;
    renderer.draw(state, screen, best);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
  });
  announce('Neon Harbor. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
