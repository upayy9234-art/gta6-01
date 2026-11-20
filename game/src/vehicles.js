// ============================================================================
// SOLSTICE HEAT — vehicles.js
// Low-poly cars built from boxes and cylinders (sedan, convertible, van,
// pickup, taxi, plus the police livery used by police.js), an arcade physics
// step shared by every driver, and the traffic AI that flows around the road
// grid on right-hand lanes, turning at intersections and braking for whoever
// is in front.
// ============================================================================
(function () {
'use strict';
window.SH = window.SH || {};

var C = SH.Config;
var W = C.world;
var U = SH.U;

var cars = [];
var blobTex = null;

var TYPES = {
  sedan:       { len: 4.4, wid: 1.9, bodyH: 0.62, cabH: 0.52, cabLen: 2.1, top: 'closed' },
  convertible: { len: 4.3, wid: 1.9, bodyH: 0.58, cabH: 0.30, cabLen: 1.7, top: 'open' },
  van:         { len: 5.0, wid: 2.0, bodyH: 1.15, cabH: 0.55, cabLen: 3.6, top: 'closed' },
  pickup:      { len: 4.8, wid: 2.0, bodyH: 0.66, cabH: 0.55, cabLen: 1.5, top: 'closed' },
  taxi:        { len: 4.4, wid: 1.9, bodyH: 0.62, cabH: 0.52, cabLen: 2.1, top: 'closed' },
  police:      { len: 4.5, wid: 1.9, bodyH: 0.62, cabH: 0.52, cabLen: 2.1, top: 'closed' }
};

var wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10);
var wheelMat = new THREE.MeshLambertMaterial({ color: 0x15161a });
var glassMat = new THREE.MeshLambertMaterial({ color: 0x1b2733 });
var chromeMat = new THREE.MeshLambertMaterial({ color: 0xb9c2c9 });
var headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
var tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });

// Builds the visual mesh for one car. Front of the car faces +z.
function makeCarMesh(type, colorHex, opts) {
  opts = opts || {};
  var spec = TYPES[type] || TYPES.sedan;
  var g = new THREE.Group();
  var bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
  var paint = new THREE.Mesh(new THREE.BoxGeometry(spec.wid, spec.bodyH, spec.len), bodyMat);
  paint.position.y = 0.32 + spec.bodyH / 2;
  g.add(paint);

  if (type === 'police') {
    // black-and-white livery: white doors band over a dark body
    var band = new THREE.Mesh(new THREE.BoxGeometry(spec.wid + 0.02, spec.bodyH * 0.55, spec.len * 0.42),
      new THREE.MeshLambertMaterial({ color: 0xf4f6f7 }));
    band.position.set(0, 0.32 + spec.bodyH / 2, 0.1);
    g.add(band);
  }

  if (spec.top === 'open') {
    // convertible: low windshield + visible seats, no roof
    var shield = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.9, 0.42, 0.08), glassMat);
    shield.position.set(0, 0.32 + spec.bodyH + 0.18, spec.cabLen * 0.42);
    shield.rotation.x = -0.25;
    g.add(shield);
    var seatMat = new THREE.MeshLambertMaterial({ color: 0x7a4a2b });
    [-0.45, 0.45].forEach(function (sx) {
      var seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.6), seatMat);
      seat.position.set(sx, 0.32 + spec.bodyH + 0.12, -0.25);
      g.add(seat);
    });
  } else {
    var cab = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.88, spec.cabH, spec.cabLen),
      type === 'van' ? bodyMat : glassMat);
    cab.position.set(0, 0.32 + spec.bodyH + spec.cabH / 2, type === 'pickup' ? spec.len * 0.16 : -0.1);
    g.add(cab);
    if (type !== 'van') {
      var roof = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.9, 0.07, spec.cabLen * 0.92), bodyMat);
      roof.position.set(0, 0.32 + spec.bodyH + spec.cabH + 0.03, cab.position.z);
      g.add(roof);
    }
  }
  if (type === 'pickup') {
    var bed = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.94, 0.3, spec.len * 0.42),
      new THREE.MeshLambertMaterial({ color: 0x2e3438 }));
    bed.position.set(0, 0.32 + spec.bodyH + 0.1, -spec.len * 0.26);
    g.add(bed);
  }
  if (type === 'taxi') {
    var signM = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xffd94d }));
    signM.position.set(0, 0.32 + spec.bodyH + spec.cabH + 0.2, -0.1);
    g.add(signM);
  }

  // lights: headlights + taillights (emissive boxes)
  [-0.62, 0.62].forEach(function (sx) {
    var hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.13, 0.06), headMat);
    hl.position.set(sx, 0.62, spec.len / 2 + 0.02);
    g.add(hl);
    var tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.06), tailMat);
    tl.position.set(sx, 0.66, -spec.len / 2 - 0.02);
    g.add(tl);
  });
  // bumpers
  [spec.len / 2, -spec.len / 2].forEach(function (bz) {
    var b = new THREE.Mesh(new THREE.BoxGeometry(spec.wid * 0.98, 0.18, 0.14), chromeMat);
    b.position.set(0, 0.34, bz);
    g.add(b);
  });
  // wheels
  var wheels = [];
  var wx = spec.wid / 2 - 0.05, wz = spec.len / 2 - 0.85;
  [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]].forEach(function (p) {
    var wh = new THREE.Mesh(wheelGeo, wheelMat);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(p[0], 0.34, p[1]);
    g.add(wh);
    wheels.push(wh);
  });

  // headlight cones (visible at night, toggled by setNight)
  var cones = [];
  if (!opts.noCones) {
    var coneMat = new THREE.MeshBasicMaterial({
      color: 0xffeebb, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    [-0.62, 0.62].forEach(function (sx) {
      var cone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 6.5, 10, 1, true), coneMat);
      cone.rotation.x = Math.PI / 2 + 0.12;
      cone.position.set(sx, 0.55, spec.len / 2 + 3.1);
      g.add(cone);
      cones.push(cone);
    });
    g.userData.coneMat = coneMat;
  }

  // fake AO blob under the car
  if (!blobTex) blobTex = SH.City.blobTexture();
  var blob = new THREE.Mesh(new THREE.PlaneGeometry(spec.wid + 1.1, spec.len + 1.2),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.03;
  g.add(blob);

  g.userData.wheels = wheels;
  g.userData.spec = spec;
  return g;
}

