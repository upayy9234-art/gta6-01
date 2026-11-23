// main.js — Solstice Heat: Neon Tide. Boots the city, the people, the law
// and Jax; runs the loop; owns the state machine (title, playing, paused,
// wasted, busted), vehicle collisions, the garage/clinic/armoury services,
// saving to localStorage, and the screenshot mode (?shot=<name>) that
// stages scenes for the maker's own captures.

import { START_HOUR, DAY_LENGTH, PRICES, SAVE_KEY, MARINA } from './config.js';
import { Rng } from './random.js';
import { generateCity, coastX } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createEffects, createWeather } from './effects.js';
import { createPlayer, stepPlayer, hurtPlayer } from './player.js';
import { createPoliceSystem } from './police.js';
import { createMissionSystem } from './missions.js';
import { createSideJobs } from './sidejobs.js';
import { createHud } from './hud.js';
import { createRenderer } from './render.js';
import { createVehicle, spawnTraffic, stepTraffic, damageVehicle } from './vehicles.js';
import { spawnPeds, stepPeds, hurtPed, scarePeds } from './pedestrians.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 7) || 7;
const shotName = params.get('shot');

const rng = new Rng(seed);
const city = generateCity(seed);
const player = createPlayer(430, 2130);

const G = {
  rng,
  city,
  player,
  audio: createAudio(),
  fx: createEffects(),
  weather: createWeather(new Rng(seed + 99)),
  police: createPoliceSystem(),
  missions: createMissionSystem(),
  sidejobs: createSideJobs(),
  hud: createHud(),
  input: createInput(canvas),
  vehicles: [],
  peds: [],
  events: [],
  hour: START_HOUR,
  state: 'title',
  time: 0,
  aimWorld: null,
  cameraOverride: null,
  shotBanner: null,
  shotDrive: null,
  hasSave: false,
  ctx: null,
  view: { w: window.innerWidth, h: window.innerHeight },
  save: null, // wired below
};
const renderer = createRenderer(canvas);
G.ctx = renderer.ctx;
G.hurtPlayer = (amount, angle) => hurtPlayer(G, amount, angle);

// ---- World population -------------------------------------------------------
G.peds = spawnPeds(G, 46);
G.vehicles.push(...spawnTraffic(G, 13));
// Parked cars along the streets, and boats at the marina and the island.
const PARKED = ['sedan', 'coupe', 'compact', 'van', 'muscle', 'sedan', 'compact', 'coupe'];
for (let i = 0; i < 26; i++) {
  const p = city.randomRoadPoint(rng);
  const v = createVehicle(rng.pick(PARKED), p.x + rng.range(-14, 14), p.y + rng.range(-14, 14), rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), {});
  v.color = rng.pick(v.def.colors);
  G.vehicles.push(v);
}
// Boats moored just past the pier ends, in open water.
placeBoat('speedboat', 1);
placeBoat('skiff', 2);
placeBoat('speedboat', 0);
function placeBoat(type, pierIdx) {
  const py = MARINA.pierYs[pierIdx];
  const v = createVehicle(type, coastX(py) + MARINA.pierLen + 55, py + 42, Math.PI, {});
  v.color = rng.pick(v.def.colors);
  G.vehicles.push(v);
}

// ---- Saving -------------------------------------------------------------------
function saveGame() {
  try {
    const data = {
      cash: player.cash,
      armor: player.armor,
      weapon: player.weapon,
      ammo: player.ammo,
      shells: city.shells.map((s) => (s.taken ? 1 : 0)).join(''),
      shellsFound: player.shells,
      done: G.missions.done,
      hour: G.hour,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    G.hasSave = true;
  } catch {
    /* private mode etc. — the game simply does not persist */
  }
}
G.save = saveGame;

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    player.cash = d.cash ?? player.cash;
    player.armor = d.armor ?? 0;
    player.weapon = d.weapon ?? 'fists';
    player.ammo = d.ammo ?? 0;
    player.shells = d.shellsFound ?? 0;
    if (typeof d.shells === 'string') city.shells.forEach((s, i) => { s.taken = d.shells[i] === '1'; });
    G.missions.done = Array.isArray(d.done) ? d.done : [];
    G.hour = typeof d.hour === 'number' ? d.hour : START_HOUR;
    G.hasSave = true;
    return true;
  } catch {
    return false;
  }
}
loadGame();

