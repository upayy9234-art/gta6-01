// Solstice Heat - pedestrians: simple articulated figures that stroll
// sidewalks, cross streets, sunbathe, and flee from danger.
window.SH = window.SH || {};
(function (SH) {
  'use strict';
  var U = SH.U, C = SH.Config;
  var P = { peds: [] };
  SH.People = P;
  var skinMats = [0xf2c79b, 0xc68863, 0x8d5524, 0xffdbac].map(function (c) { return new THREE.MeshLambertMaterial({ color: c }); });
  function buildPed(rng) {
    var g = new THREE.Group();
    var shirt = new THREE.MeshLambertMaterial({ color: rng.pick(C.SHIRT_COLORS) });
    var pants = new THREE.MeshLambertMaterial({ color: rng.pick([0x335577, 0x554433, 0xeeeeee, 0x223322]) });
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt); torso.position.y = 1.08; g.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 8), rng.pick(skinMats)); head.position.y = 1.72; g.add(head);
    function limb(mat, w, l) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, l, w), mat); m.geometry.translate(0, -l / 2, 0); return m; }
    var armL = limb(shirt, 0.16, 0.62); armL.position.set(-0.4, 1.4, 0); g.add(armL);
    var armR = limb(shirt, 0.16, 0.62); armR.position.set(0.4, 1.4, 0); g.add(armR);
    var legL = limb(pants, 0.2, 0.74); legL.position.set(-0.16, 0.74, 0); g.add(legL);
    var legR = limb(pants, 0.2, 0.74); legR.position.set(0.16, 0.74, 0); g.add(legR);
    g.userData = { armL: armL, armR: armR, legL: legL, legR: legR };
    return g;
  }
  P.spawn = function (scene, rng, count) {
    for (var i = 0; i < count; i++) {
      var mesh = buildPed(rng); scene.add(mesh);
      var onBeach = rng.chance(0.18);
      var ped = {
        mesh: mesh, x: 0, z: 0, heading: rng.range(0, Math.PI * 2),
        speed: rng.range(1.1, 2.1), phase: rng.range(0, 6), flee: 0,
        tx: 0, tz: 0, beach: onBeach, health: 30
      };
      if (onBeach) { ped.x = rng.range(345, 425); ped.z = rng.range(-400, 400); }
      else {
        var rx = rng.pick(SH.City.roadsX); ped.x = rx + rng.pick([-11, 11]); ped.z = rng.range(-400, 400);
      }
      ped.tx = ped.x; ped.tz = ped.z;
      mesh.position.set(ped.x, 0, ped.z);
      P.peds.push(ped);
    }
  };
  P.update = function (dt, danger) {
    for (var i = 0; i < P.peds.length; i++) {
      var p = P.peds[i];
      if (p.health <= 0) { p.mesh.rotation.x = Math.PI / 2; p.mesh.position.y = 0.25; continue; }
      if (danger && U.dist2d(p.x, p.z, danger.x, danger.z) < 16) p.flee = 2.5;
      var tx = p.tx, tz = p.tz, sp = p.speed;
      if (p.flee > 0) {
        p.flee -= dt; sp = 5.2;
        tx = p.x + (p.x - danger.x); tz = p.z + (p.z - danger.z);
      } else if (U.dist2d(p.x, p.z, tx, tz) < 2) {
        if (p.beach) { p.tx = 345 + Math.random() * 80; p.tz = -400 + Math.random() * 800; }
        else {
          var horiz = Math.random() < 0.5;
          p.tx = p.x + (horiz ? (Math.random() * 160 - 80) : 0);
          p.tz = p.z + (horiz ? 0 : (Math.random() * 160 - 80));
        }
      }
      var want = U.headingTo(p.x, p.z, tx, tz);
      p.heading = U.angleLerp(p.heading, want, U.clamp(dt * 5, 0, 1));
      p.x += Math.sin(p.heading) * sp * dt; p.z += Math.cos(p.heading) * sp * dt;
      if (!p.beach && SH.City.collide(p.x, p.z, 0.4)) { p.x -= Math.sin(p.heading) * sp * dt * 1.4; p.z -= Math.cos(p.heading) * sp * dt * 1.4; p.tx = p.x; p.tz = p.z; }
      p.phase += dt * sp * 2.6;
      var sw = Math.sin(p.phase) * 0.55;
      p.mesh.userData.legL.rotation.x = sw; p.mesh.userData.legR.rotation.x = -sw;
      p.mesh.userData.armL.rotation.x = -sw * 0.8; p.mesh.userData.armR.rotation.x = sw * 0.8;
      p.mesh.position.set(p.x, 0, p.z); p.mesh.rotation.y = p.heading;
    }
  };
  P.nearest = function (x, z, maxDist) {
    var best = null, bd = maxDist;
    for (var i = 0; i < P.peds.length; i++) { var d = U.dist2d(x, z, P.peds[i].x, P.peds[i].z); if (d < bd) { bd = d; best = P.peds[i]; } }
    return best;
  };
  P.hurtNear = function (x, z, radius, dmg) {
    var hit = 0;
    for (var i = 0; i < P.peds.length; i++) { if (U.dist2d(x, z, P.peds[i].x, P.peds[i].z) < radius && P.peds[i].health > 0) { P.peds[i].health -= dmg; hit++; } }
    return hit;
  };
})(window.SH);
