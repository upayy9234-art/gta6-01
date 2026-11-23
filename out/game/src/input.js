// input.js — keyboard and mouse state for the game.
// Tracks held keys, one-frame "pressed" edges, and the mouse position in
// screen space (the renderer converts it to world space for aiming).

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.enabled = true;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      const code = e.code;
      if (!this.keys.has(code)) this.pressed.add(code);
      this.keys.add(code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });

    if (canvas) {
      canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
        this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
      });
      canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
      });
      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) this.mouse.down = false;
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  // True only on the frame the key went down.
  hit(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  // Movement vector from WASD / arrows, normalised by the caller.
  moveVector() {
    let x = 0, y = 0;
    if (this.down('KeyA', 'ArrowLeft')) x -= 1;
    if (this.down('KeyD', 'ArrowRight')) x += 1;
    if (this.down('KeyW', 'ArrowUp')) y -= 1;
    if (this.down('KeyS', 'ArrowDown')) y += 1;
    return { x, y };
  }

  // Call at the very end of each frame.
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }

  // Test hooks: the headless integration test drives the game through these.
  press(code) {
    if (!this.keys.has(code)) this.pressed.add(code);
    this.keys.add(code);
  }

  release(code) {
    this.keys.delete(code);
  }

  clearAll() {
    this.keys.clear();
    this.pressed.clear();
  }
}
