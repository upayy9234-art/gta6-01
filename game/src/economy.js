// Solstice Heat: Neon Tide — economy.js
// Cash/bank, XP + ranks, shops, localStorage save, achievements.
window.SH = window.SH || {};
SH.economy = (function () {
  'use strict';
  var B = SH.config.BALANCE;
  var E = {
    cash: B.startCash, bank: B.startBank, xp: 0,
    missionIndex: 0, shells: [], postcards: [], achievements: [],
    stats: { earned: 0, missionsDone: 0, racesWon: 0, jobsDone: 0, stunts: 0, topSpeed: 0 },
    onboarding: 0
  };
  var SAVE_KEY = 'solstice-heat-save-v1';
  var SHOPS = [
    { id: 'armour', name: 'Bay Armoury', x: -24, z: 96, kind: 'armour' },
    { id: 'clinic', name: 'Solstice Clinic', x: -168, z: -40, kind: 'health' },
    { id: 'garage', name: 'Neon Customs Garage', x: 96, z: 176, kind: 'repair' },
    { id: 'ammo', name: 'Marina Tackle & Ammo', x: 176, z: 232, kind: 'ammo' }
  ];
  var ACHIEVEMENTS = [
    { id: 'first-mission', name: 'First Wheel', test: function () { return E.stats.missionsDone >= 1; } },
    { id: 'story-done', name: 'Neon Tide', test: function () { return E.stats.missionsDone >= 12; } },
    { id: 'rich', name: 'Five Figures', test: function () { return E.cash + E.bank >= 10000; } },
    { id: 'racer', name: 'Street Royalty', test: function () { return E.stats.racesWon >= 3; } },
    { id: 'collector', name: 'Beachcomber', test: function () { return E.shells.length >= 20; } },
    { id: 'worker', name: 'Working Stiff', test: function () { return E.stats.jobsDone >= 8; } },
    { id: 'daredevil', name: 'Send It', test: function () { return E.stats.stunts >= 5; } },
    { id: 'untouchable', name: 'Ghost of the Bay', test: function () { return E.stats.missionsDone >= 6 && E.xp >= 500; } }
  ];
  function rank() {
    var r = B.ranks[0];
    B.ranks.forEach(function (rk) { if (E.xp >= rk.xp) r = rk; });
    return r;
  }
  function nextRank() {
    for (var i = 0; i < B.ranks.length; i++) if (E.xp < B.ranks[i].xp) return B.ranks[i];
    return null;
  }
  function addCash(n, why) {
    E.cash += n; if (n > 0) E.stats.earned += n;
    SH.hud.toast((n >= 0 ? '+$' : '-$') + Math.abs(Math.round(n)) + (why ? ' — ' + why : ''));
    if (n > 0) SH.audio.cash();
    checkAchievements(); save();
  }
  function addXP(n) {
    var before = rank().name;
    E.xp += n;
    var after = rank().name;
    if (after !== before) { SH.hud.toast('Rank up: ' + after + '!'); SH.audio.success(); var pp = SH.player.pos(); SH.effects.confettiAt(pp.x, 2.5, pp.z); }
    checkAchievements(); save();
  }
  function checkAchievements() {
    ACHIEVEMENTS.forEach(function (a) {
      if (E.achievements.indexOf(a.id) < 0 && a.test()) {
        E.achievements.push(a.id);
        SH.hud.toast('Achievement: ' + a.name);
        SH.audio.success();
      }
    });
  }
  function canAfford(n) { return E.cash >= n; }
  function buyAt(shop) {
    var P = SH.player.data, v = SH.player.currentVehicle();
    if (shop.kind === 'armour') {
      if (!canAfford(B.armourCost)) return 'Need $' + B.armourCost + ' for armour';
      if (P.armour >= 100) return 'Armour already full';
      addCash(-B.armourCost, 'Armour vest'); P.armour = 100; return 'Armour fitted (100)';
    }
    if (shop.kind === 'health') {
      if (!canAfford(B.healthCost)) return 'Need $' + B.healthCost + ' for treatment';
      if (P.health >= 100) return 'Health already full';
      addCash(-B.healthCost, 'Clinic'); SH.player.heal(100); return 'Patched up to full health';
    }
    if (shop.kind === 'ammo') {
      if (!canAfford(B.ammoCost)) return 'Need $' + B.ammoCost + ' for ammo';
      addCash(-B.ammoCost, 'Ammo x30'); P.ammo += 30; return 'Ammo +30 (now ' + P.ammo + ')';
    }
    if (shop.kind === 'repair') {
      if (!v) return 'Bring a vehicle to repair';
      var cost = Math.ceil(v.damage * B.repairCostPerDamage);
      if (cost <= 0) return 'Vehicle is already pristine';
      if (!canAfford(cost)) return 'Repair costs $' + cost;
      addCash(-cost, 'Repairs'); SH.vehicles.repair(v); return 'Vehicle repaired for $' + cost;
    }
    return '';
  }
  function nearestShop(x, z) {
    var best = null, bd = 7;
    SHOPS.forEach(function (s) { var d = SH.random.dist2(x, z, s.x, s.z); if (d < bd) { bd = d; best = s; } });
    return best;
  }
  function onBusted() {
    var fine = Math.floor(E.cash * B.bustFineRate);
    E.cash -= fine;
    SH.hud.toast('Fine: -$' + fine);
    respawn();
  }
  function onWasted() {
    E.cash = Math.max(0, E.cash - B.wastedCost);
    SH.hud.toast('Hospital bill: -$' + B.wastedCost);
  }
  function respawn() {
    SH.police.setWanted(0); SH.police.clearPursuit();
    var P = SH.player.data;
    P.dead = false; P.health = 70; P.armour = 0;
    if (SH.player.currentVehicle()) SH.player.exitVehicle();
    SH.player.teleport(-52, 224, 0);
  }
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: E.cash, bank: E.bank, xp: E.xp, missionIndex: E.missionIndex,
        shells: E.shells, postcards: E.postcards, achievements: E.achievements,
        stats: E.stats, onboarding: E.onboarding
      }));
    } catch (e) { /* storage unavailable */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      var d = JSON.parse(raw);
      E.cash = d.cash || 0; E.bank = d.bank || 0; E.xp = d.xp || 0;
      E.missionIndex = d.missionIndex || 0;
      E.shells = d.shells || []; E.postcards = d.postcards || [];
      E.achievements = d.achievements || []; E.stats = d.stats || E.stats;
      E.onboarding = d.onboarding || 0;
      return true;
    } catch (e) { return false; }
  }
  function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
  function wipe() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
  return {
    data: E, shops: SHOPS, rank: rank, nextRank: nextRank,
    addCash: addCash, addXP: addXP, buyAt: buyAt, nearestShop: nearestShop,
    onBusted: onBusted, onWasted: onWasted, respawn: respawn,
    save: save, load: load, hasSave: hasSave, wipe: wipe, achievementsList: ACHIEVEMENTS
  };
})();
