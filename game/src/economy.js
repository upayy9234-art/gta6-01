// ============================================================================
// SOLSTICE HEAT — economy.js  (Round 11, NEW)
// The money-and-reputation layer that sits under missions, taxi fares and
// side jobs. Cash lives in SH.G.money (the number the HUD has always shown);
// this module adds the bank account, the five-rung reputation ladder,
// lifetime run statistics and the payout maths everyone shares, so a job,
// a fare and a story mission all pay through one honest pipeline:
//   gross -> reputation bonus -> streak-free split (bank share / cash).
// Persistence rides inside the existing localStorage save: main.js asks
// for saveData() when it writes and hands restore() the blob on continue.
// ============================================================================
(function () {
'use strict';
window.SH = window.SH || {};

var C = SH.Config;
var E = C.economy;
var U = SH.U;

var bank = 0;               // savings: grows by bankShare of every payout
var xp = 0;                 // lifetime reputation XP
var levelIdx = 0;           // index into E.levels, derived from xp
var stats = {
  distanceKm: 0,            // odometer across every car the player drives
  jobsDone: 0,              // side jobs completed (jobs.js)
  jobsTaken: 0,
  faresDone: 0,             // taxi fares completed (missions.js)
  missionsDone: 0,          // story missions completed
  topSpeedKmh: 0,           // fastest moment ever, in any car
  nearMisses: 0,
  earnedTotal: 0            // gross cash earned across the whole run
};
var lastPos = null;         // last frame player position (odometer)
var levelListeners = [];

function computeLevel() {
  var idx = 0;
  for (var i = 0; i < E.levels.length; i++) {
    if (xp >= E.levels[i].xp) idx = i;
  }
  return idx;
}

function level() { return E.levels[levelIdx]; }

function nextLevel() {
  return levelIdx + 1 < E.levels.length ? E.levels[levelIdx + 1] : null;
}

// XP progress 0..1 toward the next rung (1 at the top of the ladder).
function levelProgress() {
  var nxt = nextLevel();
  if (!nxt) return 1;
  var cur = level().xp;
  return U.clamp((xp - cur) / (nxt.xp - cur), 0, 1);
}

// The multiplier every payout passes through: +8% per rung above the first.
function payoutMultiplier() {
  return 1 + levelIdx * E.payoutBonusPerLevel;
}

function addXP(amount, why) {
  if (!amount || amount <= 0) return;
  var before = levelIdx;
  xp += amount;
  levelIdx = computeLevel();
  if (levelIdx > before) {
    // a rung gained: fanfare + a centre-screen moment + let listeners react
    if (SH.Audio) SH.Audio.levelUp();
    if (SH.HUD) {
      SH.HUD.message('REPUTATION UP', 'You are now a ' + level().name +
        ' — payouts +' + Math.round(levelIdx * E.payoutBonusPerLevel * 100) + '%', 3000);
    }
    for (var i = 0; i < levelListeners.length; i++) levelListeners[i](levelIdx, level());
  }
}

// Pay the player. Returns the breakdown so callers can show an honest
// reward summary (gross, bonus, banked, cash). Cash goes to SH.G.money.
function pay(gross, opts) {
  opts = opts || {};
  var mult = payoutMultiplier();
  var withBonus = Math.round(gross * mult);
  var bonus = withBonus - Math.round(gross);
  var banked = Math.round(withBonus * E.bankShare);
  var cash = withBonus - banked;
  bank += banked;
  SH.G.money += cash;
  stats.earnedTotal += withBonus;
  if (opts.xp) addXP(opts.xp, opts.why || 'work');
  if (SH.Save && !opts.noSave) SH.Save.save();
  return { gross: Math.round(gross), bonus: bonus, banked: banked, cash: cash, total: withBonus };
}

// Direct cash change that bypasses the payout pipeline (fines, respawn
// fees, case pickups): still tracked so the stats stay truthful.
function addCash(amount) {
  SH.G.money += amount;
  if (amount > 0) stats.earnedTotal += amount;
}

function spendCash(amount) {
  var paid = Math.min(SH.G.money, Math.max(0, amount));
  SH.G.money -= paid;
  return paid;
}

// Per-frame bookkeeping: odometer + top speed, sampled from the player's
// actual position so it counts in every vehicle and on foot alike.
function update(dt) {
  var p = SH.Player ? SH.Player.pos : null;
  if (!p) return;
  if (lastPos) {
    var d = U.dist(lastPos.x, lastPos.z, p.x, p.z);
    // ignore teleports (respawns, shot setups): a frame never moves 40 m
    if (d < 40) stats.distanceKm += d / 1000;
  }
  lastPos = { x: p.x, z: p.z };
  if (SH.Player.inCar && SH.Player.car) {
    var kmh = Math.abs(SH.Player.car.speed) * 3.6;
    if (kmh > stats.topSpeedKmh) stats.topSpeedKmh = Math.round(kmh);
  }
}

SH.Economy = {
  get bank() { return bank; },
  get xp() { return xp; },
  get stats() { return stats; },
  level: level,
  levelIndex: function () { return levelIdx; },
  levelName: function () { return level().name; },
  nextLevel: nextLevel,
  levelProgress: levelProgress,
  payoutMultiplier: payoutMultiplier,
  pay: pay,
  addCash: addCash,
  spendCash: spendCash,
  addXP: addXP,
  onLevelUp: function (fn) { levelListeners.push(fn); },

  // Small typed counters so other modules never poke stats directly.
  countJobTaken: function () { stats.jobsTaken++; },
  countJobDone: function () { stats.jobsDone++; },
  countFare: function () { stats.faresDone++; },
  countMission: function () { stats.missionsDone++; },
  countNearMiss: function () { stats.nearMisses++; },

  // One-line summary for the title screen and the reward panel.
  summaryLine: function () {
    return level().name + ' · ' + U.fmtMoney(SH.G.money) + ' cash · ' +
      U.fmtMoney(bank) + ' banked · ' + stats.jobsDone + ' jobs · ' +
      stats.distanceKm.toFixed(1) + ' km driven';
  },

  restore: function (data) {
    bank = 0; xp = 0; levelIdx = 0;
    stats = { distanceKm: 0, jobsDone: 0, jobsTaken: 0, faresDone: 0,
              missionsDone: 0, topSpeedKmh: 0, nearMisses: 0, earnedTotal: 0 };
    lastPos = null;
    if (!data) return;
    bank = Math.max(0, Math.floor(data.bank || 0));
    xp = Math.max(0, Math.floor(data.xp || 0));
    if (data.stats) {
      for (var k in stats) {
        if (typeof data.stats[k] === 'number' && isFinite(data.stats[k])) stats[k] = data.stats[k];
      }
    }
    levelIdx = computeLevel();
  },

  saveData: function () {
    return { bank: bank, xp: xp, stats: stats };
  },

  update: update
};
})();
