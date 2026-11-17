// Keyboard + mouse input. WASD/arrows move and drive, mouse aims, click or Space
// shoots, E enters/exits a car, Shift runs, M toggles sound, Esc/P pauses.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_MUTE = 8;
export const ACTION_HONK = 16;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
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
  };
}
