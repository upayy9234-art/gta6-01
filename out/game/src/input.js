// input.js — keyboard and mouse state for the game. Tracks three things:
// keys held down, keys pressed this frame (edge-triggered, for E to enter a
// car or Enter to start), and the mouse with its aim position on screen.

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function onKeyDown(e) {
    if (e.repeat) return;
    held.add(e.code);
    pressed.add(e.code);
    // Keep the page from scrolling or tabbing away mid-chase.
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  }
  function onKeyUp(e) {
    held.delete(e.code);
  }
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  }
  function onMouseDown(e) {
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  }
  function onMouseUp(e) {
    if (e.button === 0) mouse.down = false;
  }
  function onBlur() {
    held.clear();
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    mouse,
    down: (code) => held.has(code),
    hit: (code) => pressed.has(code),
    // Call once at the end of each frame so edge presses live exactly a frame.
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}

// A movement vector from WASD/arrows: x right, y down, not normalised — the
// caller decides how to treat diagonals.
export function moveVector(input) {
  let x = 0;
  let y = 0;
  if (input.down('KeyA') || input.down('ArrowLeft')) x -= 1;
  if (input.down('KeyD') || input.down('ArrowRight')) x += 1;
  if (input.down('KeyW') || input.down('ArrowUp')) y -= 1;
  if (input.down('KeyS') || input.down('ArrowDown')) y += 1;
  return { x, y };
}
