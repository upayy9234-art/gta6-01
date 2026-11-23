// Solstice Heat: Neon Tide — main.js
// Boot, renderer/scene/camera, state machine, fixed-step loop, resize, shot mode.
window.SH = window.SH || {};
SH.state = (function () {
  'use strict';
  var R = SH.random;
  var renderer, scene, camera;
  var gameState = 'menu'; // menu | playing | paused | photo | busted | wasted
  var last = 0, accum = 0, photoOn = false;
  var shotName = null, shotReady = false, preRoll = 0;
  var params = new URLSearchParams(location.search);
  function init() {
    var seedParam = parseInt(params.get('seed') || '7', 10);
    R.seed(isNaN(seedParam) ? 7 : seedParam);
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game'), antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87bfe8);
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1600);
    camera.position.set(-70, 6, 250);
    SH.input.init();
    SH.city.build(scene);
    SH.weather.init(scene);
    SH.effects.init(scene);
    SH.vehicles.spawnWorld(scene);
    SH.pedestrians.spawnWorld(scene, 42);
    SH.player.buildMesh(scene);
    SH.police.init(scene);
    SH.missions.init(scene);
    SH.sidejobs.init(scene);
    SH.hud.init();
    window.addEventListener('resize', onResize);
    shotName = params.get('shot');
    if (shotName) {
      SH.economy.load();
      gameState = 'playing';
      SH.hud.hideStart();
      SH.shots.setup(shotName);
      preRoll = SH.shots.preRollFor(shotName); // fixed steps at 30 Hz, per-shot
    } else {
      SH.hud.showStart();
    }
    requestAnimationFrame(loop);
  }
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  function startGame(cont) {
    SH.audio.init(); SH.audio.resume();
    if (cont) SH.economy.load(); else { SH.economy.wipe(); SH.economy.data.missionIndex = 0; }
    SH.hud.hideStart(); SH.hud.hideEnd();
    gameState = 'playing';
    SH.hud.showBanner('SOLSTICE HEAT: NEON TIDE', 'Jax Marlowe, wheelman for hire. Marisol Vega is waiting at the Boardwalk.');
    SH.hud.subtitle('Marisol Vega', '"You drive, you get paid, you ask nothing. Pink marker, Jax."');
  }
  function resumeGame() { SH.hud.hidePause(); SH.hud.hideEnd(); if (gameState === 'paused' || gameState === 'busted' || gameState === 'wasted') gameState = 'playing'; }
  function quitToMenu() { SH.hud.hidePause(); SH.hud.hideEnd(); SH.hud.showStart(); gameState = 'menu'; }
  function handleInteract() {
    var P = SH.player.data;
    if (SH.player.currentVehicle()) { SH.player.exitVehicle(); return; }
    var pp = SH.player.pos();
    // story marker is handled by missions.update (checked there first)
    var fixer = SH.city.missionSpots.fixer;
    if (!SH.missions.isActive() && R.dist2(pp.x, pp.z, fixer.x, fixer.z) < 5) return;
    var shop = SH.economy.nearestShop(pp.x, pp.z);
    if (shop) { SH.hud.toast(SH.economy.buyAt(shop)); SH.audio.click(); return; }
    var car = SH.vehicles.nearestCar(pp.x, pp.z, 8.5);
    if (car) { SH.player.enterVehicle(car); return; }
  }
  function prompts() {
    var pp = SH.player.pos();
    if (SH.player.currentVehicle()) { SH.hud.setPrompt('E — exit vehicle · M — radio · Space — drift'); return; }
    var shop = SH.economy.nearestShop(pp.x, pp.z);
    if (shop) { SH.hud.setPrompt('E — ' + shop.name + ' (shop)'); return; }
    var car = SH.vehicles.nearestCar(pp.x, pp.z, 8.5);
    if (car) SH.hud.setPrompt('E — enter ' + car.name);
  }
  function tick(dt) {
    // interactions
    if (SH.input.interactPressed()) handleInteract();
    if (SH.input.pausePressed()) {
      if (gameState === 'playing') { gameState = 'paused'; SH.hud.showPause(); }
      else if (gameState === 'paused') resumeGame();
    }
    if (SH.input.photoPressed()) {
      photoOn = !photoOn;
      gameState = photoOn ? 'photo' : 'playing';
      SH.hud.setPhoto(photoOn);
    }
    SH.player.update(dt, camera);
    var pp = SH.player.pos();
    SH.vehicles.update(dt, SH.player.currentVehicle(), pp);
    SH.pedestrians.update(dt, pp);
    SH.police.update(dt);
    SH.missions.update(dt);
    SH.sidejobs.update(dt);
    SH.effects.update(dt);
    prompts();
    var audioEngineOff = !SH.player.currentVehicle();
    if (audioEngineOff) SH.audio.setEngine(0, false);
  }
  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    var scale = SH.effects.timeScale(dt);
    if (shotName && preRoll > 0) {
      // deterministic pre-roll: fixed steps, no real-time dependence
      var step = 1 / 30;
      while (preRoll > 0) { tick(step); SH.weather.update(step, camera.position); preRoll--; }
      SH.shots.frame(camera);
      renderer.render(scene, camera);
      if (!shotReady) { shotReady = true; window.__SHOT_READY = true; }
      SH.input.endFrame();
      return;
    }
    if (gameState === 'playing' || gameState === 'photo') {
      accum += dt * scale;
      var step2 = 1 / 60;
      var n = 0;
      while (accum >= step2 && n < 5) { tick(step2); accum -= step2; n++; }
      if (n === 5) accum = 0;
    }
    SH.weather.update(dt, camera.position);
    if (shotName) SH.shots.frame(camera);
    SH.hud.update(dt);
    renderer.render(scene, camera);
    SH.input.endFrame();
  }
  document.addEventListener('DOMContentLoaded', init);
  return {
    startGame: startGame, resumeGame: resumeGame, quitToMenu: quitToMenu,
    get gameState() { return gameState; },
    set gameState(v) { gameState = v; },
    scene: function () { return scene; }, camera: function () { return camera; }
  };
})();
