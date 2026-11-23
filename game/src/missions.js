// Solstice Heat - story missions: a 10-mission chain for Marisol Vega,
// plus a 3-step guided onboarding. Objectives: go-to, chase, deliver,
// escort, survive. Light-pillar markers, dialogue, timers, checkpoints.
window.SH = window.SH || {};
(function (SH) {
  'use strict';
  var U = SH.U, C = SH.Config;
  var M = { active: null, idx: -1, step: 0, timer: 0, marker: null, onboard: 0, chaseCar: null };
  SH.Missions = M;
  var A = null; // anchors, set at init

  M.DEFS = [
    { title: 'Welcome to the Bay', giver: 'Marisol Vega', reward: 150, xp: 25, time: 0,
      dialog: [['Marisol', 'You must be the new driver everyone keeps almost hiring.'], ['You', 'I prefer fixer.'], ['Marisol', 'Fixers deliver. Take my convertible and bring it back in one piece.']],
      steps: [{ kind: 'goto', x: 88, z: 84, label: 'Reach the Downtown drop' }, { kind: 'goto', x: 92, z: -8, label: 'Return to Marisol' }] },
    { title: 'Cafecito Run', giver: 'Marisol Vega', reward: 180, xp: 30, time: 150,
      dialog: [['Marisol', 'The Deco Diner crew runs on cafecito. Move fast, keep it hot.']],
      steps: [{ kind: 'goto', x: -92, z: 12, label: 'Pick up at the diner' }, { kind: 'goto', x: 252, z: -168, label: 'Deliver to the Marina', timer: true }] },
    { title: 'Paper Trail', giver: 'Marisol Vega', reward: 220, xp: 35, time: 0,
      dialog: [['Marisol', 'A courier dropped a ledger in Old Town. Retrieve it before the tide of gossip does.']],
      steps: [{ kind: 'goto', x: -248, z: 168, label: 'Find the ledger in Old Town' }, { kind: 'goto', x: 92, z: -8, label: 'Bring the ledger back' }] },
    { title: 'Tail the Accountant', giver: 'Marisol Vega', reward: 300, xp: 45, time: 210,
      dialog: [['Marisol', 'Follow my accountant. Close enough to learn, far enough to stay a rumour.']],
      steps: [{ kind: 'chase', x: -88, z: -88, label: 'Tail the accountant across Downtown' }, { kind: 'goto', x: 92, z: -8, label: 'Report back to Marisol' }] },
    { title: 'Pier Pressure', giver: 'Marisol Vega', reward: 340, xp: 50, time: 200,
      dialog: [['Marisol', 'A crate lands at Portside tonight. Escort it to the Marina Pier.']],
      steps: [{ kind: 'goto', x: -328, z: -248, label: 'Collect the crate at Portside' }, { kind: 'goto', x: 470, z: -260, label: 'Escort the crate to Marina Pier' }] },
    { title: 'Neon Debts', giver: 'Marisol Vega', reward: 420, xp: 60, time: 0,
      dialog: [['Marisol', 'Three debtors on the Neon Mile. Visit each. Be persuasive, not loud.']],
      steps: [{ kind: 'goto', x: -8, z: 168, label: 'Debtor one: Neon Mile club' }, { kind: 'goto', x: 72, z: 248, label: 'Debtor two: arcade' }, { kind: 'goto', x: -88, z: 328, label: 'Debtor three: rooftop bar' }] },
    { title: 'Heat Wave', giver: 'Marisol Vega', reward: 500, xp: 70, time: 120,
      dialog: [['Marisol', 'The SBPD wants a word about everything. Survive their attention, then come home.']],
      steps: [{ kind: 'survive', dur: 45, label: 'Survive the heat (45s)' }, { kind: 'goto', x: 92, z: -8, label: 'Lay low at Marisol HQ' }] },
    { title: 'The Hills Have Eyes', giver: 'Marisol Vega', reward: 560, xp: 80, time: 240,
      dialog: [['Marisol', 'A client in The Hills needs a quiet pickup. No dents, no headlines.']],
      steps: [{ kind: 'goto', x: 168, z: 328, label: 'Pick up the client in The Hills' }, { kind: 'goto', x: -168, z: -168, label: 'Drop the client Downtown' }] },
    { title: 'Storm Cargo', giver: 'Marisol Vega', reward: 700, xp: 95, time: 260,
      dialog: [['Marisol', 'Storm rolling in, cargo rolling out. Portside to Boardwalk, whatever the sky does.']],
      steps: [{ kind: 'goto', x: -248, z: -328, label: 'Load cargo at the Portside cranes' }, { kind: 'goto', x: 328, z: 88, label: 'Deliver to the Boardwalk depot' }] },
    { title: 'The Crown Case', giver: 'Marisol Vega', reward: 1200, xp: 160, time: 300,
      dialog: [['Marisol', 'Last job, legend. The crown case goes to the end of Marina Pier at golden hour.'], ['You', 'And if the whole bay watches?'], ['Marisol', 'Then give them a show worth the sunset.']],
      steps: [{ kind: 'goto', x: 92, z: -8, label: 'Collect the crown case' }, { kind: 'goto', x: 535, z: -260, label: 'Deliver the crown case to Marina Pier' }] }
  ];

  M.init = function (scene) {
    A = SH.City.anchors;
    var geo = new THREE.CylinderGeometry(2.2, 2.2, 42, 12, 1, true);
    var mat = new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
    M.marker = new THREE.Mesh(geo, mat); M.marker.visible = false; M.marker.position.y = 21;
    scene.add(M.marker);
    M.scene = scene;
  };
  M.availableIdx = function () {
    for (var i = 0; i < M.DEFS.length; i++) if (SH.Economy.missionsDoneList.indexOf(i) < 0) return i;
    return -1;
  };
  M.startOnboarding = function () {
    M.onboard = 1;
    if (SH.HUD) { SH.HUD.tutorial('Welcome to Solstice Bay! Walk with WASD.'); SH.HUD.centerMsg('Onboarding: explore the Boardwalk', 3); }
  };
  M.start = function (idx) {
    if (M.active) return false;
    var def = M.DEFS[idx]; if (!def) return false;
    M.active = def; M.idx = idx; M.step = 0; M.timer = def.time || 0;
    M.surviveLeft = 0;
    if (SH.HUD) {
      SH.HUD.showDialog(def.dialog, def.giver);
      SH.HUD.centerMsg('Mission: ' + def.title, 2.6);
    }
    M.placeMarker();
    if (def.steps[0].kind === 'chase') M.spawnChase();
    if (def.steps[0].kind === 'survive') M.beginSurvive();
    return true;
  };
  M.spawnChase = function () {
    var s = M.active.steps[M.step];
    var car = SH.Vehicles.spawnPoliceCar; // not used; chase target is a civilian build below
    var meshCar = null;
    // Build a civilian target car through the vehicles factory path.
    var scene = M.scene;
    var target = (function () {
      var cars = SH.Vehicles.cars;
      return null;
    })();
    // Simpler: reuse traffic spawn by creating a dedicated car via Vehicles internals is not exposed,
    // so the chase target is represented by a moving marker car mesh built here.
    var grp = SH.Vehicles.buildCarMesh(SH.Config.CAR_MODELS[2], 0xff9f1c, false, false);
    grp.position.set(s.x, 0, s.z); scene.add(grp);
    M.chaseCar = { mesh: grp, x: s.x, z: s.z, heading: 0, speed: 11, wp: 0 };
    M.chaseWaypoints = [[-88, -88], [72, -88], [72, 72], [-88, 72], [-248, -88]];
  };
  M.beginSurvive = function () {
    M.surviveLeft = M.active.steps[M.step].dur || 45;
    SH.Police.setStars(3);
    if (SH.HUD) SH.HUD.radioChatter('Dispatch: heat wave authorised. All units converge.');
  };
  M.placeMarker = function () {
    if (!M.active) { if (M.marker) M.marker.visible = false; return; }
    var s = M.active.steps[M.step];
    M.marker.visible = true; M.marker.position.x = s.x; M.marker.position.z = s.z;
  };
  M.objective = function () {
    if (!M.active) return null;
    var s = M.active.steps[M.step];
    var p = SH.Player.pos();
    return { label: s.label, dist: Math.round(U.dist2d(p.x, p.z, s.x, s.z)), timer: (s.timer || M.active.time) ? M.timer : null, x: s.x, z: s.z };
  };
  M.fail = function (why) {
    if (SH.HUD) SH.HUD.centerMsg('Mission failed: ' + why, 2.6);
    M.cleanup(); M.active = null;
  };
  M.cleanup = function () {
    if (M.chaseCar) { M.scene.remove(M.chaseCar.mesh); M.chaseCar = null; }
    if (M.marker) M.marker.visible = false;
  };
  M.complete = function () {
    var def = M.active;
    SH.Economy.addCash(def.reward, def.title); SH.Economy.addXP(def.xp);
    SH.Economy.stats.missionsDone++; SH.Economy.missionsDoneList.push(M.idx);
    if (SH.HUD) SH.HUD.centerMsg('Mission complete: ' + def.title, 3);
    M.cleanup(); M.active = null; M.idx = -1;
    SH.Economy.save();
  };
  M.update = function (dt) {
    // Onboarding progression.
    if (M.onboard > 0 && SH.HUD) {
      var p0 = SH.Player.pos();
      if (M.onboard === 1 && U.dist2d(p0.x, p0.z, 300, 30) > 12) { /* walking counts */ M.onboard = 2; SH.HUD.tutorial('Press E near any car to get in. Steal something pastel.'); }
      else if (M.onboard === 2 && SH.Player.car) { M.onboard = 3; SH.HUD.tutorial('Drive to the gold pillar to start work for Marisol Vega.'); }
      else if (M.onboard === 3 && M.active) { M.onboard = 0; SH.HUD.tutorial(''); }
    }
    if (!M.active) {
      // Offer next mission when the player visits Marisol.
      var p = SH.Player.pos();
      var idx = M.availableIdx();
      if (idx >= 0 && U.dist2d(p.x, p.z, A.marisol.x, A.marisol.z) < 6 && !M._offered) {
        M._offered = true;
        if (SH.HUD) SH.HUD.contextPrompt('E - Talk to Marisol Vega (' + M.DEFS[idx].title + ')');
      } else if (idx < 0 || U.dist2d(p.x, p.z, A.marisol.x, A.marisol.z) >= 6) M._offered = false;
      return;
    }
    var def = M.active, s = def.steps[M.step], p = SH.Player.pos();
    if (def.time) { M.timer -= dt; if (M.timer <= 0) { M.fail('out of time'); return; } }
    if (s.kind === 'goto') {
      if (U.dist2d(p.x, p.z, s.x, s.z) < 7) M.advance();
    } else if (s.kind === 'survive') {
      M.surviveLeft -= dt;
      s.label = 'Survive the heat (' + Math.ceil(M.surviveLeft) + 's)';
      if (M.surviveLeft <= 0) { SH.Police.clear(); M.advance(); }
    } else if (s.kind === 'chase' && M.chaseCar) {
      var cc = M.chaseCar, wp = M.chaseWaypoints[cc.wp % M.chaseWaypoints.length];
      var want = U.headingTo(cc.x, cc.z, wp[0], wp[1]);
      cc.heading = U.angleLerp(cc.heading, want, U.clamp(dt * 2, 0, 1));
      cc.x += Math.sin(cc.heading) * cc.speed * dt; cc.z += Math.cos(cc.heading) * cc.speed * dt;
      if (U.dist2d(cc.x, cc.z, wp[0], wp[1]) < 8) cc.wp++;
      cc.mesh.position.set(cc.x, 0, cc.z); cc.mesh.rotation.y = cc.heading;
      var d = U.dist2d(p.x, p.z, cc.x, cc.z);
      s.x = cc.x; s.z = cc.z; M.marker.position.x = cc.x; M.marker.position.z = cc.z;
      if (d < 9) { M.tailing = (M.tailing || 0) + dt; s.label = 'Tailing... ' + Math.floor(M.tailing) + '/12s - stay close'; if (M.tailing >= 12) M.advance(); }
      else if (d > 60) { M.tailing = 0; s.label = 'You lost him - get closer'; }
      else s.label = 'Tail the accountant - stay within 60m';
    }
  };
  M.advance = function () {
    M.step++; M.tailing = 0;
    if (M.step >= M.active.steps.length) { M.complete(); return; }
    var s = M.active.steps[M.step];
    if (s.kind === 'chase') M.spawnChase();
    if (s.kind === 'survive') M.beginSurvive();
    M.placeMarker();
    if (SH.Audio) SH.Audio.blip();
  };
  M.interact = function () {
    if (M.active) return false;
    var p = SH.Player.pos(), idx = M.availableIdx();
    if (idx >= 0 && U.dist2d(p.x, p.z, A.marisol.x, A.marisol.z) < 7) { M.start(idx); return true; }
    return false;
  };
})(window.SH);
