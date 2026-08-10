import { useEffect, useRef, useState } from "react";
import { createGravityCourierScene, type GateRuntime, type GateTelemetry } from "./scene";
import "./gravity-courier.css";

type Props = { onExit: () => void };

const initialTelemetry: GateTelemetry = {
  phase: "running",
  elapsed: 0,
  progress: 0,
  score: 0,
  multiplier: 1,
  speed: 0,
  integrity: 3,
  quality: "balanced",
  fps: 60,
  inputMode: "keyboard",
  callout: "",
};

export default function GravityCourierGate({ onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<GateRuntime | null>(null);
  const [telemetry, setTelemetry] = useState(initialTelemetry);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let cancelled = false;

    void createGravityCourierScene(canvas, (next) => {
      if (!cancelled) setTelemetry(next);
    }).then((runtime) => {
      if (cancelled) runtime.destroy();
      else runtimeRef.current = runtime;
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "The 3D scene could not start.");
    });

    const onEscape = (event: KeyboardEvent) => {
      if (event.code === "Escape") onExit();
    };
    window.addEventListener("keydown", onEscape);
    canvas.focus();
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onEscape);
      runtimeRef.current?.destroy();
      runtimeRef.current = null;
      document.body.style.overflow = previousOverflow;
    };
  }, [onExit]);

  const togglePause = () => {
    if (telemetry.phase === "paused") runtimeRef.current?.resume();
    else runtimeRef.current?.pause();
  };
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    runtimeRef.current?.setMuted(next);
  };

  return (
    <section className="courier-gate" aria-label="Gravity Courier visual quality gate">
      <canvas ref={canvasRef} className="courier-canvas" tabIndex={0} aria-label="Interactive orbital flight scene. Use WASD or arrow keys to steer and Space to boost." />
      <div className="courier-vignette" aria-hidden="true" />
      <header className="courier-hud top">
        <div className="courier-identity"><span className="live-dot" /> <b>VISUAL GATE 01</b><small>GRAVITY COURIER / ORBITAL LANE 04</small></div>
        <div className="courier-actions">
          <span className="input-pill">{telemetry.inputMode}</span>
          <span className={`quality-pill ${telemetry.quality}`}>{telemetry.quality} · {telemetry.fps} fps</span>
          <button onClick={toggleMute}>{muted ? "Sound off" : "Sound on"}</button>
          <button onClick={togglePause}>{telemetry.phase === "paused" ? "Resume" : "Pause"}</button>
          <button className="courier-close" onClick={onExit} aria-label="Exit Gravity Courier">×</button>
        </div>
      </header>

      <div className="courier-score" aria-live="polite">
        <small>ROUTE SCORE</small><strong>{telemetry.score.toLocaleString("en-US").padStart(7, "0")}</strong>
        <span className={telemetry.multiplier > 1 ? "hot" : ""}>×{telemetry.multiplier} chain</span>
      </div>

      <div className="courier-speed"><small>VELOCITY</small><strong>{telemetry.speed}</strong><span>KM/S</span></div>

      <div className="courier-integrity" aria-label={`Courier integrity ${telemetry.integrity} of 3`}>
        <small>HULL</small>{[0, 1, 2].map((slot) => <i className={slot < telemetry.integrity ? "active" : ""} key={slot} />)}
      </div>

      <div className="courier-route">
        <div><span>LAUNCH</span><span>{Math.ceil(30 - telemetry.elapsed).toString().padStart(2, "0")} SEC</span><span>RELAY</span></div>
        <div className="route-track"><i style={{ transform: `scaleX(${telemetry.progress})` }} /></div>
      </div>

      <div className="courier-reticle" aria-hidden="true"><i /><i /></div>
      <div className={`courier-callout ${telemetry.callout ? "visible" : ""}`} aria-live="polite">{telemetry.callout}</div>

      <div className="courier-controls"><span>WASD / ARROWS / STICK</span> steer <b>·</b> <span>SPACE / A / TRIGGER</span> boost <b>·</b> <span>ESC</span> exit</div>

      {telemetry.phase === "paused" && (
        <div className="courier-state"><p>ROUTE SUSPENDED</p><h2>Holding orbit.</h2><button onClick={() => runtimeRef.current?.resume()}>Resume flight</button></div>
      )}

      {telemetry.phase === "complete" && (
        <div className="courier-state complete"><p>RELAY REACHED</p><h2>Transmission delivered.</h2><div><span>Final score</span><strong>{telemetry.score.toLocaleString("en-US")}</strong></div><button onClick={() => runtimeRef.current?.restart()}>Fly again</button><button className="secondary" onClick={onExit}>Return to arcade</button></div>
      )}

      {error && (
        <div className="courier-state error"><p>RENDERER OFFLINE</p><h2>Unable to enter orbit.</h2><span>{error}</span><button onClick={onExit}>Return to arcade</button></div>
      )}

      <p className="gate-disclaimer">Interactive visual candidate · not a final game · performance approval pending physical-device review</p>
    </section>
  );
}
