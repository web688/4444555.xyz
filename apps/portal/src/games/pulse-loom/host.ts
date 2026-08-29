import {
  SDK_VERSION,
  type GameHost,
  type GameLifecycleState,
  type GameTelemetryEvent,
  type PlayerIdentity,
  type PlayerSettings,
  type RunTicket,
  type SaveEnvelope,
  type ScoreClaim,
  type AchievementProgress,
} from "@4444555/game-sdk";
import { recordPulseLoomRun, loadPulseLoomProgress, savePulseLoomProgress, type PulseLoomProgress } from "./progress.ts";

export interface PulseLoomTelemetryData {
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

export interface PulseLoomRunEndedData {
  ticketId: string;
  outcome: "complete" | "overload";
  score: number;
  durationSeconds: number;
  routesCompleted: number;
  perfectRoutes: number;
  maxMultiplier: number;
  overloads: number;
  medal: string;
}

export type PulseLoomInboundMessage =
  | { type: "GAME_READY"; game: string; version: string; sdk: string; engine?: string }
  | { type: "STATE_CHANGE"; state: "ready" | "running" | "paused" | "ended" }
  | { type: "TELEMETRY"; data: PulseLoomTelemetryData }
  | { type: "RUN_ENDED"; data: PulseLoomRunEndedData }
  | { type: "ERROR"; message: string };

export type PulseLoomOutboundMessage =
  | { type: "INIT"; sdkVersion: string; settings: { muted: boolean; reducedMotion: boolean } }
  | { type: "START"; ticket: RunTicket }
  | { type: "PAUSE"; reason?: string }
  | { type: "RESUME" }
  | { type: "RESTART"; ticket: RunTicket }
  | { type: "SET_SETTINGS"; settings: { muted: boolean; reducedMotion: boolean } };

export function createPulseLoomRunTicket(seed?: number | string): RunTicket {
  const now = new Date();
  const expires = new Date(now.getTime() + 5 * 60 * 1000);
  const seedString = seed !== undefined ? String(seed) : String(Math.floor(Math.random() * 1_000_000));
  const id = `run-pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    gameId: "pulse-loom",
    gameVersion: "0.1.0",
    issuedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    seed: seedString,
    ruleset: "conduit-v1",
    signature: `sig_pl_${id}_${seedString}`,
  };
}

export function validateScoreClaim(
  activeTicket: RunTicket | null,
  claim: ScoreClaim
): { valid: boolean; reason?: string } {
  if (!activeTicket) {
    return { valid: false, reason: "No active run ticket found" };
  }
  if (claim.runTicketId !== activeTicket.id) {
    return { valid: false, reason: `Ticket ID mismatch: expected ${activeTicket.id}, got ${claim.runTicketId}` };
  }
  if (typeof claim.score !== "number" || isNaN(claim.score) || claim.score < 0 || !Number.isInteger(claim.score)) {
    return { valid: false, reason: "Score must be a non-negative integer" };
  }
  if (typeof claim.durationMs !== "number" || isNaN(claim.durationMs) || claim.durationMs < 0 || claim.durationMs > 120_000) {
    return { valid: false, reason: "Duration must be between 0 and 120,000 ms" };
  }
  if (!claim.stats || typeof claim.stats !== "object") {
    return { valid: false, reason: "Stats object required" };
  }
  const overloads = claim.stats["overloads"] ?? 0;
  if (overloads > 3) {
    return { valid: false, reason: "Overloads cannot exceed 3" };
  }
  return { valid: true };
}

export function validateIncomingMessage(
  event: MessageEvent,
  expectedWindow: Window | null
): PulseLoomInboundMessage | null {
  // Validate source window
  if (!expectedWindow || event.source !== expectedWindow) {
    return null;
  }

  // Validate exact same-origin
  if (typeof window !== "undefined" && window.location) {
    const expectedOrigin = window.location.origin;
    // In standard web environments, event.origin must match window.location.origin
    if (expectedOrigin && expectedOrigin !== "null" && event.origin && event.origin !== "null") {
      if (event.origin !== expectedOrigin) {
        console.warn(`[Pulse Loom Security] Rejected message from untrusted origin: ${event.origin}`);
        return null;
      }
    }
  }

  const raw = event.data;
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const type = (raw as Record<string, unknown>).type;
  if (typeof type !== "string") {
    return null;
  }

  switch (type) {
    case "GAME_READY": {
      const game = String((raw as Record<string, unknown>).game || "");
      const version = String((raw as Record<string, unknown>).version || "");
      const sdk = String((raw as Record<string, unknown>).sdk || "");
      const rawEngine = (raw as Record<string, unknown>).engine;
      return rawEngine
        ? { type: "GAME_READY", game, version, sdk, engine: String(rawEngine) }
        : { type: "GAME_READY", game, version, sdk };
    }

    case "STATE_CHANGE": {
      const state = (raw as Record<string, unknown>).state;
      if (state === "ready" || state === "running" || state === "paused" || state === "ended") {
        return { type: "STATE_CHANGE", state };
      }
      return null;
    }

    case "TELEMETRY": {
      const d = (raw as Record<string, unknown>).data;
      if (!d || typeof d !== "object") return null;
      const dataObj = d as Record<string, unknown>;
      const score = Number(dataObj.score ?? 0);
      const multiplier = Number(dataObj.multiplier ?? 1);
      const maxMultiplier = Number(dataObj.maxMultiplier ?? 1);
      const overloads = Number(dataObj.overloads ?? 0);
      const maxOverloads = Number(dataObj.maxOverloads ?? 3);
      const timeRemaining = Number(dataObj.timeRemaining ?? 90);
      const stage = Number(dataObj.stage ?? 1);
      const routesCompleted = Number(dataObj.routesCompleted ?? 0);
      const perfectRoutes = Number(dataObj.perfectRoutes ?? 0);
      const fps = Number(dataObj.fps ?? 60);

      if (isNaN(score) || isNaN(multiplier) || isNaN(timeRemaining) || isNaN(overloads)) {
        return null;
      }

      return {
        type: "TELEMETRY",
        data: {
          score,
          multiplier,
          maxMultiplier,
          overloads,
          maxOverloads,
          timeRemaining,
          stage,
          routesCompleted,
          perfectRoutes,
          fps,
        },
      };
    }

    case "RUN_ENDED": {
      const d = (raw as Record<string, unknown>).data;
      if (!d || typeof d !== "object") return null;
      const dataObj = d as Record<string, unknown>;
      const ticketId = String(dataObj.ticketId || "");
      const outcome = dataObj.outcome === "complete" ? "complete" : "overload";
      const score = Number(dataObj.score ?? 0);
      const durationSeconds = Number(dataObj.durationSeconds ?? 90);
      const routesCompleted = Number(dataObj.routesCompleted ?? 0);
      const perfectRoutes = Number(dataObj.perfectRoutes ?? 0);
      const maxMultiplier = Number(dataObj.maxMultiplier ?? 1);
      const overloads = Number(dataObj.overloads ?? 0);
      const medal = String(dataObj.medal || "none");

      if (isNaN(score) || isNaN(durationSeconds)) {
        return null;
      }

      return {
        type: "RUN_ENDED",
        data: {
          ticketId,
          outcome,
          score,
          durationSeconds,
          routesCompleted,
          perfectRoutes,
          maxMultiplier,
          overloads,
          medal,
        },
      };
    }

    case "ERROR": {
      const message = String((raw as Record<string, unknown>).message || "Unknown error");
      return { type: "ERROR", message };
    }

    default:
      return null;
  }
}

export function sendPostMessageToGodot(
  contentWindow: Window | null,
  message: PulseLoomOutboundMessage
): void {
  if (!contentWindow) return;
  const targetOrigin = typeof window !== "undefined" && window.location?.origin && window.location.origin !== "null"
    ? window.location.origin
    : "*";
  contentWindow.postMessage(message, targetOrigin);
}

export interface PulseLoomHostBridgeOptions {
  muted: boolean;
  reducedMotion: boolean;
  onExit: (reason: "player" | "completed" | "error") => void;
  onScoreClaimAccepted?: (claim: ScoreClaim, result: { accepted: boolean; rank?: number }) => void;
}

export function createPulseLoomHost(options: PulseLoomHostBridgeOptions): GameHost {
  const player: PlayerIdentity = {
    id: "guest-player",
    displayName: "Conduit Operator",
    isGuest: true,
  };

  const settings: PlayerSettings = {
    locale: "en-US",
    audio: {
      master: 1.0,
      music: 1.0,
      effects: 1.0,
      muted: options.muted,
    },
    accessibility: {
      reducedMotion: options.reducedMotion,
      highContrast: false,
      haptics: false,
    },
    input: {
      preferred: "keyboard",
      remap: {},
    },
  };

  let currentTicket: RunTicket | null = null;

  return {
    sdkVersion: SDK_VERSION,
    player,
    settings,

    async requestRun(): Promise<RunTicket> {
      currentTicket = createPulseLoomRunTicket();
      return currentTicket;
    },

    async submitScore(claim: ScoreClaim): Promise<{ accepted: boolean; rank?: number; reason?: string }> {
      const validation = validateScoreClaim(currentTicket, claim);
      if (!validation.valid) {
        return validation.reason !== undefined
          ? { accepted: false, reason: validation.reason }
          : { accepted: false };
      }

      const completed = (claim.stats["completed"] ?? 0) === 1;
      recordPulseLoomRun({
        routeKey: "daily",
        score: claim.score,
        completed,
        durationSeconds: Math.round(claim.durationMs / 1000),
        routesCompleted: claim.stats["routesCompleted"] ?? 0,
        perfectRoutes: claim.stats["perfectRoutes"] ?? 0,
        maxMultiplier: claim.stats["maxMultiplier"] ?? 1,
        overloads: claim.stats["overloads"] ?? 0,
      });

      const res = { accepted: true };
      if (options.onScoreClaimAccepted) {
        options.onScoreClaimAccepted(claim, res);
      }
      return res;
    },

    async loadSave<T>(): Promise<SaveEnvelope<T> | null> {
      const progress = loadPulseLoomProgress();
      return {
        schemaVersion: progress.schemaVersion,
        gameVersion: "0.1.0",
        updatedAt: new Date().toISOString(),
        data: progress as unknown as T,
      };
    },

    async save<T>(value: SaveEnvelope<T>): Promise<void> {
      if (value && typeof value.data === "object") {
        savePulseLoomProgress(value.data as unknown as PulseLoomProgress);
      }
    },

    async reportAchievement(progress: AchievementProgress): Promise<void> {
      // Achievements logged through host boundary
      console.log(`[PulseLoom Achievement] ${progress.achievementId}: ${progress.value} (unlocked: ${progress.unlocked})`);
    },

    emit(event: GameTelemetryEvent): void {
      // Telemetry routed through host boundary
      console.debug(`[PulseLoom Telemetry] ${event.name}`, event);
    },

    exit(reason: "player" | "completed" | "error"): void {
      options.onExit(reason);
    },
  };
}
