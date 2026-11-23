// Solstice Heat — hud.js
// All 2D interface: health/armour/bust bars, cash and bank readouts,
// wanted stars, rank line, mission banner, prompts, toasts, the radio
// readout, photo-mode frame and the canvas minimap with blips for the
// player, police, traffic, the mission marker and collectibles.
(function () {
  "use strict";
  window.SH = window.SH || {};

  var cfg = window.SH.config;

  var hud = {
    els: {},
    toastTimer: 0,
    promptText: "",
    minimapCtx: null,
    ready: false
  };

  function el(id) {
    return document.getElementById(id);
  }

  function init() {
    hud.els.title = el("hud-district");
    hud.els.clock = el("hud-clock");
    hud.els.cash = el("hud-cash");
    hud.els.bank = el("hud-bank");
    hud.els.stars = el("hud-stars");
    hud.els.rank = el("hud-rank");
    hud.els.health = el("health-fill");
    hud.els.armor = el("armor-fill");
    hud.els.bust = el("bust-fill");
    hud.els.missionTitle = el("mission-title");
    hud.els.missionText = el("mission-text");
    hud.els.missionSub = el("mission-sub");
    hud.els.prompt = el("hud-prompt");
    hud.els.toast = el("hud-toast");
    hud.els.speed = el("hud-speed");
    hud.els.ammo = el("hud-ammo");
    hud.els.radio = el("hud-radio");
    hud.els.photo = el("photo-frame");
    hud.els.overlay = el("overlay");
    hud.els.overlayTitle = el("overlay-title");
    hud.els.overlayText = el("overlay-text");
    var minimap = el("minimap");
    if (minimap) {
      hud.minimapCtx = minimap.getContext("2d");
    }
    hud.ready = true;
  }

  function setBar(element, value) {
    if (!element) {
      return;
    }
    var pct = cfg.clamp(value, 0, 100);
    element.style.width = pct + "%";
  }

  function starString(stars) {
    var out = "";
    var i;
    for (i = 0; i < 5; i++) {
      out += i < stars ? "★" : "☆";
    }
    return out;
  }

  function toast(text) {
    if (!hud.els.toast) {
      return;
    }
    hud.els.toast.textContent = text;
    hud.els.toast.style.display = "block";
    hud.toastTimer = 4.2;
  }

  function prompt(text) {
    hud.promptText = text;
    if (hud.els.prompt) {
      hud.els.prompt.textContent = text;
      hud.els.prompt.style.display = "block";
    }
  }

  function clearPrompt() {
    hud.promptText = "";
    if (hud.els.prompt) {
      hud.els.prompt.style.display = "none";
    }
  }

  function setMission(title, text, sub) {
    if (hud.els.missionTitle) {
      hud.els.missionTitle.textContent = title || "";
    }
    if (hud.els.missionText) {
      hud.els.missionText.textContent = text || "";
    }
    if (hud.els.missionSub && sub !== undefined) {
      hud.els.missionSub.textContent = sub || "";
    }
  }

  function setSub(text) {
    if (hud.els.missionSub) {
      hud.els.missionSub.textContent = text || "";
    }
  }

  function showOverlay(title, text) {
    if (hud.els.overlay) {
      hud.els.overlay.style.display = "flex";
    }
    if (hud.els.overlayTitle) {
      hud.els.overlayTitle.textContent = title;
    }
    if (hud.els.overlayText) {
      hud.els.overlayText.textContent = text;
    }
  }

  function hideOverlay() {
    if (hud.els.overlay) {
      hud.els.overlay.style.display = "none";
    }
  }

  function setPhotoMode(on) {
    if (hud.els.photo) {
      hud.els.photo.style.display = on ? "block" : "none";
    }
  }

  function update(dt, state) {
    if (!hud.ready) {
      return;
    }
    var player = state.player;
    var eco = window.SH.economy;
    var police = window.SH.police;
    var weather = window.SH.weather;

    hud.toastTimer -= dt;
    if (hud.toastTimer <= 0 && hud.els.toast) {
      hud.els.toast.style.display = "none";
    }

    setBar(hud.els.health, player.health);
    setBar(hud.els.armor, player.armor);
    setBar(hud.els.bust, police ? police.bust : 0);

    if (eco) {
      hud.els.cash.textContent = cfg.formatMoney(eco.save.cash);
      hud.els.bank.textContent = "Bank " + cfg.formatMoney(eco.save.bank);
      var rankInfo = eco.rankFor(eco.save.xp);
      var rankLine = "Rank " + (rankInfo.index + 1) + " · " + rankInfo.rank.name +
        " · " + eco.save.xp + " XP";
      if (rankInfo.next) {
        rankLine += " · next at " + rankInfo.next.xp;
      }
      hud.els.rank.textContent = rankLine;
    }
    if (police) {
      hud.els.stars.textContent = starString(police.stars);
    }
    var focus = player.focusPos();
    var district = cfg.districtAt(focus.x, focus.z);
    hud.els.title.textContent = player.isSwimming() ? "Solstice Bay — Open Water" : district.name;
    if (weather) {
      hud.els.clock.textContent = cfg.formatClock(weather.hour) + " · " + weather.label();
    }
    if (player.state === "car") {
      hud.els.speed.textContent = Math.round(Math.abs(player.speedNow) * 3.6) + " km/h";
      hud.els.ammo.textContent = player.car ?
        "Car health " + Math.round(player.car.health) + "%" : "";
    } else {
      hud.els.speed.textContent = "";
      hud.els.ammo.textContent = "Pistol ammo " + player.ammo;
    }
    var radioState = window.SH.audio ? window.SH.audio.radioState : null;
    if (radioState && radioState.playing) {
      var st = window.SH.audio.stations[radioState.station];
      hud.els.radio.textContent = "♪ " + st.name + " — " + st.genre;
    } else {
      hud.els.radio.textContent = "Radio off · M to tune";
    }
    drawMinimap(state);
  }

  function worldToMap(x, z, w, h) {
    var W = cfg.WORLD;
    var mx = ((x + W.width / 2 + 60) / (W.width + 120)) * w;
    var mz = ((z + W.depth / 2 + 40) / (W.depth + 190)) * h;
    return { x: mx, y: mz };
  }

  function blip(ctx, x, z, w, h, color, size) {
    var p = worldToMap(x, z, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
  }

  function drawMinimap(state) {
    var ctx = hud.minimapCtx;
    if (!ctx) {
      return;
    }
    var canvas = ctx.canvas;
    var w = canvas.width;
    var h = canvas.height;
    ctx.fillStyle = "#0d1a26";
    ctx.fillRect(0, 0, w, h);

    // Roads.
    ctx.strokeStyle = "rgba(200,210,220,0.35)";
    ctx.lineWidth = 2;
    var i;
    var W = cfg.WORLD;
    for (i = 0; i <= W.blocksX; i++) {
      var x = -W.width / 2 + i * W.blockSize;
      var a = worldToMap(x, -W.depth / 2, w, h);
      var b = worldToMap(x, W.depth / 2 + 60, w, h);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (i = 0; i <= W.blocksZ; i++) {
      var z = -W.depth / 2 + i * W.blockSize;
      var c = worldToMap(-W.width / 2, z, w, h);
      var d = worldToMap(W.width / 2, z, w, h);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }
    // Sea band.
    var seaTop = worldToMap(0, W.beachZ + 20, w, h);
    ctx.fillStyle = "rgba(40,110,160,0.7)";
    ctx.fillRect(0, seaTop.y, w, h - seaTop.y);

    // Collectibles.
    var eco = window.SH.economy;
    if (eco) {
      var shells = window.SH.activities ? window.SH.activities.shells : [];
      for (i = 0; i < shells.length; i++) {
        if (shells[i].mesh.visible) {
          blip(ctx, shells[i].def.x, shells[i].def.z, w, h, "#ffb7d5", 2);
        }
      }
    }
    // Traffic.
    var traffic = window.SH.vehicles ? window.SH.vehicles.traffic : [];
    for (i = 0; i < traffic.length; i++) {
      blip(ctx, traffic[i].pos.x, traffic[i].pos.z, w, h, "#c0c6ce", 3);
    }
    // Police.
    var police = window.SH.police;
    if (police) {
      for (i = 0; i < police.cars.length; i++) {
        blip(ctx, police.cars[i].pos.x, police.cars[i].pos.z, w, h, "#3f8fe0", 4);
      }
      for (i = 0; i < police.officers.length; i++) {
        blip(ctx, police.officers[i].pos.x, police.officers[i].pos.z, w, h, "#7ab5ff", 3);
      }
    }
    // Mission / objective marker.
    var marker = window.SH.missions ? window.SH.missions.marker : null;
    if (marker && marker.visible) {
      var mp = worldToMap(marker.position.x, marker.position.z, w, h);
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    var player = state.player;
    var focus = player.focusPos();
    var pp = worldToMap(focus.x, focus.z, w, h);
    ctx.save();
    ctx.translate(pp.x, pp.y);
    ctx.rotate(-player.heading);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  hud.init = init;
  hud.update = update;
  hud.toast = toast;
  hud.prompt = prompt;
  hud.clearPrompt = clearPrompt;
  hud.setMission = setMission;
  hud.setSub = setSub;
  hud.showOverlay = showOverlay;
  hud.hideOverlay = hideOverlay;
  hud.setPhotoMode = setPhotoMode;
  hud.starString = starString;
  window.SH.hud = hud;
})();
