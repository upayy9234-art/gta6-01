// Solstice Heat - SBPD: wanted stars, pursuit AI, roadblocks,
// helicopter spotlight, bust meter and heat decay when hidden.
window.SH = window.SH || {};
(function (SH) {
  'use strict';
  var U = SH.U, C = SH.Config;
  var Po = { stars: 0, heat: 0, units: [], timer: 0, bust: 0, lastSeen: 99, heli: null, blocks: [] };
  SH.Police = Po;
  Po.reportCrime = function (kind, x, z, weight) {
    var witnessed = true;
    // Crimes are worth more heat when a unit or camera district sees them.
    Po.heat += weight * (kind === 'shots' || kind === 'assault' ? 1.2 : 1);
    var thresholds = [0.6, 1.8, 3.4, 5.4, 8];
    var s = 0; for (var i = 0; i < thresholds.length; i++) if (Po.heat >= thresholds[i]) s = i + 1;
    if (s > Po.stars) {
      Po.stars = s;
      if (SH.HUD) SH.HUD.radioChatter(s >= 3 ? 'Dispatch: all units, suspect escalating in ' + SH.City.districtNameAt(x, z) + '.' : 'Dispatch: units respond, suspect in ' + SH.City.districtNameAt(x, z) + '.');
    }
    Po.lastSeen = 0;
    return witnessed;
  };
  Po.setStars = function (n) { Po.stars = U.clamp(n, 0, 5); Po.heat = [0, 0.7, 1.9, 3.5, 5.5, 8.2][Po.stars]; };
  Po.clear = function () { Po.stars = 0; Po.heat = 0; Po.bust = 0; };
  Po.buildHeli = function (scene) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 5.2), new THREE.MeshLambertMaterial({ color: 0x223355 }));
    g.add(body);
    var tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.4), new THREE.MeshLambertMaterial({ color: 0x223355 }));
    tail.position.set(0, 0.3, -4.4); g.add(tail);
    var rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    rotor.position.y = 1.1; g.add(rotor); g.userData.rotor = rotor;
    var cone = new THREE.Mesh(new THREE.ConeGeometry(7, 26, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    cone.position.y = -13.5; g.add(cone);
    var spot = new THREE.Mesh(new THREE.CircleGeometry(6.6, 16), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22 }));
    spot.rotation.x = -Math.PI / 2; spot.position.y = -25.8; g.add(spot);
    g.visible = false; scene.add(g);
    Po.heli = g; Po.heliPos = { x: 0, z: 0 };
    return g;
  };
  function spawnUnit(scene, playerPos) {
    var ang = Math.random() * Math.PI * 2, dist = 55 + Math.random() * 25;
    var x = U.clamp(playerPos.x + Math.sin(ang) * dist, -420, 430);
    var z = U.clamp(playerPos.z + Math.cos(ang) * dist, -420, 420);
    var rp = SH.City.nearestRoadPoint(x, z);
    var car = SH.Vehicles.spawnPoliceCar(scene, rp.x + 3, rp.z);
    Po.units.push(car);
    return car;
  }
  function makeRoadblock(scene, playerPos) {
    Po.clearBlocks(scene);
    var rp = SH.City.nearestRoadPoint(playerPos.x, playerPos.z);
    for (var i = -1; i <= 1; i += 2) {
      var car = SH.Vehicles.spawnPoliceCar(scene, rp.x + i * 5, rp.z + 26);
      car.heading = Math.PI / 2; car.parked = true; car.ai.roadblock = true;
      Po.blocks.push(car);
    }
    if (SH.HUD) SH.HUD.radioChatter('Dispatch: roadblock set near ' + SH.City.districtNameAt(playerPos.x, playerPos.z) + '.');
  }
  Po.clearBlocks = function (scene) {
    Po.blocks.forEach(function (c) { SH.Vehicles.removeCar(scene, c); });
    Po.blocks = [];
  };
  Po.update = function (dt, scene, player) {
    var ppos = player.pos();
    Po.lastSeen += dt;
    // Can any unit see the player?
    var seen = Po.stars > 0 && Po.units.some(function (u) { return U.dist2d(u.x, u.z, ppos.x, ppos.z) < C.POLICE.sightRange; });
    if (player.car && Po.stars > 0) seen = seen || U.dist2d(ppos.x, ppos.z, ppos.x, ppos.z) >= 0 && Po.units.length > 0;
    if (seen) Po.lastSeen = 0;
    if (Po.lastSeen > C.POLICE.loseSightAfter && Po.stars > 0) {
      Po.heat = Math.max(0, Po.heat - C.POLICE.heatDecayPerSec * dt * 12);
      var thresholds = [0.6, 1.8, 3.4, 5.4, 8];
      var s = 0; for (var i = 0; i < thresholds.length; i++) if (Po.heat >= thresholds[i]) s = i + 1;
      if (s < Po.stars) { Po.stars = s; if (SH.HUD && s > 0) SH.HUD.radioChatter('Dispatch: losing the suspect, keep eyes open.'); }
    }
    // Spawn / despawn units to match wanted level.
    Po.timer -= dt;
    var want = C.POLICE.maxCarsByStars[Po.stars] || 0;
    if (Po.timer <= 0) {
      Po.timer = C.POLICE.spawnInterval;
      if (Po.units.length < want && Po.stars > 0) spawnUnit(scene, ppos);
    }
    while (Po.units.length > Math.max(want, 0) && Po.stars === 0) {
      var gone = Po.units.pop(); SH.Vehicles.removeCar(scene, gone);
    }
    if (Po.stars === 0 && Po.units.length) {
      // Stand down: units drive off and despawn far away.
      for (var k = Po.units.length - 1; k >= 0; k--) {
        var u0 = Po.units[k];
        if (U.dist2d(u0.x, u0.z, ppos.x, ppos.z) > 90) { SH.Vehicles.removeCar(scene, u0); Po.units.splice(k, 1); }
      }
    }
    // Pursuit driving: steer at the player, ram gently, avoid buildings.
    Po.units.forEach(function (u) {
      if (u.ai && u.ai.roadblock) { SH.Vehicles.syncMesh(u, dt); return; }
      var wantHeading = U.headingTo(u.x, u.z, ppos.x, ppos.z);
      u.heading = U.angleLerp(u.heading, wantHeading, U.clamp(dt * 2.2, 0, 1));
      var d = U.dist2d(u.x, u.z, ppos.x, ppos.z);
      var target = d > 12 ? u.model.topSpeed * 0.96 : (player.car ? Math.abs(player.car.speed) : 4);
      u.speed = U.damp(u.speed, target, 1.4, dt);
      var px = u.x, pz = u.z;
      u.x += Math.sin(u.heading) * u.speed * dt;
      u.z += Math.cos(u.heading) * u.speed * dt;
      if (SH.City.collide(u.x, u.z, 1.5)) { u.x = px; u.z = pz; u.heading += 0.7; u.speed *= 0.4; }
      if (d < 3.4 && player.car && Math.abs(u.speed) > 8) { SH.Vehicles.damageCar(player.car, 4); }
      SH.Vehicles.syncMesh(u, dt);
    });
    // Roadblocks at 3+ stars.
    if (Po.stars >= C.POLICE.roadblockStars && Po.blocks.length === 0 && Math.random() < dt * 0.05) makeRoadblock(scene, ppos);
    if (Po.stars < C.POLICE.roadblockStars && Po.blocks.length) Po.clearBlocks(scene);
    // Helicopter at 4+ stars.
    if (Po.heli) {
      var show = Po.stars >= C.POLICE.heliStars;
      Po.heli.visible = show;
      if (show) {
        Po.heliPos.x = U.damp(Po.heliPos.x, ppos.x, 1.2, dt);
        Po.heliPos.z = U.damp(Po.heliPos.z, ppos.z, 1.2, dt);
        Po.heli.position.set(Po.heliPos.x, 27, Po.heliPos.z);
        Po.heli.userData.rotor.rotation.y += dt * 28;
        Po.lastSeen = 0; // spotlight keeps eyes on the player
      }
    }
    // Bust meter: close unit + slow player.
    var nearUnit = Po.units.some(function (u) { return U.dist2d(u.x, u.z, ppos.x, ppos.z) < C.POLICE.bustRange; });
    var playerSpeed = player.car ? Math.abs(player.car.speed) : 4;
    if (Po.stars > 0 && nearUnit && playerSpeed < 5) {
      Po.bust += dt / C.PLAYER.bustTime;
      if (Po.bust >= 1 && SH.Main) SH.Main.onBusted();
    } else Po.bust = Math.max(0, Po.bust - dt * 1.4);
  };
  Po.nearestUnitDist = function (x, z) {
    var bd = 1e9;
    Po.units.forEach(function (u) { bd = Math.min(bd, U.dist2d(x, z, u.x, u.z)); });
    return bd;
  };
})(window.SH);
