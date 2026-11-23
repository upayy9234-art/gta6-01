// Solstice Heat: Neon Tide — buildings.js
// Building mesh factory: towers, neon low-rises, warehouses, casino, lighthouse.
// Canvas window textures light up at night. Registers collision boxes into SH.city.
window.SH = window.SH || {};
SH.buildings = (function () {
  'use strict';
  var R = SH.random;
  var texCache = {};
  function windowTexture(base, litRatio, seedN) {
    var key = base + ':' + litRatio + ':' + seedN;
    if (texCache[key]) return texCache[key];
    var c = document.createElement('canvas'); c.width = 128; c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 128, 256);
    var rr = R.next; // draw with local deterministic hash instead of stream
    function h(x, y) { var v = Math.sin(x * 41.3 + y * 17.7 + seedN * 91.1) * 43758.5; return v - Math.floor(v); }
    for (var y = 0; y < 16; y++) for (var x = 0; x < 8; x++) {
      var lit = h(x, y) < litRatio;
      g.fillStyle = lit ? '#ffd98a' : '#1c2733';
      g.fillRect(6 + x * 15, 8 + y * 15, 9, 9);
    }
    var tex = new THREE.CanvasTexture(c);
    texCache[key] = tex; void rr;
    return tex;
  }
  var nightLit = 0.15;
  function setNightLit(v) { nightLit = v; }
  function mat(color, rough) {
    return new THREE.MeshLambertMaterial({ color: color, roughness: rough || 0.9 });
  }
  function box(w, h, d, material) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.castShadow = false; m.receiveShadow = false;
    return m;
  }
  // Creates a building group at x,z with footprint w,d and height h. Returns group.
  function makeBuilding(scene, x, z, w, d, h, district, kind, colliders) {
    var grp = new THREE.Group();
    var seedN = Math.floor(Math.abs(x * 3 + z * 7)) % 97;
    var tex = windowTexture('#' + new THREE.Color(district.color).getHexString(), nightLit, seedN);
    var wallMat = new THREE.MeshLambertMaterial({ map: tex });
    var body = box(w, h, d, wallMat); body.position.y = h / 2; grp.add(body);
    var roof = box(w + 0.6, 0.8, d + 0.6, mat(district.roof)); roof.position.y = h + 0.4; grp.add(roof);
    if (kind === 'tower') {
      var cap = box(w * 0.5, h * 0.18, d * 0.5, mat(district.roof)); cap.position.y = h + h * 0.09; grp.add(cap);
      var ant = box(0.3, 6, 0.3, mat(0x333333)); ant.position.y = h + h * 0.18 + 3; grp.add(ant);
      var beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2244 });
      var beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), beaconMat);
      beacon.position.y = h + h * 0.18 + 6.2; beacon.name = 'beacon'; grp.add(beacon);
    }
    if (kind === 'neon' || kind === 'casino') {
      var signMat = new THREE.MeshBasicMaterial({ color: district.neon });
      var sign = box(w * 0.8, 1.6, 0.3, signMat);
      sign.position.set(0, h * 0.72, d / 2 + 0.25); sign.name = 'neonsign'; grp.add(sign);
      var sign2 = sign.clone(); sign2.position.z = -d / 2 - 0.25; grp.add(sign2);
      var trim = box(w + 0.4, 0.5, d + 0.4, signMat); trim.position.y = h + 0.9; trim.name = 'neonsign'; grp.add(trim);
    }
    if (kind === 'warehouse') {
      var door = box(w * 0.4, 4, 0.3, mat(0x3c4653)); door.position.set(0, 2, d / 2 + 0.1); grp.add(door);
      for (var i = 0; i < 3; i++) {
        var crate = box(2.2, 2.2, 2.2, mat([0xb08968, 0x7f5539, 0x606c38][i % 3]));
        crate.position.set(-w / 2 + 3 + i * 3, 1.1, d / 2 + 2.4); grp.add(crate);
      }
    }
    if (kind === 'casino') {
      var marquee = box(w * 1.02, 3, 1.2, new THREE.MeshBasicMaterial({ color: 0xffe14d }));
      marquee.position.set(0, 4.5, d / 2 + 0.6); marquee.name = 'casinoSign'; grp.add(marquee);
      for (var s = -1; s <= 1; s += 2) {
        var pillar = box(1, 7, 1, mat(0xf5e6c8)); pillar.position.set(s * w * 0.38, 3.5, d / 2 + 0.8); grp.add(pillar);
      }
    }
    grp.position.set(x, 0, z);
    scene.add(grp);
    if (colliders) colliders.push({ x: x, z: z, hw: w / 2, hd: d / 2, h: h });
    return grp;
  }
  function makeLighthouse(scene, x, z, colliders) {
    var grp = new THREE.Group();
    var white = mat(0xf4f1de), red = mat(0xe63946);
    for (var i = 0; i < 4; i++) {
      var seg = new THREE.Mesh(new THREE.CylinderGeometry(3.4 - i * 0.35, 3.7 - i * 0.35, 5, 12), i % 2 ? red : white);
      seg.position.y = 2.5 + i * 5; grp.add(seg);
    }
    var lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3, 10), mat(0x222831));
    lampRoom.position.y = 21.5; grp.add(lampRoom);
    var lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6a8 });
    var lamp = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), lampMat);
    lamp.position.y = 21.5; lamp.name = 'lighthouseLamp'; grp.add(lamp);
    var beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
    var beam = new THREE.Mesh(new THREE.ConeGeometry(7, 60, 12, 1, true), beamMat);
    beam.rotation.z = Math.PI / 2; beam.position.set(30, 21.5, 0); beam.name = 'lighthouseBeam'; grp.add(beam);
    var top = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2.6, 10), red); top.position.y = 24.4; grp.add(top);
    grp.position.set(x, 0, z); scene.add(grp);
    if (colliders) colliders.push({ x: x, z: z, hw: 3.6, hd: 3.6, h: 24 });
    return grp;
  }
  function makePalm(scene, x, z, scale) {
    var grp = new THREE.Group();
    var trunkMat = mat(0x8a6642), leafMat = mat(0x2e933c);
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 5.5, 6), trunkMat);
    trunk.position.y = 2.75; trunk.rotation.z = (R.noise2(x, z) - 0.5) * 0.22; grp.add(trunk);
    for (var i = 0; i < 6; i++) {
      var leaf = box(0.5, 0.08, 3.4, leafMat);
      var a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.sin(a) * 1.4, 5.6 + (i % 2) * 0.25, Math.cos(a) * 1.4);
      leaf.rotation.y = -a; leaf.rotation.z = 0.5; grp.add(leaf);
    }
    grp.position.set(x, 0, z); grp.scale.setScalar(scale || 1);
    scene.add(grp); return grp;
  }
  function makeLamp(scene, x, z) {
    var grp = new THREE.Group();
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.4, 6), mat(0x2b2f36));
    pole.position.y = 2.7; grp.add(pole);
    var headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), headMat);
    head.position.y = 5.5; head.name = 'lampHead'; grp.add(head);
    grp.position.set(x, 0, z); scene.add(grp); return grp;
  }
  function makeBillboard(scene, x, z, ry, colorHex, colliders) {
    var grp = new THREE.Group();
    var pole = box(0.5, 8, 0.5, mat(0x3a3f47)); pole.position.y = 4; grp.add(pole);
    var face = box(11, 4.4, 0.4, new THREE.MeshBasicMaterial({ color: colorHex }));
    face.position.y = 9.6; face.name = 'billboard'; grp.add(face);
    var back = box(11.4, 4.8, 0.3, mat(0x22262c)); back.position.set(0, 9.6, -0.25); grp.add(back);
    grp.position.set(x, 0, z); grp.rotation.y = ry; scene.add(grp);
    if (colliders) colliders.push({ x: x, z: z, hw: 0.6, hd: 0.6, h: 8 });
    return grp;
  }
  function makeBench(scene, x, z, ry) {
    var grp = new THREE.Group();
    var seat = box(2.2, 0.18, 0.7, mat(0x9c6644)); seat.position.y = 0.55; grp.add(seat);
    var backB = box(2.2, 0.7, 0.14, mat(0x9c6644)); backB.position.set(0, 1.0, -0.3); grp.add(backB);
    grp.position.set(x, 0, z); grp.rotation.y = ry; scene.add(grp); return grp;
  }
  function makeHydrant(scene, x, z) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.9, 8), mat(0xd62828));
    m.position.set(x, 0.45, z); scene.add(m); return m;
  }
  return {
    makeBuilding: makeBuilding, makeLighthouse: makeLighthouse, makePalm: makePalm,
    makeLamp: makeLamp, makeBillboard: makeBillboard, makeBench: makeBench,
    makeHydrant: makeHydrant, setNightLit: setNightLit, windowTexture: windowTexture
  };
})();
