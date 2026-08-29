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
  medal: "none" | "bronze" | "silver" | "gold";
}

export type PulseLoomInboundMessage =
  | { type: "GAME_READY"; game: "pulse-loom"; version: "0.1.0"; sdk: "0.1.0"; engine?: string }
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

export function getPulseLoomDailySeed(date = new Date()): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function createPulseLoomRunTicket(seed?: number | string, now = new Date()): RunTicket {
  const expires = new Date(now.getTime() + 5 * 60 * 1000);
  const seedString = seed !== undefined ? String(seed) : getPulseLoomDailySeed(now);
  const id = `run-pl-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    gameId: "pulse-loom",
    gameVersion: "0.1.0",
    issuedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    seed: seedString,
    ruleset: "conduit-v1",
    signature: "local-unverified",
  };
}

export function validateScoreClaim(
  activeTicket: RunTicket | null,
  claim: ScoreClaim
): { valid: boolean; reason?: string } {
  if (!activeTicket) {
    return { valid: false, reason: "No active run ticket found" };
  }
  if (typeof activeTicket.id !== "string" || !activeTicket.id.startsWith("run-pl-")) {
    return { valid: false, reason: "Invalid active run ticket ID" };
  }
  if (activeTicket.gameId !== "pulse-loom" || activeTicket.gameVersion !== "0.1.0" || activeTicket.ruleset !== "conduit-v1") {
    return { valid: false, reason: "Active run ticket parameters mismatch (gameId, gameVersion, or ruleset)" };
  }
  if (activeTicket.signature !== "local-unverified") {
    return { valid: false, reason: "Active run ticket signature invalid" };
  }

  const expiresMs = new Date(activeTicket.expiresAt).getTime();
  if (isNaN(expiresMs) || expiresMs <= Date.now()) {
    return { valid: false, reason: "Run ticket has expired" };
  }

  if (claim.runTicketId !== activeTicket.id) {
    return { valid: false, reason: `Ticket ID mismatch: expected ${activeTicket.id}, got ${claim.runTicketId}` };
  }

  const endedMs = new Date(claim.endedAt).getTime();
  if (isNaN(endedMs) || endedMs > expiresMs) {
    return { valid: false, reason: "Score claim endedAt exceeds ticket expiry" };
  }

  if (typeof claim.score !== "number" || isNaN(claim.score) || !Number.isFinite(claim.score) || claim.score < 0 || !Number.isInteger(claim.score)) {
    return { valid: false, reason: "Score must be a non-negative integer" };
  }
  if (typeof claim.durationMs !== "number" || isNaN(claim.durationMs) || !Number.isFinite(claim.durationMs) || claim.durationMs < 0 || claim.durationMs > 120_000) {
    return { valid: false, reason: "Duration must be between 0 and 120,000 ms" };
  }
  if (!claim.stats || typeof claim.stats !== "object" || Array.isArray(claim.stats)) {
    return { valid: false, reason: "Stats object required" };
  }

  const overloads = claim.stats["overloads"];
  if (typeof overloads !== "number" || !Number.isInteger(overloads) || overloads < 0 || overloads > 3) {
    return { valid: false, reason: "Overloads must be an integer between 0 and 3" };
  }

  const routesCompleted = claim.stats["routesCompleted"];
  if (routesCompleted !== undefined && (typeof routesCompleted !== "number" || !Number.isInteger(routesCompleted) || routesCompleted < 0)) {
    return { valid: false, reason: "Routes completed must be a non-negative integer" };
  }

  const perfectRoutes = claim.stats["perfectRoutes"];
  if (perfectRoutes !== undefined && (typeof perfectRoutes !== "number" || !Number.isInteger(perfectRoutes) || perfectRoutes < 0)) {
    return { valid: false, reason: "Perfect routes must be a non-negative integer" };
  }

  const maxMultiplier = claim.stats["maxMultiplier"];
  if (maxMultiplier !== undefined && (typeof maxMultiplier !== "number" || !Number.isInteger(maxMultiplier) || maxMultiplier < 1 || maxMultiplier > 10)) {
    return { valid: false, reason: "Max multiplier must be an integer between 1 and 10" };
  }

  return { valid: true };
}

export function validateIncomingMessage(
  event: MessageEvent | { source: unknown; origin: unknown; data: unknown },
  expectedWindow: Window | object | null,
  expectedOrigin?: string
): PulseLoomInboundMessage | null {
  if (!expectedWindow || !event || typeof event !== "object") {
    return null;
  }

  // 1. Exact source window verification
  if (event.source !== expectedWindow) {
    return null;
  }

  // 2. Exact same-origin verification (must not be empty, null, 'null', or '*')
  const targetOrigin =
    expectedOrigin ||
    (typeof window !== "undefined" && window.location?.origin && window.location.origin !== "null"
      ? window.location.origin
      : "");

  if (!targetOrigin || targetOrigin === "*" || targetOrigin === "null") {
    return null;
  }

  if (
    typeof event.origin !== "string" ||
    !event.origin ||
    event.origin === "null" ||
    event.origin === "*" ||
    event.origin !== targetOrigin
  ) {
    return null;
  }

  const raw = (event as { data: unknown }).data;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const obj = raw as Record<string, unknown>;
  const type = obj.type;
  if (typeof type !== "string") {
    return null;
  }

  switch (type) {
    case "GAME_READY": {
      if (obj.game !== "pulse-loom" || obj.version !== "0.1.0" || obj.sdk !== "0.1.0") {
        return null;
      }
      const engine = typeof obj.engine === "string" && obj.engine.length > 0 ? obj.engine : undefined;
      return {
        type: "GAME_READY",
        game: "pulse-loom",
        version: "0.1.0",
        sdk: "0.1.0",
        ...(engine ? { engine } : {}),
      };
    }

    case "STATE_CHANGE": {
      const state = obj.state;
      if (state === "ready" || state === "running" || state === "paused" || state === "ended") {
        return { type: "STATE_CHANGE", state };
      }
      return null;
    }

    case "TELEMETRY": {
      const d = obj.data;
      if (!d || typeof d !== "object" || Array.isArray(d)) return null;
      const dataObj = d as Record<string, unknown>;

      const {
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
      } = dataObj;

      if (
        typeof score !== "number" || !Number.isFinite(score) || score < 0 ||
        typeof multiplier !== "number" || !Number.isFinite(multiplier) || multiplier < 1 || multiplier > 10 ||
        typeof maxMultiplier !== "number" || !Number.isFinite(maxMultiplier) || maxMultiplier < 1 || maxMultiplier > 10 ||
        typeof overloads !== "number" || !Number.isFinite(overloads) || overloads < 0 || overloads > 3 ||
        typeof maxOverloads !== "number" || !Number.isFinite(maxOverloads) || maxOverloads !== 3 ||
        typeof timeRemaining !== "number" || !Number.isFinite(timeRemaining) || timeRemaining < 0 || timeRemaining > 90 ||
        typeof stage !== "number" || !Number.isInteger(stage) || stage < 1 || stage > 4 ||
        typeof routesCompleted !== "number" || !Number.isInteger(routesCompleted) || routesCompleted < 0 ||
        typeof perfectRoutes !== "number" || !Number.isInteger(perfectRoutes) || perfectRoutes < 0 ||
        typeof fps !== "number" || !Number.isFinite(fps) || fps < 0
      ) {
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
      const d = obj.data;
      if (!d || typeof d !== "object" || Array.isArray(d)) return null;
      const dataObj = d as Record<string, unknown>;

      const {
        ticketId,
        outcome,
        score,
        durationSeconds,
        routesCompleted,
        perfectRoutes,
        maxMultiplier,
        overloads,
        medal,
      } = dataObj;

      if (
        typeof ticketId !== "string" || ticketId.length === 0 || !ticketId.startsWith("run-pl-") ||
        (outcome !== "complete" && outcome !== "overload") ||
        typeof score !== "number" || !Number.isInteger(score) || score < 0 ||
        typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds) || durationSeconds < 0 || durationSeconds > 120 ||
        typeof routesCompleted !== "number" || !Number.isInteger(routesCompleted) || routesCompleted < 0 ||
        typeof perfectRoutes !== "number" || !Number.isInteger(perfectRoutes) || perfectRoutes < 0 ||
        typeof maxMultiplier !== "number" || !Number.isInteger(maxMultiplier) || maxMultiplier < 1 || maxMultiplier > 10 ||
        typeof overloads !== "number" || !Number.isInteger(overloads) || overloads < 0 || overloads > 3 ||
        (medal !== "none" && medal !== "bronze" && medal !== "silver" && medal !== "gold")
      ) {
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
      if (typeof obj.message !== "string" || obj.message.length === 0) {
        return null;
      }
      return { type: "ERROR", message: obj.message };
    }

    default:
      return null;
  }
}

export function sendPostMessageToGodot(
  contentWindow: Window | null,
  message: PulseLoomOutboundMessage,
  targetOrigin?: string
): void {
  if (!contentWindow) return;
  const origin =
    targetOrigin ||
    (typeof window !== "undefined" && window.location?.origin && window.location.origin !== "null"
      ? window.location.origin
      : "");
  if (!origin || origin === "*" || origin === "null") {
    throw new Error("Refusing to postMessage: exact non-wildcard target origin is required");
  }
  contentWindow.postMessage(message, origin);
}

export interface PulseLoomHostBridgeOptions {
  muted?: boolean;
  reducedMotion?: boolean;
  onExit: (reason: "player" | "completed" | "error") => void;
  onScoreClaimAccepted?: (claim: ScoreClaim, result: { accepted: boolean; rank?: number }) => void;
}

export interface PulseLoomHost extends GameHost {
  updateSettings(partial: { muted?: boolean; reducedMotion?: boolean }): void;
  getActiveTicket(): RunTicket | null;
}

export function createPulseLoomHost(options: PulseLoomHostBridgeOptions): PulseLoomHost {
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
      muted: options.muted ?? false,
    },
    accessibility: {
      reducedMotion: options.reducedMotion ?? false,
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

    updateSettings(partial: { muted?: boolean; reducedMotion?: boolean }): void {
      if (partial.muted !== undefined) {
        settings.audio.muted = partial.muted;
      }
      if (partial.reducedMotion !== undefined) {
        settings.accessibility.reducedMotion = partial.reducedMotion;
      }
    },

    getActiveTicket(): RunTicket | null {
      return currentTicket;
    },

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

