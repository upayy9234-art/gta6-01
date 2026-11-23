// Solstice Heat — city.js
// Builds the procedural city of Solstice Bay: a road grid over seven
// districts, art-deco buildings with emissive windows, palm trees,
// street lamps, canvas billboards, the beach, the sea and Marina
// Pier. Buildings register simple box colliders used by the player,
// vehicles and pedestrians. All layout decisions come from a seeded
// RNG so a seed always produces the same city.
(function () {
  "use strict";
  window.SH = window.SH || {};

  var cfg = window.SH.config;
  var W = cfg.WORLD;

  var city = {
    group: null,
    colliders: [],
    lamps: [],
    lampLights: [],
    billboards: [],
    windowMats: [],
    sea: null,
    pierEnd: { x: W.pierX, z: W.beachZ + W.pierLength },
    spawn: { x: 0, z: 235, heading: Math.PI },
    time: 0
  };

  function mat(color, opts) {
    var params = { color: color };
    if (opts) {
      var k;
      for (k in opts) {
        params[k] = opts[k];
      }
    }
    return new THREE.MeshLambertMaterial(params);
  }

  function addBox(group, w, h, d, x, y, z, material) {
    var geo = new THREE.BoxGeometry(w, h, d);
    var mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }

  function buildGround(scene) {
    var groundGeo = new THREE.PlaneGeometry(1400, 1400);
    var ground = new THREE.Mesh(groundGeo, mat(0x3f7a44));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);

    var cityGeo = new THREE.PlaneGeometry(W.width + 140, W.depth + 120);
    var cityPad = new THREE.Mesh(cityGeo, mat(0x9a958a));
    cityPad.rotation.x = -Math.PI / 2;
    cityPad.position.set(0, 0, 30);
    scene.add(cityPad);

    var sandGeo = new THREE.PlaneGeometry(1400, 130);
    var sand = new THREE.Mesh(sandGeo, mat(0xe8d194));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.02, W.beachZ + 55);
    scene.add(sand);

    var seaGeo = new THREE.PlaneGeometry(1400, 500);
    var seaMat = new THREE.MeshLambertMaterial({
      color: 0x1d6f9f,
      transparent: true,
      opacity: 0.88
    });
    var sea = new THREE.Mesh(seaGeo, seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.4, W.beachZ + 320);
    scene.add(sea);
    city.sea = sea;
  }

  function buildRoads(scene) {
    var roadMat = mat(0x2e3138);
    var lineMat = mat(0xf5eeda);
    var i;
    var pos;
    // Vertical avenues.
    for (i = 0; i <= W.blocksX; i++) {
      pos = -W.width / 2 + i * W.blockSize;
      addBox(scene, W.roadWidth, 0.06, W.depth + 90, pos, 0.03, 25, roadMat);
      var dash;
      for (dash = -W.depth / 2; dash < W.depth / 2 + 80; dash += 14) {
        addBox(scene, 0.5, 0.08, 6, pos, 0.05, dash, lineMat);
      }
    }
    // Horizontal streets.
    for (i = 0; i <= W.blocksZ; i++) {
      pos = -W.depth / 2 + i * W.blockSize;
      addBox(scene, W.width + 40, 0.06, W.roadWidth, 0, 0.03, pos, roadMat);
    }
    // Boardwalk promenade.
    var walkMat = mat(0xc9a06a);
    addBox(scene, W.width + 160, 0.1, 18, 0, 0.05, W.beachZ - 6, walkMat);
  }

  function windowTexture(rng, litRatio) {
    var canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 128;
    var g = canvas.getContext("2d");
    g.fillStyle = "#20242e";
    g.fillRect(0, 0, 64, 128);
    var cols = 6;
    var rows = 14;
    var x;
    var y;
    for (y = 0; y < rows; y++) {
      for (x = 0; x < cols; x++) {
        var lit = rng.next() < litRatio;
        g.fillStyle = lit ? "#ffd98a" : "#39404e";
        g.fillRect(4 + x * 10, 5 + y * 9, 6, 5);
      }
    }
    var tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  function buildBuilding(group, rng, x, z, district) {
    var palette = cfg.PALETTES.deco;
    var color = rng.pick(palette);
    var w = rng.range(16, 26);
    var d = rng.range(16, 26);
    var floors = rng.int(3, 9);
    if (district.id === "neonmile") {
      floors = rng.int(7, 15);
    }
    if (district.id === "oldtown") {
      floors = rng.int(2, 5);
    }
    var h = floors * 3.4;
    var tex = windowTexture(rng, 0.42);
    var sideMat = new THREE.MeshLambertMaterial({ color: color, map: tex });
    var roofMat = mat(0x6e6258);
    var materials = [sideMat, sideMat, roofMat, roofMat, sideMat, sideMat];
    var geo = new THREE.BoxGeometry(w, h, d);
    var mesh = new THREE.Mesh(geo, materials);
    mesh.position.set(x, h / 2, z);
    group.add(mesh);
    city.windowMats.push(sideMat);

    // Deco crown / setback cap.
    var trim = rng.pick(cfg.PALETTES.trim);
    addBox(group, w * 0.6, 1.6, d * 0.6, x, h + 0.8, z, mat(trim));
    addBox(group, w + 1.2, 0.8, d + 1.2, x, 0.4, z, mat(trim));

    city.colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      height: h
    });
    return mesh;
  }

  function buildPalm(group, rng, x, z) {
    var trunkMat = mat(0x8a6a42);
    var leafMat = mat(0x2e8a3e);
    var height = rng.range(6, 10);
    var trunk = addBox(group, 0.5, height, 0.5, x, height / 2, z, trunkMat);
    trunk.rotation.z = rng.range(-0.08, 0.08);
    var i;
    for (i = 0; i < 6; i++) {
      var leaf = addBox(group, 4.6, 0.18, 1.1, x, height + 0.4, z, leafMat);
      leaf.rotation.y = (i / 6) * Math.PI * 2;
      leaf.rotation.z = -0.5;
      leaf.position.x = x + Math.cos(leaf.rotation.y) * 1.6;
      leaf.position.z = z - Math.sin(leaf.rotation.y) * 1.6;
    }
    city.colliders.push({
      minX: x - 0.4, maxX: x + 0.4,
      minZ: z - 0.4, maxZ: z + 0.4,
      height: height
    });
  }

  function buildLamp(group, x, z) {
    var poleMat = mat(0x3a3f4a);
    addBox(group, 0.28, 5.4, 0.28, x, 2.7, z, poleMat);
    var headMat = new THREE.MeshLambertMaterial({
      color: 0x554e33,
      emissive: 0xffca7a,
      emissiveIntensity: 0
    });
    var head = addBox(group, 1.1, 0.35, 0.6, x, 5.5, z, headMat);
    city.lamps.push({ mesh: head, mat: headMat, x: x, z: z });
  }

  var BILLBOARD_LINES = [
    ["SOLSTICE", "COLA"],
    ["NEON", "MILE"],
    ["MARINA", "PIER"],
    ["HOTEL", "AZURE"],
    ["TURBO", "TAXI"],
    ["PALM", "HEIGHTS"],
    ["SURF", "SHOP"],
    ["RADIO", "SOLSTICE FM"]
  ];

  function buildBillboard(group, rng, x, z, ry) {
    var lines = rng.pick(BILLBOARD_LINES);
    var canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    var g = canvas.getContext("2d");
    g.fillStyle = "#141824";
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = "#ffd166";
    g.lineWidth = 6;
    g.strokeRect(6, 6, 244, 116);
    g.fillStyle = rng.pick(["#ff5da2", "#5df2ff", "#ffe95d", "#9dff5d"]);
    g.font = "bold 44px Arial";
    g.textAlign = "center";
    g.fillText(lines[0], 128, 56);
    g.fillText(lines[1], 128, 104);
    var tex = new THREE.CanvasTexture(canvas);
    var boardMat = new THREE.MeshLambertMaterial({ map: tex });
    var board = new THREE.Mesh(new THREE.BoxGeometry(13, 6.5, 0.4), boardMat);
    board.position.set(x, 10.5, z);
    board.rotation.y = ry;
    group.add(board);
    addBox(group, 0.5, 7.5, 0.5, x - 4, 3.7, z, mat(0x3a3f4a));
    addBox(group, 0.5, 7.5, 0.5, x + 4, 3.7, z, mat(0x3a3f4a));
    city.billboards.push(board);
  }

  function buildPier(scene) {
    var woodMat = mat(0x9a7448);
    var deck = addBox(scene, 10, 0.6, W.pierLength, W.pierX, 0.6, W.beachZ + W.pierLength / 2, woodMat);
    deck.name = "pier-deck";
    var i;
    for (i = 0; i < 8; i++) {
      var pz = W.beachZ + 8 + i * 11;
      addBox(scene, 0.5, 1.4, 0.5, W.pierX - 4.6, 1.4, pz, woodMat);
      addBox(scene, 0.5, 1.4, 0.5, W.pierX + 4.6, 1.4, pz, woodMat);
    }
    // Pier-end cafe.
    addBox(scene, 9, 4, 9, W.pierX, 3.2, W.beachZ + W.pierLength - 4, mat(0xf2c078));
    addBox(scene, 10.5, 0.7, 10.5, W.pierX, 5.6, W.beachZ + W.pierLength - 4, mat(0xe2452c));
    city.colliders.push({
      minX: W.pierX - 4.5, maxX: W.pierX + 4.5,
      minZ: W.beachZ + W.pierLength - 8.5, maxZ: W.beachZ + W.pierLength,
      height: 5
    });
  }

  function build(scene) {
    var rng = new window.SH.RNG(window.SH.querySeed() * 31 + 5);
    city.group = new THREE.Group();
    scene.add(city.group);
    buildGround(scene);
    buildRoads(scene);
    buildPier(scene);

    var bx;
    var bz;
    for (bz = 0; bz < W.blocksZ; bz++) {
      for (bx = 0; bx < W.blocksX; bx++) {
        var cx = -W.width / 2 + bx * W.blockSize + W.blockSize / 2;
        var cz = -W.depth / 2 + bz * W.blockSize + W.blockSize / 2;
        var district = cfg.districtAt(cx, cz);
        if (rng.chance(0.16)) {
          // Small plaza block: palms and lamps only.
          buildPalm(city.group, rng, cx - 10, cz - 10);
          buildPalm(city.group, rng, cx + 10, cz + 8);
          buildLamp(city.group, cx, cz - 14);
          buildLamp(city.group, cx, cz + 14);
          continue;
        }
        buildBuilding(city.group, rng, cx, cz, district);
        if (district.palmHeavy || rng.chance(0.4)) {
          buildPalm(city.group, rng, cx - 16, cz + 15);
          buildPalm(city.group, rng, cx + 16, cz - 15);
        }
        buildLamp(city.group, cx - 18, cz - 18);
        buildLamp(city.group, cx + 18, cz + 18);
        if (district.id === "neonmile" && rng.chance(0.6)) {
          buildBillboard(city.group, rng, cx, cz - 19, 0);
        }
      }
    }

    // Boardwalk palms and lamps along the promenade.
    var px;
    for (px = -230; px <= 230; px += 23) {
      buildPalm(city.group, rng, px, W.beachZ - 14);
      buildLamp(city.group, px + 8, W.beachZ - 2);
    }
    // A hero billboard facing the spawn.
    buildBillboard(city.group, rng, -30, W.beachZ - 20, 0);
    buildBillboard(city.group, rng, 90, W.beachZ - 20, 0);
  }

  function collide(x, z, radius) {
    var i;
    var c;
    for (i = 0; i < city.colliders.length; i++) {
      c = city.colliders[i];
      if (x > c.minX - radius && x < c.maxX + radius &&
          z > c.minZ - radius && z < c.maxZ + radius) {
        return c;
      }
    }
    return null;
  }

  function resolveCollision(pos, radius) {
    var c = collide(pos.x, pos.z, radius);
    if (!c) {
      return false;
    }
    var pushLeft = (c.minX - radius) - pos.x;
    var pushRight = (c.maxX + radius) - pos.x;
    var pushNear = (c.minZ - radius) - pos.z;
    var pushFar = (c.maxZ + radius) - pos.z;
    var options = [
      { v: Math.abs(pushLeft), axis: "x", to: c.minX - radius },
      { v: Math.abs(pushRight), axis: "x", to: c.maxX + radius },
      { v: Math.abs(pushNear), axis: "z", to: c.minZ - radius },
      { v: Math.abs(pushFar), axis: "z", to: c.maxZ + radius }
    ];
    options.sort(function (a, b) { return a.v - b.v; });
    var best = options[0];
    if (best.axis === "x") {
      pos.x = best.to;
    } else {
      pos.z = best.to;
    }
    return true;
  }

  function update(dt, nightFactor) {
    city.time += dt;
    if (city.sea) {
      city.sea.position.y = -0.4 + Math.sin(city.time * 0.7) * 0.12;
    }
    var i;
    for (i = 0; i < city.lamps.length; i++) {
      city.lamps[i].mat.emissiveIntensity = nightFactor * 1.6;
    }
  }

  function randomRoadPoint(rng) {
    var vertical = rng.chance(0.5);
    var lane = rng.int(0, 8);
    var along = rng.range(-W.depth / 2, W.depth / 2 + 60);
    if (vertical) {
      return { x: -W.width / 2 + lane * W.blockSize + 4, z: along, vertical: true };
    }
    return { x: rng.range(-W.width / 2, W.width / 2), z: -W.depth / 2 + lane * W.blockSize + 4, vertical: false };
  }

  city.build = build;
  city.collide = collide;
  city.resolveCollision = resolveCollision;
  city.update = update;
  city.randomRoadPoint = randomRoadPoint;
  window.SH.city = city;
})();
