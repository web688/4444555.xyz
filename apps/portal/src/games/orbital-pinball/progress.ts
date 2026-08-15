export const ORBITAL_PINBALL_VERSION = "0.1.0";
export const ORBITAL_PINBALL_TARGET_SECONDS = 180;
export const ORBITAL_PINBALL_PROGRESS_EVENT = "4444555:orbital-pinball-progress";

const STORAGE_KEY = "4444555.orbital-pinball.progress.v1";
const MAX_RECENT_RUNS = 8;

export type PinballMedal = "none" | "bronze" | "silver" | "gold";

export type PinballRunResult = {
  id: string;
  endedAt: string;
  routeKey: string;
  score: number;
  completed: boolean;
  durationSeconds: number;
  medal: PinballMedal;
  bumperHits: number;
  targetsCleared: number;
  maxMultiplier: number;
  ballsPlayed: number;
  relayLoops: number;
};

export type PinballProgress = {
  schemaVersion: 1;
  gameVersion: string;
  bestScore: number;
  totalRuns: number;
  completions: number;
  recentRuns: PinballRunResult[];
};

export const emptyPinballProgress = (): PinballProgress => ({
  schemaVersion: 1,
  gameVersion: ORBITAL_PINBALL_VERSION,
  bestScore: 0,
  totalRuns: 0,
  completions: 0,
  recentRuns: [],
});

export function getDailyRouteKey(date = new Date()) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function medalForPinballRun(score: number, completed: boolean): PinballMedal {
  if (!completed && score < 20_000) return "none";
  if (score >= 100_000) return "gold";
  if (score >= 50_000) return "silver";
  if (score >= 20_000) return "bronze";
  return "none";
}

export function loadPinballProgress(): PinballProgress {
  if (typeof window === "undefined") return emptyPinballProgress();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<PinballProgress> | null;
    if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.recentRuns)) return emptyPinballProgress();
    return {
      schemaVersion: 1,
      gameVersion: typeof parsed.gameVersion === "string" ? parsed.gameVersion : ORBITAL_PINBALL_VERSION,
      bestScore: Math.max(0, Number(parsed.bestScore) || 0),
      totalRuns: Math.max(0, Number(parsed.totalRuns) || 0),
      completions: Math.max(0, Number(parsed.completions) || 0),
      recentRuns: parsed.recentRuns.slice(0, MAX_RECENT_RUNS) as PinballRunResult[],
    };
  } catch {
    return emptyPinballProgress();
  }
}

export function recordPinballRun(result: Omit<PinballRunResult, "id" | "endedAt" | "medal">) {
  const previous = loadPinballProgress();
  const run: PinballRunResult = {
    ...result,
    id: `${Date.now().toString(36)}-${Math.round(Math.random() * 0xffff).toString(36)}`,
    endedAt: new Date().toISOString(),
    medal: medalForPinballRun(result.score, result.completed),
  };
  const progress: PinballProgress = {
    schemaVersion: 1,
    gameVersion: ORBITAL_PINBALL_VERSION,
    bestScore: Math.max(previous.bestScore, run.score),
    totalRuns: previous.totalRuns + 1,
    completions: previous.completions + Number(run.completed),
    recentRuns: [run, ...previous.recentRuns].slice(0, MAX_RECENT_RUNS),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    window.dispatchEvent(new CustomEvent(ORBITAL_PINBALL_PROGRESS_EVENT, { detail: progress }));
  } catch {
    // Storage can be blocked; gameplay must remain available.
  }
  return { progress, run, isNewBest: run.score > previous.bestScore };
}
