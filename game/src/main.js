// main.js — Solstice Heat: Neon Tide. Boot, the game state and its rules callbacks,
// the camera, the day and the weather, the screens (title, play, pause, help,
// WASTED / BUSTED, mission failed, the ending), saving, and the one loop that
// steps every module and paints every frame. ?shot=<scene>&seed=<n> stages a
// screenshot scene instead of the title screen.

import { TIME, WANTED, ECONOMY, SAVE_KEY } from './config.js';
import { makeRng, clamp, lerp, dist } from './random.js';
import { buildCity, districtAt, isWaterAt } from './city.js';
import { initInput, justPressed, down, mouse, endFrame, VIEW_W, VIEW_H } from './input.js';
import { initAudio, toggleMute, sfx, setEngine, setSiren } from './audio.js';
import { createEffects } from './effects.js';
import { spawnTraffic, spawnParked, spawnBoats, stepTraffic, collideVehicles } from './vehicles.js';
import { spawnPeds, stepPed } from './pedestrians.js';
import { createPoliceState, stepWanted, stepCopCar, stepCopPed, addHeat, clearHeat, starsForHeat } from './police.js';
import { createPlayer, stepPlayer, damagePlayer, currentPrompt } from './player.js';
import { createMissionRunner, stepMissionVehicle } from './missions.js';
import { createSideJobs } from './sidejobs.js';
import { drawWorld, drawRain } from './render.js';
import { drawHUD, drawTitle, drawHelp, drawPause, drawEndCard, drawMissionFailed, drawEnding } from './hud.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const statusEl = document.getElementById('status');
initInput(canvas);

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

// ---- light ----

const DAY_KEYS = [[0, 0.04], [4.5, 0.04], [6, 0.2], [7.5, 0.72], [9, 1], [16.5, 1], [18, 0.8], [19, 0.42], [20, 0.15], [21.5, 0.05], [24, 0.04]];
function daylightFromHour(h) {
  for (let i = 1; i < DAY_KEYS.length; i += 1) {
    if (h <= DAY_KEYS[i][0]) {
      const [x0, y0] = DAY_KEYS[i - 1];
      const [x1, y1] = DAY_KEYS[i];
      return lerp(y0, y1, (h - x0) / (x1 - x0));
    }
  }
  return 0.04;
}

function tintFor(hour, daylight) {
  if (daylight > 0.5) {
    const warm = clamp(1 - Math.abs(hour - 18.1) / 1.7, 0, 1);
    return warm > 0.15 ? `rgba(255,128,44,${(0.11 * warm).toFixed(3)})` : 'rgba(0,0,0,0)';
  }
  return `rgba(10,16,50,${((1 - daylight) * 0.52).toFixed(3)})`;
}

// ---- the game ----

