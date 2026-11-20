// ============================================================================
// SOLSTICE HEAT — missions.js
// Marisol Vega's story chain plus the repeatable taxi side job. A glowing
// light-pillar marker shows the current objective; each mission is a small
// state machine (goto / deliver / chase / collect / escape / finale, and
// Round 11's jobs + crown) checked every frame against the player's
// position, car and wanted level. Progress (mission index, money, taxi
// unlock) is saved by main.js.
// Round 11: the chain grows to eight missions — Night Ledger sends the
// player out to work the new side-job boards, and Solstice Crown is a
// five-star, against-the-clock finale at The Gilded Palm. Every payout now
// flows through economy.js (reputation bonus + automatic banking) and ends
// with an itemised reward summary on the HUD.
// ============================================================================
(function () {
'use strict';
window.SH = window.SH || {};

var C = SH.Config;
var U = SH.U;

var marker = null;         // THREE.Group light pillar
var markerMat = null;
var markerRing = null;
var state = {
  index: 0,                // next mission to run (== missions.length when story done)
  active: null,            // runtime copy of the current mission
  phase: 'idle',           // per-type phase
  timer: -1,               // countdown when >= 0
  casesGot: 0,
  caseIdx: 0,
  targetCar: null,
  targetHits: 0,
  deliverCar: null,
  jobsBase: 0,             // Round 11: Economy jobsDone when Night Ledger began
  taxiUnlocked: false,
  storyDone: false,
  taxi: null               // {stage, ped, destName, dest, startT, startPos}
};

function buildMarker() {
  marker = new THREE.Group();
  markerMat = new THREE.MeshBasicMaterial({
    color: 0xffd94d, transparent: true, opacity: 0.32,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  var pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 26, 14, 1, true), markerMat);
  pillar.position.y = 13;
  marker.add(pillar);
  var ringMat = new THREE.MeshBasicMaterial({
    color: 0xffd94d, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false
  });
  markerRing = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.5, 28), ringMat);
  markerRing.rotation.x = -Math.PI / 2;
  markerRing.position.y = 0.12;
  marker.add(markerRing);
  marker.visible = false;
  SH.scene.add(marker);
}

function setMarker(x, z, colorHex) {
  if (!marker) buildMarker();
  marker.position.set(x, 0, z);
  markerMat.color.setHex(colorHex);
  markerRing.material.color.setHex(colorHex);
  marker.visible = true;
}
function hideMarker() { if (marker) marker.visible = false; }

function locOf(key) { return C.locations[key]; }

function playerDistTo(x, z) {
  var p = SH.Player.inCar && SH.Player.car ? SH.Player.car.mesh.position : SH.Player.pos;
  return U.dist(p.x, p.z, x, z);
}

function toastLines(lines, done) {
  if (SH.HUD) SH.HUD.toastQueue(lines, done);
}

