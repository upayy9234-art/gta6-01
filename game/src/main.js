// ============================================================================
// SOLSTICE HEAT — main.js
// Bootstrap and the heartbeat: renderer/scene/camera, the game loop, the
// state machine (title attract mode → playing → paused / wasted / busted),
// the slow day cycle anchored on golden hour, keyboard input, and the
// localStorage save. Everything else lives in the SH.* modules.
// ============================================================================
(function () {
'use strict';
window.SH = window.SH || {};

var C = SH.Config;
var U = SH.U;

var params = new URLSearchParams(window.location.search);
var seedParam = parseInt(params.get('seed') || '', 10);
if (!isNaN(seedParam)) SH.rng = new SH.RNG(seedParam);

// --- global game state ------------------------------------------------------------
SH.G = {
  mode: 'boot',           // title | playing | paused | wasted | busted
  time: 0,
  money: 0,
  dayT: C.tuning.dayStart,
  shotMode: params.get('shot') || null,
  inputLocked: !!params.get('shot'),
  started: false
};
SH.Keys = {};
SH.KeysPressed = {};

// --- renderer / scene ----------------------------------------------------------------
var renderer, scene, camera, sun, hemi, sunTarget;
var frameCount = 0;
var shotFrozen = false;
var attractAngle = 0;

function initGraphics() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.getElementById('game-root').appendChild(renderer.domElement);
  SH.renderer = renderer;

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf2a56b, 120, 620);
  SH.scene = scene;

  camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1600);
  camera.position.set(60, 30, 120);
  SH.camera = camera;

  hemi = new THREE.HemisphereLight(0xbdd8ff, 0x8a6a4a, 0.75);
  scene.add(hemi);

  sun = new THREE.DirectionalLight(0xffd9a8, 1.35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -95;
  sun.shadow.camera.right = 95;
  sun.shadow.camera.top = 95;
  sun.shadow.camera.bottom = -95;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 520;
  sun.shadow.bias = -0.0006;
  sunTarget = new THREE.Object3D();
  scene.add(sunTarget);
  sun.target = sunTarget;
  scene.add(sun);
  SH.sun = sun;

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// --- day cycle ---------------------------------------------------------------------------
// dayT 0..1: 0.0 dawn, 0.25 noon-ish, 0.5 dusk... we anchor play around the
// golden band by starting at dayStart and moving slowly. Sun elevation is a
// sine over the cycle; palettes lerp between day / golden / night stops.
var SKY_STOPS = [
  // elev, top, mid, bot, fog, sunColor, sunI, hemiI, nightF
  { e: -0.25, top: 0x060a1c, mid: 0x101a38, bot: 0x1c2440, fog: 0x0d1424, sun: 0x8fb4ff, si: 0.06, hi: 0.22, nf: 1 },
  { e: 0.0,   top: 0x2c4a7c, mid: 0xd96f3c, bot: 0xffc98a, fog: 0xcf8456, sun: 0xffb37a, si: 0.55, hi: 0.4, nf: 0.55 },
  { e: 0.14,  top: 0x3a6ea5, mid: 0xff9e5e, bot: 0xffe3b3, fog: 0xf2a56b, sun: 0xffc98a, si: 1.15, hi: 0.62, nf: 0.12 },
  { e: 0.45,  top: 0x4a90c4, mid: 0xa8cdea, bot: 0xfdeed3, fog: 0xc4d6dd, sun: 0xfff0d0, si: 1.35, hi: 0.78, nf: 0 },
  { e: 1.0,   top: 0x3f83c2, mid: 0x9fc6e8, bot: 0xfdeed3, fog: 0xc4d6dd, sun: 0xfff3da, si: 1.4, hi: 0.8, nf: 0 }
];
var _c1 = new THREE.Color(), _c2 = new THREE.Color();
function lerpColor(target, a, b, t) {
  _c1.setHex(a); _c2.setHex(b);
  target.copy(_c1).lerp(_c2, t);
}

function applyDayCycle() {
  var dayT = SH.G.dayT;
  var ang = dayT * Math.PI * 2;
  var elev = Math.sin(ang);                       // -1..1
  var azim = Math.cos(ang);                        // east → west
  // find palette segment
  var a = SKY_STOPS[0], b = SKY_STOPS[SKY_STOPS.length - 1];
  for (var i = 0; i < SKY_STOPS.length - 1; i++) {
    if (elev >= SKY_STOPS[i].e && elev <= SKY_STOPS[i + 1].e) { a = SKY_STOPS[i]; b = SKY_STOPS[i + 1]; break; }
  }
  var span = (b.e - a.e) || 1;
  var t = U.clamp((elev - a.e) / span, 0, 1);

  var sky = SH.City.skyMat;
  if (sky) {
    lerpColor(sky.uniforms.top.value, a.top, b.top, t);
    lerpColor(sky.uniforms.mid.value, a.mid, b.mid, t);
    lerpColor(sky.uniforms.bot.value, a.bot, b.bot, t);
  }
  lerpColor(scene.fog.color, a.fog, b.fog, t);
  lerpColor(sun.color, a.sun, b.sun, t);
  sun.intensity = U.lerp(a.si, b.si, t);
  hemi.intensity = U.lerp(a.hi, b.hi, t);
  var nightF = U.lerp(a.nf, b.nf, t);
  SH.City.setNight(nightF);
  SH.Vehicles.setNight(nightF);

  // sun position relative to the player so shadows stay local and crisp
  var focus = SH.Player && SH.Player.pos ? SH.Player.pos : { x: 0, z: 0 };
  var sunDist = 190;
  var sx = focus.x + azim * sunDist * 0.7;
  var sz = focus.z + 60;
  var sy = Math.max(elev, -0.12) * sunDist;
  sun.position.set(sx, sy + 24, sz);
  sunTarget.position.set(focus.x, 0, focus.z);
  sunTarget.updateMatrixWorld();
  sun.castShadow = elev > 0.02;
}

// --- save / load ----------------------------------------------------------------------
var SAVE_KEY = 'solstice-heat-save-v1';
SH.Save = {
  read: function () {
    try {
      var raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },
  save: function () {
    try {
      var data = SH.Missions.saveData();
      data.money = SH.G.money;
      data.playerPos = { x: SH.Player.pos.x, z: SH.Player.pos.z };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable: play on without saving */ }
  },
  clear: function () {
    try { window.localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }
};

// --- state machine ------------------------------------------------------------------------
function startGame(continueSave) {
  var save = continueSave ? SH.Save.read() : null;
  if (!continueSave) SH.Save.clear();
  if (save) {
    SH.G.money = save.money || 0;
    SH.Missions.restore(save);
    if (save.playerPos) SH.Player.pos.set(save.playerPos.x, 0, save.playerPos.z);
  } else {
    SH.G.money = 120;
    SH.Missions.restore(null);
  }
  SH.Player.heal();
  SH.Police.clearWanted();
  SH.HUD.hideTitle();
  SH.HUD.hideOver();
  SH.G.mode = 'playing';
  SH.G.started = true;
  SH.Missions.begin();
  SH.Save.save();
}

function gameOver(kind) {
  if (SH.G.mode !== 'playing') return;
  SH.G.mode = kind; // 'wasted' | 'busted'
  if (kind === 'wasted') SH.Audio.wasted(); else SH.Audio.busted();
  SH.Audio.setEngine(-1);
  SH.Audio.setSiren(0);
  SH.HUD.showOver(kind);
  SH.Missions.onPlayerDown();
}

function respawn() {
  // the city hospital drops you at Bayfront & Solstice, lighter of pocket
  if (SH.G.mode === 'wasted') SH.G.money = Math.max(0, SH.G.money - 100);
  SH.Police.clearWanted();
  SH.Player.respawn(6, 40);
  SH.HUD.hideOver();
  SH.G.mode = 'playing';
  // restart the interrupted mission if its restart timer already lapsed
  if (!SH.Missions.state.active && !SH.Missions.state.storyDone) SH.Missions.begin();
  SH.Save.save();
}

SH.Main = { startGame: startGame, gameOver: gameOver, respawn: respawn };

// --- input -------------------------------------------------------------------------------------
function bindInput() {
  window.addEventListener('keydown', function (e) {
    SH.Audio.unlock();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    if (!e.repeat) SH.KeysPressed[e.code] = true;
    SH.Keys[e.code] = true;

    if (e.code === 'KeyM') {
      var m = SH.Audio.setMuted(!SH.Audio.isMuted());
      SH.HUD.setMutedNote(m);
    }
    if (SH.G.mode === 'title' && (e.code === 'Enter')) {
      startGame(!!SH.Save.read());
    } else if ((SH.G.mode === 'wasted' || SH.G.mode === 'busted') && e.code === 'KeyR') {
      respawn();
    } else if (SH.G.mode === 'playing' && (e.code === 'KeyP' || e.code === 'Escape')) {
      SH.G.mode = 'paused';
      SH.HUD.showPause(true);
    } else if (SH.G.mode === 'paused' && (e.code === 'KeyP' || e.code === 'Escape' || e.code === 'Enter')) {
      SH.G.mode = 'playing';
      SH.HUD.showPause(false);
    } else if (SH.G.mode === 'playing' && e.code === 'KeyT') {
      SH.Missions.toggleTaxi();
    }
  });
  window.addEventListener('keyup', function (e) { SH.Keys[e.code] = false; });
  window.addEventListener('pointerdown', function () { SH.Audio.unlock(); }, { passive: true });

  var btnNew = document.getElementById('btn-new');
  var btnContinue = document.getElementById('btn-continue');
  if (btnNew) btnNew.addEventListener('click', function () { SH.Audio.unlock(); startGame(false); });
  if (btnContinue) btnContinue.addEventListener('click', function () { SH.Audio.unlock(); startGame(true); });
}

// --- world construction ---------------------------------------------------------------------------
function buildWorld() {
  SH.City.build(scene);
  SH.Player.build();
  SH.Vehicles.spawnTraffic(C.tuning.trafficCount);
  SH.Vehicles.spawnParked(C.tuning.parkedCount);
  SH.People.spawnCrowd(C.tuning.pedCount);
  SH.Missions.init();
  SH.HUD.init();
}

// --- attract mode (title) ----------------------------------------------------------------------------
function attractCamera(dt) {
  attractAngle += dt * 0.045;
  var r = 128;
  camera.position.set(Math.cos(attractAngle) * r, 34 + Math.sin(attractAngle * 0.7) * 7, Math.sin(attractAngle) * r);
  camera.lookAt(10, 4, 0);
}

// --- main loop -------------------------------------------------------------------------------------------------
var lastNow = 0;
function loop(now) {
  requestAnimationFrame(loop);
  var dt = Math.min(0.05, lastNow ? (now - lastNow) / 1000 : 0.016);
  lastNow = now;
  frameCount++;

  if (SH.G.shotMode) {
    // composed stills: hold the world, run only cosmetic animation
    SH.G.time += dt;
    SH.Shots.frame(dt, SH.G.time);
    SH.HUD.update(dt);
    renderer.render(scene, camera);
    if (frameCount >= 55 && !shotFrozen) {
      shotFrozen = true;
      window.__shotReady = true;
    }
    if (frameCount === 2) markBootOk();
    return;
  }

  if (SH.G.mode !== 'paused') {
    SH.G.time += dt;
    SH.G.dayT = (SH.G.dayT + dt / C.tuning.dayLength) % 1;
    applyDayCycle();
    SH.City.update(dt, SH.G.time);
  }

  if (SH.G.mode === 'title') {
    attractCamera(dt);
    SH.Vehicles.update(dt);
    SH.People.update(dt);
  } else if (SH.G.mode === 'playing') {
    SH.Player.update(dt);
    SH.Vehicles.update(dt);
    SH.People.update(dt);
    SH.Police.update(dt);
    SH.Missions.update(dt);
    SH.HUD.update(dt);
  } else if (SH.G.mode === 'wasted' || SH.G.mode === 'busted') {
    SH.Vehicles.update(dt);
    SH.People.update(dt);
    SH.HUD.update(dt);
  }
  // paused: render the frozen frame only

  renderer.render(scene, camera);
  if (frameCount === 2) markBootOk();
  SH.KeysPressed = {};
}

var bootMarked = false;
function markBootOk() {
  if (bootMarked) return;
  bootMarked = true;
  window.__gameReady = true;
  var el = document.getElementById('boot-ok');
  if (el) el.textContent = 'ready';
}

// --- boot -----------------------------------------------------------------------------------------------------------
function boot() {
  initGraphics();
  buildWorld();
  applyDayCycle();
  bindInput();
  if (SH.G.shotMode && SH.Shots.active()) {
    SH.G.mode = 'playing';
    SH.G.dayT = 0.465; // pin golden hour for the stills
    applyDayCycle();
    SH.HUD.hideTitle();
    SH.Shots.setup();
    // HUD reflects the composed scene (stars, speedo, minimap)
    SH.HUD.update(0.016);
  } else {
    SH.G.mode = 'title';
    var save = SH.Save.read();
    SH.HUD.showTitle(!!save);
    if (save) {
      SH.HUD.setSaveInfo('Saved run: ' + U.fmtMoney(save.money || 0) + ' · mission ' +
        Math.min((save.missionIndex || 0) + 1, C.missions.length) + ' of ' + C.missions.length);
    }
  }
  requestAnimationFrame(loop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
})();
