import { useEffect, useMemo, useRef, useState } from "react";
import { type PulseLoomRunResult } from "./progress";
import {
  createPulseLoomHost,
  sendPostMessageToGodot,
  validateIncomingMessage,
  type PulseLoomTelemetryData,
  type PulseLoomHost,
} from "./host";
import type { RunTicket, ScoreClaim, GameHost } from "@4444555/game-sdk";
import "./pulse-loom.css";

type Props = { onExit: () => void };

const initialTelemetry: PulseLoomTelemetryData = {
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
  const activeTicketRef = useRef<RunTicket | null>(null);
  const savedRunRef = useRef("");
  const onExitRef = useRef(onExit);
  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  const [telemetry, setTelemetry] = useState<PulseLoomTelemetryData>(initialTelemetry);
  const [gameState, setGameState] = useState<"ready" | "running" | "paused" | "ended">("ready");
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const [outcome, setOutcome] = useState<RecordedOutcome | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const [error, setError] = useState<string | null>(null);

  const hostRef = useRef<PulseLoomHost | null>(null);
  if (!hostRef.current) {
    const reducedMotion = typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

    hostRef.current = createPulseLoomHost({
      muted: false,
      reducedMotion,
      onExit: (_reason) => onExitRef.current(),
    });
  }

  const iframeSrc = useMemo(() => {
    const base = import.meta.env.BASE_URL || "/";
    const normalizedBase = base.endsWith("/") ? base : `${base}/`;
    return `${normalizedBase}games/pulse-loom/index.html`;
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Watchdog: Surface initialization failure if engine does not report ready within 15 seconds
    const initTimer = window.setTimeout(() => {
      setEngineReady((ready) => {
        if (!ready) {
          setError("Godot engine initialization timed out. WebGL 2 or WebAssembly may be unavailable or blocked.");
        }
        return ready;
      });
    }, 15000);

    const onMessage = (event: MessageEvent) => {
      const msg = validateIncomingMessage(event, iframeRef.current?.contentWindow ?? null);
      if (!msg) return;

      switch (msg.type) {
        case "GAME_READY": {
          clearTimeout(initTimer);
          setEngineReady(true);
          setError(null);
          const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          sendPostMessageToGodot(iframeRef.current?.contentWindow ?? null, {
            type: "INIT",
            sdkVersion: "0.1.0",
            settings: { muted: mutedRef.current, reducedMotion },
          });
          break;
        }

        case "STATE_CHANGE": {
          setGameState(msg.state);
          break;
        }

        case "TELEMETRY": {
          setTelemetry((prev) => ({ ...prev, ...msg.data }));
          break;
        }

        case "RUN_ENDED": {
          const result = msg.data;
          const currentTicket = activeTicketRef.current;
          if (!currentTicket || result.ticketId !== currentTicket.id) {
            console.error(`[Pulse Loom Gate] Rejected RUN_ENDED: ticketId mismatch or no active ticket. Expected ${currentTicket?.id}, got ${result.ticketId}`);
            setError(`Run rejected: ticket ID mismatch (${result.ticketId})`);
            break;
          }

          setGameState("ended");
          const runKey = `${result.ticketId}:${result.score}:${result.outcome}`;
          if (savedRunRef.current !== runKey) {
            savedRunRef.current = runKey;

            const claim: ScoreClaim = {
              runTicketId: result.ticketId,
              score: result.score,
              durationMs: result.durationSeconds * 1000,
              endedAt: new Date().toISOString(),
              stats: {
                routesCompleted: result.routesCompleted,
                perfectRoutes: result.perfectRoutes,
                maxMultiplier: result.maxMultiplier,
                overloads: result.overloads,
                completed: result.outcome === "complete" ? 1 : 0,
              },
            };

            if (hostRef.current) {
              void hostRef.current.submitScore(claim).then((submitRes) => {
                if (submitRes.accepted) {
                  try {
                    const raw = localStorage.getItem("4444555_pulse_loom_progress");
                    if (raw) {
                      const currentProgress = JSON.parse(raw);
                      const lastRun = currentProgress.recentRuns?.[0];
                      if (lastRun) {
                        const isNewBest = lastRun.score === currentProgress.bestScore && currentProgress.totalRuns > 0;
                        setOutcome({ run: lastRun, isNewBest });
                      }
                    }
                  } catch {
                    // Ignore storage reading errors
                  }
                } else {
                  setError(`Score submission rejected: ${submitRes.reason ?? "invalid claim"}`);
                }
              });
            }
          }
          break;
        }

        case "ERROR": {
          setError(msg.message);
          break;
        }
      }
    };

    window.addEventListener("message", onMessage);

    const onEscape = (event: KeyboardEvent) => {
      if (event.code === "Escape") onExitRef.current();
    };
    window.addEventListener("keydown", onEscape);

    const onVisibilityChange = () => {
      if (document.hidden) {
        if (gameStateRef.current === "running") {
          sendPostMessageToGodot(iframeRef.current?.contentWindow ?? null, {
            type: "PAUSE",
            reason: "visibility",
          });
          setGameState("paused");
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", onEscape);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const togglePause = () => {
    if (gameState === "paused") {
      sendPostMessageToGodot(iframeRef.current?.contentWindow ?? null, { type: "RESUME" });
      setGameState("running");
    } else {
      sendPostMessageToGodot(iframeRef.current?.contentWindow ?? null, { type: "PAUSE" });
      setGameState("paused");
    }
  };

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    hostRef.current?.updateSettings({ muted: nextMuted });
    const reducedMotion = typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
    sendPostMessageToGodot(iframeRef.current?.contentWindow ?? null, {
      type: "SET_SETTINGS",
      settings: {
        muted: nextMuted,
        reducedMotion,
      },
    });
  };

  const handleLaunch = async () => {
    if (!hostRef.current) return;
    const ticket = await hostRef.current.requestRun();
    activeTicketRef.current = ticket;
    sendPostMessageToGodot(iframeRef.current?.contentWindow ?? null, { type: "START", ticket });
    setGameState("running");
  };

  const handleRetry = async () => {
    setOutcome(null);
    savedRunRef.current = "";
    if (!hostRef.current) return;
    const ticket = await hostRef.current.requestRun();
    activeTicketRef.current = ticket;
    sendPostMessageToGodot(iframeRef.current?.contentWindow ?? null, { type: "RESTART", ticket });
    setGameState("running");
  };

  const handleIframeError = () => {
    setError("Failed to load Pulse Loom game frame.");
  };

  return (
    <div className="pulse-loom-gate" role="dialog" aria-label="Pulse Loom game session">
      <iframe
        className="pulse-loom-frame"
        ref={iframeRef}
        src={iframeSrc}
        title="Pulse Loom Engine"
        tabIndex={0}
        onError={handleIframeError}
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
            disabled={!engineReady || !!error || gameState === "ended" || gameState === "ready"}
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
          <span>ROTATE</span>: A / D or ◀ / ▶ <b>·</b> <span>LAUNCH</span>: PORTAL BUTTON <b>·</b> <span>PAUSE</span>: ESC / P
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
      {gameState === "ready" && !error && (
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
      {gameState === "paused" && !error && (
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
      {gameState === "ended" && outcome && !error && (
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
        <section className="pulse-loom-state error" role="alert">
          <p>INITIALIZATION FAILURE</p>
          <h2>Signal Disconnected</h2>
          <span style={{ color: "#ff6688", margin: "12px 0", maxWidth: "480px", textAlign: "center", lineHeight: "1.4" }}>
            {error}
          </span>
          <button onClick={onExit}>Return to Portal</button>
        </section>
      )}
    </div>
  );
}
