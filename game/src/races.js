// Solstice Heat — races.js
// Street racing and stunt jumps. Three checkpoint routes (Boardwalk
// Dash, Neon Circuit, Bay Loop) with two AI rivals each, a countdown
// start, split timing and cash prizes. Eight stunt ramps around the
// bay trigger slow-motion when cleared with enough air time.
(function () {
  "use strict";
  window.SH = window.SH || {};

  var cfg = window.SH.config;

  var ROUTES = [
    {
      id: "boardwalk-dash",
      name: "Boardwalk Dash",
      start: { x: -180, z: 250, heading: -Math.PI / 2 },
      prize: 220,
      xp: 35,
      checkpoints: [
        { x: -100, z: 250 },
        { x: -20, z: 250 },
        { x: 60, z: 250 },
        { x: 140, z: 250 },
        { x: 200, z: 220 },
        { x: 200, z: 150 }
      ]
    },
    {
      id: "neon-circuit",
      name: "Neon Circuit",
      start: { x: -100, z: 70, heading: -Math.PI / 2 },
      prize: 320,
      xp: 50,
      checkpoints: [
        { x: -20, z: 70 },
        { x: 60, z: 70 },
        { x: 100, z: 130 },
        { x: 60, z: 180 },
        { x: -40, z: 180 },
        { x: -100, z: 130 },
        { x: -100, z: 70 }
      ]
    },
    {
      id: "bay-loop",
      name: "Bay Loop",
      start: { x: -200, z: -160, heading: -Math.PI / 2 },
      prize: 450,
      xp: 70,
      checkpoints: [
        { x: -80, z: -160 },
        { x: 60, z: -160 },
        { x: 180, z: -100 },
        { x: 180, z: 40 },
        { x: 80, z: 120 },
        { x: -60, z: 120 },
        { x: -180, z: 20 },
        { x: -200, z: -160 }
      ]
    }
  ];

  var STUNTS = [
    { id: "stunt-pier", name: "Pier Plunge", x: 40, z: 300, dir: 0 },
    { id: "stunt-boardwalk", name: "Boardwalk Hop", x: -140, z: 252, dir: 1 },
    { id: "stunt-neon", name: "Neon Leap", x: 20, z: 128, dir: 0 },
    { id: "stunt-port", name: "Crane Gap", x: 180, z: -70, dir: 3 },
    { id: "stunt-heights", name: "Heights Drop", x: -40, z: -110, dir: 2 },
    { id: "stunt-oldtown", name: "Alley Air", x: -180, z: 30, dir: 1 },
    { id: "stunt-marina", name: "Marina Skip", x: 170, z: 150, dir: 2 },
    { id: "stunt-campus", name: "Campus Kicker", x: -190, z: -150, dir: 0 }
  ];

  var races = {
    routes: ROUTES,
    stunts: STUNTS,
    active: null,
    checkpointIndex: 0,
    countdown: 0,
    elapsed: 0,
    rivals: [],
    finished: false,
    slowmo: 0,
    rampMeshes: []
  };

  function buildRamps(scene) {
    var rampMat = new THREE.MeshLambertMaterial({ color: 0xf2782c });
    var i;
    for (i = 0; i < STUNTS.length; i++) {
      var s = STUNTS[i];
      var ramp = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 8), rampMat);
      ramp.position.set(s.x, 0.8, s.z);
      ramp.rotation.y = s.dir * Math.PI / 2;
      ramp.rotation.x = -0.28;
      scene.add(ramp);
      races.rampMeshes.push(ramp);
    }
  }

  function nearStart(playerPos) {
    var i;
    for (i = 0; i < ROUTES.length; i++) {
      var s = ROUTES[i].start;
      if (cfg.dist2d(playerPos.x, playerPos.z, s.x, s.z) < 9) {
        return ROUTES[i];
      }
    }
    return null;
  }

  function spawnRivals(scene, route, rng) {
    var rivals = [];
    var i;
    for (i = 0; i < 2; i++) {
      var car = window.SH.vehicles.createCar(scene, {
        x: route.start.x + (i === 0 ? -4 : 4),
        z: route.start.z + 6,
        heading: route.start.heading,
        color: rng.pick(cfg.CAR_COLORS),
        isTraffic: false
      });
      car.ai = {
        race: true,
        route: route,
        checkpointIndex: 0,
        speed: cfg.VEHICLE.maxSpeed * rng.range(0.62, 0.74),
        finished: false
      };
      rivals.push(car);
    }
    return rivals;
  }

  function start(route, scene, rng, player) {
    if (races.active) {
      return false;
    }
    if (player.state !== "car") {
      if (window.SH.hud) {
        window.SH.hud.toast("Races need a car");
      }
      return false;
    }
    races.active = route;
    races.checkpointIndex = 0;
    races.countdown = 3;
    races.elapsed = 0;
    races.finished = false;
    races.rivals = spawnRivals(scene, route, rng);
    if (window.SH.hud) {
      window.SH.hud.setMission(route.name, "Get ready…", "Prize " + cfg.formatMoney(route.prize));
    }
    return true;
  }

  function cleanupRivals() {
    var i;
    for (i = 0; i < races.rivals.length; i++) {
      var car = races.rivals[i];
      var idx = window.SH.vehicles.all.indexOf(car);
      if (idx >= 0) {
        window.SH.vehicles.all.splice(idx, 1);
      }
      if (car.mesh.parent) {
        car.mesh.parent.remove(car.mesh);
      }
    }
    races.rivals = [];
  }

  function finishRace(playerWon, player) {
    var route = races.active;
    if (!route) {
      return;
    }
    if (playerWon) {
      if (window.SH.economy) {
        window.SH.economy.addCash(route.prize);
        window.SH.economy.addXP(route.xp);
        window.SH.economy.save.racesWon += 1;
        window.SH.economy.persist();
      }
      if (window.SH.hud) {
        window.SH.hud.toast("You won " + route.name + " · " + cfg.formatMoney(route.prize) +
          " · " + races.elapsed.toFixed(1) + "s");
      }
      if (window.SH.audio) {
        window.SH.audio.sfx.success();
      }
    } else {
      if (window.SH.hud) {
        window.SH.hud.toast("Outrun in " + route.name + " — the rivals take the pot");
      }
      if (window.SH.audio) {
        window.SH.audio.sfx.fail();
      }
    }
    if (window.SH.hud) {
      window.SH.hud.setMission("", "", "");
    }
    cleanupRivals();
    races.active = null;
    races.finished = true;
  }

  function stepRival(car, dt) {
    var ai = car.ai;
    if (!ai || ai.finished) {
      return;
    }
    var target = ai.route.checkpoints[ai.checkpointIndex];
    if (!target) {
      ai.finished = true;
      return;
    }
    var dx = target.x - car.pos.x;
    var dz = target.z - car.pos.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 11) {
      ai.checkpointIndex += 1;
      if (ai.checkpointIndex >= ai.route.checkpoints.length) {
        ai.finished = true;
        if (races.active) {
          finishRace(false, null);
        }
        return;
      }
      target = ai.route.checkpoints[ai.checkpointIndex];
      dx = target.x - car.pos.x;
      dz = target.z - car.pos.z;
    }
    var wantHeading = Math.atan2(-dx, -dz);
    var diff = wantHeading - car.heading;
    while (diff > Math.PI) { diff -= Math.PI * 2; }
    while (diff < -Math.PI) { diff += Math.PI * 2; }
    var input = {
      throttle: 1,
      steer: cfg.clamp(-diff * 1.5, -1, 1),
      handbrake: Math.abs(diff) > 1.9
    };
    window.SH.vehicles.stepPlayerCar(car, input, dt);
    car.speed = cfg.clamp(car.speed, -8, ai.speed);
  }

  function checkStunts(dt, player) {
    if (player.state !== "car" || !player.car) {
      return;
    }
    var car = player.car;
    var i;
    for (i = 0; i < STUNTS.length; i++) {
      var s = STUNTS[i];
      var d = cfg.dist2d(car.pos.x, car.pos.z, s.x, s.z);
      if (d < 5 && Math.abs(car.speed) > 17) {
        var save = window.SH.economy ? window.SH.economy.save : null;
        if (save && !save.stunts[s.id]) {
          save.stunts[s.id] = true;
          window.SH.economy.addCash(75);
          window.SH.economy.addXP(15);
          window.SH.economy.persist();
          if (window.SH.hud) {
            window.SH.hud.toast("Stunt cleared: " + s.name + " · $75");
          }
        }
        races.slowmo = 1.1;
        car.pos.y = 1.4;
      }
    }
    if (car.pos.y > 0) {
      car.pos.y = Math.max(0, car.pos.y - dt * 3.2);
      car.mesh.position.y = car.pos.y;
    }
  }

  function update(dt, scene, rng, player) {
    checkStunts(dt, player);
    if (races.slowmo > 0) {
      races.slowmo -= dt;
    }
    if (!races.active) {
      var route = nearStart(player.pos);
      if (route && player.state === "car" && window.SH.hud) {
        window.SH.hud.prompt("Press E to race: " + route.name +
          " — prize " + cfg.formatMoney(route.prize));
      }
      return 1;
    }
    if (races.countdown > 0) {
      races.countdown -= dt;
      if (window.SH.hud) {
        window.SH.hud.setSub("Starting in " + Math.ceil(races.countdown) + "…");
      }
      return 1;
    }
    races.elapsed += dt;
    var i;
    for (i = 0; i < races.rivals.length; i++) {
      stepRival(races.rivals[i], dt);
      if (!races.active) {
        return 1;
      }
    }
    var cp = races.active.checkpoints[races.checkpointIndex];
    if (!cp) {
      finishRace(true, player);
      return 1;
    }
    if (window.SH.missions && window.SH.missions.marker) {
      var marker = window.SH.missions.marker;
      marker.position.set(cp.x, 13, cp.z);
      marker.visible = true;
    }
    if (window.SH.hud) {
      var rivalBest = 0;
      for (i = 0; i < races.rivals.length; i++) {
        rivalBest = Math.max(rivalBest, races.rivals[i].ai.checkpointIndex);
      }
      window.SH.hud.setMission(
        races.active.name,
        "Checkpoint " + (races.checkpointIndex + 1) + " of " + races.active.checkpoints.length,
        "Time " + races.elapsed.toFixed(1) + "s · best rival at " + (rivalBest + 1)
      );
    }
    var focus = player.focusPos();
    if (cfg.dist2d(focus.x, focus.z, cp.x, cp.z) < 11) {
      races.checkpointIndex += 1;
      if (window.SH.audio) {
        window.SH.audio.sfx.checkpoint();
      }
      if (races.checkpointIndex >= races.active.checkpoints.length) {
        finishRace(true, player);
      }
    }
    return 1;
  }

  function timeScale() {
    return races.slowmo > 0 ? 0.35 : 1;
  }

  function tryStart(rng, player, scene) {
    var route = nearStart(player.pos);
    if (route) {
      return start(route, scene, rng, player);
    }
    return false;
  }

  races.init = buildRamps;
  races.update = update;
  races.start = start;
  races.tryStart = tryStart;
  races.nearStart = nearStart;
  races.timeScale = timeScale;
  window.SH.races = races;
})();
