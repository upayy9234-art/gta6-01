// Deterministic screenshot scenes behind ?shot=start|play|chase|win&seed=N.
// Each one plays the real game forward from a fresh world with a scripted
// autopilot, so the frame is what real play looks like and the same seed
// always gives the same frame.
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { addWanted } from './player.js';
import { makeCar } from './traffic.js';
import { CAR_MODELS } from './config.js';
import { applyGarageToCar } from './garage.js';

function driveForward(state, seconds) {
  const fakeInput = {
    up: () => true, down: () => false, left: () => false, right: () => false,
    moveX: () => 0, run: () => false, shooting: () => false, mouse: () => ({ x: 640, y: 360 }),
  };
  for (let i = 0; i < seconds * 60; i += 1) state.stepWorld(1 / 60, fakeInput);
}

function walkForward(state, seconds) {
  const fakeInput = {
    up: () => true, down: () => false, left: () => false, right: () => true,
    moveX: () => 1, run: () => false, shooting: () => false, mouse: () => ({ x: 900, y: 300 }),
  };
  for (let i = 0; i < seconds * 60; i += 1) state.stepWorld(1 / 60, fakeInput);
}

/** Stage `world` to the named scene and return the screen to draw over it. */
export function stageShot(name, state) {
  state.reset();
  if (name === 'start') {
    walkForward(state, 4);
    return { screen: SCREEN_TITLE };
  }
  if (name === 'chase') {
    // Put Kai in a fast car, wanted level 5, police + heli already closing in.
    // Round 3: engine Lv2 + nitro fitted, Long Pier Rifle in hand.
    const car = makeCar(state.player.x + 40, state.player.y, 0, CAR_MODELS[1], {});
    state.cars.push(car);
    state.player.inCar = car; state.player.x = car.x; state.player.y = car.y;
    state.garage.upgrades.engine = 2; state.garage.upgrades.nitro = 1;
    applyGarageToCar(state, car);
    state.weapons.owned.rifle = true; state.weapons.current = 'rifle'; state.weapons.ammo.rifle = 60;
    addWanted(state.player, 5);
    driveForward(state, 5);
    // Driving east passes the SMG crate at (500,388), which auto-equips —
    // put the rifle back in Kai's hands for the frame.
    state.weapons.current = 'rifle';
    return { screen: SCREEN_PLAY };
  }
  if (name === 'win') {
    state.missions.index = 6; state.missions.done = true;
    state.player.money = 14850; state.score = 32400;
    // Round 3: a fully kitted-out garage and every gun owned.
    state.garage.upgrades.engine = 3; state.garage.upgrades.armor = 2; state.garage.upgrades.nitro = 1;
    state.garage.paint = 3; state.garage.ownedPaints = [0, 1, 3];
    for (const id of ['smg', 'shotgun', 'rifle']) state.weapons.owned[id] = true;
    state.weapons.ammo.smg = 240; state.weapons.ammo.shotgun = 40; state.weapons.ammo.rifle = 60;
    state.weapons.current = 'rifle';
    state.screen = 'win';
    walkForward(state, 2);
    return { screen: SCREEN_WIN };
  }
  // play: Kai driving through traffic toward mission 1, mid-action.
  // Round 3: starts at the garage door with the SMG, drives 3.5 s east past
  // Virelia Motors so the garage marker and the weapon HUD show in the frame.
  state.player.x = 470; state.player.y = 388;
  state.weapons.owned.smg = true; state.weapons.current = 'smg'; state.weapons.ammo.smg = 182;
  const car = makeCar(state.player.x + 40, state.player.y, 0, CAR_MODELS[0], {});
  state.cars.push(car);
  state.player.inCar = car; state.player.x = car.x; state.player.y = car.y;
  addWanted(state.player, 1);
  driveForward(state, 3.5);
  return { screen: SCREEN_PLAY };
}
