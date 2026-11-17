// Keyboard + mouse input. WASD/arrows move and drive, mouse aims, click or Space
// shoots, E enters/exits a car, Shift runs (and fires the nitro while driving),
// M toggles sound, Esc/P pauses, G opens the garage, digits 1–9 buy in the
// garage or switch between owned guns (1–4).
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_MUTE = 8;
export const ACTION_HONK = 16;
export const ACTION_GARAGE = 32;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let lastDigit = 0;
  let mouseX = 640, mouseY = 360, mouseDown = false;

  window.addEventListener('keydown', (event) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (!event.repeat) {
      if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
      if (event.code === 'Escape' || event.code === 'KeyP') actions |= ACTION_PAUSE;
      if (event.code === 'KeyE') actions |= ACTION_ENTER_CAR;
      if (event.code === 'KeyM') actions |= ACTION_MUTE;
      if (event.code === 'KeyH') actions |= ACTION_HONK;
      if (event.code === 'KeyG') actions |= ACTION_GARAGE;
      // Digit keys 1–9: garage purchases while the garage is open, gun
      // switching (1–4) while playing. Only the latest press is kept.
      if (/^Digit[1-9]$/.test(event.code)) lastDigit = Number(event.code.slice(5));
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left; mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left; mouseY = event.clientY - rect.top;
    mouseDown = true; actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });

  return {
    moveX() { return (this._right() ? 1 : 0) - (this._left() ? 1 : 0); },
    _left() { return [...keys].some((k) => LEFT.has(k)); },
    _right() { return [...keys].some((k) => RIGHT.has(k)); },
    up() { return [...keys].some((k) => UP.has(k)); },
    down() { return [...keys].some((k) => DOWN.has(k)); },
    left() { return [...keys].some((k) => LEFT.has(k)); },
    right() { return [...keys].some((k) => RIGHT.has(k)); },
    run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    shooting() { return mouseDown || keys.has('Space'); },
    mouse() { return { x: mouseX, y: mouseY }; },
    takeActions() { const taken = actions; actions = 0; return taken; },
    takeDigit() { const d = lastDigit; lastDigit = 0; return d; },
  };
}
