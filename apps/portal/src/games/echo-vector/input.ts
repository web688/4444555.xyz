import type { InputFrame } from "./rules.ts";

export type EchoInputController = {
  readFrame: (playerX: number, playerY: number) => InputFrame;
  setVirtualMove: (x: number, y: number) => void;
  pressPhase: () => void;
  clearVirtualMove: () => void;
  destroy: () => void;
};

type Point = { x: number; y: number };

const MOVEMENT_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

export function createEchoInput(canvas: HTMLCanvasElement): EchoInputController {
  const keys = new Set<string>();
  let phaseQueued = false;
  let virtualX = 0;
  let virtualY = 0;
  let pointerTarget: Point | null = null;
  let pointerInside = false;
  let gamepadPhaseHeld = false;

  const queuePhase = () => {
    phaseQueued = true;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (MOVEMENT_KEYS.has(event.code)) {
      keys.add(event.code);
      event.preventDefault();
    }
    if (event.code === "Space") {
      if (!event.repeat) queuePhase();
      event.preventDefault();
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (MOVEMENT_KEYS.has(event.code)) {
      keys.delete(event.code);
      event.preventDefault();
    }
  };

  const setPointerTarget = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    pointerTarget = {
      x: ((event.clientX - rect.left) / rect.width) * 1000,
      y: ((event.clientY - rect.top) / rect.height) * 620,
    };
    pointerInside = true;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse") {
      setPointerTarget(event);
      queuePhase();
      canvas.focus();
    }
  };

  const onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType === "mouse") pointerInside = false;
  };

  const clearAll = () => {
    keys.clear();
    virtualX = 0;
    virtualY = 0;
    pointerTarget = null;
    pointerInside = false;
    phaseQueued = false;
    gamepadPhaseHeld = false;
  };

  const onVisibility = () => {
    if (document.hidden) clearAll();
  };

  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp, { passive: false });
  window.addEventListener("blur", clearAll);
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("pointermove", setPointerTarget);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerleave", onPointerLeave);

  return {
    readFrame(playerX, playerY) {
      let moveX = 0;
      let moveY = 0;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) moveX -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) moveX += 1;
      if (keys.has("KeyW") || keys.has("ArrowUp")) moveY -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) moveY += 1;

      if (virtualX !== 0 || virtualY !== 0) {
        moveX = virtualX;
        moveY = virtualY;
      }

      const gamepad = navigator.getGamepads?.()[0];
      if (gamepad) {
        const axisX = gamepad.axes[0] ?? 0;
        const axisY = gamepad.axes[1] ?? 0;
        const deadzone = 0.16;
        if (Math.hypot(axisX, axisY) > deadzone) {
          moveX = axisX;
          moveY = axisY;
        }
        const gamepadPhasePressed = Boolean(gamepad.buttons[0]?.pressed || gamepad.buttons[7]?.pressed);
        if (gamepadPhasePressed && !gamepadPhaseHeld) queuePhase();
        gamepadPhaseHeld = gamepadPhasePressed;
      } else {
        gamepadPhaseHeld = false;
      }

      if (moveX === 0 && moveY === 0 && pointerInside && pointerTarget) {
        const dx = pointerTarget.x - playerX;
        const dy = pointerTarget.y - playerY;
        const distance = Math.hypot(dx, dy);
        if (distance > 14) {
          moveX = dx / distance;
          moveY = dy / distance;
        }
      }

      const phasePressed = phaseQueued;
      phaseQueued = false;
      return { moveX, moveY, phasePressed };
    },
    setVirtualMove(x, y) {
      virtualX = Math.max(-1, Math.min(1, x));
      virtualY = Math.max(-1, Math.min(1, y));
    },
    pressPhase() {
      queuePhase();
    },
    clearVirtualMove() {
      virtualX = 0;
      virtualY = 0;
    },
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearAll);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointermove", setPointerTarget);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      clearAll();
    },
  };
}
