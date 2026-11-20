// ============================================================================
// SOLSTICE HEAT — people.js
// Low-poly pedestrians: box torso, sphere head, swinging limbs. They stroll
// the sidewalk ring around each block, chat in pairs sometimes, sprint away
// from gunfire and fast cars, and fall down (simple ragdoll: tip over and
// stay down) when hit. The player character in player.js is built from the
// same factory with a distinctive Hawaiian-shirt texture.
// ============================================================================
(function () {
'use strict';
window.SH = window.SH || {};

var C = SH.Config;
var U = SH.U;
var peds = [];

var headGeo = new THREE.SphereGeometry(0.21, 10, 8);
var torsoGeo = new THREE.BoxGeometry(0.52, 0.72, 0.28);
var limbGeo = new THREE.BoxGeometry(0.16, 0.62, 0.16);
var legGeo = new THREE.BoxGeometry(0.18, 0.7, 0.18);

// Hawaiian shirt texture for the player (canvas flowers on teal).
function hawaiianTexture() {
  var cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  var g = cv.getContext('2d');
  g.fillStyle = '#0e8a7b';
  g.fillRect(0, 0, 64, 64);
  var cols = ['#ff5e7a', '#ffd94d', '#ffffff', '#ff9f43'];
  for (var i = 0; i < 14; i++) {
    g.fillStyle = cols[i % cols.length];
    var x = (i * 37) % 60 + 2, y = (i * 23) % 60 + 2;
    for (var p = 0; p < 5; p++) {
      g.beginPath();
      g.ellipse(x + Math.cos(p * 1.256) * 3.4, y + Math.sin(p * 1.256) * 3.4, 2.4, 1.4, p, 0, 6.29);
      g.fill();
    }
    g.fillStyle = '#ffe66d';
    g.beginPath(); g.arc(x, y, 1.6, 0, 6.29); g.fill();
  }
  var tex = new THREE.CanvasTexture(cv);
  return tex;
}
var hawaiiTex = null;

// Builds one character. opts: {shirt, skin, pants, player}
function makePersonMesh(opts) {
  var g = new THREE.Group();
  var skinMat = new THREE.MeshLambertMaterial({ color: opts.skin });
  var torsoMat;
  if (opts.player) {
    if (!hawaiiTex) hawaiiTex = hawaiianTexture();
    torsoMat = new THREE.MeshLambertMaterial({ map: hawaiiTex });
  } else {
    torsoMat = new THREE.MeshLambertMaterial({ color: opts.shirt });
  }
  var pantsMat = new THREE.MeshLambertMaterial({ color: opts.pants });

  var torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.position.y = 1.06;
  torso.castShadow = true;
  g.add(torso);
  var head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 1.66;
  head.castShadow = true;
  g.add(head);
  if (opts.player) {
    // sunglasses + a little cap brim make the hero readable in screenshots
    var shades = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.05),
      new THREE.MeshLambertMaterial({ color: 0x101014 }));
    shades.position.set(0, 1.7, 0.19);
    g.add(shades);
  }
  function limb(mat, x, y, geo) {
    var pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    var m = new THREE.Mesh(geo, mat);
    m.position.y = -geo.parameters.height / 2 + 0.04;
    m.castShadow = true;
    pivot.add(m);
    g.add(pivot);
    return pivot;
  }
  var parts = {
    armL: limb(skinMat, -0.35, 1.36, limbGeo),
    armR: limb(skinMat, 0.35, 1.36, limbGeo),
    legL: limb(pantsMat, -0.14, 0.72, legGeo),
    legR: limb(pantsMat, 0.14, 0.72, legGeo)
  };
  g.userData.parts = parts;
  return g;
}

// Swing limbs for walk cycle; phase advances with distance travelled.
function animateLimbs(mesh, phase, amp) {
  var p = mesh.userData.parts;
  if (!p) return;
  var s = Math.sin(phase) * amp;
  p.legL.rotation.x = s;
  p.legR.rotation.x = -s;
  p.armL.rotation.x = -s * 0.8;
  p.armR.rotation.x = s * 0.8;
}

function spawnPed(x, z, opts) {
  opts = opts || {};
  var r = SH.rng;
  var mesh = makePersonMesh({
    shirt: r.pick(C.palette.shirt),
    skin: r.pick(C.palette.skin),
    pants: r.pick(C.palette.pants),
    player: !!opts.player
  });
  mesh.position.set(x, 0, z);
  SH.scene.add(mesh);
  var ped = {
    mesh: mesh,
    pos: mesh.position,
    heading: r.range(0, Math.PI * 2),
    speed: 0,
    walkSpeed: r.range(1.1, 1.7),
    state: opts.state || 'walk',  // walk | flee | down | inCar | toCar | gone
    target: null,
    phase: r.range(0, 6),
    fleeT: 0,
    downT: 0,
    threat: null,
    isPlayerChar: !!opts.player
  };
  mesh.rotation.y = ped.heading;
  peds.push(ped);
  return ped;
}

function pickSidewalkTarget(ped, r) {
  // walk to a neighbouring intersection corner, axis by axis
  var p = SH.City.randomSidewalkPoint(r);
  ped.target = p;
}

