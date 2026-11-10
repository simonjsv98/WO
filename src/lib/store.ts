import { useSyncExternalStore } from 'react';
import { PROGRAMS } from '../data/programs';
import type { AppState, ResolvedSession, SetLog, Settings, WorkoutLog } from './types';

const STORAGE_KEY = 'wo.state.v1';

export function defaultState(): AppState {
  return {
    version: 1,
    programId: PROGRAMS[0].id,
    cycle: 1,
    logs: [],
    active: null,
    settings: { sound: true, vibrate: true, keepAwake: true },
  };
}

/** Validerar inläst data så att trasig lagring eller en felaktig importfil inte kraschar appen. */
export function parseState(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<AppState>;
  if (data.version !== 1 || !Array.isArray(data.logs)) return null;
  const base = defaultState();
  const validLog = (l: unknown): l is WorkoutLog =>
    !!l &&
    typeof l === 'object' &&
    typeof (l as WorkoutLog).id === 'string' &&
    typeof (l as WorkoutLog).startedAt === 'number' &&
    Array.isArray((l as WorkoutLog).entries);
  return {
    version: 1,
    programId: PROGRAMS.some((p) => p.id === data.programId) ? data.programId! : base.programId,
    cycle: typeof data.cycle === 'number' ? data.cycle : 1,
    logs: data.logs.filter(validLog),
    active: validLog(data.active) ? data.active : null,
    settings: { ...base.settings, ...(typeof data.settings === 'object' ? data.settings : {}) },
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
  selectProgram(programId: string): void {
    if (programId === state.programId) return;
    commit({ ...state, programId, cycle: state.cycle + 1 });
  },

  restartProgram(): void {
    commit({ ...state, cycle: state.cycle + 1 });
  },

  startWorkout(session: ResolvedSession): void {
    const log: WorkoutLog = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      programId: state.programId,
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
      commit(parsed);
      return true;
    } catch {
      return false;
    }
  },

  resetAll(): void {
    commit(defaultState());
  },
};