function startMission(i) {
  var def = C.missions[i];
  if (!def) { state.storyDone = true; state.active = null; hideMarker(); return; }
  var m = {
    def: def, type: def.type, title: def.title, payout: def.payout,
    objective: def.objective
  };
  state.active = m;
  state.phase = 'main';
  state.timer = -1;
  state.casesGot = 0;
  state.caseIdx = 0;
  state.targetHits = 0;
  state.targetCar = null;
  state.deliverCar = null;
  toastLines(def.intro);
  if (SH.HUD) SH.HUD.message(def.title, 'Marisol Vega', 2600);

  if (def.type === 'goto') {
    var t = locOf(def.target);
    setMarker(t.x, t.z, 0xffd94d);
  } else if (def.type === 'deliver') {
    // the gold sedan waits near the diner, parked at the curb
    var car = SH.Vehicles.spawn({
      type: 'sedan', color: 0xd4af37, x: -110.6, z: 52, heading: Math.PI, mode: 'parked'
    });
    state.deliverCar = car;
    setMarker(car.mesh.position.x, car.mesh.position.z, 0xffd94d);
    m.objective = 'Take the gold sedan near Starfish Diner';
  } else if (def.type === 'chase') {
    var target = SH.Vehicles.spawn({
      type: 'convertible', color: 0xc0272d, x: 116, z: -52, heading: 0, mode: 'target',
      maxSpeed: 16, cruise: 12
    });
    SH.Vehicles.planRoute(target, SH.rng);
    state.targetCar = target;
    setMarker(target.mesh.position.x, target.mesh.position.z, 0xff5e5e);
    m.objective = 'Stop the red coupe (ram it 3 times)';
  } else if (def.type === 'collect') {
    var s = C.caseSpots[0];
    setMarker(s.x, s.z, 0xffd94d);
  } else if (def.type === 'escape') {
    SH.Police.setWanted(3);
    SH.Police.deploy(3);
    hideMarker();
  } else if (def.type === 'finale') {
    var b = locOf('bank');
    setMarker(b.x, b.z, 0xffd94d);
    state.phase = 'pickup';
  } else if (def.type === 'jobs') {
    // Round 11: snapshot the lifetime job count; the mission completes
    // when jobsNeeded fresh completions land on top of it.
    state.jobsBase = SH.Economy ? SH.Economy.stats.jobsDone : 0;
    hideMarker();
    m.objective = 'Complete side jobs (0/' + def.jobsNeeded + ') — press J at a job board';
    // point the player at the closest board so the new system is findable
    if (SH.Jobs && SH.Jobs.boardPositions) {
      var boards = SH.Jobs.boardPositions();
      var bp2 = SH.Player.pos, bestB = null, bestBD = 1e18;
      for (var bi = 0; bi < boards.length; bi++) {
        var bd2 = U.dist2(bp2.x, bp2.z, boards[bi].x, boards[bi].z);
        if (bd2 < bestBD) { bestBD = bd2; bestB = boards[bi]; }
      }
      if (bestB) setTimeout(function () {
        if (SH.HUD) SH.HUD.toastQueue(['Marisol: Nearest board: ' + bestB.label + ' — green square on your minimap. Go earn.']);
      }, 5200);
    }
  } else if (def.type === 'crown') {
    var g = locOf('gilded');
    setMarker(g.x, g.z, 0xffd94d);
    state.phase = 'pickup';
  }
  refreshObjective();
}

function refreshObjective() {
  if (!SH.HUD) return;
  var m = state.active;
  if (!m) {
    SH.HUD.setObjective(state.storyDone
      ? 'Free roam — T for taxi work, J at a green board for side jobs'
      : '', -1);
    return;
  }
  var text = m.objective;
  var d = -1;
  if (marker && marker.visible) d = playerDistTo(marker.position.x, marker.position.z);
  SH.HUD.setObjective(text, d);
}

function completeMission() {
  var m = state.active;
  if (!m) return;
  // Round 11: one payout pipeline for story money — reputation bonus and
  // the automatic bank split included, then an itemised summary panel.
  var res = SH.Economy
    ? SH.Economy.pay(m.payout, { xp: C.economy.xpPerMission, why: 'mission' })
    : { cash: m.payout, banked: 0, bonus: 0, total: m.payout };
  if (SH.Economy) SH.Economy.countMission();
  SH.Audio.complete();
  SH.Audio.cash();
  if (SH.HUD) {
    SH.HUD.message('MISSION COMPLETE', m.def.title + '  ·  +' + U.fmtMoney(res.cash), 3200);
    if (SH.HUD.showReward) {
      var rows = [
        ['Mission payout', U.fmtMoney(m.payout)],
        ['Reputation bonus', '+' + U.fmtMoney(res.bonus)],
        ['Banked (15%)', U.fmtMoney(res.banked)],
        ['Cash in hand', U.fmtMoney(res.cash)]
      ];
      var nextDef = C.missions[state.index + 1];
      rows.push(['Next up', nextDef ? nextDef.title : 'The bay is yours — free roam']);
      SH.HUD.showReward(m.def.title + ' — reward summary', rows);
    }
    SH.HUD.toastQueue([m.def.from + ': Clean work. ' + U.fmtMoney(res.cash) + ' in hand, ' +
      U.fmtMoney(res.banked) + ' banked. Stay shiny, partner.']);
  }
  if (m.def.id === 'hotwheels' && !state.taxiUnlocked) {
    state.taxiUnlocked = true;
    setTimeout(function () {
      if (SH.HUD) SH.HUD.toastQueue(['Marisol: Word travels. Taxi dispatch will ping you now — press T behind any wheel for fares.']);
    }, 3600);
  }
  state.index++;
  state.active = null;
  hideMarker();
  if (SH.Save) SH.Save.save();
  // a beat of free roam, then Marisol calls again
  setTimeout(function () {
    if (SH.G.mode === 'playing' && !state.active && state.index < C.missions.length) {
      startMission(state.index);
    } else if (state.index >= C.missions.length) {
      state.storyDone = true;
      if (SH.HUD) SH.HUD.toastQueue(['Marisol: That is the whole board, partner. Solstice Bay is ours. The streets stay open — taxi work and job boards pay forever.']);
      if (SH.Save) SH.Save.save();
    }
  }, 5000);
}

