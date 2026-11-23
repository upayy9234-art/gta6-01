// Solstice Heat - dynamic weather and full day/night cycle (new in R12).
// Owns the game clock, sun/moon, sky and fog colours, rain particles,
// lightning, and wet-road sheen. Shots can pin hour + weather.
window.SH = window.SH || {};
(function (SH) {
  'use strict';
  var U = SH.U, C = SH.Config;
  var W = { hour: C.START_HOUR, type: 'clear', target: 'clear', blend: 1, timer: 50, rain: null, flash: 0, wet: 0 };
  SH.Weather = W;
  var SKY = {
    night: new THREE.Color(0x0b1026), dawn: new THREE.Color(0xff9e7a),
    day: new THREE.Color(0x87ceeb), golden: new THREE.Color(0xffb36b), dusk: new THREE.Color(0xff7e5f)
  };
  W.init = function (scene, rng) {
    W.scene = scene; W.rng = rng;
    W.sun = new THREE.DirectionalLight(0xffe0b3, 1.0); scene.add(W.sun);
    W.sun.position.set(120, 180, 60);
    W.amb = new THREE.AmbientLight(0x8899bb, 0.55); scene.add(W.amb);
    W.hemi = new THREE.HemisphereLight(0xbfe3ff, 0xffe0c0, 0.35); scene.add(W.hemi);
    var sunBall = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffdf8a }));
    W.sunBall = sunBall; scene.add(sunBall);
    var moonBall = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 12), new THREE.MeshBasicMaterial({ color: 0xe8ecff }));
    W.moonBall = moonBall; scene.add(moonBall);
    // Rain: a recycled particle box around the camera target.
    var N = 900, pos = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 90; pos[i * 3 + 1] = Math.random() * 45; pos[i * 3 + 2] = (Math.random() - 0.5) * 90; }
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    W.rainMat = new THREE.PointsMaterial({ color: 0xaaccee, size: 0.55, transparent: true, opacity: 0 });
    W.rain = new THREE.Points(geo, W.rainMat); W.rain.visible = false; scene.add(W.rain);
    W.applySky();
  };
  W.setWeather = function (type, hour) { W.type = type; W.target = type; if (hour != null) W.hour = hour; W.applySky(); };
  W.isNight = function () { return W.hour < 5.6 || W.hour > 19.2; };
  W.isGolden = function () { return W.hour > 16.8 && W.hour < 19.2; };
  function skyColor() {
    var h = W.hour, c = new THREE.Color();
    if (h < 5) c.copy(SKY.night);
    else if (h < 7) c.copy(SKY.night).lerp(SKY.dawn, (h - 5) / 2);
    else if (h < 10) c.copy(SKY.dawn).lerp(SKY.day, (h - 7) / 3);
    else if (h < 16.5) c.copy(SKY.day);
    else if (h < 19) c.copy(SKY.day).lerp(SKY.golden, (h - 16.5) / 2.5);
    else if (h < 20.5) c.copy(SKY.golden).lerp(SKY.night, (h - 19) / 1.5);
    else c.copy(SKY.night);
    if (W.type === 'overcast' || W.type === 'rain' || W.type === 'storm') c.lerp(new THREE.Color(0x5a6572), 0.55);
    if (W.type === 'fog') c.lerp(new THREE.Color(0xcfd8dc), 0.6);
    return c;
  }
  W.applySky = function () {
    if (!W.scene) return;
    var c = skyColor();
    W.scene.background = c;
    if (W.scene.fog) { W.scene.fog.color.copy(c); }
  };
  W.update = function (dt, focus) {
    W.hour += dt * (24 / C.DAY_LENGTH_SEC);
    if (W.hour >= 24) W.hour -= 24;
    W.timer -= dt;
    if (W.timer <= 0 && !W.pinned) {
      W.timer = 45 + Math.random() * 60;
      var total = 0, i, r = Math.random();
      for (i = 0; i < C.WEATHER_WEIGHTS.length; i++) total += C.WEATHER_WEIGHTS[i];
      var acc = 0; W.target = 'clear';
      for (i = 0; i < C.WEATHER_TYPES.length; i++) { acc += C.WEATHER_WEIGHTS[i] / total; if (r <= acc) { W.target = C.WEATHER_TYPES[i]; break; } }
      W.type = W.target;
    }
    var ang = ((W.hour - 6) / 12) * Math.PI;
    var sx = Math.cos(ang) * 320, sy = Math.sin(ang) * 300;
    if (W.sun) {
      W.sun.position.set(focus.x + sx, Math.max(18, sy), focus.z + 90);
      var dayAmt = U.clamp(Math.sin(ang), 0, 1);
      W.sun.intensity = 0.25 + dayAmt * 0.95;
      W.sun.color.setHSL(0.09 + dayAmt * 0.04, 0.75, 0.62 + dayAmt * 0.14);
      W.amb.intensity = 0.28 + dayAmt * 0.4;
    }
    if (W.sunBall) { W.sunBall.position.set(focus.x + sx * 1.6, sy * 1.6 + 10, focus.z - 260); W.sunBall.visible = sy > -20; }
    if (W.moonBall) { W.moonBall.position.set(focus.x - sx * 1.4, Math.max(30, -sy * 1.2), focus.z - 240); W.moonBall.visible = sy < 40; }
    var raining = (W.type === 'rain' || W.type === 'storm');
    W.wet = U.damp(W.wet, raining ? 1 : 0, 0.4, dt);
    if (W.rain) {
      W.rain.visible = raining; W.rainMat.opacity = raining ? (W.type === 'storm' ? 0.85 : 0.6) : 0;
      if (raining) {
        W.rain.position.set(focus.x, 0, focus.z);
        var p = W.rain.geometry.attributes.position.array;
        for (var i = 0; i < p.length; i += 3) { p[i + 1] -= dt * 55; if (p[i + 1] < 0) p[i + 1] = 45; }
        W.rain.geometry.attributes.position.needsUpdate = true;
        if (W.type === 'storm' && Math.random() < dt * 0.25) { W.flash = 1; if (SH.Audio) SH.Audio.thunder(); }
      }
    }
    if (W.scene && W.scene.fog) {
      var base = W.type === 'fog' ? 90 : (raining ? 220 : 620);
      W.scene.fog.near = base * 0.35; W.scene.fog.far = base;
    }
    if (W.flash > 0) { W.flash = Math.max(0, W.flash - dt * 3); if (W.amb) W.amb.intensity += W.flash * 1.4; }
    W.applySky();
  };
  W.clockText = function () {
    var h = Math.floor(W.hour), m = Math.floor((W.hour - h) * 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  };
})(window.SH);