// ---- Services: garage, clinic, armoury ---------------------------------------
const insideSite = { garage: false, clinic: false, armoury: false };

function stepServices() {
  const p = player;
  const s = city.sites;
  // Garage: drive in damaged, roll out whole. Charged per point repaired.
  const atGarage = p.vehicle && Math.hypot(p.x - s.garage.x, p.y - s.garage.y) < 95;
  if (atGarage && !insideSite.garage) {
    const v = p.vehicle;
    const dmg = v.def.health - v.health;
    if (dmg > 1) {
      const cost = Math.min(p.cash, Math.ceil(dmg * PRICES.repairPerPoint));
      v.health = v.def.health;
      v.dead = false;
      p.cash -= cost;
      G.hud.notify('Harbor Garage: repaired for $' + cost + '.');
      G.audio.play('cash');
      saveGame();
    } else G.hud.notify('Harbor Garage: she is already whole.');
  }
  insideSite.garage = !!atGarage;

  // Clinic: walk in hurt, walk out whole.
  const atClinic = !p.vehicle && Math.hypot(p.x - s.clinic.x, p.y - s.clinic.y) < 62;
  if (atClinic && !insideSite.clinic) {
    if (p.health < 100 && p.cash >= PRICES.heal) {
      p.cash -= PRICES.heal;
      p.health = 100;
      G.hud.notify('Neon Mile Clinic: patched up for $' + PRICES.heal + '.');
      G.audio.play('pickup');
    } else if (p.health < 100) G.hud.notify('The clinic wants $' + PRICES.heal + ' you do not have.');
  }
  insideSite.clinic = !!atClinic;

  // Fort Arms: one sensible purchase per visit — gun, then armour, then ammo.
  const atArms = !p.vehicle && Math.hypot(p.x - s.armoury.x, p.y - s.armoury.y) < 62;
  if (atArms && !insideSite.armoury) {
    if (p.weapon === 'fists' && p.cash >= PRICES.pistol) {
      p.cash -= PRICES.pistol;
      p.weapon = 'pistol';
      p.ammo += 36;
      G.hud.notify('Fort Arms: Harbor 9mm + 36 rounds, $' + PRICES.pistol + '.');
      G.audio.play('cash');
    } else if (p.armor < 100 && p.cash >= PRICES.armor) {
      p.cash -= PRICES.armor;
      p.armor = 100;
      G.hud.notify('Fort Arms: vest fitted, $' + PRICES.armor + '.');
      G.audio.play('cash');
    } else if (p.weapon === 'pistol' && p.cash >= PRICES.ammoBox) {
      p.cash -= PRICES.ammoBox;
      p.ammo += 24;
      G.hud.notify('Fort Arms: +24 rounds, $' + PRICES.ammoBox + '.');
      G.audio.play('cash');
    } else {
      G.hud.notify('Fort Arms: pistol $' + PRICES.pistol + ' · vest $' + PRICES.armor + ' · ammo $' + PRICES.ammoBox + '.');
    }
    saveGame();
  }
  insideSite.armoury = !!atArms;
}

