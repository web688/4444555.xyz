export const GRAVITY_COURIER_VERSION = "0.13.0";
export const GRAVITY_COURIER_ROUTE_SECONDS = 120;
export const GRAVITY_COURIER_PROGRESS_EVENT = "4444555:gravity-courier-progress";

const STORAGE_KEY = "4444555.gravity-courier.progress.v1";
const MAX_RECENT_RUNS = 8;

export type CourierMedal = "none" | "bronze" | "silver" | "gold";

export type CourierRunResult = {
  id: string;
  endedAt: string;
  routeKey: string;
  score: number;
  completed: boolean;
  durationSeconds: number;
  medal: CourierMedal;
  integrity: number;
  nearMisses: number;
  collisions: number;
  maxMultiplier: number;
  sector: number;
};

export type CourierProgress = {
  schemaVersion: 1;
  gameVersion: string;
  bestScore: number;
  totalRuns: number;
  deliveries: number;
  recentRuns: CourierRunResult[];
};

export const emptyCourierProgress = (): CourierProgress => ({
  schemaVersion: 1,
  gameVersion: GRAVITY_COURIER_VERSION,
  bestScore: 0,
  totalRuns: 0,
  deliveries: 0,
  recentRuns: [],
});

export function getDailyRouteKey(date = new Date()) {
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("-");
}

export function hashRouteSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: number) {
  let state = seed || 0x4444555;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function medalForRun(score: number, completed: boolean, integrity: number): CourierMedal {
  if (!completed) return "none";
  if (score >= 32_000 && integrity >= 2) return "gold";
  if (score >= 18_000) return "silver";
  return "bronze";
}

export function loadCourierProgress(): CourierProgress {
  if (typeof window === "undefined") return emptyCourierProgress();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<CourierProgress> | null;
    if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.recentRuns)) return emptyCourierProgress();
    return {
      schemaVersion: 1,
      gameVersion: typeof parsed.gameVersion === "string" ? parsed.gameVersion : GRAVITY_COURIER_VERSION,
      bestScore: Math.max(0, Number(parsed.bestScore) || 0),
      totalRuns: Math.max(0, Number(parsed.totalRuns) || 0),
      deliveries: Math.max(0, Number(parsed.deliveries) || 0),
      recentRuns: parsed.recentRuns.slice(0, MAX_RECENT_RUNS) as CourierRunResult[],
    };
  } catch {
    return emptyCourierProgress();
  }
}

export function recordCourierRun(result: Omit<CourierRunResult, "id" | "endedAt" | "medal">) {
  const previous = loadCourierProgress();
  const run: CourierRunResult = {
    ...result,
    id: `${Date.now().toString(36)}-${Math.round(Math.random() * 0xffff).toString(36)}`,
    endedAt: new Date().toISOString(),
    medal: medalForRun(result.score, result.completed, result.integrity),
  };
  const progress: CourierProgress = {
    schemaVersion: 1,
    gameVersion: GRAVITY_COURIER_VERSION,
    bestScore: Math.max(previous.bestScore, run.score),
    totalRuns: previous.totalRuns + 1,
    deliveries: previous.deliveries + Number(run.completed),
    recentRuns: [run, ...previous.recentRuns].slice(0, MAX_RECENT_RUNS),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    window.dispatchEvent(new CustomEvent(GRAVITY_COURIER_PROGRESS_EVENT, { detail: progress }));
  } catch {
    // A complete run remains playable when private browsing or storage policy blocks persistence.
  }
  return { progress, run, isNewBest: run.score > previous.bestScore };
}
