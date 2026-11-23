// Solstice Heat - side jobs from the city job board: taxi, courier,
// checkpoint rush, VIP ride, tow truck and paramedic runs.
window.SH = window.SH || {};
(function (SH) {
  'use strict';
  var U = SH.U, C = SH.Config;
  var J = { active: null, board: [], marker: null, refresh: 0 };
  SH.Jobs = J;
  var KINDS = [
    { id: 'taxi', name: 'Taxi Fare', desc: 'Pick up a passenger and drop them off.', base: 60 },
    { id: 'courier', name: 'Courier Run', desc: 'Deliver a package against the clock.', base: 80 },
    { id: 'rush', name: 'Checkpoint Rush', desc: 'Hit checkpoints before time runs out.', base: 90 },
    { id: 'vip', name: 'VIP Ride', desc: 'Drive a VIP smoothly - no crashes.', base: 140 },
    { id: 'tow', name: 'Tow Job', desc: 'Collect a broken-down car and tow it to the shop.', base: 110 },
    { id: 'medic', name: 'Paramedic', desc: 'Pick up a patient and reach the hospital.', base: 120 }
  ];
  var SPOTS = [[248, 88], [-168, 168], [88, -248], [-248, -88], [168, 248], [-88, -328], [328, -168], [-328, 88], [8, 328], [248, -328]];
  J.init = function (scene, rng) {
    J.rng = rng; J.scene = scene;
    var geo = new THREE.CylinderGeometry(1.8, 1.8, 34, 12, 1, true);
    var mat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
    J.marker = new THREE.Mesh(geo, mat); J.marker.visible = false; J.marker.position.y = 17; scene.add(J.marker);
    J.rollBoard();
  };
  J.rollBoard = function () {
    J.board = [];
    var shuffled = J.rng.shuffle(KINDS);
    for (var i = 0; i < 4; i++) {
      var k = shuffled[i % shuffled.length];
      var from = SPOTS[J.rng.int(0, SPOTS.length - 1)], to = SPOTS[J.rng.int(0, SPOTS.length - 1)];
      J.board.push({ kind: k.id, name: k.name, desc: k.desc, base: k.base, fx: from[0], fz: from[1], tx: to[0], tz: to[1], dist: Math.round(U.dist2d(from[0], from[1], to[0], to[1])) });
    }
  };
  J.start = function (job) {
    if (J.active) return false;
    J.active = { def: job, phase: 'pickup', timer: 60 + job.dist * 0.22, crashesAtStart: SH.Player.car ? SH.Player.car.damage : 0, checkpoints: null, cpIdx: 0 };
    if (job.kind === 'rush') {
      J.active.checkpoints = [];
      for (var i = 0; i < 5; i++) { var s = SPOTS[J.rng.int(0, SPOTS.length - 1)]; J.active.checkpoints.push(s); }
      J.active.timer = 100;
    }
    J.placeMarker();
    if (SH.HUD) SH.HUD.centerMsg('Job started: ' + job.name, 2.2);
    return true;
  };
  J.placeMarker = function () {
    if (!J.active) { J.marker.visible = false; return; }
    var t = J.target();
    J.marker.visible = true; J.marker.position.x = t.x; J.marker.position.z = t.z;
  };
  J.target = function () {
    var a = J.active, d = a.def;
    if (a.phase === 'pickup') return { x: d.fx, z: d.fz, label: 'Pick up: ' + d.name };
    if (d.kind === 'rush' && a.checkpoints) { var cp = a.checkpoints[a.cpIdx]; return { x: cp[0], z: cp[1], label: 'Checkpoint ' + (a.cpIdx + 1) + '/5' }; }
    if (d.kind === 'medic' && a.phase === 'dropoff') return { x: SH.City.anchors.hospital.x, z: SH.City.anchors.hospital.z, label: 'Reach the hospital' };
    if (d.kind === 'tow' && a.phase === 'dropoff') return { x: SH.City.anchors.shop.x, z: SH.City.anchors.shop.z, label: 'Tow the car to the shop' };
    return { x: d.tx, z: d.tz, label: 'Drop off: ' + d.name };
  };
  J.objective = function () {
    if (!J.active) return null;
    var t = J.target(), p = SH.Player.pos();
    return { label: t.label, dist: Math.round(U.dist2d(p.x, p.z, t.x, t.z)), timer: J.active.timer, x: t.x, z: t.z, job: true };
  };
  J.finish = function () {
    var a = J.active, d = a.def;
    var pay = d.base + Math.round(d.dist * 0.35);
    if (d.kind === 'vip' && SH.Player.car && SH.Player.car.damage > a.crashesAtStart + 4) pay = Math.round(pay * 0.4);
    if (d.kind === 'rush') pay += 60;
    SH.Economy.addCash(pay, d.name); SH.Economy.addXP(18);
    SH.Economy.stats.jobsDone++;
    if (SH.HUD) SH.HUD.centerMsg('Job complete: ' + d.name, 2.4);
    J.active = null; J.marker.visible = false; J.rollBoard();
  };
  J.fail = function (why) {
    if (SH.HUD) SH.HUD.centerMsg('Job failed: ' + why, 2.2);
    J.active = null; J.marker.visible = false; J.rollBoard();
  };
  J.update = function (dt) {
    J.refresh -= dt;
    if (!J.active) return;
    var a = J.active;
    a.timer -= dt;
    if (a.timer <= 0) { J.fail('out of time'); return; }
    var t = J.target(), p = SH.Player.pos();
    if (U.dist2d(p.x, p.z, t.x, t.z) < 8) {
      if (a.def.kind === 'rush' && a.phase !== 'pickup') {
        a.cpIdx++; a.timer += 18;
        if (a.cpIdx >= a.checkpoints.length) { J.finish(); return; }
        J.placeMarker(); if (SH.Audio) SH.Audio.blip();
        return;
      }
      if (a.phase === 'pickup') {
        a.phase = 'dropoff';
        if (a.def.kind === 'rush') { a.phase = 'checkpoints'; }
        if (SH.HUD) SH.HUD.centerMsg(a.def.kind === 'medic' ? 'Patient aboard - go!' : 'Collected - deliver it!', 1.8);
        J.placeMarker();
      } else J.finish();
    }
  };
  J.nearBoard = function () {
    var p = SH.Player.pos(), b = SH.City.anchors.jobBoard;
    return U.dist2d(p.x, p.z, b.x, b.z) < 7;
  };
  J.cancel = function () { if (J.active) J.fail('cancelled'); };
})(window.SH);
