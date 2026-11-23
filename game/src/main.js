// main.js — boots Solstice Heat: Neon Tide, owns the game state object G,
// runs the loop, the state machine (title / playing / paused / wasted /
// busted), the spawners, saving, and the crime hooks the other modules
// call when the player does something the SBPD would care about.

import { WORLD, TIME, SAVE_KEY } from './config.js';
import { clamp, dist } from './random.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { City, poi } from './city.js';
import { Effects, Weather } from './effects.js';
import { createPlayer, updatePlayer, hurtPlayer, exitVehicle } from './player.js';
import { makeVehicle, stepVehicle, collideVehicles, spawnTrafficCar, updateTraffic, spawnBoat, updateBoat } from './vehicles.js';
import { spawnPed, updatePeds } from './pedestrians.js';
import { createWanted, updatePolice, clearPolice, reportCrime } from './police.js';
import { Missions } from './missions.js';
import { SideJobs } from './sidejobs.js';
import { render } from './render.js';
import { drawHUD } from './hud.js';
import { isShotMode, shotNumber, setupShot, driveShot } from './shots.js';

const VIEW_W = 1280;
const VIEW_H = 720;

export function createGame(canvas) {
  const G = {
    canvas, ctx: canvas.getContext('2d'),
    W: VIEW_W, H: VIEW_H,
    state: 'title',
    time: 0, hour: TIME.startHour,
    camera: { x: 900, y: 900 },
    mouseWorld: { x: 0, y: 0 },
    notifications: [],
    prompt: null, objective: null, sideObjective: null, missionMarker: null,
    districtToast: null, pendingWitness: null,
    vehicles: [], peds: [], hostiles: [], officers: [], roadblocks: [],
    freezeHour: false, cameraLocked: false,
    shotMode: false, shotN: 0, frame: 0, shotReadyAt: 0,
    stateTimer: 0, spawnTimer: 0, lastDistrict: '',
    titlePan: 0,
  };

  G.input = new Input(canvas);
  G.audio = new AudioEngine();
  G.city = new City();
  G.fx = new Effects();
  G.weather = new Weather();
  G.player = createPlayer(1500, 1560);
  G.wanted = createWanted();
  G.missions = new Missions(G);
  G.sidejobs = new SideJobs();

  // --- hooks the modules call -------------------------------------------
  G.notify = (text, color) => {
    G.notifications.push({ text, color: color || '#ffffff', t: 4.2 });
    if (G.notifications.length > 5) G.notifications.shift();
  };
  G.addCash = (n, x, y) => {
    G.player.cash += n;
    if (x !== undefined) G.fx.text(x, y - 30, '+$' + n, '#7fe8a8');
  };
  G.hurtPlayer = (amount, fx, fy) => hurtPlayer(G, amount, fx, fy);
  G.onWasted = () => {
    if (G.state !== 'playing') return;
    G.state = 'wasted';
    G.stateTimer = 3.2;
    G.audio.engine(false, 0);
    G.audio.siren(false);
    G.audio.fail();
    G.missions.onPlayerDown(G);
  };
  G.onBusted = () => {
    if (G.state !== 'playing') return;
    G.state = 'busted';
    G.stateTimer = 3.2;
    G.audio.engine(false, 0);
    G.audio.fail();
    G.missions.onPlayerDown(G);
    G.notify('BUSTED', '#ff5a4e');
  };
  G.onPlayerCrash = (v, impact) => {
    if (impact > 300) {
      const w = witnessCount(G, v.x, v.y);
      if (w) reportCrime(G, 'hitCar', v.x, v.y, w);
    }
  };
  G.onPlayerHitVehicle = (other, rel) => {
    const w = witnessCount(G, other.x, other.y);
    if (other.driver === 'police') reportCrime(G, 'ramPolice', other.x, other.y, w + 1);
    else if (rel > 170) reportCrime(G, 'hitCar', other.x, other.y, w);
    if (other.driver === 'traffic') other.panic = Math.max(other.panic, 3);
  };
  G.onPlayerHitPed = (ped, speed) => {
    const w = witnessCount(G, ped.x, ped.y);
    reportCrime(G, ped.state === 'down' ? 'killPed' : 'hitPed', ped.x, ped.y, w + 1);
  };
  G.saveGame = () => saveGame(G);
  G.step = (dt) => stepGame(G, dt);
  G.startGame = (cont) => startGame(G, cont);
  G.hasSave = () => {
    try { return !!window.localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  };

  if (isShotMode()) {
    G.shotMode = true;
    G.shotN = shotNumber();
    seedWorld(G);
    setupShot(G, G.shotN);
  } else {
    seedWorld(G);
  }
  return G;
}

function witnessCount(G, x, y) {
  let n = 0;
  for (const ped of G.peds) {
    if (ped.state !== 'down' && dist(ped.x, ped.y, x, y) < 250) n++;
  }
  return n;
}

// A starter car, some traffic and boats so the world is alive at spawn.
function seedWorld(G) {
  const starter = makeVehicle('meridian', 1560, 1620, Math.PI, null);
  G.vehicles.push(starter);
  for (let i = 0; i < 10; i++) {
    const v = spawnTrafficCar(G, G.player.x, G.player.y);
    if (v) G.vehicles.push(v);
  }
  for (let i = 0; i < 3; i++) G.vehicles.push(spawnBoat(G));
  for (let i = 0; i < 12; i++) {
    const ped = spawnPed(G, G.player.x, G.player.y);
    if (ped) G.peds.push(ped);
  }
}

export function startGame(G, cont) {
  if (cont) loadGame(G);
  else {
    G.player = createPlayer(1500, 1560);
    G.missions = new Missions(G);
    G.sidejobs = new SideJobs();
    G.vehicles.length = 0;
    G.peds.length = 0;
    G.hostiles.length = 0;
    clearPolice(G);
    seedWorld(G);
  }
  G.state = 'playing';
  G.audio.unlock();
  G.notify('Welcome to Solstice Bay. Marisol Vega is waiting at Club Sirena.', '#ffd94a');
}

function saveGame(G) {
  try {
    const data = {
      cash: G.player.cash,
      armor: G.player.armor,
      hasPistol: G.player.hasPistol,
      ammo: G.player.ammo,
      missionIndex: G.missions.index,
      complete: G.missions.campaignDone,
      shells: [...G.player.shellsFound],
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* storage unavailable: the session just will not persist */ }
}

function loadGame(G) {
  let data = null;
  try { data = JSON.parse(window.localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { data = null; }
  if (!data) { startGame(G, false); return; }
  G.player = createPlayer(1500, 1560);
  G.player.cash = data.cash || 0;
  G.player.armor = data.armor || 0;
  G.player.hasPistol = !!data.hasPistol;
  G.player.weapon = data.hasPistol ? 'pistol' : 'fists';
  G.player.ammo = data.ammo || 0;
  G.player.shellsFound = new Set(data.shells || []);
  for (const s of G.city.shells) if (G.player.shellsFound.has(s.id)) s.taken = true;
  G.missions = new Missions(G);
  G.missions.index = data.missionIndex || 0;
  G.missions.campaignDone = !!data.complete;
  G.sidejobs = new SideJobs();
  G.vehicles.length = 0;
  G.peds.length = 0;
  G.hostiles.length = 0;
  clearPolice(G);
  seedWorld(G);
  G.notify('Welcome back to Solstice Bay.', '#ffd94a');
}

function respawn(G, atPoi, fineRate, label) {
  const p = G.player;
  const fine = Math.floor(p.cash * fineRate);
  p.cash -= fine;
  if (p.vehicle) {
    p.vehicle.driver = null;
    p.vehicle = null;
    G.audio.engine(false, 0);
  }
  const spot = poi(atPoi);
  p.x = spot.x + 30;
  p.y = spot.y + 26;
  p.health = 100;
  clearPolice(G);
  G.state = 'playing';
  G.notify(label + ' Fine: $' + fine.toLocaleString('en-US'), '#ffb340');
  saveGame(G);
}

function stepGame(G, dt) {
  G.time += dt;
  G.frame++;
  const input = G.input;

  if (G.state === 'title') {
    G.titlePan += dt * 26;
    G.camera.x = 1500 + Math.sin(G.titlePan * 0.05) * 700 - VIEW_W / 2;
    G.camera.y = 1400 + Math.cos(G.titlePan * 0.037) * 500 - VIEW_H / 2;
    if (input.hit('Enter')) startGame(G, false);
    if (input.hit('KeyC') && G.hasSave()) startGame(G, true);
    if (input.mouse.clicked) { G.audio.unlock(); startGame(G, G.hasSave()); }
    render(G, G.ctx, VIEW_W, VIEW_H);
    drawTitle(G);
    input.endFrame();
    return;
  }

  if (G.state === 'wasted' || G.state === 'busted') {
    G.stateTimer -= dt;
    render(G, G.ctx, VIEW_W, VIEW_H);
    drawDownOverlay(G, G.state === 'wasted' ? 'WASTED' : 'BUSTED');
    if (G.stateTimer <= 0) {
      if (G.state === 'wasted') respawn(G, 'clinic', 0.10, 'Bay Clinic patched you up.');
      else respawn(G, 'police', 0.15, 'Released from SBPD custody.');
    }
    input.endFrame();
    return;
  }

  if (input.hit('Escape', 'KeyP') && G.state === 'playing') G.state = 'paused';
  else if (input.hit('Escape', 'KeyP') && G.state === 'paused') G.state = 'playing';
  if (G.state === 'paused') {
    render(G, G.ctx, VIEW_W, VIEW_H);
    drawHUD(G, G.ctx, VIEW_W, VIEW_H);
    drawPause(G);
    if (input.hit('KeyM')) { G.audio.setMuted(!G.audio.muted); }
    if (input.hit('KeyS')) { saveGame(G); G.notify('Saved.', '#7fe8a8'); }
    input.endFrame();
    return;
  }

  // --- playing -------------------------------------------------------------
  G.prompt = null;
  G.objective = null;
  G.sideObjective = null;

  if (!G.freezeHour) {
    G.hour = (G.hour + dt * (24 / TIME.dayLength)) % 24;
  }
  G.weather.update(dt);
  G.mouseWorld.x = G.camera.x + input.mouse.x;
  G.mouseWorld.y = G.camera.y + input.mouse.y;

  if (G.shotMode) {
    driveShot(G, G.shotN);
    if (G.shotN === 3) G.missions.update(G, 0); // keep the marker/HUD alive, frozen logic
  } else {
    G.missions.update(G, dt);
    G.sidejobs.update(G, dt);
    updatePlayer(G, dt);
  }

  // AI drivers fill their controls, then every vehicle steps together.
  for (const v of G.vehicles) {
    if (v.driver === 'traffic') {
      if (v.def.kind === 'boat') updateBoat(G, v, dt);
      else updateTraffic(G, v, dt);
    }
  }
  updatePolice(G, dt);
  for (const v of [...G.vehicles]) stepVehicle(G, v, dt);
  if (G.shotMode && G.player.vehicle) {
    // Shot scenes drive the car directly; keep the player glued to it so
    // pursuit AI and markers track the vehicle, not the spawn point.
    G.player.x = G.player.vehicle.x;
    G.player.y = G.player.vehicle.y;
  }
  collideVehicles(G, G.vehicles, dt);
  for (let i = G.vehicles.length - 1; i >= 0; i--) {
    if (G.vehicles[i].dead && G.vehicles[i].driver !== 'player') {
      // Burnt-out wrecks linger as scenery for a while, then go.
      if (Math.random() < dt * 0.05) G.vehicles.splice(i, 1);
    }
  }
  updatePeds(G, dt);
  G.fx.update(dt);
  updateSpawning(G, dt);
  updateNotifications(G, dt);
  updateDistrict(G);

  if (!G.cameraLocked) {
    G.camera.x = clamp(G.player.x - VIEW_W / 2, 0, WORLD.width - VIEW_W);
    G.camera.y = clamp(G.player.y - VIEW_H / 2, 0, WORLD.height - VIEW_H);
  }
  if (G.shotObjective) G.objective = G.shotObjective;

  G.audio.updateMusic(dt, true);
  render(G, G.ctx, VIEW_W, VIEW_H);
  drawHUD(G, G.ctx, VIEW_W, VIEW_H);

  if (G.shotMode && G.frame > 110 && !G.shotReadyAt) {
    G.shotReadyAt = G.frame;
    window.__shotReady = true;
  }
  input.endFrame();
}

function updateSpawning(G, dt) {
  G.spawnTimer -= dt;
  if (G.spawnTimer > 0) return;
  G.spawnTimer = 0.7;
  const p = G.player;
  const traffic = G.vehicles.filter((v) => v.driver === 'traffic' && v.def.kind === 'car').length;
  if (traffic < 13) {
    const v = spawnTrafficCar(G, p.x, p.y);
    if (v) G.vehicles.push(v);
  }
  const boats = G.vehicles.filter((v) => v.def.kind === 'boat').length;
  if (boats < 3) G.vehicles.push(spawnBoat(G));
  if (G.peds.length < 17) {
    const ped = spawnPed(G, p.x, p.y);
    if (ped) G.peds.push(ped);
  }
  // Despawn far traffic so the near field stays fresh.
  for (let i = G.vehicles.length - 1; i >= 0; i--) {
    const v = G.vehicles[i];
    if (v.driver === 'traffic' && dist(v.x, v.y, p.x, p.y) > 1350) G.vehicles.splice(i, 1);
  }
}

function updateNotifications(G, dt) {
  for (let i = G.notifications.length - 1; i >= 0; i--) {
    G.notifications[i].t -= dt;
    if (G.notifications[i].t <= 0) G.notifications.splice(i, 1);
  }
  if (G.districtToast) {
    G.districtToast.t -= dt;
    if (G.districtToast.t <= 0) G.districtToast = null;
  }
}

function updateDistrict(G) {
  const d = G.city.districtAt(G.player.x, G.player.y);
  if (d.name !== G.lastDistrict) {
    if (G.lastDistrict) G.districtToast = { name: d.name, t: 2.6 };
    G.lastDistrict = d.name;
  }
}

// --- screens -----------------------------------------------------------------

function drawTitle(G) {
  const ctx = G.ctx;
  ctx.fillStyle = 'rgba(5,8,18,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23c';
  ctx.font = '800 64px system-ui, sans-serif';
  ctx.fillText('SOLSTICE HEAT', VIEW_W / 2, 190);
  ctx.fillStyle = '#ff4fa3';
  ctx.font = '800 40px system-ui, sans-serif';
  ctx.fillText('· NEON TIDE ·', VIEW_W / 2, 252);
  ctx.fillStyle = '#e8eef4';
  ctx.font = '500 19px system-ui, sans-serif';
  ctx.fillText('An open-world crime story in Solstice Bay — steal, race, run packages,', VIEW_W / 2, 320);
  ctx.fillText('and finish Marisol Vega\'s twelve jobs under the SBPD\'s nose.', VIEW_W / 2, 348);
  ctx.font = '600 21px system-ui, sans-serif';
  ctx.fillStyle = '#7fe8a8';
  ctx.fillText(G.hasSave() ? 'Click or press ENTER — new game · C — continue' : 'Click or press ENTER to play', VIEW_W / 2, 430);
  ctx.font = '500 15.5px system-ui, sans-serif';
  ctx.fillStyle = '#b9c6d2';
  ctx.fillText('WASD drive & walk · E enter/exit & talk · mouse + F or click fight · SPACE handbrake · SHIFT sprint · ESC pause', VIEW_W / 2, 486);
  ctx.fillText('Missions, taxi fares, boat courier runs, 25 seashells, one very patient police force.', VIEW_W / 2, 514);
}

function drawPause(G) {
  const ctx = G.ctx;
  ctx.fillStyle = 'rgba(5,8,18,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 38px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, 250);
  ctx.font = '500 18px system-ui, sans-serif';
  ctx.fillStyle = '#b9c6d2';
  ctx.fillText('ESC resume · S save · M ' + (G.audio.muted ? 'unmute' : 'mute'), VIEW_W / 2, 310);
  ctx.fillText('Mission ' + Math.min(G.missions.index + 1, 12) + ' of 12 · ' + G.player.shellsFound.size + ' / 25 seashells', VIEW_W / 2, 344);
}

function drawDownOverlay(G, word) {
  const ctx = G.ctx;
  ctx.fillStyle = word === 'WASTED' ? 'rgba(80,6,6,0.45)' : 'rgba(6,16,60,0.45)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = word === 'WASTED' ? '#ff5a4e' : '#7fa8ff';
  ctx.font = '800 72px system-ui, sans-serif';
  ctx.fillText(word, VIEW_W / 2, 320);
}

// --- boot ----------------------------------------------------------------------

export function boot() {
  const canvas = document.getElementById('game');
  const G = createGame(canvas);
  window.__NEON_TIDE__ = G;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    G.step(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return G;
}
