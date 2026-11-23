// Solstice Heat — jobs.js
// Six repeatable side jobs offered at job boards around the bay:
// taxi fares, parcel courier runs, checkpoint sprints, VIP escorts,
// tow-truck recoveries and paramedic pickups. Each job is a timed
// sequence of world targets paid through economy.js, with pay scaled
// by remaining time and vehicle condition.
(function () {
  "use strict";
  window.SH = window.SH || {};

  var cfg = window.SH.config;

  var JOB_TYPES = [
    {
      id: "taxi",
      name: "Taxi Fare",
      board: { x: -20, z: 250 },
      needsCar: true,
      basePay: 90,
      xp: 18,
      timePerLeg: 55,
      blurb: "Pick up the fare and drop them across town."
    },
    {
      id: "courier",
      name: "Parcel Courier",
      board: { x: 60, z: 120 },
      needsCar: false,
      basePay: 70,
      xp: 15,
      timePerLeg: 50,
      blurb: "Move three parcels before the clock runs out."
    },
    {
      id: "checkpoint",
      name: "Checkpoint Sprint",
      board: { x: -60, z: 90 },
      needsCar: true,
      basePay: 110,
      xp: 22,
      timePerLeg: 26,
      blurb: "Thread every checkpoint in order."
    },
    {
      id: "vip",
      name: "VIP Escort",
      board: { x: 30, z: 140 },
      needsCar: true,
      basePay: 160,
      xp: 30,
      timePerLeg: 75,
      blurb: "Drive the VIP smoothly — damage costs pay."
    },
    {
      id: "tow",
      name: "Tow Recovery",
      board: { x: 160, z: -60 },
      needsCar: true,
      basePay: 130,
      xp: 24,
      timePerLeg: 70,
      blurb: "Reach the stranded car and bring it to the garage."
    },
    {
      id: "medic",
      name: "Paramedic Run",
      board: { x: -150, z: -90 },
      needsCar: true,
      basePay: 140,
      xp: 28,
      timePerLeg: 60,
      blurb: "Collect the patient and reach the clinic fast."
    }
  ];

  var DROP_POINTS = [
    { name: "Hotel Azure", x: 30, z: 124 },
    { name: "Marina Pier", x: 44, z: 296 },
    { name: "University Gate", x: -176, z: -96 },
    { name: "Port Office", x: 176, z: -96 },
    { name: "Palm Heights Park", x: -20, z: -140 },
    { name: "Old Town Library", x: -156, z: 24 },
    { name: "Neon Mile Stage", x: 6, z: 84 },
    { name: "Boardwalk Kiosk", x: -84, z: 246 },
    { name: "Clinic", x: -140, z: -70 },
    { name: "Marina Garage", x: 146, z: 90 }
  ];

  var jobs = {
    types: JOB_TYPES,
    active: null,
    legIndex: 0,
    legs: [],
    timer: 0,
    startHealth: 100,
    boardMarker: null
  };

  function pickDrops(rng, count, avoid) {
    var pool = DROP_POINTS.slice();
    rng.shuffle(pool);
    var out = [];
    var i;
    for (i = 0; i < pool.length && out.length < count; i++) {
      if (avoid && cfg.dist2d(pool[i].x, pool[i].z, avoid.x, avoid.z) < 30) {
        continue;
      }
      out.push(pool[i]);
    }
    return out;
  }

  function buildLegs(type, rng) {
    var legs = [];
    if (type.id === "taxi") {
      var fare = pickDrops(rng, 1, type.board)[0];
      legs.push({ text: "Pick up the fare at " + fare.name, target: fare, radius: 8 });
      var drop = pickDrops(rng, 1, fare)[0];
      legs.push({ text: "Drop the fare at " + drop.name, target: drop, radius: 9 });
    } else if (type.id === "courier") {
      var drops = pickDrops(rng, 3, type.board);
      var i;
      for (i = 0; i < drops.length; i++) {
        legs.push({
          text: "Deliver parcel " + (i + 1) + " to " + drops[i].name,
          target: drops[i],
          radius: 8
        });
      }
    } else if (type.id === "checkpoint") {
      var points = pickDrops(rng, 4, type.board);
      var j;
      for (j = 0; j < points.length; j++) {
        legs.push({
          text: "Checkpoint " + (j + 1) + " — " + points[j].name,
          target: points[j],
          radius: 10
        });
      }
    } else if (type.id === "vip") {
      var pickup = pickDrops(rng, 1, type.board)[0];
      legs.push({ text: "Collect the VIP at " + pickup.name, target: pickup, radius: 8 });
      var stage = { name: "Neon Mile Stage", x: 6, z: 84 };
      legs.push({ text: "Drive the VIP to the Neon Mile Stage", target: stage, radius: 10 });
    } else if (type.id === "tow") {
      var stranded = pickDrops(rng, 1, type.board)[0];
      legs.push({ text: "Reach the stranded car at " + stranded.name, target: stranded, radius: 9 });
      var garage = { name: "Marina Garage", x: 146, z: 90 };
      legs.push({ text: "Tow it back to the Marina Garage", target: garage, radius: 10 });
    } else if (type.id === "medic") {
      var patient = pickDrops(rng, 1, type.board)[0];
      legs.push({ text: "Collect the patient at " + patient.name, target: patient, radius: 9 });
      var clinic = { name: "Clinic", x: -140, z: -70 };
      legs.push({ text: "Get the patient to the Clinic", target: clinic, radius: 10 });
    }
    return legs;
  }

  function nearBoard(playerPos) {
    var i;
    for (i = 0; i < JOB_TYPES.length; i++) {
      var b = JOB_TYPES[i].board;
      if (cfg.dist2d(playerPos.x, playerPos.z, b.x, b.z) < 7) {
        return JOB_TYPES[i];
      }
    }
    return null;
  }

  function start(type, rng, player) {
    if (jobs.active) {
      return false;
    }
    if (type.needsCar && player.state !== "car") {
      if (window.SH.hud) {
        window.SH.hud.toast(type.name + " needs a car — press E near one first");
      }
      return false;
    }
    jobs.active = type;
    jobs.legs = buildLegs(type, rng);
    jobs.legIndex = 0;
    jobs.timer = type.timePerLeg * jobs.legs.length;
    jobs.startHealth = player.car ? player.car.health : 100;
    showLeg();
    if (window.SH.audio) {
      window.SH.audio.sfx.pickup();
    }
    return true;
  }

  function showLeg() {
    var leg = jobs.legs[jobs.legIndex];
    if (!leg || !window.SH.hud) {
      return;
    }
    window.SH.hud.setMission(jobs.active.name, leg.text, jobs.active.blurb);
  }

  function finish(player) {
    var type = jobs.active;
    var timeBonus = Math.floor(jobs.timer * 0.8);
    var pay = type.basePay + timeBonus;
    if (type.id === "vip" && player.car) {
      var damage = Math.max(0, jobs.startHealth - player.car.health);
      pay = Math.max(40, pay - Math.floor(damage * 1.2));
    }
    if (window.SH.economy) {
      window.SH.economy.completeJob(type, pay, type.xp);
    }
    if (window.SH.hud) {
      window.SH.hud.toast(type.name + " complete · " + cfg.formatMoney(pay));
      window.SH.hud.setMission("", "", "");
    }
    if (window.SH.audio) {
      window.SH.audio.sfx.success();
    }
    jobs.active = null;
    jobs.legs = [];
    jobs.legIndex = 0;
  }

  function fail(reason) {
    if (!jobs.active) {
      return;
    }
    if (window.SH.hud) {
      window.SH.hud.toast(jobs.active.name + " failed: " + reason);
      window.SH.hud.setMission("", "", "");
    }
    if (window.SH.audio) {
      window.SH.audio.sfx.fail();
    }
    jobs.active = null;
    jobs.legs = [];
    jobs.legIndex = 0;
  }

  function update(dt, player) {
    if (!jobs.active) {
      var board = nearBoard(player.pos);
      if (board && window.SH.hud) {
        window.SH.hud.prompt("Press E to start: " + board.name + " — " + board.blurb);
      }
      return;
    }
    jobs.timer -= dt;
    if (jobs.timer <= 0) {
      fail("out of time");
      return;
    }
    var leg = jobs.legs[jobs.legIndex];
    if (!leg) {
      finish(player);
      return;
    }
    if (window.SH.missions && window.SH.missions.marker) {
      var marker = window.SH.missions.marker;
      marker.position.set(leg.target.x, 13, leg.target.z);
      marker.visible = true;
    }
    if (window.SH.hud) {
      window.SH.hud.setSub(jobs.active.name + " · " + Math.ceil(jobs.timer) + "s left");
    }
    var focus = player.focusPos();
    if (cfg.dist2d(focus.x, focus.z, leg.target.x, leg.target.z) < leg.radius) {
      jobs.legIndex += 1;
      jobs.timer += jobs.active.timePerLeg * 0.35;
      if (window.SH.audio) {
        window.SH.audio.sfx.checkpoint();
      }
      if (jobs.legIndex >= jobs.legs.length) {
        finish(player);
      } else {
        showLeg();
      }
    }
  }

  function tryStart(rng, player) {
    var board = nearBoard(player.pos);
    if (board) {
      return start(board, rng, player);
    }
    return false;
  }

  jobs.start = start;
  jobs.fail = fail;
  jobs.update = update;
  jobs.nearBoard = nearBoard;
  jobs.tryStart = tryStart;
  jobs.dropPoints = DROP_POINTS;
  window.SH.jobs = jobs;
})();
