// Solstice Heat: Neon Tide — input.js
// Keyboard + mouse state with held / pressed-this-frame queries.
window.SH = window.SH || {};
SH.input = (function () {
  'use strict';
  var held = {}, pressed = {}, released = {};
  var mouse = { x: 0, y: 0, dx: 0, dy: 0, down: false, clicked: false, rightDown: false };
  var GAME_CODES = ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyE','KeyF','KeyR','KeyM','KeyP'];
  function init() {
    window.addEventListener('keydown', function (e) {
      if (GAME_CODES.indexOf(e.code) >= 0) e.preventDefault();
      if (!held[e.code]) pressed[e.code] = true;
      held[e.code] = true;
    });
    window.addEventListener('keyup', function (e) {
      held[e.code] = false; released[e.code] = true;
      if (GAME_CODES.indexOf(e.code) >= 0) e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0;
      mouse.x = e.clientX; mouse.y = e.clientY;
    });
    window.addEventListener('mousedown', function (e) {
      if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
      if (e.button === 2) mouse.rightDown = true;
    });
    window.addEventListener('mouseup', function (e) {
      if (e.button === 0) mouse.down = false;
      if (e.button === 2) mouse.rightDown = false;
    });
    window.addEventListener('blur', function () { held = {}; mouse.down = false; });
    window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  function anyHeld(codes) { for (var i = 0; i < codes.length; i++) if (held[codes[i]]) return true; return false; }
  function anyPressed(codes) { for (var i = 0; i < codes.length; i++) if (pressed[codes[i]]) return true; return false; }
  var K = SH.config.KEYS;
  var api = {
    init: init, mouse: mouse,
    isHeld: function (code) { return !!held[code]; },
    wasPressed: function (code) { return !!pressed[code]; },
    forward: function () { return anyHeld(K.forward); },
    back: function () { return anyHeld(K.back); },
    left: function () { return anyHeld(K.left); },
    right: function () { return anyHeld(K.right); },
    sprint: function () { return anyHeld(K.sprint); },
    handbrake: function () { return anyHeld(K.handbrake); },
    interactPressed: function () { return anyPressed(K.interact); },
    actionHeld: function () { return anyHeld(K.action) || mouse.down; },
    actionPressed: function () { return anyPressed(K.action) || mouse.clicked; },
    reloadPressed: function () { return anyPressed(K.reload); },
    radioPressed: function () { return anyPressed(K.radio); },
    photoPressed: function () { return anyPressed(K.photo); },
    pausePressed: function () { return anyPressed(K.pause); },
    endFrame: function () { pressed = {}; released = {}; mouse.clicked = false; mouse.dx = 0; mouse.dy = 0; }
  };
  return api;
})();