// --- car objects -------------------------------------------------------------------
var carSeq = 0;

function spawnCar(opts) {
  var mesh = makeCarMesh(opts.type || 'sedan', opts.color, opts);
  mesh.position.set(opts.x || 0, 0, opts.z || 0);
  SH.scene.add(mesh);
  var car = {
    id: ++carSeq,
    type: opts.type || 'sedan',
    mesh: mesh,
    spec: mesh.userData.spec,
    heading: opts.heading || 0,
    speed: 0,
    mode: opts.mode || 'traffic',   // traffic | parked | player | police | target | off
    driver: null,                   // ped object when a traffic driver sits inside
    damage: 0,                      // 0..100, cosmetic lean + smoke at high values
    // navigation (traffic/target): queue of waypoints {x,z}
    nav: [],
    cruise: opts.cruise || 9.5,
    maxSpeed: opts.maxSpeed || 15,
    accel: opts.accel || 7.5,
    stuckT: 0,
    hitCooldown: 0,
    isPlayerCar: false,
    dead: false
  };
  mesh.rotation.y = car.heading;
  cars.push(car);
  return car;
}

function removeCar(car) {
  car.dead = true;
  SH.scene.remove(car.mesh);
  var i = cars.indexOf(car);
  if (i >= 0) cars.splice(i, 1);
}

