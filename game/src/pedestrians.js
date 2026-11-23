// Solstice Heat: Neon Tide — pedestrians.js
// Low-poly people: sidewalk wandering, fleeing danger, district-based density.
window.SH = window.SH || {};
SH.pedestrians = (function () {
  'use strict';
  var R = SH.random;
  var peds = [];
  var sceneRef = null;
  var SHIRTS = [0xff5964, 0xffe74c, 0x3fa7d6, 0x59cd90, 0xf1fa8c, 0xee6c4d, 0x9b5de5, 0xf15bb5, 0x00bbf9, 0xfefae0];
  var SKIN = [0xf1c27d, 0xe0ac69, 0x8d5524, 0xffdbac, 0xc68642];
  var PANTS = [0x2b2d42, 0x3a506b, 0x5c374c, 0x1c2541, 0x6d597a];
  function lam(c) { return new THREE.MeshLambertMaterial({ color: c }); }
  function buildPedMesh() {
    var grp = new THREE.Group();
    var shirt = lam(R.choice(SHIRTS)), skin = lam(R.choice(SKIN)), pants = lam(R.choice(PANTS));
    var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.75, 8), shirt);
    torso.position.y = 1.05; torso.name = 'torso'; grp.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
    head.position.y = 1.68; head.name = 'head'; grp.add(head);
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.1, 8), lam(R.choice(SHIRTS)));
    cap.position.y = 1.85; grp.add(cap);
    function limb(mat, w, l) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, l, w), mat); m.geometry.translate(0, -l / 2, 0); return m; }
    var armL = limb(shirt, 0.13, 0.62); armL.position.set(-0.38, 1.38, 0); grp.add(armL);
    var armR = limb(shirt, 0.13, 0.62); armR.position.set(0.38, 1.38, 0); grp.add(armR);
    var legL = limb(pants, 0.16, 0.68); legL.position.set(-0.14, 0.7, 0); grp.add(legL);
    var legR = limb(pants, 0.16, 0.68); legR.position.set(0.14, 0.7, 0); grp.add(legR);
    grp.userData = { armL: armL, armR: armR, legL: legL, legR: legR, head: head, torso: torso };
    return grp;
  }
  function makePed(x, z) {
    var mesh = buildPedMesh();
    mesh.position.set(x, SH.city.groundY(x, z), z);
    sceneRef.add(mesh);
    var ped = {
      mesh: mesh, x: x, z: z, heading: R.range(0, Math.PI * 2),
      speed: 0, walkSpeed: R.range(1.1, 1.9), phase: R.range(0, 6),
      state: 'wander', target: null, panic: 0, health: 100, dead: false, hitT: 0
    };
    mesh.userData.ped = ped;
    peds.push(ped); return ped;
  }
  function spawnWorld(scene, count) {
    sceneRef = scene;
    var spots = SH.city.spawnPeds;
    for (var i = 0; i < (count || 42); i++) {
      var s = spots[i % spots.length];
      makePed(s.x + R.range(-8, 8), s.z + R.range(-8, 8));
    }
    // beach crowd
    for (var b = 0; b < 8; b++) makePed(R.range(-300, 300), R.range(315, 345));
  }
  function pickTarget(ped) {
    var nx = ped.x + R.range(-46, 46), nz = ped.z + R.range(-46, 46);
    nx = R.clamp(nx, -430, 430); nz = R.clamp(nz, -420, 350);
    if (SH.city.isWater(nx, nz)) { nz = 250; }
    ped.target = { x: nx, z: nz };
  }
  function scare(x, z, radius) {
    peds.forEach(function (p) {
      if (!p.dead && R.dist2(p.x, p.z, x, z) < (radius || 16)) { p.state = 'flee'; p.panic = R.range(2, 4); p.fleeFrom = { x: x, z: z }; }
    });
  }
  function hitPed(ped, dmg, fx) {
    ped.health -= dmg; ped.hitT = 0.3;
    ped.mesh.userData.torso.material = lam(0xaa2233);
    if (fx) SH.effects.burst(ped.x, 1.2, ped.z, 'spark', 4);
    if (ped.health <= 0 && !ped.dead) {
      ped.dead = true; ped.mesh.rotation.x = -Math.PI / 2; ped.mesh.position.y = 0.25;
      SH.police.reportCrime('assault', ped.x, ped.z, 1);
    } else { scare(ped.x, ped.z, 14); }
  }
  function update(dt, playerPos) {
    var densityBoost = 0;
    void densityBoost;
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      if (p.dead) continue;
      var dP = playerPos ? R.dist2(p.x, p.z, playerPos.x, playerPos.z) : 999;
      if (dP > 240) continue;
      p.hitT = Math.max(0, p.hitT - dt);
      if (p.hitT === 0 && p.mesh.userData.torso.material.color.getHex() === 0xaa2233) p.mesh.userData.torso.material = lam(R.choice(SHIRTS));
      var moving = 0;
      if (p.state === 'flee') {
        p.panic -= dt;
        var away = Math.atan2(p.x - (p.fleeFrom ? p.fleeFrom.x : p.x), p.z - (p.fleeFrom ? p.fleeFrom.z : p.z));
        p.heading = R.angleLerp(p.heading, away, dt * 6);
        p.speed = 4.4; moving = 1;
        if (p.panic <= 0) p.state = 'wander';
      } else {
        if (!p.target || R.dist2(p.x, p.z, p.target.x, p.target.z) < 1.6) pickTarget(p);
        var want = Math.atan2(p.target.x - p.x, p.target.z - p.z);
        p.heading = R.angleLerp(p.heading, want, dt * 3);
        p.speed = p.walkSpeed; moving = 1;
        // dodge fast cars
        var cars = SH.vehicles.list();
        for (var ci = 0; ci < cars.length; ci++) {
          var c = cars[ci];
          if (Math.abs(c.speed) > 9 && R.dist2(p.x, p.z, c.x, c.z) < 6) { p.state = 'flee'; p.panic = 1.6; p.fleeFrom = { x: c.x, z: c.z }; SH.police.reportCrime('reckless', c.x, c.z, 0.3); break; }
        }
      }
      if (moving) {
        p.x += Math.sin(p.heading) * p.speed * dt;
        p.z += Math.cos(p.heading) * p.speed * dt;
        if (!p.state || p.state === 'wander') {
          var corr = SH.city.collide(p.x, p.z, 0.4); p.x = corr.x; p.z = corr.z;
        }
        p.phase += dt * p.speed * 3.4;
      }
      var u = p.mesh.userData;
      var sw = Math.sin(p.phase) * 0.55;
      u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
      u.armL.rotation.x = -sw * 0.8; u.armR.rotation.x = sw * 0.8;
      if (p.state === 'flee') { u.armL.rotation.x = 2.6; u.armR.rotation.x = 2.6; }
      p.mesh.position.set(p.x, SH.city.groundY(p.x, p.z), p.z);
      p.mesh.rotation.y = p.heading;
    }
  }
  function nearestPed(x, z, maxD) {
    var best = null, bd = maxD || 3;
    peds.forEach(function (p) { if (p.dead) return; var d = R.dist2(x, z, p.x, p.z); if (d < bd) { bd = d; best = p; } });
    return best;
  }
  return { spawnWorld: spawnWorld, makePed: makePed, update: update, scare: scare, hitPed: hitPed, nearestPed: nearestPed, list: function () { return peds; } };
})();
