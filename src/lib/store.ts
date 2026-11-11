import { useSyncExternalStore } from 'react';
import { EXERCISES } from '../data/exercises';
import { programId } from '../data/programs';
import { getMetric } from './metrics';
import { dayStart, defaultWeekdays } from './schedule';
import type { AppState, Days, MetricEntry, Plan, ResolvedSession, SetLog, Settings, Version, WorkoutLog } from './types';

const STORAGE_KEY = 'wo.state.v1';

export function defaultState(): AppState {
  return {
    version: 2,
    onboarded: false,
    plan: { version: 'gym', days: 4, weekdays: defaultWeekdays(4) },
    phase: 0,
    cycle: 1,
    swaps: {},
    metrics: {},
    pinned: ['weight'],
    logs: [],
    active: null,
    settings: { sound: true, vibrate: true, keepAwake: true, restTimer: true, autofill: true },
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

const validLog = (l: unknown): l is WorkoutLog =>
  isObject(l) && typeof l.id === 'string' && typeof l.startedAt === 'number' && Array.isArray(l.entries);

function parsePlan(raw: unknown): Plan {
  const base = defaultState().plan;
  if (!isObject(raw)) return base;
  const version: Version = raw.version === 'home' ? 'home' : 'gym';
  const days = ([2, 3, 4] as const).find((d) => d === raw.days) ?? base.days;
  const picked = Array.isArray(raw.weekdays)
    ? [...new Set(raw.weekdays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : [];
  return { version, days, weekdays: picked.length === days ? picked : defaultWeekdays(days) };
}

function parseMetrics(raw: unknown): Record<string, MetricEntry[]> {
  const out: Record<string, MetricEntry[]> = {};
  if (!isObject(raw)) return out;
  for (const [id, entries] of Object.entries(raw)) {
    if (!getMetric(id) || !Array.isArray(entries)) continue;
    out[id] = entries
      .filter((e): e is MetricEntry => isObject(e) && typeof e.at === 'number' && typeof e.value === 'number')
      .sort((a, b) => a.at - b.at);
  }
  return out;
}

/**
 * Validerar inläst data så att trasig lagring eller en felaktig importfil inte kraschar appen.
 * Data från den första versionen (fasta program utan faser) flyttas över: historiken behålls
 * och programmet börjar om i fas 1.
 */
export function parseState(raw: unknown): AppState | null {
  if (!isObject(raw) || !Array.isArray(raw.logs)) return null;
  const base = defaultState();
  const logs = raw.logs.filter(validLog);
  const settings = { ...base.settings, ...(isObject(raw.settings) ? raw.settings : {}) } as Settings;
  const cycle = typeof raw.cycle === 'number' ? raw.cycle : 1;

  if (raw.version === 1) {
    const home = raw.programId === 'hemma';
    const days: Days = home ? 3 : 4;
    return {
      ...base,
      onboarded: logs.length > 0,
      plan: { version: home ? 'home' : 'gym', days, weekdays: defaultWeekdays(days) },
      cycle: cycle + 1,
      logs,
      settings,
    };
  }
  if (raw.version !== 2) return null;

  const known = new Set(EXERCISES.map((e) => e.id));
  const swaps: Record<string, string> = {};
  if (isObject(raw.swaps)) {
    for (const [from, to] of Object.entries(raw.swaps)) {
      if (typeof to === 'string' && known.has(from) && known.has(to)) swaps[from] = to;
    }
  }

  return {
    version: 2,
    onboarded: raw.onboarded === true,
    plan: parsePlan(raw.plan),
    phase: typeof raw.phase === 'number' && raw.phase >= 0 ? Math.floor(raw.phase) : 0,
    cycle,
    swaps,
    metrics: parseMetrics(raw.metrics),
    pinned: Array.isArray(raw.pinned) ? raw.pinned.filter((id): id is string => typeof id === 'string' && !!getMetric(id)) : base.pinned,
    logs,
    active: validLog(raw.active) ? raw.active : null,
    settings,
  };
}

function load(): AppState {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (text) return parseState(JSON.parse(text)) ?? defaultState();
  } catch {
    /* Oläsbar lagring: börja om från ett tomt läge. */
  }
  return defaultState();
}

let state: AppState = load();
const listeners = new Set<() => void>();

function commit(next: AppState): void {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Fullt eller blockerat lagringsutrymme: appen fungerar vidare i minnet. */
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getState = (): AppState => state;

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

function updateActive(fn: (log: WorkoutLog) => WorkoutLog): void {
  if (!state.active) return;
  commit({ ...state, active: fn(state.active) });
}

function updateSets(key: string, fn: (sets: SetLog[]) => SetLog[]): void {
  updateActive((log) => ({
    ...log,
    entries: log.entries.map((e) => (e.key === key ? { ...e, sets: fn(e.sets) } : e)),
  }));
}

const emptySet = (): SetLog => ({ weight: null, reps: null, done: false });

export const actions = {
  completeOnboarding(plan: Plan): void {
    commit({ ...state, onboarded: true, plan: parsePlan(plan) });
  },

  /** Ändrar upplägget. Avklarade pass i fasen ligger kvar. */
  updatePlan(plan: Plan): void {
    commit({ ...state, plan: parsePlan(plan) });
  },

  /** Går till en annan fas och börjar den från vecka 1. Egna övningsbyten nollställs. */
  startPhase(phase: number): void {
    commit({ ...state, phase: Math.max(0, phase), cycle: state.cycle + 1, swaps: {}, active: null });
  },

  restartPhase(): void {
    commit({ ...state, cycle: state.cycle + 1, active: null });
  },

  startWorkout(session: ResolvedSession): void {
    const log: WorkoutLog = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      programId: programId(state.phase, state.plan.version, state.plan.days),
      cycle: state.cycle,
      week: session.week,
      sessionId: session.id,
      sessionName: session.name,
      startedAt: Date.now(),
      finishedAt: null,
      entries: session.blocks
        .filter((b) => b.format === 'sets')
        .flatMap((b) =>
          b.items.map((item) => ({
            key: item.key,
            exerciseId: item.exercise.id,
            sets: Array.from({ length: item.sets }, emptySet),
          })),
        ),
      checks: {},
      rounds: {},
      rpe: null,
      note: '',
    };
    commit({ ...state, active: log });
  },

  /**
   * Byter ut en av programmets övningar mot ett alternativ. Bytet gäller resten av fasen.
   * `activeKeys` är raderna i det pågående passet som ska följa med; där nollställs
   * set som inte är avklarade, eftersom vikterna hör till den gamla övningen.
   */
  swapExercise(baseId: string, replacementId: string, activeKeys: string[]): void {
    const swaps = { ...state.swaps };
    if (replacementId === baseId) delete swaps[baseId];
    else swaps[baseId] = replacementId;

    const active = state.active && {
      ...state.active,
      entries: state.active.entries.map((e) =>
        activeKeys.includes(e.key)
          ? { ...e, exerciseId: replacementId, sets: e.sets.map((s) => (s.done ? s : emptySet())) }
          : e,
      ),
    };
    commit({ ...state, swaps, active });
  },

  updateSet(key: string, index: number, patch: Partial<SetLog>): void {
    updateSets(key, (sets) => sets.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  },

  addSet(key: string): void {
    updateSets(key, (sets) => {
      const last = sets[sets.length - 1];
      return [...sets, { weight: last?.weight ?? null, reps: last?.reps ?? null, done: false }];
    });
  },

  removeSet(key: string): void {
    updateSets(key, (sets) => (sets.length > 1 ? sets.slice(0, -1) : sets));
  },

  setCheck(key: string, value: boolean): void {
    updateActive((log) => ({ ...log, checks: { ...log.checks, [key]: value } }));
  },

  setRounds(key: string, rounds: number): void {
    updateActive((log) => ({ ...log, rounds: { ...log.rounds, [key]: Math.max(0, rounds) } }));
  },

  finishWorkout(rpe: number | null, note: string): string | null {
    const active = state.active;
    if (!active) return null;
    const done: WorkoutLog = { ...active, finishedAt: Date.now(), rpe, note: note.trim() };
    commit({ ...state, active: null, logs: [...state.logs, done] });
    return done.id;
  },

  discardWorkout(): void {
    commit({ ...state, active: null });
  },

  deleteLog(id: string): void {
    commit({ ...state, logs: state.logs.filter((l) => l.id !== id) });
  },

  /** Sparar ett mätvärde. Ett nytt värde samma dag ersätter det tidigare. */
  logMetric(id: string, value: number, at = Date.now()): void {
    if (!getMetric(id)) return;
    const day = dayStart(at);
    const entries = (state.metrics[id] ?? []).filter((e) => dayStart(e.at) !== day);
    entries.push({ at, value });
    entries.sort((a, b) => a.at - b.at);
    commit({ ...state, metrics: { ...state.metrics, [id]: entries } });
  },

  deleteMetricEntry(id: string, at: number): void {
    const entries = (state.metrics[id] ?? []).filter((e) => e.at !== at);
    commit({ ...state, metrics: { ...state.metrics, [id]: entries } });
  },

  togglePin(id: string): void {
    const pinned = state.pinned.includes(id) ? state.pinned.filter((p) => p !== id) : [...state.pinned, id];
    commit({ ...state, pinned });
  },

  updateSettings(patch: Partial<Settings>): void {
    commit({ ...state, settings: { ...state.settings, ...patch } });
  },

  exportJson(): string {
    return JSON.stringify(state, null, 2);
  },

  importJson(text: string): boolean {
    try {
      const parsed = parseState(JSON.parse(text));
      if (!parsed) return false;
      // En säkerhetskopia med historik tillhör någon som redan har kommit igång.
      commit({ ...parsed, onboarded: parsed.onboarded || parsed.logs.length > 0 });
      return true;
    } catch {
      return false;
    }
  },

  resetAll(): void {
    commit(defaultState());
  },
};
