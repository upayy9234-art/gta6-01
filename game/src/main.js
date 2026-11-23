// Solstice Heat - bootstrap and game loop.
// States: menu orbit, play, pause, busted, wasted. Cameras: menu orbit,
// on-foot follow, chase car with speed FOV. All systems update here.
window.SH = window.SH || {};
(function (SH) {
  'use strict';
  var U = SH.U, C = SH.Config;
  var G = { state: 'menu', time: 0, camHeading: 0, keys: {}, mouseDown: false, autosave: 0, started: false };
  SH.Main = G;
  // Silent car entry used by screenshot compositions.
  SH.Player.enterCarSilent = function (car) {
    SH.Player.car = car; car.isPlayer = true;
    if (SH.Player.mesh) SH.Player.mesh.visible = false;
  };
  G.onBusted = function () {
    if (G.state !== 'play') return;
    G.state = 'busted'; SH.Economy.stats.busts++;
    SH.Economy.cash = Math.max(0, SH.Economy.cash - 150);
    SH.HUD.showScreen('busted'); SH.Economy.save();
  };
  G.onWasted = function () {
    if (G.state !== 'play') return;
    G.state = 'wasted'; SH.Economy.stats.wasted++;
    SH.HUD.showScreen('wasted'); SH.Economy.save();
  };
  G.resume = function () {
    SH.HUD.showScreen(null); G.state = 'play';
    if (!G.onboarded) { G.onboarded = true; SH.Missions.startOnboarding(); }
  };
  G.respawnAfter = function () {
    SH.Player.respawn(); SH.Police.clear();
    // Clear police units so the player restarts clean.
    var scene = G.scene;
    SH.Police.units.slice().forEach(function (u) { SH.Vehicles.removeCar(scene, u); });
    SH.Police.units = []; SH.Police.clearBlocks(scene);
    SH.HUD.showScreen(null); G.state = 'play';
  };

  function boot() {
    var seedParam = 7;
    SH.Shots.parse();
    seedParam = SH.Shots.seed || 7;
    var rng = new SH.RNG(seedParam);
    G.rng = rng;
    var renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    document.getElementById('game').appendChild(renderer.domElement);
    G.renderer = renderer;
    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xffb36b, 180, 620);
    G.scene = scene;
    var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
    G.camera = camera;
    G.camPos = new THREE.Vector3(280, 26, -60);
    G.camTarget = new THREE.Vector3(330, 2, 30);

    SH.Weather.init(scene, rng);
    SH.City.build(scene, seedParam);
    SH.Player.build(scene);
    SH.Economy.load();
    if (SH.Player.mesh) SH.Player.mesh.position.set(SH.Player.x, 0, SH.Player.z);
    SH.Vehicles.spawnParked(scene, rng, 26);
    SH.Vehicles.spawnTraffic(scene, rng, 16);
    SH.People.spawn(scene, rng, 34);
    SH.Police.buildHeli(scene);
    SH.Missions.init(scene);
    SH.Jobs.init(scene, rng);
    SH.Races.init(scene, rng);
    SH.Activities.init(scene, rng);
    SH.HUD.init();
    // A hero convertible waits at spawn.
    var heroMesh = SH.Vehicles.buildCarMesh(C.CAR_MODELS[0], 0xe63946, false, false);
    heroMesh.position.set(322, 0, 40); heroMesh.rotation.y = -Math.PI / 2.4; scene.add(heroMesh);
    var hero = { mesh: heroMesh, model: C.CAR_MODELS[0], x: 322, z: 40, heading: -Math.PI / 2.4, speed: 0, steer: 0, damage: 0, isPlayer: false, color: 0xe63946, parked: true };
    heroMesh.userData.car = hero; SH.Vehicles.cars.push(hero);
    G.heroCar = hero;

    bindInput();
    bindButtons();
    if (SH.Shots.isShot()) {
      SH.Shots.setup(G);
      G.state = 'play'; G.started = true;
      SH.HUD.showScreen(null);
    } else {
      SH.HUD.showScreen('start');
    }
    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    var last = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      step(dt);
      renderer.render(scene, camera);
      SH.Shots.tick();
    }
    requestAnimationFrame(frame);
  }

  function bindButtons() {
    function on(idName, fn) { var e = document.getElementById(idName); if (e) e.addEventListener('click', fn); }
    on('startbtn', function () { SH.Audio.init(); G.resume(); });
    on('resumebtn', function () { G.resume(); });
    on('bustedbtn', function () { G.respawnAfter(); });
    on('wastedbtn', function () { G.respawnAfter(); });
    on('dialogbox', function () { SH.HUD.nextDialog(); });
    var dlg = document.getElementById('dialog'); if (dlg) dlg.addEventListener('click', function () { SH.HUD.nextDialog(); });
  }

  function bindInput() {
    window.addEventListener('keydown', function (e) {
      G.keys[e.code] = true;
      SH.Audio.init();
      if (e.code === 'KeyM') { var m = SH.Audio.toggleMute(); SH.HUD.centerMsg(m ? 'Muted' : 'Sound on', 1); }
      if (e.code === 'KeyP') {
        // Photo mode: hide every HUD panel for clean postcard captures.
        G.photoMode = !G.photoMode;
        document.querySelectorAll('.panel').forEach(function (el) { el.style.visibility = G.photoMode ? 'hidden' : 'visible'; });
        if (!G.photoMode) SH.HUD.centerMsg('Photo mode off', 1);
      }
      if (e.code === 'KeyR' && G.state === 'play') { var st = SH.Audio.cycleStation(); SH.HUD.centerMsg('Radio: ' + st.name, 1.4); }
      if (e.code === 'Escape') {
        if (G.state === 'play') { G.state = 'pause'; SH.HUD.showScreen('pause'); }
        else if (G.state === 'pause') G.resume();
      }
      if (G.state !== 'play') return;
      if (e.code === 'KeyE') interact();
      if (e.code === 'KeyF') SH.Player.attack(G.camHeading + Math.PI);
      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4') {
        var idx = parseInt(e.code.slice(-1), 10) - 1;
        if (SH.Jobs.nearBoard() && SH.Jobs.board[idx]) SH.Jobs.start(SH.Jobs.board[idx]);
        else if (idx === 0 && nearRaceOffice()) SH.Races.start(0);
      }
      if (e.code === 'KeyB' && SH.Player.car) SH.Races.start(0);
      if (e.code === 'KeyX') SH.Jobs.cancel();
    });
    window.addEventListener('keyup', function (e) { G.keys[e.code] = false; });
    window.addEventListener('mousedown', function (e) {
      SH.Audio.init();
      if (G.state !== 'play' || SH.Shots.isShot()) return;
      if (e.target && e.target.closest && e.target.closest('.panel,.screen,#dialog')) return;
      if (SH.HUD.dialogQueue) { SH.HUD.nextDialog(); return; }
      SH.Player.shoot(G.camHeading + Math.PI);
    });
    window.addEventListener('mousemove', function (e) {
      if (G.state === 'play' && !SH.Player.car) {
        // Mouse steers the on-foot camera gently.
        G.camHeading -= (e.movementX || 0) * 0.0022;
      }
    });
  }
  function nearRaceOffice() {
    var p = SH.Player.pos(), a = SH.City.anchors.raceOffice;
    return U.dist2d(p.x, p.z, a.x, a.z) < 9;
  }
  function interact() {
    var P = SH.Player;
    if (P.car) { P.exitCar(); return; }
    if (SH.Missions.interact()) return;
    if (SH.Jobs.nearBoard()) { SH.HUD.centerMsg('Pick a job: keys 1-4', 1.6); return; }
    if (nearRaceOffice()) { SH.Races.start(0); return; }
    var p = P.pos();
    // Shop anchor cycles the catalogue with E (buys first affordable highlighted item via HUD msg).
    var shop = SH.City.anchors.shop;
    if (U.dist2d(p.x, p.z, shop.x, shop.z) < 7) {
      G.shopIdx = ((G.shopIdx || 0) + 1) % C.SHOP.length;
      var item = C.SHOP[G.shopIdx];
      if (SH.Economy.cash >= item.price) SH.Economy.buy(item);
      else SH.HUD.centerMsg(item.name + ' - ' + U.fmtMoney(item.price) + ' (need more cash)', 1.8);
      return;
    }
    var car = SH.Vehicles.nearestCar(p.x, p.z, C.PLAYER.enterRange + 1.5);
    if (car) P.enterCar(car);
  }
  G.interact = interact;

  function readInput() {
    var k = G.keys;
    return {
      up: !!(k.KeyW || k.ArrowUp), down: !!(k.KeyS || k.ArrowDown),
      left: !!(k.KeyA || k.ArrowLeft), right: !!(k.KeyD || k.ArrowRight),
      run: !!(k.ShiftLeft || k.ShiftRight), brake: !!k.Space, handbrake: !!k.Space,
      aim: !!k.MouseRight
    };
  }

  function step(dt) {
    G.time += dt;
    var shot = SH.Shots.isShot();
    var playing = G.state === 'play' || shot;
    var focus = SH.Player.pos();
    SH.Weather.update(playing ? dt : dt * 0.25, focus);
    SH.City.update(dt, G.time);
    if (playing && !shot) {
      var input = readInput();
      var timeScale = SH.Races.timeScale();
      var sdt = dt * timeScale;
      if (SH.Player.car) SH.Vehicles.drivePlayer(SH.Player.car, input, sdt);
      SH.Player.update(sdt, input, G.camHeading);
      SH.Vehicles.updateTraffic(sdt, focus);
      SH.People.update(sdt, (SH.Police.stars > 0 || input.aim) ? focus : null);
      SH.Police.update(sdt, G.scene, SH.Player);
      SH.Missions.update(sdt);
      SH.Jobs.update(sdt);
      SH.Races.update(sdt);
      SH.Activities.update(sdt);
      SH.Audio.update(dt, SH.Player.car ? SH.Player.car.speed : 0, !!SH.Player.car, SH.Police.nearestUnitDist(focus.x, focus.z) < 30);
      // Context prompt.
      updatePrompt();
      G.autosave += dt;
      if (G.autosave > C.AUTOSAVE_SEC) { G.autosave = 0; SH.Economy.save(); }
    } else if (shot) {
      // Keep the composed scene alive: idle animations only.
      SH.People.update(dt * 0.4, null);
      SH.Activities.shells.forEach(function (s) { if (!s.found) s.mesh.rotation.y += dt; });
    }
    SH.HUD.update(dt);
    updateCamera(dt, shot);
  }
  function updatePrompt() {
    var P = SH.Player;
    if (P.car) { SH.HUD.contextPrompt('E - exit car | Space - handbrake | B - race (at office) | M - mute'); return; }
    var p = P.pos();
    if (SH.Missions._offered) return; // mission prompt already set
    var car = SH.Vehicles.nearestCar(p.x, p.z, C.PLAYER.enterRange + 1.5);
    if (car) SH.HUD.contextPrompt('E - drive the ' + car.model.name);
    else if (SH.Jobs.nearBoard()) SH.HUD.contextPrompt('Job board - press 1-4 to take work');
    else if (nearRaceOffice()) SH.HUD.contextPrompt('E / 1 - start Boardwalk Sprint race');
    else {
      var shop = SH.City.anchors.shop;
      if (U.dist2d(p.x, p.z, shop.x, shop.z) < 7) SH.HUD.contextPrompt('E - shop (browse & buy)');
      else SH.HUD.contextPrompt('');
    }
  }
  function updateCamera(dt, shot) {
    var cam = G.camera, P = SH.Player;
    if (shot) { cam.position.copy(G.camPos); cam.lookAt(G.camTarget); return; }
    if (G.state === 'menu') {
      var a = G.time * 0.07;
      cam.position.set(330 + Math.cos(a) * 60, 24 + Math.sin(G.time * 0.2) * 4, 30 + Math.sin(a) * 60);
      cam.lookAt(325, 3, 35);
      return;
    }
    if (P.car) {
      var car = P.car;
      var back = 10.5 + Math.abs(car.speed) * 0.16, h = 4.2 + Math.abs(car.speed) * 0.05;
      var tx = car.x - Math.sin(car.heading) * back, tz = car.z - Math.cos(car.heading) * back;
      G.camPos.x = U.damp(G.camPos.x, tx, 5, dt); G.camPos.z = U.damp(G.camPos.z, tz, 5, dt);
      G.camPos.y = U.damp(G.camPos.y, h + (car.airY || 0), 5, dt);
      cam.position.copy(G.camPos);
      G.camTarget.set(car.x + Math.sin(car.heading) * 8, 1.4, car.z + Math.cos(car.heading) * 8);
      cam.lookAt(G.camTarget);
      var targetFov = 62 + Math.min(16, Math.abs(car.speed) * 0.45);
      cam.fov = U.damp(cam.fov, targetFov, 3, dt); cam.updateProjectionMatrix();
      G.camHeading = car.heading + Math.PI;
    } else {
      var px = P.x - Math.sin(G.camHeading) * 8.5, pz = P.z - Math.cos(G.camHeading) * 8.5;
      G.camPos.x = U.damp(G.camPos.x, px, 7, dt); G.camPos.z = U.damp(G.camPos.z, pz, 7, dt);
      G.camPos.y = U.damp(G.camPos.y, 3.4, 7, dt);
      cam.position.copy(G.camPos);
      G.camTarget.set(P.x, 1.5, P.z);
      cam.lookAt(G.camTarget);
      cam.fov = U.damp(cam.fov, 60, 3, dt); cam.updateProjectionMatrix();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.SH);