// Picks the next intersection to drive to and queues lane-corrected points.
function planRoute(car, r) {
  var pos = car.mesh.position;
  // current intersection indices (nearest)
  var ii = 0, jj = 0, i, j, bd = 1e9;
  for (i = 0; i < W.vx.length; i++) { var d = Math.abs(pos.x - W.vx[i]); if (d < bd) { bd = d; ii = i; } }
  bd = 1e9;
  for (j = 0; j < W.hz.length; j++) { var d2 = Math.abs(pos.z - W.hz[j]); if (d2 < bd) { bd = d2; jj = j; } }
  // neighbours inside the grid
  var options = [];
  if (ii > 0) options.push([ii - 1, jj]);
  if (ii < W.vx.length - 1) options.push([ii + 1, jj]);
  if (jj > 0) options.push([ii, jj - 1]);
  if (jj < W.hz.length - 1) options.push([ii, jj + 1]);
  // avoid immediate U-turns when another choice exists
  var back = car.lastNode;
  var filtered = options.filter(function (o) { return !back || o[0] !== back[0] || o[1] !== back[1]; });
  var next = r.pick(filtered.length ? filtered : options);
  car.lastNode = [ii, jj];
  car.targetNode = next;
  var tx = W.vx[next[0]], tz = W.hz[next[1]];
  var dx = Math.sign(tx - W.vx[ii]), dz = Math.sign(tz - W.hz[jj]);
  // right vector for travel direction (dx,dz) is (-dz, dx); lane sits right
  var rx = -dz * W.lane, rz = dx * W.lane;
  car.nav.length = 0;
  car.nav.push({ x: W.vx[ii] + rx, z: W.hz[jj] + rz });       // swing onto the correct side
  car.nav.push({ x: tx + rx, z: tz + rz });                    // arrive at next intersection
}

// Is something solid just ahead of this car? Returns 0..1 braking urgency.
function obstacleAhead(car, lookDist) {
  var pos = car.mesh.position;
  var fx = U.fwdX(car.heading), fz = U.fwdZ(car.heading);
  var rx = -fz, rz = fx;
  var i, other, rel;
  for (i = 0; i < cars.length; i++) {
    other = cars[i];
    if (other === car || other.dead) continue;
    rel = { x: other.mesh.position.x - pos.x, z: other.mesh.position.z - pos.z };
    var f = rel.x * fx + rel.z * fz;
    if (f > 0 && f < lookDist) {
      var lat = Math.abs(rel.x * rx + rel.z * rz);
      if (lat < 2.3) return 1 - f / lookDist;
    }
  }
  // the player on foot
  if (SH.Player && SH.Player.alive && !SH.Player.inCar) {
    rel = { x: SH.Player.pos.x - pos.x, z: SH.Player.pos.z - pos.z };
    var f2 = rel.x * fx + rel.z * fz;
    if (f2 > 0 && f2 < lookDist && Math.abs(rel.x * rx + rel.z * rz) < 2.0) return 1 - f2 / lookDist;
  }
  return 0;
}

// The shared arcade physics step. control = {throttle -1..1, steer -1..1}.
function stepCar(car, dt, control) {
  var pos = car.mesh.position;
  var throttle = control.throttle || 0;
  var steer = control.steer || 0;

  if (throttle > 0) car.speed += car.accel * throttle * dt * (1 - Math.max(0, car.speed) / (car.maxSpeed * 1.6));
  else if (throttle < 0) {
    if (car.speed > 0.4) car.speed -= 16 * dt;                    // brake
    else car.speed = Math.max(car.speed + car.accel * 0.55 * throttle * dt, -5.5); // reverse
  }
  // rolling drag + handbrake for parked/off cars
  if (car.mode === 'parked' || car.mode === 'off') car.speed -= car.speed * 4 * dt;
  else car.speed -= car.speed * 0.35 * dt;
  if (Math.abs(car.speed) < 0.02 && throttle === 0) car.speed = 0;

  // steering authority grows then fades with speed, like an arcade racer
  var spd = Math.abs(car.speed);
  var authority = U.clamp(spd / 3, 0, 1) * (1 - U.clamp((spd - 18) / 30, 0, 0.45));
  car.heading += steer * 1.55 * authority * dt * (car.speed < 0 ? -1 : 1);

  var nx = pos.x + U.fwdX(car.heading) * car.speed * dt;
  var nz = pos.z + U.fwdZ(car.heading) * car.speed * dt;

  // building collision (circle vs city boxes)
  var res = SH.City.collide(nx, nz, 1.55);
  if (res.hit) {
    if (spd > 4.5) {
      car.damage = Math.min(100, car.damage + (spd - 4) * 2.4);
      if (car.isPlayerCar || car.mode === 'player') SH.Audio.crash(spd > 9);
      if (car.mode === 'player') SH.Player.onCarCrash(spd);
      notifyHit(car, null, spd);
    }
    car.speed *= spd > 4.5 ? -0.18 : 0.4;
    nx = res.x; nz = res.z;
  }
  pos.x = nx; pos.z = nz;
  car.mesh.rotation.y = car.heading;
  // damage lean + wheel spin
  car.mesh.rotation.z = car.damage > 55 ? 0.035 : 0;
  var wheels = car.mesh.userData.wheels;
  for (var wi = 0; wi < wheels.length; wi++) wheels[wi].rotation.x += car.speed * dt / 0.34;

  car.hitCooldown = Math.max(0, car.hitCooldown - dt);
  collideCars(car, dt);
  if (Math.abs(car.speed) > 2.5) hitPeds(car);
}

