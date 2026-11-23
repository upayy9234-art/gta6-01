// Solstice Heat — missions.js
// The story campaign: ten missions for fixer Marisol Vega, preceded
// by a three-step guided onboarding. Mission types are goto, chase,
// tail, escort and survive. A mission is a small state machine with
// staged objectives, a world marker, optional timer, dialogue lines
// shown through the HUD, and cash/XP rewards paid by economy.js.
(function () {
  "use strict";
  window.SH = window.SH || {};

  var cfg = window.SH.config;

  var ONBOARDING = [
    {
      id: "ob1",
      title: "Welcome to Solstice Bay",
      text: "Get in your car",
      hint: "Walk to the red car and press E",
      type: "enterCar"
    },
    {
      id: "ob2",
      title: "Welcome to Solstice Bay",
      text: "Drive to the Marina marker",
      hint: "Follow the gold marker on the minimap",
      type: "goto",
      target: { x: 150, z: 130 },
      radius: 10
    },
    {
      id: "ob3",
      title: "Welcome to Solstice Bay",
      text: "Meet Marisol Vega at the pier",
      hint: "Park up and walk to Marisol on foot",
      type: "gotoFoot",
      target: { x: 40, z: 285 },
      radius: 6
    }
  ];

  var MISSIONS = [
    {
      id: "m1",
      title: "First Fare",
      type: "goto",
      giver: "Marisol Vega",
      brief: "A package waits at the Boardwalk kiosk. Pick it up and bring it to the Hotel Azure.",
      stages: [
        { text: "Pick up the package at the Boardwalk", target: { x: -80, z: 240 }, radius: 8 },
        { text: "Deliver it to Hotel Azure", target: { x: 30, z: 130 }, radius: 9 }
      ],
      reward: 180,
      xp: 40,
      dialogue: [
        "Marisol: Simple run. No questions, no detours.",
        "Marisol: The bay pays people who show up on time."
      ]
    },
    {
      id: "m2",
      title: "Tail the Courier",
      type: "tail",
      giver: "Marisol Vega",
      brief: "A rival courier leaves Neon Mile at dusk. Follow him without being spotted.",
      stages: [
        { text: "Reach the Neon Mile lookout", target: { x: -40, z: 120 }, radius: 9 },
        { text: "Tail the courier — stay close but unseen", target: { x: 90, z: -40 }, radius: 12, tail: true }
      ],
      reward: 240,
      xp: 55,
      dialogue: [
        "Marisol: He thinks the route is secret. It is not.",
        "Marisol: Close enough to see, far enough to breathe."
      ]
    },
    {
      id: "m3",
      title: "Harbor Run",
      type: "goto",
      giver: "Marisol Vega",
      brief: "A boat crew at the Port needs a driver before the tide turns.",
      stages: [
        { text: "Drive to the Port gates", target: { x: 170, z: -120 }, radius: 10 },
        { text: "Take the crew to the Marina", target: { x: 160, z: 110 }, radius: 10 }
      ],
      reward: 300,
      xp: 65,
      timer: 150,
      dialogue: [
        "Marisol: Tide waits for nobody. Neither do I.",
        "Crew chief: You drive like the ferry owes you money."
      ]
    },
    {
      id: "m4",
      title: "Chase the Debtor",
      type: "chase",
      giver: "Marisol Vega",
      brief: "A debtor bolted from Old Town in a yellow coupe. Run him down and stop his car.",
      stages: [
        { text: "Intercept the debtor in Old Town", target: { x: -170, z: 10 }, radius: 11 },
        { text: "Ram his car until he stops", target: { x: -60, z: -80 }, radius: 14, chase: true }
      ],
      reward: 360,
      xp: 80,
      dialogue: [
        "Marisol: He owes three months. Bring back the keys.",
        "Debtor: Tell Marisol the cheque is in the mail!"
      ]
    },
    {
      id: "m5",
      title: "Escort the Singer",
      type: "escort",
      giver: "Marisol Vega",
      brief: "Singer Lucia Rey needs a quiet ride from Palm Heights to her Neon Mile show.",
      stages: [
        { text: "Pick up Lucia in Palm Heights", target: { x: -30, z: -130 }, radius: 9 },
        { text: "Escort Lucia to the Neon Mile stage", target: { x: 10, z: 90 }, radius: 10 }
      ],
      reward: 420,
      xp: 90,
      dialogue: [
        "Lucia: If the paparazzi find us, drive faster.",
        "Marisol: She sings, you steer. Everyone stays famous."
      ]
    },
    {
      id: "m6",
      title: "Hold the Pier",
      type: "survive",
      giver: "Marisol Vega",
      brief: "Rivals want the pier meet cancelled. Hold the pier until the boat arrives.",
      stages: [
        { text: "Reach the Marina Pier", target: { x: 40, z: 330 }, radius: 12 },
        { text: "Survive on the pier", target: { x: 40, z: 350 }, radius: 26, survive: 45 }
      ],
      reward: 500,
      xp: 110,
      dialogue: [
        "Marisol: Ninety seconds of trouble, then we eat.",
        "Marisol: Keep the pier. Whatever it takes."
      ]
    },
    {
      id: "m7",
      title: "Campus Dash",
      type: "goto",
      giver: "Marisol Vega",
      brief: "A professor at the University left exam papers in a taxi across town.",
      stages: [
        { text: "Collect the papers at the University", target: { x: -180, z: -120 }, radius: 10 },
        { text: "Deliver them to the Old Town library", target: { x: -160, z: 20 }, radius: 9 }
      ],
      reward: 460,
      xp: 100,
      timer: 130,
      dialogue: [
        "Marisol: Even professors tip. Sometimes.",
        "Professor: You saved forty students. And one career."
      ]
    },
    {
      id: "m8",
      title: "Night Tail",
      type: "tail",
      giver: "Marisol Vega",
      brief: "A smuggler moves through Palm Heights after dark. Shadow him to the drop.",
      stages: [
        { text: "Find the smuggler in Palm Heights", target: { x: 40, z: -150 }, radius: 11 },
        { text: "Tail him to the drop point", target: { x: 150, z: -40 }, radius: 12, tail: true }
      ],
      reward: 560,
      xp: 125,
      dialogue: [
        "Marisol: Lights off when you can. Nerves of ice.",
        "Marisol: The drop point is the whole payday."
      ]
    },
    {
      id: "m9",
      title: "Port Blockade",
      type: "chase",
      giver: "Marisol Vega",
      brief: "A hijacked truck is fleeing the Port with Marisol's cargo aboard.",
      stages: [
        { text: "Reach the Port before the truck escapes", target: { x: 190, z: -90 }, radius: 12 },
        { text: "Stop the truck", target: { x: 60, z: 40 }, radius: 15, chase: true }
      ],
      reward: 680,
      xp: 150,
      timer: 160,
      dialogue: [
        "Marisol: That cargo has my name on every crate.",
        "Marisol: Bring the truck home. Dents are fine."
      ]
    },
    {
      id: "m10",
      title: "Solstice Heat",
      type: "escort",
      giver: "Marisol Vega",
      brief: "The final run: drive Marisol herself across the bay while every rival crew watches.",
      stages: [
        { text: "Pick up Marisol at Hotel Azure", target: { x: 30, z: 130 }, radius: 9 },
        { text: "Drive Marisol to the pier end", target: { x: 40, z: 380 }, radius: 10 },
        { text: "Lose the heat and return to the Boardwalk", target: { x: 0, z: 235 }, radius: 12 }
      ],
      reward: 1000,
      xp: 220,
      dialogue: [
        "Marisol: Tonight the whole bay learns our names.",
        "Marisol: You were never just a driver, were you?",
        "Marisol: Solstice Bay is ours. Drive safe, partner."
      ]
    }
  ];

  var missions = {
    list: MISSIONS,
    onboarding: ONBOARDING,
    current: null,
    stageIndex: 0,
    obIndex: 0,
    completed: {},
    marker: null,
    timer: 0,
    surviveTimer: 0,
    available: true
  };

  function buildMarker(scene) {
    var geo = new THREE.CylinderGeometry(3.2, 3.2, 26, 18, 1, true);
    var material = new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    var mesh = new THREE.Mesh(geo, material);
    mesh.visible = false;
    scene.add(mesh);
    missions.marker = mesh;
  }

  function currentStage() {
    if (missions.current) {
      return missions.current.stages[missions.stageIndex] || null;
    }
    if (missions.obIndex < ONBOARDING.length) {
      return ONBOARDING[missions.obIndex];
    }
    return null;
  }

  function showStage() {
    var stage = currentStage();
    var hud = window.SH.hud;
    if (!stage || !hud) {
      return;
    }
    if (missions.current) {
      hud.setMission(missions.current.title, stage.text, missions.current.giver);
      var line = missions.current.dialogue[Math.min(missions.stageIndex, missions.current.dialogue.length - 1)];
      if (line) {
        hud.toast(line);
      }
    } else {
      hud.setMission(stage.title, stage.text, stage.hint);
    }
    placeMarker(stage);
  }

  function placeMarker(stage) {
    if (!missions.marker) {
      return;
    }
    if (stage && stage.target) {
      missions.marker.position.set(stage.target.x, 13, stage.target.z);
      missions.marker.visible = true;
    } else {
      missions.marker.visible = false;
    }
  }

  function startNext() {
    var save = window.SH.economy ? window.SH.economy.save : null;
    var done = save ? save.missionsDone : missions.completed;
    var i;
    for (i = 0; i < MISSIONS.length; i++) {
      if (!done[MISSIONS[i].id]) {
        missions.current = MISSIONS[i];
        missions.stageIndex = 0;
        missions.timer = MISSIONS[i].timer || 0;
        missions.surviveTimer = 0;
        showStage();
        return MISSIONS[i];
      }
    }
    missions.current = null;
    if (window.SH.hud) {
      window.SH.hud.setMission("Solstice Heat", "Story complete — free roam the bay", "");
      window.SH.hud.toast("Marisol: The bay is yours now.");
    }
    placeMarker(null);
    return null;
  }

  function completeMission() {
    var m = missions.current;
    if (!m) {
      return;
    }
    missions.completed[m.id] = true;
    if (window.SH.economy) {
      window.SH.economy.completeMission(m);
    }
    if (window.SH.audio) {
      window.SH.audio.sfx.success();
    }
    if (window.SH.hud) {
      window.SH.hud.toast("Mission complete: " + m.title + " · " + cfg.formatMoney(m.reward));
    }
    missions.current = null;
    startNext();
  }

  function failMission(reason) {
    var m = missions.current;
    if (!m) {
      return;
    }
    if (window.SH.hud) {
      window.SH.hud.toast("Mission failed: " + reason + " — try again");
    }
    if (window.SH.audio) {
      window.SH.audio.sfx.fail();
    }
    missions.stageIndex = 0;
    missions.timer = m.timer || 0;
    showStage();
  }

  function advanceStage() {
    if (window.SH.audio) {
      window.SH.audio.sfx.checkpoint();
    }
    if (window.SH.economy && missions.current) {
      window.SH.economy.addXP(6);
    }
    missions.stageIndex += 1;
    if (missions.current && missions.stageIndex >= missions.current.stages.length) {
      completeMission();
    } else {
      showStage();
    }
  }

  function updateOnboarding(dt, player) {
    var stage = ONBOARDING[missions.obIndex];
    if (!stage) {
      return false;
    }
    placeMarker(stage);
    if (stage.type === "enterCar") {
      if (player.state === "car") {
        missions.obIndex += 1;
        showStage();
      }
      return true;
    }
    if (stage.type === "goto") {
      var focus = player.focusPos();
      if (cfg.dist2d(focus.x, focus.z, stage.target.x, stage.target.z) < stage.radius) {
        missions.obIndex += 1;
        if (missions.obIndex >= ONBOARDING.length) {
          if (window.SH.hud) {
            window.SH.hud.toast("Marisol: You drive clean. I have work for you.");
          }
          startNext();
        } else {
          showStage();
        }
      }
      return true;
    }
    if (stage.type === "gotoFoot") {
      if (player.state === "foot" &&
          cfg.dist2d(player.pos.x, player.pos.z, stage.target.x, stage.target.z) < stage.radius) {
        missions.obIndex += 1;
        if (window.SH.hud) {
          window.SH.hud.toast("Marisol Vega: Welcome to my bay, driver.");
        }
        startNext();
      }
      return true;
    }
    return true;
  }

  function update(dt, player) {
    if (missions.marker) {
      missions.marker.rotation.y += dt * 0.8;
    }
    if (missions.obIndex < ONBOARDING.length) {
      updateOnboarding(dt, player);
      return;
    }
    if (!missions.current) {
      return;
    }
    var stage = currentStage();
    if (!stage) {
      return;
    }
    placeMarker(stage);
    if (missions.timer > 0) {
      missions.timer -= dt;
      if (window.SH.hud) {
        window.SH.hud.setSub("Time left: " + Math.ceil(missions.timer) + "s");
      }
      if (missions.timer <= 0) {
        failMission("out of time");
        return;
      }
    }
    var focus = player.focusPos();
    var dist = cfg.dist2d(focus.x, focus.z, stage.target.x, stage.target.z);
    if (stage.survive) {
      if (dist < stage.radius) {
        missions.surviveTimer += dt;
        if (window.SH.hud) {
          window.SH.hud.setSub("Hold the pier: " + Math.ceil(stage.survive - missions.surviveTimer) + "s");
        }
        if (missions.surviveTimer >= stage.survive) {
          missions.surviveTimer = 0;
          advanceStage();
        }
      }
      return;
    }
    if (stage.tail) {
      if (dist < stage.radius) {
        advanceStage();
      } else if (dist < 6) {
        failMission("you were spotted");
      }
      return;
    }
    if (dist < stage.radius) {
      advanceStage();
    }
  }

  function init(scene) {
    buildMarker(scene);
    showStage();
  }

  function resumeFromSave(save) {
    if (save && save.onboardingDone) {
      missions.obIndex = ONBOARDING.length;
      startNext();
    } else {
      missions.obIndex = 0;
      showStage();
    }
  }

  missions.init = init;
  missions.update = update;
  missions.startNext = startNext;
  missions.completeMission = completeMission;
  missions.failMission = failMission;
  missions.currentStage = currentStage;
  missions.resumeFromSave = resumeFromSave;
  window.SH.missions = missions;
})();
