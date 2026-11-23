// Solstice Heat: Neon Tide — vehicles.js
// Car factory, driving physics, traffic AI, parked cars, drivable speedboat.
window.SH = window.SH || {};
SH.vehicles = (function () {
  'use strict';
  var R = SH.random, C = SH.config;
  var cars = [];       // all vehicle records
  var traffic = [];
  var boat = null;
  var sceneRef = null;
  function lam(color) { return new THREE.MeshLambertMaterial({ color: color }); }
  function buildCarMesh(spec, colorHex, isPolice, isTaxi) {
    var grp = new THREE.Group();
    var bodyMat = new THREE.MeshPhongMaterial({ color: colorHex, shininess: 80, specular: 0x666666 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.3), bodyMat);
    body.position.y = 0.55; grp.add(body);
    var nose = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.34, 0.9), bodyMat);
    nose.position.set(0, 0.48, -2.35); grp.add(nose);
    var cabinMat = new THREE.MeshPhongMaterial({ color: 0x18222e, shininess: 120, specular: 0x99ccff });
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.0), cabinMat);
    cabin.position.set(0, 1.05, 0.25); grp.add(cabin);
    if (spec.id === 'van' || spec.id === 'pickup') { cabin.scale.set(1.05, 1.25, 1.5); cabin.position.z = -0.2; }
    if (spec.id === 'pickup') { var bed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 1.6), lam(0x222222)); bed.position.set(0, 0.75, 1.6); grp.add(bed); }
    var wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
    var wheelMat = lam(0x14161a), hubMat = lam(0xb9c2cc);
    var wheels = [];
    [[-0.95, -1.45], [0.95, -1.45], [-0.95, 1.45], [0.95, 1.45]].forEach(function (p) {
      var w = new THREE.Mesh(wheelGeo, wheelMat); w.rotation.z = Math.PI / 2;
      w.position.set(p[0], 0.36, p[1]); grp.add(w); wheels.push(w);
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 8), hubMat);
      hub.rotation.z = Math.PI / 2; hub.position.copy(w.position); grp.add(hub);
    });
    var hl = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
    [-0.6, 0.6].forEach(function (sx) {
      var h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), hl);
      h.position.set(sx, 0.58, -2.82); grp.add(h);
      var t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.08), new THREE.MeshBasicMaterial({ color: 0xff2233 }));
      t.position.set(sx, 0.6, 2.17); grp.add(t);
    });
    var spot = new THREE.SpotLight(0xfff2c0, 0, 40, 0.5, 0.5);
    spot.position.set(0, 0.7, -2.6); spot.target.position.set(0, 0, -18);
    grp.add(spot); grp.add(spot.target); grp.userData.headlight = spot;
    if (isPolice) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.5), lam(0x111111));
      bar.position.set(0, 1.38, 0.25); grp.add(bar);
      var rl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.44), new THREE.MeshBasicMaterial({ color: 0xff2244 }));
      rl.position.set(-0.32, 1.4, 0.25); rl.name = 'copRed'; grp.add(rl);
      var bl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.44), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
      bl.position.set(0.32, 1.4, 0.25); bl.name = 'copBlue'; grp.add(bl);
      var stripe = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.2, 4.32), lam(0xf2f5f7));
      stripe.position.y = 0.62; stripe.scale.set(1, 1, 0.18); grp.add(stripe);
    }
    if (isTaxi) {
      var sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
      sign.position.set(0, 1.4, 0.25); grp.add(sign);
    }
    grp.userData.wheels = wheels;
    return grp;
  }
  function buildBoatMesh(colorHex) {
    var grp = new THREE.Group();
    var hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 6.4), new THREE.MeshPhongMaterial({ color: colorHex, shininess: 90 }));
    hull.position.y = 0.5; grp.add(hull);
    var bow = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.2, 4), hull.material);
    bow.rotation.x = -Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.position.set(0, 0.5, -4.1); bow.scale.y = 1; grp.add(bow);
    var deck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 3.4), lam(0x8a6642));
    deck.position.set(0, 1.05, 0.6); grp.add(deck);
    var shield = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 0.12), new THREE.MeshPhongMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.6 }));
    shield.position.set(0, 1.45, -0.9); shield.rotation.x = -0.25; grp.add(shield);
    var motor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.5), lam(0x22262c));
    motor.position.set(0, 0.8, 3.3); grp.add(motor);
    var seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.6), lam(0xd7263d));
    seat.position.set(0, 1.0, 1.6); grp.add(seat);
    return grp;
  }
  function makeCar(specId, x, z, heading, opts) {
    opts = opts || {};
    var spec = null;
    C.VEHICLES.forEach(function (v) { if (v.id === specId) spec = v; });
    if (!spec) spec = C.VEHICLES[0];
    var color = opts.color !== undefined ? opts.color : R.choice(spec.colors);
    var isPolice = specId === 'police', isTaxi = specId === 'taxi';
    var mesh = specId === 'boat' ? buildBoatMesh(color) : buildCarMesh(spec, color, isPolice, isTaxi);
    mesh.position.set(x, SH.city.groundY(x, z), z); mesh.rotation.y = heading || 0;
    sceneRef.add(mesh);
    var rec = {
      spec: spec, mesh: mesh, x: x, z: z, heading: heading || 0, speed: 0,
      steer: 0, damage: 0, isBoat: specId === 'boat', isPolice: isPolice, isTaxi: isTaxi,
      parked: !!opts.parked, traffic: !!opts.traffic, occupied: false,
      smokeT: 0, ai: { node: null, path: [], pathI: 0, wait: 0, targetSpeed: spec.top * 0.55 },
      color: color, name: spec.name
    };
    mesh.userData.rec = rec;
    cars.push(rec);
    if (rec.traffic) traffic.push(rec);
    if (rec.isBoat) boat = rec;
    return rec;
  }
  function spawnWorld(scene) {
    sceneRef = scene;
    var spots = SH.city.spawnCars;
    for (var i = 0; i < spots.length && i < 46; i++) {
      var s = spots[i];
      if (R.dist2(s.x, s.z, -52, 232) < 30) continue;
      var civ = ['coupe', 'sedan', 'muscle', 'pickup', 'van', 'compact'];
      var id = R.chance(0.12) ? 'taxi' : R.choice(civ);
      var heading = R.chance(0.5) ? 0 : Math.PI;
      var rec = makeCar(id, s.x + R.range(-2, 2), s.z, heading, { traffic: i % 3 !== 0, parked: i % 3 === 0 });
      if (rec.parked) { rec.x += R.chance(0.5) ? 4.6 : -4.6; rec.mesh.position.x = rec.x; }
    }
    // Hero car near fixer spot + speedboat at marina
    var heroRec = makeCar('muscle', -46, 226, 2.6, { color: 0xf46036 });
    heroRec.hero = true;
    makeCar('boat', 208, 420, 0.4, { color: 0xff5964 });
    makeCar('boat', 120, 430, -0.3, { color: 0xffffff });
  }
  function nearestCar(x, z, maxD) {
    var best = null, bd = maxD || 9;
    cars.forEach(function (c) { var d = R.dist2(x, z, c.x, c.z); if (d < bd) { bd = d; best = c; } });
    return best;
  }
  function damageCar(rec, amount, fx) {
    rec.damage = Math.min(100, rec.damage + amount);
    if (fx && amount > 4) SH.effects.burst(rec.x, 1, rec.z, 'spark', Math.floor(amount));
    if (rec.damage > 55 && fx) SH.effects.burst(rec.x, 1, rec.z, 'smoke', 3);
    if (rec.damage > 85 && fx) SH.effects.burst(rec.x, 1.2, rec.z, 'fire', 4);
  }
  function stepCar(rec, dt, throttle, steerIn, brake, handbrake) {
    var spec = rec.spec;
    var dmgFactor = 1 - rec.damage / 220;
    if (throttle > 0) rec.speed += spec.accel * dmgFactor * throttle * dt;
    else if (throttle < 0) rec.speed += (rec.speed > 0.5 ? -34 : spec.accel * 0.6 * throttle) * dt;
    if (brake) rec.speed -= Math.sign(rec.speed) * Math.min(Math.abs(rec.speed), 40 * dt);
    var drag = rec.isBoat ? 0.25 : 0.55;
    rec.speed -= rec.speed * drag * dt * 0.35;
    var maxF = spec.top * dmgFactor, maxR = -spec.top * 0.32;
    rec.speed = R.clamp(rec.speed, maxR, maxF);
    if (!throttle && !brake) rec.speed -= Math.sign(rec.speed) * Math.min(Math.abs(rec.speed), 3.2 * dt);
    var speedRatio = R.clamp(Math.abs(rec.speed) / 14, 0, 1);
    var steerMax = (rec.isBoat ? 0.55 : 0.62) * (1 - Math.min(0.55, Math.abs(rec.speed) / spec.top * 0.55));
    rec.steer = R.lerp(rec.steer, steerIn * steerMax, dt * (handbrake ? 10 : 6));
    var turnRate = rec.steer * (rec.isBoat ? 1.1 : 1.9) * (rec.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(rec.speed) / 8 + 0.15);
    if (handbrake && Math.abs(rec.speed) > 6) turnRate *= 1.9;
    rec.heading += turnRate * dt * speedRatio * (rec.isBoat ? 1 : 1.15);
    var fx = -Math.sin(rec.heading), fz = -Math.cos(rec.heading);
    var vx = fx * rec.speed, vz = fz * rec.speed;
    if (handbrake && Math.abs(rec.speed) > 8) { vx *= 0.94; vz *= 0.94; if (Math.random() < 0.3) SH.audio.skid(Math.abs(rec.speed) / spec.top); }
    rec.x += vx * dt; rec.z += vz * dt;
    rec.x = R.clamp(rec.x, -470, 470); rec.z = R.clamp(rec.z, -430, 760);
    if (!rec.isBoat) {
      if (SH.city.isWater(rec.x, rec.z)) { rec.x -= vx * dt * 1.4; rec.z -= vz * dt * 1.4; rec.speed *= 0.4; damageCar(rec, 6 * dt, false); }
      var hit = SH.city.hitsBuilding(rec.x, rec.z, 1.6);
      if (hit) {
        var impact = Math.abs(rec.speed);
        if (impact > 7) { damageCar(rec, impact * 0.55, true); SH.audio.crash(impact); SH.effects.shake(Math.min(0.6, impact * 0.02)); SH.police.reportCrime('crash', rec.x, rec.z, 0.4); }
        var corr = SH.city.collide(rec.x, rec.z, 1.7); rec.x = corr.x; rec.z = corr.z; rec.speed *= -0.25;
      }
      rec.mesh.position.set(rec.x, SH.city.groundY(rec.x, rec.z), rec.z);
    } else {
      if (!SH.city.isWater(rec.x, rec.z) && SH.city.groundY(rec.x, rec.z) > -0.5) { rec.speed *= 0.82; }
      rec.mesh.position.set(rec.x, -0.25 + Math.sin(performance.now() * 0.0016 + rec.x) * 0.14, rec.z);
      rec.mesh.rotation.z = Math.sin(performance.now() * 0.0013) * 0.03;
      if (Math.abs(rec.speed) > 4 && Math.random() < 0.5) SH.effects.burst(rec.x - fx * 3.4, 0.1, rec.z - fz * 3.4, 'splash', 2);
    }
    rec.mesh.rotation.y = rec.heading;
    var wheels = rec.mesh.userData.wheels || [];
    wheels.forEach(function (w, i) { w.rotation.x += rec.speed * dt * 1.6; if (i < 2) w.rotation.y = rec.steer * 0.7; });
    var hl = rec.mesh.userData.headlight;
    if (hl) hl.intensity = SH.weather.isNight() ? 1.15 : 0;
    rec.smokeT -= dt;
    if (rec.damage > 60 && rec.smokeT <= 0) { SH.effects.burst(rec.x, 1.1, rec.z, rec.damage > 85 ? 'fire' : 'smoke', 2); rec.smokeT = 0.12; }
    if (handbrake && Math.abs(rec.speed) > 10 && !rec.isBoat) SH.effects.skidMark(rec.x, rec.z, rec.heading);
    return rec;
  }
  function trafficThink(rec, dt, playerPos) {
    var ai = rec.ai;
    if (ai.wait > 0) { ai.wait -= dt; stepCar(rec, dt, 0, 0, true, false); return; }
    if (!ai.path.length || ai.pathI >= ai.path.length) {
      var dest = SH.city.nodes[R.int(0, SH.city.nodes.length - 1)];
      ai.path = SH.city.findPath(rec.x, rec.z, dest.x, dest.z); ai.pathI = 0;
    }
    var tgt = ai.path[Math.min(ai.pathI, ai.path.length - 1)];
    if (!tgt) { stepCar(rec, dt, 0, 0, false, false); return; }
    if (R.dist2(rec.x, rec.z, tgt.x, tgt.z) < 9) ai.pathI++;
    var want = Math.atan2(-(tgt.x - rec.x), -(tgt.z - rec.z));
    var diff = want - rec.heading;
    while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    var steer = R.clamp(diff * 1.6, -1, 1);
    var throttle = Math.abs(diff) > 1.4 ? -0.4 : 0.75;
    var brake = false;
    // brake for obstacles: player, other cars ahead
    var fx = -Math.sin(rec.heading), fz = -Math.cos(rec.heading);
    var aheadX = rec.x + fx * 7, aheadZ = rec.z + fz * 7;
    if (playerPos && R.dist2(aheadX, aheadZ, playerPos.x, playerPos.z) < 3.4) brake = true;
    for (var i = 0; i < cars.length; i++) {
      var o = cars[i]; if (o === rec) continue;
      if (R.dist2(aheadX, aheadZ, o.x, o.z) < 3.2) { brake = true; break; }
    }
    if (brake) { throttle = 0; if (Math.random() < 0.004) SH.audio.horn(); }
    var spd = Math.abs(rec.speed);
    if (spd > ai.targetSpeed) throttle = 0;
    stepCar(rec, dt, throttle, steer, brake, false);
  }
  function update(dt, playerRec, playerPos) {
    for (var i = 0; i < traffic.length; i++) {
      var rec = traffic[i];
      if (rec === playerRec || rec.parked || rec.damage >= 100) continue;
      var d = playerPos ? R.dist2(rec.x, rec.z, playerPos.x, playerPos.z) : 0;
      if (d > 260) { // far traffic just re-parks near network to save CPU feel
        if (Math.random() < 0.002) { var nd = SH.city.nearestNode(playerPos.x + R.range(-120, 120), playerPos.z + R.range(-120, 120)); rec.x = nd.x; rec.z = nd.z; rec.ai.path = []; rec.mesh.position.set(rec.x, 0, rec.z); }
        continue;
      }
      trafficThink(rec, dt, playerPos);
    }
  }
  function repair(rec) { rec.damage = 0; }
  return {
    makeCar: makeCar, spawnWorld: spawnWorld, nearestCar: nearestCar, stepCar: stepCar,
    update: update, damageCar: damageCar, repair: repair,
    cars: cars, traffic: traffic, getBoat: function () { return boat; },
    list: function () { return cars; }
  };
})();
