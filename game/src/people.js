// Solstice Heat — people.js
// Pedestrians who wander the pavements and boardwalk, stroll between
// waypoints, chat in pairs, and flee when danger appears nearby
// (gunfire, a speeding car, a police chase). Simple capsule figures
// built from boxes with swinging limbs.
(function () {
  "use strict";
  window.SH = window.SH || {};

  var cfg = window.SH.config;

  var people = {
    all: [],
    count: 26
  };

  var SHIRTS = [0xff5da2, 0x5df2ff, 0xffe95d, 0x9dff5d, 0xf5f0e6, 0xff8a5d, 0x8ab4ff, 0xe2452c];
  var PANTS = [0x2a3242, 0x5a4632, 0x3a3f4a, 0x74584a, 0x24382a];
  var SKIN = [0xf2c89b, 0xc88a5a, 0x8a5a34, 0x6e4226, 0xffdcb8];

  function buildPersonMesh(rng) {
    var group = new THREE.Group();
    var shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRTS) });
    var pants = new THREE.MeshLambertMaterial({ color: rng.pick(PANTS) });
    var skin = new THREE.MeshLambertMaterial({ color: rng.pick(SKIN) });
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
    torso.position.y = 1.06;
    group.add(torso);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.36), skin);
    head.position.y = 1.66;
    group.add(head);
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.24), pants);
    legL.position.set(-0.16, 0.36, 0);
    group.add(legL);
    var legR = legL.clone();
    legR.position.x = 0.16;
    group.add(legR);
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), shirt);
    armL.position.set(-0.42, 1.06, 0);
    group.add(armL);
    var armR = armL.clone();
    armR.position.x = 0.42;
    group.add(armR);
    group.userData.parts = { legL: legL, legR: legR, armL: armL, armR: armR };
    return group;
  }

  function pavementPoint(rng) {
    var W = cfg.WORLD;
    var choice = rng.next();
    if (choice < 0.35) {
      // Boardwalk strollers.
      return {
        x: rng.range(-W.width / 2, W.width / 2),
        z: cfg.WORLD.beachZ - rng.range(2, 16)
      };
    }
    var blockX = rng.int(0, W.blocksX - 1);
    var blockZ = rng.int(0, W.blocksZ - 1);
    var cx = -W.width / 2 + blockX * W.blockSize + W.blockSize / 2;
    var cz = -W.depth / 2 + blockZ * W.blockSize + W.blockSize / 2;
    return {
      x: cx + rng.range(-20, 20),
      z: cz + rng.range(-20, 20)
    };
  }

  function spawn(scene, rng) {
    var i;
    for (i = 0; i < people.count; i++) {
      var start = pavementPoint(rng);
      var mesh = buildPersonMesh(rng);
      mesh.position.set(start.x, 0, start.z);
      scene.add(mesh);
      people.all.push({
        mesh: mesh,
        pos: mesh.position,
        heading: rng.range(0, Math.PI * 2),
        speed: rng.range(1.1, 2.1),
        target: pavementPoint(rng),
        state: "walk",
        waitTimer: 0,
        fleeTimer: 0,
        phase: rng.range(0, Math.PI * 2),
        health: 30
      });
    }
  }

  function scare(pos, radius) {
    var i;
    for (i = 0; i < people.all.length; i++) {
      var p = people.all[i];
      var d = cfg.dist2d(pos.x, pos.z, p.pos.x, p.pos.z);
      if (d < radius) {
        p.state = "flee";
        p.fleeTimer = 2.5;
        p.heading = Math.atan2(p.pos.x - pos.x, p.pos.z - pos.z);
      }
    }
  }

  function stepPerson(p, dt, rng, dangerPos) {
    p.phase += dt * (p.state === "flee" ? 11 : 6);
    if (p.state === "wait") {
      p.waitTimer -= dt;
      if (p.waitTimer <= 0) {
        p.state = "walk";
        p.target = pavementPoint(rng);
      }
    } else if (p.state === "flee") {
      p.fleeTimer -= dt;
      var fleeSpeed = 5.2;
      p.pos.x += Math.sin(p.heading) * fleeSpeed * dt;
      p.pos.z += Math.cos(p.heading) * fleeSpeed * dt;
      if (p.fleeTimer <= 0) {
        p.state = "walk";
        p.target = pavementPoint(rng);
      }
    } else {
      var dx = p.target.x - p.pos.x;
      var dz = p.target.z - p.pos.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 1.6) {
        if (rng.chance(0.4)) {
          p.state = "wait";
          p.waitTimer = rng.range(2, 6);
        } else {
          p.target = pavementPoint(rng);
        }
      } else {
        var want = Math.atan2(dx, dz);
        p.heading = cfg.angleLerp(p.heading, want, dt * 4);
        p.pos.x += Math.sin(p.heading) * p.speed * dt;
        p.pos.z += Math.cos(p.heading) * p.speed * dt;
      }
    }
    if (dangerPos) {
      var dd = cfg.dist2d(dangerPos.x, dangerPos.z, p.pos.x, p.pos.z);
      if (dd < 7 && p.state !== "flee") {
        p.state = "flee";
        p.fleeTimer = 2;
        p.heading = Math.atan2(p.pos.x - dangerPos.x, p.pos.z - dangerPos.z);
      }
    }
    window.SH.city.resolveCollision(p.pos, 0.5);
    p.pos.y = 0;
    p.mesh.position.copy(p.pos);
    p.mesh.rotation.y = p.heading;
    var parts = p.mesh.userData.parts;
    if (parts) {
      var swing = (p.state === "walk" || p.state === "flee") ? Math.sin(p.phase) * 0.55 : 0;
      parts.legL.rotation.x = swing;
      parts.legR.rotation.x = -swing;
      parts.armL.rotation.x = -swing * 0.8;
      parts.armR.rotation.x = swing * 0.8;
    }
  }

  function update(dt, rng, dangerPos) {
    var i;
    for (i = 0; i < people.all.length; i++) {
      stepPerson(people.all[i], dt, rng, dangerPos);
    }
  }

  function nearest(pos, maxDist) {
    var best = null;
    var bestD = maxDist;
    var i;
    for (i = 0; i < people.all.length; i++) {
      var d = cfg.dist2d(pos.x, pos.z, people.all[i].pos.x, people.all[i].pos.z);
      if (d < bestD) {
        bestD = d;
        best = people.all[i];
      }
    }
    return best;
  }

  function hurt(person, amount, fromPos) {
    person.health -= amount;
    person.state = "flee";
    person.fleeTimer = 3;
    if (fromPos) {
      person.heading = Math.atan2(person.pos.x - fromPos.x, person.pos.z - fromPos.z);
    }
    if (window.SH.police) {
      window.SH.police.reportCrime("assault", person.pos);
    }
  }

  people.spawn = spawn;
  people.update = update;
  people.scare = scare;
  people.nearest = nearest;
  people.hurt = hurt;
  window.SH.people = people;
})();
