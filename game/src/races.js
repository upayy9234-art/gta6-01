// Solstice Heat - street races and stunt jumps (new in Round 12).
// Three checkpoint routes, three AI rivals with light rubber-banding,
// live positions, countdown starts, and eight judged stunt ramps.
window.SH = window.SH || {};
(function (SH) {
  'use strict';
  var U = SH.U, C = SH.Config;
  var R = { active: null, ramps: [], countdown: 0, slowmo: 0 };
  SH.Races = R;
  R.ROUTES = [
    { name: 'Boardwalk Sprint', laps: 1, reward: 1, cps: [[328, 8], [248, 88], [168, 168], [88, 248], [8, 328]] },
    { name: 'Downtown Circuit', laps: 1, reward: 1, cps: [[-8, -8], [-88, -88], [-168, -8], [-88, 72], [72, 72], [72, -88]] },
    { name: 'Bay Grand Tour', laps: 1, reward: 1.6, cps: [[248, -248], [88, -328], [-168, -248], [-328, -88], [-248, 88], [-88, 248], [88, 328], [248, 168]] }
  ];
  R.init = function (scene, rng) {
    R.scene = scene; R.rng = rng;
    var geo = new THREE.CylinderGeometry(3, 3, 30, 12, 1, true);
    var mat = new THREE.MeshBasicMaterial({ color: 0xff2e88, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    R.marker = new THREE.Mesh(geo, mat); R.marker.visible = false; R.marker.position.y = 15; scene.add(R.marker);
    // Stunt ramps: wedge meshes at fixed spots.
    var rampMat = new THREE.MeshLambertMaterial({ color: 0xff7a1a });
    var rampSpots = [[88, 40, 0], [-40, -120, 1], [180, 200, 2], [-200, 40, 3], [40, -280, 0], [-120, 280, 1], [280, -80, 2], [-300, -200, 3]];
    rampSpots.forEach(function (s, i) {
      var ramp = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 9), rampMat);
      ramp.position.set(s[0], 0.8, s[1]); ramp.rotation.x = -0.32; ramp.rotation.y = s[2] * Math.PI / 2;
      scene.add(ramp);
      R.ramps.push({ x: s[0], z: s[1], heading: s[2] * Math.PI / 2, done: false, idx: i });
    });
  };
  R.start = function (routeIdx) {
    if (R.active || !SH.Player.car) { if (SH.HUD) SH.HUD.centerMsg('You need a car to race', 1.6); return false; }
    var route = R.ROUTES[routeIdx];
    var start = route.cps[0];
    SH.Player.car.x = start[0]; SH.Player.car.z = start[1] + 14; SH.Player.car.speed = 0;
    R.rivals = [];
    for (var i = 0; i < 3; i++) {
      var mesh = SH.Vehicles.buildCarMesh(C.CAR_MODELS[2], C.CAR_COLORS[(i * 3 + 1) % C.CAR_COLORS.length], false, false);
      mesh.position.set(start[0] - 6 + i * 6, 0, start[1] + 22);
      R.scene.add(mesh);
      R.rivals.push({ mesh: mesh, x: start[0] - 6 + i * 6, z: start[1] + 22, heading: Math.PI, speed: 0, cp: 0, prog: 0, skill: 0.86 + i * 0.06 });
    }
    R.active = { route: route, cp: 0, time: 0, finished: false };
    R.countdown = 3.2;
    R.placeMarker();
    if (SH.HUD) SH.HUD.centerMsg('Race: ' + route.name + ' - get ready!', 2);
    return true;
  };
  R.placeMarker = function () {
    if (!R.active) { R.marker.visible = false; return; }
    var cp = R.active.route.cps[R.active.cp % R.active.route.cps.length];
    R.marker.visible = true; R.marker.position.x = cp[0]; R.marker.position.z = cp[1];
  };
  R.position = function () {
    if (!R.active) return 1;
    var p = SH.Player.pos();
    var myProg = R.active.cp * 1000 - U.dist2d(p.x, p.z, R.active.route.cps[R.active.cp % R.active.route.cps.length][0], R.active.route.cps[R.active.cp % R.active.route.cps.length][1]);
    var pos = 1;
    R.rivals.forEach(function (r) { if (r.prog > myProg) pos++; });
    return pos;
  };
  R.objective = function () {
    if (!R.active) return null;
    var cp = R.active.route.cps[R.active.cp % R.active.route.cps.length], p = SH.Player.pos();
    return { label: R.active.route.name + ' - Pos ' + R.position() + '/4 - CP ' + (R.active.cp + 1) + '/' + R.active.route.cps.length, dist: Math.round(U.dist2d(p.x, p.z, cp[0], cp[1])), timer: R.active.time, x: cp[0], z: cp[1], race: true };
  };
  R.finish = function () {
    var pos = R.position();
    var pay = Math.round(C.RACE_REWARDS[pos - 1] * R.active.route.reward);
    SH.Economy.addCash(pay, 'Race P' + pos); SH.Economy.addXP(C.RACE_XP[pos - 1]);
    if (pos === 1) SH.Economy.stats.racesWon++;
    if (SH.HUD) SH.HUD.centerMsg('Race finished P' + pos + ' - ' + U.fmtMoney(pay), 3.2);
    R.cleanup();
  };
  R.cleanup = function () {
    if (R.rivals) R.rivals.forEach(function (r) { R.scene.remove(r.mesh); });
    R.rivals = []; R.active = null; if (R.marker) R.marker.visible = false;
  };
  R.cancel = function () { if (R.active) { if (SH.HUD) SH.HUD.centerMsg('Race abandoned', 1.6); R.cleanup(); } };
  R.update = function (dt) {
    if (R.slowmo > 0) R.slowmo -= dt;
    // Stunt detection: driving fast over a ramp launches the car.
    var car = SH.Player.car;
    if (car) {
      for (var i = 0; i < R.ramps.length; i++) {
        var rp = R.ramps[i];
        if (U.dist2d(car.x, car.z, rp.x, rp.z) < 4.5 && Math.abs(car.speed) > 15 && !car.airborne) {
          car.airborne = true; car.airY = 0; car.airV = 7.5; car.airDist = 0;
          R.slowmo = 0.9;
          if (SH.HUD) SH.HUD.centerMsg('STUNT JUMP!', 1.2);
        }
      }
      if (car.airborne) {
        car.airV -= 16 * dt; car.airY += car.airV * dt; car.airDist += Math.abs(car.speed) * dt;
        if (car.airY <= 0) {
          car.airY = 0; car.airborne = false;
          var bonus = Math.round(car.airDist * C.STUNT_BASE_REWARD);
          SH.Economy.addCash(bonus, 'Stunt ' + Math.round(car.airDist) + 'm'); SH.Economy.addXP(10);
          SH.Economy.stats.stunts++;
          if (SH.HUD) SH.HUD.centerMsg('Stunt landed: ' + Math.round(car.airDist) + 'm!', 2);
        }
      }
    }
    if (!R.active) return;
    if (R.countdown > 0) {
      var before = Math.ceil(R.countdown);
      R.countdown -= dt;
      if (Math.ceil(R.countdown) !== before && SH.Audio) SH.Audio.countBeep(R.countdown <= 0.2);
      if (SH.HUD) SH.HUD.centerMsg(R.countdown > 0.4 ? String(Math.ceil(R.countdown - 0.2)) : 'GO!', 0.4);
      return;
    }
    R.active.time += dt;
    var route = R.active.route;
    // Rivals follow checkpoints.
    R.rivals.forEach(function (r) {
      var cp = route.cps[r.cp % route.cps.length];
      var want = U.headingTo(r.x, r.z, cp[0], cp[1]);
      r.heading = U.angleLerp(r.heading, want, U.clamp(dt * 2.4, 0, 1));
      var playerProg = R.active.cp;
      var rubber = U.clamp(1 + (playerProg - r.cp) * 0.05, 0.9, 1.12);
      r.speed = U.damp(r.speed, 24 * r.skill * rubber, 1.5, dt);
      r.x += Math.sin(r.heading) * r.speed * dt; r.z += Math.cos(r.heading) * r.speed * dt;
      if (U.dist2d(r.x, r.z, cp[0], cp[1]) < 10) r.cp++;
      r.prog = r.cp * 1000 - U.dist2d(r.x, r.z, route.cps[r.cp % route.cps.length][0], route.cps[r.cp % route.cps.length][1]);
      r.mesh.position.set(r.x, 0, r.z); r.mesh.rotation.y = r.heading;
    });
    var p = SH.Player.pos(), cp2 = route.cps[R.active.cp % route.cps.length];
    if (U.dist2d(p.x, p.z, cp2[0], cp2[1]) < 11) {
      R.active.cp++;
      if (SH.Audio) SH.Audio.blip();
      if (R.active.cp >= route.cps.length) { R.finish(); return; }
      R.placeMarker();
    }
    // Rivals finishing first still lets the player finish for P2-P4.
    var anyDone = R.rivals.some(function (r) { return r.cp >= route.cps.length; });
    if (anyDone && U.dist2d(p.x, p.z, cp2[0], cp2[1]) > 200 && R.active.time > 240) R.finish();
  };
  R.timeScale = function () { return R.slowmo > 0 ? 0.45 : 1; };
})(window.SH);
