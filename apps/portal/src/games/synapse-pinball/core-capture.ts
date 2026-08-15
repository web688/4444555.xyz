export const CORE_CAPTURE_RADIUS = 1.7;
export const CORE_REARM_RADIUS = 2.1;
export const CORE_HOLD_SECONDS = 1.2;

export type CoreCaptureState = {
  armed: boolean;
  holdRemaining: number;
};

export type CoreCaptureStep = {
  state: CoreCaptureState;
  captured: boolean;
  released: boolean;
  holding: boolean;
  holdProgress: number;
};

export function createCoreCaptureState(): CoreCaptureState {
  return { armed: true, holdRemaining: 0 };
}

export function stepCoreCapture(
  previous: CoreCaptureState,
  distanceToCore: number,
  deltaSeconds: number,
): CoreCaptureStep {
  let armed = previous.armed;
  let holdRemaining = previous.holdRemaining;

  if (!armed && holdRemaining <= 0 && distanceToCore >= CORE_REARM_RADIUS) {
    armed = true;
  }

  const captured = armed && holdRemaining <= 0 && distanceToCore < CORE_CAPTURE_RADIUS;
  if (captured) {
    armed = false;
    holdRemaining = CORE_HOLD_SECONDS;
  }

  const holding = holdRemaining > 0;
  if (holding) {
    holdRemaining = Math.max(0, holdRemaining - Math.max(0, deltaSeconds));
  }

  const released = holding && holdRemaining === 0;

  return {
    state: { armed, holdRemaining },
    captured,
    released,
    holding,
    holdProgress: holding ? 1 - holdRemaining / CORE_HOLD_SECONDS : 0,
  };
}