function failMission(reason) {
  var m = state.active;
  if (!m) return;
  SH.Audio.fail();
  if (SH.HUD) SH.HUD.message('MISSION FAILED', reason, 2800);
  // clean up mission props, then restart the same mission shortly
  if (state.deliverCar && !state.deliverCar.isPlayerCar) SH.Vehicles.remove(state.deliverCar);
  if (state.targetCar) SH.Vehicles.remove(state.targetCar);
  state.active = null;
  state.deliverCar = null;
  state.targetCar = null;
  state.timer = -1;
  if (SH.HUD) SH.HUD.setTimer(-1);
  hideMarker();
  var idx = state.index;
  setTimeout(function () {
    if (SH.G.mode === 'playing' && !state.active) startMission(idx);
  }, 3500);
}

// --- per-type mission logic ---------------------------------------------------------
function updateGoto(dt) {
  var m = state.active;
  var t = locOf(m.def.target);
  if (playerDistTo(t.x, t.z) < 6.5) completeMission();
}

function updateDeliver(dt) {
  var m = state.active;
  var car = state.deliverCar;
  if (!car || car.dead) { failMission('The sedan is gone.'); return; }
  if (state.phase === 'main') {
    setMarker(car.mesh.position.x, car.mesh.position.z, 0xffd94d);
    if (SH.Player.inCar && SH.Player.car === car) {
      state.phase = 'drive';
      state.timer = m.def.time;
      var g = locOf('garage');
      setMarker(g.x, g.z, 0xffd94d);
      m.objective = 'Deliver the sedan to Solstice Motors';
      if (SH.HUD) SH.HUD.toastQueue(['Marisol: Clock is running. Solstice Motors, south side. Go.']);
    }
  } else if (state.phase === 'drive') {
    state.timer -= dt;
    if (SH.HUD) SH.HUD.setTimer(state.timer);
    if (state.timer <= 0) { failMission('Out of time — the buyer walked.'); return; }
    if (car.damage > 96) { failMission('The sedan is wrecked.'); return; }
    var g2 = locOf('garage');
    if (SH.Player.inCar && SH.Player.car === car && playerDistTo(g2.x, g2.z) < 7.5) {
      state.timer = -1;
      if (SH.HUD) SH.HUD.setTimer(-1);
      // hand the car over: it becomes the garage's problem now
      SH.Player.exitCar();
      car.mode = 'parked';
      completeMission();
    }
  }
  refreshObjective();
}

function updateChase(dt) {
  var target = state.targetCar;
  if (!target || target.dead) { failMission('The coupe vanished.'); return; }
  if (target.mode === 'target') {
    setMarker(target.mesh.position.x, target.mesh.position.z, 0xff5e5e);
    // flee bias: re-plan routes away from the player every few seconds
    target.fleeT = (target.fleeT || 0) - dt;
    if (target.fleeT <= 0) {
      target.fleeT = 3;
      var pp = SH.Player.pos;
      if (U.dist(pp.x, pp.z, target.mesh.position.x, target.mesh.position.z) < 55) {
        target.nav.length = 0; // trafficControl re-plans; speed keeps it ahead
      }
    }
    if (state.targetHits >= 3) {
      target.mode = 'off';
      // the courier bails and runs
      var ped = SH.People.nearestPed(target.mesh.position.x, target.mesh.position.z, 30, true);
      if (ped) {
        ped.state = 'flee'; ped.fleeT = 5;
        ped.threat = { x: target.mesh.position.x, z: target.mesh.position.z };
      }
      if (SH.HUD) SH.HUD.toastQueue(['Marisol: He is stopped! Get over there and make it official.']);
      state.active.objective = 'Reach the stopped coupe';
    }
  } else if (target.mode === 'off') {
    setMarker(target.mesh.position.x, target.mesh.position.z, 0xffd94d);
    if (playerDistTo(target.mesh.position.x, target.mesh.position.z) < 8) {
      completeMission();
    }
  }
  refreshObjective();
}

