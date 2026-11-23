// Solstice Heat — activities.js
// Collectibles and free-roam activities: thirty seashells scattered
// along the beach and pier, six photo postcards at scenic spots, and
// a beacon time-trial that chains glowing beacons across the city.
// Collection state persists in the economy save.
(function () {
  "use strict";
  window.SH = window.SH || {};

  var cfg = window.SH.config;

  var POSTCARD_SPOTS = [
    { id: "pc-pier", name: "Marina Pier at Dusk", x: 40, z: 372 },
    { id: "pc-neon", name: "Neon Mile Lights", x: 0, z: 150 },
    { id: "pc-azure", name: "Hotel Azure Steps", x: 30, z: 118 },
    { id: "pc-heights", name: "Palm Heights View", x: -10, z: -170 },
    { id: "pc-port", name: "Port Cranes", x: 190, z: -140 },
    { id: "pc-campus", name: "University Lawn", x: -190, z: -140 }
  ];

  var activities = {
    shells: [],
    postcards: [],
    beacon: null,
    beaconIndex: 0,
    beaconTimer: 0,
    beaconActive: false,
    beaconOrder: []
  };

  var BEACON_POINTS = [
    { x: -200, z: 240 }, { x: -80, z: 130 }, { x: 60, z: 240 },
    { x: 180, z: 120 }, { x: 120, z: -60 }, { x: -40, z: -160 },
    { x: -190, z: -40 }, { x: 0, z: 60 }, { x: 190, z: -170 },
    { x: -120, z: 190 }
  ];

  function shellPositions(rng) {
    var out = [];
    var i;
    for (i = 0; i < 30; i++) {
      var t = i / 30;
      var x = -230 + t * 460 + rng.range(-8, 8);
      var z;
      if (i % 5 === 4) {
        // A few shells hide on the pier and in the shallows.
        x = cfg.WORLD.pierX + rng.range(-4, 4);
        z = cfg.WORLD.beachZ + rng.range(10, 80);
      } else if (i % 3 === 2) {
        z = cfg.WORLD.beachZ + rng.range(24, 60);
      } else {
        z = cfg.WORLD.beachZ + rng.range(-6, 22);
      }
      out.push({ id: "shell-" + i, x: x, z: z });
    }
    return out;
  }

  function buildShellMesh() {
    var geo = new THREE.SphereGeometry(0.55, 8, 6);
    var material = new THREE.MeshLambertMaterial({
      color: 0xffe3ee,
      emissive: 0xcc7799,
      emissiveIntensity: 0.35
    });
    var mesh = new THREE.Mesh(geo, material);
    mesh.scale.y = 0.55;
    return mesh;
  }

  function buildPostcardMesh() {
    var geo = new THREE.BoxGeometry(1.5, 2.1, 0.12);
    var material = new THREE.MeshLambertMaterial({
      color: 0xf5f0e6,
      emissive: 0x888866,
      emissiveIntensity: 0.3
    });
    return new THREE.Mesh(geo, material);
  }

  function buildBeaconMesh() {
    var geo = new THREE.CylinderGeometry(2.6, 2.6, 30, 14, 1, true);
    var material = new THREE.MeshBasicMaterial({
      color: 0x5df2ff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    var mesh = new THREE.Mesh(geo, material);
    mesh.visible = false;
    return mesh;
  }

  function init(scene, rng) {
    var save = window.SH.economy ? window.SH.economy.save : { shells: {}, postcards: {} };
    var positions = shellPositions(rng);
    var i;
    for (i = 0; i < positions.length; i++) {
      var mesh = buildShellMesh();
      mesh.position.set(positions[i].x, 0.4, positions[i].z);
      mesh.visible = !save.shells[positions[i].id];
      scene.add(mesh);
      activities.shells.push({ def: positions[i], mesh: mesh });
    }
    for (i = 0; i < POSTCARD_SPOTS.length; i++) {
      var card = buildPostcardMesh();
      card.position.set(POSTCARD_SPOTS[i].x, 1.2, POSTCARD_SPOTS[i].z);
      card.visible = !save.postcards[POSTCARD_SPOTS[i].id];
      scene.add(card);
      activities.postcards.push({ def: POSTCARD_SPOTS[i], mesh: card });
    }
    activities.beacon = buildBeaconMesh();
    scene.add(activities.beacon);
  }

  function collectShell(entry) {
    var eco = window.SH.economy;
    if (!eco || eco.save.shells[entry.def.id]) {
      return;
    }
    eco.save.shells[entry.def.id] = true;
    entry.mesh.visible = false;
    var count = Object.keys(eco.save.shells).length;
    eco.addCash(10);
    eco.addXP(4);
    eco.persist();
    if (window.SH.hud) {
      window.SH.hud.toast("Seashell " + count + " of 30 collected · $10");
    }
    if (window.SH.audio) {
      window.SH.audio.sfx.pickup();
    }
    if (count === 30) {
      eco.addCash(500);
      if (window.SH.hud) {
        window.SH.hud.toast("All 30 seashells! Bonus $500");
      }
    }
  }

  function collectPostcard(entry) {
    var eco = window.SH.economy;
    if (!eco || eco.save.postcards[entry.def.id]) {
      return;
    }
    eco.save.postcards[entry.def.id] = true;
    entry.mesh.visible = false;
    var count = Object.keys(eco.save.postcards).length;
    eco.addCash(60);
    eco.addXP(20);
    eco.persist();
    if (window.SH.hud) {
      window.SH.hud.toast("Postcard found: " + entry.def.name + " (" + count + " of 6) · $60");
    }
    if (window.SH.audio) {
      window.SH.audio.sfx.success();
    }
  }

  function startBeaconTrial(rng) {
    var order = BEACON_POINTS.slice();
    rng.shuffle(order);
    activities.beaconOrder = order.slice(0, 6);
    activities.beaconIndex = 0;
    activities.beaconTimer = 95;
    activities.beaconActive = true;
    placeBeacon();
    if (window.SH.hud) {
      window.SH.hud.toast("Beacon trial started — chase the cyan pillars");
    }
  }

  function placeBeacon() {
    var point = activities.beaconOrder[activities.beaconIndex];
    if (!point) {
      activities.beacon.visible = false;
      return;
    }
    activities.beacon.position.set(point.x, 15, point.z);
    activities.beacon.visible = true;
  }

  function updateBeacon(dt, player) {
    if (!activities.beaconActive) {
      if (player.state === "foot" &&
          cfg.dist2d(player.pos.x, player.pos.z, -196, 236) < 6 &&
          window.SH.hud) {
        window.SH.hud.prompt("Press E to start the beacon time-trial");
      }
      return;
    }
    activities.beaconTimer -= dt;
    activities.beacon.rotation.y += dt;
    if (activities.beaconTimer <= 0) {
      activities.beaconActive = false;
      activities.beacon.visible = false;
      if (window.SH.hud) {
        window.SH.hud.toast("Beacon trial failed — out of time");
      }
      if (window.SH.audio) {
        window.SH.audio.sfx.fail();
      }
      return;
    }
    var point = activities.beaconOrder[activities.beaconIndex];
    var focus = player.focusPos();
    if (window.SH.hud) {
      window.SH.hud.setSub("Beacon " + (activities.beaconIndex + 1) + " of " +
        activities.beaconOrder.length + " · " + Math.ceil(activities.beaconTimer) + "s");
    }
    if (cfg.dist2d(focus.x, focus.z, point.x, point.z) < 9) {
      activities.beaconIndex += 1;
      activities.beaconTimer += 14;
      if (window.SH.audio) {
        window.SH.audio.sfx.checkpoint();
      }
      if (activities.beaconIndex >= activities.beaconOrder.length) {
        activities.beaconActive = false;
        activities.beacon.visible = false;
        if (window.SH.economy) {
          window.SH.economy.addCash(300);
          window.SH.economy.addXP(45);
        }
        if (window.SH.hud) {
          window.SH.hud.toast("Beacon trial complete · $300");
        }
        if (window.SH.audio) {
          window.SH.audio.sfx.success();
        }
      } else {
        placeBeacon();
      }
    }
  }

  function update(dt, player, rng) {
    var focus = player.focusPos();
    var i;
    for (i = 0; i < activities.shells.length; i++) {
      var shell = activities.shells[i];
      if (!shell.mesh.visible) {
        continue;
      }
      shell.mesh.rotation.y += dt * 1.5;
      if (cfg.dist2d(focus.x, focus.z, shell.def.x, shell.def.z) < 2.4) {
        collectShell(shell);
      }
    }
    for (i = 0; i < activities.postcards.length; i++) {
      var card = activities.postcards[i];
      if (!card.mesh.visible) {
        continue;
      }
      card.mesh.rotation.y += dt * 0.9;
      if (player.state === "foot" &&
          cfg.dist2d(player.pos.x, player.pos.z, card.def.x, card.def.z) < 3) {
        collectPostcard(card);
      }
    }
    updateBeacon(dt, player);
  }

  function tryInteract(rng, player) {
    if (!activities.beaconActive &&
        cfg.dist2d(player.pos.x, player.pos.z, -196, 236) < 6) {
      startBeaconTrial(rng);
      return true;
    }
    return false;
  }

  function counts() {
    var eco = window.SH.economy;
    if (!eco) {
      return { shells: 0, postcards: 0, stunts: 0 };
    }
    return {
      shells: Object.keys(eco.save.shells).length,
      postcards: Object.keys(eco.save.postcards).length,
      stunts: Object.keys(eco.save.stunts).length
    };
  }

  activities.init = init;
  activities.update = update;
  activities.tryInteract = tryInteract;
  activities.startBeaconTrial = startBeaconTrial;
  activities.counts = counts;
  activities.postcardSpots = POSTCARD_SPOTS;
  activities.beaconPoints = BEACON_POINTS;
  window.SH.activities = activities;
})();
