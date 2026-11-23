// Solstice Heat - the player: a fixer in a Hawaiian shirt.
// On foot: walk/run, melee, pistol, swimming. In a car: hands off to
// vehicles.js physics. Health, respawn and building collision live here.
window.SH = window.SH || {};
(function (SH) {
  'use strict';
  var U = SH.U, C = SH.Config;
  var Pl = { x: 330, z: 30, heading: -Math.PI / 2, health: 100, ammo: C.PLAYER.pistolAmmoStart, car: null, swim: false, phase: 0, attackCd: 0, shirtIdx: 0 };
  SH.Player = Pl;
  Pl.build = function (scene) {
    var g = new THREE.Group();
    Pl.shirtMat = new THREE.MeshLambertMaterial({ color: C.SHIRT_COLORS[0] });
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.76, 0.36), Pl.shirtMat); torso.position.y = 1.1; g.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), new THREE.MeshLambertMaterial({ color: 0xf2c79b })); head.position.y = 1.76; g.add(head);
    var hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0xffe14d })); hat.position.y = 1.94; g.add(hat);
    function limb(mat, w, l) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, l, w), mat); m.geometry.translate(0, -l / 2, 0); return m; }
    var shorts = new THREE.MeshLambertMaterial({ color: 0x2266aa });
    Pl.armL = limb(Pl.shirtMat, 0.17, 0.64); Pl.armL.position.set(-0.42, 1.44, 0); g.add(Pl.armL);
    Pl.armR = limb(Pl.shirtMat, 0.17, 0.64); Pl.armR.position.set(0.42, 1.44, 0); g.add(Pl.armR);
    Pl.legL = limb(shorts, 0.21, 0.78); Pl.legL.position.set(-0.17, 0.78, 0); g.add(Pl.legL);
    Pl.legR = limb(shorts, 0.21, 0.78); Pl.legR.position.set(0.17, 0.78, 0); g.add(Pl.legR);
    Pl.gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.42), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    Pl.gun.position.set(0.42, 0.86, 0.3); Pl.gun.visible = false; g.add(Pl.gun);
    g.position.set(Pl.x, 0, Pl.z); scene.add(g);
    Pl.mesh = g;
    return Pl;
  };
  Pl.setShirt = function (idx) { Pl.shirtIdx = idx % C.SHIRT_COLORS.length; if (Pl.shirtMat) Pl.shirtMat.color.setHex(C.SHIRT_COLORS[Pl.shirtIdx]); };
  Pl.pos = function () { return Pl.car ? { x: Pl.car.x, z: Pl.car.z } : { x: Pl.x, z: Pl.z }; };
  Pl.enterCar = function (car) {
    Pl.car = car; car.isPlayer = true; car.parked = false;
    if (Pl.mesh) Pl.mesh.visible = false;
    if (SH.Audio) SH.Audio.door();
    if (car.model.police && SH.Police) SH.Police.reportCrime('theft', car.x, car.z, 1);
    else if (SH.Police) SH.Police.reportCrime('theft', car.x, car.z, 0.35);
  };
  Pl.exitCar = function () {
    if (!Pl.car) return;
    var car = Pl.car; car.isPlayer = false; Pl.car = null;
    Pl.x = car.x + Math.cos(car.heading) * 2.4; Pl.z = car.z - Math.sin(car.heading) * 2.4;
    Pl.heading = car.heading;
    if (Pl.mesh) { Pl.mesh.visible = true; Pl.mesh.position.set(Pl.x, 0, Pl.z); }
    if (SH.Audio) SH.Audio.door();
  };
  Pl.hurt = function (amt) {
    Pl.health -= amt;
    if (Pl.health <= 0) { Pl.health = 0; if (SH.Main) SH.Main.onWasted(); }
  };
  Pl.heal = function (amt) { Pl.health = U.clamp(Pl.health + amt, 0, C.PLAYER.maxHealth); };
  Pl.update = function (dt, input, camHeading) {
    Pl.attackCd = Math.max(0, Pl.attackCd - dt);
    if (Pl.car) { Pl.x = Pl.car.x; Pl.z = Pl.car.z; Pl.heading = Pl.car.heading; return; }
    var sp = input.run ? C.PLAYER.runSpeed : C.PLAYER.walkSpeed;
    Pl.swim = Pl.x > C.WATER_X + 6;
    if (Pl.swim) sp = C.PLAYER.swimSpeed;
    var mx = 0, mz = 0;
    if (input.up) { mx += Math.sin(camHeading); mz += Math.cos(camHeading); }
    if (input.down) { mx -= Math.sin(camHeading); mz -= Math.cos(camHeading); }
    if (input.left) { mx += Math.cos(camHeading); mz -= Math.sin(camHeading); }
    if (input.right) { mx -= Math.cos(camHeading); mz += Math.sin(camHeading); }
    var moving = (mx !== 0 || mz !== 0);
    if (moving) {
      var len = Math.sqrt(mx * mx + mz * mz); mx /= len; mz /= len;
      Pl.heading = U.angleLerp(Pl.heading, Math.atan2(mx, mz), U.clamp(dt * 12, 0, 1));
      var nx = Pl.x + mx * sp * dt, nz = Pl.z + mz * sp * dt;
      if (!SH.City.collide(nx, Pl.z, C.PLAYER.radius)) Pl.x = nx;
      if (!SH.City.collide(Pl.x, nz, C.PLAYER.radius)) Pl.z = nz;
      Pl.x = U.clamp(Pl.x, -440, 560); Pl.z = U.clamp(Pl.z, -440, 440);
      Pl.phase += dt * sp * 1.9;
      if (!Pl.swim && Math.random() < dt * 2.2 && SH.Audio) SH.Audio.step();
    }
    var sw = moving ? Math.sin(Pl.phase) * 0.6 : 0;
    if (Pl.legL) { Pl.legL.rotation.x = sw; Pl.legR.rotation.x = -sw; Pl.armL.rotation.x = -sw * 0.8; Pl.armR.rotation.x = sw * 0.8; }
    if (Pl.mesh) {
      Pl.mesh.position.set(Pl.x, Pl.swim ? -0.55 : 0, Pl.z);
      Pl.mesh.rotation.y = Pl.heading;
      Pl.gun.visible = !!input.aim;
    }
  };
  Pl.attack = function (aimHeading) {
    if (Pl.car || Pl.attackCd > 0) return;
    Pl.attackCd = 0.32;
    var px = Pl.x + Math.sin(aimHeading) * 1.6, pz = Pl.z + Math.cos(aimHeading) * 1.6;
    var ped = SH.People.nearest(px, pz, C.PLAYER.meleeRange);
    if (ped && ped.health > 0) {
      ped.health -= C.PLAYER.meleeDamage; ped.flee = 3;
      if (SH.Audio) SH.Audio.hit();
      if (SH.Police) SH.Police.reportCrime('assault', Pl.x, Pl.z, 0.8);
      return;
    }
    if (SH.Audio) SH.Audio.hit();
  };
  Pl.shoot = function (aimHeading) {
    if (Pl.car || Pl.attackCd > 0 || Pl.ammo <= 0) { if (Pl.ammo <= 0 && SH.HUD) SH.HUD.centerMsg('Out of ammo - visit the shop', 1.4); return; }
    Pl.attackCd = 0.24; Pl.ammo--;
    if (SH.Audio) SH.Audio.shot();
    var px = Pl.x + Math.sin(aimHeading) * 14, pz = Pl.z + Math.cos(aimHeading) * 14;
    var ped = SH.People.nearest(px, pz, 5);
    if (ped && ped.health > 0) { ped.health -= C.PLAYER.pistolDamage; ped.flee = 4; }
    var car = SH.Vehicles.nearestCar(px, pz, 5);
    if (car) SH.Vehicles.damageCar(car, 12);
    if (SH.Police) SH.Police.reportCrime('shots', Pl.x, Pl.z, 1);
    if (SH.People) SH.People.peds.forEach(function (p) { if (U.dist2d(p.x, p.z, Pl.x, Pl.z) < 18) p.flee = 3; });
  };
  Pl.respawn = function () {
    Pl.health = 100; Pl.car = null;
    Pl.x = SH.City.anchors.hospital.x + 14; Pl.z = SH.City.anchors.hospital.z;
    if (Pl.mesh) { Pl.mesh.visible = true; Pl.mesh.position.set(Pl.x, 0, Pl.z); }
  };
})(window.SH);