// ---- Collisions between vehicles, and vehicles meeting people -----------------
function stepCollisions(dt) {
  const vs = G.vehicles;
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i];
    for (let j = i + 1; j < vs.length; j++) {
      const b = vs[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const rr = (a.def.len + b.def.len) * 0.32;
      const d2 = dx * dx + dy * dy;
      if (d2 > rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const overlap = rr - d;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const impulse = -rel * 0.72;
        a.vx -= nx * impulse;
        a.vy -= ny * impulse;
        b.vx += nx * impulse;
        b.vy += ny * impulse;
        if (rel < -120) {
          damageVehicle(G, a, (-rel - 120) * 0.05, a.angle);
          damageVehicle(G, b, (-rel - 120) * 0.05, b.angle);
          if (Math.hypot(a.x - player.x, a.y - player.y) < 640) G.audio.play('crash', rel < -300);
          if (a.driver === 'player' || b.driver === 'player') {
            G.police.report(G, 1.6, player.x, player.y, true);
            if (rel < -260) hurtPlayer(G, 6, Math.atan2(dy, dx));
          }
        }
      }
    }
    // A moving vehicle meets a person.
    const sp = Math.hypot(a.vx, a.vy);
    if (sp > 46) {
      for (const ped of G.peds) {
        if (ped.state === 'down') continue;
        if (Math.abs(ped.x - a.x) < a.def.len * 0.42 && Math.abs(ped.y - a.y) < a.def.wid * 0.6 + 7) {
          hurtPed(G, ped, sp > 190 ? 40 : 22, Math.atan2(a.vy, a.vx));
          scarePeds(G, a.x, a.y, 260);
          if (a.driver === 'player') {
            G.police.report(G, 5, ped.x, ped.y, true);
            G.hud.notify('You hit a pedestrian!');
          }
          if (a.driver) damageVehicle(G, a, 3);
        }
      }
      if (!player.vehicle && player.hitT <= 0 && Math.abs(player.x - a.x) < a.def.len * 0.42 && Math.abs(player.y - a.y) < a.def.wid * 0.6 + 7) {
        hurtPlayer(G, sp > 200 ? 26 : 13, Math.atan2(a.vy, a.vx));
        player.hitT = 0.8;
        player.x += a.vx * 0.14;
        player.y += a.vy * 0.14;
      }
    }
  }
}

// ---- Wasted / busted ------------------------------------------------------------
function respawn(kind) {
  const clinic = city.sites.clinic;
  if (player.vehicle) {
    player.vehicle.driver = null;
    player.vehicle = null;
  }
  if (kind === 'wasted') player.cash = Math.max(0, player.cash - PRICES.wastedFee);
  else player.cash = Math.max(0, player.cash - Math.floor(player.cash * PRICES.bustFineRate));
  player.health = 100;
  player.x = clinic.x + 30;
  player.y = clinic.y + 46;
  G.police.clear();
  G.audio.setEngine(false, 0);
  G.audio.setSiren(false);
  G.state = 'playing';
  saveGame();
}

function stepEvents() {
  for (const e of G.events) {
    if (e.type === 'wasted' && G.state === 'playing') {
      G.state = 'wasted';
      G.audio.play('fail');
      G.audio.setEngine(false, 0);
      if (G.missions.current) G.missions.fail(G, 'You ended up in the clinic.');
    }
    if (e.type === 'busted' && G.state === 'playing') {
      G.state = 'busted';
      G.audio.play('fail');
      G.audio.setEngine(false, 0);
      if (G.missions.current) G.missions.fail(G, 'The SBPD took you in.');
    }
  }
  G.events.length = 0;
}

// ---- The world step ----------------------------------------------------------------
function stepWorld(dt) {
  G.hour = (G.hour + (dt * 24) / DAY_LENGTH) % 24;
  G.weather.update(dt);
  G.fx.update(dt);
  stepPlayer(G, dt);
  for (const v of G.vehicles) if (v.driver === 'traffic') stepTraffic(G, v, dt);
  G.police.update(G, dt);
  G.missions.update(G, dt);
  G.sidejobs.update(G, dt);
  stepPeds(G, dt);
  stepCollisions(dt);
  stepServices();
  stepEvents();
  G.hud.update(dt);
  // The engine note belongs to the car; silence it on foot.
  if (!player.vehicle) G.audio.setEngine(false, 0);
}

