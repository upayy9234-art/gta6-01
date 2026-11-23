// Solstice Heat: Neon Tide — hud.js
// DOM HUD: bars, cash, stars, clock, speedo, canvas minimap + GPS, banners,
// subtitles, toasts, menus (start/pause/end), photo mode letterbox.
window.SH = window.SH || {};
SH.hud = (function () {
  'use strict';
  var R = SH.random;
  var el = {};
  var toastQ = [], subtitleT = 0, bannerT = 0, bustVal = 0;
  var mapCtx = null;
  function grab(id) { return document.getElementById(id); }
  function init() {
    ['hud', 'healthFill', 'armourFill', 'cashEl', 'bankEl', 'starsEl', 'clockEl', 'speedo', 'speedVal', 'vehName',
     'minimap', 'objectiveEl', 'bannerEl', 'bannerTitle', 'bannerSub', 'subtitleEl', 'subName', 'subText',
     'toastEl', 'promptEl', 'bustWrap', 'bustFill', 'startScreen', 'pauseScreen', 'endScreen', 'endTitle', 'endText',
     'letterboxT', 'letterboxB', 'photoHint', 'damageFlash', 'rankEl', 'ammoEl', 'radioEl', 'districtEl',
     'btnPlay', 'btnContinue', 'btnHow', 'howPanel', 'btnResume', 'btnRestart', 'btnQuit', 'btnRespawn', 'startStats'
    ].forEach(function (id) { el[id] = grab(id); });
    if (el.minimap) mapCtx = el.minimap.getContext('2d');
    if (el.btnPlay) el.btnPlay.addEventListener('click', function () { SH.audio.init(); SH.audio.resume(); SH.state.startGame(false); });
    if (el.btnContinue) el.btnContinue.addEventListener('click', function () { SH.audio.init(); SH.audio.resume(); SH.state.startGame(true); });
    if (el.btnHow) el.btnHow.addEventListener('click', function () { el.howPanel.style.display = el.howPanel.style.display === 'block' ? 'none' : 'block'; SH.audio.click(); });
    if (el.btnResume) el.btnResume.addEventListener('click', function () { SH.state.resumeGame(); });
    if (el.btnRestart) el.btnRestart.addEventListener('click', function () { SH.economy.respawn(); SH.state.resumeGame(); hideEnd(); });
    if (el.btnQuit) el.btnQuit.addEventListener('click', function () { SH.state.quitToMenu(); });
    if (el.btnRespawn) el.btnRespawn.addEventListener('click', function () { SH.economy.respawn(); hideEnd(); SH.state.resumeGame(); });
    refreshStartStats();
  }
  function refreshStartStats() {
    if (!el.startStats) return;
    var has = SH.economy.hasSave();
    if (el.btnContinue) el.btnContinue.style.display = has ? 'block' : 'none';
    if (has) {
      SH.economy.load();
      var E = SH.economy.data;
      el.startStats.textContent = 'Saved game: $' + E.cash + ' · ' + SH.economy.rank().name + ' · Missions ' + E.stats.missionsDone + '/12 · Shells ' + E.shells.length + '/40';
    } else el.startStats.textContent = 'New game — no save found yet.';
  }
  function toast(msg) {
    toastQ.push(msg);
    if (el.toastEl) { el.toastEl.textContent = msg; el.toastEl.style.opacity = '1'; }
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { if (el.toastEl) el.toastEl.style.opacity = '0'; toastQ.shift(); if (toastQ.length) toast(toastQ[0]); }, 2600);
  }
  function showBanner(title, sub) {
    if (!el.bannerEl) return;
    el.bannerTitle.textContent = title; el.bannerSub.textContent = sub || '';
    el.bannerEl.style.opacity = '1'; el.bannerEl.style.transform = 'translate(-50%,0)';
    bannerT = 4.2;
  }
  function subtitle(name, text) {
    if (!el.subtitleEl) return;
    el.subName.textContent = name; el.subText.textContent = text;
    el.subtitleEl.style.opacity = '1'; subtitleT = 5;
  }
  function setObjective(t) { if (el.objectiveEl) el.objectiveEl.textContent = t || ''; }
  function setPrompt(t) { if (el.promptEl) { el.promptEl.textContent = t || ''; el.promptEl.style.opacity = t ? '1' : '0'; } }
  function setBust(v) { bustVal = v; if (el.bustWrap) el.bustWrap.style.opacity = v > 0.02 ? '1' : '0'; if (el.bustFill) el.bustFill.style.width = Math.round(v * 100) + '%'; }
  function flashDamage() { if (el.damageFlash) { el.damageFlash.style.opacity = '0.45'; setTimeout(function () { el.damageFlash.style.opacity = '0'; }, 130); } }
  function showEnd(title, text) {
    if (!el.endScreen) return;
    el.endTitle.textContent = title; el.endText.textContent = text;
    el.endScreen.style.display = 'flex';
    el.endTitle.style.color = title === 'BUSTED' ? '#6db3ff' : '#ff5964';
  }
  function hideEnd() { if (el.endScreen) el.endScreen.style.display = 'none'; }
  function showStart() { if (el.startScreen) el.startScreen.style.display = 'flex'; refreshStartStats(); }
  function hideStart() { if (el.startScreen) el.startScreen.style.display = 'none'; }
  function showPause() { if (el.pauseScreen) el.pauseScreen.style.display = 'flex'; }
  function hidePause() { if (el.pauseScreen) el.pauseScreen.style.display = 'none'; }
  function setPhoto(on) {
    if (el.letterboxT) el.letterboxT.style.height = on ? '7vh' : '0';
    if (el.letterboxB) el.letterboxB.style.height = on ? '7vh' : '0';
    if (el.hud) el.hud.style.opacity = on ? '0' : '1';
    if (el.photoHint) el.photoHint.style.opacity = on ? '1' : '0';
  }
  function starsString(n) { var s = ''; for (var i = 0; i < 5; i++) s += i < n ? '★' : '☆'; return s; }
  function update(dt) {
    var P = SH.player.data, E = SH.economy.data;
    if (subtitleT > 0) { subtitleT -= dt; if (subtitleT <= 0 && el.subtitleEl) el.subtitleEl.style.opacity = '0'; }
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0 && el.bannerEl) el.bannerEl.style.opacity = '0'; }
    if (!el.healthFill) return;
    el.healthFill.style.width = Math.max(0, P.health) + '%';
    el.healthFill.style.background = P.health > 30 ? '#59cd90' : '#ff5964';
    el.armourFill.style.width = Math.max(0, P.armour) + '%';
    el.cashEl.textContent = '$' + Math.round(E.cash).toLocaleString('en-US');
    el.bankEl.textContent = 'BANK $' + Math.round(E.bank).toLocaleString('en-US');
    el.starsEl.textContent = starsString(SH.police.wanted);
    el.starsEl.style.color = SH.police.wanted > 0 ? '#ffd23f' : 'rgba(255,255,255,0.25)';
    el.clockEl.textContent = SH.weather.clockString() + ' · ' + SH.weather.state;
    var rk = SH.economy.rank(), nx = SH.economy.nextRank();
    el.rankEl.textContent = rk.name + ' · ' + E.xp + ' XP' + (nx ? ' (next: ' + nx.name + ' ' + nx.xp + ')' : ' · MAX');
    el.ammoEl.textContent = SH.player.currentVehicle() ? '' : 'AMMO ' + P.ammo;
    el.radioEl.textContent = SH.player.currentVehicle() ? '♪ ' + SH.audio.stationName() : '';
    var pp = SH.player.pos();
    el.districtEl.textContent = SH.city.isWater(pp.x, pp.z) ? 'Solstice Bay (at sea)' : SH.city.districtAt(pp.x, pp.z).name;
    var v = SH.player.currentVehicle();
    if (v) {
      el.speedo.style.opacity = '1';
      el.speedVal.textContent = Math.round(Math.abs(v.speed) * 3.6);
      el.vehName.textContent = v.name + (v.damage > 60 ? ' · DAMAGED ' + Math.round(v.damage) + '%' : '');
      E.stats.topSpeed = Math.max(E.stats.topSpeed, Math.abs(v.speed) * 3.6);
    } else el.speedo.style.opacity = '0';
    drawMinimap(pp);
  }
  function drawMinimap(pp) {
    if (!mapCtx) return;
    var g = mapCtx, S2 = 150, C2 = S2 / 2, scale = S2 / 340;
    g.clearRect(0, 0, S2, S2);
    g.fillStyle = '#0d2f1f'; g.fillRect(0, 0, S2, S2);
    function w2m(x, z) { return [C2 + (x - pp.x) * scale, C2 + (z - pp.z) * scale]; }
    // water
    g.fillStyle = '#0e4d7a';
    var sea = w2m(-800, SH.config.WORLD.seaZ); g.fillRect(0, sea[1], S2, S2 - sea[1]);
    var isl = w2m(SH.config.WORLD.islandX, SH.config.WORLD.islandZ);
    g.fillStyle = '#3f7d4e'; g.beginPath(); g.arc(isl[0], isl[1], SH.config.WORLD.islandR * scale, 0, 7); g.fill();
    // roads
    g.strokeStyle = '#8a929e'; g.lineWidth = 2;
    SH.city.roadsX.forEach(function (rx) { var a = w2m(rx, -420), b = w2m(rx, 260); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); });
    SH.city.roadsZ.forEach(function (rz) { var a = w2m(-440, rz), b = w2m(320, rz); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); });
    // GPS route
    var target = SH.missions.markerPos() || SH.sidejobs.gpsTarget(pp);
    if (!target && SH.missions.isActive() === false) target = null;
    if (target) {
      var path = SH.city.findPath(pp.x, pp.z, target.x, target.z);
      g.strokeStyle = '#ffd23f'; g.lineWidth = 2.5; g.beginPath();
      var p0 = w2m(pp.x, pp.z); g.moveTo(p0[0], p0[1]);
      path.forEach(function (n) { var q = w2m(n.x, n.z); g.lineTo(q[0], q[1]); });
      g.stroke();
      var tp = w2m(target.x, target.z);
      g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(tp[0], tp[1], 4.5, 0, 7); g.fill();
      g.fillStyle = '#111'; g.font = 'bold 7px sans-serif'; g.fillText('!', tp[0] - 1, tp[1] + 2.5);
    }
    // cops
    g.fillStyle = '#3f8cff';
    SH.police.cops().forEach(function (c) { var q = w2m(c.x, c.z); g.fillRect(q[0] - 2, q[1] - 2, 4, 4); });
    // traffic dots
    g.fillStyle = 'rgba(255,255,255,0.5)';
    SH.vehicles.list().forEach(function (c) { if (c.isPolice) return; var q = w2m(c.x, c.z); if (q[0] > 0 && q[0] < S2 && q[1] > 0 && q[1] < S2) g.fillRect(q[0] - 1, q[1] - 1, 2, 2); });
    // story marker
    if (!SH.missions.isActive()) {
      var sm = SH.missions.storyMarkerPos(); var q2 = w2m(sm.x, sm.z);
      g.fillStyle = '#ff4fd8'; g.beginPath(); g.arc(q2[0], q2[1], 4, 0, 7); g.fill();
    }
    // player arrow
    g.save(); g.translate(C2, C2); g.rotate(-pp.heading + Math.PI);
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, S2 - 1, S2 - 1);
    void R;
  }
  return {
    init: init, update: update, toast: toast, showBanner: showBanner, subtitle: subtitle,
    setObjective: setObjective, setPrompt: setPrompt, setBust: setBust, flashDamage: flashDamage,
    showEnd: showEnd, hideEnd: hideEnd, showStart: showStart, hideStart: hideStart,
    showPause: showPause, hidePause: hidePause, setPhoto: setPhoto, el: function () { return el; }
  };
})();
