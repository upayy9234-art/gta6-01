// Solstice Heat — economy.js
// Money, XP ranks, shops and the persistent save. Cash is carried
// on the player and can be lost to fines and hospital bills; banked
// money is safe. XP climbs through five ranks from Runner to
// Kingpin. The save lives in localStorage and records cash, bank,
// XP, completed missions, finished jobs, collectibles and settings.
(function () {
  "use strict";
  window.SH = window.SH || {};

  var cfg = window.SH.config;
  var EC = cfg.ECONOMY;

  function defaultSave() {
    return {
      cash: EC.startCash,
      bank: EC.startBank,
      xp: 0,
      missionsDone: {},
      jobsDone: 0,
      racesWon: 0,
      shells: {},
      postcards: {},
      stunts: {},
      onboardingDone: false,
      radioStation: 0,
      playSeconds: 0
    };
  }

  var economy = {
    save: defaultSave(),
    loaded: false
  };

  function load() {
    try {
      var raw = window.localStorage.getItem(cfg.SAVE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        var fresh = defaultSave();
        var k;
        for (k in fresh) {
          if (parsed[k] !== undefined) {
            fresh[k] = parsed[k];
          }
        }
        economy.save = fresh;
      }
    } catch (err) {
      economy.save = defaultSave();
    }
    economy.loaded = true;
    return economy.save;
  }

  function persist() {
    try {
      window.localStorage.setItem(cfg.SAVE_KEY, JSON.stringify(economy.save));
    } catch (err) {
      // Storage may be unavailable (private mode); the game continues.
    }
  }

  function rankFor(xp) {
    var ranks = EC.ranks;
    var current = ranks[0];
    var index = 0;
    var i;
    for (i = 0; i < ranks.length; i++) {
      if (xp >= ranks[i].xp) {
        current = ranks[i];
        index = i;
      }
    }
    var next = ranks[index + 1] || null;
    return { rank: current, index: index, next: next };
  }

  function addXP(amount) {
    var before = rankFor(economy.save.xp).index;
    economy.save.xp += amount;
    var after = rankFor(economy.save.xp);
    if (after.index > before && window.SH.hud) {
      window.SH.hud.toast("Rank up: " + after.rank.name);
      if (window.SH.audio) {
        window.SH.audio.sfx.success();
      }
    }
    persist();
    return after;
  }

  function addCash(amount) {
    economy.save.cash = Math.max(0, economy.save.cash + amount);
    if (amount > 0 && window.SH.audio) {
      window.SH.audio.sfx.cash();
    }
    persist();
    return economy.save.cash;
  }

  function spendCash(amount) {
    if (economy.save.cash < amount) {
      return false;
    }
    economy.save.cash -= amount;
    persist();
    return true;
  }

  function depositAll() {
    economy.save.bank += economy.save.cash;
    economy.save.cash = 0;
    persist();
    if (window.SH.hud) {
      window.SH.hud.toast("Deposited. Bank: " + cfg.formatMoney(economy.save.bank));
    }
  }

  function buy(itemId, player) {
    var item = null;
    var i;
    for (i = 0; i < EC.shop.length; i++) {
      if (EC.shop[i].id === itemId) {
        item = EC.shop[i];
      }
    }
    if (!item) {
      return false;
    }
    if (item.kind === "deposit") {
      depositAll();
      return true;
    }
    if (!spendCash(item.price)) {
      if (window.SH.hud) {
        window.SH.hud.toast("Not enough cash for " + item.name);
      }
      if (window.SH.audio) {
        window.SH.audio.sfx.fail();
      }
      return false;
    }
    if (item.kind === "health") {
      player.heal(item.amount);
    } else if (item.kind === "armor") {
      player.addArmor(item.amount);
    } else if (item.kind === "ammo") {
      player.ammo += item.amount;
    } else if (item.kind === "repair") {
      if (player.car) {
        window.SH.vehicles.repair(player.car);
      } else if (window.SH.vehicles.playerCar) {
        window.SH.vehicles.repair(window.SH.vehicles.playerCar);
      }
    } else if (item.kind === "heat") {
      if (window.SH.police) {
        window.SH.police.heat = Math.max(0, window.SH.police.heat - item.amount);
      }
    }
    if (window.SH.hud) {
      window.SH.hud.toast("Bought: " + item.name);
    }
    if (window.SH.audio) {
      window.SH.audio.sfx.pickup();
    }
    persist();
    return true;
  }

  // Shop zones in the world: walking into one and pressing the shop
  // key cycles purchases; main.js routes the keypress here.
  var SHOP_ZONES = [
    { name: "Pier Kiosk", x: 28, z: 292, radius: 7 },
    { name: "Neon Armory", x: -14, z: 96, radius: 7 },
    { name: "Marina Garage", x: 150, z: 96, radius: 8 },
    { name: "Old Town Bodega", x: -150, z: 36, radius: 7 }
  ];

  function shopNear(pos) {
    var i;
    for (i = 0; i < SHOP_ZONES.length; i++) {
      var z = SHOP_ZONES[i];
      if (cfg.dist2d(pos.x, pos.z, z.x, z.z) < z.radius) {
        return z;
      }
    }
    return null;
  }

  var shopCursor = 0;
  function cycleShop(player) {
    var zone = shopNear(player.pos);
    if (!zone) {
      return false;
    }
    var item = EC.shop[shopCursor % EC.shop.length];
    shopCursor += 1;
    if (window.SH.hud) {
      window.SH.hud.prompt(zone.name + " — press B to buy " + item.name +
        " (" + cfg.formatMoney(item.price) + ")");
    }
    economy.pendingItem = item.id;
    return true;
  }

  function confirmShop(player) {
    if (economy.pendingItem) {
      var ok = buy(economy.pendingItem, player);
      economy.pendingItem = null;
      return ok;
    }
    return false;
  }

  function completeMission(mission) {
    economy.save.missionsDone[mission.id] = true;
    addCash(mission.reward);
    addXP(mission.xp);
    if (window.SH.missions && Object.keys(economy.save.missionsDone).length >= 1) {
      economy.save.onboardingDone = true;
    }
    persist();
  }

  function completeJob(job, reward, xp) {
    economy.save.jobsDone += 1;
    addCash(reward);
    addXP(xp);
    persist();
  }

  function onWasted(cause) {
    var bill = Math.min(economy.save.cash, EC.hospitalCost);
    economy.save.cash -= bill;
    if (window.SH.hud) {
      window.SH.hud.toast("Wasted — hospital bill " + cfg.formatMoney(bill));
    }
    persist();
  }

  function onBusted() {
    var fine = Math.floor(economy.save.cash * EC.bustFinePercent);
    economy.save.cash -= fine;
    if (window.SH.hud) {
      window.SH.hud.toast("Busted — fine " + cfg.formatMoney(fine));
    }
    if (window.SH.police) {
      window.SH.police.clearWanted("busted");
    }
    persist();
  }

  function tick(dt) {
    economy.save.playSeconds += dt;
  }

  economy.load = load;
  economy.persist = persist;
  economy.rankFor = rankFor;
  economy.addXP = addXP;
  economy.addCash = addCash;
  economy.spendCash = spendCash;
  economy.depositAll = depositAll;
  economy.buy = buy;
  economy.shopNear = shopNear;
  economy.cycleShop = cycleShop;
  economy.confirmShop = confirmShop;
  economy.completeMission = completeMission;
  economy.completeJob = completeJob;
  economy.onWasted = onWasted;
  economy.onBusted = onBusted;
  economy.tick = tick;
  economy.shopZones = SHOP_ZONES;
  economy.pendingItem = null;
  window.SH.economy = economy;
})();
