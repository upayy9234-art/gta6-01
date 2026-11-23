// Solstice Heat: Neon Tide — effects.js
// Particles (smoke/fire/sparks/splash/confetti), skid marks, camera shake, slow-mo.
window.SH = window.SH || {};
SH.effects = (function () {
  'use strict';
  var R = SH.random;
  var pool = [], sceneRef = null, shakeAmt = 0, slowmo = 1, slowT = 0;
  var skidMeshes = [], skidIdx = 0;
  var COLORS = { smoke: 0x555c66, fire: 0xff7722, spark: 0xffcc44, splash: 0x9fd8ff, confetti: 0xff4fd8, rain: 0xaad4ff };
  function init(scene) {
    sceneRef = scene;
    var geo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
    for (var i = 0; i < 260; i++) {
      var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
      m.visible = false; scene.add(m);
      pool.push({ mesh: m, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, grow: 0, grav: 0, kind: '' });
    }
    var skidGeo = new THREE.PlaneGeometry(0.34, 1.6);
    var skidMat = new THREE.MeshBasicMaterial({ color: 0x101114, transparent: true, opacity: 0.55 });
    for (var s = 0; s < 130; s++) {
      var sm = new THREE.Mesh(skidGeo, skidMat);
      sm.rotation.x = -Math.PI / 2; sm.visible = false; sm.position.y = 0.055;
      scene.add(sm); skidMeshes.push(sm);
    }
  }
  function burst(x, y, z, kind, count) {
    if (!sceneRef) return;
    var n = count || 6;
    for (var i = 0; i < pool.length && n > 0; i++) {
      var p = pool[i];
      if (p.life > 0) continue;
      n--;
      p.kind = kind; p.life = p.maxLife = kind === 'smoke' ? R.range(0.9, 1.8) : kind === 'confetti' ? R.range(1.2, 2.2) : R.range(0.35, 0.8);
      p.mesh.visible = true;
      p.mesh.position.set(x + R.range(-0.4, 0.4), y + R.range(-0.2, 0.3), z + R.range(-0.4, 0.4));
      var col = COLORS[kind] || 0xffffff;
      if (kind === 'confetti') col = [0xff4fd8, 0x00e5ff, 0xffe14d, 0x59cd90][R.int(0, 3)];
      if (kind === 'fire') col = [0xff7722, 0xffaa33, 0xff4422][R.int(0, 2)];
      p.mesh.material.color.setHex(col);
      p.mesh.material.opacity = 0.95;
      p.mesh.scale.setScalar(kind === 'smoke' ? R.range(0.8, 1.6) : R.range(0.5, 1));
      p.grow = kind === 'smoke' ? 1.6 : kind === 'fire' ? -0.6 : 0.2;
      p.grav = kind === 'splash' || kind === 'confetti' ? -5.5 : kind === 'smoke' || kind === 'fire' ? 1.6 : -3;
      var sp = kind === 'spark' ? 6 : kind === 'splash' ? 4 : 2.2;
      p.vx = R.range(-sp, sp); p.vz = R.range(-sp, sp);
      p.vy = kind === 'smoke' || kind === 'fire' ? R.range(1.4, 3) : R.range(1, sp);
      p.mesh.rotation.set(R.range(0, 3), R.range(0, 3), R.range(0, 3));
    }
  }
  function skidMark(x, z, heading) {
    var sm = skidMeshes[skidIdx]; skidIdx = (skidIdx + 1) % skidMeshes.length;
    sm.visible = true;
    sm.position.x = x + Math.cos(heading) * 0.85; sm.position.z = z - Math.sin(heading) * 0.85;
    sm.rotation.z = -heading;
    var sm2 = skidMeshes[skidIdx]; skidIdx = (skidIdx + 1) % skidMeshes.length;
    sm2.visible = true;
    sm2.position.x = x - Math.cos(heading) * 0.85; sm2.position.z = z + Math.sin(heading) * 0.85;
    sm2.rotation.z = -heading;
  }
  function shake(v) { shakeAmt = Math.min(1, Math.max(shakeAmt, v)); }
  function getShake() { return shakeAmt; }
  function triggerSlowmo(scale, dur) { slowmo = scale || 0.3; slowT = dur || 1.4; }
  function timeScale(dt) {
    if (slowT > 0) { slowT -= dt; if (slowT <= 0) slowmo = 1; }
    return slowmo;
  }
  function update(dt) {
    shakeAmt = Math.max(0, shakeAmt - dt * 1.8);
    for (var i = 0; i < pool.length; i++) {
      var p = pool[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      p.vy += p.grav * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.05) { p.mesh.position.y = 0.05; p.vy = 0; }
      var s = p.mesh.scale.x + p.grow * dt;
      p.mesh.scale.setScalar(Math.max(0.05, s));
      p.mesh.material.opacity = Math.min(0.95, p.life / p.maxLife * 1.4);
      p.mesh.rotation.x += dt * 2; p.mesh.rotation.y += dt * 3;
    }
  }
  function confettiAt(x, y, z) { burst(x, y, z, 'confetti', 42); }
  return { init: init, burst: burst, skidMark: skidMark, shake: shake, getShake: getShake, triggerSlowmo: triggerSlowmo, timeScale: timeScale, update: update, confettiAt: confettiAt };
})();
