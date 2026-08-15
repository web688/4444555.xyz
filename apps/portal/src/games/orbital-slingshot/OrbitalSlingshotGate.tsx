import { useEffect, useRef, useState } from "react";
import { recordSlingshotRun, type SlingshotRunResult } from "./progress";
import { createOrbitalSlingshotScene, type SlingshotRuntime, type SlingshotTelemetry } from "./scene";
import "./orbital-slingshot.css";

type Props = { onExit: () => void };

const initialTelemetry: SlingshotTelemetry = {
  phase: "ready",
  elapsed: 0,
  score: 0,
  multiplier: 1,
  speed: 0,
  gForce: 0,
  fuel: 3,
  sector: 1,
  beaconsCollected: 0,
  totalBeacons: 13,
  slingshots: 0,
  maxMultiplier: 1,
  routeKey: "",
  fps: 60,
  callout: "SECTOR 1: KEPLERIAN OUTPOST — SET TRAJECTORY",
  report: null,
};

type RecordedOutcome = { run: SlingshotRunResult; isNewBest: boolean };

export default function OrbitalSlingshotGate({ onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<SlingshotRuntime | null>(null);
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

    void createOrbitalSlingshotScene(canvas, (next) => {
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
            reason instanceof Error ? reason.message : "The orbital simulation could not start.",
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
    if (telemetry.phase !== "complete" && telemetry.phase !== "failed") return;
    const runKey = `${telemetry.sector}:${telemetry.score}:${telemetry.phase}`;
    if (savedRunRef.current === runKey) return;
    savedRunRef.current = runKey;

    const recorded = recordSlingshotRun({
      routeKey: telemetry.routeKey,
      score: telemetry.score,
      completed: telemetry.phase === "complete",
      durationSeconds: Math.round(telemetry.elapsed),
      beaconsCollected: telemetry.beaconsCollected,
      slingshots: telemetry.slingshots,
      maxMultiplier: telemetry.maxMultiplier,
      sectorsCompleted: telemetry.phase === "complete" ? 4 : telemetry.sector - 1,
      fuelRemaining: telemetry.fuel,
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
    runtimeRef.current?.launch();
  };

  const handleRetry = () => {
    setOutcome(null);
    savedRunRef.current = "";
    runtimeRef.current?.restart();
  };

  const fireBurn = (dx: number, dy: number) => {
    runtimeRef.current?.fireThruster(dx, dy);
  };

  return (
    <div className="slingshot-gate" role="dialog" aria-label="Orbital Slingshot game session">
      <canvas className="slingshot-canvas" ref={canvasRef} tabIndex={0} />
      <div className="slingshot-vignette" />

      {/* Top HUD Header */}
      <header className="slingshot-hud top">
        <div className="slingshot-identity">
          <span className="slingshot-live-dot" />
          <strong>ORBITAL SLINGSHOT</strong>
          <small>SECTOR {telemetry.sector} / 4</small>
        </div>
        <div className="slingshot-actions">
          <button onClick={togglePause} disabled={!runtimeReady || telemetry.phase === "complete" || telemetry.phase === "failed"}>
            {telemetry.phase === "paused" ? "Resume" : "Pause"}
          </button>
          <button onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>
          <button className="slingshot-close" onClick={onExit} aria-label="Exit game">
            ×
          </button>
        </div>
      </header>

      {/* Score and Multiplier */}
      <div className="slingshot-score">
        <small>MISSION SCORE</small>
        <strong>{telemetry.score.toLocaleString("en-US")}</strong>
        <span>SLINGSHOT ×{telemetry.multiplier}</span>
      </div>

      {/* Telemetry Display */}
      <div className="slingshot-telemetry">
        <div className="slingshot-speed-card">
          <small>PROBE VELOCITY</small>
          <div>
            <strong>{telemetry.speed}</strong>
            <span>KM/S</span>
          </div>
        </div>
        <div className="slingshot-fuel">
          <small>MICRO-BURNS</small>
          <i className={telemetry.fuel >= 1 ? "active" : ""} />
          <i className={telemetry.fuel >= 2 ? "active" : ""} />
          <i className={telemetry.fuel >= 3 ? "active" : ""} />
        </div>
      </div>

      {/* Dynamic Callout Message */}
      <div className={`slingshot-callout ${telemetry.callout ? "visible" : ""}`}>
        {telemetry.callout}
      </div>

      {/* Touch Micro-Burn Controls (In flight) */}
      {telemetry.phase === "flight" && (
        <div className="slingshot-touch-controls" aria-label="Micro-thruster burns">
          <button className="up" onClick={() => fireBurn(0, -1)} aria-label="Burn Up">▲</button>
          <button className="left" onClick={() => fireBurn(-1, 0)} aria-label="Burn Left">◀</button>
          <button className="right" onClick={() => fireBurn(1, 0)} aria-label="Burn Right">▶</button>
          <button className="down" onClick={() => fireBurn(0, 1)} aria-label="Burn Down">▼</button>
        </div>
      )}

      {/* Bottom Bar: Sector Progress & Controls Guide */}
      <footer className="slingshot-bottom-bar">
        <div>
          <span>AIM</span>: DRAG / MOUSE <b>·</b> <span>LAUNCH</span>: SPACE / CLICK <b>·</b> <span>BURST</span>: WASD
        </div>
        <div className="slingshot-sector-progress">
          <small>SECTOR</small>
          <i className={telemetry.sector === 1 ? "current" : telemetry.sector > 1 ? "passed" : ""}>1</i>
          <i className={telemetry.sector === 2 ? "current" : telemetry.sector > 2 ? "passed" : ""}>2</i>
          <i className={telemetry.sector === 3 ? "current" : telemetry.sector > 3 ? "passed" : ""}>3</i>
          <i className={telemetry.sector === 4 ? "current" : telemetry.sector > 4 ? "passed" : ""}>4</i>
        </div>
      </footer>

      {/* Ready / Briefing Modal */}
      {telemetry.phase === "ready" && (
        <section className="slingshot-state ready">
          <p>DAILY FLIGHT PROTOCOL</p>
          <h2>Orbital Slingshot</h2>
          <div className="slingshot-briefing">
            <span><b>01 / AIM & LAUNCH</b>Drag trajectory line or adjust with WASD, then press Launch.</span>
            <span><b>02 / SLINGSHOT</b>Pass close to celestial bodies without crashing for exponential multipliers.</span>
            <span><b>03 / DOCK</b>Collect data nodes and insert probe into the extraction wormhole.</span>
          </div>
          <button onClick={handleLaunch}>Initiate Launch Sequence</button>
          <button className="secondary" onClick={onExit}>Return to Portal</button>
        </section>
      )}

      {/* Paused Modal */}
      {telemetry.phase === "paused" && (
        <section className="slingshot-state paused">
          <p>SIMULATION SUSPENDED</p>
          <h2>Flight Paused</h2>
          <button onClick={togglePause}>Resume Trajectory</button>
          <button className="secondary" onClick={handleRetry}>Restart Mission</button>
          <button className="secondary" onClick={onExit}>Exit to Portal</button>
        </section>
      )}

      {/* Mission Complete / Failed Outcome Modal */}
      {(telemetry.phase === "complete" || telemetry.phase === "failed") && outcome && (
        <section className={`slingshot-state result ${telemetry.phase === "failed" ? "failed" : ""}`}>
          <p>{telemetry.phase === "complete" ? "SURVEY SUCCESSFUL" : "TRAJECTORY TERMINATED"}</p>
          <h2>{telemetry.phase === "complete" ? "Mission Complete" : "Hull Failure"}</h2>

          {outcome.run.medal !== "none" && (
            <div className={`slingshot-medal ${outcome.run.medal}`}>
              <i />
              <span>{outcome.run.medal.toUpperCase()} MEDAL AWARDED</span>
            </div>
          )}

          <div className="slingshot-score-card">
            <span>FINAL SCORE</span>
            <strong>{outcome.run.score.toLocaleString("en-US")}</strong>
            {outcome.isNewBest && <small style={{ color: "#00f0a8", display: "block" }}>NEW LOCAL BEST RECORD!</small>}
          </div>

          <div className="slingshot-run-stats">
            <span><small>SECTORS</small><strong>{outcome.run.sectorsCompleted} / 4</strong></span>
            <span><small>BEACONS</small><strong>{outcome.run.beaconsCollected}</strong></span>
            <span><small>SLINGSHOTS</small><strong>{outcome.run.slingshots}</strong></span>
            <span><small>MAX MULTIPLIER</small><strong>×{outcome.run.maxMultiplier}</strong></span>
          </div>

          <button onClick={handleRetry}>Launch Next Run</button>
          <button className="secondary" onClick={onExit}>Return to Portal</button>
        </section>
      )}

      {/* Error state */}
      {error && (
        <section className="slingshot-state error">
          <p>INITIALIZATION FAILURE</p>
          <h2>Signal Lost</h2>
          <span>{error}</span>
          <button onClick={onExit}>Return to Portal</button>
        </section>
      )}
    </div>
  );
}
