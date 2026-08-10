export const SDK_VERSION = "0.1.0" as const;

export type GameLifecycleState = "mounting" | "ready" | "running" | "paused" | "ended" | "destroyed";
export type InputMode = "keyboard" | "pointer" | "touch" | "gamepad";

export interface PlayerIdentity {
  id: string;
  displayName: string;
  avatarUrl?: string;
  isGuest: boolean;
}

export interface PlayerSettings {
  locale: string;
  audio: { master: number; music: number; effects: number; muted: boolean };
  accessibility: { reducedMotion: boolean; highContrast: boolean; haptics: boolean };
  input: { preferred: InputMode; remap: Readonly<Record<string, string>> };
}

export interface RunTicket {
  id: string;
  gameId: string;
  gameVersion: string;
  issuedAt: string;
  expiresAt: string;
  seed: string;
  ruleset: string;
  signature: string;
}

export interface ScoreClaim {
  runTicketId: string;
  score: number;
  durationMs: number;
  endedAt: string;
  stats: Readonly<Record<string, number>>;
  replayDigest?: string;
  replayEvidence?: Uint8Array;
}

export interface SaveEnvelope<T = unknown> {
  schemaVersion: number;
  gameVersion: string;
  updatedAt: string;
  data: T;
}

export interface GameTelemetryEvent {
  name: string;
  occurredAt: string;
  runTicketId?: string;
  properties?: Readonly<Record<string, string | number | boolean>>;
}

export interface AchievementProgress {
  achievementId: string;
  value: number;
  unlocked: boolean;
  evidence?: Readonly<Record<string, string | number | boolean>>;
}

export interface GameHost {
  readonly sdkVersion: typeof SDK_VERSION;
  readonly player: PlayerIdentity;
  readonly settings: PlayerSettings;
  requestRun(): Promise<RunTicket>;
  submitScore(claim: ScoreClaim): Promise<{ accepted: boolean; rank?: number; reason?: string }>;
  loadSave<T>(): Promise<SaveEnvelope<T> | null>;
  save<T>(value: SaveEnvelope<T>): Promise<void>;
  reportAchievement(progress: AchievementProgress): Promise<void>;
  emit(event: GameTelemetryEvent): void;
  exit(reason: "player" | "completed" | "error"): void;
}

export interface ArcadeGame {
  mount(container: HTMLElement, host: GameHost): Promise<void>;
  start(ticket: RunTicket): Promise<void>;
  pause(reason: "player" | "visibility" | "system"): void;
  resume(): void;
  destroy(): Promise<void>;
  getState(): GameLifecycleState;
}

export interface GameModule { createGame(): ArcadeGame }
