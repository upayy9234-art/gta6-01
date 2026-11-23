// Solstice Heat - economy: cash, bank, XP ranks, stats, shop, save/load.
window.SH = window.SH || {};
(function (SH) {
  'use strict';
  var U = SH.U, C = SH.Config;
  var E = {
    cash: 120, bank: 0, xp: 0, upgrades: {}, stats: { earned: 0, spent: 0, jobsDone: 0, racesWon: 0, missionsDone: 0, shells: 0, stunts: 0, postcards: 0, busts: 0, wasted: 0 },
    shellsFound: [], postcardsFound: [], missionsDoneList: []
  };
  SH.Economy = E;
  E.rankIdx = function () { var r = 0; for (var i = 0; i < C.RANKS.length; i++) if (E.xp >= C.RANKS[i].xp) r = i; return r; };
  E.rank = function () { return C.RANKS[E.rankIdx()]; };
  E.nextRank = function () { return C.RANKS[E.rankIdx() + 1] || null; };
  E.addCash = function (amt, why) {
    E.cash += amt; E.stats.earned += Math.max(0, amt);
    // A slice of every payout is banked automatically.
    if (amt > 100) { var dep = Math.floor(amt * 0.25); E.cash -= dep; E.bank += dep; }
    if (SH.HUD && amt !== 0) SH.HUD.rewardPopup((amt > 0 ? '+' : '') + U.fmtMoney(amt) + (why ? ' - ' + why : ''));
    if (SH.Audio && amt > 0) SH.Audio.cash();
  };
  E.spend = function (amt) {
    if (E.cash < amt) { if (SH.HUD) SH.HUD.centerMsg('Not enough cash', 1.4); return false; }
    E.cash -= amt; E.stats.spent += amt; return true;
  };
  E.addXP = function (amt) {
    var before = E.rankIdx(); E.xp += amt;
    if (E.rankIdx() > before && SH.HUD) { SH.HUD.centerMsg('Rank up: ' + E.rank().name + '!', 2.6); if (SH.Audio) SH.Audio.collect(); }
  };
  E.hasUpgrade = function (id) { return !!E.upgrades[id]; };
  E.buy = function (item) {
    if (item.id !== 'medkit' && item.id !== 'ammo' && E.upgrades[item.id]) { if (SH.HUD) SH.HUD.centerMsg('Already owned', 1.3); return false; }
    if (!E.spend(item.price)) return false;
    if (item.id === 'medkit') SH.Player.heal(50);
    else if (item.id === 'ammo') SH.Player.ammo += 12;
    else if (item.id === 'shirt') SH.Player.setShirt(SH.Player.shirtIdx + 1);
    else if (item.id === 'paint' && SH.Player.car) { SH.Player.car.mesh.children[0].material = new THREE.MeshLambertMaterial({ color: SH.U ? 0xff2e88 : 0xff2e88 }); }
    else E.upgrades[item.id] = true;
    if (SH.HUD) SH.HUD.centerMsg('Bought: ' + item.name, 1.6);
    return true;
  };
  E.save = function () {
    try {
      var p = SH.Player.pos();
      localStorage.setItem(C.SAVE_KEY, JSON.stringify({
        cash: E.cash, bank: E.bank, xp: E.xp, upgrades: E.upgrades, stats: E.stats,
        shellsFound: E.shellsFound, postcardsFound: E.postcardsFound, missionsDoneList: E.missionsDoneList,
        x: p.x, z: p.z, ammo: SH.Player.ammo, shirt: SH.Player.shirtIdx
      }));
    } catch (e) { /* private mode */ }
  };
  E.load = function () {
    try {
      var raw = localStorage.getItem(C.SAVE_KEY); if (!raw) return false;
      var d = JSON.parse(raw);
      E.cash = d.cash; E.bank = d.bank; E.xp = d.xp; E.upgrades = d.upgrades || {};
      E.stats = d.stats || E.stats; E.shellsFound = d.shellsFound || []; E.postcardsFound = d.postcardsFound || [];
      E.missionsDoneList = d.missionsDoneList || [];
      if (typeof d.x === 'number') { SH.Player.x = d.x; SH.Player.z = d.z; }
      if (typeof d.ammo === 'number') SH.Player.ammo = d.ammo;
      if (typeof d.shirt === 'number') SH.Player.setShirt(d.shirt);
      return true;
    } catch (e) { return false; }
  };
  E.resetSave = function () { try { localStorage.removeItem(C.SAVE_KEY); } catch (e) {} };
})(window.SH);