// ---- Shot mode ----------------------------------------------------------------------
if (shotName) {
  setupShot(G, shotName);
  // Settle the scene: two seconds of world, Jax holding his line.
  for (let i = 0; i < 60; i++) {
    G.weather.update(1 / 30);
    G.fx.update(1 / 30);
    stepPlayer(G, 1 / 30);
    for (const v of G.vehicles) if (v.driver === 'traffic') stepTraffic(G, v, 1 / 30);
    if (shotName === 'chase') G.police.update(G, 1 / 30);
    stepPeds(G, 1 / 30);
    G.hud.update(1 / 30);
  }
  renderer.draw(G);
  G.hud.draw(renderer.ctx, G, renderer.w, renderer.h);
  requestAnimationFrame(() => {
    renderer.draw(G);
    G.hud.draw(renderer.ctx, G, renderer.w, renderer.h);
    window.__shotReady = true;
  });
  window.__game = G;
} else {
  // ---- The live loop ------------------------------------------------------------------
  let last = performance.now();
  let statusT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (!(dt > 0)) dt = 0.016;
    G.time += dt;

    // Aim: the mouse in world space, from last frame's camera.
    if (G.cam) {
      G.aimWorld = {
        x: G.cam.x + (G.input.mouse.x - renderer.w / 2) / G.cam.zoom,
        y: G.cam.y + (G.input.mouse.y - renderer.h / 2) / G.cam.zoom,
      };
    }

    if (G.state === 'title') {
      G.audio.setMusic(true);
      if (G.input.hit('Enter')) {
        G.audio.ensure();
        G.audio.setMusic(false);
        G.state = 'playing';
        G.hud.notify(G.hasSave ? 'Welcome back to Solstice Bay, Jax.' : 'Walk to the M — Marisol Vega has work.');
      }
      if (G.input.hit('KeyN') && G.hasSave) {
        try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
        location.reload();
      }
      // The title idles over a slow pan of the bay.
      G.cameraOverride = { x: 1500 + Math.sin(G.time * 0.05) * 500, y: 1500 + Math.cos(G.time * 0.037) * 420, zoom: 0.62 };
      G.weather.update(dt);
      G.fx.update(dt);
      for (const v of G.vehicles) if (v.driver === 'traffic') stepTraffic(G, v, dt);
      stepPeds(G, dt);
      renderer.draw(G);
      G.hud.drawTitle(renderer.ctx, G, renderer.w, renderer.h);
    } else if (G.state === 'paused') {
      renderer.draw(G);
      G.hud.draw(renderer.ctx, G, renderer.w, renderer.h);
      G.hud.drawPause(renderer.ctx, renderer.w, renderer.h);
      if (G.input.hit('KeyP') || G.input.hit('Escape')) G.state = 'playing';
    } else if (G.state === 'wasted' || G.state === 'busted') {
      renderer.draw(G);
      G.hud.drawEnd(renderer.ctx, G.state, renderer.w, renderer.h);
      if (G.input.hit('Enter')) respawn(G.state);
    } else {
      G.cameraOverride = null;
      if (G.input.hit('KeyP') || G.input.hit('Escape')) G.state = 'paused';
      if (G.input.hit('KeyM')) G.hud.notify(G.audio.toggleMute() ? 'Sound off.' : 'Sound on.');
      stepWorld(dt);
      renderer.draw(G);
      G.hud.draw(renderer.ctx, G, renderer.w, renderer.h);
    }

    statusT -= dt;
    if (statusT <= 0) {
      statusT = 1;
      const obj = G.missions.objective();
      if (statusEl) statusEl.textContent = obj ? obj.title + ': ' + obj.text : 'Solstice Heat: Neon Tide.';
    }
    G.input.endFrame();
  }
  requestAnimationFrame(frame);
  window.__game = G;
}
