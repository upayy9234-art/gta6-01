// Solstice Heat — main.js
// Bootstrap and game loop. Creates the renderer, scene and camera,
// builds the city, wires every system together, collects keyboard
// input, runs the third-person camera rig, handles photo mode and
// pause, applies deterministic shot compositions when requested,
// and drives the fixed-order update: weather, player, vehicles,
// people, police, missions, jobs, races, activities, economy, HUD.
(function () {
  "use strict";
  window.SH = window.SH || {};

  var cfg = window.SH.config;

  var canvas = document.getElementById("game-canvas");
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(
    62, window.innerWidth / window.innerHeight, 0.1, 1200);

  var rng = new window.SH.RNG(window.SH.querySeed() * 977 + 13);
  var gameRng = new window.SH.RNG(window.SH.querySeed() * 331 + 7);

  var keys = {};
  var input = {
    forward: false,
    back: false,
    left: false,
    right: false,
    sprint: false,
    handbrake: false,
    attack: false,
    aim: false
  };

  var state = {
    paused: false,
    photoMode: false,
    shotMode: false,
    cameraYaw: Math.PI,
    cameraPitch: 0.32,
    elapsed: 0,
    player: null
  };

  // World construction -------------------------------------------------
  var city = window.SH.city;
  city.build(scene);

  var weather = window.SH.weather;
  weather.init(scene, camera);

  var economy = window.SH.economy;
  economy.load();

  var vehicles = window.SH.vehicles;
  vehicles.spawnPlayerCar(scene);
  vehicles.spawnTraffic(scene, rng);

  var people = window.SH.people;
  people.spawn(scene, rng);

  var player = window.SH.player;
  player.init(scene);
  state.player = player;

  var police = window.SH.police;
  police.init(scene);

  var missions = window.SH.missions;
  missions.init(scene);
  missions.resumeFromSave(economy.save);

  var races = window.SH.races;
  races.init(scene);

  var activities = window.SH.activities;
  activities.init(scene, rng);

  var hud = window.SH.hud;
  hud.init();

  var audio = window.SH.audio;

  // Shot mode ------------------------------------------------------------
  var shot = window.SH.shots.requested();
  var shotCamera = null;
  if (shot) {
    state.shotMode = true;
    var world = { scene: scene, player: player, camera: camera };
    var applied = window.SH.shots.apply(shot, world);
    shotCamera = window.SH.shots.cameraFor(shot, applied.heading);
    state.cameraYaw = shotCamera.yaw;
  }

  // Input ----------------------------------------------------------------
  var KEYMAP = {
    KeyW: "forward",
    ArrowUp: "forward",
    KeyS: "back",
    ArrowDown: "back",
    KeyA: "left",
    ArrowLeft: "left",
    KeyD: "right",
    ArrowRight: "right",
    ShiftLeft: "sprint",
    ShiftRight: "sprint",
    Space: "handbrake"
  };

  window.addEventListener("keydown", function (event) {
    audio.unlock();
    keys[event.code] = true;
    if (KEYMAP[event.code]) {
      input[KEYMAP[event.code]] = true;
      if (event.code === "Space") {
        event.preventDefault();
      }
    }
    if (event.code === "KeyF") {
      if (state.photoMode) {
        // Photo-mode shutter: sound plus a confirmation toast.
        audio.sfx.shutter();
        hud.toast("Photo snapped — Solstice Bay, framed");
      } else {
        input.attack = true;
      }
    }
    if (event.code === "KeyQ") {
      input.aim = true;
    }
    if (event.code === "KeyE") {
      handleInteract();
    }
    if (event.code === "KeyM") {
      var station = audio.cycleRadio();
      if (hud) {
        hud.toast(station ? "Radio: " + station.name : "Radio off");
      }
    }
    if (event.code === "KeyP") {
      togglePhotoMode();
    }
    if (event.code === "KeyB") {
      economy.confirmShop(player);
    }
    if (event.code === "KeyG") {
      economy.cycleShop(player);
    }
    if (event.code === "Escape") {
      togglePause();
    }
  });

  window.addEventListener("keyup", function (event) {
    keys[event.code] = false;
    if (KEYMAP[event.code]) {
      input[KEYMAP[event.code]] = false;
    }
    if (event.code === "KeyF") {
      input.attack = false;
    }
    if (event.code === "KeyQ") {
      input.aim = false;
    }
  });

  canvas.addEventListener("mousedown", function () {
    audio.unlock();
    input.attack = true;
    input.aim = true;
  });
  window.addEventListener("mouseup", function () {
    input.attack = false;
    input.aim = false;
  });

  window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function handleInteract() {
    if (state.paused || player.dead) {
      return;
    }
    // Priority: race start, job board, beacon trial, shop, then car.
    if (races.tryStart(gameRng, player, scene)) {
      return;
    }
    if (jobsTryStart()) {
      return;
    }
    if (activities.tryInteract(gameRng, player)) {
      return;
    }
    if (economy.cycleShop(player)) {
      return;
    }
    player.tryEnterCar();
  }

  function jobsTryStart() {
    return window.SH.jobs.tryStart(gameRng, player);
  }

  function togglePhotoMode() {
    state.photoMode = !state.photoMode;
    player.photoMode = state.photoMode;
    hud.setPhotoMode(state.photoMode);
    if (state.photoMode) {
      hud.toast("Photo mode — frame the bay, P to exit");
    }
  }

  function togglePause() {
    if (state.shotMode) {
      return;
    }
    state.paused = !state.paused;
    if (state.paused) {
      var counts = activities.counts();
      hud.showOverlay(
        "PAUSED",
        "Solstice Heat — Esc to resume. " +
        "Shells " + counts.shells + "/30 · Postcards " + counts.postcards +
        "/6 · Stunts " + counts.stunts + "/8 · Jobs done " + economy.save.jobsDone +
        " · Races won " + economy.save.racesWon + "."
      );
    } else {
      hud.hideOverlay();
    }
  }

  // Camera rig -------------------------------------------------------------
  function updateCamera(dt) {
    var focus = player.focusPos();
    var targetYaw;
    if (state.shotMode && shotCamera) {
      targetYaw = shotCamera.yaw;
    } else if (player.state === "car") {
      targetYaw = player.heading;
    } else {
      targetYaw = state.cameraYaw;
      // On foot the camera follows behind the player's heading when moving.
      if (player.speedNow > 0.5) {
        targetYaw = cfg.angleLerp(state.cameraYaw, player.heading, dt * 1.6);
      }
    }
    state.cameraYaw = targetYaw;
    var dist = state.shotMode && shotCamera ? shotCamera.dist : (player.state === "car" ? 11 : 8.5);
    var height = state.shotMode && shotCamera ? shotCamera.height : (player.state === "car" ? 3.6 : 3.0);
    if (state.photoMode) {
      dist = 13;
      height = 4.2;
      // Slow cinematic pan while framing a photo.
      state.cameraYaw += dt * 0.12;
    }
    var backX = Math.sin(state.cameraYaw);
    var backZ = Math.cos(state.cameraYaw);
    var camX = focus.x + backX * dist;
    var camZ = focus.z + backZ * dist;
    var camY = focus.y + height;
    // Keep the camera out of buildings where possible.
    var hit = city.collide(camX, camZ, 0.5);
    if (hit && hit.height > camY) {
      camY = hit.height + 1.5;
    }
    camera.position.set(camX, camY, camZ);
    camera.lookAt(focus.x, focus.y + 1.6, focus.z);
  }

  // Main loop ---------------------------------------------------------------
  var lastTime = performance.now();
  var saveTimer = 0;

  function frame(now) {
    window.requestAnimationFrame(frame);
    var rawDt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    if (state.paused) {
      renderer.render(scene, camera);
      return;
    }
    var timeScale = races.timeScale();
    var dt = state.shotMode ? 0 : rawDt * timeScale;
    state.elapsed += dt;

    if (!state.shotMode) {
      weather.update(rawDt, player.focusPos(), gameRng);
      player.update(dt, input, state.cameraYaw);
      vehicles.update(dt, scene, gameRng);
      var danger = null;
      if (police.stars > 0 || player.speedNow > 20) {
        danger = player.focusPos();
      }
      people.update(dt, gameRng, danger);
      police.update(dt, gameRng);
      missions.update(dt, player);
      window.SH.jobs.update(dt, player);
      races.update(dt, scene, gameRng, player);
      activities.update(dt, player, gameRng);
      economy.tick(dt);
      city.update(rawDt, weather.nightFactor);

      // Shop prompt refresh.
      var zone = economy.shopNear(player.pos);
      if (zone && player.state === "foot") {
        hud.prompt(zone.name + " — press G to browse, B to buy");
      } else if (!window.SH.jobs.active && !races.active) {
        // Prompts from jobs/races set their own text each frame.
        if (!zone) {
          hud.clearPrompt();
        }
      }

      // Respawn flow.
      if (player.dead) {
        hud.showOverlay("WASTED", "The bay chews up another driver. Respawning…");
        player.respawnTimer = (player.respawnTimer || 0) + rawDt;
        if (player.respawnTimer > 2.2) {
          player.respawnTimer = 0;
          hud.hideOverlay();
          player.respawn();
        }
      }

      saveTimer += rawDt;
      if (saveTimer > 8) {
        saveTimer = 0;
        economy.persist();
      }
    } else {
      // Frozen composition: still let weather and city settle visuals.
      weather.update(0, player.focusPos(), gameRng);
      city.update(rawDt, weather.nightFactor);
    }

    updateCamera(rawDt);
    hud.update(rawDt, state);
    renderer.render(scene, camera);
    if (state.shotMode) {
      document.title = "Solstice Heat — shot:" + shot.name + " ready";
      window.__SH_SHOT_READY = true;
    }
  }

  window.__SH = state;
  window.requestAnimationFrame(frame);
})();
