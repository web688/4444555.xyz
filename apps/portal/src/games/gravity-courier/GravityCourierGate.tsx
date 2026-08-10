import { useEffect, useRef, useState } from "react";
import { recordCourierRun, type CourierRunResult } from "./progress";
import { createGravityCourierScene, type GateRuntime, type GateTelemetry } from "./scene";
import "./gravity-courier.css";

type Props = { onExit: () => void };

const initialTelemetry: GateTelemetry = {
  phase: "ready",
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
  steerX: 0,
  steerY: 0,
  steering: false,
  remaining: 120,
  sector: 1,
  nearMisses: 0,
  collisions: 0,
  maxMultiplier: 1,
  routeKey: "",
  report: null,
};

type RecordedOutcome = { run: CourierRunResult; isNewBest: boolean };

export default function GravityCourierGate({ onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<GateRuntime | null>(null);
  const savedRunRef = useRef("");
  const [telemetry, setTelemetry] = useState(initialTelemetry);
  const [outcome, setOutcome] = useState<RecordedOutcome | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
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
      else {
        runtimeRef.current = runtime;
        setRuntimeReady(true);
      }
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

  useEffect(() => {
    if (telemetry.phase !== "complete" && telemetry.phase !== "failed") return;
    const runKey = `${telemetry.report?.runNumber ?? 0}:${telemetry.phase}`;
    if (savedRunRef.current === runKey) return;
    savedRunRef.current = runKey;
    const recorded = recordCourierRun({
      routeKey: telemetry.routeKey,
      score: telemetry.score,
      completed: telemetry.phase === "complete",
      durationSeconds: Math.round(telemetry.elapsed),
      integrity: telemetry.integrity,
      nearMisses: telemetry.nearMisses,
      collisions: telemetry.collisions,
      maxMultiplier: telemetry.maxMultiplier,
      sector: telemetry.sector,
    });
    setOutcome({ run: recorded.run, isNewBest: recorded.isNewBest });
  }, [telemetry]);

  const togglePause = () => {
    if (telemetry.phase === "paused") runtimeRef.current?.resume();
    else runtimeRef.current?.pause();
  };
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    runtimeRef.current?.setMuted(next);
  };
  const beginRun = () => {
    runtimeRef.current?.start();
    canvasRef.current?.focus();
  };
  const retry = () => {
    setOutcome(null);
    runtimeRef.current?.restart();
    canvasRef.current?.focus();
  };

  const ended = telemetry.phase === "complete" || telemetry.phase === "failed";
  const medal = outcome?.run.medal ?? (telemetry.phase === "complete" ? "bronze" : "none");

  return (
    <section className="courier-gate" aria-label="Gravity Courier production flight">
      <canvas ref={canvasRef} className="courier-canvas" tabIndex={0} aria-label="Gravity Courier. Use WASD or arrow keys to steer and Space to boost." />
      <div className="courier-vignette" aria-hidden="true" />
      <header className="courier-hud top">
        <div className="courier-identity"><span className="live-dot" /> <b>PRODUCTION FLIGHT 01</b><small>GRAVITY COURIER / DAILY ROUTE {telemetry.routeKey || "SYNCING"}</small></div>
        <div className="courier-actions">
          <span className={`input-pill ${telemetry.steering ? "active" : ""}`}>{telemetry.inputMode}{telemetry.steering ? " · steering" : ""}</span>
          <span className={`quality-pill ${telemetry.quality}`}>{telemetry.quality} · {telemetry.fps} fps</span>
          <button onClick={toggleMute}>{muted ? "Sound off" : "Sound on"}</button>
          {(telemetry.phase === "running" || telemetry.phase === "paused") && <button onClick={togglePause}>{telemetry.phase === "paused" ? "Resume" : "Pause"}</button>}
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
        <div><span>SECTOR {telemetry.sector} / 4</span><span>{telemetry.remaining.toString().padStart(3, "0")} SEC</span><span>RELAY</span></div>
        <div className="route-track"><i style={{ transform: `scaleX(${telemetry.progress})` }} /></div>
      </div>

      <div className="courier-datum" aria-hidden="true" />
      <div className={`courier-flight-vector ${telemetry.steering ? "active" : ""}`} style={{ left: `${50 + telemetry.steerX * 24}%`, top: `${50 - telemetry.steerY * 18}%` }} aria-hidden="true"><i /><i /><span>VECTOR</span></div>
      <div className={`courier-callout ${telemetry.callout ? "visible" : ""}`} aria-live="polite">{telemetry.callout}</div>

      <div className="courier-controls"><span>WASD / ARROWS</span> steer <b>·</b> <span>DRAG / STICK</span> analog steer <b>·</b> <span>SPACE / A / TRIGGER</span> boost <b>·</b> <span>ESC</span> exit</div>

      {telemetry.phase === "ready" && (
        <div className="courier-state ready">
          <p>DAILY ROUTE {telemetry.routeKey || "CALIBRATING"}</p>
          <h2>Deliver the signal.</h2>
          <div className="courier-briefing">
            <span><b>120 SEC</b> four escalating sectors</span>
            <span><b>3 HULL</b> collision ends the chain</span>
            <span><b>×12</b> near-miss multiplier</span>
          </div>
          <button onClick={beginRun} disabled={!runtimeReady}>{runtimeReady ? "Launch courier" : "Calibrating…"}</button>
        </div>
      )}

      {telemetry.phase === "paused" && (
        <div className="courier-state"><p>ROUTE SUSPENDED</p><h2>Holding orbit.</h2><button onClick={() => runtimeRef.current?.resume()}>Resume flight</button></div>
      )}

      {ended && (
        <div className={`courier-state result ${telemetry.phase}`}>
          <p>{telemetry.phase === "complete" ? "RELAY REACHED" : `SIGNAL LOST · SECTOR ${telemetry.sector}`}</p>
          <h2>{telemetry.phase === "complete" ? "Transmission delivered." : "Courier destroyed."}</h2>
          <div className={`courier-medal ${medal}`}><i />{medal === "none" ? "NO MEDAL" : `${medal.toUpperCase()} DELIVERY`}{outcome?.isNewBest && <em>NEW BEST</em>}</div>
          <div className="courier-result-score"><span>Final score</span><strong>{telemetry.score.toLocaleString("en-US")}</strong></div>
          <div className="courier-run-stats">
            <span><small>NEAR MISSES</small><strong>{telemetry.nearMisses}</strong></span>
            <span><small>MAX CHAIN</small><strong>×{telemetry.maxMultiplier}</strong></span>
            <span><small>COLLISIONS</small><strong>{telemetry.collisions}</strong></span>
            <span><small>FLIGHT TIME</small><strong>{Math.round(telemetry.elapsed)}S</strong></span>
          </div>
          <button onClick={retry}>Fly again</button>
          <button className="secondary" onClick={onExit}>Return to arcade</button>
        </div>
      )}

      {error && (
        <div className="courier-state error"><p>RENDERER OFFLINE</p><h2>Unable to enter orbit.</h2><span>{error}</span><button onClick={onExit}>Return to arcade</button></div>
      )}

      <p className="gate-disclaimer">Production gameplay batch 01 · daily route and progress are stored on this device</p>
    </section>
  );
}
