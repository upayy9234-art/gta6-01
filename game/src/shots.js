// ============================================================================
// SOLSTICE HEAT — shots.js
// Deterministic screenshot modes, selected with ?shot=<name>&seed=<n>.
// Each setup parks every actor by hand (hero car, traffic, police, peds,
// camera) so the four marketing shots are composed, not lucky. Input is
// locked, the day cycle is pinned to golden hour, and after main.js renders
// enough frames it freezes the scene and sets window.__shotReady = true.
// Round 11: the stills now show off the economy face — a mid-run bankroll
// with banked savings, a Fixer reputation with a part-filled XP bar, the
// side-job board, and (in the chase) an SBPD radio line under the ticker.
// ============================================================================
(function () {
'use strict';
window.SH = window.SH || {};

var U = SH.U;
var params = new URLSearchParams(window.location.search);
var shotName = params.get('shot');
var camPos = new THREE.Vector3();
var camLook = new THREE.Vector3();
var heroCar = null;

function parkPlayerAt(x, z, heading) {
  SH.Player.pos.set(x, 0, z);
  SH.Player.heading = heading;
}

// Deterministic stills cannot have random traffic wandering through the
// composition: clear every pre-spawned car/ped out of the shot's stage.
function clearArea(x, z, r) {
  var list = SH.Vehicles.list.slice();
  for (var i = 0; i < list.length; i++) {
    var p = list[i].mesh.position;
    if (U.dist(x, z, p.x, p.z) < r) SH.Vehicles.remove(list[i]);
  }
  var peds = SH.People.list;
  for (var j = 0; j < peds.length; j++) {
    if (U.dist(x, z, peds[j].pos.x, peds[j].pos.z) < r) {
      peds[j].pos.set(-178 + j * 2, 0, -152);
      peds[j].target = null;
    }
  }
}

function putPlayerInCar(car, speed) {
  SH.Player.enterCar(car);
  car.speed = speed;
  SH.Player.pos.copy(car.mesh.position);
  SH.Player.heading = car.heading;
}

// Round 11: dress the HUD's economy layer the way a real mid-run save
// would — Fixer reputation, money in the bank, jobs on the board.
function dressEconomy(jobLines) {
  SH.G.money = 2450; // a mid-run bankroll reads better than $0
  if (SH.Economy) {
    SH.Economy.restore({
      bank: 640, xp: 1350,
      stats: { distanceKm: 18.4, jobsDone: 7, jobsTaken: 8, faresDone: 3,
               missionsDone: 4, topSpeedKmh: 96, nearMisses: 5, earnedTotal: 3900 }
    });
  }
  if (SH.HUD && SH.HUD.setJobBoard) SH.HUD.setJobBoard(jobLines || []);
}

var setups = {
  // Low cinematic camera on the beach road: hero convertible angled at the
  // lens, neon blocks and palms behind it, low sun over the rooftops.
  cover: function () {
    document.body.classList.add('shot-cover');
    clearArea(173, 15, 24);
    heroCar = SH.Vehicles.spawn({
      type: 'convertible', color: 0xe2483d, x: 172.5, z: 15, heading: 0.62, mode: 'parked'
    });
    parkPlayerAt(170.4, 15.2, 0.68);
    // a little life in the background
    SH.Vehicles.spawn({ type: 'taxi', color: 0xf5c61d, x: 177.4, z: -30, heading: Math.PI, mode: 'parked' });
    SH.People.spawn(186, 26);
    SH.People.spawn(168, -6);
    camPos.set(179.5, 1.35, 26);
    camLook.set(171.8, 1.1, 14.2);
    var st = document.getElementById('shot-title');
    if (st) st.style.display = 'block';
  },

  // Behind the wheel downtown: traffic ahead, full HUD with the economy
  // panel and a live courier job on the board, minimap live.
  drive: function () {
    clearArea(-16, -26, 36);
    heroCar = SH.Vehicles.spawn({
      type: 'sedan', color: 0x2471a3, x: -34, z: -25.6, heading: Math.PI / 2, mode: 'parked'
    });
    putPlayerInCar(heroCar, 9);
    SH.Vehicles.spawn({ type: 'van', color: 0xecf0f1, x: -8, z: -25.6, heading: Math.PI / 2, mode: 'parked' });
    SH.Vehicles.spawn({ type: 'taxi', color: 0xf5c61d, x: 16, z: -25.6, heading: Math.PI / 2, mode: 'parked' });
    SH.Vehicles.spawn({ type: 'convertible', color: 0x27ae60, x: 2, z: -32.4, heading: -Math.PI / 2, mode: 'parked' });
    SH.People.spawn(-20, -20.5);
    SH.People.spawn(22, -35);
    dressEconomy(['◈ Courier Run — deliver to Solstice Motors', 'Streak ×1.24 (2 in a row)']);
    if (SH.HUD) {
      SH.HUD.setObjective('Deliver the sedan to Solstice Motors', 132);
      SH.HUD.setTimer(96);
    }
    camPos.set(-34 - 9.5, 3.3, -25.6);
    camLook.set(-34 + 8, 1.2, -25.6);
  },

  // Three stars, two interceptors on the tail, lightbars lit, dispatch
  // chatter on the radio line.
  chase: function () {
    clearArea(56, 54, 32);
    heroCar = SH.Vehicles.spawn({
      type: 'sedan', color: 0xf39c12, x: 54.6, z: 56, heading: 0, mode: 'parked'
    });
    putPlayerInCar(heroCar, 12);
    var p1 = SH.Vehicles.spawn({ type: 'police', color: 0x1c1e24, x: 54.2, z: 43, heading: 0.06, mode: 'police' });
    var p2 = SH.Vehicles.spawn({ type: 'police', color: 0x1c1e24, x: 61.8, z: 36, heading: -0.05, mode: 'police' });
    if (SH.Police.decorate) { SH.Police.decorate(p1); SH.Police.decorate(p2); }
    p1.speed = 11; p2.speed = 11;
    SH.Police.setWanted(3);
    // one tick so the HUD eye reads SEEN, then force both lightbars bright
    SH.Police.update(0.016);
    [p1, p2].forEach(function (p) {
      if (p.lightbar) {
        p.lightbar.red.color.setHex(0xff2222);
        p.lightbar.blue.color.setHex(0x2266ff);
      }
    });
    dressEconomy(['◈ Checkpoint Rush — gate 2/4', 'Streak ×1.12 (1 in a row)']);
    if (SH.HUD) {
      SH.HUD.setObjective('Lose the police completely', -1);
      if (SH.HUD.setRadioChatter) SH.HUD.setRadioChatter('Dispatch: all units, suspect is actively evading.');
    }
    camPos.set(49.5, 3.6, 24);
    camLook.set(56, 1.2, 60);
  },

  // On foot on the promenade: peds strolling, mission pillar ahead, the
  // marina job board in reach and its hint on the job board, sea right.
  foot: function () {
    clearArea(192, 14, 22);
    parkPlayerAt(191, 20, 2.72);
    SH.People.spawn(188.5, 12);
    SH.People.spawn(194, 8);
    SH.People.spawn(189, 28);
    SH.People.spawn(196, 26);
    SH.People.spawn(186.5, 2);
    dressEconomy(['J — take a job at Marina Job Board', 'Jobs done: 7 · streak ×1.24']);
    if (SH.Missions) SH.Missions.begin(); // mission 1: marina pillar at (200, 0)
    if (SH.HUD && SH.HUD.setBark) SH.HUD.setBark('“Heard the job boards pay better if you behave.”');
    camPos.set(191 - U.fwdX(2.72) * 7, 2.9, 20 - U.fwdZ(2.72) * 7);
    camLook.set(197, 1.4, 4);
  }
};

SH.Shots = {
  name: shotName,
  active: function () { return !!shotName && !!setups[shotName]; },
  setup: function () {
    if (!this.active()) return;
    document.body.classList.add('shotmode');
    if (shotName === 'cover') SH.G.money = 2450;
    setups[shotName]();
  },
  // Per-frame in shot mode: hold the composed camera (tiny push-in on cover).
  frame: function (dt, t) {
    if (!this.active()) return;
    if (shotName === 'cover') {
      camPos.x -= dt * 0.25;
      camPos.z -= dt * 0.35;
    }
    if (shotName === 'drive' && heroCar) {
      // keep the chase-cam glued behind the hero as spec'd in player.js
      camPos.set(heroCar.mesh.position.x - 9.5, 3.3, heroCar.mesh.position.z);
      camLook.set(heroCar.mesh.position.x + 8, 1.2, heroCar.mesh.position.z);
    }
    SH.camera.position.copy(camPos);
    SH.camera.lookAt(camLook);
    SH.City.update(dt, t);
  }
};
})();
