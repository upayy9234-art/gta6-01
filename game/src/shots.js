// Solstice Heat - deterministic screenshot compositions.
// ?shot=<name>&seed=<n> pins weather, hour, wanted level, vehicles and
// camera so the kit captures the exact frames listed in shots.json.
// Input is locked; after the scene settles, window.__shotReady = true.
window.SH = window.SH || {};
(function (SH) {
  'use strict';
  var S = { name: null, frames: 0 };
  SH.Shots = S;
  S.parse = function () {
    var q = {};
    (window.location.search || '').replace(/^\?/, '').split('&').forEach(function (kv) {
      var parts = kv.split('='); if (parts[0]) q[parts[0]] = decodeURIComponent(parts[1] || '');
    });
    S.name = q.shot || null; S.seed = parseInt(q.seed || '7', 10) || 7;
    return S.name;
  };
  S.isShot = function () { return !!S.name; };
  S.setup = function (game) {
    if (!S.name) return;
    var P = SH.Player, W = SH.Weather;
    W.pinned = true;
    var scene = game.scene;
    function placeCar(modelIdx, color, x, z, heading, asPlayer) {
      var mesh = SH.Vehicles.buildCarMesh(SH.Config.CAR_MODELS[modelIdx], color, false, false);
      mesh.position.set(x, 0, z); mesh.rotation.y = heading; scene.add(mesh);
      var car = { mesh: mesh, model: SH.Config.CAR_MODELS[modelIdx], x: x, z: z, heading: heading, speed: 0, steer: 0, damage: 0, isPlayer: false, color: color };
      mesh.userData.car = car; SH.Vehicles.cars.push(car);
      return car;
    }
    if (S.name === 'cover') {
      W.setWeather('clear', 18.1);
      var hero = placeCar(0, 0xe63946, 322, 42, -Math.PI / 2.4, true);
      P.x = 316; P.z = 36; P.heading = 2.2; if (P.mesh) { P.mesh.position.set(P.x, 0, P.z); P.mesh.rotation.y = P.heading; }
      game.camPos.set(306, 3.2, 26); game.camTarget.set(324, 1.2, 42);
      if (SH.HUD) { SH.HUD.centerMsg('', 0); }
      document.title = 'Solstice Heat';
      var titleEl = document.getElementById('shottitle'); if (titleEl) { titleEl.style.display = 'block'; }
    } else if (S.name === 'drive') {
      W.setWeather('clear', 17.6);
      var car2 = placeCar(1, 0x2ec4b6, -8, -60, 0, true);
      P.enterCarSilent(car2);
      SH.Economy.cash = 2450; SH.Economy.bank = 800; SH.Economy.xp = 350;
      var job = { kind: 'courier', name: 'Courier Run', desc: 'Deliver', base: 80, fx: -8, fz: -40, tx: 168, tz: -168, dist: 300 };
      SH.Jobs.start(job);
      game.camPos.set(-16, 6.5, -84); game.camTarget.set(-8, 1.2, -50);
    } else if (S.name === 'chase') {
      W.setWeather('breeze', 18.6);
      var car3 = placeCar(2, 0xff9f1c, -40, 168, Math.PI, true);
      P.enterCarSilent(car3); car3.speed = 14;
      SH.Police.setStars(3);
      for (var i = 0; i < 2; i++) {
        var u = SH.Vehicles.spawnPoliceCar(scene, -52 + i * 22, 196);
        u.heading = Math.PI; SH.Police.units.push(u);
      }
      if (SH.HUD) SH.HUD.radioChatter('Dispatch: pursuit in progress on the Neon Mile.');
      game.camPos.set(-58, 7, 138); game.camTarget.set(-40, 1.2, 172);
    } else if (S.name === 'foot') {
      W.setWeather('clear', 17.9);
      P.x = 322; P.z = 6; P.heading = 0.6;
      if (P.mesh) { P.mesh.position.set(P.x, 0, P.z); P.mesh.rotation.y = P.heading; }
      SH.Missions.marker.visible = true; SH.Missions.marker.position.x = 330; SH.Missions.marker.position.z = 60;
      game.camPos.set(310, 3.4, -12); game.camTarget.set(326, 1.4, 14);
    } else if (S.name === 'race') {
      W.setWeather('clear', 16.9);
      var car4 = placeCar(2, 0x4361ee, 328, 22, Math.PI, true);
      P.enterCarSilent(car4);
      placeCar(2, 0xe63946, 320, 22, Math.PI); placeCar(0, 0xffd166, 336, 22, Math.PI); placeCar(1, 0x6bcb77, 344, 22, Math.PI);
      if (SH.HUD) SH.HUD.centerMsg('Race: Boardwalk Sprint - 3... 2... 1...', 30);
      game.camPos.set(310, 5.5, -6); game.camTarget.set(330, 1.2, 24);
    } else if (S.name === 'night') {
      W.setWeather('rain', 22.4);
      var car5 = placeCar(2, 0xf72585, -40, 176, Math.PI, true);
      P.enterCarSilent(car5);
      SH.Police.setStars(4);
      var heli = SH.Police.heli; if (heli) { heli.visible = true; heli.position.set(-40, 27, 190); }
      game.camPos.set(-62, 8, 146); game.camTarget.set(-40, 1.4, 180);
    }
    game.shotMode = true;
  };
  S.tick = function () {
    if (!S.name) return;
    S.frames++;
    if (S.frames > 90 && !window.__shotReady) window.__shotReady = true;
  };
})(window.SH);