// Car vs car: push apart, trade a little speed, register damage + crimes.
function collideCars(car, dt) {
  var pos = car.mesh.position;
  for (var i = 0; i < cars.length; i++) {
    var other = cars[i];
    if (other === car || other.dead) continue;
    var dx = other.mesh.position.x - pos.x;
    var dz = other.mesh.position.z - pos.z;
    var rr = 2.6;
    var d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 0.0001) {
      var d = Math.sqrt(d2);
      var push = (rr - d) / 2;
      var ux = dx / d, uz = dz / d;
      pos.x -= ux * push; pos.z -= uz * push;
      other.mesh.position.x += ux * push; other.mesh.position.z += uz * push;
      var rel = Math.abs(car.speed - other.speed) + Math.abs(car.speed) * 0.3;
      if (rel > 3 && car.hitCooldown <= 0) {
        car.hitCooldown = 0.4;
        car.damage = Math.min(100, car.damage + rel * 1.6);
        other.damage = Math.min(100, other.damage + rel * 1.6);
        if (car.isPlayerCar || other.isPlayerCar) {
          SH.Audio.crash(rel > 7);
          SH.Player.onCarCrash(rel * 0.8);
        }
        notifyHit(car, other, rel);
        notifyHit(other, car, rel);
        var avg = (car.speed + other.speed) / 2;
        car.speed = avg * 0.7; other.speed = avg * 0.7;
      }
    }
  }
}

// Running down pedestrians (only the player's car creates crime heat here;
// traffic brakes for peds, but a fast traffic car can still clip one).
function hitPeds(car) {
  if (!SH.People) return;
  var pos = car.mesh.position;
  var list = SH.People.list;
  for (var i = 0; i < list.length; i++) {
    var ped = list[i];
    if (ped.state === 'down' || ped.state === 'inCar') continue;
    var d2 = U.dist2(pos.x, pos.z, ped.pos.x, ped.pos.z);
    if (d2 < 3.4) {
      ped.knockDown(car.speed, car.heading);
      if (car.isPlayerCar && SH.Police) SH.Police.commitCrime('pedHit', pos.x, pos.z);
      if (car.isPlayerCar) SH.Player.damage(0, 'ped'); // no self damage, keeps flow
    }
  }
}

// Collision event hook: missions (chase target) and police (crimes) listen.
var hitListeners = [];
function notifyHit(car, other, strength) {
  for (var i = 0; i < hitListeners.length; i++) hitListeners[i](car, other, strength);
}

// --- traffic AI ----------------------------------------------------------------------
function trafficControl(car, dt) {
  var pos = car.mesh.position;
  if (!car.nav.length) planRoute(car, SH.rng);
  var wp = car.nav[0];
  var dx = wp.x - pos.x, dz = wp.z - pos.z;
  var dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 3.6) {
    car.nav.shift();
    return { throttle: 0.4, steer: 0 };
  }
  var want = U.bearing(dx, dz);
  var diff = U.angleDiff(car.heading, want);
  var steer = U.clamp(diff * 1.6, -1, 1);
  var targetSpeed = car.cruise;
  if (Math.abs(diff) > 0.45) targetSpeed = Math.min(targetSpeed, 4.5);
  var urg = obstacleAhead(car, 9);
  if (urg > 0) targetSpeed = 0;
  // fleeing mission target drives faster and takes corners wide
  if (car.mode === 'target') targetSpeed = Math.min(car.maxSpeed, 13.5);
  var throttle = car.speed < targetSpeed ? 0.85 : -0.4;
  if (urg > 0.35 && car.speed > 1) throttle = -1;
  // stuck recovery: reverse a touch, then re-plan
  if (Math.abs(car.speed) < 0.4 && throttle > 0) {
    car.stuckT += dt;
    if (car.stuckT > 2.2) { car.stuckT = 0; car.nav.length = 0; car.speed = -2.5; }
  } else car.stuckT = 0;
  return { throttle: throttle, steer: steer };
}

