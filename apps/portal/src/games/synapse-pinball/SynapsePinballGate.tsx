import { useEffect, useRef, useState } from "react";
import { recordPinballRun, type PinballRunResult } from "./progress";
import { createSynapsePinballScene, type PinballRuntime, type PinballTelemetry } from "./scene";
import "./synapse-pinball.css";

type Props = { onExit: () => void };

const initialTelemetry: PinballTelemetry = {
  phase: "ready",
  elapsed: 0,
  score: 0,
  multiplier: 1,
  ballsRemaining: 3,
  maxBalls: 3,
  speed: 0,
  bumperHits: 0,
  rampLoops: 0,
  maxMultiplier: 1,
  targetsCleared: 0,
  routeKey: "",
  fps: 60,
  callout: "QUANTUM MAINFRAME ONLINE — PULL PLUNGER TO LAUNCH",
  report: null,
};

type RecordedOutcome = { run: PinballRunResult; isNewBest: boolean };

export default function SynapsePinballGate({ onExit }: Props) {
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

    void createSynapsePinballScene(canvas, (next) => {
      if (!cancelled) setTelemetry(next);
    })
      .then((runtime) => {
        if (cancelled) runtime.destroy();
        else {
          runtimeRef.current = runtime;
          setRuntimeReady(true);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : "The 3D pinball engine could not start.",
          );
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
    if (telemetry.phase !== "complete") return;
    const runKey = `${telemetry.score}:${telemetry.bumperHits}:${telemetry.rampLoops}`;
    if (savedRunRef.current === runKey) return;
    savedRunRef.current = runKey;

    const recorded = recordPinballRun({
      routeKey: telemetry.routeKey,
      score: telemetry.score,
      completed: true,
      durationSeconds: Math.round(telemetry.elapsed),
      bumperHits: telemetry.bumperHits,
      rampLoops: telemetry.rampLoops,
      maxMultiplier: telemetry.maxMultiplier,
      ballsPlayed: telemetry.maxBalls - telemetry.ballsRemaining,
      targetsCleared: telemetry.targetsCleared,
    });
    setOutcome({ run: recorded.run, isNewBest: recorded.isNewBest });
  }, [telemetry]);

  const togglePause = () => {
    if (telemetry.phase === "paused") runtimeRef.current?.resume();
    else runtimeRef.current?.pause();
  };

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    runtimeRef.current?.setMuted(nextMuted);
  };

  const handleLaunch = () => {
    runtimeRef.current?.start();
  };

  const handleRetry = () => {
    setOutcome(null);
    savedRunRef.current = "";
    runtimeRef.current?.restart();
  };

  return (
    <div className="pinball-gate" role="dialog" aria-label="Synapse Pinball game session">
      <canvas className="pinball-canvas" ref={canvasRef} tabIndex={0} />
      <div className="pinball-vignette" />

      {/* Top HUD Header */}
      <header className="pinball-hud top">
        <div className="pinball-identity">
          <span className="pinball-live-dot" />
          <strong>SYNAPSE PINBALL</strong>
          <small>OPTICAL MAINFRAME 01</small>
        </div>
        <div className="pinball-actions">
          <button onClick={togglePause} disabled={!runtimeReady || telemetry.phase === "complete"}>
            {telemetry.phase === "paused" ? "Resume" : "Pause"}
          </button>
          <button onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>
          <button className="pinball-close" onClick={onExit} aria-label="Exit game">
            ×
          </button>
        </div>
      </header>

      {/* Score and Multiplier */}
      <div className="pinball-score">
        <small>MAINFRAME SCORE</small>
        <strong>{telemetry.score.toLocaleString("en-US")}</strong>
        <span>OVERCLOCK ×{telemetry.multiplier}</span>
      </div>

      {/* Balls Remaining Telemetry */}
      <div className="pinball-telemetry">
        <div className="pinball-balls-card">
          <small>PHOTONIC SPHERES</small>
          <i className={telemetry.ballsRemaining >= 1 ? "active" : ""} />
          <i className={telemetry.ballsRemaining >= 2 ? "active" : ""} />
          <i className={telemetry.ballsRemaining >= 3 ? "active" : ""} />
        </div>
      </div>

      {/* Dynamic Callout */}
      <div className={`pinball-callout ${telemetry.callout ? "visible" : ""}`}>
        {telemetry.callout}
      </div>

      {/* Touch Screen Controls for Mobile */}
      <div
        className="pinball-touch-zone left"
        onTouchStart={(e) => {
          e.preventDefault();
          runtimeRef.current?.setFlipperLeft(true);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          runtimeRef.current?.setFlipperLeft(false);
        }}
      >
        <span className="pinball-touch-btn">◀ FLIP L</span>
      </div>

      <div
        className="pinball-touch-zone right"
        onTouchStart={(e) => {
          e.preventDefault();
          runtimeRef.current?.setFlipperRight(true);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          runtimeRef.current?.setFlipperRight(false);
        }}
      >
        <span className="pinball-touch-btn">FLIP R ▶</span>
      </div>

      {telemetry.phase === "ready" && (
        <button
          className="pinball-plunger-touch"
          onTouchStart={(e) => {
            e.preventDefault();
            runtimeRef.current?.setPlunger(true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            runtimeRef.current?.setPlunger(false);
          }}
          onClick={handleLaunch}
        >
          PULL LAUNCH
        </button>
      )}

      {/* Bottom Bar Controls Guide */}
      <footer className="pinball-bottom-bar">
        <div>
          <span>FLIPPERS</span>: A / D or LEFT / RIGHT <b>·</b> <span>PLUNGER</span>: SPACE / DOWN <b>·</b> <span>NUDGE</span>: W / UP
        </div>
        <div>
          <span>BUMPERS</span>: {telemetry.bumperHits} <b>·</b> <span>RAMP LOOPS</span>: {telemetry.rampLoops}
        </div>
      </footer>

      {/* Ready / Briefing Modal */}
      {telemetry.phase === "ready" && telemetry.ballsRemaining === 3 && telemetry.score === 0 && (
        <section className="pinball-state ready">
          <p>OPTICAL MAINFRAME PROTOCOL</p>
          <h2>Synapse Pinball</h2>
          <div className="pinball-briefing">
            <span><b>01 / PRISM BUMPERS</b>Hit quartz prisms in sequence to build the Overclock multiplier.</span>
            <span><b>02 / FIBER RAMPS</b>Route photonic spheres through elevated light guides for loop bonuses.</span>
            <span><b>03 / QUANTUM CORE</b>Trap the ball inside the center magnetic well for high-score acceleration.</span>
          </div>
          <button onClick={handleLaunch}>Initiate Quantum Sequence</button>
          <button className="secondary" onClick={onExit}>Return to Portal</button>
        </section>
      )}

      {/* Paused Modal */}
      {telemetry.phase === "paused" && (
        <section className="pinball-state paused">
          <p>MAINFRAME CLOCK SUSPENDED</p>
          <h2>Session Paused</h2>
          <button onClick={togglePause}>Resume Execution</button>
          <button className="secondary" onClick={handleRetry}>Restart Session</button>
          <button className="secondary" onClick={onExit}>Exit to Portal</button>
        </section>
      )}

      {/* Game Over / Outcome Modal */}
      {telemetry.phase === "complete" && outcome && (
        <section className="pinball-state result">
          <p>SESSION ARCHIVED</p>
          <h2>Sequence Complete</h2>

          {outcome.run.medal !== "none" && (
            <div className={`pinball-medal ${outcome.run.medal}`}>
              <i />
              <span>{outcome.run.medal.toUpperCase()} MEDAL AWARDED</span>
            </div>
          )}

          <div className="pinball-score-card">
            <span>FINAL MAINFRAME SCORE</span>
            <strong>{outcome.run.score.toLocaleString("en-US")}</strong>
            {outcome.isNewBest && (
              <small style={{ color: "#00f0a8", display: "block", marginTop: "4px" }}>
                NEW LOCAL BEST RECORD!
              </small>
            )}
          </div>

          <div className="pinball-run-stats">
            <span><small>BUMPERS</small><strong>{outcome.run.bumperHits}</strong></span>
            <span><small>RAMP LOOPS</small><strong>{outcome.run.rampLoops}</strong></span>
            <span><small>MAX MULTIPLIER</small><strong>×{outcome.run.maxMultiplier}</strong></span>
            <span><small>LOGIC GATES</small><strong>{outcome.run.targetsCleared}</strong></span>
          </div>

          <button onClick={handleRetry}>Launch Next Session</button>
          <button className="secondary" onClick={onExit}>Return to Portal</button>
        </section>
      )}

      {/* Error Modal */}
      {error && (
        <section className="pinball-state error">
          <p>INITIALIZATION ERROR</p>
          <h2>Signal Lost</h2>
          <span>{error}</span>
          <button onClick={onExit}>Return to Portal</button>
        </section>
      )}
    </div>
  );
}
