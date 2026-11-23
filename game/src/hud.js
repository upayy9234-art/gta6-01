// Solstice Heat - HUD: DOM panels, live minimap, dialogs, ticker,
// popups, tutorial prompts and the start/pause/busted/wasted screens.
window.SH = window.SH || {};
(function (SH) {
  'use strict';
  var U = SH.U, C = SH.Config;
  var H = { el: {}, msgTimer: 0, tutTimer: 0, chatter: [], dialogQueue: null };
  SH.HUD = H;
  function id(name) { return document.getElementById(name); }
  H.init = function () {
    ['cash','bank','rank','xpbar','xptext','stars','healthbar','speed','objective','objdist','objtimer','clock','weather','district','centermsg','prompt','tutorial','jobboard','popup','chatter','tickertext','dialog','dialogname','dialogtext','bustbar','ammo','shells','minimap','station','muted'].forEach(function (n) { H.el[n] = id(n); });
    H.mm = H.el.minimap ? H.el.minimap.getContext('2d') : null;
    H.tickerIdx = 0; H.tickerTimer = 0;
  };
  H.centerMsg = function (text, dur) {
    if (!H.el.centermsg) return;
    H.el.centermsg.textContent = text; H.el.centermsg.style.opacity = 1;
    H.msgTimer = dur || 2;
  };
  H.tutorial = function (text) { if (H.el.tutorial) { H.el.tutorial.textContent = text; H.el.tutorial.style.opacity = text ? 1 : 0; } };
  H.contextPrompt = function (text) { if (H.el.prompt) { H.el.prompt.textContent = text || ''; H.el.prompt.style.opacity = text ? 1 : 0; } };
  H.rewardPopup = function (text) {
    if (!H.el.popup) return;
    var d = document.createElement('div'); d.className = 'popup-item'; d.textContent = text;
    H.el.popup.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 2600);
  };
  H.radioChatter = function (text) {
    H.chatter.unshift(text); H.chatter = H.chatter.slice(0, 3);
    if (H.el.chatter) H.el.chatter.innerHTML = H.chatter.map(function (c) { return '<div>' + c + '</div>'; }).join('');
  };
  H.showDialog = function (lines, giver) {
    H.dialogQueue = lines.slice(); H.dialogGiver = giver; H.nextDialog();
  };
  H.nextDialog = function () {
    if (!H.dialogQueue || !H.dialogQueue.length) { if (H.el.dialog) H.el.dialog.style.display = 'none'; H.dialogQueue = null; return; }
    var line = H.dialogQueue.shift();
    if (H.el.dialog) { H.el.dialog.style.display = 'block'; H.el.dialogname.textContent = line[0]; H.el.dialogtext.textContent = line[1]; }
  };
  H.update = function (dt) {
    var E = SH.Economy, P = SH.Player;
    if (H.msgTimer > 0) { H.msgTimer -= dt; if (H.msgTimer <= 0 && H.el.centermsg) H.el.centermsg.style.opacity = 0; }
    if (!H.el.cash) return;
    H.el.cash.textContent = U.fmtMoney(E.cash);
    H.el.bank.textContent = 'Bank ' + U.fmtMoney(E.bank);
    var rank = E.rank(), next = E.nextRank();
    H.el.rank.textContent = rank.name;
    var pct = next ? ((E.xp - rank.xp) / (next.xp - rank.xp)) * 100 : 100;
    H.el.xpbar.style.width = U.clamp(pct, 0, 100) + '%';
    H.el.xptext.textContent = next ? (E.xp + ' / ' + next.xp + ' XP') : (E.xp + ' XP - MAX RANK');
    var stars = '';
    for (var i = 0; i < 5; i++) stars += i < SH.Police.stars ? '\u2605' : '\u2606';
    H.el.stars.textContent = stars;
    H.el.stars.style.opacity = SH.Police.stars > 0 ? 1 : 0.25;
    H.el.healthbar.style.width = U.clamp(P.health, 0, 100) + '%';
    H.el.healthbar.style.background = P.health < 30 ? '#ff4455' : '#5ee08a';
    H.el.speed.textContent = P.car ? Math.round(Math.abs(P.car.speed) * 3.6) + ' km/h' : (P.swim ? 'swimming' : '');
    H.el.ammo.textContent = P.car ? '' : ('Ammo ' + P.ammo);
    if (H.el.shells && SH.Activities.shellCount) H.el.shells.textContent = 'Shells ' + SH.Activities.shellCount() + '/' + C.SHELL_COUNT;
    if (H.el.clock && SH.Weather) H.el.clock.textContent = SH.Weather.clockText();
    if (H.el.weather && SH.Weather) H.el.weather.textContent = SH.Weather.type;
    var pp = P.pos();
    if (H.el.district) H.el.district.textContent = SH.City.districtNameAt(pp.x, pp.z);
    if (H.el.bustbar) {
      var b = SH.Police.bust;
      H.el.bustbar.style.opacity = b > 0.02 ? 1 : 0;
      H.el.bustbar.firstElementChild.style.width = (b * 100) + '%';
    }
    // Objective priority: mission > race > job > beacon hint.
    var obj = null;
    if (SH.Missions.objective && SH.Missions.objective()) obj = SH.Missions.objective();
    else if (SH.Races.objective()) obj = SH.Races.objective();
    else if (SH.Jobs.objective()) obj = SH.Jobs.objective();
    if (obj) {
      H.el.objective.textContent = obj.label;
      H.el.objdist.textContent = obj.dist + 'm';
      H.el.objtimer.textContent = obj.timer != null ? U.fmtTime(obj.timer) : '';
      H.currentObjective = obj;
    } else {
      H.el.objective.textContent = SH.Missions.availableIdx() >= 0 ? 'Visit Marisol Vega (gold pillar) or the job board' : 'Free roam - races, jobs and shells await';
      H.el.objdist.textContent = ''; H.el.objtimer.textContent = '';
      H.currentObjective = null;
    }
    // Job board panel.
    if (H.el.jobboard) {
      if (SH.Jobs.nearBoard() && !SH.Jobs.active) {
        H.el.jobboard.style.display = 'block';
        H.el.jobboard.innerHTML = '<b>JOB BOARD</b>' + SH.Jobs.board.map(function (j, i) { return '<div>' + (i + 1) + '. ' + j.name + ' - ~' + U.fmtMoney(j.base + Math.round(j.dist * 0.35)) + '<br><small>' + j.desc + '</small></div>'; }).join('') + '<small>Press 1-4 to take a job</small>';
      } else H.el.jobboard.style.display = 'none';
    }
    // Radio ticker rotation.
    H.tickerTimer -= dt;
    if (H.tickerTimer <= 0) {
      H.tickerTimer = 7; H.tickerIdx = (H.tickerIdx + 1) % C.TICKER.length;
      if (H.el.tickertext) H.el.tickertext.textContent = C.TICKER[H.tickerIdx];
    }
    if (H.el.station && SH.Audio) H.el.station.textContent = C.RADIO_STATIONS[SH.Audio.station].name;
    if (H.el.muted && SH.Audio) H.el.muted.textContent = SH.Audio.muted ? 'MUTED (M)' : '';
    H.drawMinimap(pp);
  };
  H.drawMinimap = function (pp) {
    var ctx = H.mm; if (!ctx) return;
    var W = 252, Hh = 190, scale = 0.24;
    ctx.fillStyle = '#12242e'; ctx.fillRect(0, 0, W, Hh);
    var cx = W / 2, cy = Hh / 2;
    function mx(x) { return cx + (x - pp.x) * scale; }
    function mz(z) { return cy + (z - pp.z) * scale; }
    // Water + beach.
    ctx.fillStyle = '#1d5f7a'; ctx.fillRect(mx(400), 0, W, Hh);
    ctx.fillStyle = '#c9b183'; ctx.fillRect(mx(330), 0, Math.max(0, mx(400) - mx(330)), Hh);
    // Roads.
    ctx.strokeStyle = '#5a6672'; ctx.lineWidth = 3;
    SH.City.roadsX.forEach(function (r) { ctx.beginPath(); ctx.moveTo(mx(r), 0); ctx.lineTo(mx(r), Hh); ctx.stroke(); });
    SH.City.roadsZ.forEach(function (r) { ctx.beginPath(); ctx.moveTo(0, mz(r)); ctx.lineTo(W, mz(r)); ctx.stroke(); });
    function dot(x, z, color, size) { var a = mx(x), b = mz(z); if (a < -4 || b < -4 || a > W + 4 || b > Hh + 4) return; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(a, b, size, 0, 7); ctx.fill(); }
    if (SH.Activities) {
      SH.Activities.shells.forEach(function (s) { if (!s.found) dot(s.x, s.z, '#ffd7ec', 1.6); });
      if (SH.Activities.beaconAt) dot(SH.Activities.beaconAt.x, SH.Activities.beaconAt.z, '#b44dff', 4);
    }
    SH.Vehicles.traffic.forEach(function (c) { dot(c.x, c.z, '#cfd8dc', 1.8); });
    SH.Police.units.forEach(function (u2) { dot(u2.x, u2.z, (Math.floor(performance.now() / 300) % 2 ? '#ff4455' : '#4488ff'), 3); });
    if (H.currentObjective) dot(H.currentObjective.x, H.currentObjective.z, '#ffe14d', 4.5);
    dot(SH.City.anchors.marisol.x, SH.City.anchors.marisol.z, '#ffb347', 3);
    // Player arrow.
    var heading = SH.Player.car ? SH.Player.car.heading : SH.Player.heading;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(heading);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(4.6, 5); ctx.lineTo(-4.6, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  H.showScreen = function (which) {
    ['startscreen','pausescreen','bustedscreen','wastedscreen'].forEach(function (s) { var e = id(s); if (e) e.style.display = 'none'; });
    if (which) { var e2 = id(which + 'screen'); if (e2) e2.style.display = 'flex'; }
  };
})(window.SH);
