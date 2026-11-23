// Solstice Heat: Neon Tide — player.js
// Jax Marlowe: on-foot controller, swim, third-person camera, combat, interaction.
window.SH = window.SH || {};
SH.player = (function () {
  'use strict';
  var R = SH.random;
  var P = {
    mesh: null, x: -52, z: 224, heading: 0, vy: 0,
    health: 100, armour: 0, ammo: 60, inCar: null, inBoat: null,
    speedNow: 0, phase: 0, attackCd: 0, dead: false, swimming: false,
    camYaw: 0, camPitch: 0.32, camDist: 8, interactTarget: null
  };
  var muzzle = null, muzzleT = 0;
  function lam(c) { return new THREE.MeshLambertMaterial({ color: c }); }
  function buildMesh(scene) {
    var grp = new THREE.Group();
    var jacket = lam(0xff6b35), skin = lam(0xc68642), pants = lam(0x1d3557);
    var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.8, 8), jacket); torso.position.y = 1.08; grp.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin); head.position.y = 1.72; grp.add(head);
    var hair = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 6, 0, Math.PI * 2, 0, 1.4), lam(0x1a1210)); hair.position.y = 1.76; grp.add(hair);
    function limb(mat, w, l) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, l, w), mat); m.geometry.translate(0, -l / 2, 0); return m; }
    var armL = limb(jacket, 0.14, 0.64); armL.position.set(-0.4, 1.42, 0); grp.add(armL);
    var armR = limb(jacket, 0.14, 0.64); armR.position.set(0.4, 1.42, 0); grp.add(armR);
    var legL = limb(pants, 0.17, 0.72); legL.position.set(-0.15, 0.74, 0); grp.add(legL);
    var legR = limb(pants, 0.17, 0.72); legR.position.set(0.15, 0.74, 0); grp.add(legR);
    var gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.42), lam(0x15181d));
    gun.position.set(0, -0.6, -0.18); armR.add(gun); gun.name = 'gun'; gun.visible = false;
    muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffdd66 }));
    muzzle.position.set(0.4, 0.85, -0.9); muzzle.visible = false; grp.add(muzzle);
    grp.userData = { armL: armL, armR: armR, legL: legL, legR: legR, gun: gun };
    grp.position.set(P.x, 0, P.z);
    scene.add(grp);
    P.mesh = grp;
  }
  function currentVehicle() { return P.inCar || P.inBoat; }
  function pos() {
    var v = currentVehicle();
    if (v) return { x: v.x, z: v.z, heading: v.heading };
    return { x: P.x, z: P.z, heading: P.heading };
  }
  function enterVehicle(rec) {
    if (!rec) return false;
    if (rec.isBoat) P.inBoat = rec; else P.inCar = rec;
    rec.occupied = true; rec.parked = false; rec.traffic = false;
    if (P.mesh) P.mesh.visible = false;
    SH.audio.tone(320, 0.08, 'square', 0.1);
    if (!rec.isBoat && rec.damage < 100) SH.police.reportCrime('theft', rec.x, rec.z, rec.wasParkedByTraffic ? 0 : 0.25);
    return true;
  }
  function exitVehicle() {
    var v = currentVehicle(); if (!v) return;
    v.occupied = false;
    P.x = v.x + Math.cos(v.heading) * 2.4; P.z = v.z - Math.sin(v.heading) * 2.4;
    var corr = SH.city.collide(P.x, P.z, 0.5); P.x = corr.x; P.z = corr.z;
    P.inCar = null; P.inBoat = null;
    if (P.mesh) { P.mesh.visible = true; P.mesh.position.set(P.x, SH.city.groundY(P.x, P.z), P.z); }
    v.speed *= 0.4;
  }
  function hurt(amount, cause) {
    if (P.dead) return;
    var absorbed = Math.min(P.armour, amount * 0.7);
    P.armour -= absorbed; P.health -= (amount - absorbed);
    SH.effects.shake(0.25); SH.hud.flashDamage();
    if (P.health <= 0) { P.health = 0; P.dead = true; SH.state.gameState = 'wasted'; SH.hud.showEnd('WASTED', cause || 'You flatlined on the streets of Solstice Bay.'); SH.economy.onWasted(); }
  }
  function heal(v) { P.health = Math.min(100, P.health + v); }
  function shoot(dt) {
    if (P.attackCd > 0) return;
    var v = currentVehicle();
    if (v) return;
    P.attackCd = 0.16;
    var u = P.mesh.userData; u.gun.visible = true;
    if (P.ammo <= 0) { SH.audio.click(); SH.hud.toast('Out of ammo — buy more at a shop'); P.attackCd = 0.4; return; }
    P.ammo--;
    SH.audio.gunshot();
    muzzle.visible = true; muzzleT = 0.05;
    SH.effects.burst(P.x - Math.sin(P.heading) * 1.1, 1.35, P.z - Math.cos(P.heading) * 1.1, 'spark', 3);
    SH.pedestrians.scare(P.x, P.z, 20);
    SH.police.reportCrime('gunfire', P.x, P.z, 0.8);
    // hitscan forward
    var fx = -Math.sin(P.heading), fz = -Math.cos(P.heading);
    var bestT = 26, hitPed = null, hitCar = null;
    SH.pedestrians.list().forEach(function (pd) {
      if (pd.dead) return;
      var rx = pd.x - P.x, rz = pd.z - P.z;
      var t = rx * fx + rz * fz;
      if (t > 0 && t < bestT) { var px = rx - fx * t, pz = rz - fz * t; if (px * px + pz * pz < 0.8) { bestT = t; hitPed = pd; hitCar = null; } }
    });
    SH.vehicles.list().forEach(function (c) {
      var rx = c.x - P.x, rz = c.z - P.z;
      var t = rx * fx + rz * fz;
      if (t > 0 && t < bestT + 2) { var px = rx - fx * t, pz = rz - fz * t; if (px * px + pz * pz < 5.5) { hitCar = c; hitPed = null; bestT = t; } }
    });
    if (hitPed) SH.pedestrians.hitPed(hitPed, 55, true);
    if (hitCar) { SH.vehicles.damageCar(hitCar, 9, true); if (hitCar.isPolice) SH.police.reportCrime('copshot', P.x, P.z, 1); }
    if (!hitPed && !hitCar) {
      var wall = SH.city.hitsBuilding(P.x + fx * bestT, P.z + fz * bestT, 0.5);
      if (wall) SH.effects.burst(P.x + fx * bestT, 1.4, P.z + fz * bestT, 'spark', 4);
    }
  }
  function melee() {
    if (P.attackCd > 0) return;
    P.attackCd = 0.35;
    SH.audio.melee();
    var u = P.mesh.userData; u.armR.rotation.x = -1.9;
    var pd = SH.pedestrians.nearestPed(P.x - Math.sin(P.heading) * 1.2, P.z - Math.cos(P.heading) * 1.2, 1.8);
    if (pd) { SH.pedestrians.hitPed(pd, 34, true); SH.police.reportCrime('assault', P.x, P.z, 0.6); }
  }
  function update(dt, camera) {
    P.attackCd = Math.max(0, P.attackCd - dt);
    muzzleT -= dt; if (muzzle && muzzleT <= 0) muzzle.visible = false;
    var v = currentVehicle();
    if (v) { updateDriving(dt, v); updateCamera(dt, camera, v.x, v.z, v.heading, true); return; }
    // mouse orbit
    P.camYaw -= SH.input.mouse.dx * 0.004;
    P.camPitch = R.clamp(P.camPitch + SH.input.mouse.dy * 0.003, 0.05, 1.1);
    var ix = 0, iz = 0;
    if (SH.input.forward()) iz += 1; if (SH.input.back()) iz -= 1;
    if (SH.input.left()) ix -= 1; if (SH.input.right()) ix += 1;
    var moving = (ix !== 0 || iz !== 0);
    P.swimming = SH.city.isWater(P.x, P.z);
    var spd = P.swimming ? 2.6 : (SH.input.sprint() ? 7.2 : 4.2);
    if (moving) {
      var moveAng = P.camYaw + Math.PI + Math.atan2(ix, iz);
      P.heading = R.angleLerp(P.heading, moveAng + Math.PI, dt * 12);
      P.x += Math.sin(moveAng) * spd * dt;
      P.z += Math.cos(moveAng) * spd * dt;
      P.phase += dt * spd * 1.9;
    }
    P.x = R.clamp(P.x, -460, 460); P.z = R.clamp(P.z, -420, 740);
    if (!P.swimming) { var corr = SH.city.collide(P.x, P.z, 0.45); P.x = corr.x; P.z = corr.z; }
    P.speedNow = moving ? spd : 0;
    var u = P.mesh.userData;
    var sw = moving ? Math.sin(P.phase) * 0.6 : 0;
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
    u.armL.rotation.x = -sw * 0.75;
    if (P.attackCd < 0.2) u.armR.rotation.x = SH.input.actionHeld() ? -1.35 : sw * 0.75;
    u.gun.visible = SH.input.actionHeld() || P.attackCd > 0.05;
    P.mesh.position.set(P.x, SH.city.groundY(P.x, P.z) + (P.swimming ? -0.75 : 0), P.z);
    P.mesh.rotation.y = P.heading;
    if (SH.input.actionPressed() || (SH.input.mouse.clicked && !v)) {
      // F = melee when close to a ped, otherwise fire pistol
      var near = SH.pedestrians.nearestPed(P.x, P.z, 2.0);
      if (SH.input.wasPressed('KeyF') && near) melee(); else shoot(dt);
    }
    if (P.swimming && Math.random() < dt * 2) SH.effects.burst(P.x, 0.1, P.z, 'splash', 1);
    updateCamera(dt, camera, P.x, P.z, P.heading, false);
    regen(dt);
  }
  var regenT = 0;
  function regen(dt) {
    regenT += dt;
    if (regenT > 5) { regenT = 0; if (P.health > 0 && P.health < 40 && SH.police.wanted === 0) heal(2); }
    if (P.health < 100 && SH.city.districtAt(P.x, P.z).name === 'Marina' && Math.random() < dt * 0.1) heal(1 * dt * 10);
  }
  function updateDriving(dt, v) {
    var throttle = 0, steer = 0;
    if (SH.shotDrive) { throttle = SH.shotDrive.throttle; steer = SH.shotDrive.steer; }
    if (SH.input.forward()) throttle = 1;
    if (SH.input.back()) throttle = -1;
    if (SH.input.left()) steer = 1;
    if (SH.input.right()) steer = -1;
    var brake = false;
    SH.vehicles.stepCar(v, dt, throttle, steer, brake, SH.input.handbrake());
    SH.audio.setEngine(Math.abs(v.speed) / v.spec.top, true);
    SH.audio.updateRadio(dt, true);
    if (SH.input.radioPressed()) SH.hud.toast('Radio: ' + SH.audio.cycleStation());
    P.speedNow = Math.abs(v.speed);
    if (Math.abs(v.speed) > 20) SH.police.reportCrime('reckless', v.x, v.z, dt * 0.25);
    if (SH.input.reloadPressed() && v.damage > 0 && Math.abs(v.speed) < 1) { /* R reserved: flip/reset */ v.heading += 0; v.mesh.rotation.z = 0; }
    // collisions with peds while driving
    if (Math.abs(v.speed) > 5) {
      var pd = SH.pedestrians.nearestPed(v.x, v.z, 2.4);
      if (pd) { SH.pedestrians.hitPed(pd, Math.abs(v.speed) * 2.4, true); SH.audio.crash(6); }
    }
  }
  function updateCamera(dt, camera, tx, tz, theading, driving) {
    var dist = driving ? 10.5 : P.camDist;
    if (driving) P.camYaw = R.angleLerp(P.camYaw, theading, dt * 2.2);
    var yaw = P.camYaw;
    var pitch = driving ? 0.30 : P.camPitch;
    var cx = tx + Math.sin(yaw) * Math.cos(pitch) * dist;
    var cz = tz + Math.cos(yaw) * Math.cos(pitch) * dist;
    var cy = 2 + Math.sin(pitch) * dist;
    if (!SH.city.isWater(cx, cz)) { var corr = SH.city.collide(cx, cz, 0.6); cx = corr.x; cz = corr.z; }
    var gy = SH.city.groundY(cx, cz);
    if (cy < gy + 1.1) cy = gy + 1.1;
    var k = 1 - Math.pow(0.0001, dt); // smooth
    camera.position.x = R.lerp(camera.position.x, cx, Math.min(1, k));
    camera.position.y = R.lerp(camera.position.y, cy, Math.min(1, k));
    camera.position.z = R.lerp(camera.position.z, cz, Math.min(1, k));
    camera.lookAt(tx, 1.6, tz);
    if (SH.effects.getShake() > 0) {
      var s = SH.effects.getShake();
      camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s;
    }
  }
  function teleport(x, z, heading) {
    var v = currentVehicle();
    if (v) { v.x = x; v.z = z; v.heading = heading || 0; v.speed = 0; v.mesh.position.set(x, SH.city.groundY(x, z), z); }
    P.x = x; P.z = z; P.heading = heading || 0;
    if (P.mesh) P.mesh.position.set(x, SH.city.groundY(x, z), z);
  }
  return {
    data: P, buildMesh: buildMesh, update: update, pos: pos,
    currentVehicle: currentVehicle, enterVehicle: enterVehicle, exitVehicle: exitVehicle,
    hurt: hurt, heal: heal, teleport: teleport, shoot: shoot, melee: melee
  };
})();