function updateCollect(dt) {
  var spot = C.caseSpots[state.caseIdx];
  if (!spot) { completeMission(); return; }
  setMarker(spot.x, spot.z, 0xffd94d);
  if (playerDistTo(spot.x, spot.z) < 4.2) {
    state.casesGot++;
    state.caseIdx++;
    SH.Audio.pickup();
    SH.Audio.cash();
    if (SH.Economy) SH.Economy.addCash(150); else SH.G.money += 150;
    if (SH.HUD) SH.HUD.message('CASE ' + state.casesGot + '/3', '+$150 walking-around money', 1500);
    state.active.objective = 'Collect the cash cases (' + state.casesGot + '/3)';
    if (state.caseIdx >= C.caseSpots.length) { completeMission(); return; }
  }
  refreshObjective();
}

function updateEscape(dt) {
  // completion is driven by Police.onWantedCleared; here we just narrate
  refreshObjective();
}

// Round 11: Night Ledger — the story leans on the job system. Progress is
// the delta in lifetime jobs completed since the mission began.
function updateJobs(dt) {
  var m = state.active;
  var done = SH.Economy ? (SH.Economy.stats.jobsDone - state.jobsBase) : 0;
  done = Math.max(0, Math.min(done, m.def.jobsNeeded));
  m.objective = 'Complete side jobs (' + done + '/' + m.def.jobsNeeded + ') — press J at a job board';
  if (done >= m.def.jobsNeeded) { completeMission(); return; }
  refreshObjective();
}

// Round 11: Solstice Crown — Final Tide's bigger sibling: five stars AND
// a hard clock on the delivery leg.
function updateCrown(dt) {
  var m = state.active;
  if (state.phase === 'pickup') {
    var g = locOf('gilded');
    if (playerDistTo(g.x, g.z) < 6.5) {
      state.phase = 'deliver';
      state.timer = m.def.time;
      SH.Police.setWanted(5);
      SH.Police.deploy(5);
      var mk = locOf('marina');
      setMarker(mk.x, mk.z, 0xffd94d);
      m.objective = 'Deliver the crown case to Marina Pier — five stars, one clock';
      if (SH.HUD) SH.HUD.toastQueue(['Marisol: The crown is in hand and the whole bay just stood up. Marina Pier. DRIVE.']);
    }
  } else if (state.phase === 'deliver') {
    state.timer -= dt;
    if (SH.HUD) SH.HUD.setTimer(state.timer);
    if (state.timer <= 0) {
      if (SH.HUD) SH.HUD.setTimer(-1);
      state.timer = -1;
      SH.Police.clearWanted();
      failMission('The crown went cold — the buyer vanished.');
      return;
    }
    var t = locOf('marina');
    if (playerDistTo(t.x, t.z) < 7) {
      state.timer = -1;
      if (SH.HUD) SH.HUD.setTimer(-1);
      SH.Police.clearWanted();
      completeMission();
    }
  }
  refreshObjective();
}

function updateFinale(dt) {
  var m = state.active;
  if (state.phase === 'pickup') {
    var b = locOf('bank');
    if (playerDistTo(b.x, b.z) < 6.5) {
      state.phase = 'deliver';
      SH.Police.setWanted(4);
      SH.Police.deploy(4);
      var mk = locOf('marina');
      setMarker(mk.x, mk.z, 0xffd94d);
      m.objective = 'Deliver the case to Marina Pier — do not get caught';
      if (SH.HUD) SH.HUD.toastQueue(['Marisol: Case is in hand and the bay just lit up. Marina Pier. DRIVE.']);
    }
  } else if (state.phase === 'deliver') {
    var t = locOf('marina');
    if (playerDistTo(t.x, t.z) < 7) {
      SH.Police.clearWanted();
      completeMission();
    }
  }
  refreshObjective();
}

