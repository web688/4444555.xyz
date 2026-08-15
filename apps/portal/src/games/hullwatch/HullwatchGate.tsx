import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createHullwatchScene, type HullwatchRuntime, type HullwatchTelemetry } from "./scene";
import "./hullwatch.css";

type Props = { onExit: () => void };

const initialTelemetry: HullwatchTelemetry = {
  phase: "ready",
  score: 0,
  hull: 100,
  heat: 0,
  overheat: false,
  remaining: 90,
  wave: 1,
  kills: 0,
  intercepts: 0,
  accuracy: 100,
  combo: 1,
  threats: 0,
  lock: null,
  inputMode: "mouse",
  callout: "",
};

export default function HullwatchGate({ onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<HullwatchRuntime | null>(null);
  const [telemetry, setTelemetry] = useState(initialTelemetry);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    void createHullwatchScene(canvas, (next) => {
      if (!cancelled) setTelemetry(next);
    })
      .then((runtime) => {
        if (cancelled) runtime.destroy();
        else {
          runtimeRef.current = runtime;
          setRuntimeReady(true);
          canvas.focus();
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Hullwatch could not initialize.");
      });

    const onEscape = (event: KeyboardEvent) => {
      if (event.code === "Escape") onExit();
    };
    window.addEventListener("keydown", onEscape);

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

  const setFire = (active: boolean) => runtimeRef.current?.setFire(active);
  const firePointer = (active: boolean, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (active) event.currentTarget.setPointerCapture(event.pointerId);
    else if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setFire(active);
  };

  const phaseCanPause = telemetry.phase === "running" || telemetry.phase === "paused";
  const threatTone = telemetry.hull <= 35 ? "critical" : telemetry.hull <= 65 ? "warn" : "stable";

  return (
    <div className={`hullwatch-gate ${threatTone}`} role="dialog" aria-label="Hullwatch gunner station">
      <canvas ref={canvasRef} className="hullwatch-canvas" tabIndex={0} />
      <div className="hullwatch-scanline" aria-hidden="true" />

      <header className="hullwatch-topbar">
        <div className="hullwatch-score">
          <span>DEFENSE SCORE</span>
          <strong>{telemetry.score.toLocaleString("en-US").padStart(7, "0")}</strong>
          <small>{telemetry.combo > 1 ? `COMBAT CHAIN ×${telemetry.combo}` : `${telemetry.kills} KILLS · ${telemetry.intercepts} INTERCEPTS`}</small>
        </div>

        <div className="hullwatch-mission">
          <span>ESCORT CORRIDOR</span>
          <strong>WAVE {telemetry.wave} / 3</strong>
          <b>{Math.ceil(telemetry.remaining).toString().padStart(2, "0")}<i>s</i></b>
        </div>

        <div className="hullwatch-hull">
          <span>CAPITAL HULL</span>
          <strong>{telemetry.hull}%</strong>
          <div><b style={{ width: `${telemetry.hull}%` }} /></div>
        </div>
      </header>

      <div className="hullwatch-actions">
        <button disabled={!phaseCanPause} onClick={togglePause}>{telemetry.phase === "paused" ? "Resume" : "Pause"}</button>
        <button onClick={toggleMute}>{muted ? "Sound on" : "Mute"}</button>
        <button className="close" onClick={onExit} aria-label="Exit Hullwatch">×</button>
      </div>

      <div className={`hullwatch-reticle ${telemetry.lock ? "locked" : ""} ${telemetry.overheat ? "disabled" : ""}`} aria-hidden="true">
        <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" /><b />
        {telemetry.lock && <span>{telemetry.lock}</span>}
      </div>

      <div className={`hullwatch-callout ${telemetry.callout ? "visible" : ""}`}>{telemetry.callout}</div>

      <aside className="hullwatch-weapon">
        <div className="weapon-title"><span>TWIN KINETIC ARRAY</span><strong>{telemetry.overheat ? "THERMAL LOCK" : "ARMED"}</strong></div>
        <div className="heat-track"><b style={{ width: `${telemetry.heat}%` }} /></div>
        <div className="weapon-meta"><span>HEAT {telemetry.heat}%</span><span>ACC {telemetry.accuracy}%</span><span>{telemetry.inputMode.toUpperCase()}</span></div>
      </aside>

      <aside className="hullwatch-threats">
        <span>CONTACTS</span>
        <strong>{telemetry.threats.toString().padStart(2, "0")}</strong>
        <small>{telemetry.lock ? `TRACKING ${telemetry.lock}` : "NO FIRE SOLUTION"}</small>
      </aside>

      <button
        className="hullwatch-mobile-fire"
        disabled={telemetry.phase !== "running" || telemetry.overheat}
        onPointerDown={(event) => firePointer(true, event)}
        onPointerUp={(event) => firePointer(false, event)}
        onPointerCancel={(event) => firePointer(false, event)}
      >
        <span>FIRE</span><small>HOLD</small>
      </button>

      {telemetry.phase === "ready" && (
        <section className="hullwatch-state hullwatch-ready">
          <p>DORSAL DEFENSE STATION / CARRIER 07</p>
          <h2>Hullwatch</h2>
          <h3>The carrier flies itself. You defend it.</h3>
          <div className="hullwatch-briefing">
            <span><b>AIM</b>Move the mouse, use WASD/arrows, right stick, or drag on touch.</span>
            <span><b>FIRE</b>Hold mouse, Space, A/RT, or the mobile fire control.</span>
            <span><b>PRIORITY</b>Destroy orange torpedoes first. Bombers launch them. Do not let strike craft cross the hull.</span>
          </div>
          <button className="primary" disabled={!runtimeReady} onClick={() => runtimeRef.current?.start()}>Take the gun</button>
          <button className="secondary" onClick={onExit}>Return to arcade</button>
        </section>
      )}

      {telemetry.phase === "paused" && (
        <section className="hullwatch-state compact">
          <p>DEFENSE STATION SAFE</p>
          <h2>Combat paused</h2>
          <button className="primary" onClick={() => runtimeRef.current?.resume()}>Resume fire</button>
          <button className="secondary" onClick={() => runtimeRef.current?.restart()}>Restart escort</button>
          <button className="secondary" onClick={onExit}>Exit to arcade</button>
        </section>
      )}

      {(telemetry.phase === "complete" || telemetry.phase === "failed") && (
        <section className={`hullwatch-state result ${telemetry.phase === "failed" ? "failed" : ""}`}>
          <p>{telemetry.phase === "complete" ? "ESCORT CORRIDOR CLEARED" : "CARRIER LOST"}</p>
          <h2>{telemetry.phase === "complete" ? "Defense complete" : "Hull integrity zero"}</h2>
          <div className="hullwatch-final-score"><span>FINAL SCORE</span><strong>{telemetry.score.toLocaleString("en-US")}</strong></div>
          <div className="hullwatch-result-grid">
            <span><small>FIGHTERS / BOMBERS</small><strong>{telemetry.kills}</strong></span>
            <span><small>TORPEDO INTERCEPTS</small><strong>{telemetry.intercepts}</strong></span>
            <span><small>ACCURACY</small><strong>{telemetry.accuracy}%</strong></span>
            <span><small>HULL REMAINING</small><strong>{telemetry.hull}%</strong></span>
          </div>
          <button className="primary" onClick={() => runtimeRef.current?.restart()}>Run the escort again</button>
          <button className="secondary" onClick={onExit}>Return to arcade</button>
        </section>
      )}

      {error && (
        <section className="hullwatch-state failed">
          <p>DEFENSE STATION OFFLINE</p>
          <h2>Renderer unavailable</h2>
          <span>{error}</span>
          <button className="secondary" onClick={onExit}>Return to arcade</button>
        </section>
      )}
    </div>
  );
}
