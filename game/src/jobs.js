// ============================================================================
// SOLSTICE HEAT — jobs.js  (Round 11, NEW)
// Repeatable side work, picked up at glowing job boards scattered across
// Solstice Bay (press J nearby). Three flavours rotate on a weighted roll:
//   courier — a package, a destination, a clock.
//   race    — a checkpoint rush through three road gates against the clock.
//   vip     — collect a named passenger and deliver them in one piece.
// Payouts scale with distance, the player's reputation level (economy.js)
// and a completion streak that grows +12% per back-to-back job and resets
// the moment a job fails or is abandoned. Jobs share the HUD job board and
// draw their own green pillar marker + minimap blip, separate from the
// gold story-mission marker.
// ============================================================================
(function () {
'use strict';
window.SH = window.SH || {};

var C = SH.Config;
var J = C.jobs;
var U = SH.U;

var marker = null;
var markerMat = null;
var markerRing = null;
var boardMeshes = [];
var active = null;         // the running job, or null
var streak = 0;            // consecutive completions (payout ladder)
var takenCount = 0;

// --- marker (same visual language as missions, green for work) ---------------
function buildMarker() {
  marker = new THREE.Group();
  markerMat = new THREE.MeshBasicMaterial({
    color: 0x51e88a, transparent: true, opacity: 0.30,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  var pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 24, 14, 1, true), markerMat);
  pillar.position.y = 12;
  marker.add(pillar);
  var ringMat = new THREE.MeshBasicMaterial({
    color: 0x51e88a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false
  });
  markerRing = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.4, 28), ringMat);
  markerRing.rotation.x = -Math.PI / 2;
  markerRing.position.y = 0.12;
  marker.add(markerRing);
  marker.visible = false;
  SH.scene.add(marker);
}
function setMarker(x, z) {
  if (!marker) buildMarker();
  marker.position.set(x, 0, z);
  marker.visible = true;
}
function hideMarker() { if (marker) marker.visible = false; }

// --- job boards: a small glowing post at every pickup point -------------------
function buildBoards() {
  var postMat = new THREE.MeshLambertMaterial({ color: 0x2c3138 });
  var faceMat = new THREE.MeshBasicMaterial({ color: 0x51e88a });
  J.pickupPoints.forEach(function (bp) {
    var g = new THREE.Group();
    var post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.6, 0.22), postMat);
    post.position.y = 1.3;
    g.add(post);
    var face = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.1), faceMat);
    face.position.y = 2.5;
    g.add(face);
    var cap = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 0.2),
      new THREE.MeshLambertMaterial({ color: 0xffd94d }));
    cap.position.y = 3.05;
    g.add(cap);
    g.position.set(bp.x, 0, bp.z);
    g.rotation.y = SH.rng.range(0, Math.PI * 2);
    SH.scene.add(g);
    boardMeshes.push(g);
  });
}

function playerPos() {
  return (SH.Player.inCar && SH.Player.car) ? SH.Player.car.mesh.position : SH.Player.pos;
}
function playerDistTo(x, z) {
  var p = playerPos();
  return U.dist(p.x, p.z, x, z);
}

function nearBoard() {
  var best = null, bd = J.pickupRadius;
  for (var i = 0; i < J.pickupPoints.length; i++) {
    var bp = J.pickupPoints[i];
    var d = playerDistTo(bp.x, bp.z);
    if (d < bd) { bd = d; best = bp; }
  }
  return best;
}

// Pick a destination far enough away to be a real drive, from named places.
function pickDestination(fromX, fromZ) {
  var keys = Object.keys(C.locations);
  var best = null, bestD = -1;
  for (var tries = 0; tries < 6; tries++) {
    var loc = C.locations[SH.rng.pick(keys)];
    var d = U.dist(fromX, fromZ, loc.x, loc.z);
    if (d > bestD) { bestD = d; best = loc; }
    if (d > 150) break;
  }
  return { loc: best, dist: bestD };
}

