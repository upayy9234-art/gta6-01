// Solstice Heat - procedural pastel art-deco beach city, "Solstice Bay".
// Builds roads, named districts, lit buildings, palms, beach, ocean,
// the Marina Pier, billboards, street lights and props from one seed.
// Exports road data for the minimap, traffic AI and race routes.
window.SH = window.SH || {};
(function (SH) {
  'use strict';
  var U = SH.U, C = SH.Config;
  var City = { colliders: [], roadsX: [], roadsZ: [], blocks: [], lamps: [], districtAt: null };
  SH.City = City;

  function districtAt(x, z) {
    var best = null, bd = 1e9;
    for (var i = 0; i < C.DISTRICTS.length; i++) {
      var d = C.DISTRICTS[i], dist = U.dist2d(x, z, d.cx, d.cz);
      if (dist < bd) { bd = dist; best = d; }
    }
    return best;
  }
  City.districtAt = districtAt;
  City.districtNameAt = function (x, z) { var d = districtAt(x, z); return d ? d.name : 'Solstice Bay'; };

  City.build = function (scene, seed) {
    var rng = new SH.RNG(seed * 131 + 17);
    City.rng = rng;
    var g = new THREE.Group(); scene.add(g); City.group = g;
    // Road grid lines (coordinates of road centres).
    var coords = [];
    for (var v = -5; v <= 5; v++) coords.push(v * C.BLOCK);
    City.roadsX = coords.slice(); City.roadsZ = coords.slice();

    var groundMat = new THREE.MeshLambertMaterial({ color: 0x9db38a });
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.08; g.add(ground);

    var roadMat = new THREE.MeshLambertMaterial({ color: 0x3c4148 });
    City.roadMat = roadMat;
    var walkMat = new THREE.MeshLambertMaterial({ color: 0xd8cfc0 });
    coords.forEach(function (c) {
      var rv = new THREE.Mesh(new THREE.PlaneGeometry(C.ROAD_W, 880), roadMat);
      rv.rotation.x = -Math.PI / 2; rv.position.set(c, 0.01, 0); g.add(rv);
      var rh = new THREE.Mesh(new THREE.PlaneGeometry(880, C.ROAD_W), roadMat);
      rh.rotation.x = -Math.PI / 2; rh.position.set(0, 0.01, c); g.add(rh);
      [-1, 1].forEach(function (s) {
        var wv = new THREE.Mesh(new THREE.PlaneGeometry(C.SIDEWALK_W, 880), walkMat);
        wv.rotation.x = -Math.PI / 2; wv.position.set(c + s * (C.ROAD_W / 2 + C.SIDEWALK_W / 2), 0.03, 0); g.add(wv);
        var wh = new THREE.Mesh(new THREE.PlaneGeometry(880, C.SIDEWALK_W), walkMat);
        wh.rotation.x = -Math.PI / 2; wh.position.set(0, 0.03, c + s * (C.ROAD_W / 2 + C.SIDEWALK_W / 2)); g.add(wh);
      });
    });
    // Centre dashes.
    var dashMat = new THREE.MeshBasicMaterial({ color: 0xf7e08a });
    coords.forEach(function (c) {
      for (var d = -420; d < 420; d += 14) {
        var dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), dashMat);
        dash.rotation.x = -Math.PI / 2; dash.position.set(c, 0.04, d); g.add(dash);
        var dash2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), dashMat);
        dash2.rotation.x = -Math.PI / 2; dash2.position.set(d, 0.04, c); g.add(dash2);
      }
    });

    // Beach + ocean.
    var sand = new THREE.Mesh(new THREE.PlaneGeometry(150, 1100), new THREE.MeshLambertMaterial({ color: 0xf2ddae }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(392, 0.02, 0); g.add(sand);
    var waterMat = new THREE.MeshLambertMaterial({ color: 0x2e9bc6, transparent: true, opacity: 0.88 });
    var water = new THREE.Mesh(new THREE.PlaneGeometry(500, 1200), waterMat);
    water.rotation.x = -Math.PI / 2; water.position.set(690, 0.25, 0); g.add(water);
    City.water = water;

    // Marina Pier: deck, posts, lamp posts and a ferris silhouette.
    var pierMat = new THREE.MeshLambertMaterial({ color: 0x9a6b4f });
    var pier = new THREE.Mesh(new THREE.BoxGeometry(150, 1.4, 16), pierMat);
    pier.position.set(470, 1.1, -260); g.add(pier);
    for (var px = 405; px < 540; px += 18) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 6), pierMat);
      post.position.set(px, -0.4, -266); g.add(post);
      var post2 = post.clone(); post2.position.z = -254; g.add(post2);
    }
    City.pierEnd = { x: 535, z: -260 };

    // Buildings per block.
    var winMat = new THREE.MeshBasicMaterial({ color: 0xffe9a3 });
    City.windowMats = [];
    for (var bi = 0; bi < coords.length - 1; bi++) {
      for (var bj = 0; bj < coords.length - 1; bj++) {
        var cx = (coords[bi] + coords[bi + 1]) / 2, cz = (coords[bj] + coords[bj + 1]) / 2;
        if (cx > C.BEACH_X - 40) continue;
        var dist = districtAt(cx, cz);
        if (!rng.chance(dist.density)) continue;
        var w = rng.range(20, 30), dpt = rng.range(20, 30);
        var h = rng.range(dist.minH, dist.maxH);
        var col = rng.pick(C.BUILDING_COLORS);
        var mat = new THREE.MeshLambertMaterial({ color: col });
        var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, dpt), mat);
        b.position.set(cx + rng.range(-6, 6), h / 2, cz + rng.range(-6, 6)); g.add(b);
        var roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1.5, 1.2, dpt + 1.5), new THREE.MeshLambertMaterial({ color: rng.pick(C.ROOF_COLORS) }));
        roof.position.set(b.position.x, h + 0.6, b.position.z); g.add(roof);
        // Lit windows: small emissive planes on two faces.
        var wm = new THREE.MeshBasicMaterial({ color: 0xffe9a3 });
        City.windowMats.push(wm);
        var rows = Math.floor(h / 4), cols = Math.floor(w / 4);
        for (var r = 0; r < rows; r++) for (var cc = 0; cc < cols; cc++) {
          if (!rng.chance(0.45)) continue;
          var win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.9), wm);
          win.position.set(b.position.x - w / 2 + 2.4 + cc * 4, 2.6 + r * 4, b.position.z + dpt / 2 + 0.06);
          g.add(win);
        }
        City.colliders.push({ x: b.position.x, z: b.position.z, hw: w / 2 + 0.4, hd: dpt / 2 + 0.4 });
        City.blocks.push({ x: b.position.x, z: b.position.z, h: h, district: dist.name });
      }
    }

    // Palms along roads and beach.
    var trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6844 });
    var leafMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
    function palm(x, z) {
      var p = new THREE.Group();
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 6.5, 6), trunkMat);
      trunk.position.y = 3.25; trunk.rotation.z = rng.range(-0.08, 0.08); p.add(trunk);
      for (var k = 0; k < 5; k++) {
        var leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 4.4, 4), leafMat);
        leaf.position.y = 6.6; leaf.rotation.z = 1.15; leaf.rotation.y = k * (Math.PI * 2 / 5);
        leaf.position.x = Math.sin(k * 2.1) * 1.1; leaf.position.z = Math.cos(k * 2.1) * 1.1; p.add(leaf);
      }
      p.position.set(x, 0, z); g.add(p);
    }
    coords.forEach(function (c) { for (var d = -400; d < 420; d += 55) { if (rng.chance(0.7)) palm(c + 11, d + rng.range(-4, 4)); } });
    for (var bx = 350; bx < 430; bx += 16) for (var bz = -420; bz < 430; bz += 42) if (rng.chance(0.5)) palm(bx + rng.range(-3, 3), bz + rng.range(-6, 6));

    // Street lamps (light cones appear at night via shared material opacity).
    var poleMat = new THREE.MeshLambertMaterial({ color: 0x444a52 });
    City.lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0 });
    coords.forEach(function (c) {
      for (var d = -400; d < 420; d += 80) {
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 5.6, 5), poleMat);
        pole.position.set(c + 9, 2.8, d); g.add(pole);
        var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), City.lampGlowMat);
        bulb.position.set(c + 9, 5.7, d); g.add(bulb);
        City.lamps.push({ x: c + 9, z: d });
      }
    });

    // Billboards with canvas text.
    City.billboards = [];
    var BB = [['SOLSTICE HEAT', 'the bay is yours'], ['MARISOL VEGA', 'fixes everything'], ['BAYWAVE FM', 'synth all night'], ['VISIT THE PIER', 'golden hour daily'], ['DECO DINERS', 'cafecito 24h'], ['NEON MILE', 'shop the glow']];
    BB.forEach(function (bb, i) {
      var cv = document.createElement('canvas'); cv.width = 512; cv.height = 192;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = ['#1b1035', '#0d2b3d', '#35102b'][i % 3]; ctx.fillRect(0, 0, 512, 192);
      ctx.fillStyle = ['#ff2e88', '#00e5ff', '#ffe14d'][i % 3]; ctx.font = 'bold 54px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(bb[0], 256, 84); ctx.fillStyle = '#ffffff'; ctx.font = '30px sans-serif'; ctx.fillText(bb[1], 256, 140);
      var tex = new THREE.CanvasTexture(cv);
      var board = new THREE.Mesh(new THREE.PlaneGeometry(22, 8.2), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
      var spots = [[-88, -172], [88, 168], [-168, 88], [168, -88], [-8, -328], [248, 88]];
      board.position.set(spots[i][0], 15, spots[i][1]); board.rotation.y = rng.range(0, Math.PI);
      var legs = new THREE.Mesh(new THREE.BoxGeometry(1, 12, 1), poleMat); legs.position.set(spots[i][0], 5, spots[i][1]); g.add(legs);
      g.add(board); City.billboards.push(board);
    });

    // Beach props: umbrellas and benches.
    var umbMats = C.NEON_COLORS.map(function (c) { return new THREE.MeshLambertMaterial({ color: c }); });
    for (var u = 0; u < 26; u++) {
      var ux = rng.range(345, 425), uz = rng.range(-420, 420);
      var umb = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1, 8), rng.pick(umbMats));
      umb.position.set(ux, 1.7, uz); g.add(umb);
      var stick = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.8, 5), trunkMat);
      stick.position.set(ux, 0.9, uz); g.add(stick);
    }
    // Job board / shop / hospital markers are placed by jobs/economy via these anchors.
    City.anchors = {
      jobBoard: { x: 12, z: 92 }, shop: { x: -92, z: 12 }, hospital: { x: -172, z: -88 },
      marisol: { x: 92, z: -8 }, raceOffice: { x: -8, z: 252 }, pier: City.pierEnd,
      playerSpawn: { x: 330, z: 30 }
    };
    return City;
  };

  City.collide = function (x, z, r) {
    for (var i = 0; i < City.colliders.length; i++) {
      var c = City.colliders[i];
      if (Math.abs(x - c.x) < c.hw + r && Math.abs(z - c.z) < c.hd + r) return c;
    }
    return null;
  };
  City.nearestRoadPoint = function (x, z) {
    var bx = City.roadsX[0], bz = City.roadsZ[0], bd = 1e18;
    City.roadsX.forEach(function (rx) { var d = Math.abs(x - rx); if (d < bd) { bd = d; bx = rx; } });
    bd = 1e18; City.roadsZ.forEach(function (rz) { var d = Math.abs(z - rz); if (d < bd) { bd = d; bz = rz; } });
    return { x: bx, z: bz };
  };
  City.update = function (dt, t) {
    if (City.water) City.water.position.y = 0.25 + Math.sin(t * 0.7) * 0.12;
    var night = SH.Weather && SH.Weather.isNight();
    if (City.lampGlowMat) City.lampGlowMat.opacity = night ? 0.95 : 0;
  };
})(window.SH);