// --- taxi side job ---------------------------------------------------------------------
function startTaxi() {
  if (!state.taxiUnlocked) {
    if (SH.HUD) SH.HUD.toastQueue(['Dispatch: No taxi license on file yet. Marisol can fix that — finish her second job first.']);
    return;
  }
  if (state.taxi) { cancelTaxi('Fare cancelled.'); return; }
  if (!SH.Player.inCar) {
    if (SH.HUD) SH.HUD.toastQueue(['Dispatch: You need to be behind a wheel to take fares.']);
    return;
  }
  var r = SH.rng;
  var spot = SH.City.randomSidewalkPoint(r);
  var ped = SH.People.nearestPed(spot.x, spot.z, 24, true);
  if (!ped) ped = SH.People.spawn(spot.x, spot.z);
  ped.state = 'wait';
  ped.target = null;
  var name = r.pick(C.taxiNames);
  state.taxi = {
    stage: 'pickup', ped: ped, name: name,
    dest: null, destName: '', startT: 0, startPos: null
  };
  setMarker(ped.pos.x, ped.pos.z, 0x5ee8d2);
  if (SH.HUD) {
    SH.HUD.setTaxiObjective('Taxi: pick up ' + name);
    SH.HUD.toastQueue(['Dispatch: Fare waiting — ' + name + ' needs a ride. Follow the cyan pillar.']);
  }
}

function cancelTaxi(why) {
  if (!state.taxi) return;
  if (state.taxi.ped && state.taxi.ped.state === 'wait') state.taxi.ped.state = 'walk';
  if (state.taxi.ped && state.taxi.ped.state === 'inCar') {
    state.taxi.ped.state = 'walk';
    state.taxi.ped.mesh.visible = true;
  }
  state.taxi = null;
  if (SH.HUD) { SH.HUD.setTaxiObjective(''); SH.HUD.toastQueue(['Dispatch: ' + why]); }
  if (!state.active) hideMarker();
  else refreshObjective();
}

function updateTaxi(dt) {
  var tx = state.taxi;
  if (!tx) return;
  if (!SH.Player.inCar) return; // paused until the player is driving again
  if (tx.stage === 'pickup') {
    if (!tx.ped || tx.ped.state === 'down' || tx.ped.state === 'gone') {
      cancelTaxi('Your fare got spooked and left.');
      return;
    }
    setMarker(tx.ped.pos.x, tx.ped.pos.z, 0x5ee8d2);
    if (playerDistTo(tx.ped.pos.x, tx.ped.pos.z) < 6 && Math.abs(SH.Player.car.speed) < 1.5) {
      // passenger climbs in
      tx.ped.state = 'inCar';
      tx.ped.mesh.visible = false;
      SH.Audio.door();
      var keys = Object.keys(C.locations);
      var destKey = SH.rng.pick(keys);
      var dest = C.locations[destKey];
      tx.dest = dest;
      tx.destName = dest.label;
      tx.stage = 'dropoff';
      tx.startT = SH.G.time;
      tx.startPos = { x: SH.Player.pos.x, z: SH.Player.pos.z };
      setMarker(dest.x, dest.z, 0x5ee8d2);
      if (SH.HUD) SH.HUD.setTaxiObjective('Taxi: take ' + tx.name + ' to ' + dest.label);
    }
  } else if (tx.stage === 'dropoff') {
    setMarker(tx.dest.x, tx.dest.z, 0x5ee8d2);
    if (playerDistTo(tx.dest.x, tx.dest.z) < 7 && Math.abs(SH.Player.car.speed) < 1.5) {
      var straight = U.dist(tx.startPos.x, tx.startPos.z, tx.dest.x, tx.dest.z);
      var elapsed = SH.G.time - tx.startT;
      var fare = Math.round(35 + straight * 0.85);
      var par = straight * 0.55 + 25;
      var bonus = elapsed < par ? Math.round((par - elapsed) * 1.2) : 0;
      // Round 11: fares pay through the economy too (bonus + banking + XP)
      var res = SH.Economy
        ? SH.Economy.pay(fare + bonus, { xp: C.economy.xpPerFare, why: 'fare' })
        : { cash: fare + bonus, total: fare + bonus };
      if (SH.Economy) SH.Economy.countFare();
      SH.Audio.cash();
      SH.Audio.complete();
      if (SH.HUD) {
        SH.HUD.message('FARE PAID', U.fmtMoney(fare) + (bonus ? ' + ' + U.fmtMoney(bonus) + ' fast bonus' : '') +
          ' · ' + U.fmtMoney(res.cash) + ' in hand', 2400);
        SH.HUD.setTaxiObjective('');
      }
      // passenger gets out near the destination
      if (tx.ped) {
        tx.ped.state = 'walk';
        tx.ped.mesh.visible = true;
        tx.ped.pos.set(tx.dest.x + 2, 0, tx.dest.z + 1);
        tx.ped.target = null;
      }
      state.taxi = null;
      if (!state.active) hideMarker(); else refreshObjective();
      if (SH.Save) SH.Save.save();
    }
  }
}