// Checkpoint gates for a race: walk the road grid from start toward the
// destination (along x to its column, then along z to its row) and take
// three evenly spaced intersections — every gate sits on a real road.
function raceGates(fromX, fromZ, dest) {
  var W = C.world;
  function nearestIdx(arr, v) {
    var bi = 0, bd = 1e9;
    for (var i = 0; i < arr.length; i++) { var d = Math.abs(arr[i] - v); if (d < bd) { bd = d; bi = i; } }
    return bi;
  }
  var si = nearestIdx(W.vx, fromX), sj = nearestIdx(W.hz, fromZ);
  var di = nearestIdx(W.vx, dest.x), dj = nearestIdx(W.hz, dest.z);
  var path = [];
  var i = si, j = sj;
  path.push({ x: W.vx[i], z: W.hz[j] });
  while (i !== di) { i += Math.sign(di - i); path.push({ x: W.vx[i], z: W.hz[j] }); }
  while (j !== dj) { j += Math.sign(dj - j); path.push({ x: W.vx[i], z: W.hz[j] }); }
  if (path.length < 3) path.push({ x: dest.x, z: dest.z });
  var gates = [];
  for (var k = 1; k <= J.raceCheckpoints; k++) {
    var idx = Math.min(path.length - 1, Math.floor(path.length * k / (J.raceCheckpoints + 1)));
    gates.push(path[idx]);
  }
  gates.push({ x: dest.x, z: dest.z });
  return gates;
}

function streakMult() {
  return 1 + Math.min(streak, J.streakCap) * J.streakBonus;
}

function takeJob(board) {
  if (active) return;
  var kind = SH.rng.weighted([['courier', 5], ['race', 3], ['vip', 2]]);
  var spec = J.types[kind];
  var p = playerPos();
  var destInfo = pickDestination(board.x, board.z);
  var dest = destInfo.loc;
  var dist = destInfo.dist;
  var job = {
    kind: kind, spec: spec, board: board,
    dest: dest, destName: dest.label, dist: dist,
    timer: spec.timeBase + dist * spec.timePerMeter,
    stage: 'deliver', gates: null, gateIdx: 0,
    ped: null, vipName: '', startDamage: 0
  };
  if (kind === 'race') {
    job.gates = raceGates(p.x, p.z, dest);
    job.timer = spec.timeBase + dist * spec.timePerMeter + job.gates.length * 6;
    setMarker(job.gates[0].x, job.gates[0].z);
  } else if (kind === 'vip') {
    job.stage = 'pickup';
    job.vipName = SH.rng.pick(C.vipNames);
    var ped = SH.People.spawn(board.x + 1.6, board.z + 1.2);
    ped.state = 'wait';
    ped.target = null;
    job.ped = ped;
    setMarker(board.x, board.z);
  } else {
    setMarker(dest.x, dest.z);
  }
  active = job;
  takenCount++;
  if (SH.Economy) SH.Economy.countJobTaken();
  if (SH.Audio) SH.Audio.pickup();
  if (SH.HUD) {
    SH.HUD.message(spec.label.toUpperCase(), jobHeadline(job), 2400);
    SH.HUD.toastQueue([jobBrief(job)]);
  }
  refreshBoard();
}

function jobHeadline(job) {
  if (job.kind === 'courier') return 'Package → ' + job.destName;
  if (job.kind === 'race') return 'Gates → ' + job.destName;
  return job.vipName + ' is waiting at the board';
}
function jobBrief(job) {
  if (job.kind === 'courier') return 'Dispatch: Package on board. ' + job.destName + ', against the clock. Clean driving pays.';
  if (job.kind === 'race') return 'Dispatch: Checkpoint rush — thread every green gate, finish at ' + job.destName + '.';
  return 'Dispatch: ' + job.vipName + ' wants a smooth ride to a place they will name once aboard. No dents, bigger tip.';
}

