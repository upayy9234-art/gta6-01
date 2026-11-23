// Solstice Heat: Neon Tide — sidejobs.js
// Repeatable jobs (taxi/courier/medic/tow/VIP/boat), street races, stunt jumps,
// collectibles (40 seashells, 8 postcards), beacon time trial.
window.SH = window.SH || {};
SH.sidejobs = (function () {
  'use strict';
  var R = SH.random, B = SH.config.BALANCE, S = SH.city.missionSpots;
  var job = null;         // {kind, x, z, label, pay, marker, phase, pickup}
  var jobMarkers = [];
  var race = null;        // {route, rivals, cp, cb, finished}
  var shells = [], postcards = [], stunts = [], beacon = null;
  var sceneRef = null;
  var JOB_DEFS = [
    { kind: 'taxi', name: 'Taxi Pickup', x: -20, z: 150, color: 0xffbe0b },
    { kind: 'courier', name: 'Courier Drop', x: 240, z: -60, color: 0x00e5ff },
    { kind: 'medic', name: 'Paramedic Call', x: -168, z: -20, color: 0xff5964 },
    { kind: 'tow', name: 'Tow Job', x: 290, z: 90, color: 0xffa62b },
    { kind: 'vip', name: 'VIP Escort', x: 60, z: 84, color: 0xffe14d },
    { kind: 'boatcourier', name: 'Boat Courier', x: 196, z: 300, color: 0x59cd90 },
    { kind: 'checkpoint', name: 'Checkpoint Run', x: -240, z: 120, color: 0x9b5de5 }
  ];
  var RACES = [
    { name: 'Casino Row Sprint', start: { x: 0, z: 60 }, cps: [[60, 60], [120, 60], [180, 120], [120, 180], [60, 180], [0, 60]] },
    { name: 'Neon Mile GP', start: { x: -60, z: 180 }, cps: [[-60, 60], [-60, -60], [0, -120], [60, -60], [60, 60], [-60, 180]] },
    { name: 'Coastal Run', start: { x: -300, z: 240 }, cps: [[-120, 240], [60, 240], [240, 240], [300, 120], [180, 60], [-300, 240]] },
    { name: 'Port Circuit', start: { x: 240, z: 180 }, cps: [[300, 60], [240, -60], [120, -60], [120, 60], [180, 120], [240, 180]] }
  ];
  var STUNT_SPOTS = [[-120, 240], [0, 120], [120, 0], [-240, -120], [240, -180], [60, -240], [-60, 60], [180, 180], [-300, 0], [300, 200]];
  function ring(x, z, colorHex, r) {
    var m = new THREE.Mesh(new THREE.TorusGeometry(r || 3.4, 0.3, 8, 26), new THREE.MeshBasicMaterial({ color: colorHex }));
    m.rotation.x = Math.PI / 2; m.position.set(x, 1.2, z);
    return m;
  }
  function init(scene) {
    sceneRef = scene;
    JOB_DEFS.forEach(function (d) {
      var m = ring(d.x, d.z, d.color, 2.6); scene.add(m);
      jobMarkers.push({ def: d, mesh: m });
    });
    // seashells on the beach + island
    for (var i = 0; i < 40; i++) {
      var onIsland = i >= 34;
      var sx = onIsland ? SH.config.WORLD.islandX + R.range(-60, 60) : R.range(-430, 430);
      var sz = onIsland ? SH.config.WORLD.islandZ + R.range(-60, 60) : R.range(308, 352);
      var sm = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6, 0, Math.PI * 2, 0, 1.8),
        new THREE.MeshBasicMaterial({ color: 0xffe8f4 }));
      sm.scale.y = 0.55; sm.position.set(sx, SH.city.groundY(sx, sz) + 0.25, sz);
      sm.name = 'shell' + i; scene.add(sm);
      shells.push({ x: sx, z: sz, mesh: sm, taken: SH.economy.data.shells.indexOf(i) >= 0 });
      if (shells[i].taken) sm.visible = false;
    }
    // postcards at landmarks
    var pcSpots = [[-52, 236], [60, 104], [208, 300], [SH.config.WORLD.islandX + 40, SH.config.WORLD.islandZ - 26], [-236, -36], [148, -136], [-136, -236], [304, 44]];
    pcSpots.forEach(function (p, idx) {
      var pm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 0.08), new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
      pm.position.set(p[0], 1.5, p[1]); scene.add(pm);
      postcards.push({ x: p[0], z: p[1], mesh: pm, taken: SH.economy.data.postcards.indexOf(idx) >= 0 });
      if (postcards[idx].taken) pm.visible = false;
    });
    // stunt ramps
    STUNT_SPOTS.forEach(function (p) {
      var ramp = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.6, 6), new THREE.MeshLambertMaterial({ color: 0xffa62b }));
      ramp.position.set(p[0], 0.7, p[1]); ramp.rotation.x = -0.32; scene.add(ramp);
      stunts.push({ x: p[0], z: p[1], mesh: ramp, done: false, airT: 0 });
    });
    // beacon
    var bm = ring(S.heights.x, S.heights.z, 0x00e5ff, 3.4); scene.add(bm);
    beacon = { mesh: bm, active: false, timer: 0, target: null };
  }
  function startJob(def) {
    var pp = SH.player.pos();
    var dests = [S.marina, S.casino, S.port, S.university, S.heights, S.oldtown, S.neon, S.island];
    var dest = dests[R.int(0, dests.length - 1)];
    if (def.kind === 'boatcourier') dest = R.chance(0.5) ? { x: S.island.x, z: S.island.z + 60 } : { x: 120, z: 430 };
    job = { kind: def.kind, phase: 'go', x: dest.x, z: dest.z, pay: 0, name: def.name, timer: 0 };
    if (def.kind === 'taxi' || def.kind === 'vip' || def.kind === 'medic') {
      job.phase = 'pickup'; job.x = pp.x + R.range(-50, 50); job.z = pp.z + R.range(-50, 50);
      job.dest = dest;
    }
    SH.hud.showBanner(def.name.toUpperCase(), jobLabel());
    SH.hud.subtitle('Dispatcher', jobLabel());
  }
  function jobLabel() {
    if (!job) return '';
    if (job.phase === 'pickup') return 'Pick up your fare — follow the GPS.';
    return {
      taxi: 'Drop your fare at the marker', courier: 'Deliver the parcel to the marker',
      medic: 'Get the patient to the Marina', tow: 'Tow the wreck to the Port marker',
      vip: 'Drive the VIP to the marker — keep the car clean', boatcourier: 'Sail the package to the marker',
      checkpoint: 'Hit every checkpoint in order'
    }[job.kind] || 'Reach the marker';
  }
  function finishJob() {
    var pp = SH.player.pos();
    var dist = job.dest ? R.dist2(job.x, job.z, job.dest.x, job.dest.z) : 0;
    var base = { taxi: 120 + dist * B.taxiPayPerM, courier: B.courierPay, medic: B.medicPay, tow: B.towPay, vip: 320, boatcourier: 300, checkpoint: 200 }[job.kind] || 150;
    var pay = Math.round(base);
    SH.economy.addCash(pay, job.name);
    SH.economy.addXP(18);
    SH.economy.data.stats.jobsDone++;
    SH.effects.confettiAt(pp.x, 2.5, pp.z);
    SH.audio.success();
    SH.hud.showBanner('JOB DONE', job.name + ' — +$' + pay);
    job = null;
    SH.hud.setObjective('');
  }
  function updateJobs(dt, pp) {
    jobMarkers.forEach(function (jm) {
      jm.mesh.rotation.z += dt;
      if (!job && R.dist2(pp.x, pp.z, jm.def.x, jm.def.z) < 4.5) {
        SH.hud.setPrompt('Press E — ' + jm.def.name);
        if (SH.input.interactPressed()) startJob(jm.def);
      }
    });
    if (!job) return;
    if (job.phase === 'pickup') {
      if (R.dist2(pp.x, pp.z, job.x, job.z) < 5) {
        job.phase = 'go'; job.x = job.dest.x; job.z = job.dest.z;
        SH.hud.subtitle('Fare', 'Marker is set. And step on it — politely.');
        SH.audio.pickup();
      }
    } else if (R.dist2(pp.x, pp.z, job.x, job.z) < (job.kind === 'boatcourier' ? 15 : 6)) finishJob();
    if (job) SH.hud.setObjective(job.name + ': ' + jobLabel() + ' (' + Math.round(R.dist2(pp.x, pp.z, job.x, job.z)) + 'm)');
  }
  // ---- Races
  function startRace(idx, cb) {
    var def = RACES[idx % RACES.length];
    var rivals = [];
    for (var i = 0; i < 3; i++) {
      var rec = SH.vehicles.makeCar(['coupe', 'muscle', 'sedan'][i], def.start.x + (i + 1) * 4.5, def.start.z + 3, Math.PI, {});
      rec.ai.path = def.cps.map(function (c) { return { x: c[0], z: c[1] }; });
      rec.ai.pathI = 0; rec.ai.targetSpeed = [30, 33, 27][i]; rec.traffic = false; rec.racer = true;
      SH.vehicles.traffic.push(rec); rivals.push(rec);
    }
    race = { def: def, rivals: rivals, cp: 0, cb: cb || null, cpMesh: null, finished: false, playerDone: false };
    placeRaceCp();
    SH.hud.showBanner('RACE: ' + def.name.toUpperCase(), 'Beat 3 rivals through ' + def.cps.length + ' checkpoints!');
    return race;
  }
  function placeRaceCp() {
    if (race.cpMesh) { sceneRef.remove(race.cpMesh); race.cpMesh = null; }
    if (!race || race.cp >= race.def.cps.length) return;
    var c = race.def.cps[race.cp];
    race.cpMesh = ring(c[0], c[1], 0x59cd90, 4.2); sceneRef.add(race.cpMesh);
  }
  function racePosition() {
    if (!race) return 1;
    var pp = SH.player.pos();
    var myProg = race.cp * 1000 - R.dist2(pp.x, pp.z, race.def.cps[Math.min(race.cp, race.def.cps.length - 1)][0], race.def.cps[Math.min(race.cp, race.def.cps.length - 1)][1]);
    var pos = 1;
    race.rivals.forEach(function (rv) {
      var rp = rv.ai.pathI * 1000 - (rv.ai.path[rv.ai.pathI] ? R.dist2(rv.x, rv.z, rv.ai.path[rv.ai.pathI].x, rv.ai.path[rv.ai.pathI].z) : 0);
      if (rp > myProg) pos++;
    });
    return pos;
  }
  function updateRace(dt, pp) {
    if (!race || race.finished) return;
    race.rivals.forEach(function (rv) { if (rv.ai.pathI >= rv.ai.path.length && !rv.done) { rv.done = true; } });
    if (race.cp < race.def.cps.length) {
      var c = race.def.cps[race.cp];
      if (race.cpMesh) race.cpMesh.rotation.z += dt * 2;
      if (R.dist2(pp.x, pp.z, c[0], c[1]) < 8) {
        race.cp++; SH.audio.pickup();
        SH.hud.toast('Checkpoint ' + race.cp + '/' + race.def.cps.length + ' — P' + racePosition());
        placeRaceCp();
      }
    }
    var rivalsDone = race.rivals.filter(function (r) { return r.done; }).length;
    if (race.cp >= race.def.cps.length && !race.playerDone) {
      race.playerDone = true; race.finished = true;
      var pos = 1 + race.rivals.filter(function (r) { return r.done; }).length;
      var won = pos === 1;
      if (won) { SH.economy.addCash(B.racePay[0], 'Race win: ' + race.def.name); SH.economy.data.stats.racesWon++; }
      else if (pos === 2) SH.economy.addCash(B.racePay[1], 'Race 2nd');
      else if (pos === 3) SH.economy.addCash(B.racePay[2], 'Race 3rd');
      SH.economy.addXP(won ? 60 : 25);
      SH.hud.showBanner(won ? 'RACE WON!' : 'FINISHED P' + pos, race.def.name + ' complete.');
      if (race.cb) race.cb(won);
      if (race.cpMesh) sceneRef.remove(race.cpMesh);
      race.rivals.forEach(function (r) { r.racer = false; });
      race = null;
    } else if (rivalsDone >= 3 && !race.playerDone) {
      race.finished = true;
      SH.hud.showBanner('RACE LOST', 'The rivals finished first.');
      if (race.cb) race.cb(false);
      if (race.cpMesh) sceneRef.remove(race.cpMesh);
      race = null;
    }
    void rivalsDone;
  }
  // ---- Collectibles, stunts, beacon
  function updateCollectibles(dt, pp) {
    shells.forEach(function (sh, i) {
      if (sh.taken) return;
      sh.mesh.rotation.y += dt * 2;
      if (R.dist2(pp.x, pp.z, sh.x, sh.z) < 2.2) {
        sh.taken = true; sh.mesh.visible = false;
        SH.economy.data.shells.push(i);
        SH.economy.addCash(B.shellValue, 'Seashell ' + SH.economy.data.shells.length + '/40');
        SH.audio.pickup(); SH.economy.save();
      }
    });
    postcards.forEach(function (pc, i) {
      if (pc.taken) return;
      pc.mesh.rotation.y += dt * 1.5;
      if (R.dist2(pp.x, pp.z, pc.x, pc.z) < 2.4) {
        pc.taken = true; pc.mesh.visible = false;
        SH.economy.data.postcards.push(i);
        SH.economy.addCash(B.postcardValue, 'Postcard ' + SH.economy.data.postcards.length + '/8');
        SH.audio.pickup(); SH.economy.save();
      }
    });
    var v = SH.player.currentVehicle();
    stunts.forEach(function (st) {
      if (st.done || !v) return;
      if (R.dist2(pp.x, pp.z, st.x, st.z) < 4 && Math.abs(v.speed) > 14) {
        st.done = true; SH.economy.data.stats.stunts++;
        SH.effects.triggerSlowmo(0.3, 1.3);
        SH.economy.addCash(B.stuntPay, 'Stunt jump!');
        SH.economy.addXP(20);
        SH.hud.toast('STUNT JUMP! Slow-mo style bonus');
        SH.audio.success();
      }
    });
    // beacon time trial: step in ring to start, reach island ring in 75s
    if (beacon) {
      beacon.mesh.rotation.z += dt;
      if (!beacon.active && R.dist2(pp.x, pp.z, S.heights.x, S.heights.z) < 4) {
        beacon.active = true; beacon.timer = 75; beacon.target = { x: S.island.x, z: S.island.z };
        SH.hud.showBanner('BEACON TRIAL', 'Reach the island beacon in 75 seconds!');
      }
      if (beacon.active) {
        beacon.timer -= dt;
        SH.hud.setObjective('Beacon Trial: ' + Math.ceil(beacon.timer) + 's — reach the island!');
        if (R.dist2(pp.x, pp.z, beacon.target.x, beacon.target.z) < 12) {
          beacon.active = false; SH.economy.addCash(400, 'Beacon Trial'); SH.economy.addXP(50); SH.audio.success();
          SH.hud.showBanner('BEACON TRIAL DONE', '+$400 — the bay bows to your driving.');
        } else if (beacon.timer <= 0) { beacon.active = false; SH.hud.toast('Beacon Trial failed — out of time'); }
      }
    }
  }
  function gpsTarget(pp) {
    if (race && race.cp < race.def.cps.length) return { x: race.def.cps[race.cp][0], z: race.def.cps[race.cp][1] };
    if (job) return { x: job.x, z: job.z };
    if (beacon && beacon.active) return beacon.target;
    return null;
  }
  function update(dt) {
    var pp = SH.player.pos();
    updateJobs(dt, pp);
    updateRace(dt, pp);
    updateCollectibles(dt, pp);
  }
  return {
    init: init, update: update, startRace: startRace, gpsTarget: gpsTarget,
    races: RACES, jobDefs: JOB_DEFS,
    isRacing: function () { return !!race; }, racePosition: racePosition,
    activeJob: function () { return job; }
  };
})();
