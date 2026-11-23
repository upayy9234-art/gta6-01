// shots.js — stages the four screenshot scenes the entry is judged by.
// Each scene is a real moment of the running game (never a mock-up): the
// world is set to an hour and a weather, actors are placed, the normal game
// loop runs, and once the scene has settled window.__shotReady is set so
// the capture script knows the frame is honest.

import { makeVehicle } from './vehicles.js';
import { poi } from './city.js';

export function isShotMode() {
  try {
    return new URLSearchParams(window.location.search).has('shot');
  } catch (e) {
    return false;
  }
}

export function shotNumber() {
  try {
    return parseInt(new URLSearchParams(window.location.search).get('shot') || '1', 10);
  } catch (e) {
    return 1;
  }
}

export function setupShot(G, n) {
  G.state = 'playing';
  G.freezeHour = true;
  G.cameraLocked = true;
  G.weather.timer = 99999;
  const p = G.player;

  if (n === 1) {
    // Cover: late afternoon on the causeway, an Aurelion GT crossing the
    // bay to Lighthouse Isle — water, island and lighthouse in one frame.
    G.hour = 17.2;
    G.weather.kind = 'clear';
    const car = makeVehicle('aurelion', 3750, 700, 0, 'player');
    car.color = '#ff5a3c';
    car.vx = 150;
    G.vehicles.push(car);
    p.vehicle = car;
    p.x = car.x; p.y = car.y;
    G.camera.x = 3250;
    G.camera.y = 340;
    G.missions.index = 0;
  }

  if (n === 2) {
    // The chase: neon night, rain, four stars, interceptors on the bumper.
    // The camera follows the player car through this one.
    G.hour = 22.3;
    G.weather.kind = 'rain';
    G.cameraLocked = false;
    const car = makeVehicle('vessia', 1780, 1280, 0, 'player');
    car.color = '#e8c832';
    car.vx = 300;
    G.vehicles.push(car);
    p.vehicle = car;
    p.x = car.x; p.y = car.y;
    for (let i = 0; i < 3; i++) {
      const cop = makeVehicle('interceptor', car.x - 105 - i * 78, car.y + (i - 1) * 44, 0, 'police');
      cop.vx = 308;
      cop.sirenPhase = i * 2;
      G.vehicles.push(cop);
    }
    G.wanted.heat = 300;
    G.wanted.lastSeenX = p.x;
    G.wanted.lastSeenY = p.y;
    for (let i = 0; i < 7; i++) {
      G.fx.skid(car.x - 40 - i * 26, car.y + 12 + Math.sin(i) * 6, 0.1);
    }
    G.shotObjective = { x: 2800, y: 800, label: 'ESCAPE' };
  }

  if (n === 3) {
    // The fixer: morning on the Neon Mile, Marisol, a job about to start.
    G.hour = 10.2;
    G.weather.kind = 'clear';
    const mp = poi('marisol');
    p.x = mp.x + 30;
    p.y = mp.y + 16;
    p.angle = Math.PI;
    p.hasPistol = true;
    p.weapon = 'pistol';
    p.ammo = 28;
    G.missions.start(G);
    // Keep the street around the club calm for the portrait: no traffic
    // pile-ups photobombing the fixer.
    const keep = G.missions.active ? G.missions.active.data.car : null;
    G.vehicles = G.vehicles.filter((v) => v === keep
      || Math.hypot(v.x - mp.x, v.y - mp.y) > 540);
    G.camera.x = p.x - 640;
    G.camera.y = p.y - 360;
  }

  if (n === 4) {
    // The bay at golden hour: a Marlin running for Lighthouse Isle with a
    // courier package, the marina pier and the beach in the same frame.
    G.hour = 17.6;
    G.weather.kind = 'clear';
    const boat = makeVehicle('marlin', 3900, 1850, -0.6, 'player');
    boat.color = '#ff7847';
    boat.vx = Math.cos(-0.6) * 205;
    boat.vy = Math.sin(-0.6) * 205;
    G.vehicles.push(boat);
    const moored = makeVehicle('skiff', 3700, 2070, 0.4, null);
    G.vehicles.push(moored);
    p.vehicle = boat;
    p.x = boat.x; p.y = boat.y;
    for (let i = 0; i < 5; i++) {
      G.fx.wake(boat.x - i * 16, boat.y + i * 7, boat.angle);
    }
    G.shotObjective = { x: 4150, y: 880, label: 'DELIVER' };
    G.camera.x = 3450;
    G.camera.y = 1000;
  }
}

// Gentle scripted driving so staged vehicles roll instead of sitting dead.
export function driveShot(G, n) {
  const v = G.player.vehicle;
  if (!v) return;
  if (n === 1) {
    v.control.throttle = 0.35;
    v.control.steer = 0;
  }
  if (n === 2) {
    v.control.throttle = 0.9;
    v.control.steer = Math.sin(G.time * 0.7) * 0.14;
  }
  if (n === 4) {
    v.control.throttle = 0.8;
    v.control.steer = Math.sin(G.time * 0.5) * 0.2;
  }
}