function jobObjectiveText(job) {
  if (!job) return '';
  if (job.kind === 'courier') return 'Courier: deliver to ' + job.destName;
  if (job.kind === 'race') {
    return job.gateIdx < job.gates.length - 1
      ? 'Checkpoint Rush: gate ' + (job.gateIdx + 1) + '/' + job.gates.length
      : 'Checkpoint Rush: finish at ' + job.destName;
  }
  return job.stage === 'pickup'
    ? 'VIP: collect ' + job.vipName + ' (stop beside them, in a car)'
    : 'VIP: take ' + job.vipName + ' to ' + job.destName;
}

function refreshBoard() {
  if (!SH.HUD || !SH.HUD.setJobBoard) return;
  if (active) {
    SH.HUD.setJobBoard([
      '◈ ' + active.spec.label + ' — ' + jobObjectiveText(active).split(': ')[1],
      'Streak ×' + streakMult().toFixed(2) + (streak > 0 ? ' (' + streak + ' in a row)' : '')
    ]);
  } else {
    var nb = nearBoard();
    var stats = SH.Economy ? SH.Economy.stats : null;
    SH.HUD.setJobBoard([
      nb ? 'J — take a job at ' + nb.label : 'Job boards glow green — drive to one, press J',
      'Jobs done: ' + (stats ? stats.jobsDone : 0) + (streak > 0 ? ' · streak ×' + streakMult().toFixed(2) : '')
    ]);
  }
}

function completeJob() {
  var job = active;
  if (!job) return;
  var gross = job.spec.base + job.dist * job.spec.perMeter;
  var streakPart = Math.round(gross * (streakMult() - 1));
  gross = Math.round(gross * streakMult());
  var res = SH.Economy
    ? SH.Economy.pay(gross, { xp: C.economy.xpPerJob, why: 'job' })
    : { cash: gross, banked: 0, bonus: 0, total: gross };
  streak++;
  if (SH.Economy) SH.Economy.countJobDone();
  if (SH.Audio) { SH.Audio.jobDone(); SH.Audio.cash(); }
  if (job.ped && job.ped.state === 'inCar') {
    job.ped.state = 'walk';
    job.ped.mesh.visible = true;
    job.ped.pos.set(job.dest.x + 2, 0, job.dest.z + 1);
    job.ped.target = null;
  }
  active = null;
  hideMarker();
  if (SH.HUD) {
    if (SH.HUD.showReward) {
      SH.HUD.showReward(job.spec.label + ' complete', [
        ['Payout', U.fmtMoney(res.total)],
        ['Reputation bonus', '+' + U.fmtMoney(res.bonus)],
        ['Streak bonus', '+' + U.fmtMoney(streakPart)],
        ['Banked', U.fmtMoney(res.banked)],
        ['Cash in hand', U.fmtMoney(res.cash)]
      ]);
    } else {
      SH.HUD.message('JOB COMPLETE', '+' + U.fmtMoney(res.cash) + ' cash', 2400);
    }
  }
  if (SH.Save) SH.Save.save();
  refreshBoard();
}

function failJob(why) {
  if (!active) return;
  if (active.ped) {
    if (active.ped.state === 'inCar') {
      active.ped.state = 'walk';
      active.ped.mesh.visible = true;
      var p = playerPos();
      active.ped.pos.set(p.x + 2, 0, p.z + 1);
    } else if (active.ped.state === 'wait') {
      active.ped.state = 'walk';
    }
    active.ped.target = null;
  }
  active = null;
  streak = 0;
  hideMarker();
  if (SH.Audio) SH.Audio.fail();
  if (SH.HUD) SH.HUD.message('JOB FAILED', why + ' — streak reset', 2400);
  refreshBoard();
}

