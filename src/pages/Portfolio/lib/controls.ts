export interface ControlState {
  moveDir: { x: number; z: number };
  interact: boolean;
  handbrake: boolean;
}

const held = new Set<string>();
let interactJustPressed = false;
export const resetControls = () => { held.clear(); interactJustPressed = false; };

const movementCodes = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
]);

const keyHandler = (down: boolean) => (e: KeyboardEvent) => {
  if (down && e.target instanceof HTMLElement && (e.target.matches("input, textarea, select") || e.target.isContentEditable)) return;
  const code = e.code;

  if (code === "KeyE" && down && !e.repeat) {
    interactJustPressed = true;
  }

  if (movementCodes.has(code)) {
    e.preventDefault();
    if (down) {
      held.add(code);
    } else {
      held.delete(code);
    }
  }
};

export const bindControls = (): (() => void) => {
  const reset = resetControls;
  reset();
  const onDown = keyHandler(true);
  const onUp = keyHandler(false);

  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  window.addEventListener("blur", reset);

  return () => {
    window.removeEventListener("keydown", onDown);
    window.removeEventListener("keyup", onUp);
    window.removeEventListener("blur", reset);
    reset();
  };
};

export const pollControls = (): ControlState => {
  let mx = 0;
  let mz = 0;

  if (held.has("KeyW") || held.has("ArrowUp")) {
    mz -= 1;
  }

  if (held.has("KeyS") || held.has("ArrowDown")) {
    mz += 1;
  }

  if (held.has("KeyA") || held.has("ArrowLeft")) {
    mx -= 1;
  }

  if (held.has("KeyD") || held.has("ArrowRight")) {
    mx += 1;
  }

  const len = Math.sqrt(mx * mx + mz * mz);

  const interact = interactJustPressed;
  interactJustPressed = false;

  return {
    moveDir: len > 0 ? { x: mx / len, z: mz / len } : { x: 0, z: 0 },
    interact,
    handbrake: held.has("Space"),
  };
};
