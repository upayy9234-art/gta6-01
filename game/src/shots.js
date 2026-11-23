// shots.js — the four screenshot scenes behind ?shot=cover|chase|marina|race.
// Each stages real game state (the real player, real cars, the real wanted system)
// and then lets the world run for a beat, so the frame is a moment of actual play,
// identical for a given seed. main.js paints until window.__shotReady is set.

import { CAR_MODELS, BOAT_MODELS, makeVehicle } from './vehicles.js';
import { stepCopCar } from './police.js';
import { makePed } from './pedestrians.js';

const COUPE = CAR_MODELS[0];
const SEDAN = CAR_MODELS[1];
const CABRIO = CAR_MODELS[5];
const RUNNER = BOAT_MODELS[0];

function place(game, model, x, y, angle, color, driver, kind = 'car') {
  const v = makeVehicle(model, x, y, angle, color ?? model.colors[0], kind);
  v.driver = driver;
  game.vehicles.push(v);
  return v;
}

export function stageShot(game, name) {
  const p = game.player;
  game.screen = 'play';
  if (name === 'chase') {
    game.hour = 21.6;
    game.weather = 'rain';
    const car = place(game, COUPE, 1960, 1806, 0, '#e8641e', 'player');
    car.speed = 236;
    p.inVehicle = true;
    p.vehicle = car;
    p.x = car.x;
    p.y = car.y;
    const copA = place(game, CAR_MODELS[8], 1790, 1778, 0.06, '#1c2733', 'cop');
    copA.livery = true;
    copA.speed = 228;
    const copB = place(game, CAR_MODELS[8], 1705, 1840, -0.05, '#1c2733', 'cop');
    copB.livery = true;
    copB.speed = 218;
    game.police.heat = 430;
    game.police.stars = 4;
    game.shotObjective = { text: 'HOT PURSUIT — Lose the cops!', progress: '' };
    game.cam.x = car.x - 60;
    game.cam.y = car.y;
    return {
      t: 0,
      step(dt) {
        this.t += dt;
        car.speed = Math.min(car.speed + 26 * dt, 252);
        car.x += car.speed * dt;
        car.y = 1806 + Math.sin(this.t * 1.7) * 7;
        p.x = car.x;
        p.y = car.y;
        stepCopCar(game, copA, dt);
        stepCopCar(game, copB, dt);
        return this.t > 1.5;
      },
    };
  }
  if (name === 'marina') {
    game.hour = 18.7;
    game.weather = 'clear';
    p.x = 3546;
    p.y = 1500;
    p.angle = 0.5;
    const boat = place(game, RUNNER, 3630, 1466, 0.35, '#ff7847', 'parked', 'boat');
    boat.marked = true;
    game.mission.dialogue.push({ who: 'Marisol', text: 'Three buoys in the bay, Jax. Empty them all, quiet as the tide.', t: 0 });
    game.shotObjective = { text: 'Marina Blues — Empty the three bay buoys by boat', progress: 'Buoy 1 of 3' };
    game.shotTarget = { x: 3980, y: 1180 };
    game.cam.x = 3720;
    game.cam.y = 1335;
    game.cam.zoom = 0.94;
    return { t: 0, step(dt) { this.t += dt; return this.t > 0.7; } };
  }
  if (name === 'race') {
    game.hour = 12.5;
    game.weather = 'clear';
    const car = place(game, COUPE, 1800, 1960, -Math.PI / 2, '#e8641e', 'player');
    p.inVehicle = true;
    p.vehicle = car;
    p.x = car.x;
    p.y = car.y;
    const rivals = [
      place(game, SEDAN, 1742, 2030, -Math.PI / 2, '#5b7fa6', 'parked'),
      place(game, CABRIO, 1858, 2030, -Math.PI / 2, '#ff5da2', 'parked'),
      place(game, COUPE, 1800, 2102, -Math.PI / 2, '#274b9f', 'parked'),
    ];
    game.shotObjective = { text: 'Pink Slip — Win the street race', progress: 'Checkpoint 1 of 8 · P4' };
    game.shotTarget = { x: 1800, y: 1400 };
    game.cam.x = 1800;
    game.cam.y = 1850;
    return {
      t: 0,
      step(dt) {
        this.t += dt;
        const go = this.t > 0.45;
        for (const v of [car, ...rivals]) {
          if (go) v.speed = Math.min(v.speed + 210 * dt, 236);
          v.y -= v.speed * dt;
        }
        p.x = car.x;
        p.y = car.y;
        game.cam.y = 1850 - Math.max(0, this.t - 0.45) * 150;
        return this.t > 1.3;
      },
    };
  }
  // cover: golden hour on the Boardwalk shore, Jax beside the orange coupe,
  // the city at his back and the whole bay in front of him.
  game.hour = 17.9;
  game.weather = 'clear';
  p.x = 3300;
  p.y = 3090;
  p.angle = -2.25;
  const car = place(game, COUPE, 3152, 3026, 1.15, '#e8641e', 'parked');
  car.marked = false;
  for (let i = 0; i < 4; i += 1) {
    const ped = makePed(3264 + (i % 2) * 44, 3010 + i * 52, game.rng);
    game.peds.push(ped);
  }
  game.cam.x = 3260;
  game.cam.y = 3030;
  game.cam.zoom = 1.0;
  return { t: 0, step(dt) { this.t += dt; return this.t > 0.7; } };
}