function createGame() {
  const rng = makeRng((seed ^ 0x85ebca6b) >>> 0);
  const city = buildCity(20261122);
  const player = createPlayer(2440, 3030);
  const game = {
    rng, city, player,
    vehicles: [], peds: [], copPeds: [], pickups: [],
    police: createPoliceState(),
    mission: createMissionRunner(),
    side: createSideJobs(),
    fx: createEffects(),
    screen: shotName ? 'play' : 'title',
    elapsed: 0, hour: TIME.startHour, daylight: 1, tint: 'rgba(0,0,0,0)',
    weather: 'clear', weatherT: 60, flash: 0,
    cash: 120, respect: 0, shellsFound: 0,
    cam: { x: 2440, y: 2880, zoom: 0.6 },
    viewRect: { x: 0, y: 0, w: VIEW_W, h: VIEW_H },
    mouseWorld: { x: 2440, y: 2900 },
    shake: 0, bannerText: '', bannerT: 0, promptText: null,
    district: 'Boardwalk', muted: false, hasSave: false,
    shotObjective: null, shotTarget: null,
    endT: 0, pickupT: 8, helpFrom: 'title', started: false,
  };
  game.vehicles.push(...spawnTraffic(city, rng, 26, player.x, player.y));
  game.vehicles.push(...spawnParked(city, rng, 30));
  game.vehicles.push(...spawnBoats(city, rng, 4));
  game.peds.push(...spawnPeds(city, rng, 46, player.x, player.y));

  // ---- the rules callbacks the modules call back into ----
  game.addCash = (n) => { game.cash = Math.max(0, game.cash + n); };
  game.addRespect = (n) => { game.respect += n; };
  game.banner = (text, t = 2.6) => { game.bannerText = text; game.bannerT = t; };
  game.damagePlayer = (amount, x, y) => damagePlayer(game, amount, x, y);

  game.onPedHit = (ped, v) => {
    if (v.driver !== 'player') return;
    addHeat(game, ped.dead ? WANTED.heatFor.killPed : WANTED.heatFor.hitPed, ped.x, ped.y);
    game.shake = Math.min(9, game.shake + 2.5);
  };
  game.onPedKilled = (ped) => {
    if (dist(game.player.x, game.player.y, ped.x, ped.y) < 540) addHeat(game, WANTED.heatFor.killPed, ped.x, ped.y);
  };
  game.onCarjacked = () => { game.banner('Carjacked — the bay is watching', 1.6); };
  game.onVehiclesCrashed = (a, b) => {
    const pv = game.player.vehicle;
    if (!pv || (a !== pv && b !== pv)) return;
    game.shake = Math.min(10, game.shake + 3);
    const other = a === pv ? b : a;
    if (other.driver === 'cop' && game.elapsed - (other.lastHitT ?? -9) > 1.4) {
      other.lastHitT = game.elapsed;
      addHeat(game, WANTED.heatFor.hitCopCar, other.x, other.y, true);
    }
  };
  game.onPlayerShot = (x, y) => {
    const nearCop = game.vehicles.some((v) => v.driver === 'cop' && dist(v.x, v.y, x, y) < 540)
      || game.copPeds.some((c) => dist(c.x, c.y, x, y) < 540);
    if (nearCop) addHeat(game, WANTED.heatFor.shootNearCop, x, y, true);
  };
  game.onPlayerVehicleDestroyed = (v) => {
    if (game.player.vehicle === v) damagePlayer(game, 16, v.x, v.y);
  };
  game.onPlayerWasted = () => {
    if (game.screen !== 'play') return;
    game.screen = 'wasted';
    game.endT = 2.6;
    setEngine(false);
    if (game.mission.active) game.mission.fail(game, 'You were wasted.');
    if (game.side.active) game.side.fail(game, 'you were wasted');
    announce('Wasted.');
  };
  game.onCampaignComplete = () => { game.screen = 'ending'; };
  game.onShell = (sh) => {
    game.shellsFound += 1;
    game.addCash(ECONOMY.shellValue);
    game.fx.addText(sh.x, sh.y - 20, `Shell ${game.shellsFound}/25 · +$${ECONOMY.shellValue}`, '#ffd9ec', 15);
    sfx.pickup();
    game.saveGame();
  };
  game.onPickup = (pk) => {
    const p = game.player;
    if (pk.kind === 'health') { p.health = Math.min(100, p.health + 35); game.fx.addText(p.x, p.y - 26, '+ Health', '#ff8fa3', 15); }
    if (pk.kind === 'armour') { p.armour = Math.min(100, p.armour + 60); game.fx.addText(p.x, p.y - 26, '+ Armour', '#7cc7ff', 15); }
    if (pk.kind === 'ammo') {
      if (p.hasPistol) { p.ammo += 30; game.fx.addText(p.x, p.y - 26, '+30 rounds', '#ffd166', 15); }
      else { game.addCash(25); game.fx.addText(p.x, p.y - 26, '+$25', '#7bf1a8', 15); }
    }
    if (pk.kind === 'bribe') {
      game.police.heat = Math.max(0, game.police.heat - 140);
      game.police.stars = starsForHeat(game.police.heat);
      game.fx.addText(p.x, p.y - 26, 'A quiet word with the SBPD… heat down', '#ffd166', 15);
    }
    if (pk.kind === 'cash') { game.addCash(120); game.fx.addText(p.x, p.y - 26, '+$120', '#7bf1a8', 15); }
    sfx.pickup();
  };
  game.usePoiAtPlayer = () => {
    const p = game.player;
    for (const poi of game.city.pois) {
      if (dist(p.x, p.y, poi.x, poi.y) >= 58) continue;
      if (poi.kind === 'garage') {
        if (p.inVehicle && p.vehicle) {
          if (game.police.heat > 0 || p.vehicle.health < 100) {
            if (game.cash >= ECONOMY.sprayCost) {
              game.cash -= ECONOMY.sprayCost;
              clearHeat(game);
              p.vehicle.health = 100;
              p.vehicle.dead = false;
              game.banner('Neon Bay Garage — heat wiped, car like new', 2.2);
              sfx.cash();
            } else game.fx.addText(p.x, p.y - 30, `Need $${ECONOMY.sprayCost}`, '#ff8fa3', 15);
          } else game.fx.addText(p.x, p.y - 30, 'Nothing to fix', '#ffffff', 15);
        } else game.fx.addText(p.x, p.y - 30, 'Bring a car in', '#ffffff', 15);
      } else if (poi.kind === 'clinic') {
        if (p.health >= 100) game.fx.addText(p.x, p.y - 30, 'You are fine', '#ffffff', 15);
        else if (game.cash >= ECONOMY.healCost) {
          game.cash -= ECONOMY.healCost;
          p.health = 100;
          sfx.cash();
          game.banner('Solstice Clinic — patched up', 1.8);
        } else game.fx.addText(p.x, p.y - 30, `Need $${ECONOMY.healCost}`, '#ff8fa3', 15);
      } else if (poi.kind === 'armoury') {
        if (p.armour < 100 && game.cash >= ECONOMY.armourCost) {
          game.cash -= ECONOMY.armourCost;
          p.armour = 100;
          game.fx.addText(p.x, p.y - 30, 'Armour fitted', '#7cc7ff', 15);
          sfx.cash();
        } else if (!p.hasPistol && game.cash >= 250) {
          game.cash -= 250;
          p.hasPistol = true;
          p.weapon = 'pistol';
          p.ammo += 48;
          game.fx.addText(p.x, p.y - 30, 'Pistol + 48 rounds', '#ffd166', 15);
          sfx.cash();
        } else if (p.hasPistol && game.cash >= 40) {
          game.cash -= 40;
          p.ammo += 40;
          game.fx.addText(p.x, p.y - 30, '+40 rounds', '#ffd166', 15);
          sfx.cash();
        } else game.fx.addText(p.x, p.y - 30, 'Not enough cash', '#ff8fa3', 15);
      }
      return;
    }
  };

  game.objectiveTarget = () => {
    if (game.shotTarget) return game.shotTarget;
    if (game.mission.active) return game.mission.currentTarget();
    if (game.side.active) return game.side.currentTarget();
    return null;
  };
  game.objectiveText = () => {
    if (game.shotObjective) return game.shotObjective.text;
    if (game.mission.active) return `${game.mission.active.def.title} — ${game.mission.active.obj.text}`;
    if (game.side.active) return game.side.currentText();
    return null;
  };
  game.objectiveProgress = () => {
    if (game.shotObjective) return game.shotObjective.progress;
    if (game.mission.active) return game.mission.active.progress || '';
    return '';
  };
  game.objectiveTimeLeft = () => {
    if (game.mission.active && game.mission.active.timeLeft !== null && game.mission.active.timeLeft !== undefined) return game.mission.active.timeLeft;
    if (game.side.active) return game.side.active.timeLeft;
    return null;
  };

  game.saveGame = () => {
    if (shotName) return;
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        completed: [...game.mission.completed],
        cash: game.cash, respect: game.respect,
        shells: game.city.shells.map((s, i) => (s.taken ? i : -1)).filter((i) => i >= 0),
        hasPistol: game.player.hasPistol, ammo: game.player.ammo,
      }));
    } catch { /* storage off: the run lasts this visit only */ }
  };

  return game;
}

