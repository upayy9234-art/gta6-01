// Solstice Heat - activities (new in Round 12): 30 hidden shells,
// 8 stunt ramps live in races.js, 6 postcard photo spots, and a roaming
// time-trial beacon. Progress persists through the economy save.
window.SH = window.SH || {};
(function (SH) {
  'use strict';
  var U = SH.U, C = SH.Config;
  var Ac = { shells: [], cards: [], beacon: null, beaconTimer: 0, beaconLeft: 0 };
  SH.Activities = Ac;
  Ac.init = function (scene, rng) {
    Ac.scene = scene;
    var shellMat = new THREE.MeshBasicMaterial({ color: 0xffe9f4 });
    var shellGeo = new THREE.SphereGeometry(0.55, 8, 6);
    var spots = [];
    // Shells hug the beach and pier, with a few hidden inland.
    for (var i = 0; i < C.SHELL_COUNT; i++) {
      var x, z;
      if (i < 20) { x = rng.range(340, 430); z = rng.range(-420, 420); }
      else if (i < 25) { x = rng.range(410, 530); z = -260 + rng.range(-6, 6); }
      else { var rp = SH.City.nearestRoadPoint(rng.range(-380, 300), rng.range(-380, 380)); x = rp.x + 12; z = rp.z + rng.range(-30, 30); }
      spots.push([x, z]);
    }
    spots.forEach(function (s, i) {
      var m = new THREE.Mesh(shellGeo, shellMat);
      m.position.set(s[0], 0.7, s[1]); m.scale.y = 0.6; scene.add(m);
      var found = SH.Economy.shellsFound.indexOf(i) >= 0;
      m.visible = !found;
      Ac.shells.push({ mesh: m, x: s[0], z: s[1], idx: i, found: found });
    });
    Ac.shellCount = function () { return Ac.shells.filter(function (s) { return s.found; }).length; };
    // Postcard spots: glowing rings at scenic viewpoints.
    var cardSpots = [[430, 30, 'Boardwalk Sunset'], [535, -260, 'Marina Pier End'], [88, 328, 'Hills Overlook'], [-168, 168, 'Old Town Arch'], [8, -328, 'South Beach'], [328, -168, 'Marina Lights']];
    var ringGeo = new THREE.RingGeometry(1.6, 2.1, 20);
    cardSpots.forEach(function (s, i) {
      var ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x7cff4d, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(s[0], 0.15, s[1]); scene.add(ring);
      Ac.cards.push({ mesh: ring, x: s[0], z: s[1], name: s[2], idx: i, found: SH.Economy.postcardsFound.indexOf(i) >= 0 });
    });
    // Roaming time-trial beacon.
    var bGeo = new THREE.CylinderGeometry(2.4, 2.4, 36, 12, 1, true);
    Ac.beacon = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({ color: 0xb44dff, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    Ac.beacon.position.y = 18; Ac.beacon.visible = false; scene.add(Ac.beacon);
    Ac.beaconAt = null;
  };
  Ac.update = function (dt) {
    var p = SH.Player.pos(), t = performance.now() / 1000;
    for (var i = 0; i < Ac.shells.length; i++) {
      var s = Ac.shells[i];
      if (s.found) continue;
      s.mesh.position.y = 0.7 + Math.sin(t * 2 + i) * 0.15;
      s.mesh.rotation.y = t + i;
      if (U.dist2d(p.x, p.z, s.x, s.z) < 2.6) {
        s.found = true; s.mesh.visible = false;
        SH.Economy.shellsFound.push(s.idx);
        var n = Ac.shellCount();
        SH.Economy.stats.shells = n;
        if (SH.Audio) SH.Audio.collect();
        if (SH.HUD) SH.HUD.centerMsg('Shell found! ' + n + '/' + C.SHELL_COUNT, 1.8);
        if (n % C.SHELL_REWARD_EVERY === 0) SH.Economy.addCash(C.SHELL_REWARD, 'Shell bonus');
        SH.Economy.addXP(4); SH.Economy.save();
      }
    }
    for (var j = 0; j < Ac.cards.length; j++) {
      var cd = Ac.cards[j];
      cd.mesh.rotation.z = t * 0.4;
      if (!cd.found && U.dist2d(p.x, p.z, cd.x, cd.z) < 2.6) {
        cd.found = true; SH.Economy.postcardsFound.push(cd.idx); SH.Economy.stats.postcards++;
        SH.Economy.addCash(C.POSTCARD_REWARD, 'Postcard: ' + cd.name); SH.Economy.addXP(12);
        if (SH.HUD) SH.HUD.centerMsg('Postcard collected: ' + cd.name, 2.4);
        if (SH.Audio) SH.Audio.collect();
        SH.Economy.save();
      }
    }
    // Beacon cycle: appear, give the player 45s to reach it, repeat.
    Ac.beaconTimer -= dt;
    if (!Ac.beaconAt && Ac.beaconTimer <= 0) {
      var rp = SH.City.nearestRoadPoint(-380 + Math.random() * 680, -380 + Math.random() * 760);
      Ac.beaconAt = { x: rp.x + 4, z: rp.z + 4 };
      Ac.beacon.position.x = Ac.beaconAt.x; Ac.beacon.position.z = Ac.beaconAt.z;
      Ac.beacon.visible = true; Ac.beaconLeft = 45;
      if (SH.HUD) SH.HUD.centerMsg('Time-trial beacon appeared! Check the minimap.', 2.2);
    }
    if (Ac.beaconAt) {
      Ac.beaconLeft -= dt;
      if (U.dist2d(p.x, p.z, Ac.beaconAt.x, Ac.beaconAt.z) < 6) {
        SH.Economy.addCash(150, 'Beacon trial'); SH.Economy.addXP(15);
        if (SH.HUD) SH.HUD.centerMsg('Beacon reached with ' + Math.ceil(Ac.beaconLeft) + 's to spare!', 2.2);
        Ac.beaconAt = null; Ac.beacon.visible = false; Ac.beaconTimer = 35;
      } else if (Ac.beaconLeft <= 0) {
        Ac.beaconAt = null; Ac.beacon.visible = false; Ac.beaconTimer = 20;
      }
    }
  };
})(window.SH);
