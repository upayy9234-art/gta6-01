// ============================================================================
// SOLSTICE HEAT — city.js
// Builds the whole of Solstice Bay procedurally from the fixed city seed:
// a 6x5 block grid of pastel art-deco buildings with canvas-texture windows
// and neon signs, palm trees, street lights, a sandy beach, the sea and a
// wooden pier on the east side. Also owns the static collision boxes and the
// road/sidewalk queries every other system uses.
// ============================================================================
(function () {
'use strict';
window.SH = window.SH || {};

var C = SH.Config;
var W = C.world;
var rng = new SH.RNG(C.citySeed);

var colliders = [];        // {x1,z1,x2,z2} building footprints
var parkingSpots = [];     // {x,z,heading} on lots and lay-bys
var windowMats = [];       // building materials (night emissive boost)
var lampGlows = [];        // street light glow sprites (night)
var signMats = [];         // neon sign materials (flicker)
var waterMat = null;
var waterMesh = null;
var built = false;

// --- canvas texture helpers --------------------------------------------------
function canvasTex(w, h, draw) {
  var cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  var tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return tex;
}

// Window textures come in pairs cut from the same seed so the lit windows
// line up: a pale facade (the map, tinted by the pastel building colour)
// and a black emissive sheet where only lit windows glow after dark.
function makeWindowPair(floors, cols, seed) {
  var r = new SH.RNG(seed);
  var litMap = [];
  var y, x;
  for (y = 0; y < floors; y++) {
    litMap.push([]);
    for (x = 0; x < cols; x++) litMap[y].push(r.next() < 0.42 ? (r.next() < 0.7 ? '#ffd98a' : '#bfe6ff') : null);
  }
  var facade = canvasTex(128, 256, function (g) {
    g.fillStyle = '#eef0ee';
    g.fillRect(0, 0, 128, 256);
    // deco vertical ribs
    g.fillStyle = 'rgba(120,110,90,0.18)';
    for (var i = 0; i <= cols; i++) g.fillRect(i * (128 / cols) - 1, 0, 2, 256);
    var fw = 128 / cols, fh = 256 / floors;
    for (y = 0; y < floors; y++) {
      for (x = 0; x < cols; x++) {
        g.fillStyle = litMap[y][x] ? '#c9a86a' : '#54626e';
        g.fillRect(x * fw + 3, y * fh + 4, fw - 6, fh - 8);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(x * fw + 3, y * fh + 4, fw - 6, 3);
      }
    }
  });
  var emissive = canvasTex(128, 256, function (g) {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, 128, 256);
    var fw = 128 / cols, fh = 256 / floors;
    for (y = 0; y < floors; y++) {
      for (x = 0; x < cols; x++) {
        if (!litMap[y][x]) continue;
        g.fillStyle = litMap[y][x];
        g.fillRect(x * fw + 3, y * fh + 4, fw - 6, fh - 8);
      }
    }
  });
  return { facade: facade, emissive: emissive };
}

function makeSignTexture(text, color) {
  return canvasTex(512, 96, function (g) {
    g.fillStyle = 'rgba(10,10,18,0.92)';
    g.fillRect(0, 0, 512, 96);
    g.font = 'bold 44px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = 22;
    g.fillStyle = color;
    g.fillText(text, 256, 50);
    g.shadowBlur = 8;
    g.fillText(text, 256, 50);
  });
}

function makeRoadTexture() {
  var tex = canvasTex(64, 128, function (g) {
    g.fillStyle = '#3c4148';
    g.fillRect(0, 0, 64, 128);
    // worn patches
    g.fillStyle = 'rgba(255,255,255,0.04)';
    for (var i = 0; i < 14; i++) g.fillRect(Math.random() * 60, Math.random() * 124, 4, 4);
    // centre dashes
    g.fillStyle = '#e8c766';
    g.fillRect(30, 8, 4, 44);
    g.fillRect(30, 76, 4, 44);
    // edge lines
    g.fillStyle = 'rgba(240,240,240,0.75)';
    g.fillRect(2, 0, 2, 128);
    g.fillRect(60, 0, 2, 128);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeRoadTextureH() {
  // horizontal-road variant: dashes run along U so east-west roads read right
  var tex = canvasTex(128, 64, function (g) {
    g.fillStyle = '#3c4148';
    g.fillRect(0, 0, 128, 64);
    g.fillStyle = 'rgba(255,255,255,0.04)';
    for (var i = 0; i < 14; i++) g.fillRect(Math.random() * 124, Math.random() * 60, 4, 4);
    g.fillStyle = '#e8c766';
    g.fillRect(8, 30, 44, 4);
    g.fillRect(76, 30, 44, 4);
    g.fillStyle = 'rgba(240,240,240,0.75)';
    g.fillRect(0, 2, 128, 2);
    g.fillRect(0, 60, 128, 2);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeCrosswalkTexture() {
  return canvasTex(128, 128, function (g) {
    g.fillStyle = '#3c4148';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(240,240,240,0.8)';
    for (var i = 0; i < 5; i++) g.fillRect(10, 12 + i * 24, 108, 11);
  });
}

function makeFrondTexture() {
  var tex = canvasTex(256, 256, function (g) {
    g.clearRect(0, 0, 256, 256);
    g.translate(128, 128);
    for (var i = 0; i < 9; i++) {
      g.save();
      g.rotate((i / 9) * Math.PI * 2 + 0.3);
      g.strokeStyle = '#1e7a46';
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(50, -16, 108, 10);
      g.stroke();
      g.lineWidth = 4.2;
      g.strokeStyle = '#2f9e5f';
      for (var s = 0; s < 7; s++) {
        var t = 22 + s * 14;
        g.beginPath();
        g.moveTo(t, -2 + s * 2);
        g.lineTo(t + 9, 12 + s * 3);
        g.stroke();
        g.beginPath();
        g.moveTo(t, -2 + s * 2);
        g.lineTo(t - 6, -14 + s);
        g.stroke();
      }
      g.restore();
    }
  });
  return tex;
}

function makeSandTexture() {
  var tex = canvasTex(128, 128, function (g) {
    g.fillStyle = '#e8cf9e';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(160,120,60,0.12)';
    for (var i = 0; i < 90; i++) g.fillRect(Math.random() * 127, Math.random() * 127, 2, 2);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(30, 30);
  return tex;
}

// Fake ambient occlusion: a soft dark radial blob placed under cars/props.
function makeBlobTexture() {
  return canvasTex(128, 128, function (g) {
    var grad = g.createRadialGradient(64, 64, 8, 64, 64, 62);
    grad.addColorStop(0, 'rgba(0,0,0,0.42)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  });
}

// --- sky dome ------------------------------------------------------------------
function buildSky(scene) {
  var geo = new THREE.SphereGeometry(900, 24, 12);
  var mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x3a6ea5) },
      mid: { value: new THREE.Color(0xff9e5e) },
      bot: { value: new THREE.Color(0xffe3b3) }
    },
    vertexShader: [
      'varying vec3 vP;',
      'void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 top; uniform vec3 mid; uniform vec3 bot;',
      'varying vec3 vP;',
      'void main(){',
      '  float h = normalize(vP).y;',
      '  vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, h)) : mix(bot, mid, smoothstep(-0.08, 0.12, h));',
      '  gl_FragColor = vec4(c, 1.0);',
      '}'
    ].join('\n')
  });
  var sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = -10;
  scene.add(sky);
  return mat;
}

// --- ground, roads, beach, sea, pier -----------------------------------------
function buildGround(scene) {
  var P = C.palette;

  // sand everywhere underneath
  var sand = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1000),
    new THREE.MeshLambertMaterial({ map: makeSandTexture(), color: 0xffffff })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(120, -0.05, 0);
  sand.receiveShadow = true;
  scene.add(sand);

  // paved city slab (sidewalk colour; roads are drawn over it)
  var slab = new THREE.Mesh(
    new THREE.PlaneGeometry(W.slabX2 - W.slabX1, W.slabZ2 - W.slabZ1),
    new THREE.MeshLambertMaterial({ color: P.slab })
  );
  slab.rotation.x = -Math.PI / 2;
  slab.position.set((W.slabX1 + W.slabX2) / 2, 0, (W.slabZ1 + W.slabZ2) / 2);
  slab.receiveShadow = true;
  scene.add(slab);

  // grass medians on the promenade strip
  var grass = new THREE.Mesh(
    new THREE.PlaneGeometry(5, W.slabZ2 - W.slabZ1),
    new THREE.MeshLambertMaterial({ color: P.grass })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(190.5, 0.01, 0);
  grass.receiveShadow = true;
  scene.add(grass);

  // roads
  var roadTex = makeRoadTexture();
  var roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  var i, j, mesh;
  for (i = 0; i < W.vx.length; i++) {
    var t = roadTex.clone();
    t.needsUpdate = true;
    t.repeat.set(1, 24);
    mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(W.roadHalf * 2, W.slabZ2 - W.slabZ1),
      new THREE.MeshLambertMaterial({ map: t })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(W.vx[i], 0.02, 0);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  for (j = 0; j < W.hz.length; j++) {
    var t2 = makeRoadTextureH();
    t2.repeat.set(26, 1);
    mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(W.slabX2 - W.slabX1, W.roadHalf * 2),
      new THREE.MeshLambertMaterial({ map: t2 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((W.slabX1 + W.slabX2) / 2, 0.02, W.hz[j]);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  // crosswalks on every intersection
  var crossMat = new THREE.MeshLambertMaterial({ map: makeCrosswalkTexture() });
  var crossGeo = new THREE.PlaneGeometry(W.roadHalf * 2, W.roadHalf * 2);
  for (i = 0; i < W.vx.length; i++) {
    for (j = 0; j < W.hz.length; j++) {
      mesh = new THREE.Mesh(crossGeo, crossMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(W.vx[i], 0.03, W.hz[j]);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }

  // the sea: big glossy plane east of the sand line
  waterMat = new THREE.MeshPhongMaterial({
    color: P.water, shininess: 140, specular: 0xffca7a, transparent: true, opacity: 0.94
  });
  waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(700, 1000), waterMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(W.sandX + 350, -0.25, 0);
  scene.add(waterMesh);

  // wooden pier reaching into the water at the marina
  var woodMat = new THREE.MeshLambertMaterial({ color: 0x9a744e });
  var deck = new THREE.Mesh(new THREE.BoxGeometry(66, 0.5, W.pierHalfZ * 2), woodMat);
  deck.position.set(228, 0.55, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  scene.add(deck);
  var postGeo = new THREE.CylinderGeometry(0.22, 0.22, 1.6, 6);
  for (var px = 200; px <= 258; px += 8) {
    for (var pz = -1; pz <= 1; pz += 2) {
      var post = new THREE.Mesh(postGeo, woodMat);
      post.position.set(px, -0.2, pz * (W.pierHalfZ - 0.4));
      scene.add(post);
    }
  }
  // marina mooring posts + a couple of simple boat hulls on the sand
  var hullMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  var hull2Mat = new THREE.MeshLambertMaterial({ color: 0x3f8fbf });
  [[214, -26, hullMat], [220, 30, hull2Mat]].forEach(function (b) {
    var hull = new THREE.Mesh(new THREE.BoxGeometry(7, 1.4, 2.6), b[2]);
    hull.position.set(b[0], 0.75, b[1]);
    hull.rotation.y = 0.4;
    hull.castShadow = true;
    scene.add(hull);
    var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5, 5), woodMat);
    mast.position.set(b[0], 3.4, b[1]);
    scene.add(mast);
  });
}

// --- buildings -----------------------------------------------------------------
var winTexCache = [];
function windowTextureFor(floors) {
  var key = Math.min(14, Math.max(3, floors));
  if (!winTexCache[key]) winTexCache[key] = makeWindowPair(key, 6, 900 + key * 37);
  return winTexCache[key];
}

function addBuilding(scene, cx, cz, w, d, h, colorHex, sign) {
  var floors = Math.max(3, Math.round(h / 3.1));
  var pair = windowTextureFor(floors);
  var mat = new THREE.MeshLambertMaterial({
    color: colorHex, emissive: 0xffc978, emissiveIntensity: 0,
    emissiveMap: pair.emissive, map: pair.facade
  });
  var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(cx, h / 2, cz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  windowMats.push(mat);
  colliders.push({ x1: cx - w / 2, z1: cz - d / 2, x2: cx + w / 2, z2: cz + d / 2 });

  // deco crown: a lighter slab on top, very Miami
  var crown = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.7, 0.8, d * 0.7),
    new THREE.MeshLambertMaterial({ color: 0xfff4e0 })
  );
  crown.position.set(cx, h + 0.4, cz);
  crown.castShadow = true;
  scene.add(crown);

  if (sign) {
    var sTex = makeSignTexture(sign.name, sign.color);
    var sMat = new THREE.MeshBasicMaterial({ map: sTex, transparent: true });
    var sp = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.92, 15), 2.6), sMat);
    // face the sign toward the nearest road (south face by default)
    sp.position.set(cx, Math.min(h - 1.6, 7.5), cz + d / 2 + 0.06);
    scene.add(sp);
    signMats.push(sMat);
  }
  return mesh;
}

function blockRect(col, row) {
  return {
    x1: W.vx[col] + W.roadHalf, x2: W.vx[col + 1] - W.roadHalf,
    z1: W.hz[row] + W.roadHalf, z2: W.hz[row + 1] - W.roadHalf
  };
}

function buildBlocks(scene) {
  var P = C.palette;
  var signByBlock = {};
  C.namedBuildings.forEach(function (nb) {
    signByBlock[nb[0] + ',' + nb[1]] = { name: nb[2], color: nb[3] };
  });

  for (var col = 0; col < 6; col++) {
    for (var row = 0; row < 5; row++) {
      var r = blockRect(col, row);
      var cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2;
      var sign = signByBlock[col + ',' + row] || null;
      var roll = rng.next();
      var downtown = (col >= 2 && col <= 3);
      var eastSide = col >= 4;

      if (!sign && roll < 0.13) {
        // parking lot block: flat asphalt, marked spots, a few palms
        var lot = new THREE.Mesh(
          new THREE.PlaneGeometry(W.blockSize - 2, W.blockSize - 2),
          new THREE.MeshLambertMaterial({ color: 0x4a4f55 })
        );
        lot.rotation.x = -Math.PI / 2;
        lot.position.set(cx, 0.04, cz);
        lot.receiveShadow = true;
        scene.add(lot);
        for (var s = 0; s < 4; s++) {
          parkingSpots.push({ x: r.x1 + 7 + s * 9.5, z: r.z1 + 8, heading: Math.PI });
          parkingSpots.push({ x: r.x1 + 7 + s * 9.5, z: r.z2 - 8, heading: 0 });
        }
        addPalm(scene, r.x1 + 3.5, r.z1 + 3.5);
        addPalm(scene, r.x2 - 3.5, r.z2 - 3.5);
        continue;
      }
      if (!sign && roll < 0.24) {
        // pocket park: grass, palms, benches — no colliders, drive-through-able
        var park = new THREE.Mesh(
          new THREE.PlaneGeometry(W.blockSize - 2, W.blockSize - 2),
          new THREE.MeshLambertMaterial({ color: P.grass })
        );
        park.rotation.x = -Math.PI / 2;
        park.position.set(cx, 0.04, cz);
        park.receiveShadow = true;
        scene.add(park);
        for (var p = 0; p < 6; p++) {
          addPalm(scene, rng.range(r.x1 + 4, r.x2 - 4), rng.range(r.z1 + 4, r.z2 - 4));
        }
        continue;
      }

      // built block: 1 tower downtown, otherwise 2-4 smaller buildings
      var color = P.deco[rng.int(0, P.deco.length - 1)];
      if (downtown && rng.chance(0.55)) {
        var th = rng.range(26, 46);
        addBuilding(scene, cx, cz, rng.range(20, 26), rng.range(20, 26), th, color, sign);
      } else {
        var n = sign ? 1 : rng.int(2, 3);
        var cells = [[-11, -11], [11, -11], [-11, 11], [11, 11]];
        rng.shuffle(cells);
        for (var b = 0; b < n; b++) {
          var bx = cx + cells[b][0], bz = cz + cells[b][1];
          var bh = eastSide ? rng.range(9, 20) : rng.range(7, 17);
          addBuilding(scene, bx, bz, rng.range(15, 19), rng.range(15, 19), bh,
            P.deco[rng.int(0, P.deco.length - 1)], b === 0 ? sign : null);
        }
      }
    }
  }
}

// --- palms + street lights -------------------------------------------------------
var trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 5.4, 6);
var trunk2Geo = new THREE.CylinderGeometry(0.11, 0.16, 2.6, 6);
var frondGeo = new THREE.PlaneGeometry(9.2, 9.2);
var trunkMat = new THREE.MeshLambertMaterial({ color: C.palette.palmTrunk });
var frondMat = null;

function addPalm(scene, x, z) {
  if (!frondMat) {
    frondMat = new THREE.MeshLambertMaterial({
      map: makeFrondTexture(), transparent: true, alphaTest: 0.35,
      side: THREE.DoubleSide, color: 0xffffff
    });
  }
  var g = new THREE.Group();
  var lean = rng.range(-0.09, 0.09);
  var t1 = new THREE.Mesh(trunkGeo, trunkMat);
  t1.position.y = 2.7;
  t1.rotation.z = lean;
  t1.castShadow = true;
  g.add(t1);
  var t2 = new THREE.Mesh(trunk2Geo, trunkMat);
  t2.position.set(lean * -14, 6.2, 0);
  t2.rotation.z = lean * 2.2;
  t2.castShadow = true;
  g.add(t2);
  var fronds = new THREE.Mesh(frondGeo, frondMat);
  fronds.position.set(lean * -22, 7.6, 0);
  fronds.rotation.x = -Math.PI / 2 + rng.range(-0.25, 0.25);
  fronds.rotation.z = rng.range(0, Math.PI);
  fronds.castShadow = true;
  g.add(fronds);
  // a second, tilted crown plane so the fronds read from low angles too
  var fronds2 = new THREE.Mesh(frondGeo, frondMat);
  fronds2.position.set(lean * -22, 7.35, 0);
  fronds2.rotation.x = -Math.PI / 2 + rng.range(0.35, 0.55);
  fronds2.rotation.y = rng.range(0, Math.PI);
  fronds2.rotation.z = rng.range(0, Math.PI);
  g.add(fronds2);
  g.position.set(x, 0, z);
  scene.add(g);
  colliders.push({ x1: x - 0.35, z1: z - 0.35, x2: x + 0.35, z2: z + 0.35 });
  return g;
}

function buildGreenery(scene) {
  // palms along the promenade and the beach edge
  for (var z = -150; z <= 150; z += 15) {
    if (Math.abs(z) > 6) addPalm(scene, 187.5, z + rng.range(-2, 2));
    if (rng.chance(0.6)) addPalm(scene, 203 + rng.range(0, 14), z + rng.range(-4, 4));
  }
  // palms on street corners all over town
  for (var i = 0; i < W.vx.length; i++) {
    for (var j = 0; j < W.hz.length; j++) {
      if (rng.chance(0.4)) {
        addPalm(scene, W.vx[i] + (rng.chance(0.5) ? 9.4 : -9.4), W.hz[j] + (rng.chance(0.5) ? 9.4 : -9.4));
      }
    }
  }
}

var poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.6, 6);
var poleMat = new THREE.MeshLambertMaterial({ color: 0x555c63 });
var lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
var glowTex = null;

function addStreetLight(scene, x, z, rotY) {
  var g = new THREE.Group();
  var pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 2.8;
  g.add(pole);
  var arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 1.7), poleMat);
  arm.position.set(0, 5.5, 0.8);
  g.add(arm);
  var head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.6), lampHeadMat);
  head.position.set(0, 5.45, 1.6);
  g.add(head);
  if (!glowTex) glowTex = makeBlobTexture();
  var sm = new THREE.SpriteMaterial({
    map: glowTex, color: 0xffd9a0, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  var spr = new THREE.Sprite(sm);
  spr.scale.set(7, 7, 1);
  spr.position.set(0, 5.4, 1.6);
  g.add(spr);
  lampGlows.push(sm);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  scene.add(g);
  colliders.push({ x1: x - 0.2, z1: z - 0.2, x2: x + 0.2, z2: z + 0.2 });
}

function buildLights(scene) {
  // lights at the outer corners of intersections, arms over the road
  for (var i = 0; i < W.vx.length; i++) {
    for (var j = 0; j < W.hz.length; j++) {
      if ((i + j) % 2 === 0) {
        addStreetLight(scene, W.vx[i] - 8.2, W.hz[j] - 8.2, Math.PI * 0.75);
        addStreetLight(scene, W.vx[i] + 8.2, W.hz[j] + 8.2, -Math.PI * 0.25);
      }
    }
  }
  // promenade lights facing the sea
  for (var z = -145; z <= 145; z += 29) {
    addStreetLight(scene, 193.5, z, Math.PI / 2);
  }
}

// --- district markers ------------------------------------------------------------
function buildDistrictSigns(scene) {
  // One floating name board per district column along Bayfront Pkwy.
  for (var col = 0; col < 6; col++) {
    var name = C.districts.cols[col].toUpperCase();
    var tex = makeSignTexture(name, '#8ef6ff');
    var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    var board = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.4), mat);
    var x = (W.vx[col] + W.vx[col + 1]) / 2;
    board.position.set(x, 6.4, 29 - W.roadHalf - 0.4);
    scene.add(board);
    var postG = new THREE.CylinderGeometry(0.09, 0.09, 6.4, 6);
    [-5.4, 5.4].forEach(function (off) {
      var post = new THREE.Mesh(postG, poleMat);
      post.position.set(x + off, 3.2, 29 - W.roadHalf - 0.4);
      scene.add(post);
    });
  }
}

// --- public API --------------------------------------------------------------------
SH.City = {
  colliders: colliders,
  parkingSpots: parkingSpots,
  skyMat: null,

  build: function (scene) {
    if (built) return;
    built = true;
    this.skyMat = buildSky(scene);
    buildGround(scene);
    buildBlocks(scene);
    buildGreenery(scene);
    buildLights(scene);
    buildDistrictSigns(scene);
  },

  // Push a circle (x,z,r) out of every building box; returns corrected
  // position plus whether a hit happened (and its rough strength axis).
  collide: function (x, z, r) {
    var hit = false;
    for (var i = 0; i < colliders.length; i++) {
      var b = colliders[i];
      var nx = SH.U.clamp(x, b.x1, b.x2);
      var nz = SH.U.clamp(z, b.z1, b.z2);
      var dx = x - nx, dz = z - nz;
      var d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 0.000001) {
          var d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          // centre inside the box: push out along the smallest penetration
          var pl = x - b.x1, pr = b.x2 - x, pt = z - b.z1, pb = b.z2 - z;
          var m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = b.x1 - r;
          else if (m === pr) x = b.x2 + r;
          else if (m === pt) z = b.z1 - r;
          else z = b.z2 + r;
        }
      }
    }
    // world bounds: the sea stops everyone except pier walkers
    var maxX = (Math.abs(z) < W.pierHalfZ && x > 196) ? W.pierX : W.worldX2;
    x = SH.U.clamp(x, W.worldX1, maxX);
    z = SH.U.clamp(z, W.worldZ1, W.worldZ2);
    return { x: x, z: z, hit: hit };
  },

  isRoad: function (x, z) {
    var i;
    for (i = 0; i < W.vx.length; i++) if (Math.abs(x - W.vx[i]) <= W.roadHalf) return true;
    for (i = 0; i < W.hz.length; i++) if (Math.abs(z - W.hz[i]) <= W.roadHalf) return true;
    return false;
  },

  isBeach: function (x) { return x > W.slabX2; },

  // A random point in a driving lane, plus the road direction there.
  randomLanePoint: function (r) {
    if (r.chance(0.5)) {
      var vx = r.pick(W.vx);
      var dir = r.chance(0.5) ? 1 : -1;
      return { x: vx - dir * W.lane, z: r.range(W.slabZ1 + 10, W.slabZ2 - 10), heading: dir > 0 ? 0 : Math.PI, vertical: true };
    }
    var hz = r.pick(W.hz);
    var dir2 = r.chance(0.5) ? 1 : -1;
    return { x: r.range(W.slabX1 + 10, W.slabX2 - 20), z: hz + dir2 * W.lane, heading: dir2 > 0 ? Math.PI / 2 : -Math.PI / 2, vertical: false };
  },

  // A random sidewalk corner point (where pedestrians stroll).
  randomSidewalkPoint: function (r) {
    var i = r.int(0, W.vx.length - 1);
    var j = r.int(0, W.hz.length - 1);
    return {
      x: W.vx[i] + (r.chance(0.5) ? 9.3 : -9.3),
      z: W.hz[j] + (r.chance(0.5) ? 9.3 : -9.3)
    };
  },

  // Street-name flavour for the HUD when entering a new road.
  streetAt: function (x, z) {
    var i, best = null, bd = 1e9;
    for (i = 0; i < W.vx.length; i++) { var d = Math.abs(x - W.vx[i]); if (d < bd) { bd = d; best = C.streetsV[i]; } }
    for (i = 0; i < W.hz.length; i++) { var d2 = Math.abs(z - W.hz[i]); if (d2 < bd) { bd = d2; best = C.streetsH[i]; } }
    return best;
  },

  districtAt: function (x, z) {
    var col = 0, row = 0, i;
    for (i = 0; i < 6; i++) if (x > (W.vx[i] + W.vx[i + 1]) / 2) col = i;
    for (i = 0; i < 5; i++) if (z > (W.hz[i] + W.hz[i + 1]) / 2) row = i;
    if (x > W.slabX2) return 'Solstice Beach';
    return C.districts.cols[col] + ' · ' + C.districts.rows[row];
  },

  // dayF: 0 = full day, 1 = full night. Drives windows, lamps, water.
  setNight: function (f) {
    var i;
    for (i = 0; i < windowMats.length; i++) windowMats[i].emissiveIntensity = f * 0.85;
    for (i = 0; i < lampGlows.length; i++) lampGlows[i].opacity = f * 0.55;
    if (waterMat) waterMat.color.setHex(f > 0.5 ? C.palette.waterDeep : C.palette.water);
  },

  update: function (dt, t) {
    // gentle water shimmer: slide the sea a breath in and out
    if (waterMesh) waterMesh.position.x = W.sandX + 350 + Math.sin(t * 0.24) * 2.2;
    // one random neon sign flickers now and then
    if (signMats.length && Math.random() < dt * 0.7) {
      var m = signMats[Math.floor(Math.random() * signMats.length)];
      m.opacity = 0.55;
      setTimeout(function () { m.opacity = 1; }, 70);
    }
  },

  blobTexture: makeBlobTexture
};
})();