const game = createGame();

// ---- save / continue ----

let saveData = null;
if (!shotName) {
  try { saveData = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? 'null'); } catch { saveData = null; }
  if (saveData && Array.isArray(saveData.completed)) {
    game.hasSave = true;
  }
}

function applySave() {
  if (!saveData) return;
  for (const i of saveData.completed) game.mission.completed.add(i);
  game.cash = saveData.cash ?? game.cash;
  game.respect = saveData.respect ?? 0;
  for (const i of saveData.shells ?? []) if (game.city.shells[i]) game.city.shells[i].taken = true;
  game.shellsFound = (saveData.shells ?? []).length;
  game.player.hasPistol = !!saveData.hasPistol;
  game.player.ammo = saveData.ammo ?? 0;
  if (game.player.hasPistol) game.player.weapon = 'pistol';
}

function announce(text) { statusEl.textContent = text; }

// ---- per-frame stepping ----

function spawnPickup() {
  const kinds = ['health', 'armour', 'ammo', 'bribe', 'cash'];
  for (let tries = 0; tries < 24; tries += 1) {
    const node = game.rng.pick(game.city.nodes);
    const x = node.x + game.rng.sign() * 64;
    const y = node.y + game.rng.range(-40, 40);
    if (isWaterAt(x, y) || game.city.collidesCircle(x, y, 14)) continue;
    game.pickups.push({ kind: kinds[game.rng.int(0, kinds.length - 1)], x, y, taken: false });
    return;
  }
}