// --- public API -------------------------------------------------------------------------
SH.Missions = {
  state: state,

  init: function () {
    buildMarker();
    // chase mission: count solid rams by the player's car on the target
    SH.Vehicles.onHit(function (car, other, strength) {
      var t = state.targetCar;
      if (!t || !state.active || state.active.type !== 'chase') return;
      if (strength < 3.2) return;
      var involvesTarget = (car === t || other === t);
      var involvesPlayer = (car && car.isPlayerCar) || (other && other.isPlayerCar);
      if (involvesTarget && involvesPlayer) {
        state.targetHits++;
        t.damage = Math.min(100, t.damage + 26);
        if (SH.HUD) SH.HUD.message('HIT ' + Math.min(3, state.targetHits) + '/3', 'Keep on him!', 900);
        SH.Audio.crash(true);
      }
    });
  },

  // Begin the chain at the saved index (called when a run starts).
  begin: function () {
    if (state.index >= C.missions.length) {
      state.storyDone = true;
      state.active = null;
      refreshObjective();
      return;
    }
    startMission(state.index);
  },

  onEnterCar: function (car) { /* deliver/taxi logic polls each frame instead */ },
  onExitCar: function (car) {
    if (state.taxi && state.taxi.stage === 'dropoff') {
      // stepping out mid-fare keeps the fare; getting back in resumes it
    }
  },

  onWantedCleared: function () {
    if (state.active && state.active.type === 'escape') completeMission();
  },

  // Called when the player is wasted/busted: restart the current mission.
  onPlayerDown: function () {
    if (state.taxi) cancelTaxi('Fare lost.');
    if (SH.Jobs) SH.Jobs.onPlayerDown();
    if (state.active) {
      var idx = state.index;
      if (state.deliverCar && !state.deliverCar.isPlayerCar) SH.Vehicles.remove(state.deliverCar);
      if (state.targetCar) SH.Vehicles.remove(state.targetCar);
      state.active = null;
      state.deliverCar = null;
      state.targetCar = null;
      state.timer = -1;
      if (SH.HUD) SH.HUD.setTimer(-1);
      hideMarker();
      setTimeout(function () {
        if (SH.G.mode === 'playing' && !state.active && !state.storyDone) startMission(idx);
      }, 2500);
    }
  },

  toggleTaxi: function () {
    if (state.taxi) cancelTaxi('Fare cancelled.');
    else startTaxi();
  },

  markerPos: function () {
    return (marker && marker.visible) ? marker.position : null;
  },
  taxiMarkerPos: function () {
    if (!state.taxi) return null;
    if (state.taxi.stage === 'pickup' && state.taxi.ped) return state.taxi.ped.pos;
    if (state.taxi.stage === 'dropoff') return state.taxi.dest;
    return null;
  },

  restore: function (data) {
    if (!data) { state.index = 0; state.taxiUnlocked = false; state.storyDone = false; return; }
    state.index = U.clamp(data.missionIndex || 0, 0, C.missions.length);
    state.taxiUnlocked = !!data.taxiUnlocked;
    state.storyDone = state.index >= C.missions.length;
  },

  saveData: function () {
    return {
      missionIndex: state.index,
      taxiUnlocked: state.taxiUnlocked,
      storyDone: state.storyDone
    };
  },

  update: function (dt) {
    // marker idle animation
    if (marker && marker.visible) {
      markerRing.rotation.z += dt * 0.8;
      var s = 1 + Math.sin(SH.G.time * 3.2) * 0.08;
      markerRing.scale.set(s, s, 1);
    }
    var m = state.active;
    if (m) {
      if (m.type === 'goto') updateGoto(dt);
      else if (m.type === 'deliver') updateDeliver(dt);
      else if (m.type === 'chase') updateChase(dt);
      else if (m.type === 'collect') updateCollect(dt);
      else if (m.type === 'escape') updateEscape(dt);
      else if (m.type === 'finale') updateFinale(dt);
      else if (m.type === 'jobs') updateJobs(dt);
      else if (m.type === 'crown') updateCrown(dt);
    }
    updateTaxi(dt);
  }
};
})();
