// Solstice Heat — vehicles.js
// Car construction, arcade driving physics with drift and damage,
// and AI traffic that follows the road grid. A vehicle is a plain
// object with a THREE group, velocity state and health; the player
// controller in player.js drives the active one through step().
(function () {
  "use strict";
  window.SH = window.SH || {};

  var cfg = window.SH.config;
  var VC = cfg.VEHICLE;

  var vehicles = {
    all: [],
    traffic: [],
    playerCar: null,
    smokeTimer: 0
  };

  function bodyMaterial(color) {
    return new THREE.MeshLambertMaterial({ color: color });
  }

  function buildCarMesh(color, isCop) {
    var group = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.62, 4.4),
      bodyMaterial(isCop ? 0xf5f0e6 : color)
    );
    body.position.y = 0.62;
    group.add(body);
    var cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.55, 2.1),
      new THREE.MeshLambertMaterial({ color: 0x1a2230 })
    );
    cabin.position.set(0, 1.18, -0.2);
    group.add(cabin);
    if (isCop) {
      var stripe = new THREE.Mesh(
        new THREE.BoxGeometry(2.04, 0.3, 4.44),
        new THREE.MeshLambertMaterial({ color: 0x1a2a4a })
      );
      stripe.position.y = 0.55;
      group.add(stripe);
      var bar = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.18, 0.4),
        new THREE.MeshLambertMaterial({
          color: 0x330000,
          emissive: 0xff2222,
          emissiveIntensity: 0.6
        })
      );
      bar.position.set(0, 1.55, -0.2);
      bar.name = "lightbar";
      group.add(bar);
    }
    var wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
    var wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
    var positions = [
      [-0.95, -1.45], [0.95, -1.45],
      [-0.95, 1.45], [0.95, 1.45]
    ];
    var wheels = [];
    var i;
    for (i = 0; i < positions.length; i++) {
      var wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(positions[i][0], 0.38, positions[i][1]);
      group.add(wheel);
      wheels.push(wheel);
    }
    var lightMat = new THREE.MeshLambertMaterial({
      color: 0x444422,
      emissive: 0xffeeaa,
      emissiveIntensity: 0.4
    });
    var headL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    headL.position.set(-0.6, 0.7, -2.22);
    group.add(headL);
    var headR = headL.clone();
    headR.position.x = 0.6;
    group.add(headR);
    group.userData.wheels = wheels;
    group.userData.lightMat = lightMat;
    return group;
  }

  function createCar(scene, opts) {
    var car = {
      mesh: buildCarMesh(opts.color, opts.isCop),
      pos: new THREE.Vector3(opts.x || 0, 0, opts.z || 0),
      heading: opts.heading || 0,
      speed: 0,
      steer: 0,
      health: 100,
      isCop: !!opts.isCop,
      isTraffic: !!opts.isTraffic,
      driver: null,
      smoke: null,
      driftAmount: 0,
      ai: null
    };
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.heading;
    scene.add(car.mesh);
    vehicles.all.push(car);
    if (car.isTraffic) {
      vehicles.traffic.push(car);
    }
    return car;
  }

  function spawnPlayerCar(scene) {
    var car = createCar(scene, {
      x: cfg.city ? 6 : 6,
      z: 232,
      heading: Math.PI,
      color: 0xe2452c
    });
    car.pos.set(6, 0, 232);
    car.mesh.position.copy(car.pos);
    vehicles.playerCar = car;
    return car;
  }

  function spawnTraffic(scene, rng) {
    var i;
    for (i = 0; i < VC.trafficCount; i++) {
      var point = window.SH.city.randomRoadPoint(rng);
      var car = createCar(scene, {
        x: point.x,
        z: point.z,
        heading: point.vertical ? 0 : Math.PI / 2,
        color: rng.pick(cfg.CAR_COLORS),
        isTraffic: true
      });
      car.ai = {
        vertical: point.vertical,
        dir: rng.chance(0.5) ? 1 : -1,
        laneOffset: rng.chance(0.5) ? 3.5 : -3.5,
        speed: VC.trafficSpeed * rng.range(0.75, 1.15),
        turnCooldown: 0
      };
      if (!car.ai.vertical) {
        car.heading = car.ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.heading = car.ai.dir > 0 ? 0 : Math.PI;
      }
    }
  }

  // Arcade step for a player-driven car.
  // input: {throttle:-1..1, steer:-1..1, handbrake:bool}
  function stepPlayerCar(car, input, dt) {
    var accel = 0;
    if (input.throttle > 0) {
      accel = VC.accel * input.throttle;
    } else if (input.throttle < 0) {
      if (car.speed > 0.5) {
        accel = -VC.brake;
      } else {
        accel = VC.reverseAccel * input.throttle;
      }
    }
    car.speed += accel * dt;
    car.speed -= car.speed * VC.drag * dt;
    if (!input.throttle) {
      car.speed -= car.speed * 0.6 * dt;
    }
    var maxF = VC.maxSpeed * (0.45 + 0.55 * (car.health / 100));
    car.speed = cfg.clamp(car.speed, -VC.maxReverse, maxF);

    var steerTarget = input.steer * VC.steerRate;
    var speedFactor = cfg.clamp(Math.abs(car.speed) / 12, 0, 1);
    car.steer = cfg.lerp(car.steer, steerTarget, dt * 6);
    if (Math.abs(car.speed) > 0.4) {
      var dirSign = car.speed >= 0 ? 1 : -1;
      car.heading -= car.steer * speedFactor * dirSign * dt * 0.62;
    }

    var grip = input.handbrake ? VC.driftGrip : VC.grip;
    car.driftAmount = cfg.lerp(
      car.driftAmount, input.handbrake && Math.abs(car.speed) > 8 ? 1 : 0, dt * 4);
    var forwardX = -Math.sin(car.heading);
    var forwardZ = -Math.cos(car.heading);
    var vx = forwardX * car.speed;
    var vz = forwardZ * car.speed;
    // Lateral slide while drifting.
    var sideX = -forwardZ;
    var sideZ = forwardX;
    var slide = car.steer * car.driftAmount * Math.abs(car.speed) * 0.22;
    car.pos.x += (vx + sideX * slide) * dt * (1 - grip * 0.02);
    car.pos.z += (vz + sideZ * slide) * dt * (1 - grip * 0.02);

    var hit = window.SH.city.collide(car.pos.x, car.pos.z, 1.6);
    if (hit) {
      var impact = Math.abs(car.speed);
      if (impact > 9) {
        damage(car, (impact - 8) * 1.6);
        if (window.SH.audio) {
          window.SH.audio.sfx.crash();
        }
        if (window.SH.police) {
          window.SH.police.reportCrime("crash", car.pos);
        }
      }
      window.SH.city.resolveCollision(car.pos, 1.6);
      car.speed *= -0.25;
    }
    clampToWorld(car);
    syncMesh(car, dt);
    return car.speed;
  }

  function clampToWorld(car) {
    var W = cfg.WORLD;
    car.pos.x = cfg.clamp(car.pos.x, -W.width / 2 - 60, W.width / 2 + 60);
    car.pos.z = cfg.clamp(car.pos.z, -W.depth / 2 - 40, W.beachZ + 30);
  }

  function syncMesh(car, dt) {
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.heading;
    var wheels = car.mesh.userData.wheels;
    var i;
    if (wheels) {
      for (i = 0; i < wheels.length; i++) {
        wheels[i].rotation.x += car.speed * dt * 1.4;
      }
      if (wheels[0]) { wheels[0].rotation.y = car.steer * 0.4; }
      if (wheels[1]) { wheels[1].rotation.y = car.steer * 0.4; }
    }
    // Body roll from steering and drift.
    car.mesh.rotation.z = -car.steer * 0.03 - car.driftAmount * 0.04;
  }

  function damage(car, amount) {
    car.health = cfg.clamp(car.health - amount * VC.damageScale, 0, 100);
  }

  function repair(car) {
    car.health = 100;
    clearSmoke(car);
  }

  function clearSmoke(car) {
    if (car.smoke && car.smoke.parent) {
      car.smoke.parent.remove(car.smoke);
    }
    car.smoke = null;
  }

  function updateSmoke(car, scene, dt) {
    if (car.health < 45 && !car.smoke) {
      var geo = new THREE.SphereGeometry(0.7, 8, 6);
      var material = new THREE.MeshLambertMaterial({
        color: 0x555a60,
        transparent: true,
        opacity: 0.55
      });
      var puff = new THREE.Mesh(geo, material);
      puff.position.set(0, 1.2, -1.6);
      car.mesh.add(puff);
      car.smoke = puff;
    }
    if (car.smoke) {
      var s = 1 + Math.sin(performance.now() * 0.01) * 0.25;
      car.smoke.scale.set(s, s * 1.5, s);
      if (car.health >= 45) {
        clearSmoke(car);
      }
    }
  }

  // AI traffic: follow the current road, turn at random junctions.
  function stepTraffic(car, dt, rng) {
    var ai = car.ai;
    if (!ai) {
      return;
    }
    ai.turnCooldown -= dt;
    var block = cfg.WORLD.blockSize;
    var speed = ai.speed;
    // Slow down if a car ahead is close.
    var i;
    for (i = 0; i < vehicles.traffic.length; i++) {
      var other = vehicles.traffic[i];
      if (other === car) { continue; }
      var d = cfg.dist2d(car.pos.x, car.pos.z, other.pos.x, other.pos.z);
      if (d < 9) {
        speed = Math.min(speed, other.speed * 0.8);
      }
    }
    car.speed = cfg.lerp(car.speed, speed, dt * 2);
    if (ai.vertical) {
      car.pos.z += ai.dir * car.speed * dt;
      car.heading = ai.dir > 0 ? 0 : Math.PI;
      var nearestZ = Math.round((car.pos.z + cfg.WORLD.depth / 2) / block) * block - cfg.WORLD.depth / 2;
      if (Math.abs(car.pos.z - nearestZ) < 1.2 && ai.turnCooldown <= 0 && rng.chance(0.3)) {
        ai.vertical = false;
        ai.dir = rng.chance(0.5) ? 1 : -1;
        ai.turnCooldown = 3;
      }
      if (car.pos.z > cfg.WORLD.beachZ - 16 || car.pos.z < -cfg.WORLD.depth / 2) {
        ai.dir *= -1;
      }
    } else {
      car.pos.x += ai.dir * car.speed * dt;
      car.heading = ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      var nearestX = Math.round((car.pos.x + cfg.WORLD.width / 2) / block) * block - cfg.WORLD.width / 2;
      if (Math.abs(car.pos.x - nearestX) < 1.2 && ai.turnCooldown <= 0 && rng.chance(0.3)) {
        ai.vertical = true;
        ai.dir = rng.chance(0.5) ? 1 : -1;
        ai.turnCooldown = 3;
      }
      if (Math.abs(car.pos.x) > cfg.WORLD.width / 2) {
        ai.dir *= -1;
      }
    }
    clampToWorld(car);
    syncMesh(car, dt);
  }

  function update(dt, scene, rng) {
    var i;
    for (i = 0; i < vehicles.traffic.length; i++) {
      var car = vehicles.traffic[i];
      if (car.driver === "player") {
        continue;
      }
      stepTraffic(car, dt, rng);
    }
    for (i = 0; i < vehicles.all.length; i++) {
      updateSmoke(vehicles.all[i], scene, dt);
    }
  }

  function nearestCar(pos, maxDist) {
    var best = null;
    var bestD = maxDist;
    var i;
    for (i = 0; i < vehicles.all.length; i++) {
      var car = vehicles.all[i];
      var d = cfg.dist2d(pos.x, pos.z, car.pos.x, car.pos.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  vehicles.createCar = createCar;
  vehicles.spawnPlayerCar = spawnPlayerCar;
  vehicles.spawnTraffic = spawnTraffic;
  vehicles.stepPlayerCar = stepPlayerCar;
  vehicles.update = update;
  vehicles.damage = damage;
  vehicles.repair = repair;
  vehicles.nearestCar = nearestCar;
  vehicles.buildCarMesh = buildCarMesh;
  window.SH.vehicles = vehicles;
})();
