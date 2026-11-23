// Solstice Heat: Neon Tide — city.js
// Procedural Solstice Bay: road grid, 8 districts, beach, sea, island + bridge,
// palms, lamps, billboards. Builds road network (nodes/edges) for traffic + GPS.
window.SH = window.SH || {};
SH.city = (function () {
  'use strict';
  var R = SH.random, C = SH.config, W = C.WORLD;
  var colliders = [];
  var nodes = [];        // {x,z,id}
  var edges = [];        // {a,b}
  var nodeMap = {};
  var roadsX = [], roadsZ = [];
  var spawnCars = [], spawnPeds = [], missionSpots = {};
  var animated = [];     // meshes with .name hooks animated by weather/main
  var waterMesh = null, sandMesh = null;
  var districtAtCache = {};
  function key(x, z) { return Math.round(x) + ',' + Math.round(z); }
  function districtAt(x, z) {
    var k = Math.round(x / 20) + ',' + Math.round(z / 20);
    if (districtAtCache[k]) return districtAtCache[k];
    var best = C.DISTRICTS[1], bd = 1e9;
    for (var i = 0; i < C.DISTRICTS.length; i++) {
      var d = R.dist2(x, z, C.DISTRICTS[i].cx, C.DISTRICTS[i].cz);
      if (d < bd) { bd = d; best = C.DISTRICTS[i]; }
    }
    if (z > W.beachZ) best = C.DISTRICTS[0];
    districtAtCache[k] = best; return best;
  }
  function isRoad(x, z) {
    var i;
    for (i = 0; i < roadsX.length; i++) if (Math.abs(x - roadsX[i]) < W.roadHalf) return true;
    for (i = 0; i < roadsZ.length; i++) if (Math.abs(z - roadsZ[i]) < W.roadHalf) return true;
    if (Math.abs(x - W.islandX) < W.roadHalf && z > W.seaZ && z < W.islandZ + 40) return true; // bridge
    return false;
  }
  function isWater(x, z) {
    if (z < W.seaZ) return false;
    if (Math.abs(x - W.islandX) < W.roadHalf && z < W.islandZ - W.islandR) return false; // bridge deck
    if (R.dist2(x, z, W.islandX, W.islandZ) < W.islandR) return false; // island land
    return true;
  }
  function isLand(x, z) { return !isWater(x, z); }
  function groundY(x, z) {
    if (isWater(x, z)) return -1.6;
    if (z > W.beachZ && !isRoad(x, z)) return 0.15;
    if (R.dist2(x, z, W.islandX, W.islandZ) < W.islandR) return 0.4 + R.fbm(x * 0.02, z * 0.02, 2) * 1.2;
    return 0;
  }
  function buildNetwork() {
    var x, z, i;
    for (x = W.gridMin; x <= W.gridMax + W.block; x += W.block) roadsX.push(x);
    for (z = W.gridMin; z <= W.gridMax; z += W.block) roadsZ.push(z);
    roadsZ.push(240); // boardwalk avenue
    function addNode(nx, nz) {
      var k = key(nx, nz);
      if (nodeMap[k] !== undefined) return nodeMap[k];
      var id = nodes.length; nodes.push({ x: nx, z: nz, id: id }); nodeMap[k] = id; return id;
    }
    for (var a = 0; a < roadsX.length; a++) for (var b = 0; b < roadsZ.length; b++) addNode(roadsX[a], roadsZ[b]);
    function link(ax, az, bx, bz) { edges.push({ a: addNode(ax, az), b: addNode(bx, bz) }); }
    for (var r = 0; r < roadsZ.length; r++)
      for (var cix = 0; cix < roadsX.length - 1; cix++) link(roadsX[cix], roadsZ[r], roadsX[cix + 1], roadsZ[r]);
    for (var cx = 0; cx < roadsX.length; cx++)
      for (var rz = 0; rz < roadsZ.length - 1; rz++) link(roadsX[cx], roadsZ[rz], roadsX[cx], roadsZ[rz + 1]);
    // Bridge nodes to the island
    var prev = addNode(W.islandX, 300);
    for (z = 360; z <= W.islandZ; z += 60) { var nid = addNode(W.islandX, z); edges.push({ a: prev, b: nid }); prev = nid; }
    void i;
  }
  function nearestNode(x, z) {
    var best = 0, bd = 1e12;
    for (var i = 0; i < nodes.length; i++) { var d = R.dist2(x, z, nodes[i].x, nodes[i].z); if (d < bd) { bd = d; best = i; } }
    return nodes[best];
  }
  function findPath(x0, z0, x1, z1) {
    var start = nearestNode(x0, z0), goal = nearestNode(x1, z1);
    if (!start || !goal) return [{ x: x1, z: z1 }];
    var adj = {};
    edges.forEach(function (e) {
      (adj[e.a] = adj[e.a] || []).push(e.b); (adj[e.b] = adj[e.b] || []).push(e.a);
    });
    var prev = {}, seen = {}, q = [start.id]; seen[start.id] = true;
    while (q.length) {
      var cur = q.shift();
      if (cur === goal.id) break;
      (adj[cur] || []).forEach(function (n) { if (!seen[n]) { seen[n] = true; prev[n] = cur; q.push(n); } });
    }
    var path = [], at = goal.id, guard = 0;
    while (at !== undefined && guard++ < 500) { path.unshift({ x: nodes[at].x, z: nodes[at].z }); if (at === start.id) break; at = prev[at]; }
    path.push({ x: x1, z: z1 });
    return path;
  }
  function collide(x, z, radius) {
    // Returns corrected {x,z} pushed out of building colliders (circle vs AABB).
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      var dx = x - c.x, dz = z - c.z;
      var px = c.hw + radius - Math.abs(dx), pz = c.hd + radius - Math.abs(dz);
      if (px > 0 && pz > 0) {
        if (px < pz) x = c.x + (dx >= 0 ? c.hw + radius : -c.hw - radius);
        else z = c.z + (dz >= 0 ? c.hd + radius : -c.hd - radius);
      }
    }
    return { x: x, z: z };
  }
  function hitsBuilding(x, z, radius) {
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      if (Math.abs(x - c.x) < c.hw + radius && Math.abs(z - c.z) < c.hd + radius) return c;
    }
    return null;
  }
  var roadMatDay = null, roadMeshes = [];
  function build(scene) {
    buildNetwork();
    var B = SH.buildings;
    // Ground base
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 720),
      new THREE.MeshLambertMaterial({ color: 0x3f7d4e }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.08, -50); scene.add(ground);
    // Sand beach (a strip at the shoreline only, so the sea shows past it)
    sandMesh = new THREE.Mesh(new THREE.PlaneGeometry(1600, 95),
      new THREE.MeshLambertMaterial({ color: 0xeed9a3 }));
    sandMesh.rotation.x = -Math.PI / 2; sandMesh.position.set(0, 0.02, W.beachZ + 45); scene.add(sandMesh);
    // Island
    var island = new THREE.Mesh(new THREE.CylinderGeometry(W.islandR, W.islandR + 14, 2.4, 24),
      new THREE.MeshLambertMaterial({ color: 0xe8d49a }));
    island.position.set(W.islandX, 0.2, W.islandZ); scene.add(island);
    var islandTop = new THREE.Mesh(new THREE.CylinderGeometry(W.islandR - 6, W.islandR - 2, 1, 24),
      new THREE.MeshLambertMaterial({ color: 0x58a05c }));
    islandTop.position.set(W.islandX, 1.5, W.islandZ); scene.add(islandTop);
    // Sea
    var waterMat = new THREE.MeshPhongMaterial({ color: 0x0e6ba8, transparent: true, opacity: 0.86, shininess: 120, specular: 0x99ddff });
    waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(2400, 900), waterMat);
    waterMesh.rotation.x = -Math.PI / 2; waterMesh.position.set(0, -0.55, W.seaZ + 420);
    waterMesh.name = 'water'; scene.add(waterMesh); animated.push(waterMesh);
    // Bridge deck
    var bridge = new THREE.Mesh(new THREE.BoxGeometry(13, 1.2, W.islandZ - 300),
      new THREE.MeshLambertMaterial({ color: 0x707a88 }));
    bridge.position.set(W.islandX, 0.7, (300 + W.islandZ) / 2); scene.add(bridge);
    for (var bp = 0; bp < 6; bp++) {
      var pillar = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), new THREE.MeshLambertMaterial({ color: 0x59636f }));
      pillar.position.set(W.islandX - 5, -1, 340 + bp * 52); scene.add(pillar);
      var pillar2 = pillar.clone(); pillar2.position.x = W.islandX + 5; scene.add(pillar2);
    }
    // Roads: dark strips + centre dashes
    roadMatDay = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
    var dashMat = new THREE.MeshBasicMaterial({ color: 0xf7e08a });
    function roadStrip(w, l, x, z, horiz) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), roadMatDay);
      m.rotation.x = -Math.PI / 2; if (!horiz) m.rotation.z = Math.PI / 2;
      m.position.set(x, 0.03, z); scene.add(m); roadMeshes.push(m);
      var dashes = Math.floor(l / 12);
      for (var i = 0; i < dashes; i++) {
        var d = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), dashMat);
        d.rotation.x = -Math.PI / 2; if (!horiz) d.rotation.z = Math.PI / 2;
        var off = -l / 2 + 6 + i * 12;
        d.position.set(horiz ? x + off : x, 0.05, horiz ? z : z + off);
        scene.add(d);
      }
    }
    var spanX = W.gridMax + W.block - W.gridMin, spanZ = 240 - W.gridMin;
    roadsZ.forEach(function (rz) { roadStrip(spanX, W.roadHalf * 2, (W.gridMin + W.gridMax + W.block) / 2, rz, true); });
    roadsX.forEach(function (rx) { roadStrip(spanZ, W.roadHalf * 2, rx, (W.gridMin + 240) / 2, false); });
    // Sidewalks along boardwalk
    // (sidewalk strips are implied by block paving colour at block edges)
    // Buildings per block
    for (var bx = 0; bx < roadsX.length - 1; bx++) for (var bz = 0; bz < roadsZ.length - 1; bz++) {
      var cx = (roadsX[bx] + roadsX[bx + 1]) / 2, cz = (roadsZ[bz] + roadsZ[bz + 1]) / 2;
      var dist = districtAt(cx, cz);
      var n = R.fbm(cx * 0.01, cz * 0.01, 3);
      if (n < 0.32) { // park / plaza block
        for (var p = 0; p < 5; p++) B.makePalm(scene, cx + R.range(-18, 18), cz + R.range(-18, 18), R.range(0.9, 1.4));
        B.makeBench(scene, cx + 6, cz + 4, R.range(0, 3));
        continue;
      }
      var perBlock = R.chance(0.55) ? 1 : 2;
      for (var k = 0; k < perBlock; k++) {
        var ox = perBlock === 1 ? 0 : (k === 0 ? -13 : 13);
        var w = R.range(16, 24), d = R.range(16, 24);
        var tall = dist.name === 'Neon Mile' || dist.name === 'Palm Heights' || dist.name === 'Casino Row';
        var h = tall ? R.range(22, 58) : R.range(9, 26);
        var kind = 'block';
        if (dist.name === 'Port' || dist.name === 'Marina') kind = 'warehouse';
        else if (dist.name === 'Casino Row' && k === 0 && bx % 2 === 0) kind = 'casino';
        else if (h > 34) kind = 'tower';
        else if (dist.neon && R.chance(0.6)) kind = 'neon';
        if (kind === 'warehouse') h = R.range(7, 11);
        var grp = B.makeBuilding(scene, cx + ox, cz + R.range(-6, 6), w, d, h, dist, kind, colliders);
        if (kind === 'casino' || kind === 'tower') animated.push(grp);
      }
    }
    // Casino landmark (big, on Casino Row)
    var casinoDist = C.DISTRICTS[7];
    B.makeBuilding(scene, 60, 118, 40, 30, 26, casinoDist, 'casino', colliders);
    // Lighthouse on island
    var lh = B.makeLighthouse(scene, W.islandX + 40, W.islandZ - 30, colliders);
    animated.push(lh);
    // Palms along beach + boardwalk lamps
    for (var px = -420; px <= 420; px += 26) {
      if (R.chance(0.8)) B.makePalm(scene, px + R.range(-5, 5), W.beachZ + R.range(2, 16), R.range(1, 1.5));
      B.makeLamp(scene, px, 246);
      if (px % 78 === 0) B.makeHydrant(scene, px + 4, 238);
    }
    // Street lamps at intersections (sparse)
    for (var li = 0; li < nodes.length; li += 3) B.makeLamp(scene, nodes[li].x + 8, nodes[li].z + 8);
    // Billboards
    var bbColors = [0xff4fd8, 0x00e5ff, 0xffe14d, 0xff7b54, 0x9dff57, 0xff5964];
    var bbSpots = [[-90, 232, 0], [30, 52, 0.4], [-200, -20, 1.2], [150, 140, -0.5], [240, -80, 0.9], [-40, -190, 0.2]];
    bbSpots.forEach(function (s, i) { B.makeBillboard(scene, s[0], s[1], s[2], bbColors[i % bbColors.length], colliders); });
    // Benches on boardwalk
    for (var bn = -360; bn <= 360; bn += 60) B.makeBench(scene, bn, 252, 0);
    // Spawn points
    // Mutate (never reassign): missions.js and sidejobs.js hold this reference.
    var spotsDef = {
      fixer: { x: -52, z: 232 }, marina: { x: 196, z: 268 }, port: { x: 306, z: 66 },
      casino: { x: 60, z: 100 }, university: { x: -132, z: -232 }, island: { x: W.islandX, z: W.islandZ },
      heights: { x: 148, z: -132 }, oldtown: { x: -232, z: -32 }, neon: { x: -32, z: 88 }
    };
    Object.keys(spotsDef).forEach(function (k) { missionSpots[k] = spotsDef[k]; });
    nodes.forEach(function (nd, i) { if (i % 4 === 0) spawnCars.push({ x: nd.x, z: nd.z }); });
    for (var sp = 0; sp < 60; sp++) {
      var sx = R.range(W.gridMin, W.gridMax), sz = R.range(W.gridMin, 250);
      if (!isRoad(sx, sz)) spawnPeds.push({ x: sx, z: sz });
    }
    return { water: waterMesh };
  }
  function setRoadWet(wet) {
    if (roadMatDay) roadMatDay.color.setHex(wet > 0.4 ? 0x1d2026 : 0x2e3138);
  }
  return {
    build: build, colliders: colliders, nodes: nodes, edges: edges,
    roadsX: roadsX, roadsZ: roadsZ, districtAt: districtAt, isRoad: isRoad,
    isWater: isWater, isLand: isLand, groundY: groundY, nearestNode: nearestNode,
    findPath: findPath, collide: collide, hitsBuilding: hitsBuilding,
    spawnCars: spawnCars, spawnPeds: spawnPeds, missionSpots: missionSpots,
    animated: animated, setRoadWet: setRoadWet,
    getWater: function () { return waterMesh; }
  };
})();
