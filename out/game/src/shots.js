// shots.js — the four screenshot scenes, staged by the game's own code and
// rendered by its own renderer (the bounty asks for real renders, never
// composites). Each scene sets the clock and weather, places Jax and the
// vehicles, raises whatever HUD the moment needs, points the camera, and
// main.js runs the world for a couple of seconds before flagging
// window.__shotReady so the capture tool knows the frame is settled.

import { MARINA, ISLAND } from './config.js';
import { coastX } from './city.js';
import { createVehicle } from './vehicles.js';

export function setupShot(G, name) {
  const p = G.player;
  G.state = 'playing';
  if (name === 'cover') {
    // Golden hour on the Boardwalk shore drive: Jax beside his coupe.
    G.hour = 18.05;
    G.weather.force('clear');
    const y = 3010;
    const x = coastX(y) - 205;
    const coupe = createVehicle('coupe', x + 52, y + 26, 0.12, { color: '#e8641e' });
    G.vehicles.push(coupe);
    p.x = x;
    p.y = y + 30;
    p.angle = 0.5;
    G.cameraOverride = { x: x + 90, y: y + 10, zoom: 1.12 };
  } else if (name === 'chase') {
    // Neon-night pursuit in the rain: four stars, two interceptors, a
    // banner, and the coupe at speed on the Neon Mile.
    G.hour = 22.4;
    G.weather.force('storm');
    const car = createVehicle('coupe', 1330, 720, 0, { color: '#c22f4e' });
    car.driver = 'player';
    car.vx = 330;
    G.vehicles.push(car);
    p.vehicle = car;
    p.x = car.x;
    p.y = car.y;
    for (let i = 0; i < 2; i++) {
      const cop = createVehicle('interceptor', 1130 - i * 130, 690 + i * 64, 0.1, { driver: 'police' });
      cop.vx = 320;
      G.vehicles.push(cop);
      G.police.units.push(cop);
    }
    G.police.heat = 92;
    G.police.syncStars();
    G.shotBanner = { title: 'HOT PURSUIT', text: 'Lose the cops!' };
    G.shotDrive = { throttle: 0.72, steer: 0, handbrake: false };
    G.cameraOverride = { x: 1290, y: 715, zoom: 0.95 };
  } else if (name === 'marina') {
    // Sunset at the marina: Jax on the pier, the Tide Runner alongside, a
    // courier objective lit and Marisol on the subtitle line.
    G.hour = 18.55;
    G.weather.force('clear');
    const py = MARINA.pierYs[1];
    const pierEnd = coastX(py) + MARINA.pierLen - 60;
    const boat = createVehicle('speedboat', pierEnd + 46, py + 34, Math.PI, { color: '#e8e4da' });
    G.vehicles.push(boat);
    p.x = pierEnd - 30;
    p.y = py;
    p.angle = 0.9;
    G.sidejobs.active = {
      kind: 'courier', phase: 'deliver',
      marker: { x: ISLAND.x - 330, y: ISLAND.y + 130 },
      dest: { x: ISLAND.x - 330, y: ISLAND.y + 130 },
      fare: 320, timeLeft: 999,
    };
    G.hud.subtitle('Marisol: "The Tide Runner is fuelled and angry, Jax. Try not to scratch her."');
    G.cameraOverride = { x: pierEnd - 60, y: py + 6, zoom: 1.12 };
  } else if (name === 'race') {
    // Pink Slip launch: the real mission stages the rivals and the first
    // checkpoint; Jax joins the grid in a Kestrel of his own.
    G.hour = 10.6;
    G.weather.force('clear');
    G.missions.start(G, 8);
    const car = createVehicle('racer', 1470, 478, Math.PI, { color: '#e8b81e' });
    car.driver = 'player';
    G.vehicles.push(car);
    p.vehicle = car;
    p.x = car.x;
    p.y = car.y;
    p.angle = Math.PI;
    G.cameraOverride = { x: 1500, y: 430, zoom: 1.0 };
  }
}