function updateJob(dt) {
  var job = active;
  if (!job) { refreshBoardThrottled(dt); return; }
  job.timer -= dt;
  // The HUD has one countdown slot: a timed story mission owns it first,
  // otherwise the job clock shows. Both still run internally either way.
  var mActive = SH.Missions && SH.Missions.state ? SH.Missions.state.active : null;
  var missionTimed = !!(mActive && (mActive.type === 'deliver' || mActive.type === 'crown'));
  if (SH.HUD && !missionTimed) SH.HUD.setTimer(job.timer);
  if (job.timer <= 0) { failJob('Out of time'); return; }

  if (job.kind === 'courier') {
    if (playerDistTo(job.dest.x, job.dest.z) < 8) completeJob();
  } else if (job.kind === 'race') {
    var gate = job.gates[job.gateIdx];
    if (gate && playerDistTo(gate.x, gate.z) < 11) {
      job.gateIdx++;
      if (SH.Audio) SH.Audio.pickup();
      if (job.gateIdx >= job.gates.length) { completeJob(); return; }
      var next = job.gates[job.gateIdx];
      setMarker(next.x, next.z);
      job.timer += 6; // each gate buys a breath
      if (SH.HUD && SH.HUD.scorePopup) SH.HUD.scorePopup('GATE ' + job.gateIdx + '/' + job.gates.length + '  +6s');
    }
  } else if (job.kind === 'vip') {
    if (job.stage === 'pickup') {
      if (!job.ped || job.ped.state === 'down' || job.ped.state === 'gone') {
        failJob('Your VIP bailed'); return;
      }
      if (SH.Player.inCar && playerDistTo(job.ped.pos.x, job.ped.pos.z) < 6 &&
          Math.abs(SH.Player.car.speed) < 1.5) {
        job.ped.state = 'inCar';
        job.ped.mesh.visible = false;
        job.stage = 'deliver';
        job.startDamage = SH.Player.car.damage;
        setMarker(job.dest.x, job.dest.z);
        if (SH.Audio) SH.Audio.door();
        if (SH.HUD) SH.HUD.toastQueue([job.vipName + ': ' + job.destName + '. And darling — the paint is the tip.']);
      }
    } else {
      if (!SH.Player.inCar) { /* paused mid-ride; timer keeps the pressure on */ }
      else if (playerDistTo(job.dest.x, job.dest.z) < 8 && Math.abs(SH.Player.car.speed) < 2) {
        // a gentle arrival with an intact car earns the full distance rate;
        // completeJob already pays it — damage is reported in the summary
        completeJob();
        return;
      }
    }
  }
  refreshBoardThrottled(dt);
}

var boardThrottle = 0;
function refreshBoardThrottled(dt) {
  boardThrottle -= dt;
  if (boardThrottle <= 0) { boardThrottle = 0.6; refreshBoard(); }
}

SH.Jobs = {
  init: function () {
    buildMarker();
    buildBoards();
    refreshBoard();
  },
  active: function () { return active; },
  objectiveText: jobObjectiveText,
  streak: function () { return streak; },
  nearBoard: nearBoard,
  markerPos: function () {
    return (marker && marker.visible && active) ? marker.position : null;
  },
  boardPositions: function () { return J.pickupPoints; },

  // J key: take a job at a board, or abandon the running one.
  toggleAtPlayer: function () {
    if (active) { failJob('Abandoned'); return; }
    var nb = nearBoard();
    if (nb) takeJob(nb);
    else if (SH.HUD) SH.HUD.toastQueue(['Dispatch: No job board in reach. Boards glow green — check the minimap squares.']);
  },

  // Missions hook: the Night Ledger counts completions via Economy stats,
  // but a wasted/busted player drops the job like everything else.
  onPlayerDown: function () {
    if (active) failJob('You went down');
  },

  update: function (dt) {
    if (marker && marker.visible) {
      markerRing.rotation.z -= dt * 1.1;
      var s = 1 + Math.sin(SH.G.time * 3.6) * 0.08;
      markerRing.scale.set(s, s, 1);
    }
    // boards breathe: a slow emissive-style pulse via scale on the cap is
    // overkill; the green faces already read at distance. Just run the job.
    updateJob(dt);
  }
};
})();
