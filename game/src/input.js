// Keyboard + mouse input. WASD/arrows move and drive, mouse aims, click or Space
// shoots, E enters/exits a car (or opens a shop when one is near, or picks up
// a waiting taxi passenger — shop first, then taxi, then car), Shift runs
// (and fires the nitro while driving), M toggles sound, R changes the radio
// station, Esc/P pauses, G opens the garage, digits 1–9 buy in the garage or
// shop or switch between owned guns (1–4).
// One-shot actions (confirm, pause, enter, mute, honk, garage, radio) are
// latched into a bitmask and drained with takeActions(); held keys are read
// live with up()/down()/left()/right()/run()/shooting(). Digits keep only the
// latest press, drained with takeDigit().
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_MUTE = 8;
export const ACTION_HONK = 16;
export const ACTION_GARAGE = 32;
export const ACTION_RADIO = 64;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);

const SCROLL_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let lastDigit = 0;
  let mouseX = 640;
  let mouseY = 360;
  let mouseDown = false;

  function hasAny(set) {
    for (const k of keys) if (set.has(k)) return true;
    return false;
  }

  window.addEventListener('keydown', (event) => {
    if (SCROLL_KEYS.includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    else if (event.code === 'Escape' || event.code === 'KeyP') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyE') actions |= ACTION_ENTER_CAR;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else if (event.code === 'KeyH') actions |= ACTION_HONK;
    else if (event.code === 'KeyG') actions |= ACTION_GARAGE;
    else if (event.code === 'KeyR') actions |= ACTION_RADIO;
    // Digit keys 1–9: garage purchases while the garage is open, shop
    // purchases while a shop is open, gun switching (1–4) while playing.
    // Only the latest press is kept.
    else if (/^Digit[1-9]$/.test(event.code)) lastDigit = Number(event.code.slice(5));
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });

  function trackMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  }
  canvas.addEventListener('pointermove', trackMouse);
  canvas.addEventListener('pointerdown', (event) => {
    trackMouse(event);
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });

  return {
    moveX() { return (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0); },
    up() { return hasAny(UP); },
    down() { return hasAny(DOWN); },
    left() { return hasAny(LEFT); },
    right() { return hasAny(RIGHT); },
    run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    shooting() { return mouseDown || keys.has('Space'); },
    mouse() { return { x: mouseX, y: mouseY }; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeDigit() {
      const d = lastDigit;
      lastDigit = 0;
      return d;
    },
  };
}
