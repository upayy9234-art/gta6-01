// Solstice Heat: Neon Tide — weather.js
// Day/night cycle, sun/moon, sky grading, weather states, rain, night windows.
window.SH = window.SH || {};
SH.weather = (function () {
  'use strict';
  var R = SH.random;
  var timeOfDay = 0.42; // 0..1, 0.25=sunrise, 0.5=noon, 0.75=sunset
  var state = 'clear', stateT = 60, blend = { rain: 0, fog: 0, cloud: 0 };
  var sun = null, moon = null, hemi = null, sceneRef = null, rainPts = null, rainPos = null;
  var skyTop = new THREE.Color(), skyBot = new THREE.Color();
  var PHASES = [
    { t: 0.00, top: 0x060a1c, bot: 0x1b2a4a, sun: 0x223355, amb: 0.22 },
    { t: 0.22, top: 0x2a3f66, bot: 0xd98a5e, sun: 0xffb36b, amb: 0.4 },
    { t: 0.32, top: 0x3f8fd2, bot: 0xbfe3ff, sun: 0xfff2cc, amb: 0.75 },
    { t: 0.55, top: 0x2f7fd0, bot: 0xa8dcff, sun: 0xffffff, amb: 0.85 },
    { t: 0.72, top: 0x3a4a8a, bot: 0xff9a5c, sun: 0xff9a5c, amb: 0.55 },
    { t: 0.80, top: 0x1a1440, bot: 0x7a2a6e, sun: 0xcc6688, amb: 0.3 },
    { t: 0.88, top: 0x060a1c, bot: 0x14203c, sun: 0x223355, amb: 0.22 },
    { t: 1.00, top: 0x060a1c, bot: 0x1b2a4a, sun: 0x223355, amb: 0.22 }
  ];
  function init(scene) {
    sceneRef = scene;
    sun = new THREE.DirectionalLight(0xffffff, 0.9); scene.add(sun); scene.add(sun.target);
    moon = new THREE.DirectionalLight(0x8fb4ff, 0.0); scene.add(moon); scene.add(moon.target);
    hemi = new THREE.HemisphereLight(0xbfe3ff, 0x3f7d4e, 0.55); scene.add(hemi);
    scene.fog = new THREE.Fog(0xa8dcff, 120, 700);
    // rain particle field around camera
    var N = 900;
    rainPos = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) { rainPos[i * 3] = R.range(-60, 60); rainPos[i * 3 + 1] = R.range(0, 45); rainPos[i * 3 + 2] = R.range(-60, 60); }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    rainPts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xaad4ff, size: 0.35, transparent: true, opacity: 0.7 }));
    rainPts.visible = false; scene.add(rainPts);
  }
  function phaseAt(t) {
    for (var i = 0; i < PHASES.length - 1; i++) {
      var a = PHASES[i], b = PHASES[i + 1];
      if (t >= a.t && t <= b.t) {
        var k = (t - a.t) / Math.max(0.0001, b.t - a.t);
        return {
          top: new THREE.Color(a.top).lerp(new THREE.Color(b.top), k),
          bot: new THREE.Color(a.bot).lerp(new THREE.Color(b.bot), k),
          sun: new THREE.Color(a.sun).lerp(new THREE.Color(b.sun), k),
          amb: R.lerp(a.amb, b.amb, k)
        };
      }
    }
    var last = PHASES[PHASES.length - 1];
    return { top: new THREE.Color(last.top), bot: new THREE.Color(last.bot), sun: new THREE.Color(last.sun), amb: last.amb };
  }
  function setState(s) { state = s; stateT = R.range(50, 110); }
  function cycleState() {
    var order = ['clear', 'haze', 'clear', 'rain', 'fog', 'clear', 'storm'];
    setState(order[R.int(0, order.length - 1)]);
  }
  function isNight() { return timeOfDay < 0.24 || timeOfDay > 0.79; }
  function update(dt, camPos) {
    timeOfDay = (timeOfDay + dt / SH.config.DAY_LENGTH) % 1;
    stateT -= dt; if (stateT <= 0) cycleState();
    var targets = { rain: 0, fog: 0, cloud: 0.15 };
    if (state === 'haze') { targets.fog = 0.35; targets.cloud = 0.4; }
    if (state === 'rain') { targets.rain = 0.7; targets.cloud = 0.8; targets.fog = 0.25; }
    if (state === 'storm') { targets.rain = 1; targets.cloud = 1; targets.fog = 0.45; }
    if (state === 'fog') { targets.fog = 1; targets.cloud = 0.5; }
    blend.rain = R.lerp(blend.rain, targets.rain, dt * 0.4);
    blend.fog = R.lerp(blend.fog, targets.fog, dt * 0.4);
    blend.cloud = R.lerp(blend.cloud, targets.cloud, dt * 0.4);
    var ph = phaseAt(timeOfDay);
    skyTop.copy(ph.top); skyBot.copy(ph.bot);
    if (sceneRef) {
      var fogColor = skyBot.clone().lerp(new THREE.Color(0x8a97a5), blend.cloud * 0.45);
      sceneRef.fog.color.copy(fogColor);
      sceneRef.fog.near = R.lerp(140, 26, blend.fog);
      sceneRef.fog.far = R.lerp(760, 120, blend.fog);
      if (sceneRef.background) sceneRef.background.copy(skyBot.clone().lerp(skyTop, 0.45));
    }
    var sunAng = (timeOfDay - 0.25) * Math.PI * 2;
    var elev = Math.sin(sunAng);
    if (sun) {
      sun.position.set(Math.cos(sunAng) * 300, Math.max(8, elev * 260), 120);
      sun.intensity = Math.max(0, elev) * 0.95 * (1 - blend.cloud * 0.6);
      sun.color.copy(ph.sun);
    }
    if (moon) { moon.position.set(-Math.cos(sunAng) * 200, Math.max(10, -elev * 200), -80); moon.intensity = Math.max(0, -elev) * 0.35; }
    if (hemi) { hemi.intensity = ph.amb * (1 - blend.cloud * 0.35); hemi.color.copy(skyBot); }
    SH.buildings.setNightLit(isNight() ? 0.65 : 0.15);
    SH.city.setRoadWet(blend.rain);
    SH.audio.setRain(blend.rain * (state === 'storm' ? 1 : 0.7));
    // rain fall around camera
    if (rainPts) {
      rainPts.visible = blend.rain > 0.06;
      if (rainPts.visible && camPos) {
        rainPts.position.set(camPos.x, 0, camPos.z);
        var fall = (state === 'storm' ? 55 : 38) * dt;
        for (var i = 0; i < rainPos.length; i += 3) {
          rainPos[i + 1] -= fall * (0.7 + ((i * 7) % 10) / 16);
          rainPos[i] += dt * (state === 'storm' ? 7 : 2);
          if (rainPos[i + 1] < 0) { rainPos[i + 1] = 42; rainPos[i] = R.range(-60, 60); rainPos[i + 2] = R.range(-60, 60); }
        }
        rainPts.geometry.attributes.position.needsUpdate = true;
        rainPts.material.opacity = 0.25 + blend.rain * 0.5;
      }
    }
    // animate water + lighthouse beam + casino signs via city.animated hooks
    var t = performance.now() * 0.001;
    SH.city.animated.forEach(function (grp) {
      grp.traverse(function (ch) {
        if (ch.name === 'lighthouseBeam') ch.parent.rotation.y = t * 0.6;
        if (ch.name === 'casinoSign') ch.material.color.setHSL((t * 0.25) % 1, 0.85, 0.6);
        if (ch.name === 'neonsign') ch.material.color.setHSL(0.52 + Math.sin(t * 2 + ch.position.x) * 0.08, 0.9, 0.55 + Math.sin(t * 3) * 0.12);
        if (ch.name === 'beacon') ch.visible = Math.sin(t * 2.4) > 0 || !isNight();
      });
    });
    var water = SH.city.getWater();
    if (water) { water.position.y = -0.55 + Math.sin(t * 0.7) * 0.08; water.material.opacity = 0.82 + Math.sin(t * 0.5) * 0.05; }
  }
  function clockString() {
    var mins = Math.floor(timeOfDay * 24 * 60);
    var hh = Math.floor(mins / 60), mm = mins % 60;
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }
  function setTime(t) { timeOfDay = ((t % 1) + 1) % 1; }
  return {
    init: init, update: update, isNight: isNight, clockString: clockString,
    setTime: setTime, setState: setState,
    get time() { return timeOfDay; }, get state() { return state; }, get rain() { return blend.rain; }
  };
})();
