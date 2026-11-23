// Solstice Heat: Neon Tide — shots.js
// Deterministic screenshot compositions: ?shot=<cover|chase|marina|race>&seed=<n>
// Sets time, weather, positions, wanted level, HUD; main.js pre-rolls ~4 s of
// simulation, then this module frames the camera and main sets __SHOT_READY.
window.SH = window.SH || {};
SH.shots = (function () {
  'use strict';
  var R = SH.random;
  var current = null;
  function heroCar() {
    var best = null;
    SH.vehicles.list().forEach(function (c) { if (c.hero) best = c; });
    return best || SH.vehicles.list()[0];
  }
  function preRollFor(name) {
    if (name === 'chase') return 120;
    if (name === 'race') return 16;
    return 24;
  }
  function setup(name) {
    current = name;
    SH.economy.data.onboarding = 3; // screenshots skip the tutorial prompts
    var P = SH.player.data;
    if (name === 'cover') {
      SH.weather.setTime(0.70); SH.weather.setState('clear');
      var hero = heroCar();
      hero.x = 62; hero.z = 248; hero.heading = 2.65; hero.speed = 0;
      hero.mesh.position.set(hero.x, 0, hero.z); hero.mesh.rotation.y = hero.heading;
      SH.player.teleport(58.5, 245.2, 1.2);
      P.camYaw = 2.2; P.camPitch = 0.22;
      SH.hud.showBanner('SOLSTICE HEAT: NEON TIDE', 'Solstice Bay — Boardwalk District');
      SH.hud.setObjective('Meet Marisol Vega at the pink marker (E)');
    }
    if (name === 'chase') {
      SH.weather.setTime(0.94); SH.weather.setState('rain');
      var car = heroCar();
      car.x = -20; car.z = 60; car.heading = Math.PI / 2; car.speed = 26;
      car.mesh.position.set(car.x, 0, car.z);
      SH.player.enterVehicle(car);
      SH.shotDrive = { throttle: 1, steer: 0.02 };
      SH.police.setWanted(4, 380);
      for (var i = 0; i < 3; i++) {
        var cop = SH.police.spawnCop();
        cop.x = -20 + 14 + i * 7; cop.z = 60 + (i % 2 ? 3.4 : -3.4); cop.heading = Math.PI / 2; cop.speed = 24;
        cop.mesh.position.set(cop.x, 0, cop.z);
      }
      SH.hud.showBanner('THE GETAWAY', 'Lose the cops!');
      SH.hud.setObjective('The Getaway: Lose the cops!');
    }
    if (name === 'marina') {
      SH.weather.setTime(0.735); SH.weather.setState('clear');
      var bt = SH.vehicles.getBoat();
      if (bt) { bt.x = 212; bt.z = 374; bt.heading = 0.5; bt.mesh.position.set(bt.x, -0.2, bt.z); bt.mesh.rotation.y = bt.heading; }
      SH.player.teleport(203, 357, 3.05);
      P.camYaw = 3.05; P.camPitch = 0.3;
      SH.hud.showBanner('MARINA BLUES', 'Board the Tide Runner — buyer waits at the island');
      SH.hud.setObjective('Boat Courier: Sail the package to the island (124m)');
      SH.hud.subtitle('Marisol Vega', '"Red hull, south dock. The lighthouse light means freedom, Jax."');
    }
    if (name === 'race') {
      SH.weather.setTime(0.5); SH.weather.setState('clear');
      var rc = heroCar();
      rc.x = -6; rc.z = 60; rc.heading = -Math.PI / 2; rc.speed = 10;
      rc.mesh.position.set(rc.x, 0, rc.z);
      SH.player.enterVehicle(rc);
      SH.shotDrive = { throttle: 0.85, steer: 0 };
      SH.sidejobs.startRace(0, null);
      SH.hud.setObjective('Race: Casino Row Sprint — Checkpoint 1/6 · P4');
    }
    return current;
  }
  function frame(camera) {
    var pp = SH.player.pos();
    var t = performance.now() * 0.001;
    void t;
    if (current === 'cover') {
      camera.position.set(43, 2.3, 256);
      camera.lookAt(63.5, 1.0, 246);
    } else if (current === 'chase') {
      camera.position.set(pp.x + 15, 5.2, pp.z + 8);
      camera.lookAt(pp.x - 6, 2.2, pp.z);
    } else if (current === 'marina') {
      camera.position.set(197, 2.3, 348);
      camera.lookAt(214, 0.4, 378);
    } else if (current === 'race') {
      camera.position.set(pp.x - 11, 3.4, pp.z + 9);
      camera.lookAt(pp.x + 14, 1.1, pp.z - 2);
    }
  }
  return { setup: setup, frame: frame, preRollFor: preRollFor, current: function () { return current; } };
})();
