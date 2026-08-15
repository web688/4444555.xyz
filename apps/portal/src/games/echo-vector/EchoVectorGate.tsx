import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createEchoVectorGame, type EchoTelemetry, type EchoVectorRuntime } from "./game.ts";
import "./echo-vector.css";
import "./echo-vector-contrast.css";

type Props = { onExit: () => void };

const initialTelemetry: EchoTelemetry = {
  phase: "ready",
  cycle: 1,
  totalCycles: 6,
  cycleSeconds: 30,
  remaining: 30,
  score: 0,
  coherence: 100,
  chain: 0,
  echoes: 0,
  phaseReady: true,
  cue: "MOVE · FOLLOW THE MARKED NODE",
  callout: "YOUR ROUTE WILL RETURN AS AN ECHO",
  instructionTitle: "THREE THINGS ONLY",
  instructionBody: "Move to the marked node. Phase when it turns bright blue. After 30 seconds, everything you did returns as a ghost.",
  playerTarget: 0,
  echoTarget: 0,
  nodeActivations: 0,
  echoAssists: 0,
  confluences: 0,
  duets: 0,
  trios: 0,
  choruses: 0,
  collisions: 0,
  maxChain: 0,
  echoEfficiency: 0,
};

export default function EchoVectorGate({ onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<EchoVectorRuntime | null>(null);
  const [telemetry, setTelemetry] = useState(initialTelemetry);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const [echoLessonSeen, setEchoLessonSeen] = useState(false);
  const [echoLessonOpen, setEchoLessonOpen] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    void createEchoVectorGame(canvas, (next) => {
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
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Echo Vector could not initialize.");
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

  useEffect(() => {
    if (telemetry.phase !== "running" || telemetry.cycle !== 2 || echoLessonSeen) return;
    setEchoLessonSeen(true);
    setEchoLessonOpen(true);
    runtimeRef.current?.pause();
  }, [telemetry.phase, telemetry.cycle, echoLessonSeen]);

  const togglePause = () => {
    if (telemetry.phase === "paused") runtimeRef.current?.resume();
    else runtimeRef.current?.pause();
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    runtimeRef.current?.setMuted(next);
  };

  const updateStick = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const max = Math.max(1, rect.width * 0.34);
    const distance = Math.hypot(dx, dy);
    const scale = distance > max ? max / distance : 1;
    const x = dx * scale;
    const y = dy * scale;
    setStick({ x, y });
    runtimeRef.current?.setVirtualMove(x / max, y / max);
  };

  const beginStick = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateStick(event);
  };

  const releaseStick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setStick({ x: 0, y: 0 });
    runtimeRef.current?.clearVirtualMove();
  };

  const phaseLabel = telemetry.phaseReady ? "PHASE" : "RECOVER";

  return (
    <div className="echo-gate" role="dialog" aria-label="Echo Vector game session">
      <canvas ref={canvasRef} className="echo-canvas" tabIndex={0} />
      <div className="echo-edge" aria-hidden="true" />

      <header className="echo-topbar">
        <div className="echo-score-block">
          <span>SCORE</span>
          <strong>{telemetry.score.toLocaleString("en-US").padStart(7, "0")}</strong>
          <small>{telemetry.chain > 1 ? `CHAIN ×${telemetry.chain}` : "SEQUENCE OPEN"}</small>
        </div>
        <div className="echo-session-actions">
          <button onClick={togglePause} disabled={!runtimeReady || telemetry.phase === "ready" || telemetry.phase === "complete" || telemetry.phase === "failed" || echoLessonOpen}>
            {telemetry.phase === "paused" ? "Resume" : "Pause"}
          </button>
          <button onClick={toggleMute}>{muted ? "Sound on" : "Mute"}</button>
          <button className="echo-close" onClick={onExit} aria-label="Exit Echo Vector">×</button>
        </div>
        <div className="echo-cycle-block">
          <span>CYCLE {telemetry.cycle} / {telemetry.totalCycles}</span>
          <strong>{Math.ceil(telemetry.remaining).toString().padStart(2, "0")}<i>s</i></strong>
          <div className="echo-coherence"><b style={{ width: `${telemetry.coherence}%` }} /><span>COHERENCE {telemetry.coherence}%</span></div>
        </div>
      </header>

      <div className={`echo-callout ${telemetry.callout ? "visible" : ""}`}>{telemetry.callout}</div>

      {telemetry.phase === "running" && !echoLessonOpen && (
        <aside className="echo-instruction" aria-live="polite">
          <strong>{telemetry.instructionTitle}</strong>
          <span>{telemetry.instructionBody}</span>
          <small>
            <b>WHITE</b> = YOU
            <i>·</i>
            <b>GHOST</b> = OLD YOU
            <i>·</i>
            <b>BRIGHT BLUE</b> = PHASE
          </small>
        </aside>
      )}

      <footer className="echo-sequence">
        <div className="echo-cycle-dots" aria-label={`Cycle ${telemetry.cycle} of ${telemetry.totalCycles}`}>
          {Array.from({ length: telemetry.totalCycles }, (_, index) => {
            const cycle = index + 1;
            return <i key={cycle} className={cycle < telemetry.cycle ? "recorded" : cycle === telemetry.cycle ? "current" : ""} />;
          })}
        </div>
        <div className="echo-cue"><span>WHAT TO DO NOW</span><strong>{telemetry.cue}</strong></div>
        <div className="echo-echo-count"><span>OLD ROUTES REPLAYING</span><strong>{telemetry.echoes}</strong></div>
      </footer>

      <div className="echo-touch-controls" aria-label="Echo Vector touch controls">
        <div
          className="echo-stick"
          onPointerDown={beginStick}
          onPointerMove={(event) => event.currentTarget.hasPointerCapture(event.pointerId) && updateStick(event)}
          onPointerUp={releaseStick}
          onPointerCancel={releaseStick}
        >
          <span style={{ transform: `translate(${stick.x}px, ${stick.y}px)` }} />
          <small>MOVE</small>
        </div>
        <button
          className={`echo-phase-button ${telemetry.phaseReady ? "ready" : ""}`}
          disabled={telemetry.phase !== "running"}
          onPointerDown={(event) => {
            event.preventDefault();
            runtimeRef.current?.pressPhase();
          }}
        >
          <span>{phaseLabel}</span>
          <small>WHEN NODE IS BLUE</small>
        </button>
      </div>

      {telemetry.phase === "ready" && (
        <section className="echo-state echo-ready">
          <p>THE WHOLE GAME IN 20 SECONDS</p>
          <h2>Echo Vector</h2>
          <div className="echo-simple-rule">Make a route now that becomes useful 30 seconds later.</div>
          <div className="echo-briefing">
            <span><b>1 · MOVE</b>Follow the marked line to the marked node.</span>
            <span><b>2 · PHASE</b>Stay inside its ring. When it turns bright blue, press Space.</span>
            <span><b>3 · USE YOUR ECHO</b>After 30 seconds, your entire route replays as a translucent ghost. Let it repeat old jobs while you take new ones.</span>
          </div>
          <button disabled={!runtimeReady} onClick={() => runtimeRef.current?.launch()}>Teach Me While I Play</button>
          <button className="secondary" onClick={onExit}>Return to Portal</button>
        </section>
      )}

      {echoLessonOpen && (
        <section className="echo-state echo-echo-lesson">
          <p>CYCLE 2 · THIS IS THE CORE MECHANIC</p>
          <h2>Your old self is now playing too.</h2>
          <div className="echo-lesson-diagram" aria-hidden="true">
            <span className="echo-lesson-you">YOU</span>
            <i>+</i>
            <span className="echo-lesson-ghost">GHOST</span>
            <i>=</i>
            <strong>TWO JOBS AT ONCE</strong>
          </div>
          <div className="echo-lesson-copy">
            The translucent shard is an exact replay of your first 30 seconds. You cannot steer it. If it returns to an old node, leave that job to the ghost and move your current shard to the new marked node. When both activate together, the score jumps.
          </div>
          <button onClick={() => {
            setEchoLessonOpen(false);
            runtimeRef.current?.resume();
          }}>Continue Cycle Two</button>
        </section>
      )}

      {telemetry.phase === "paused" && !echoLessonOpen && (
        <section className="echo-state echo-paused">
          <p>SIMULATION HELD</p>
          <h2>Temporal Pause</h2>
          <button onClick={() => runtimeRef.current?.resume()}>Resume Sequence</button>
          <button className="secondary" onClick={() => runtimeRef.current?.restart()}>Restart Run</button>
          <button className="secondary" onClick={onExit}>Exit to Portal</button>
        </section>
      )}

      {(telemetry.phase === "complete" || telemetry.phase === "failed") && (
        <section className={`echo-state echo-result ${telemetry.phase === "failed" ? "failed" : ""}`}>
          <p>{telemetry.phase === "complete" ? "TEMPORAL SCORE RESOLVED" : "COHERENCE COLLAPSED"}</p>
          <h2>{telemetry.phase === "complete" ? "Six-Cycle Sequence Complete" : "Sequence Broken"}</h2>
          <div className="echo-final-score"><span>FINAL SCORE</span><strong>{telemetry.score.toLocaleString("en-US")}</strong></div>
          <div className="echo-result-grid">
            <span><small>NODES</small><strong>{telemetry.nodeActivations}</strong></span>
            <span><small>ECHO ASSISTS</small><strong>{telemetry.echoAssists}</strong></span>
            <span><small>CONFLUENCE</small><strong>{telemetry.confluences}</strong></span>
            <span><small>MAX CHAIN</small><strong>×{telemetry.maxChain}</strong></span>
            <span><small>COHERENCE</small><strong>{telemetry.coherence}%</strong></span>
            <span><small>ECHO EFFICIENCY</small><strong>{telemetry.echoEfficiency}%</strong></span>
          </div>
          <div className="echo-ensemble">DUET {telemetry.duets} · TRIO {telemetry.trios} · CHORUS {telemetry.choruses}</div>
          <button onClick={() => runtimeRef.current?.restart()}>Replay Same Sequence</button>
          <button className="secondary" onClick={onExit}>Return to Portal</button>
        </section>
      )}

      {error && (
        <section className="echo-state echo-error">
          <p>RENDERER OFFLINE</p>
          <h2>Temporal Chamber Unavailable</h2>
          <span>{error}</span>
          <button onClick={onExit}>Return to Portal</button>
        </section>
      )}
    </div>
  );
}
