export const PULSE_LOOM_PROGRESS_KEY = "4444555_pulse_loom_progress";
export const PULSE_LOOM_PROGRESS_EVENT = "4444555:pulse-loom-progress";
export const PULSE_LOOM_ROUTE_SECONDS = 90;
export const MAX_RECENT_RUNS = 8;

export type PulseLoomMedal = "none" | "bronze" | "silver" | "gold";

export interface PulseLoomRunResult {
  id: string;
  date: string;
  routeKey: string;
  score: number;
  completed: boolean;
  durationSeconds: number;
  routesCompleted: number;
  perfectRoutes: number;
  maxMultiplier: number;
  overloads: number;
  medal: PulseLoomMedal;
}

export interface PulseLoomProgress {
  schemaVersion: 1;
  bestScore: number;
  totalRuns: number;
  completions: number;
  recentRuns: PulseLoomRunResult[];
}

export function medalForPulseLoomRun(score: number, completed: boolean): PulseLoomMedal {
  if (!completed && score < 15_000) return "none";
  if (score >= 60_000) return "gold";
  if (score >= 35_000) return "silver";
  if (score >= 15_000) return "bronze";
  return "none";
}

export function createEmptyPulseLoomProgress(): PulseLoomProgress {
  return {
    schemaVersion: 1,
    bestScore: 0,
    totalRuns: 0,
    completions: 0,
    recentRuns: [],
  };
}

export function loadPulseLoomProgress(): PulseLoomProgress {
  if (typeof window === "undefined" || !window.localStorage) {
    return createEmptyPulseLoomProgress();
  }
  try {
    const raw = window.localStorage.getItem(PULSE_LOOM_PROGRESS_KEY);
    if (!raw) return createEmptyPulseLoomProgress();
    const parsed = JSON.parse(raw) as Partial<PulseLoomProgress>;
    if (parsed.schemaVersion !== 1) return createEmptyPulseLoomProgress();
    return {
      schemaVersion: 1,
      bestScore: typeof parsed.bestScore === "number" ? parsed.bestScore : 0,
      totalRuns: typeof parsed.totalRuns === "number" ? parsed.totalRuns : 0,
      completions: typeof parsed.completions === "number" ? parsed.completions : 0,
      recentRuns: Array.isArray(parsed.recentRuns) ? parsed.recentRuns.slice(0, MAX_RECENT_RUNS) : [],
    };
  } catch {
    return createEmptyPulseLoomProgress();
  }
}

export function savePulseLoomProgress(progress: PulseLoomProgress): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(PULSE_LOOM_PROGRESS_KEY, JSON.stringify(progress));
    window.dispatchEvent(new CustomEvent(PULSE_LOOM_PROGRESS_EVENT, { detail: progress }));
  } catch {
    // Ignore storage quota errors
  }
}

export function recordPulseLoomRun(input: {
  routeKey?: string;
  score: number;
  completed: boolean;
  durationSeconds: number;
  routesCompleted: number;
  perfectRoutes: number;
  maxMultiplier: number;
  overloads: number;
}): { progress: PulseLoomProgress; run: PulseLoomRunResult; isNewBest: boolean } {
  const current = loadPulseLoomProgress();
  const medal = medalForPulseLoomRun(input.score, input.completed);
  const run: PulseLoomRunResult = {
    id: `pulse-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    date: new Date().toISOString(),
    routeKey: input.routeKey ?? "daily",
    score: Math.max(0, Math.floor(input.score)),
    completed: input.completed,
    durationSeconds: input.durationSeconds,
    routesCompleted: input.routesCompleted,
    perfectRoutes: input.perfectRoutes,
    maxMultiplier: input.maxMultiplier,
    overloads: input.overloads,
    medal,
  };

  const isNewBest = run.score > current.bestScore;
  const next: PulseLoomProgress = {
    schemaVersion: 1,
    bestScore: Math.max(current.bestScore, run.score),
    totalRuns: current.totalRuns + 1,
    completions: current.completions + (run.completed ? 1 : 0),
    recentRuns: [run, ...current.recentRuns.filter((r) => r.id !== run.id)].slice(0, MAX_RECENT_RUNS),
  };

  savePulseLoomProgress(next);
  return { progress: next, run, isNewBest };
}
