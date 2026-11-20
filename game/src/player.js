// ============================================================================
// SOLSTICE HEAT — player.js
// The hero: a fixer in a Hawaiian shirt. On foot he walks/sprints/jumps with
// WASD relative to a smooth third-person camera; E steals any nearby car
// (the traffic driver bails out and runs); while driving, the same camera
// chases the car and the shared vehicle physics takes over. F fires a
// hitscan shot on foot. Owns health, damage and the enter/exit logic.
// ============================================================================
(function () {
'use strict';
window.SH = window.SH || {};

var C = SH.Config;
var U = SH.U;

var mesh = null;
var parts = null;
var camYaw = Math.PI;        // camera looks north-ish at spawn
var camPitch = 0.32;
var phase = 0;
var vy = 0;
var grounded = true;
var shotCooldown = 0;
var stepTimer = 0;
var flashMesh = null;
var flashT = 0;
var lastDamageT = -99;
var promptCar = null;

var P = {
  pos: null,                 // THREE.Vector3 (mesh position)
  heading: 0,
  health: C.tuning.playerHealth,
  alive: true,
  inCar: false,
  car: null,
  moneyEarned: 0
};

function build() {
  mesh = SH.People.makePersonMesh({ shirt: 0x0e8a7b, skin: 0xc68642, pants: 0xf3e5d8, player: true });
  parts = mesh.userData.parts;
  mesh.position.set(-84, 0, 24);
  SH.scene.add(mesh);
  P.pos = mesh.position;
  P.heading = Math.PI / 2;

  // muzzle flash: a small additive star that blinks on for a frame or two
  var cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  var g = cv.getContext('2d');
  g.translate(32, 32);
  g.fillStyle = '#ffe9a0';
  for (var i = 0; i < 4; i++) {
    g.rotate(Math.PI / 4);
    g.fillRect(-2, -30, 4, 60);
  }
  g.beginPath(); g.arc(0, 0, 9, 0, 6.29); g.fill();
  var tex = new THREE.CanvasTexture(cv);
  flashMesh = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  flashMesh.scale.set(0.9, 0.9, 1);
  flashMesh.visible = false;
  SH.scene.add(flashMesh);
}

function nearestStealable() {
  return SH.Vehicles.nearestCar(P.pos.x, P.pos.z, 3.4);
}

function enterCar(car) {
  if (!car || P.inCar) return;
  var wasTraffic = car.mode === 'traffic';
  if (car.driver) {
    // driver bails out and sprints off
    var ped = car.driver;
    car.driver = null;
    ped.state = 'flee';
    ped.fleeT = 4;
    ped.threat = { x: P.pos.x, z: P.pos.z };
    ped.mesh.visible = true;
    ped.pos.set(car.mesh.position.x + 1.6, 0, car.mesh.position.z + 0.5);
    ped.target = null;
  }
  if (car.mode === 'parked' && car.lockedAlarm) { /* reserved for future alarms */ }
  car.mode = 'player';
  car.isPlayerCar = true;
  P.inCar = true;
  P.car = car;
  mesh.visible = false;
  SH.Audio.door();
  if (wasTraffic && SH.Police) SH.Police.commitCrime('steal', P.pos.x, P.pos.z);
  if (SH.Missions) SH.Missions.onEnterCar(car);
}

function exitCar() {
  if (!P.inCar || !P.car) return;
  var car = P.car;
  car.mode = 'off';
  car.isPlayerCar = false;
  P.inCar = false;
  P.car = null;
  // step out on the left side of the car
  var rx = -U.fwdZ(car.heading), rz = U.fwdX(car.heading);
  var res = SH.City.collide(car.mesh.position.x + rx * 1.8, car.mesh.position.z + rz * 1.8, 0.42);
  P.pos.set(res.x, 0, res.z);
  P.heading = car.heading;
  mesh.visible = true;
  SH.Audio.door();
  SH.Audio.setEngine(-1);
  if (SH.Missions) SH.Missions.onExitCar(car);
}

function shoot() {
  if (shotCooldown > 0 || P.inCar || !P.alive) return;
  shotCooldown = 0.26;
  SH.Audio.shot();
  SH.People.alertAt(P.pos.x, P.pos.z, 20);
  if (SH.Police) SH.Police.commitCrime('shot', P.pos.x, P.pos.z);
  // muzzle flash at the hand, recoil kick on the camera
  var fx = P.pos.x + U.fwdX(P.heading) * 0.55;
  var fz = P.pos.z + U.fwdZ(P.heading) * 0.55;
  flashMesh.position.set(fx, 1.35, fz);
  flashMesh.visible = true;
  flashT = 0.05;
  camPitch += 0.035;

  // hitscan: nearest valid target inside a narrow cone ahead
  var dirx = U.fwdX(P.heading), dirz = U.fwdZ(P.heading);
  var bestT = 46, bestKind = null, bestObj = null;
  var i, ped, car;
  var list = SH.People.list;
  for (i = 0; i < list.length; i++) {
    ped = list[i];
    if (ped.state === 'down' || ped.state === 'inCar' || ped.state === 'gone') continue;
    var dx = ped.pos.x - P.pos.x, dz = ped.pos.z - P.pos.z;
    var along = dx * dirx + dz * dirz;
    if (along < 1 || along > bestT) continue;
    var lat = Math.abs(dx * -dirz + dz * dirx);
    if (lat < 0.9 + along * 0.03) { bestT = along; bestKind = 'ped'; bestObj = ped; }
  }
  var cars = SH.Vehicles.list;
  for (i = 0; i < cars.length; i++) {
    car = cars[i];
    if (car.dead) continue;
    var cx = car.mesh.position.x - P.pos.x, cz = car.mesh.position.z - P.pos.z;
    var alongC = cx * dirx + cz * dirz;
    if (alongC < 1 || alongC > bestT) continue;
    var latC = Math.abs(cx * -dirz + cz * dirx);
    if (latC < 1.7 + alongC * 0.02) { bestT = alongC; bestKind = 'car'; bestObj = car; }
  }
  if (bestKind === 'ped') {
    bestObj.shootDown();
    if (SH.Police) SH.Police.commitCrime('pedShot', P.pos.x, P.pos.z);
  } else if (bestKind === 'car') {
    bestObj.damage = Math.min(100, bestObj.damage + 22);
    if (bestObj.mode === 'police' && SH.Police) SH.Police.commitCrime('policeHit', P.pos.x, P.pos.z);
    else if (SH.Police) SH.Police.commitCrime('carHit', P.pos.x, P.pos.z);
    if (bestObj.driver && SH.rng.chance(0.5)) {
      var d = bestObj.driver;
      bestObj.driver = null;
      d.state = 'flee'; d.fleeT = 4; d.threat = { x: P.pos.x, z: P.pos.z };
      d.mesh.visible = true;
      d.pos.set(bestObj.mesh.position.x + 1.5, 0, bestObj.mesh.position.z);
    }
  }
}

// --- per-frame update --------------------------------------------------------------
function updateOnFoot(dt) {
  var K = SH.Keys;
  var moveX = 0, moveZ = 0;
  // camera-relative WASD
  var sin = Math.sin(camYaw), cos = Math.cos(camYaw);
  if (K['KeyW']) { moveX += -sin; moveZ += -cos; }
  if (K['KeyS']) { moveX += sin; moveZ += cos; }
  if (K['KeyA']) { moveX += -cos; moveZ += sin; }
  if (K['KeyD']) { moveX += cos; moveZ += -sin; }
  var moving = (moveX !== 0 || moveZ !== 0);
  var sprint = K['ShiftLeft'] || K['ShiftRight'];
  var speed = sprint ? C.tuning.playerSprint : C.tuning.playerWalk;

  if (moving) {
    var len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    moveX /= len; moveZ /= len;
    var want = U.bearing(moveX, moveZ);
    P.heading = U.lerpAngle(P.heading, want, Math.min(1, dt * 11));
    var nx = P.pos.x + moveX * speed * dt;
    var nz = P.pos.z + moveZ * speed * dt;
    var res = SH.City.collide(nx, nz, 0.42);
    P.pos.x = res.x; P.pos.z = res.z;
    phase += dt * speed * 2.1;
    SH.People.animateLimbs(mesh, phase, sprint ? 0.95 : 0.6);
    stepTimer -= dt;
    if (stepTimer <= 0 && grounded) { stepTimer = sprint ? 0.3 : 0.42; SH.Audio.step(); }
    // camera drifts to behind the hero while moving
    camYaw = U.lerpAngle(camYaw, P.heading + Math.PI, Math.min(1, dt * 1.6));
  } else {
    SH.People.animateLimbs(mesh, phase, 0.04);
  }

  // manual camera orbit
  if (K['ArrowLeft']) camYaw += dt * 1.9;
  if (K['ArrowRight']) camYaw -= dt * 1.9;
  if (K['ArrowUp']) camPitch = U.clamp(camPitch - dt * 0.8, 0.08, 0.9);
  if (K['ArrowDown']) camPitch = U.clamp(camPitch + dt * 0.8, 0.08, 0.9);

  // jump
  if (SH.KeysPressed['Space'] && grounded) { vy = 4.6; grounded = false; }
  if (!grounded) {
    vy -= 12.5 * dt;
    P.pos.y += vy * dt;
    if (P.pos.y <= 0) { P.pos.y = 0; grounded = true; vy = 0; }
  }
  mesh.rotation.y = P.heading;

  // interact prompt
  promptCar = nearestStealable();
  if (SH.HUD) SH.HUD.setPrompt(promptCar ? 'E — Enter ' + (promptCar.type === 'taxi' ? 'Taxi' : 'Vehicle') : null);
  if (SH.KeysPressed['KeyE'] && promptCar) enterCar(promptCar);
  if (SH.KeysPressed['KeyF']) shoot();

  // camera: smooth chase behind the hero
  var dist = 6.4;
  var cx = P.pos.x - Math.sin(camYaw) * Math.cos(camPitch) * dist * -1;
  var cz = P.pos.z - Math.cos(camYaw) * Math.cos(camPitch) * dist * -1;
  // (camYaw points from hero toward camera-back; forward is -sin/-cos)
  cx = P.pos.x + Math.sin(camYaw) * Math.cos(camPitch) * dist;
  cz = P.pos.z + Math.cos(camYaw) * Math.cos(camPitch) * dist;
  var cy = P.pos.y + 1.7 + Math.sin(camPitch) * dist;
  var cam = SH.camera;
  cam.position.x = U.lerp(cam.position.x, cx, Math.min(1, dt * 7));
  cam.position.y = U.lerp(cam.position.y, cy, Math.min(1, dt * 7));
  cam.position.z = U.lerp(cam.position.z, cz, Math.min(1, dt * 7));
  cam.lookAt(P.pos.x, P.pos.y + 1.55, P.pos.z);
}

function updateDriving(dt) {
  var K = SH.Keys;
  var car = P.car;
  if (!car) return;
  var control = { throttle: 0, steer: 0 };
  if (K['KeyW'] || K['ArrowUp']) control.throttle = 1;
  if (K['KeyS'] || K['ArrowDown']) control.throttle = -1;
  if (K['KeyA'] || K['ArrowLeft']) control.steer = 1;
  if (K['KeyD'] || K['ArrowRight']) control.steer = -1;
  SH.Vehicles.stepPlayerCar(car, dt, control);
  P.pos.copy(car.mesh.position);
  P.heading = car.heading;
  if (SH.HUD) SH.HUD.setPrompt(Math.abs(car.speed) < 1.2 ? 'E — Exit vehicle' : null);
  if (SH.KeysPressed['KeyE'] && Math.abs(car.speed) < 2.5) exitCar();

  SH.Audio.setEngine(U.clamp(Math.abs(car.speed) / car.maxSpeed, 0.08, 1));

  // camera chases the car's tail, widening with speed
  var back = 8.6 + Math.abs(car.speed) * 0.22;
  var tx = car.mesh.position.x - U.fwdX(car.heading) * back;
  var tz = car.mesh.position.z - U.fwdZ(car.heading) * back;
  var ty = 3.1 + Math.abs(car.speed) * 0.03;
  var cam = SH.camera;
  var k = Math.min(1, dt * 4.2);
  cam.position.x = U.lerp(cam.position.x, tx, k);
  cam.position.y = U.lerp(cam.position.y, ty, Math.min(1, dt * 3));
  cam.position.z = U.lerp(cam.position.z, tz, k);
  cam.lookAt(
    car.mesh.position.x + U.fwdX(car.heading) * 6,
    1.2,
    car.mesh.position.z + U.fwdZ(car.heading) * 6
  );
  camYaw = car.heading + Math.PI;
}

P.damage = function (amount, cause) {
  if (!P.alive || amount <= 0) return;
  P.health -= amount;
  lastDamageT = SH.G.time;
  if (P.health <= 0) {
    P.health = 0;
    P.alive = false;
    if (SH.Main) SH.Main.gameOver('wasted');
  }
};

P.onCarCrash = function (strength) {
  // hard hits in a car rattle the driver a little
  if (strength > 9) P.damage((strength - 9) * 0.55, 'crash');
  if (P.car && P.car.damage > 92) P.damage(1.2, 'wreck');
};

P.heal = function () {
  P.health = C.tuning.playerHealth;
  P.alive = true;
};

P.respawn = function (x, z) {
  if (P.inCar) { P.car.mode = 'off'; P.car.isPlayerCar = false; P.inCar = false; P.car = null; }
  mesh.visible = true;
  P.pos.set(x, 0, z);
  P.heal();
};

P.update = function (dt) {
  shotCooldown = Math.max(0, shotCooldown - dt);
  if (flashT > 0) { flashT -= dt; if (flashT <= 0) flashMesh.visible = false; }
  // slow regen once out of danger
  if (P.alive && P.health > 0 && P.health < C.tuning.playerHealth && SH.G.time - lastDamageT > 8) {
    P.health = Math.min(C.tuning.playerHealth, P.health + dt * 5);
  }
  if (!P.alive) return;
  if (P.inCar) updateDriving(dt);
  else updateOnFoot(dt);
};

// Camera snap used by shots and respawns.
P.placeCamera = function (x, y, z, lx, ly, lz) {
  SH.camera.position.set(x, y, z);
  SH.camera.lookAt(lx, ly, lz);
};

P.build = build;
P.enterCar = enterCar;
P.exitCar = exitCar;
P.shoot = shoot;
Object.defineProperty(P, 'speed', {
  get: function () { return P.inCar && P.car ? P.car.speed : 0; }
});

SH.Player = P;
})();
