import { useEffect, useMemo, useRef, useState } from "react";
import { recordPulseLoomRun, type PulseLoomRunResult } from "./progress";
import "./pulse-loom.css";

type Props = { onExit: () => void };

interface PulseLoomTelemetry {
  score: number;
  multiplier: number;
  maxMultiplier: number;
  overloads: number;
  maxOverloads: number;
  timeRemaining: number;
  stage: number;
  routesCompleted: number;
  perfectRoutes: number;
  fps: number;
}

const initialTelemetry: PulseLoomTelemetry = {
  score: 0,
  multiplier: 1,
  maxMultiplier: 1,
  overloads: 0,
  maxOverloads: 3,
  timeRemaining: 90,
  stage: 1,
  routesCompleted: 0,
  perfectRoutes: 0,
  fps: 60,
};

type RecordedOutcome = { run: PulseLoomRunResult; isNewBest: boolean };

export default function PulseLoomGate({ onExit }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const savedRunRef = useRef("");
  const [telemetry, setTelemetry] = useState<PulseLoomTelemetry>(initialTelemetry);
  const [gameState, setGameState] = useState<"ready" | "running" | "paused" | "ended">("ready");
  const [outcome, setOutcome] = useState<RecordedOutcome | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const iframeSrc = useMemo(() => {
    const base = import.meta.env.BASE_URL || "/";
    const normalizedBase = base.endsWith("/") ? base : `${base}/`;
    return `${normalizedBase}games/pulse-loom/index.html`;
  }, []);

  const sendToGodot = (msg: Record<string, unknown>) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(msg, "*");
    }
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onMessage = (event: MessageEvent) => {
      // Validate source window to ensure same-origin / matching iframe
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) {
        return;
      }
      const data = event.data;
      if (!data || typeof data !== "object") return;

      const type = data.type;
      if (type === "GAME_READY") {
        setEngineReady(true);
        sendToGodot({
          type: "INIT",
          settings: {
            muted,
            reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          },
        });
      } else if (type === "STATE_CHANGE") {
        const nextState = data.state as "ready" | "running" | "paused" | "ended";
        if (nextState) setGameState(nextState);
      } else if (type === "TELEMETRY") {
        if (data.data) {
          setTelemetry((prev) => ({ ...prev, ...data.data }));
        }
      } else if (type === "RUN_ENDED") {
        const result = data.data;
        if (result) {
          setGameState("ended");
          const runKey = `${result.ticketId}:${result.score}:${result.outcome}`;
          if (savedRunRef.current !== runKey) {
            savedRunRef.current = runKey;
            const recorded = recordPulseLoomRun({
              routeKey: "daily",
              score: Number(result.score || 0),
              completed: result.outcome === "complete",
              durationSeconds: Number(result.durationSeconds || 90),
              routesCompleted: Number(result.routesCompleted || 0),
              perfectRoutes: Number(result.perfectRoutes || 0),
              maxMultiplier: Number(result.maxMultiplier || 1),
              overloads: Number(result.overloads || 0),
            });
            setOutcome({ run: recorded.run, isNewBest: recorded.isNewBest });
          }
        }
      }
    };

    window.addEventListener("message", onMessage);

    const onEscape = (event: KeyboardEvent) => {
      if (event.code === "Escape") onExit();
    };
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", onEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [muted, onExit]);

  const togglePause = () => {
    if (gameState === "paused") {
      sendToGodot({ type: "RESUME" });
      setGameState("running");
    } else {
      sendToGodot({ type: "PAUSE" });
      setGameState("paused");
    }
  };

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    sendToGodot({
      type: "SET_SETTINGS",
      settings: {
        muted: nextMuted,
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      },
    });
  };

  const handleLaunch = () => {
    const ticket = {
      id: `run-${Date.now()}`,
      seed: Math.floor(Math.random() * 1000000),
      ruleset: "conduit-v1",
    };
    sendToGodot({ type: "START", ticket });
    setGameState("running");
  };

  const handleRetry = () => {
    setOutcome(null);
    savedRunRef.current = "";
    const ticket = {
      id: `run-${Date.now()}`,
      seed: Math.floor(Math.random() * 1000000),
      ruleset: "conduit-v1",
    };
    sendToGodot({ type: "RESTART", ticket });
    setGameState("running");
  };

  return (
    <div className="pulse-loom-gate" role="dialog" aria-label="Pulse Loom game session">
      <iframe
        className="pulse-loom-frame"
        ref={iframeRef}
        src={iframeSrc}
        title="Pulse Loom Engine"
        tabIndex={0}
      />
      <div className="pulse-loom-vignette" />

      {/* Top HUD Header */}
      <header className="pulse-loom-hud top">
        <div className="pulse-loom-identity">
          <span className="pulse-loom-live-dot" />
          <strong>PULSE LOOM</strong>
          <small>GODOT 4.6 ENGINE · STAGE {telemetry.stage} / 4</small>
        </div>
        <div className="pulse-loom-actions">
          <button
            onClick={togglePause}
            disabled={!engineReady || gameState === "ended" || gameState === "ready"}
          >
            {gameState === "paused" ? "Resume" : "Pause"}
          </button>
          <button onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>
          <button className="pulse-loom-close" onClick={onExit} aria-label="Exit game">
            ×
          </button>
        </div>
      </header>

      {/* Score and Multiplier */}
      <div className="pulse-loom-score">
        <small>SIGNAL SCORE</small>
        <strong>{telemetry.score.toLocaleString("en-US")}</strong>
        <span>CONDUIT ×{telemetry.multiplier}</span>
      </div>

      {/* Telemetry Display */}
      <div className="pulse-loom-telemetry">
        <div className="pulse-loom-time-card">
          <small>TIME REMAINING</small>
          <div>
            <strong>{Math.max(0, telemetry.timeRemaining).toFixed(1)}</strong>
            <span>SEC</span>
          </div>
        </div>
        <div className="pulse-loom-overload-bar" aria-label="Overload level">
          <small>OVERLOAD</small>
          <i className={telemetry.overloads >= 1 ? "active" : ""} />
          <i className={telemetry.overloads >= 2 ? "active" : ""} />
          <i className={telemetry.overloads >= 3 ? "active" : ""} />
        </div>
      </div>

      {/* Bottom Bar */}
      <footer className="pulse-loom-bottom-bar">
        <div>
          <span>ROTATE</span>: A / D or ◀ / ▶ <b>·</b> <span>LAUNCH</span>: SPACE / CLICK <b>·</b> <span>PAUSE</span>: ESC / P
        </div>
        <div className="pulse-loom-stage-progress">
          <small>STAGE</small>
          <i className={telemetry.stage === 1 ? "current" : telemetry.stage > 1 ? "passed" : ""}>1</i>
          <i className={telemetry.stage === 2 ? "current" : telemetry.stage > 2 ? "passed" : ""}>2</i>
          <i className={telemetry.stage === 3 ? "current" : telemetry.stage > 3 ? "passed" : ""}>3</i>
          <i className={telemetry.stage === 4 ? "current" : telemetry.stage > 4 ? "passed" : ""}>4</i>
        </div>
      </footer>

      {/* Ready / Briefing Modal */}
      {gameState === "ready" && (
        <section className="pulse-loom-state ready">
          <p>90-SECOND SIGNAL SCORE ATTACK</p>
          <h2>Pulse Loom</h2>
          <div className="pulse-loom-briefing">
            <span>
              <b>01 / ALIGN</b>Rotate the core conduit in 60° increments with A/D or ◀/▶.
            </span>
            <span>
              <b>02 / ROUTE</b>Match incoming pulses to their target radial glyph conduits.
            </span>
            <span>
              <b>03 / SURVIVE</b>Build streak multipliers. 3 Overload misroutes terminate the run.
            </span>
          </div>
          <button onClick={handleLaunch} disabled={!engineReady}>
            {engineReady ? "Engage Signal Stream" : "Synchronizing Engine..."}
          </button>
          <button className="secondary" onClick={onExit}>
            Return to Portal
          </button>
        </section>
      )}

      {/* Paused Modal */}
      {gameState === "paused" && (
        <section className="pulse-loom-state paused">
          <p>SIGNAL STREAM PAUSED</p>
          <h2>Conduit Suspended</h2>
          <button onClick={togglePause}>Resume Routing</button>
          <button className="secondary" onClick={handleRetry}>
            Restart Transmission
          </button>
          <button className="secondary" onClick={onExit}>
            Exit to Portal
          </button>
        </section>
      )}

      {/* Mission Complete / Failed Outcome Modal */}
      {gameState === "ended" && outcome && (
        <section className={`pulse-loom-state result ${!outcome.run.completed ? "failed" : ""}`}>
          <p>{outcome.run.completed ? "TRANSMISSION COMPLETE" : "CRITICAL OVERLOAD FAILURE"}</p>
          <h2>{outcome.run.completed ? "Signal Secured" : "Core Overloaded"}</h2>

          {outcome.run.medal !== "none" && (
            <div className={`pulse-loom-medal ${outcome.run.medal}`}>
              <i />
              <span>{outcome.run.medal.toUpperCase()} MEDAL AWARDED</span>
            </div>
          )}

          <div className="pulse-loom-score-card">
            <span>FINAL SCORE</span>
            <strong>{outcome.run.score.toLocaleString("en-US")}</strong>
            {outcome.isNewBest && (
              <small style={{ color: "#00f0ff", display: "block", marginTop: "4px" }}>
                NEW LOCAL BEST RECORD!
              </small>
            )}
          </div>

          <div className="pulse-loom-run-stats">
            <span>
              <small>ROUTES</small>
              <strong>{outcome.run.routesCompleted}</strong>
            </span>
            <span>
              <small>PERFECT</small>
              <strong>{outcome.run.perfectRoutes}</strong>
            </span>
            <span>
              <small>MAX MULTIPLIER</small>
              <strong>×{outcome.run.maxMultiplier}</strong>
            </span>
            <span>
              <small>OVERLOADS</small>
              <strong>{outcome.run.overloads} / 3</strong>
            </span>
          </div>

          <button onClick={handleRetry}>Launch Next Transmission</button>
          <button className="secondary" onClick={onExit}>
            Return to Portal
          </button>
        </section>
      )}

      {/* Error state */}
      {error && (
        <section className="pulse-loom-state error">
          <p>INITIALIZATION FAILURE</p>
          <h2>Signal Disconnected</h2>
          <span>{error}</span>
          <button onClick={onExit}>Return to Portal</button>
        </section>
      )}
    </div>
  );
}
