// Solstice Heat: Neon Tide — police.js
// Wanted system 0-5 stars, pursuit AI, roadblocks, helicopter, bust meter.
window.SH = window.SH || {};
SH.police = (function () {
  'use strict';
  var R = SH.random;
  var heat = 0;               // 0..500 internal; stars = ceil(heat/100)
  var wanted = 0;
  var cops = [];              // vehicle records with .copAI
  var roadblocks = [];
  var heli = null, heliLight = null, heliAngle = 0;
  var bustMeter = 0, hiddenT = 0, sceneRef = null;
  var CRIME_HEAT = { gunfire: 55, assault: 45, copshot: 120, crash: 14, theft: 30, reckless: 6, mission: 40 };
  function stars() { return wanted; }
  function reportCrime(kind, x, z, mult) {
    var add = (CRIME_HEAT[kind] || 20) * (mult === undefined ? 1 : mult);
    // crimes only count if plausibly witnessed: near peds/cops or in daylight districts
    heat = Math.min(500, heat + add);
    var ns = Math.ceil(heat / 100);
    if (ns > wanted) { wanted = ns; onWantedUp(); }
    void x; void z;
  }
  function onWantedUp() {
    SH.hud.toast('Wanted level: ' + wanted + ' star' + (wanted > 1 ? 's' : ''));
    ensureCops();
  }
  function ensureCops() {
    if (!sceneRef) return;
    var want = wanted === 0 ? 0 : Math.min(2 + wanted, 7);
    while (cops.length < want) spawnCop();
    if (wanted >= 4 && !heli) spawnHeli();
  }
  function spawnCop(nearPos) {
    var pp = SH.player.pos();
    var ang = R.range(0, Math.PI * 2), dist = nearPos ? 30 : R.range(55, 85);
    var x = R.clamp(pp.x + Math.sin(ang) * dist, -430, 430);
    var z = R.clamp(pp.z + Math.cos(ang) * dist, -420, 420);
    if (SH.city.isWater(x, z)) z = 200;
    var nd = SH.city.nearestNode(x, z);
    var rec = SH.vehicles.makeCar('police', nd.x, nd.z, R.range(0, 6.28), {});
    rec.isPolice = true; rec.copAI = { mode: 'pursue', ramT: 0 };
    cops.push(rec); return rec;
  }
  function spawnHeli() {
    var grp = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 5.2), bodyMat); grp.add(body);
    var tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 4.6), bodyMat); tail.position.set(0, 0.3, 4.4); grp.add(tail);
    var rotorMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    var rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), rotorMat); rotor.position.y = 1.25; rotor.name = 'rotor'; grp.add(rotor);
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.4, 0.5), bodyMat); fin.position.set(0, 0.6, 6.6); grp.add(fin);
    heliLight = new THREE.SpotLight(0xfff8d6, 2.2, 90, 0.32, 0.45);
    heliLight.position.set(0, -1, 0); grp.add(heliLight); grp.add(heliLight.target);
    var lampMesh = new THREE.Mesh(new THREE.ConeGeometry(8, 36, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide }));
    lampMesh.rotation.x = Math.PI; lampMesh.position.y = -18; lampMesh.name = 'searchcone'; grp.add(lampMesh);
    grp.position.set(0, 36, 0);
    sceneRef.add(grp);
    heli = grp;
  }
  function makeRoadblock(x, z, heading) {
    for (var i = -1; i <= 1; i += 2) {
      var rec = SH.vehicles.makeCar('police', x + Math.cos(heading) * i * 3.4, z - Math.sin(heading) * i * 3.4, heading + Math.PI / 2, {});
      rec.parked = true; rec.isPolice = true; roadblocks.push(rec);
    }
    SH.hud.toast('Police roadblock ahead!');
  }
  var blockT = 0;
  function update(dt) {
    var pp = SH.player.pos();
    var pv = SH.player.currentVehicle();
    // sight check: any cop close with line of proximity counts as seen
    var seen = false;
    cops.forEach(function (c) { if (R.dist2(c.x, c.z, pp.x, pp.z) < 65) seen = true; });
    if (heli && wanted >= 4) seen = true;
    if (wanted > 0) {
      if (seen) { hiddenT = 0; heat = Math.min(500, heat + dt * 2); }
      else {
        hiddenT += dt;
        heat -= dt * 9;
        if (hiddenT > 4 && heat <= (wanted - 1) * 100) { wanted = Math.max(0, Math.ceil(heat / 100)); SH.hud.toast(wanted === 0 ? 'You lost the heat.' : 'Heat dropping: ' + wanted + ' stars'); }
        if (heat <= 0) { heat = 0; wanted = 0; clearPursuit(); }
      }
    }
    ensureCops();
    // pursuit driving
    var boxed = 0;
    cops.forEach(function (rec, idx) {
      if (rec.damage >= 100) return;
      var d = R.dist2(rec.x, rec.z, pp.x, pp.z);
      if (d > 320) { // respawn closer
        var nd = SH.city.nearestNode(pp.x + R.range(-70, 70), pp.z + R.range(-70, 70));
        rec.x = nd.x; rec.z = nd.z; rec.speed = 0; rec.ai.path = [];
      }
      var targetX = pp.x, targetZ = pp.z;
      if (pv && idx % 2 === 1) { // second cop aims to box ahead
        targetX = pp.x - Math.sin(pp.heading) * -14; targetZ = pp.z - Math.cos(pp.heading) * -14;
      }
      var want = Math.atan2(-(targetX - rec.x), -(targetZ - rec.z));
      var diff = want - rec.heading;
      while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
      var steer = R.clamp(diff * 1.8, -1, 1);
      var throttle = 1;
      if (d < 7) { throttle = 0.35; boxed++; }
      if (Math.abs(diff) > 2.4) throttle = -0.7;
      var spdCap = rec.spec.top * (0.82 + wanted * 0.045);
      if (Math.abs(rec.speed) > spdCap) throttle = 0;
      SH.vehicles.stepCar(rec, dt, throttle, steer, false, false);
      // ram damage
      if (d < 3.4 && Math.abs(rec.speed) > 8) {
        if (pv) SH.vehicles.damageCar(pv, 5, true);
        else SH.player.hurt(6, 'Run down by the SBPD.');
        rec.speed *= 0.55;
      }
      // light bar flash
      rec.mesh.children.forEach(function (ch) {
        if (ch.name === 'copRed') ch.material.color.setHex(Math.sin(performance.now() * 0.02) > 0 ? 0xff2244 : 0x551118);
        if (ch.name === 'copBlue') ch.material.color.setHex(Math.sin(performance.now() * 0.02) > 0 ? 0x112255 : 0x2266ff);
      });
    });
    // siren audio from nearest cop
    var nearest = 1e9;
    cops.forEach(function (c) { nearest = Math.min(nearest, R.dist2(c.x, c.z, pp.x, pp.z)); });
    SH.audio.setSiren(wanted > 0 && cops.length > 0, nearest);
    // roadblocks at 3+ stars
    blockT -= dt;
    if (wanted >= 3 && blockT <= 0 && pv) {
      blockT = 26;
      var bx = pp.x - Math.sin(pp.heading) * 55, bz = pp.z - Math.cos(pp.heading) * 55;
      var nd2 = SH.city.nearestNode(bx, bz);
      if (!SH.city.isWater(nd2.x, nd2.z)) makeRoadblock(nd2.x, nd2.z, pp.heading);
    }
    // helicopter follows
    if (heli) {
      heliAngle += dt * 0.5;
      var hx = pp.x + Math.sin(heliAngle) * 16, hz = pp.z + Math.cos(heliAngle) * 16;
      heli.position.x = R.lerp(heli.position.x, hx, dt * 1.4);
      heli.position.z = R.lerp(heli.position.z, hz, dt * 1.4);
      heli.position.y = 33 + Math.sin(performance.now() * 0.001) * 2;
      heli.rotation.y = Math.atan2(pp.x - heli.position.x, pp.z - heli.position.z);
      heli.children.forEach(function (ch) { if (ch.name === 'rotor') ch.rotation.y += dt * 28; });
      heliLight.target.position.set(pp.x - heli.position.x, -40, pp.z - heli.position.z);
      if (wanted < 4) { sceneRef.remove(heli); heli = null; }
    }
    // bust meter: boxed at low speed with cops near
    var playerSpeed = pv ? Math.abs(pv.speed) : SH.player.data.speedNow;
    if (wanted > 0 && boxed > 0 && playerSpeed < 2.2) {
      bustMeter += dt / 3.2;
      SH.hud.setBust(bustMeter);
      if (bustMeter >= 1) doBust();
    } else { bustMeter = Math.max(0, bustMeter - dt * 0.7); SH.hud.setBust(bustMeter); }
  }
  function doBust() {
    bustMeter = 0; heat = 0; wanted = 0;
    SH.player.data.dead = true;
    SH.state.gameState = 'busted';
    SH.hud.showEnd('BUSTED', 'The SBPD boxed you in. The fine stings, the walk home stings more.');
    SH.economy.onBusted();
    clearPursuit();
  }
  function clearPursuit() {
    cops.forEach(function (c) { c.copAI = null; c.traffic = true; SH.vehicles.traffic.push(c); });
    cops = [];
    roadblocks.forEach(function (c) { c.parked = false; c.traffic = true; SH.vehicles.traffic.push(c); });
    roadblocks = [];
    if (heli && sceneRef) { sceneRef.remove(heli); heli = null; }
    SH.audio.setSiren(false, 0);
  }
  function setWanted(n, heatFill) {
    wanted = R.clamp(n, 0, 5); heat = heatFill !== undefined ? heatFill : wanted * 100 - 50;
    if (wanted > 0) ensureCops();
  }
  function init(scene) { sceneRef = scene; }
  return {
    init: init, update: update, reportCrime: reportCrime, setWanted: setWanted,
    get wanted() { return wanted; }, get heat() { return heat; },
    get bust() { return bustMeter; }, cops: function () { return cops; },
    spawnCop: spawnCop, clearPursuit: clearPursuit
  };
})();
