// ============================================================================
// SOLSTICE HEAT — hud.js
// All DOM overlays (money, wanted stars, health, speedo, objective bar,
// toasts, centre messages, prompts) plus the 2D canvas minimap: a pre-rendered
// static street map with live blips for the player, police, mission and taxi.
// Round 11: the HUD grows an economy face — bank balance, reputation level
// with an XP bar, a persistent side-job board, a guided-tutorial hint line,
// an itemised reward-summary panel, police radio chatter, pedestrian barks,
// a wanted-escalation banner, a hurt flash and floating score popups. The
// minimap also learns the green job marker and the job-board squares.
// ============================================================================
(function () {
'use strict';
window.SH = window.SH || {};

var C = SH.Config;
var W = C.world;
var U = SH.U;

var el = {};
var toastList = [];
var toastBusy = false;
var msgTimer = null;
var objectiveText = '';
var objectiveDist = -1;
var timerValue = -1;
var taxiText = '';
var radioIdx = 0;
var radioTimer = 0;
var lastHeat = 0;
var lastStars = 0;
var districtTimer = 0;
var mapStatic = null;
var rewardTimer = null;
var barkTimerEl = null;
var chatterTimerEl = null;
var popupTimer = null;
var escTimer = null;

function $(id) { return document.getElementById(id); }

function cacheDom() {
  ['hud', 'hud-money', 'hud-bank', 'hud-level-name', 'hud-xp-fill', 'hud-stars', 'hud-eye',
   'hud-health-fill', 'hud-health-wrap',
   'hud-speed-wrap', 'hud-speed', 'hud-objective', 'hud-obj-text', 'hud-obj-dist',
   'hud-timer', 'hud-taxi', 'minimap', 'radio-ticker', 'hud-chatter', 'center-msg', 'center-title',
   'center-sub', 'toast', 'toast-text', 'prompt', 'hud-district', 'bust-wrap', 'bust-fill',
   'title-screen', 'over-screen', 'over-title', 'over-sub', 'pause-screen', 'shot-title',
   'btn-continue', 'save-info', 'mute-note',
   'hud-jobboard', 'hud-job-lines', 'hud-tutorial', 'hud-reward', 'hud-reward-title',
   'hud-reward-rows', 'hud-bark', 'hurt-flash', 'score-popup', 'esc-banner', 'esc-stars'
  ].forEach(function (id) { el[id] = $(id); });
}

// --- minimap static layer ---------------------------------------------------------
var MAP_W = 252, MAP_H = 190;
var MX1 = -275, MX2 = 295, MZ1 = -215, MZ2 = 215;
function mapX(x) { return (x - MX1) / (MX2 - MX1) * MAP_W; }
function mapZ(z) { return (z - MZ1) / (MZ2 - MZ1) * MAP_H; }

function buildMapStatic() {
  mapStatic = document.createElement('canvas');
  mapStatic.width = MAP_W; mapStatic.height = MAP_H;
  var g = mapStatic.getContext('2d');
  g.fillStyle = '#e8cf9e'; // sand
  g.fillRect(0, 0, MAP_W, MAP_H);
  g.fillStyle = '#1f8a9e'; // sea
  g.fillRect(mapX(W.sandX), 0, MAP_W - mapX(W.sandX), MAP_H);
  g.fillStyle = '#8d9299'; // slab
  g.fillRect(mapX(W.slabX1), mapZ(W.slabZ1), mapX(W.slabX2) - mapX(W.slabX1), mapZ(W.slabZ2) - mapZ(W.slabZ1));
  // blocks
  g.fillStyle = '#6f7a72';
  for (var col = 0; col < 6; col++) {
    for (var row = 0; row < 5; row++) {
      var x1 = W.vx[col] + W.roadHalf, x2 = W.vx[col + 1] - W.roadHalf;
      var z1 = W.hz[row] + W.roadHalf, z2 = W.hz[row + 1] - W.roadHalf;
      g.fillRect(mapX(x1), mapZ(z1), mapX(x2) - mapX(x1), mapZ(z2) - mapZ(z1));
    }
  }
  // roads
  g.strokeStyle = '#33373d';
  g.lineWidth = 3;
  var i;
  for (i = 0; i < W.vx.length; i++) {
    g.beginPath(); g.moveTo(mapX(W.vx[i]), mapZ(W.slabZ1)); g.lineTo(mapX(W.vx[i]), mapZ(W.slabZ2)); g.stroke();
  }
  for (i = 0; i < W.hz.length; i++) {
    g.beginPath(); g.moveTo(mapX(W.slabX1), mapZ(W.hz[i])); g.lineTo(mapX(W.slabX2), mapZ(W.hz[i])); g.stroke();
  }
  // pier
  g.strokeStyle = '#9a744e';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(mapX(196), mapZ(0)); g.lineTo(mapX(262), mapZ(0)); g.stroke();
  // Round 11: job boards are permanent map furniture — small green squares
  g.fillStyle = '#51e88a';
  if (C.jobs) {
    for (i = 0; i < C.jobs.pickupPoints.length; i++) {
      var bp = C.jobs.pickupPoints[i];
      g.fillRect(mapX(bp.x) - 2, mapZ(bp.z) - 2, 4, 4);
    }
  }
}

function drawMinimap() {
  var cv = el['minimap'];
  if (!cv || !mapStatic) return;
  var g = cv.getContext('2d');
  g.clearRect(0, 0, MAP_W, MAP_H);
  g.drawImage(mapStatic, 0, 0);
  var t = SH.G.time;

  function dot(x, z, color, r) {
    g.fillStyle = color;
    g.beginPath(); g.arc(mapX(x), mapZ(z), r || 3, 0, 6.29); g.fill();
  }
  // mission + taxi blips
  if (SH.Missions) {
    var mp = SH.Missions.markerPos();
    if (mp) { dot(mp.x, mp.z, '#ffd94d', 3.6); dot(mp.x, mp.z, 'rgba(255,217,77,0.35)', 6.5); }
    var tp = SH.Missions.taxiMarkerPos();
    if (tp) dot(tp.x, tp.z, '#5ee8d2', 3.4);
  }
  // Round 11: live job blip pulses green so work reads apart from story gold
  if (SH.Jobs && SH.Jobs.markerPos) {
    var jp = SH.Jobs.markerPos();
    if (jp) {
      var pulse = 3.2 + Math.sin(t * 5) * 0.9;
      dot(jp.x, jp.z, '#51e88a', pulse);
      dot(jp.x, jp.z, 'rgba(81,232,138,0.3)', pulse + 3);
    }
  }
  // police blips blink red/blue
  if (SH.Police) {
    var pcs = SH.Police.cars();
    var phase = Math.sin(t * 9) > 0;
    for (var i = 0; i < pcs.length; i++) {
      var p = pcs[i].mesh.position;
      dot(p.x, p.z, phase ? '#ff3b30' : '#2f7bff', 3);
    }
  }
  // player arrow
  var pp = SH.Player.pos;
  var h = SH.Player.heading;
  g.save();
  g.translate(mapX(pp.x), mapZ(pp.z));
  g.rotate(Math.atan2(U.fwdX(h), -U.fwdZ(h)));
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#111';
  g.beginPath();
  g.moveTo(0, -5.5); g.lineTo(3.8, 4.5); g.lineTo(0, 2.4); g.lineTo(-3.8, 4.5);
  g.closePath(); g.fill(); g.stroke();
  g.restore();
}

// --- toasts + centre messages ---------------------------------------------------------
function nextToast() {
  if (!toastList.length) { toastBusy = false; el['toast'].classList.remove('show'); return; }
  toastBusy = true;
  var line = toastList.shift();
  el['toast-text'].textContent = line;
  el['toast'].classList.add('show');
  setTimeout(function () {
    el['toast'].classList.remove('show');
    setTimeout(nextToast, 260);
  }, 4300);
}

// --- public API ----------------------------------------------------------------------------
SH.HUD = {
  init: function () {
    cacheDom();
    buildMapStatic();
    if (el['minimap']) { el['minimap'].width = MAP_W; el['minimap'].height = MAP_H; }
    this.setRadio(true);
  },

  setRadio: function (force) {
    var all = [];
    C.radio.forEach(function (st) {
      st.tracks.forEach(function (tr) { all.push({ tr: tr, st: st }); });
    });
    var item = all[radioIdx % all.length];
    if (el['radio-ticker']) {
      el['radio-ticker'].textContent = '♪ ' + item.tr + '  ·  ' + item.st.name + ' ' + item.st.freq;
    }
  },

  toastQueue: function (lines) {
    if (!lines) return;
    for (var i = 0; i < lines.length; i++) toastList.push(lines[i]);
    if (!toastBusy) nextToast();
  },

  message: function (title, sub, durMs) {
    if (!el['center-msg']) return;
    el['center-title'].textContent = title;
    el['center-sub'].textContent = sub || '';
    el['center-msg'].classList.add('show');
    if (msgTimer) clearTimeout(msgTimer);
    msgTimer = setTimeout(function () { el['center-msg'].classList.remove('show'); }, durMs || 2400);
  },

  setPrompt: function (text) {
    if (!el['prompt']) return;
    if (text) { el['prompt'].textContent = text; el['prompt'].classList.add('show'); }
    else el['prompt'].classList.remove('show');
  },

  setObjective: function (text, dist) {
    objectiveText = text || '';
    objectiveDist = (typeof dist === 'number') ? dist : -1;
  },
  setTimer: function (sec) { timerValue = sec; },
  setTaxiObjective: function (text) { taxiText = text || ''; },

  // --- Round 11 additions -----------------------------------------------------
  // The side-job board: two short lines, always visible while playing.
  setJobBoard: function (lines) {
    if (!el['hud-jobboard'] || !el['hud-job-lines']) return;
    el['hud-job-lines'].innerHTML = '';
    (lines || []).forEach(function (line) {
      var d = document.createElement('div');
      d.textContent = line;
      el['hud-job-lines'].appendChild(d);
    });
    el['hud-jobboard'].style.display = (lines && lines.length) ? '' : 'none';
  },

  // Guided onboarding hint: one persistent line until the chain is done.
  setTutorial: function (text) {
    if (!el['hud-tutorial']) return;
    if (text) {
      el['hud-tutorial'].textContent = '▸ ' + text;
      el['hud-tutorial'].style.display = '';
    } else {
      el['hud-tutorial'].style.display = 'none';
    }
  },

  // Itemised reward summary panel (mission / job completion).
  showReward: function (title, rows) {
    if (!el['hud-reward'] || !el['hud-reward-rows']) return;
    el['hud-reward-title'].textContent = title;
    el['hud-reward-rows'].innerHTML = '';
    (rows || []).forEach(function (row) {
      var d = document.createElement('div');
      d.className = 'reward-row';
      var a = document.createElement('span'); a.textContent = row[0];
      var b = document.createElement('span'); b.textContent = row[1]; b.className = 'reward-val';
      d.appendChild(a); d.appendChild(b);
      el['hud-reward-rows'].appendChild(d);
    });
    el['hud-reward'].classList.add('show');
    if (rewardTimer) clearTimeout(rewardTimer);
    rewardTimer = setTimeout(function () { el['hud-reward'].classList.remove('show'); }, 5600);
  },

  // SBPD radio line under the music ticker; fades after a few seconds.
  setRadioChatter: function (text) {
    if (!el['hud-chatter']) return;
    el['hud-chatter'].textContent = '📻 ' + text;
    el['hud-chatter'].classList.add('show');
    if (chatterTimerEl) clearTimeout(chatterTimerEl);
    chatterTimerEl = setTimeout(function () { el['hud-chatter'].classList.remove('show'); }, 5200);
  },

  // Overheard pedestrian line, floated low-centre.
  setBark: function (text) {
    if (!el['hud-bark']) return;
    el['hud-bark'].textContent = text;
    el['hud-bark'].classList.add('show');
    if (barkTimerEl) clearTimeout(barkTimerEl);
    barkTimerEl = setTimeout(function () { el['hud-bark'].classList.remove('show'); }, 3000);
  },

  // Red edge flash when the player takes damage (strength 0..1).
  hurtFlash: function (strength) {
    if (!el['hurt-flash']) return;
    el['hurt-flash'].style.opacity = String(0.25 + 0.55 * U.clamp(strength, 0, 1));
    el['hurt-flash'].classList.add('on');
    setTimeout(function () {
      el['hurt-flash'].classList.remove('on');
      el['hurt-flash'].style.opacity = '0';
    }, 90);
  },

  // Small floating score text (near miss, race gates).
  scorePopup: function (text) {
    if (!el['score-popup']) return;
    el['score-popup'].textContent = text;
    el['score-popup'].classList.remove('pop');
    // restart the CSS animation
    void el['score-popup'].offsetWidth;
    el['score-popup'].classList.add('pop');
    if (popupTimer) clearTimeout(popupTimer);
    popupTimer = setTimeout(function () { el['score-popup'].classList.remove('pop'); }, 1300);
  },

  // Wanted escalation banner: big stars slam in at the top centre.
  escalationBanner: function (stars) {
    if (!el['esc-banner'] || !el['esc-stars']) return;
    var s = '';
    for (var i = 0; i < 5; i++) s += i < stars ? '★' : '☆';
    el['esc-stars'].textContent = s;
    el['esc-banner'].classList.add('show');
    if (escTimer) clearTimeout(escTimer);
    escTimer = setTimeout(function () { el['esc-banner'].classList.remove('show'); }, 2100);
  },

  showTitle: function (hasSave) {
    el['title-screen'].classList.add('show');
    el['over-screen'].classList.remove('show');
    el['pause-screen'].classList.remove('show');
    if (el['btn-continue']) el['btn-continue'].style.display = hasSave ? '' : 'none';
    el['hud'].classList.remove('live');
  },
  hideTitle: function () {
    el['title-screen'].classList.remove('show');
    el['hud'].classList.add('live');
  },
  showOver: function (kind) {
    el['over-title'].textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
    el['over-title'].className = kind;
    el['over-sub'].textContent = kind === 'busted'
      ? 'The SBPD sends its regards. Press R to walk it off.'
      : 'The bay claims another legend. Press R to get up.';
    el['over-screen'].classList.add('show');
  },
  hideOver: function () { el['over-screen'].classList.remove('show'); },
  showPause: function (on) {
    el['pause-screen'].classList.toggle('show', !!on);
  },
  setSaveInfo: function (text) {
    if (el['save-info']) el['save-info'].textContent = text || '';
  },
  setMutedNote: function (m) {
    if (el['mute-note']) el['mute-note'].textContent = m ? 'SOUND OFF (M)' : '';
  },

  update: function (dt) {
    if (!el['hud-money']) return;
    // money + Round 11 economy face: bank line and the reputation ladder
    el['hud-money'].textContent = U.fmtMoney(SH.G.money);
    if (SH.Economy) {
      if (el['hud-bank']) el['hud-bank'].textContent = 'Bank ' + U.fmtMoney(SH.Economy.bank);
      if (el['hud-level-name']) {
        var nxt = SH.Economy.nextLevel();
        el['hud-level-name'].textContent = SH.Economy.levelName() +
          (nxt ? ' · ' + SH.Economy.xp + '/' + nxt.xp + ' XP' : ' · MAX');
      }
      if (el['hud-xp-fill']) el['hud-xp-fill'].style.width = Math.round(SH.Economy.levelProgress() * 100) + '%';
    }
    // wanted stars
    var pol = SH.Police;
    var s = pol ? pol.stars : 0;
    var starsHtml = '';
    for (var i = 0; i < 5; i++) starsHtml += i < s ? '★' : '☆';
    if (el['hud-stars'].textContent !== starsHtml) el['hud-stars'].textContent = starsHtml;
    el['hud-stars'].classList.toggle('hot', s > 0);
    el['hud-stars'].classList.toggle('rising', pol && pol.heat > lastHeat + 0.5);
    lastHeat = pol ? pol.heat : 0;
    if (s !== lastStars) lastStars = s;
    // eye indicator: seen / hidden while wanted
    if (el['hud-eye']) {
      if (s === 0) el['hud-eye'].textContent = '';
      else el['hud-eye'].textContent = pol.seen ? '◉ SEEN' : '◎ HIDDEN — heat falling';
      el['hud-eye'].className = pol && pol.seen ? 'seen' : 'hidden-eye';
    }
    // bust meter
    if (el['bust-wrap']) {
      var bp = pol ? pol.bustProgress : 0;
      el['bust-wrap'].style.display = bp > 0.02 ? '' : 'none';
      el['bust-fill'].style.width = Math.round(bp * 100) + '%';
    }
    // health
    if (el['hud-health-fill']) {
      var hp = SH.Player.health;
      el['hud-health-fill'].style.width = hp + '%';
      el['hud-health-fill'].classList.toggle('low', hp < 32);
    }
    // speed
    if (el['hud-speed-wrap']) {
      if (SH.Player.inCar && SH.Player.car) {
        el['hud-speed-wrap'].style.display = '';
        el['hud-speed'].textContent = String(Math.round(Math.abs(SH.Player.car.speed) * 3.6));
      } else {
        el['hud-speed-wrap'].style.display = 'none';
      }
    }
    // objective bar (mission wins over taxi text; an active side job rides
    // on the job board instead, so the two never fight over one line)
    var obj = objectiveText || taxiText;
    var jobDist = -1;
    if (SH.Jobs && SH.Jobs.active()) {
      var job = SH.Jobs.active();
      var jt = SH.Jobs.objectiveText ? SH.Jobs.objectiveText(job) : '';
      if (jt && !obj) {
        obj = jt;
        // with no story objective on the bar, the job marker's live
        // distance takes the distance slot so the player can navigate
        var jp2 = SH.Jobs.markerPos ? SH.Jobs.markerPos() : null;
        if (jp2) jobDist = U.dist(SH.Player.pos.x, SH.Player.pos.z, jp2.x, jp2.z);
      }
    }
    if (el['hud-objective']) {
      el['hud-objective'].style.display = obj ? '' : 'none';
      el['hud-obj-text'].textContent = obj;
      el['hud-obj-dist'].textContent = (objectiveText && objectiveDist >= 0)
        ? U.fmtDist(objectiveDist)
        : (jobDist >= 0 ? U.fmtDist(jobDist) : '');
    }
    if (el['hud-timer']) {
      if (timerValue >= 0) {
        el['hud-timer'].style.display = '';
        var sec = Math.max(0, Math.ceil(timerValue));
        el['hud-timer'].textContent = Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
        el['hud-timer'].classList.toggle('urgent', sec <= 20);
      } else el['hud-timer'].style.display = 'none';
    }
    // radio rotates every ~20 s
    radioTimer += dt;
    if (radioTimer > 20) { radioTimer = 0; radioIdx++; this.setRadio(); }
    // district label, refreshed twice a second
    districtTimer -= dt;
    if (districtTimer <= 0 && el['hud-district']) {
      districtTimer = 0.5;
      var p = SH.Player.pos;
      el['hud-district'].textContent = SH.City.districtAt(p.x, p.z) + ' — ' + SH.City.streetAt(p.x, p.z);
    }
    drawMinimap();
  }
};
})();