function stepWorld(dt, ambientOnly = false) {
  const p = game.player;
  if (!ambientOnly) {
    game.mission.update(game, dt);
    if (game.mission.failed && game.screen === 'play') game.screen = 'failed';
    game.side.update(game, dt);
    stepPlayer(game, dt);
  }
  for (let i = game.vehicles.length - 1; i >= 0; i -= 1) {
    const v = game.vehicles[i];
    if (v.removeMe) { game.vehicles.splice(i, 1); continue; }
    if (v === p.vehicle) continue;
    if (v.dead) continue;
    if (dist(v.x, v.y, p.x, p.y) > 1500 && v.driver !== 'cop') continue;
    if (v.driver === 'traffic') stepTraffic(game, v, dt, game.rng);
    else if (v.driver === 'cop') {
      if (game.police.stars === 0) { v.driver = 'traffic'; v.targetNode = null; stepTraffic(game, v, dt, game.rng); }
      else stepCopCar(game, v, dt);
    }
    else if (v.driver === 'target' || v.driver === 'escort' || v.driver === 'rival') stepMissionVehicle(game, v, dt);
  }
  for (const ped of game.peds) {
    if (dist(ped.x, ped.y, p.x, p.y) < 1300) stepPed(game, ped, dt, game.rng);
  }
  for (const c of game.copPeds) stepCopPed(game, c, dt);
  for (let i = game.copPeds.length - 1; i >= 0; i -= 1) if (game.copPeds[i].removeMe) game.copPeds.splice(i, 1);
  if (!ambientOnly) {
    stepWanted(game, dt);
    collideVehicles(game, dt);
    // The bust meter: pinned by a cruiser while barely moving.
    if (game.police.stars > 0) {
      const speed = p.inVehicle && p.vehicle ? Math.abs(p.vehicle.speed) : p.speedNow;
      let pinned = false;
      if (speed < 24) {
        for (const v of game.vehicles) {
          if (v.driver === 'cop' && !v.dead && dist(v.x, v.y, p.x, p.y) < 58) pinned = true;
        }
      }
      if (pinned) game.police.bust = Math.min(1, game.police.bust + dt / WANTED.bustFillTime);
      else if (!game.copPeds.some((c) => !c.dead && dist(c.x, c.y, p.x, p.y) < 30)) {
        game.police.bust = Math.max(0, game.police.bust - dt * 0.7);
      }
      if (game.police.bust >= 1) doBusted();
    }
    // World keeps itself stocked: pickups, traffic, people.
    game.pickupT -= dt;
    if (game.pickupT <= 0) {
      game.pickupT = 22;
      if (game.pickups.filter((k) => !k.taken).length < 3) spawnPickup();
    }
    game.pickups = game.pickups.filter((k) => !k.taken);
    const trafficCount = game.vehicles.filter((v) => v.driver === 'traffic' && v.kind === 'car').length;
    if (trafficCount < 20) game.vehicles.push(...spawnTraffic(game.city, game.rng, 2, p.x, p.y));
    const alivePeds = game.peds.filter((x) => !x.dead).length;
    if (alivePeds < 34) game.peds.push(...spawnPeds(game.city, game.rng, 3, p.x, p.y));
    if (game.peds.length > 90) game.peds = game.peds.filter((x) => !x.dead).concat(game.peds.filter((x) => x.dead).slice(-12));
  }
  game.fx.update(dt);
}

