// Solstice Heat — weather.js
// Dynamic weather plus a full day/night cycle. The module owns the
// sun and moon lights, sky and fog colours, rain particles and the
// game clock. Weather kinds drift over time: clear, haze, rain,
// storm and fog, each with its own fog density, light dimming and
// ambient sound level.
(function () {
  "use strict";
  window.SH = window.SH || {};

  var cfg = window.SH.config;

  var weather = {
    hour: cfg.TIME.startHour,
    kind: "clear",
    kindTimer: 90,
    intensity: 0,
    nightFactor: 0,
    sun: null,
    moon: null,
    hemi: null,
    rain: null,
    rainVel: [],
    scene: null,
    camera: null,
    lightning: 0,
    lightningTimer: 7
  };

  var SKY_KEYS = [
    { hour: 0, sky: 0x0a1026, fog: 0x0a1026, sun: 0.05, amb: 0.22 },
    { hour: 5, sky: 0x141c3a, fog: 0x141c3a, sun: 0.08, amb: 0.26 },
    { hour: 6.5, sky: 0xe88a5a, fog: 0xe8a06a, sun: 0.55, amb: 0.5 },
    { hour: 9, sky: 0x7ec8e8, fog: 0xaedcf0, sun: 1.0, amb: 0.75 },
    { hour: 13, sky: 0x5db4e8, fog: 0xbfe6f5, sun: 1.15, amb: 0.85 },
    { hour: 17.5, sky: 0x6fb0dd, fog: 0xc4dde8, sun: 0.9, amb: 0.7 },
    { hour: 19, sky: 0xf0703c, fog: 0xe88a5a, sun: 0.5, amb: 0.48 },
    { hour: 20.5, sky: 0x2a2450, fog: 0x2a2450, sun: 0.12, amb: 0.3 },
    { hour: 24, sky: 0x0a1026, fog: 0x0a1026, sun: 0.05, amb: 0.22 }
  ];

  var KIND_DATA = {
    clear: { fog: 0.0016, dim: 1.0, rain: 0, wind: 0.2, label: "Clear" },
    haze: { fog: 0.0035, dim: 0.9, rain: 0, wind: 0.35, label: "Haze" },
    rain: { fog: 0.0045, dim: 0.72, rain: 0.6, wind: 0.55, label: "Rain" },
    storm: { fog: 0.006, dim: 0.55, rain: 1.0, wind: 1.0, label: "Storm" },
    fog: { fog: 0.011, dim: 0.8, rain: 0, wind: 0.25, label: "Fog" }
  };

  function lerpColor(a, b, t) {
    var ca = new THREE.Color(a);
    var cb = new THREE.Color(b);
    ca.lerp(cb, t);
    return ca;
  }

  function skyAt(hour) {
    var i;
    for (i = 0; i < SKY_KEYS.length - 1; i++) {
      var a = SKY_KEYS[i];
      var b = SKY_KEYS[i + 1];
      if (hour >= a.hour && hour <= b.hour) {
        var t = (hour - a.hour) / Math.max(0.0001, b.hour - a.hour);
        return {
          sky: lerpColor(a.sky, b.sky, t),
          fog: lerpColor(a.fog, b.fog, t),
          sun: cfg.lerp(a.sun, b.sun, t),
          amb: cfg.lerp(a.amb, b.amb, t)
        };
      }
    }
    var last = SKY_KEYS[SKY_KEYS.length - 1];
    return {
      sky: new THREE.Color(last.sky),
      fog: new THREE.Color(last.fog),
      sun: last.sun,
      amb: last.amb
    };
  }

  function buildRain(scene) {
    var count = 900;
    var geo = new THREE.BufferGeometry();
    var positions = new Float32Array(count * 3);
    var i;
    for (i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = Math.random() * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
      weather.rainVel.push(28 + Math.random() * 14);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    var material = new THREE.PointsMaterial({
      color: 0xaed6f5,
      size: 0.55,
      transparent: true,
      opacity: 0.7
    });
    var points = new THREE.Points(geo, material);
    points.visible = false;
    points.frustumCulled = false;
    scene.add(points);
    return points;
  }

  function init(scene, camera) {
    weather.scene = scene;
    weather.camera = camera;
    weather.sun = new THREE.DirectionalLight(0xffe8b0, 1.0);
    scene.add(weather.sun);
    weather.sun.target.position.set(0, 0, 0);
    scene.add(weather.sun.target);
    weather.moon = new THREE.DirectionalLight(0x8ab4ff, 0.0);
    scene.add(weather.moon);
    scene.add(weather.moon.target);
    weather.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x3a5f3a, 0.7);
    scene.add(weather.hemi);
    scene.fog = new THREE.FogExp2(0xaedcf0, 0.0016);
    weather.rain = buildRain(scene);
    applySky(0);
  }

  function pickNextKind(rng) {
    var roll = rng.next();
    if (roll < 0.42) { return "clear"; }
    if (roll < 0.58) { return "haze"; }
    if (roll < 0.74) { return "rain"; }
    if (roll < 0.86) { return "fog"; }
    return "storm";
  }

  function applySky(dt) {
    var sky = skyAt(weather.hour);
    var kind = KIND_DATA[weather.kind];
    var scene = weather.scene;
    if (!scene) {
      return;
    }
    scene.background = sky.sky;
    scene.fog.color.copy(sky.fog);
    scene.fog.density = kind.fog;

    var sunAngle = ((weather.hour - 6) / 12) * Math.PI;
    var sunHeight = Math.sin(sunAngle);
    var sx = Math.cos(sunAngle) * 300;
    var sy = Math.max(-60, sunHeight * 260);
    weather.sun.position.set(sx, sy, 120);
    weather.sun.intensity = Math.max(0, sky.sun) * kind.dim;
    if (weather.lightning > 0) {
      weather.sun.intensity += weather.lightning * 2.2;
    }
    weather.moon.position.set(-sx, Math.max(30, -sy), -80);
    weather.moon.intensity = weather.nightFactor * 0.35;
    weather.hemi.intensity = sky.amb * kind.dim;
    weather.nightFactor = cfg.clamp(1 - Math.max(0, sunHeight) * 1.6, 0, 1);
  }

  function update(dt, focusPos, rng) {
    // Advance the clock: one full day per dayLengthSeconds.
    weather.hour += (dt / cfg.TIME.dayLengthSeconds) * 24;
    if (weather.hour >= 24) {
      weather.hour -= 24;
    }

    // Weather drift.
    weather.kindTimer -= dt;
    if (weather.kindTimer <= 0) {
      weather.kind = pickNextKind(rng);
      weather.kindTimer = 70 + rng.next() * 110;
    }
    var kind = KIND_DATA[weather.kind];
    var targetIntensity = kind.rain;
    weather.intensity = cfg.lerp(weather.intensity, targetIntensity, dt * 0.5);

    // Lightning during storms.
    if (weather.kind === "storm") {
      weather.lightningTimer -= dt;
      if (weather.lightningTimer <= 0) {
        weather.lightning = 1;
        weather.lightningTimer = 3 + rng.next() * 8;
      }
    }
    if (weather.lightning > 0) {
      weather.lightning = Math.max(0, weather.lightning - dt * 5);
    }

    applySky(dt);

    // Rain particles follow the focus position.
    if (weather.rain) {
      var visible = weather.intensity > 0.05;
      weather.rain.visible = visible;
      if (visible && focusPos) {
        weather.rain.position.set(focusPos.x, 0, focusPos.z);
        var pos = weather.rain.geometry.attributes.position;
        var i;
        for (i = 0; i < pos.count; i++) {
          var y = pos.getY(i) - weather.rainVel[i] * dt * weather.intensity;
          if (y < 0) {
            y = 55 + Math.random() * 8;
          }
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
      }
    }

    if (window.SH.audio) {
      window.SH.audio.setWeatherNoise(weather.kind);
    }
  }

  function label() {
    return KIND_DATA[weather.kind].label;
  }

  function setHour(h) {
    weather.hour = h % 24;
    applySky(0);
  }

  function setKind(kind) {
    if (KIND_DATA[kind]) {
      weather.kind = kind;
      weather.kindTimer = 120;
    }
  }

  weather.init = init;
  weather.update = update;
  weather.label = label;
  weather.setHour = setHour;
  weather.setKind = setKind;
  weather.kindData = KIND_DATA;
  window.SH.weather = weather;
})();