function spawnTraffic(n) {
  var r = SH.rng;
  var types = ['sedan', 'sedan', 'convertible', 'van', 'pickup', 'taxi'];
  for (var i = 0; i < n; i++) {
    var p = SH.City.randomLanePoint(r);
    var type = r.pick(types);
    var car = spawnCar({
      type: type,
      color: type === 'taxi' ? 0xf5c61d : r.pick(C.palette.carPaint),
      x: p.x, z: p.z, heading: p.heading,
      mode: 'traffic', cruise: r.range(8, 11)
    });
    // a driver sits inside (invisible until they bail out when stolen)
    if (SH.People) {
      var driver = SH.People.spawn(p.x, p.z, { state: 'inCar' });
      driver.mesh.visible = false;
      car.driver = driver;
    }
    planRoute(car, r);
  }
}

function spawnParked(n) {
  var r = SH.rng;
  var spots = SH.City.parkingSpots.slice();
  r.shuffle(spots);
  var placed = 0;
  // lot spots first
  for (var i = 0; i < spots.length && placed < n; i++) {
    spawnCar({
      type: r.pick(['sedan', 'convertible', 'pickup', 'van']),
      color: r.pick(C.palette.carPaint),
      x: spots[i].x, z: spots[i].z, heading: spots[i].heading + r.range(-0.05, 0.05),
      mode: 'parked'
    });
    placed++;
  }
  // then curb parking along roads
  while (placed < n + 4) {
    var vx = r.pick(W.vx);
    var side = r.chance(0.5) ? 1 : -1;
    var x = vx + side * (W.roadHalf - 1.3);
    var z = r.range(W.slabZ1 + 16, W.slabZ2 - 16);
    if (SH.City.isRoad(x, z + 8) && Math.abs(z % W.pitch) < 12) continue; // keep intersections clear-ish
    spawnCar({
      type: r.pick(['sedan', 'sedan', 'convertible', 'pickup']),
      color: r.pick(C.palette.carPaint),
      x: x, z: z, heading: side > 0 ? Math.PI : 0, mode: 'parked'
    });
    placed++;
  }
}

// --- public API -------------------------------------------------------------------------
SH.Vehicles = {
  list: cars,
  TYPES: TYPES,
  makeCarMesh: makeCarMesh,
  spawn: spawnCar,
  remove: removeCar,
  planRoute: planRoute,
  stepPlayerCar: stepCar,
  obstacleAhead: obstacleAhead,
  onHit: function (fn) { hitListeners.push(fn); },
  spawnTraffic: spawnTraffic,
  spawnParked: spawnParked,

  nearestCar: function (x, z, maxDist) {
    var best = null, bd = maxDist * maxDist;
    for (var i = 0; i < cars.length; i++) {
      if (cars[i].dead) continue;
      var d = U.dist2(x, z, cars[i].mesh.position.x, cars[i].mesh.position.z);
      if (d < bd) { bd = d; best = cars[i]; }
    }
    return best;
  },

  setNight: function (f) {
    for (var i = 0; i < cars.length; i++) {
      var m = cars[i].mesh.userData.coneMat;
      if (m) m.opacity = f * 0.13;
    }
  },

  update: function (dt) {
    for (var i = cars.length - 1; i >= 0; i--) {
      var car = cars[i];
      if (car.dead) continue;
      if (car.mode === 'traffic' || car.mode === 'target') {
        stepCar(car, dt, trafficControl(car, dt));
      } else if (car.mode === 'parked' || car.mode === 'off') {
        if (Math.abs(car.speed) > 0.05) stepCar(car, dt, { throttle: 0, steer: 0 });
      }
      // 'player' is stepped by player.js, 'police' by police.js
    }
  }
};
})();
