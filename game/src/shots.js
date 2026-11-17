// Deterministic screenshot scenes behind ?shot=start|play|chase|win&seed=N.
// Each one plays the real game forward from a fresh world with a scripted
// autopilot, so the frame is what real play looks like and the same seed
// always gives the same frame.
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { addWanted } from './player.js';
import { makeCar } from './traffic.js';
import { CAR_MODELS } from './config.js';

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
    // Put Kai in a fast car, wanted level 4, police already closing in.
    const car = makeCar(state.player.x + 40, state.player.y, 0, CAR_MODELS[1], {});
    state.cars.push(car);
    state.player.inCar = car; state.player.x = car.x; state.player.y = car.y;
    addWanted(state.player, 4);
    driveForward(state, 5);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'win') {
    state.missions.index = 3; state.missions.done = true;
    state.player.money = 4850; state.score = 12400;
    state.screen = 'win';
    walkForward(state, 2);
    return { screen: SCREEN_WIN };
  }
  // play: Kai driving through traffic toward mission 1, mid-action.
  const car = makeCar(state.player.x + 40, state.player.y, 0, CAR_MODELS[0], {});
  state.cars.push(car);
  state.player.inCar = car; state.player.x = car.x; state.player.y = car.y;
  addWanted(state.player, 1);
  driveForward(state, 3.5);
  return { screen: SCREEN_PLAY };
}
