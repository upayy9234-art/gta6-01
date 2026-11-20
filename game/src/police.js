// ============================================================================
// SOLSTICE HEAT — police.js
// The wanted system: crimes add heat, heat maps to 0-5 stars, stars decide
// how many black-and-white interceptors roll out of the side streets and how
// hard they hunt. Police steer a pursuit solution at the player, ram when
// close, and arrest on foot when they can hold the player in reach. Hiding
// (breaking line of sight) bleeds heat away again.
// ============================================================================
(function () {
'use strict';
window.SH = window.SH || {};

var C = SH.Config;
var W = C.world;
var U = SH.U;

var heat = 0;              // 0..170
var lastCrimeT = -99;
var lastSeenT = -99;
var seenNow = false;
var bustProgress = 0;
var spawnTimer = 0;
var blinkT = 0;

var HEAT_FOR_STAR = [0, 12, 32, 62, 102, 148];
var CRIME_HEAT = {
  steal: 26, pedHit: 38, pedShot: 34, shot: 10,
  carHit: 9, policeHit: 30, mission: 0
};

function stars() {
  var s = 0;
  for (var i = 1; i <= 5; i++) if (heat >= HEAT_FOR_STAR[i]) s = i;
  return s;
}

function makeLightbar(car) {
  var g = car.mesh;
  var bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.34),
    new THREE.MeshLambertMaterial({ color: 0x22242a }));
  bar.position.set(0, 1.62, -0.1);
  g.add(bar);
  var redMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  var blueMat = new THREE.MeshBasicMaterial({ color: 0x2266ff });
  var red = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.3), redMat);
  red.position.set(-0.28, 1.72, -0.1);
  g.add(red);
  var blue = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.3), blueMat);
  blue.position.set(0.28, 1.72, -0.1);
  g.add(blue);
  car.lightbar = { red: redMat, blue: blueMat };
}

function spawnPoliceCar() {
  // roll in from a city-edge intersection, out of the player's immediate view
  var pp = SH.Player.pos;
  var edges = [
    { x: W.vx[0], z: W.hz[1] }, { x: W.vx[6], z: W.hz[2] },
    { x: W.vx[2], z: W.hz[0] }, { x: W.vx[4], z: W.hz[5] },
    { x: W.vx[0], z: W.hz[4] }, { x: W.vx[6], z: W.hz[3] }
  ];
  var best = null, bd = -1;
  for (var i = 0; i < edges.length; i++) {
    var d = U.dist2(pp.x, pp.z, edges[i].x, edges[i].z);
    if (d > bd && d > 3600) { bd = d; best = edges[i]; }
  }
  if (!best) best = edges[0];
  var car = SH.Vehicles.spawn({
    type: 'police', color: 0x1c1e24,
    x: best.x + SH.rng.range(-3, 3), z: best.z + SH.rng.range(-3, 3),
    heading: SH.rng.range(0, 6.28), mode: 'police',
    maxSpeed: 17.5, accel: 9.5, cruise: 12
  });
  makeLightbar(car);
  return car;
}

function policeCars() {
  return SH.Vehicles.list.filter(function (c) { return c.mode === 'police' && !c.dead; });
}

// Steering solution: aim at a point ahead of the player's travel so the
// interceptor cuts corners instead of trailing forever.
function pursuitControl(car, dt) {
  var pos = car.mesh.position;
  var tp = SH.Player.inCar && SH.Player.car ? SH.Player.car.mesh.position : SH.Player.pos;
  var tvx = 0, tvz = 0;
  if (SH.Player.inCar && SH.Player.car) {
    tvx = U.fwdX(SH.Player.car.heading) * SH.Player.car.speed;
    tvz = U.fwdZ(SH.Player.car.heading) * SH.Player.car.speed;
  }
  var dist = U.dist(pos.x, pos.z, tp.x, tp.z);
  var lead = U.clamp(dist * 0.045, 0, 0.55);
  var ax = tp.x + tvx * lead, az = tp.z + tvz * lead;
  var want = U.bearing(ax - pos.x, az - pos.z);
  var diff = U.angleDiff(car.heading, want);
  var steer = U.clamp(diff * 1.9, -1, 1);
  var s = stars();
  var topSpeed = 13.5 + s * 1.35;
  if (SH.Player.inCar) topSpeed = Math.max(topSpeed, Math.abs(SH.Player.car.speed) * 1.12 + 2);
  var throttle = car.speed < topSpeed ? 1 : -0.3;
  if (Math.abs(diff) > 1.15) throttle = car.speed > 4 ? -0.7 : 0.6; // swing around
  if (dist < 5 && !SH.Player.inCar) throttle = car.speed > 2 ? -1 : 0; // stop to make the arrest
  // don't plough through traffic if avoidable
  var urg = SH.Vehicles.obstacleAhead(car, 7);
  if (urg > 0.4 && dist > 14) throttle = -0.6;
  // stuck against a wall: back out briefly
  if (Math.abs(car.speed) < 0.5 && throttle > 0) {
    car.stuckT += dt;
    if (car.stuckT > 1.6) { car.stuckT = 0; car.speed = -3.2; }
  } else car.stuckT = Math.max(0, car.stuckT - dt);
  return { throttle: throttle, steer: steer };
}