function doBusted() {
  const fine = Math.min(game.cash, 200 + game.police.stars * 120);
  game.cash -= fine;
  clearHeat(game);
  setEngine(false);
  if (game.mission.active) game.mission.fail(game, 'You were busted.');
  if (game.side.active) game.side.fail(game, 'you were busted');
  const p = game.player;
  if (p.inVehicle && p.vehicle && !p.vehicle.marked) {
    game.vehicles = game.vehicles.filter((v) => v !== p.vehicle); // impounded
  }
  p.inVehicle = false;
  p.vehicle = null;
  p.x = 1020;
  p.y = 560;
  p.health = Math.max(p.health, 55);
  game.screen = 'busted';
  game.endT = 2.6;
  announce('Busted.');
}

function doRespawn() {
  const p = game.player;
  p.inVehicle = false;
  p.vehicle = null;
  p.x = 620;
  p.y = 1500;
  p.health = 100;
  p.armour = 0;
  clearHeat(game);
  game.cam.x = p.x;
  game.cam.y = p.y;
  game.screen = 'play';
  if (game.mission.failed) game.screen = 'failed';
}

function tryStartJobs() {
  const p = game.player;
  if (game.mission.active || p.inVehicle) return;
  const avail = game.mission.available(game);
  if (avail && dist(p.x, p.y, avail.def.startAt.x, avail.def.startAt.y) < 80) {
    game.mission.start(game, avail.index);
    return;
  }
  const offer = game.side.offerAt(game);
  if (offer) game.side.start(game, offer.kind);
}

function computePrompt() {
  const p = game.player;
  if (game.screen !== 'play') { game.promptText = null; return; }
  if (!game.mission.active && !p.inVehicle) {
    const avail = game.mission.available(game);
    if (avail && dist(p.x, p.y, avail.def.startAt.x, avail.def.startAt.y) < 80) {
      game.promptText = `E — ${avail.def.from}: “${avail.def.title}”`;
      return;
    }
    const offer = game.side.offerAt(game);
    if (offer) { game.promptText = offer.label; return; }
  }
  game.promptText = currentPrompt(game);
}

