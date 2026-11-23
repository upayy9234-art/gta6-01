// input.js — keyboard and mouse state, polled by the game loop. Edge presses
// ("just pressed") latch for exactly one frame so prompts and menus feel exact,
// and the mouse position is kept in the game's fixed 1280x720 view space.

const held = new Set();
const pressed = new Set();
let mouseX = 640;
let mouseY = 360;
let mouseDown = false;
let mouseClicked = false;

export const VIEW_W = 1280;
export const VIEW_H = 720;

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => { held.clear(); mouseDown = false; });
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    mouseY = ((e.clientY - rect.top) / rect.height) * VIEW_H;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouseDown = true; mouseClicked = true; }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Called at the very end of each frame by the loop.
export function endFrame() {
  pressed.clear();
  mouseClicked = false;
}

export const down = (...codes) => codes.some((c) => held.has(c));
export const justPressed = (...codes) => codes.some((c) => pressed.has(c));
export const mouse = () => ({ x: mouseX, y: mouseY, down: mouseDown, clicked: mouseClicked });

// The four movement directions as one normalised vector, from WASD or arrows.
export function moveVector() {
  let x = 0;
  let y = 0;
  if (down('KeyA', 'ArrowLeft')) x -= 1;
  if (down('KeyD', 'ArrowRight')) x += 1;
  if (down('KeyW', 'ArrowUp')) y -= 1;
  if (down('KeyS', 'ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  return { x, y };
}