function updatePed(ped, dt) {
  var pos = ped.pos;
  if (ped.state === 'down') {
    ped.downT += dt;
    return;
  }
  if (ped.state === 'inCar' || ped.state === 'gone') return;
  if (ped.state === 'wait') {
    // taxi passenger holding still, phone in hand, watching for the car
    animateLimbs(ped.mesh, ped.phase, 0.03);
    return;
  }

  var speed = ped.walkSpeed;
  if (ped.state === 'flee') {
    speed = 5.6;
    ped.fleeT -= dt;
    if (ped.threat) {
      var away = U.bearing(pos.x - ped.threat.x, pos.z - ped.threat.z);
      ped.target = { x: pos.x + U.fwdX(away) * 12, z: pos.z + U.fwdZ(away) * 12 };
    }
    if (ped.fleeT <= 0) { ped.state = 'walk'; ped.target = null; }
  }

  if (!ped.target) pickSidewalkTarget(ped, SH.rng);
  var t = ped.target;
  // axis-aligned stroll: finish x first, then z (keeps peds on sidewalks)
  var dx = t.x - pos.x, dz = t.z - pos.z;
  var mx = 0, mz = 0;
  if (Math.abs(dx) > 0.4) mx = Math.sign(dx);
  else if (Math.abs(dz) > 0.4) mz = Math.sign(dz);
  else { ped.target = null; return; }

  var want = U.bearing(mx, mz);
  ped.heading = U.lerpAngle(ped.heading, want, Math.min(1, dt * 8));
  var nx = pos.x + U.fwdX(ped.heading) * speed * dt;
  var nz = pos.z + U.fwdZ(ped.heading) * speed * dt;
  var res = SH.City.collide(nx, nz, 0.42);
  pos.x = res.x; pos.z = res.z;
  ped.phase += dt * speed * 3.4;
  animateLimbs(ped.mesh, ped.phase, ped.state === 'flee' ? 0.85 : 0.55);
  ped.mesh.rotation.y = ped.heading;

  // dodge: a fast car bearing down makes peds jump aside
  if (ped.state === 'walk' && SH.Vehicles) {
    var near = SH.Vehicles.nearestCar(pos.x, pos.z, 7);
    if (near && Math.abs(near.speed) > 7) {
      ped.state = 'flee';
      ped.fleeT = 1.6;
      ped.threat = { x: near.mesh.position.x, z: near.mesh.position.z };
    }
  }
}

SH.People = {
  list: peds,
  makePersonMesh: makePersonMesh,
  animateLimbs: animateLimbs,
  spawn: spawnPed,

  spawnCrowd: function (n) {
    var r = SH.rng;
    for (var i = 0; i < n; i++) {
      var p = SH.City.randomSidewalkPoint(r);
      // bias the crowd toward the beach and downtown so streets feel alive
      if (i % 3 === 0) { p.x = 150 + r.range(-30, 40); p.z = r.range(-120, 120); }
      spawnPed(p.x, p.z);
    }
  },

  // Everyone in radius runs from (x,z): gunfire, explosions, chaos.
  alertAt: function (x, z, radius) {
    for (var i = 0; i < peds.length; i++) {
      var ped = peds[i];
      if (ped.state !== 'walk') continue;
      if (U.dist2(x, z, ped.pos.x, ped.pos.z) < radius * radius) {
        ped.state = 'flee';
        ped.fleeT = 3.5;
        ped.threat = { x: x, z: z };
        ped.target = null;
      }
    }
  },

  nearestPed: function (x, z, maxDist, onlyStanding) {
    var best = null, bd = maxDist * maxDist;
    for (var i = 0; i < peds.length; i++) {
      var ped = peds[i];
      if (onlyStanding && ped.state !== 'walk' && ped.state !== 'flee') continue;
      var d = U.dist2(x, z, ped.pos.x, ped.pos.z);
      if (d < bd) { bd = d; best = ped; }
    }
    return best;
  },

  update: function (dt) {
    for (var i = 0; i < peds.length; i++) updatePed(peds[i], dt);
    // recycle peds that have been down a long while: an ambulance of
    // narrative convenience — they get up far away as fresh pedestrians.
    for (var j = 0; j < peds.length; j++) {
      var ped = peds[j];
      if (ped.state === 'down' && ped.downT > 26) {
        var p = SH.City.randomSidewalkPoint(SH.rng);
        ped.pos.set(p.x, 0, p.z);
        ped.mesh.rotation.set(0, ped.heading, 0);
        ped.state = 'walk';
        ped.downT = 0;
        ped.target = null;
      }
    }
  }
};

// knockDown lives on the ped prototype shape — attached per ped at spawn.
var baseSpawn = spawnPed;
spawnPed = function (x, z, opts) {
  var ped = baseSpawn(x, z, opts);
  ped.knockDown = function (speed, heading) {
    if (ped.state === 'down') return;
    ped.state = 'down';
    ped.downT = 0;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.pos.y = 0.25;
    // slide a little in the direction of the hit
    ped.pos.x += U.fwdX(heading) * Math.min(2.5, Math.abs(speed) * 0.22);
    ped.pos.z += U.fwdZ(heading) * Math.min(2.5, Math.abs(speed) * 0.22);
    if (SH.People) SH.People.alertAt(ped.pos.x, ped.pos.z, 16);
  };
  ped.shootDown = function () {
    if (ped.state === 'down') return;
    ped.state = 'down';
    ped.downT = 0;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.pos.y = 0.25;
  };
  return ped;
};
SH.People.spawn = spawnPed;
})();