SH.Police = {
  get heat() { return heat; },
  get stars() { return stars(); },
  get seen() { return seenNow; },
  get bustProgress() { return bustProgress; },
  cars: policeCars,

  commitCrime: function (type, x, z) {
    var add = CRIME_HEAT[type] || 0;
    if (!add) return;
    // unwitnessed crimes (no cop, no crowd nearby) count for less
    var witnessed = false;
    var pcs = policeCars();
    for (var i = 0; i < pcs.length; i++) {
      if (U.dist2(x, z, pcs[i].mesh.position.x, pcs[i].mesh.position.z) < 2500) witnessed = true;
    }
    if (!witnessed && SH.People.nearestPed(x, z, 26, true)) witnessed = true;
    var before = stars();
    heat = Math.min(172, heat + add * (witnessed ? 1 : 0.45));
    lastCrimeT = SH.G.time;
    if (stars() > before) SH.Audio.wantedUp();
  },

  setWanted: function (n) {
    heat = HEAT_FOR_STAR[U.clamp(n, 0, 5)] + 1;
    lastCrimeT = SH.G.time;
  },

  clearWanted: function () {
    heat = 0;
    bustProgress = 0;
  },

  // Force-spawn n interceptors near the player (mission 5/6 and shots).
  deploy: function (n) {
    var pcs = policeCars();
    for (var i = pcs.length; i < n; i++) spawnPoliceCar();
  },

  // Attach a lightbar to an externally spawned police car (screenshots).
  decorate: function (car) {
    makeLightbar(car);
    if (car.lightbar) {
      car.lightbar.red.color.setHex(0xff2222);
      car.lightbar.blue.color.setHex(0x2266ff);
    }
  },

  update: function (dt) {
    var s = stars();
    var pcs = policeCars();
    var pp = SH.Player.pos;
    blinkT += dt;

    // --- line of sight: any cop within 48m with a clear-ish view "sees" you
    seenNow = false;
    var nearest = 1e9;
    for (var i = 0; i < pcs.length; i++) {
      var cp = pcs[i].mesh.position;
      var d = U.dist(pp.x, pp.z, cp.x, cp.z);
      if (d < nearest) nearest = d;
      if (d < 48) seenNow = true;
      // lightbar blink (steady-on during the chase screenshot)
      if (pcs[i].lightbar) {
        if (SH.G.shotMode === 'chase') {
          pcs[i].lightbar.red.color.setHex(0xff2222);
          pcs[i].lightbar.blue.color.setHex(0x2266ff);
        } else {
          var on = Math.sin(blinkT * 9) > 0;
          pcs[i].lightbar.red.color.setHex(on ? 0xff2222 : 0x551111);
          pcs[i].lightbar.blue.color.setHex(on ? 0x113377 : 0x2266ff);
        }
      }
    }
    if (seenNow) lastSeenT = SH.G.time;

    // --- heat decay: only while unseen and a few seconds after the crime
    if (s > 0 && !seenNow && SH.G.time - lastCrimeT > 5) {
      heat = Math.max(0, heat - dt * 2.6);
      if (heat === 0 && SH.Missions) SH.Missions.onWantedCleared();
    }

    // --- fleet size follows the stars
    spawnTimer -= dt;
    var wanted_count = s === 0 ? 0 : Math.min(C.tuning.maxPolice, s + (s >= 3 ? 1 : 0));
    if (pcs.length < wanted_count && spawnTimer <= 0) {
      spawnPoliceCar();
      spawnTimer = 2.5;
      pcs = policeCars();
    }
    if (s === 0) {
      // stand down: cops peel off and despawn when far away
      for (var j = 0; j < pcs.length; j++) {
        var c2 = pcs[j];
        if (U.dist2(pp.x, pp.z, c2.mesh.position.x, c2.mesh.position.z) > 120 * 120) {
          SH.Vehicles.remove(c2);
        } else {
          c2.mode = 'traffic'; // give up and join traffic flow
          SH.Vehicles.planRoute(c2, SH.rng);
          if (c2.lightbar) { c2.lightbar.red.color.setHex(0x551111); c2.lightbar.blue.color.setHex(0x113377); }
        }
      }
      bustProgress = 0;
      SH.Audio.setSiren(0);
      return;
    }

    // --- pursuit
    for (var k = 0; k < pcs.length; k++) {
      SH.Vehicles.stepPlayerCar(pcs[k], dt, pursuitControl(pcs[k], dt));
    }
    SH.Audio.setSiren(U.clamp(1 - nearest / 55, 0, 1));

    // --- arrest: on foot, a stopped cop close by fills the bust meter
    if (!SH.Player.inCar && SH.Player.alive) {
      var arresting = false;
      for (var m = 0; m < pcs.length; m++) {
        var cp2 = pcs[m].mesh.position;
        if (U.dist(pp.x, pp.z, cp2.x, cp2.z) < 4.4 && Math.abs(pcs[m].speed) < 3.2) arresting = true;
        // a cop car that clips the player on foot hurts, but does not kill outright
        if (U.dist(pp.x, pp.z, cp2.x, cp2.z) < 2.1 && Math.abs(pcs[m].speed) > 5) {
          SH.Player.damage(14, 'runover');
          pcs[m].speed *= 0.4;
        }
      }
      if (arresting) {
        bustProgress += dt / 1.15;
        if (bustProgress >= 1) {
          bustProgress = 0;
          if (SH.Main) SH.Main.gameOver('busted');
        }
      } else {
        bustProgress = Math.max(0, bustProgress - dt * 0.7);
      }
    } else {
      bustProgress = Math.max(0, bustProgress - dt);
    }
  }
};
})();