function updateCamera(dt) {
  const p = game.player;
  const target = p.inVehicle && p.vehicle ? p.vehicle : p;
  const lead = p.inVehicle && p.vehicle ? 0.38 : 0.12;
  const tx = target.x + Math.cos(target.angle) * (target.speed ?? 0) * lead;
  const ty = target.y + Math.sin(target.angle) * (target.speed ?? 0) * lead;
  const k = 1 - Math.exp(-dt * 4.2);
  game.cam.x += (tx - game.cam.x) * k;
  game.cam.y += (ty - game.cam.y) * k;
  const speedRatio = p.inVehicle && p.vehicle ? Math.abs(p.vehicle.speed) / p.vehicle.model.topSpeed : 0;
  const zoomT = p.inVehicle ? clamp(1.05 - speedRatio * 0.24, 0.8, 1.05) : 1.05;
  game.cam.zoom += (zoomT - game.cam.zoom) * (1 - Math.exp(-dt * 2.4));
  game.cam.x = clamp(game.cam.x, VIEW_W / 2 / game.cam.zoom - 60, 4800 - VIEW_W / 2 / game.cam.zoom + 60);
  game.cam.y = clamp(game.cam.y, VIEW_H / 2 / game.cam.zoom - 60, 3600 - VIEW_H / 2 / game.cam.zoom + 60);
}

function refreshView() {
  const z = game.cam.zoom;
  game.viewRect = {
    x: game.cam.x - VIEW_W / 2 / z,
    y: game.cam.y - VIEW_H / 2 / z,
    w: VIEW_W / z,
    h: VIEW_H / z,
  };
  const m = mouse();
  game.mouseWorld = {
    x: game.cam.x + (m.x - VIEW_W / 2) / z,
    y: game.cam.y + (m.y - VIEW_H / 2) / z,
  };
  game.daylight = daylightFromHour(game.hour);
  game.tint = tintFor(game.hour, game.daylight);
  game.district = districtAt(game.player.x, game.player.y);
}

// ---- screens and keys ----

let audioStarted = false;
function wakeAudio() {
  if (audioStarted) return;
  audioStarted = true;
  initAudio();
}
window.addEventListener('keydown', wakeAudio);
window.addEventListener('mousedown', wakeAudio);

