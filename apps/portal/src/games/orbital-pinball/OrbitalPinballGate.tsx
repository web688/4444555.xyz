import { useEffect, useRef, useState } from "react";
import { recordPinballRun, type PinballRunResult } from "./progress";
import { createOrbitalPinballScene, type PinballRuntime, type PinballTelemetry } from "./scene";
import "./orbital-pinball.css";

type Props = { onExit: () => void };

type RecordedOutcome = { run: PinballRunResult; isNewBest: boolean };

const initialTelemetry: PinballTelemetry = {
  phase: "ready",
  score: 0,
  multiplier: 1,
  remaining: 180,
  ballsRemaining: 3,
  ballsPlayed: 0,
  bumperHits: 0,
  targetsCleared: 0,
  targetsLit: 0,
  relayLoops: 0,
  maxMultiplier: 1,
  charge: 0,
  routeKey: "",
  inputMode: "keyboard",
  callout: "",
  fps: 60,
};

export default function OrbitalPinballGate({ onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<PinballRuntime | null>(null);
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

    void createOrbitalPinballScene(canvas, (next) => {
      if (!cancelled) setTelemetry(next);
    }).then((runtime) => {
      if (cancelled) runtime.destroy();
      else {
        runtimeRef.current = runtime;
        setRuntimeReady(true);
      }
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "The pinball field could not start.");
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
    const runKey = `${telemetry.phase}:${telemetry.score}:${telemetry.ballsPlayed}:${telemetry.remaining}`;
    if (savedRunRef.current === runKey) return;
    savedRunRef.current = runKey;
    const recorded = recordPinballRun({
      routeKey: telemetry.routeKey,
      score: telemetry.score,
      completed: telemetry.phase === "complete",
      durationSeconds: 180 - telemetry.remaining,
      bumperHits: telemetry.bumperHits,
      targetsCleared: telemetry.targetsCleared,
      maxMultiplier: telemetry.maxMultiplier,
      ballsPlayed: telemetry.ballsPlayed,
      relayLoops: telemetry.relayLoops,
    });
    setOutcome({ run: recorded.run, isNewBest: recorded.isNewBest });
  }, [telemetry]);

  const beginRun = () => {
    savedRunRef.current = "";
    setOutcome(null);
    runtimeRef.current?.start();
    canvasRef.current?.focus();
  };
  const retry = () => {
    savedRunRef.current = "";
    setOutcome(null);
    runtimeRef.current?.restart();
    canvasRef.current?.focus();
  };
  const togglePause = () => {
    if (telemetry.phase === "paused") runtimeRef.current?.resume();
    else runtimeRef.current?.pause();
  };
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    runtimeRef.current?.setMuted(next);
  };
  const setLeft = (active: boolean) => runtimeRef.current?.setLeftFlipper(active);
  const setRight = (active: boolean) => runtimeRef.current?.setRightFlipper(active);
  const setLaunch = (active: boolean) => runtimeRef.current?.setLaunch(active);

  const ended = telemetry.phase === "complete" || telemetry.phase === "failed";
  const medal = outcome?.run.medal ?? "none";

  return (
    <section className="orbital-pinball" aria-label="Orbital Pinball visual prototype">
      <canvas
        ref={canvasRef}
        className="orbital-pinball-canvas"
        tabIndex={0}
        aria-label="Orbital Pinball. A or Left Arrow controls the left flipper, D or Right Arrow controls the right flipper, and Space charges and launches the ball."
      />
      <div className="orbital-pinball-vignette" aria-hidden="true" />

      <header className="orbital-pinball-hud top">
        <div className="orbital-pinball-identity">
          <span className="pinball-live-dot" />
          <b>ORBITAL PINBALL / PROTOTYPE 01</b>
          <small>FRAMELESS RELAY FIELD · DAILY SIGNAL {telemetry.routeKey || "SYNCING"}</small>
        </div>
        <div className="orbital-pinball-actions">
          <span>{telemetry.inputMode} · {telemetry.fps} fps</span>
          <button onClick={toggleMute}>{muted ? "Sound off" : "Sound on"}</button>
          {(telemetry.phase === "running" || telemetry.phase === "paused") && (
            <button onClick={togglePause}>{telemetry.phase === "paused" ? "Resume" : "Pause"}</button>
          )}
          <button className="orbital-pinball-close" onClick={onExit} aria-label="Exit Orbital Pinball">×</button>
        </div>
      </header>

      <aside className="orbital-pinball-score" aria-live="polite">
        <small>SIGNAL SCORE</small>
        <strong>{telemetry.score.toLocaleString("en-US").padStart(7, "0")}</strong>
        <span className={telemetry.multiplier > 1 ? "hot" : ""}>×{telemetry.multiplier} relay chain</span>
      </aside>

      <aside className="orbital-pinball-balls" aria-label={`${telemetry.ballsRemaining} balls remaining`}>
        <small>BALLS</small>
        <div>{[0, 1, 2].map((ball) => <i className={ball < telemetry.ballsRemaining ? "active" : ""} key={ball} />)}</div>
        <span>{telemetry.remaining.toString().padStart(3, "0")} SEC</span>
      </aside>

      <aside className="orbital-pinball-nodes">
        <small>RELAY NODES</small>
        <div>{[0, 1, 2, 3].map((node) => <i className={node < telemetry.targetsLit ? "active" : ""} key={node} />)}</div>
        <span>{telemetry.relayLoops.toString().padStart(2, "0")} loops</span>
      </aside>

      <div className={`orbital-pinball-callout ${telemetry.callout ? "visible" : ""}`} aria-live="polite">
        {telemetry.callout}
      </div>

      <div className="orbital-pinball-launch-meter" aria-hidden="true">
        <span>PLUNGER</span><i><b style={{ transform: `scaleX(${telemetry.charge})` }} /></i>
      </div>

      <div className="orbital-pinball-controls">
        <span>A / ←</span> left flipper <b>·</b> <span>D / →</span> right flipper <b>·</b> <span>HOLD SPACE</span> launch <b>·</b> <span>ESC</span> exit
      </div>

      <div className="orbital-pinball-touch" aria-label="Touch pinball controls">
        <button
          className="flipper left"
          onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setLeft(true); }}
          onPointerUp={() => setLeft(false)}
          onPointerCancel={() => setLeft(false)}
          onPointerLeave={() => setLeft(false)}
        >LEFT</button>
        <button
          className="launch"
          onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setLaunch(true); }}
          onPointerUp={() => setLaunch(false)}
          onPointerCancel={() => setLaunch(false)}
          onPointerLeave={() => setLaunch(false)}
        >LAUNCH</button>
        <button
          className="flipper right"
          onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setRight(true); }}
          onPointerUp={() => setRight(false)}
          onPointerCancel={() => setRight(false)}
          onPointerLeave={() => setRight(false)}
        >RIGHT</button>
      </div>

      {telemetry.phase === "ready" && (
        <div className="orbital-pinball-state ready">
          <p>DAILY SIGNAL {telemetry.routeKey || "CALIBRATING"}</p>
          <h2>Keep the relay alive.</h2>
          <div className="orbital-pinball-briefing">
            <span><b>3 BALLS</b> no safety net</span>
            <span><b>4 NODES</b> clear the bank for +5000</span>
            <span><b>×8</b> maximum relay chain</span>
          </div>
          <button onClick={beginRun} disabled={!runtimeReady}>{runtimeReady ? "Arm playfield" : "Calibrating…"}</button>
        </div>
      )}

      {telemetry.phase === "paused" && (
        <div className="orbital-pinball-state">
          <p>FIELD SUSPENDED</p><h2>Relay holding.</h2>
          <button onClick={() => runtimeRef.current?.resume()}>Resume</button>
        </div>
      )}

      {ended && (
        <div className={`orbital-pinball-state result ${telemetry.phase}`}>
          <p>{telemetry.phase === "complete" ? "SIGNAL WINDOW COMPLETE" : "ALL BALLS LOST"}</p>
          <h2>{telemetry.phase === "complete" ? "Relay stabilized." : "Relay went dark."}</h2>
          <div className={`orbital-pinball-medal ${medal}`}>
            <i />{medal === "none" ? "NO MEDAL" : `${medal.toUpperCase()} SIGNAL`}{outcome?.isNewBest && <em>NEW BEST</em>}
          </div>
          <div className="orbital-pinball-result-score"><span>Final score</span><strong>{telemetry.score.toLocaleString("en-US")}</strong></div>
          <div className="orbital-pinball-run-stats">
            <span><small>BUMPERS</small><strong>{telemetry.bumperHits}</strong></span>
            <span><small>TARGETS</small><strong>{telemetry.targetsCleared}</strong></span>
            <span><small>MAX CHAIN</small><strong>×{telemetry.maxMultiplier}</strong></span>
            <span><small>ORBIT LOOPS</small><strong>{telemetry.relayLoops}</strong></span>
          </div>
          <button onClick={retry}>Play again</button>
          <button className="secondary" onClick={onExit}>Return to arcade</button>
        </div>
      )}

      {error && (
        <div className="orbital-pinball-state error">
          <p>PLAYFIELD OFFLINE</p><h2>Unable to arm relay.</h2><span>{error}</span><button onClick={onExit}>Return to arcade</button>
        </div>
      )}

      <p className="orbital-pinball-disclaimer">Visual prototype · scores and recent runs remain on this device</p>
    </section>
  );
}
