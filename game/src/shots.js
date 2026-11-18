// Deterministic screenshot scenes behind ?shot=start|play|chase|win&seed=N.
// Each one plays the real game forward from a fresh world with a scripted
// autopilot, so the frame is what real play looks like and the same seed
// always gives the same frame. Round 8: golden-hour light, a dense coast city,
// the Day 3 finale in the win shot — plus rain and a roadblock in the chase
// shot, a waiting taxi fare in the play shot, and all ten postcards in the win.
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { addWanted } from './player.js';
import { makeCar } from './traffic.js';
import { CAR_MODELS } from './config.js';
import { applyGarageToCar } from './garage.js';
import { forceWeather } from './weather.js';

function driveForward(state, seconds) {
  const fakeInput = {
    up: () => true,
    down: () => false,
    left: () => false,
    right: () => false,
    moveX: () => 0,
    run: () => false,
    shooting: () => false,
    mouse: () => ({ x: 640, y: 360 }),
  };
  for (let i = 0; i < seconds * 60; i += 1) state.stepWorld(1 / 60, fakeInput);
}

function walkForward(state, seconds) {
  const fakeInput = {
    up: () => true,
    down: () => false,
    left: () => false,
    right: () => true,
    moveX: () => 1,
    run: () => false,
    shooting: () => false,
    mouse: () => ({ x: 900, y: 300 }),
  };
  for (let i = 0; i < seconds * 60; i += 1) state.stepWorld(1 / 60, fakeInput);
}

function giveCar(state, modelIndex) {
  const car = makeCar(state.player.x + 40, state.player.y, 0, CAR_MODELS[modelIndex], {});
  state.cars.push(car);
  state.player.inCar = car;
  state.player.x = car.x;
  state.player.y = car.y;
  return car;
}

/** Stage `world` to the named scene and return the screen to draw over it. */
export function stageShot(name, state) {
  state.reset();
  if (name === 'start') {
    // Attract mode in miniature: 4 s of living city, then the title over it.
    walkForward(state, 4);
    return { screen: SCREEN_TITLE };
  }
  if (name === 'chase') {
    // Put Kai in a fast car, wanted level 5, police + heli already closing in.
    // Round 8: engine Lv2 + nitro fitted, Long Pier Rifle in hand, rain
    // falling so a roadblock and the second heli have time to spawn.
    const car = giveCar(state, 1);
    state.garage.upgrades.engine = 2;
    state.garage.upgrades.nitro = 1;
    applyGarageToCar(state, car);
    state.weapons.owned.rifle = true;
    state.weapons.current = 'rifle';
    state.weapons.ammo.rifle = 60;
    addWanted(state.player, 5);
    forceWeather(state, 'rain');
    driveForward(state, 5);
    // Driving east passes the SMG crate at (500,388), which auto-equips —
    // put the rifle back in Kai's hands for the frame.
    state.weapons.current = 'rifle';
    return { screen: SCREEN_PLAY };
  }
  if (name === 'win') {
    // Day 3 finale complete: all 12 missions done, the Harbor Vault score in.
    state.missions.index = 12;
    state.missions.done = true;
    state.player.money = 24850;
    state.score = 68400;
    state.day = 3;
    // Round 8: every postcard found (10/10 in the HUD) and 14 fares done.
    for (const card of state.side.postcards) card.taken = true;
    state.side.collected = 10;
    state.side.faresDone = 14;
    // Round 5: a fully kitted-out garage and every gun owned.
    state.garage.upgrades.engine = 3;
    state.garage.upgrades.armor = 2;
    state.garage.upgrades.nitro = 1;
    state.garage.paint = 3;
    state.garage.ownedPaints = [0, 1, 3];
    for (const id of ['smg', 'shotgun', 'rifle']) state.weapons.owned[id] = true;
    state.weapons.ammo.smg = 240;
    state.weapons.ammo.shotgun = 40;
    state.weapons.ammo.rifle = 60;
    state.weapons.current = 'rifle';
    state.screen = 'win';
    walkForward(state, 2);
    return { screen: SCREEN_WIN };
  }
  // play: Kai driving through golden-hour traffic toward mission 1, mid-action.
  // Round 8: starts at the garage door with the SMG, drives 3.5 s east past
  // Virelia Motors so the garage marker, shop signs and the weapon HUD show —
  // plus a waiting taxi fare at (760,436), right by the postcard at the garage.
  state.player.x = 470;
  state.player.y = 388;
  state.weapons.owned.smg = true;
  state.weapons.current = 'smg';
  state.weapons.ammo.smg = 182;
  state.side.fares.push({
    x: 760, y: 436,
    waiting: true, dest: null, timer: 0, pay: 0, vip: false, id: 6001,
  });
  giveCar(state, 0);
  addWanted(state.player, 1);
  driveForward(state, 3.5);
  return { screen: SCREEN_PLAY };
}
