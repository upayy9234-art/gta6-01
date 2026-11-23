// Solstice Heat — police.js
// The wanted system: heat builds from reported crimes and decays
// while the player stays unseen. Stars unlock escalating responses —
// foot officers, pursuit cars, roadblocks at three stars and a
// helicopter spotlight at four. Standing next to an officer while
// wanted fills the bust meter; filling it (or losing all health in
// a chase) ends the run with a fine.
(function () {
  "use strict";
  window.SH = window.SH || {};

  var cfg = window.SH.config;
  var PC = cfg.POLICE;

  var police = {
    heat: 0,
    stars: 0,
    bust: 0,
    officers: [],
    cars: [],
    heli: null,
    heliLight: null,
    spawnTimer: 0,
    seenTimer: 0,
    lastKnown: null,
    roadblocks: [],
    scene: null
  };

  var CRIME_HEAT = {
    shots: 30,
    assault: 24,
    theft: 26,
    crash: 10,
    speeding: 4,
    trespass: 8,
    mission: 18
  };

  function starsForHeat(heat) {
    if (heat <= 0) { return 0; }
    if (heat < 30) { return 1; }
    if (heat < 55) { return 2; }
    if (heat < 80) { return 3; }
    if (heat < 110) { return 4; }
    return 5;
  }

  function reportCrime(kind, pos) {
    var add = CRIME_HEAT[kind] || 8;
    police.heat = cfg.clamp(police.heat + add, 0, 140);
    police.stars = starsForHeat(police.heat);
    if (pos) {
      police.lastKnown = { x: pos.x, z: pos.z };
    }
    if (window.SH.people && pos) {
      window.SH.people.scare(pos, 10);
    }
  }

  function clearWanted(reason) {
    police.heat = 0;
    police.stars = 0;
    police.bust = 0;
    despawnAll();
  }

  function buildOfficerMesh() {
    var group = new THREE.Group();
    var uniform = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
    var skin = new THREE.MeshLambertMaterial({ color: 0xd8a878 });
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.74, 0.36), uniform);
    torso.position.y = 1.07;
    group.add(torso);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.41, 0.37), skin);
    head.position.y = 1.68;
    group.add(head);
    var cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.43, 0.11, 0.43),
      new THREE.MeshLambertMaterial({ color: 0x0f1c33 })
    );
    cap.position.y = 1.93;
    group.add(cap);
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.7, 0.25), uniform);
    legL.position.set(-0.16, 0.36, 0);
    group.add(legL);
    var legR = legL.clone();
    legR.position.x = 0.16;
    group.add(legR);
    group.userData.parts = { legL: legL, legR: legR };
    return group;
  }

  function spawnOfficer(scene, nearPos, rng) {
    var angle = rng.range(0, Math.PI * 2);
    var dist = rng.range(26, 40);
    var mesh = buildOfficerMesh();
    var officer = {
      mesh: mesh,
      pos: mesh.position,
      heading: 0,
      phase: rng.range(0, 6)
    };
    officer.pos.set(
      nearPos.x + Math.sin(angle) * dist,
      0,
      nearPos.z + Math.cos(angle) * dist
    );
    scene.add(mesh);
    police.officers.push(officer);
    return officer;
  }

  function spawnCopCar(scene, nearPos, rng) {
    var angle = rng.range(0, Math.PI * 2);
    var dist = rng.range(38, 55);
    var car = window.SH.vehicles.createCar(scene, {
      x: nearPos.x + Math.sin(angle) * dist,
      z: nearPos.z + Math.cos(angle) * dist,
      heading: angle,
      color: 0xf5f0e6,
      isCop: true
    });
    car.ai = { pursuit: true };
    police.cars.push(car);
    return car;
  }

  function buildHelicopter(scene) {
    var group = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.6, 5.2),
      new THREE.MeshLambertMaterial({ color: 0x22242c })
    );
    group.add(body);
    var tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 4.4),
      new THREE.MeshLambertMaterial({ color: 0x22242c })
    );
    tail.position.set(0, 0.3, 4.4);
    group.add(tail);
    var rotor = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.08, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x11131a })
    );
    rotor.position.y = 1.1;
    rotor.name = "rotor";
    group.add(rotor);
    var spot = new THREE.SpotLight(0xfff2c8, 0, 90, 0.42, 0.5);
    spot.position.set(0, -0.8, 0);
    group.add(spot);
    group.add(spot.target);
    spot.target.position.set(0, -30, 0);
    group.visible = false;
    scene.add(group);
    police.heli = group;
    police.heliLight = spot;
    return group;
  }

  function buildRoadblock(scene, aheadPos, heading) {
    var group = new THREE.Group();
    var barrierMat = new THREE.MeshLambertMaterial({ color: 0xf2782c });
    var i;
    for (i = 0; i < 4; i++) {
      var barrier = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 0.5), barrierMat);
      barrier.position.set(-6 + i * 4, 0.5, 0);
      group.add(barrier);
    }
    group.position.set(aheadPos.x, 0, aheadPos.z);
    group.rotation.y = heading;
    scene.add(group);
    var block = {
      mesh: group,
      pos: group.position,
      timer: 45
    };
    police.roadblocks.push(block);
    window.SH.city.colliders.push({
      minX: aheadPos.x - 7,
      maxX: aheadPos.x + 7,
      minZ: aheadPos.z - 0.6,
      maxZ: aheadPos.z + 0.6,
      height: 1,
      temporary: true,
      ref: block
    });
    return block;
  }

  function despawnAll() {
    var i;
    for (i = 0; i < police.officers.length; i++) {
      var o = police.officers[i];
      if (o.mesh.parent) { o.mesh.parent.remove(o.mesh); }
    }
    police.officers = [];
    for (i = 0; i < police.cars.length; i++) {
      var car = police.cars[i];
      var idx = window.SH.vehicles.all.indexOf(car);
      if (idx >= 0) { window.SH.vehicles.all.splice(idx, 1); }
      if (car.mesh.parent) { car.mesh.parent.remove(car.mesh); }
    }
    police.cars = [];
    for (i = 0; i < police.roadblocks.length; i++) {
      var b = police.roadblocks[i];
      if (b.mesh.parent) { b.mesh.parent.remove(b.mesh); }
    }
    police.roadblocks = [];
    var colliders = window.SH.city.colliders;
    for (i = colliders.length - 1; i >= 0; i--) {
      if (colliders[i].temporary) {
        colliders.splice(i, 1);
      }
    }
    if (police.heli) {
      police.heli.visible = false;
    }
  }

  function desiredUnits() {
    return {
      officers: police.stars >= 1 ? 1 + police.stars : 0,
      cars: police.stars >= 2 ? police.stars - 1 : (police.stars === 1 ? 1 : 0)
    };
  }

  function updateSpawning(dt, playerPos, rng) {
    police.spawnTimer -= dt;
    if (police.stars === 0) {
      if (police.officers.length || police.cars.length) {
        despawnAll();
      }
      return;
    }
    var want = desiredUnits();
    if (police.spawnTimer <= 0) {
      police.spawnTimer = PC.spawnInterval;
      if (police.officers.length < want.officers) {
        spawnOfficer(police.scene, playerPos, rng);
      }
      if (police.cars.length < want.cars) {
        spawnCopCar(police.scene, playerPos, rng);
      }
      if (police.stars >= PC.roadblockStars && police.roadblocks.length < police.stars - 2) {
        var ahead = {
          x: playerPos.x - Math.sin(window.SH.player.heading) * 46,
          z: playerPos.z - Math.cos(window.SH.player.heading) * 46
        };
        buildRoadblock(police.scene, ahead, window.SH.player.heading);
      }
    }
    // Cull units that fall far behind.
    var i;
    for (i = police.officers.length - 1; i >= 0; i--) {
      var o = police.officers[i];
      if (cfg.dist2d(o.pos.x, o.pos.z, playerPos.x, playerPos.z) > 130) {
        if (o.mesh.parent) { o.mesh.parent.remove(o.mesh); }
        police.officers.splice(i, 1);
      }
    }
    for (i = police.cars.length - 1; i >= 0; i--) {
      var c = police.cars[i];
      if (cfg.dist2d(c.pos.x, c.pos.z, playerPos.x, playerPos.z) > 170) {
        var idx = window.SH.vehicles.all.indexOf(c);
        if (idx >= 0) { window.SH.vehicles.all.splice(idx, 1); }
        if (c.mesh.parent) { c.mesh.parent.remove(c.mesh); }
        police.cars.splice(i, 1);
      }
    }
    for (i = police.roadblocks.length - 1; i >= 0; i--) {
      var b = police.roadblocks[i];
      b.timer -= dt;
      if (b.timer <= 0) {
        if (b.mesh.parent) { b.mesh.parent.remove(b.mesh); }
        police.roadblocks.splice(i, 1);
      }
    }
  }

  function updateOfficers(dt, player) {
    var i;
    var anyNear = false;
    for (i = 0; i < police.officers.length; i++) {
      var o = police.officers[i];
      var dx = player.pos.x - o.pos.x;
      var dz = player.pos.z - o.pos.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      o.phase += dt * 8;
      if (dist > 2.2) {
        var want = Math.atan2(dx, dz);
        o.heading = cfg.angleLerp(o.heading, want, dt * 5);
        var speed = PC.copSpeed * (dist > 20 ? 1.25 : 1);
        o.pos.x += Math.sin(o.heading) * Math.min(speed, dist * 2) * dt;
        o.pos.z += Math.cos(o.heading) * Math.min(speed, dist * 2) * dt;
        window.SH.city.resolveCollision(o.pos, 0.5);
      }
      o.mesh.position.copy(o.pos);
      o.mesh.rotation.y = o.heading;
      var parts = o.mesh.userData.parts;
      if (parts) {
        var swing = Math.sin(o.phase) * 0.55;
        parts.legL.rotation.x = swing;
        parts.legR.rotation.x = -swing;
      }
      if (dist < PC.bustDistance && player.state === "foot") {
        anyNear = true;
      }
    }
    return anyNear;
  }

  function updateCopCars(dt, player) {
    var i;
    for (i = 0; i < police.cars.length; i++) {
      var car = police.cars[i];
      var target = player.focusPos();
      var dx = target.x - car.pos.x;
      var dz = target.z - car.pos.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      var wantHeading = Math.atan2(-dx, -dz);
      var diff = wantHeading - car.heading;
      while (diff > Math.PI) { diff -= Math.PI * 2; }
      while (diff < -Math.PI) { diff += Math.PI * 2; }
      var input = {
        throttle: dist > 7 ? 1 : 0.2,
        steer: cfg.clamp(-diff * 1.4, -1, 1),
        handbrake: Math.abs(diff) > 2.2
      };
      var oldSpeed = car.speed;
      window.SH.vehicles.stepPlayerCar(car, input, dt);
      car.speed = cfg.clamp(car.speed, -10, PC.copCarSpeed);
      if (Math.abs(oldSpeed - car.speed) > 14 && window.SH.audio) {
        window.SH.audio.sfx.crash();
      }
      // Contact slows and hurts the player car / player.
      if (dist < 3.4) {
        if (player.state === "car" && player.car) {
          window.SH.vehicles.damage(player.car, 4 * dt * 10);
        } else if (player.state === "foot") {
          player.hurt(6 * dt * 10, "police");
        }
      }
      // Flash the lightbar.
      var bar = car.mesh.getObjectByName("lightbar");
      if (bar) {
        bar.material.emissiveIntensity = (Math.sin(performance.now() * 0.02) > 0) ? 1.4 : 0.15;
        bar.material.emissive.setHex((Math.sin(performance.now() * 0.02) > 0) ? 0xff2222 : 0x2244ff);
      }
    }
  }

  function updateHelicopter(dt, player) {
    if (!police.heli) {
      return;
    }
    var active = police.stars >= PC.helicopterStars;
    police.heli.visible = active;
    if (!active) {
      if (window.SH.audio) { window.SH.audio.setSiren(police.cars.length > 0, 40); }
      return;
    }
    var target = player.focusPos();
    var t = performance.now() * 0.001;
    police.heli.position.set(
      target.x + Math.sin(t * 0.6) * 14,
      30 + Math.sin(t * 1.3) * 2,
      target.z + Math.cos(t * 0.6) * 14
    );
    police.heli.lookAt(target.x, 0, target.z);
    var rotor = police.heli.getObjectByName("rotor");
    if (rotor) {
      rotor.rotation.y += dt * 28;
    }
    police.heliLight.intensity = 1.6;
    police.heliLight.target.position.set(target.x - police.heli.position.x, -30, target.z - police.heli.position.z);
  }

  function update(dt, rng) {
    var player = window.SH.player;
    if (!player || player.dead) {
      return;
    }
    police.stars = starsForHeat(police.heat);
    updateSpawning(dt, player.pos, rng);

    // Visibility: officers and cars see the player within range.
    var seen = false;
    var i;
    for (i = 0; i < police.officers.length; i++) {
      if (cfg.dist2d(police.officers[i].pos.x, police.officers[i].pos.z, player.pos.x, player.pos.z) < 34) {
        seen = true;
      }
    }
    for (i = 0; i < police.cars.length; i++) {
      if (cfg.dist2d(police.cars[i].pos.x, police.cars[i].pos.z, player.pos.x, player.pos.z) < 48) {
        seen = true;
      }
    }
    if (police.stars >= PC.helicopterStars) {
      seen = true;
    }
    if (seen) {
      police.seenTimer = 0;
      police.lastKnown = { x: player.pos.x, z: player.pos.z };
    } else {
      police.seenTimer += dt;
    }

    // Heat decay, faster while hidden.
    if (police.heat > 0) {
      var decay = PC.heatDecayPerSecond;
      if (!seen) {
        decay *= PC.hiddenDecayBonus;
      }
      police.heat = Math.max(0, police.heat - decay * dt);
      if (police.heat === 0) {
        police.stars = 0;
        if (window.SH.hud) {
          window.SH.hud.toast("You lost the heat");
        }
      }
    }

    var nearOfficer = updateOfficers(dt, player);
    updateCopCars(dt, player);
    updateHelicopter(dt, player);

    // Bust meter.
    if (nearOfficer && police.stars > 0 && player.speedNow < 2) {
      police.bust += PC.bustFillRate * dt;
    } else {
      police.bust = Math.max(0, police.bust - PC.bustDrainRate * dt);
    }
    if (police.bust >= 100) {
      police.bust = 0;
      if (window.SH.economy) {
        window.SH.economy.onBusted();
      }
      player.respawn();
    }

    if (window.SH.audio) {
      var nearestCop = 999;
      for (i = 0; i < police.cars.length; i++) {
        var d = cfg.dist2d(police.cars[i].pos.x, police.cars[i].pos.z, player.pos.x, player.pos.z);
        if (d < nearestCop) { nearestCop = d; }
      }
      window.SH.audio.setSiren(police.stars > 0 && police.cars.length > 0, nearestCop);
    }
  }

  function init(scene) {
    police.scene = scene;
    buildHelicopter(scene);
  }

  police.init = init;
  police.update = update;
  police.reportCrime = reportCrime;
  police.clearWanted = clearWanted;
  police.starsForHeat = starsForHeat;
  window.SH.police = police;
})();
