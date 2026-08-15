export const ORBITAL_SLINGSHOT_VERSION = "0.1.0";
export const ORBITAL_SLINGSHOT_ROUTE_SECONDS = 120;
export const ORBITAL_SLINGSHOT_PROGRESS_EVENT = "4444555:orbital-slingshot-progress";

const STORAGE_KEY = "4444555.orbital-slingshot.progress.v1";
const MAX_RECENT_RUNS = 8;

export type SlingshotMedal = "none" | "bronze" | "silver" | "gold";

export type SlingshotRunResult = {
  id: string;
  endedAt: string;
  routeKey: string;
  score: number;
  completed: boolean;
  durationSeconds: number;
  medal: SlingshotMedal;
  beaconsCollected: number;
  slingshots: number;
  maxMultiplier: number;
  sectorsCompleted: number;
  fuelRemaining: number;
};

export type SlingshotProgress = {
  schemaVersion: 1;
  gameVersion: string;
  bestScore: number;
  totalRuns: number;
  insertions: number;
  recentRuns: SlingshotRunResult[];
};

export const emptySlingshotProgress = (): SlingshotProgress => ({
  schemaVersion: 1,
  gameVersion: ORBITAL_SLINGSHOT_VERSION,
  bestScore: 0,
  totalRuns: 0,
  insertions: 0,
  recentRuns: [],
});

export function getDailyRouteKey(date = new Date()) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
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

export function medalForSlingshotRun(
  score: number,
  completed: boolean,
  slingshots: number,
  fuelRemaining: number,
): SlingshotMedal {
  if (!completed) return "none";
  if (score >= 35_000 && slingshots >= 4 && fuelRemaining >= 1) return "gold";
  if (score >= 20_000) return "silver";
  return "bronze";
}

export function loadSlingshotProgress(): SlingshotProgress {
  if (typeof window === "undefined") return emptySlingshotProgress();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<SlingshotProgress> | null;
    if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.recentRuns)) return emptySlingshotProgress();
    return {
      schemaVersion: 1,
      gameVersion: typeof parsed.gameVersion === "string" ? parsed.gameVersion : ORBITAL_SLINGSHOT_VERSION,
      bestScore: Math.max(0, Number(parsed.bestScore) || 0),
      totalRuns: Math.max(0, Number(parsed.totalRuns) || 0),
      insertions: Math.max(0, Number(parsed.insertions) || 0),
      recentRuns: parsed.recentRuns.slice(0, MAX_RECENT_RUNS) as SlingshotRunResult[],
    };
  } catch {
    return emptySlingshotProgress();
  }
}

export function recordSlingshotRun(result: Omit<SlingshotRunResult, "id" | "endedAt" | "medal">) {
  const previous = loadSlingshotProgress();
  const run: SlingshotRunResult = {
    ...result,
    id: `${Date.now().toString(36)}-${Math.round(Math.random() * 0xffff).toString(36)}`,
    endedAt: new Date().toISOString(),
    medal: medalForSlingshotRun(result.score, result.completed, result.slingshots, result.fuelRemaining),
  };
  const progress: SlingshotProgress = {
    schemaVersion: 1,
    gameVersion: ORBITAL_SLINGSHOT_VERSION,
    bestScore: Math.max(previous.bestScore, run.score),
    totalRuns: previous.totalRuns + 1,
    insertions: previous.insertions + Number(run.completed),
    recentRuns: [run, ...previous.recentRuns].slice(0, MAX_RECENT_RUNS),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    window.dispatchEvent(new CustomEvent(ORBITAL_SLINGSHOT_PROGRESS_EVENT, { detail: progress }));
  } catch {
    // Gracefully handle storage disabled/blocked
  }
  return { progress, run, isNewBest: run.score > previous.bestScore };
}