function handleKeys() {
  if (justPressed('KeyM')) {
    wakeAudio();
    game.muted = toggleMute();
  }
  const s = game.screen;
  if (s === 'title') {
    if (justPressed('Enter')) {
      if (!game.started) { applySave(); game.started = true; }
      game.screen = 'play';
      game.cam.zoom = 1.0;
      if (game.mission.completed.size === 0) game.banner('Find Marisol at the Velvet Eel — follow the pink M', 3.6);
      announce('Playing.');
    } else if (justPressed('KeyN')) {
      try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
      window.location.reload();
    } else if (justPressed('KeyH')) { game.helpFrom = 'title'; game.screen = 'help'; }
  } else if (s === 'help') {
    if (justPressed('Enter', 'Escape')) game.screen = game.helpFrom;
  } else if (s === 'play') {
    if (justPressed('Escape', 'KeyP')) game.screen = 'paused';
    if (justPressed('KeyE')) tryStartJobs();
  } else if (s === 'paused') {
    if (justPressed('Escape', 'KeyP')) game.screen = 'play';
    else if (justPressed('KeyH')) { game.helpFrom = 'paused'; game.screen = 'help'; }
  } else if (s === 'failed') {
    if (justPressed('KeyR')) {
      const idx = game.mission.failed.index ?? 0;
      game.mission.failed = null;
      game.screen = 'play';
      game.mission.start(game, idx);
    } else if (justPressed('Escape')) {
      game.mission.failed = null;
      game.screen = 'play';
    }
  } else if (s === 'ending') {
    if (justPressed('Enter')) game.screen = 'play';
  }
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const shX = game.shake ? (Math.random() - 0.5) * game.shake : 0;
  const shY = game.shake ? (Math.random() - 0.5) * game.shake : 0;
  ctx.save();
  ctx.translate(VIEW_W / 2 + shX, VIEW_H / 2 + shY);
  ctx.scale(game.cam.zoom, game.cam.zoom);
  ctx.translate(-game.cam.x, -game.cam.y);
  drawWorld(ctx, game);
  ctx.restore();
  if (game.weather === 'haze') {
    ctx.fillStyle = 'rgba(205,215,225,0.10)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (game.flash > 0) {
    ctx.fillStyle = `rgba(240,246,255,${(game.flash * 0.5).toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  drawRain(ctx, game);
  const s = game.screen;
  if (s === 'play' || s === 'paused' || s === 'failed' || s === 'wasted' || s === 'busted') drawHUD(ctx, game);
  if (s === 'title') drawTitle(ctx, game);
  else if (s === 'help') drawHelp(ctx, game);
  else if (s === 'paused') drawPause(ctx, game);
  else if (s === 'wasted') drawEndCard(ctx, game, 'wasted');
  else if (s === 'busted') drawEndCard(ctx, game, 'busted');
  else if (s === 'failed') drawMissionFailed(ctx, game);
  else if (s === 'ending') drawEnding(ctx, game);
}

// ---- the loop ----

let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (dt <= 0) dt = 0.016;
  game.elapsed += dt;
  game.bannerT = Math.max(0, game.bannerT - dt);
  game.shake *= Math.exp(-dt * 5.5);
  game.flash = Math.max(0, game.flash - dt * 2.2);

  handleKeys();

  if (game.screen === 'title' || game.screen === 'help') {
    // The bay lives behind the menu: slow pan, ambient traffic.
    const t = game.elapsed;
    game.cam.x = 2350 + Math.cos(t * 0.045) * 430;
    game.cam.y = 1750 + Math.sin(t * 0.033) * 300;
    game.cam.zoom = 0.52;
    stepWorld(dt, true);
  } else if (game.screen === 'play') {
    game.hour = (game.hour + (dt * 24) / TIME.dayLength) % 24;
    game.weatherT -= dt;
    if (game.weatherT <= 0) {
      game.weatherT = game.rng.range(45, 95);
      const roll = game.rng.next();
      game.weather = roll < 0.55 ? 'clear' : roll < 0.75 ? 'haze' : roll < 0.93 ? 'rain' : 'storm';
    }
    if (game.weather === 'storm' && Math.random() < dt * 0.14) game.flash = 0.8;
    stepWorld(dt, false);
    updateCamera(dt);
    computePrompt();
    setSiren(game.police.stars > 0);
  } else if (game.screen === 'wasted' || game.screen === 'busted') {
    game.endT -= dt;
    game.fx.update(dt);
    if (game.endT <= 0) {
      if (game.screen === 'wasted') {
        game.cash = Math.max(0, game.cash - Math.min(100, game.cash));
        doRespawn();
      } else {
        game.screen = game.mission.failed ? 'failed' : 'play';
      }
    }
  } else {
    game.fx.update(dt);
  }

  refreshView();
  render();
  endFrame();
}

// ---- screenshot mode ----

function runShotMode() {
  const controller = stageShot(game, shotName);
  refreshView();
  let finished = false;
  function shotFrame() {
    requestAnimationFrame(shotFrame);
    const dt = 1 / 60;
    game.elapsed += dt;
    // Ambient life keeps the staged frame honest: traffic rolls, people walk.
    for (const v of game.vehicles) {
      if (v.driver === 'traffic') stepTraffic(game, v, dt, game.rng);
    }
    for (const ped of game.peds) stepPed(game, ped, dt, game.rng);
    game.fx.update(dt);
    if (controller.step(dt)) finished = true;
    if (shotName === 'chase' && game.player.vehicle) {
      game.cam.x = game.player.vehicle.x - 70;
      game.cam.y = game.player.vehicle.y;
      game.cam.zoom = 0.98;
    }
    refreshView();
    render();
    if (finished && !window.__shotReady) window.__shotReady = true;
    endFrame();
  }
  requestAnimationFrame(shotFrame);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.screen === 'play' && !shotName) game.screen = 'paused';
});

if (shotName) runShotMode();
else {
  announce('Solstice Heat: Neon Tide. Press Enter to start.');
  requestAnimationFrame(frame);
}
