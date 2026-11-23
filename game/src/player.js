// Solstice Heat — player.js
// The player character: on-foot movement (walk, sprint, swim),
// melee and pistol combat, health and armour, entering and driving
// cars, and the third-person camera rig. Input is collected by
// main.js into a shared keys object passed to update().
(function () {
  "use strict";
  window.SH = window.SH || {};

  var cfg = window.SH.config;
  var PC = cfg.PLAYER;

  var player = {
    mesh: null,
    pos: new THREE.Vector3(0, 0, 235),
    heading: Math.PI,
    health: PC.maxHealth,
    armor: 0,
    ammo: PC.pistolAmmoStart,
    state: "foot",
    car: null,
    speedNow: 0,
    attackCooldown: 0,
    sinceHurt: 99,
    swimBob: 0,
    dead: false,
    photoMode: false,
    parts: null
  };

  function buildMesh() {
    var group = new THREE.Group();
    var jacket = new THREE.MeshLambertMaterial({ color: 0xe2452c });
    var pants = new THREE.MeshLambertMaterial({ color: 0x24304a });
    var skin = new THREE.MeshLambertMaterial({ color: 0xc88a5a });
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.76, 0.36), jacket);
    torso.position.y = 1.08;
    group.add(torso);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.38), skin);
    head.position.y = 1.7;
    group.add(head);
    var cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.12, 0.44),
      new THREE.MeshLambertMaterial({ color: 0xffd166 })
    );
    cap.position.y = 1.94;
    group.add(cap);
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.26), pants);
    legL.position.set(-0.17, 0.37, 0);
    group.add(legL);
    var legR = legL.clone();
    legR.position.x = 0.17;
    group.add(legR);
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.64, 0.19), jacket);
    armL.position.set(-0.45, 1.08, 0);
    group.add(armL);
    var armR = armL.clone();
    armR.position.x = 0.45;
    group.add(armR);
    var gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.14, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x14161a })
    );
    gun.position.set(0.45, 0.95, -0.3);
    gun.visible = false;
    group.add(gun);
    player.parts = { legL: legL, legR: legR, armL: armL, armR: armR, gun: gun };
    return group;
  }

  function init(scene) {
    player.mesh = buildMesh();
    var spawn = window.SH.city.spawn;
    player.pos.set(spawn.x, 0, spawn.z);
    player.heading = spawn.heading;
    player.mesh.position.copy(player.pos);
    scene.add(player.mesh);
  }

  function isSwimming() {
    return player.pos.z > cfg.WORLD.beachZ + 26;
  }

  function hurt(amount, cause) {
    if (player.dead) {
      return;
    }
    var remaining = amount;
    if (player.armor > 0) {
      var absorbed = Math.min(player.armor, amount * 0.7);
      player.armor -= absorbed;
      remaining = amount - absorbed;
    }
    player.health -= remaining;
    player.sinceHurt = 0;
    if (player.health <= 0) {
      player.health = 0;
      player.dead = true;
      if (window.SH.economy) {
        window.SH.economy.onWasted(cause);
      }
    }
  }

  function heal(amount) {
    player.health = cfg.clamp(player.health + amount, 0, PC.maxHealth);
  }

  function addArmor(amount) {
    player.armor = cfg.clamp(player.armor + amount, 0, PC.maxArmor);
  }

  function respawn() {
    player.dead = false;
    player.health = PC.maxHealth * 0.7;
    player.armor = 0;
    player.state = "foot";
    player.car = null;
    player.pos.set(-60, 0, 120);
    player.heading = Math.PI;
    if (player.mesh) {
      player.mesh.visible = true;
    }
    if (window.SH.police) {
      window.SH.police.clearWanted("respawn");
    }
  }

  function tryEnterCar() {
    if (player.state === "car") {
      exitCar();
      return;
    }
    var car = window.SH.vehicles.nearestCar(player.pos, 4.2);
    if (car) {
      player.state = "car";
      player.car = car;
      car.driver = "player";
      if (window.SH.vehicles.playerCar !== car && car.isTraffic) {
        if (window.SH.police) {
          window.SH.police.reportCrime("theft", player.pos);
        }
      }
      player.mesh.visible = false;
      if (window.SH.audio) {
        window.SH.audio.sfx.door();
      }
    }
  }

  function exitCar() {
    if (player.state !== "car" || !player.car) {
      return;
    }
    var car = player.car;
    car.driver = null;
    player.car = null;
    player.state = "foot";
    player.pos.set(car.pos.x + 2.4, 0, car.pos.z);
    player.mesh.visible = true;
    player.mesh.position.copy(player.pos);
    if (window.SH.audio) {
      window.SH.audio.sfx.door();
    }
  }

  function meleeAttack() {
    if (player.attackCooldown > 0) {
      return;
    }
    player.attackCooldown = PC.meleeCooldown;
    if (window.SH.audio) {
      window.SH.audio.sfx.punch();
    }
    var target = window.SH.people.nearest(player.pos, PC.meleeRange + 0.6);
    if (target) {
      var fx = player.pos.x - Math.sin(player.heading) * 2;
      var fz = player.pos.z - Math.cos(player.heading) * 2;
      var d = cfg.dist2d(fx, fz, target.pos.x, target.pos.z);
      if (d < 3.4) {
        window.SH.people.hurt(target, PC.meleeDamage, player.pos);
      }
    }
    window.SH.people.scare(player.pos, 6);
  }

  function shoot() {
    if (player.attackCooldown > 0) {
      return;
    }
    if (player.ammo <= 0) {
      if (window.SH.hud) {
        window.SH.hud.toast("Out of ammo — visit a shop");
      }
      player.attackCooldown = 0.4;
      return;
    }
    player.attackCooldown = PC.pistolCooldown;
    player.ammo -= 1;
    if (window.SH.audio) {
      window.SH.audio.sfx.shot();
    }
    if (player.parts) {
      player.parts.gun.visible = true;
    }
    var fx = player.pos.x - Math.sin(player.heading);
    var fz = player.pos.z - Math.cos(player.heading);
    var target = window.SH.people.nearest({ x: fx, z: fz }, PC.pistolRange);
    if (target) {
      var along = (target.pos.x - player.pos.x) * -Math.sin(player.heading) +
        (target.pos.z - player.pos.z) * -Math.cos(player.heading);
      if (along > 0) {
        window.SH.people.hurt(target, PC.pistolDamage, player.pos);
      }
    }
    window.SH.people.scare(player.pos, 16);
    if (window.SH.police) {
      window.SH.police.reportCrime("shots", player.pos);
    }
  }

  function updateOnFoot(dt, input, cameraHeading) {
    var moveX = 0;
    var moveZ = 0;
    if (input.forward) { moveZ -= 1; }
    if (input.back) { moveZ += 1; }
    if (input.left) { moveX -= 1; }
    if (input.right) { moveX += 1; }
    var moving = moveX !== 0 || moveZ !== 0;
    var swimming = isSwimming();
    var speed = swimming ? PC.swimSpeed : (input.sprint ? PC.sprintSpeed : PC.walkSpeed);
    player.speedNow = moving ? speed : 0;
    if (moving) {
      var len = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= len;
      moveZ /= len;
      // Camera-relative movement: the camera looks along the
      // direction (-sin(yaw), -cos(yaw)), so forward on screen is
      // that vector and right is (cos(yaw), -sin(yaw)) rotated.
      var fwdX = -Math.sin(cameraHeading);
      var fwdZ = -Math.cos(cameraHeading);
      var rightX = -Math.sin(cameraHeading - Math.PI / 2);
      var rightZ = -Math.cos(cameraHeading - Math.PI / 2);
      var dirX = fwdX * -moveZ + rightX * moveX;
      var dirZ = fwdZ * -moveZ + rightZ * moveX;
      var dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
      dirX /= dirLen;
      dirZ /= dirLen;
      player.pos.x += dirX * speed * dt;
      player.pos.z += dirZ * speed * dt;
      // Face the movement direction using the vehicle convention:
      // forward is (-sin(heading), -cos(heading)).
      var wantHeading = Math.atan2(-dirX, -dirZ);
      player.heading = cfg.angleLerp(
        player.heading, wantHeading, dt * PC.turnRate * 2.4);
    }
    if (swimming) {
      player.swimBob += dt * 3;
      player.pos.y = -0.55 + Math.sin(player.swimBob) * 0.12;
    } else {
      player.pos.y = 0;
      window.SH.city.resolveCollision(player.pos, PC.radius);
    }
    var W = cfg.WORLD;
    player.pos.x = cfg.clamp(player.pos.x, -W.width / 2 - 60, W.width / 2 + 60);
    player.pos.z = cfg.clamp(player.pos.z, -W.depth / 2 - 40, W.beachZ + 190);
    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y = player.heading;
    animateLimbs(dt, moving);
    if (input.attack) {
      if (input.aim) {
        shoot();
      } else {
        meleeAttack();
      }
    }
  }

  var limbPhase = 0;
  function animateLimbs(dt, moving) {
    if (!player.parts) {
      return;
    }
    if (moving) {
      limbPhase += dt * (player.speedNow > PC.walkSpeed + 0.5 ? 11 : 7.5);
    }
    var swing = moving ? Math.sin(limbPhase) * 0.6 : 0;
    player.parts.legL.rotation.x = swing;
    player.parts.legR.rotation.x = -swing;
    player.parts.armL.rotation.x = -swing * 0.85;
    player.parts.armR.rotation.x = swing * 0.85;
    if (player.attackCooldown < PC.pistolCooldown - 0.35) {
      player.parts.gun.visible = false;
    }
  }

  function updateInCar(dt, input) {
    var car = player.car;
    if (!car) {
      player.state = "foot";
      return;
    }
    var carInput = {
      throttle: 0,
      steer: 0,
      handbrake: !!input.handbrake
    };
    if (input.forward) { carInput.throttle += 1; }
    if (input.back) { carInput.throttle -= 1; }
    if (input.left) { carInput.steer += 1; }
    if (input.right) { carInput.steer -= 1; }
    var speed = window.SH.vehicles.stepPlayerCar(car, carInput, dt);
    player.pos.copy(car.pos);
    player.heading = car.heading;
    player.speedNow = Math.abs(speed);
    if (window.SH.audio) {
      window.SH.audio.setEngine(speed / cfg.VEHICLE.maxSpeed, true);
    }
    if (Math.abs(speed) > 26 && window.SH.police) {
      window.SH.police.reportCrime("speeding", player.pos);
    }
  }

  function update(dt, input, cameraHeading) {
    if (player.dead) {
      return;
    }
    player.attackCooldown = Math.max(0, player.attackCooldown - dt);
    player.sinceHurt += dt;
    if (player.sinceHurt > PC.regenDelay && player.health > 0) {
      player.health = Math.min(PC.maxHealth, player.health + PC.regenRate * dt);
    }
    if (player.state === "car") {
      updateInCar(dt, input);
    } else {
      updateOnFoot(dt, input, cameraHeading || 0);
      if (window.SH.audio) {
        window.SH.audio.setEngine(0, false);
      }
    }
  }

  function focusPos() {
    if (player.state === "car" && player.car) {
      return player.car.pos;
    }
    return player.pos;
  }

  player.init = init;
  player.update = update;
  player.hurt = hurt;
  player.heal = heal;
  player.addArmor = addArmor;
  player.respawn = respawn;
  player.tryEnterCar = tryEnterCar;
  player.exitCar = exitCar;
  player.focusPos = focusPos;
  player.isSwimming = isSwimming;
  window.SH.player = player;
})();
