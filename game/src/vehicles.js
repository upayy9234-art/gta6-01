// Solstice Heat - vehicles: models, traffic AI, player car physics.
// Cars are box+cabin builds with spinning wheels, night headlights,
// damage smoke and drift. Traffic follows the road graph.
window.SH = window.SH || {};
(function (SH) {
  'use strict';
  var U = SH.U, C = SH.Config;
  var V = { cars: [], traffic: [] };
  SH.Vehicles = V;
  var wheelGeo, bodyMats = {};

  function mat(color) {
    if (!bodyMats[color]) bodyMats[color] = new THREE.MeshLambertMaterial({ color: color });
    return bodyMats[color];
  }
  var glassMat = null, tyreMat = null, lightMat = null, tailMat = null;

  V.buildCarMesh = function (model, color, isPolice, isTaxi) {
    if (!glassMat) {
      glassMat = new THREE.MeshLambertMaterial({ color: 0x22384a });
      tyreMat = new THREE.MeshLambertMaterial({ color: 0x151515 });
      lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
      tailMat = new THREE.MeshBasicMaterial({ color: 0xff3344 });
      wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
    }
    var grp = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(model.w, model.h, model.l), mat(color));
    body.position.y = 0.55; grp.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(model.w * 0.82, model.cabinH, model.l * 0.48), glassMat);
    cabin.position.set(0, 0.55 + model.h / 2 + model.cabinH / 2 - 0.08, -model.l * 0.05); grp.add(cabin);
    var wheels = [];
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
      var w = new THREE.Mesh(wheelGeo, tyreMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(s[0] * (model.w / 2 - 0.05), 0.36, s[1] * (model.l / 2 - 0.85));
      grp.add(w); wheels.push(w);
    });
    var hl = new THREE.Mesh(new THREE.BoxGeometry(model.w * 0.7, 0.16, 0.06), lightMat);
    hl.position.set(0, 0.62, model.l / 2 + 0.02); grp.add(hl);
    var tl = new THREE.Mesh(new THREE.BoxGeometry(model.w * 0.7, 0.16, 0.06), tailMat);
    tl.position.set(0, 0.62, -model.l / 2 - 0.02); grp.add(tl);
    if (isPolice) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2244 }));
      bar.position.set(0, 1.32, -0.2); grp.add(bar); grp.userData.lightbar = bar;
      var stripe = new THREE.Mesh(new THREE.BoxGeometry(model.w + 0.02, 0.3, model.l * 0.7), mat(0x2244aa));
      stripe.position.y = 0.55; grp.add(stripe);
    }
    if (isTaxi) {
      var sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.3), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
      sign.position.set(0, 1.34, -0.2); grp.add(sign);
    }
    grp.userData.wheels = wheels;
    return grp;
  };

  function makeCar(scene, modelIdx, color, x, z, heading) {
    var model = C.CAR_MODELS[modelIdx];
    var mesh = V.buildCarMesh(model, color, !!model.police, !!model.taxi);
    mesh.position.set(x, 0, z); mesh.rotation.y = heading;
    scene.add(mesh);
    var car = {
      mesh: mesh, model: model, x: x, z: z, heading: heading, speed: 0,
      steer: 0, damage: 0, driver: null, isPlayer: false, ai: null,
      smoke: null, color: color, dead: false
    };
    mesh.userData.car = car;
    V.cars.push(car);
    return car;
  }
  V.spawnParked = function (scene, rng, count) {
    var out = [];
    for (var i = 0; i < count; i++) {
      var rx = rng.pick(SH.City.roadsX), rz = rng.range(-400, 400);
      if (rx > 320) continue;
      var car = makeCar(scene, rng.int(0, 5), rng.pick(C.CAR_COLORS), rx + (rng.chance(0.5) ? 5.6 : -5.6), rz, rng.chance(0.5) ? 0 : Math.PI);
      car.parked = true; out.push(car);
    }
    return out;
  };
  V.spawnTraffic = function (scene, rng, count) {
    for (var i = 0; i < count; i++) {
      var vertical = rng.chance(0.5);
      var lane = rng.pick(SH.City.roadsX);
      var along = rng.range(-400, 400);
      var car = makeCar(scene, rng.int(0, 7), rng.pick(C.CAR_COLORS), vertical ? lane + 3 : along, vertical ? along : lane + 3, vertical ? 0 : Math.PI / 2);
      car.ai = { vertical: vertical, lane: lane, dir: 1, targetSpeed: rng.range(9, 15), wait: 0 };
      if (rng.chance(0.4)) { car.ai.dir = -1; car.heading += Math.PI; }
      V.traffic.push(car);
    }
  };
  V.spawnPoliceCar = function (scene, x, z) {
    var car = makeCar(scene, 6, 0xffffff, x, z, 0);
    car.ai = { police: true, targetSpeed: 20 };
    return car;
  };
  V.removeCar = function (scene, car) {
    scene.remove(car.mesh);
    var i = V.cars.indexOf(car); if (i >= 0) V.cars.splice(i, 1);
    var j = V.traffic.indexOf(car); if (j >= 0) V.traffic.splice(j, 1);
    car.dead = true;
  };
  // Simple traffic: drive along lane, turn at random intersections, slow for cars ahead.
  V.updateTraffic = function (dt, playerPos) {
    for (var i = 0; i < V.traffic.length; i++) {
      var car = V.traffic[i];
      if (car.isPlayer || car.parked || !car.ai || car.ai.police) continue;
      var ai = car.ai;
      var slow = false;
      for (var j = 0; j < V.cars.length; j++) {
        var o = V.cars[j]; if (o === car) continue;
        var aheadX = car.x + Math.sin(car.heading) * 7, aheadZ = car.z + Math.cos(car.heading) * 7;
        if (U.dist2d(aheadX, aheadZ, o.x, o.z) < 4.5) { slow = true; break; }
      }
      var target = slow ? 0 : ai.targetSpeed;
      car.speed = U.damp(car.speed, target * ai.dir, 1.6, dt);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      // Turn at intersections.
      var nearX = SH.City.roadsX.some(function (r) { return Math.abs(car.z - r) < 2; });
      var nearZ = SH.City.roadsZ.some(function (r) { return Math.abs(car.x - r) < 2; });
      if ((nearX || nearZ) && Math.random() < dt * 0.25) {
        car.heading += (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      }
      if (Math.abs(car.x) > 430 || Math.abs(car.z) > 430) { car.heading += Math.PI; car.x = U.clamp(car.x, -420, 420); car.z = U.clamp(car.z, -420, 420); }
      syncMesh(car, dt);
    }
  };
  function syncMesh(car, dt) {
    car.mesh.position.set(car.x, car.airborne ? car.airY || 0 : 0, car.z);
    car.mesh.rotation.y = car.heading;
    if (car.tilt) car.mesh.rotation.z = car.tilt;
    var wheels = car.mesh.userData.wheels || [];
    for (var i = 0; i < wheels.length; i++) wheels[i].rotation.x += car.speed * dt * 2.4;
    if (car.mesh.userData.lightbar) car.mesh.userData.lightbar.material.color.setHex(Math.floor(performance.now() / 300) % 2 ? 0xff2244 : 0x2266ff);
  }
  V.syncMesh = syncMesh;
  // Player driving physics: arcade with drift, damage and smoke.
  V.drivePlayer = function (car, input, dt) {
    var m = car.model;
    var gripBonus = (SH.Economy && SH.Economy.hasUpgrade('tires')) ? 0.05 : 0;
    var grip = m.grip + gripBonus;
    var throttle = input.up ? 1 : (input.down ? -0.55 : 0);
    var wet = SH.Weather ? SH.Weather.wet : 0;
    var top = m.topSpeed * (car.damage > 70 ? 0.55 : 1);
    if (throttle !== 0) car.speed += throttle * m.accel * dt * (1 - Math.abs(car.speed) / (top + 8));
    else car.speed = U.damp(car.speed, 0, input.brake ? 3.2 : 0.55, dt);
    if (input.brake) car.speed = U.damp(car.speed, 0, 4.5, dt);
    car.speed = U.clamp(car.speed, -14, top);
    var steerTarget = (input.left ? 1 : 0) + (input.right ? -1 : 0);
    car.steer = U.damp(car.steer, steerTarget, 8, dt);
    var drift = input.handbrake && Math.abs(car.speed) > 8;
    var turnRate = car.steer * (drift ? 1.9 : 1.25) * U.clamp(car.speed / 12, -1, 1) * (drift ? 1 : grip);
    if (wet > 0.4 && !drift) turnRate *= 0.82;
    car.heading += turnRate * dt * (drift ? 1.15 : 1);
    car.tilt = U.damp(car.tilt || 0, drift ? car.steer * 0.06 : car.steer * -0.03, 6, dt);
    var prevX = car.x, prevZ = car.z;
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    car.x = U.clamp(car.x, -440, 520); car.z = U.clamp(car.z, -440, 440);
    var hit = SH.City.collide(car.x, car.z, 1.5);
    if (hit) {
      var impact = Math.abs(car.speed);
      car.x = prevX; car.z = prevZ;
      if (impact > 6) { V.damageCar(car, impact * 1.6); if (SH.Audio) SH.Audio.crash(impact > 14); if (SH.Police) SH.Police.reportCrime('crash', car.x, car.z, 0.4); }
      car.speed *= -0.25;
    }
    if (drift && Math.random() < dt * 8 && SH.Audio) SH.Audio.skid();
    syncMesh(car, dt);
    return drift;
  };
  V.damageCar = function (car, amt) {
    if (SH.Economy && SH.Economy.hasUpgrade('armor') && car.isPlayer) amt *= 0.5;
    car.damage = U.clamp(car.damage + amt, 0, 100);
  };
  V.nearestCar = function (x, z, maxDist) {
    var best = null, bd = maxDist;
    for (var i = 0; i < V.cars.length; i++) { var c = V.cars[i]; var d = U.dist2d(x, z, c.x, c.z); if (d < bd) { bd = d; best = c; } }
    return best;
  };
})(window.SH);
