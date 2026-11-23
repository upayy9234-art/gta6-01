// Solstice Heat — shots.js
// Deterministic screenshot compositions. When the page is opened
// with ?shot=<name>&seed=7 the game freezes live play and arranges
// the player, cars, pedestrians, police, weather and camera into a
// fixed scene so dossier screenshots are reproducible.
(function () {
  "use strict";
  window.SH = window.SH || {};

  var SHOTS = {
    cover: {
      name: "cover",
      hour: 18.6,
      weather: "clear",
      player: { x: 2, z: 238, heading: Math.PI * 0.9, state: "foot" },
      car: { x: 7, z: 233, heading: Math.PI * 0.55 },
      camera: { dist: 11, height: 3.2, yawOffset: -2.4 },
      peds: 6,
      traffic: true,
      stars: 0
    },
    drive: {
      name: "drive",
      hour: 20.4,
      weather: "clear",
      player: { x: 0, z: 128, heading: 0, state: "car" },
      car: { x: 0, z: 128, heading: 0 },
      camera: { dist: 10, height: 3.4, yawOffset: -0.4 },
      peds: 3,
      traffic: true,
      stars: 0
    },
    chase: {
      name: "chase",
      hour: 16.2,
      weather: "haze",
      player: { x: -20, z: 60, heading: Math.PI / 2, state: "car" },
      car: { x: -20, z: 60, heading: Math.PI / 2 },
      camera: { dist: 13, height: 4.2, yawOffset: 0.7 },
      peds: 2,
      traffic: true,
      stars: 3
    },
    foot: {
      name: "foot",
      hour: 19.2,
      weather: "clear",
      player: { x: 38, z: 330, heading: Math.PI, state: "foot" },
      car: { x: 8, z: 250, heading: Math.PI * 0.4 },
      camera: { dist: 8, height: 2.6, yawOffset: -0.6 },
      peds: 8,
      traffic: false,
      stars: 0
    },
    marina: {
      name: "marina",
      hour: 7.4,
      weather: "haze",
      player: { x: 150, z: 150, heading: Math.PI * 1.2, state: "foot" },
      car: { x: 146, z: 140, heading: Math.PI * 0.2 },
      camera: { dist: 12, height: 3.6, yawOffset: 0.9 },
      peds: 5,
      traffic: true,
      stars: 0
    },
    sunset: {
      name: "sunset",
      hour: 19.6,
      weather: "clear",
      player: { x: -60, z: 246, heading: Math.PI * 0.75, state: "foot" },
      car: { x: -52, z: 242, heading: Math.PI * 0.3 },
      camera: { dist: 14, height: 4.5, yawOffset: -0.9 },
      peds: 4,
      traffic: true,
      stars: 0
    }
  };

  function requestedShot() {
    var name = window.SH.queryParam("shot");
    if (name && SHOTS[name]) {
      return SHOTS[name];
    }
    return null;
  }

  function apply(shot, world) {
    var player = world.player;
    var vehicles = window.SH.vehicles;
    var weather = window.SH.weather;

    weather.setHour(shot.hour);
    weather.setKind(shot.weather);

    var car = vehicles.playerCar;
    if (car && shot.car) {
      car.pos.set(shot.car.x, 0, shot.car.z);
      car.heading = shot.car.heading;
      car.speed = shot.name === "drive" || shot.name === "chase" ? 18 : 0;
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading;
    }

    player.pos.set(shot.player.x, 0, shot.player.z);
    player.heading = shot.player.heading;
    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y = player.heading;
    if (shot.player.state === "car" && car) {
      player.state = "car";
      player.car = car;
      car.driver = "player";
      player.mesh.visible = false;
      player.pos.copy(car.pos);
    } else {
      player.state = "foot";
      player.mesh.visible = true;
    }

    // Cluster a few pedestrians near the player for life.
    var people = window.SH.people.all;
    var i;
    for (i = 0; i < people.length && i < shot.peds; i++) {
      var p = people[i];
      var angle = (i / Math.max(1, shot.peds)) * Math.PI * 2;
      p.pos.set(
        shot.player.x + Math.sin(angle) * (5 + i),
        0,
        shot.player.z + Math.cos(angle) * (5 + i)
      );
      p.mesh.position.copy(p.pos);
      p.state = "wait";
      p.waitTimer = 999;
    }

    // Police pressure for the chase composition.
    if (shot.stars > 0) {
      var police = window.SH.police;
      police.heat = 70;
      police.stars = shot.stars;
      var rng = new window.SH.RNG(99);
      var scene = world.scene;
      var made = 0;
      while (made < 2) {
        var cop = vehicles.createCar(scene, {
          x: shot.player.x + (made === 0 ? -9 : 6),
          z: shot.player.z + (made === 0 ? 10 : 14),
          heading: shot.player.heading,
          color: 0xf5f0e6,
          isCop: true
        });
        cop.ai = { pursuit: true };
        police.cars.push(cop);
        made += 1;
      }
      if (shot.stars >= 3) {
        var ahead = {
          x: shot.player.x - Math.sin(shot.player.heading) * 34,
          z: shot.player.z - Math.cos(shot.player.heading) * 34
        };
        // Roadblock barriers are visualised through police update in
        // live play; for the still, place a barrier row via a cop car
        // parked sideways instead.
        var blocker = vehicles.createCar(scene, {
          x: ahead.x,
          z: ahead.z,
          heading: shot.player.heading + Math.PI / 2,
          color: 0xf5f0e6,
          isCop: true
        });
        blocker.ai = { pursuit: false };
        police.cars.push(blocker);
      }
    }

    return {
      camera: shot.camera,
      focus: player.focusPos(),
      heading: shot.player.heading
    };
  }

  function cameraFor(shot, baseHeading) {
    var c = shot.camera;
    return {
      dist: c.dist,
      height: c.height,
      yaw: baseHeading + c.yawOffset
    };
  }

  window.SH.shots = {
    list: SHOTS,
    requested: requestedShot,
    apply: apply,
    cameraFor: cameraFor
  };
})();
