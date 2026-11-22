// Hands: the keyboard state and the mouse, read by main.js every frame.
// Movement is a held state (direction + sneak); menu actions are edges,
// queued when they happen and handed over once by takeActions, so a key
// pressed between frames is never lost and never fires twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const MOVE_KEYS = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
  KeyW: [0, -1],
  KeyS: [0, 1],
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let pointer = null;
  let pointerDown = false;

  window.addEventListener('keydown', (event) => {
    if (MOVE_KEYS[event.code] || event.code === 'Space') event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());

  function toField(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }
  canvas.addEventListener('pointermove', (event) => { pointer = toField(event); });
  canvas.addEventListener('pointerdown', (event) => {
    pointer = toField(event);
    pointerDown = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { pointerDown = false; });

  return {
    /** The held movement as {dx, dy, sneak}: keys first, the held mouse as a fallback. */
    direction(playerScreen) {
      let dx = 0;
      let dy = 0;
      for (const code of held) {
        const move = MOVE_KEYS[code];
        if (move) {
          dx += move[0];
          dy += move[1];
        }
      }
      if (dx !== 0 || dy !== 0) {
        return { dx, dy, sneak: held.has('ShiftLeft') || held.has('ShiftRight') };
      }
      if (pointerDown && pointer && playerScreen) {
        const vx = pointer.x - playerScreen.x;
        const vy = pointer.y - playerScreen.y;
        if (Math.hypot(vx, vy) > 14) return { dx: vx, dy: vy, sneak: false };
      }
      return { dx: 0, dy: 0, sneak: held.has('ShiftLeft') || held.has('ShiftRight') };
    },
    /** The pointer's position in canvas pixels, or null before it moves. */
    pointer() {
      return pointer;
    },
    /** The queued ACTION_* edges since the last call; clears the queue. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
