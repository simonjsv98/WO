export type BlockType = 'warmup' | 'power' | 'strength' | 'conditioning' | 'cooldown';
export type Category = 'Styrka' | 'Kraft' | 'Kondition' | 'Bål' | 'Rörlighet';

/** Hur en övning loggas: vikt + reps, bara reps, eller tid. */
export type Tracking = 'load' | 'reps' | 'time';

export interface Exercise {
  id: string;
  name: string;
  category: Category;
  muscles: string[];
  equipment: string;
  tracking: Tracking;
  description: string;
  cues: string[];
}

/** Upplägg per vecka ("3x8", "2x10/sida", "60s"). En sträng gäller alla veckor. */
export type Scheme = string | [string, string, string, string];

export interface PlanItem {
  exerciseId: string;
  scheme: Scheme;
  restSec?: number;
  note?: string;
}

export type TimerSpec =
  | { kind: 'intervals'; workSec: number; restSec: number; rounds: number }
  | { kind: 'emom'; minutes: number }
  | { kind: 'amrap'; minutes: number };

export interface BlockTemplate {
  type: BlockType;
  title?: string;
  /** list = bocka av, sets = logga set, timer = intervaller/EMOM/AMRAP. */
  format: 'list' | 'sets' | 'timer';
  /** Bara för format "timer". En spec gäller alla veckor. */
  timer?: TimerSpec | [TimerSpec, TimerSpec, TimerSpec, TimerSpec];
  intro?: string;
  items: PlanItem[];
}

export interface SessionTemplate {
  id: string;
  name: string;
  focus: string;
  estMin: number;
  blocks: BlockTemplate[];
}

export interface WeekInfo {
  title: string;
  focus: string;
}

export interface Program {
  id: string;
  name: string;
  tagline: string;
  description: string;
  level: string;
  equipment: string;
  weeks: [WeekInfo, WeekInfo, WeekInfo, WeekInfo];
  sessions: SessionTemplate[];
}

/* ---------- Upplöst pass för en viss vecka ---------- */

export interface ResolvedItem {
  key: string;
  exercise: Exercise;
  sets: number;
  /** Målet för ett set som text: "8", "8/sida", "30 s", "3 min". */
  target: string;
  targetReps: number | null;
  targetSec: number | null;
  perSide: boolean;
  restSec: number;
  note?: string;
}

export interface ResolvedBlock {
  key: string;
  type: BlockType;
  title: string;
  format: 'list' | 'sets' | 'timer';
  timer: TimerSpec | null;
  intro?: string;
  items: ResolvedItem[];
}

export interface ResolvedSession {
  id: string;
  name: string;
  focus: string;
  estMin: number;
  week: number;
  blocks: ResolvedBlock[];
}

/* ---------- Loggar ---------- */

export interface SetLog {
  weight: number | null;
  reps: number | null;
  done: boolean;
}

export interface EntryLog {
  key: string;
  exerciseId: string;
  sets: SetLog[];
}

export interface WorkoutLog {
  id: string;
  programId: string;
  cycle: number;
  week: number;
  sessionId: string;
  sessionName: string;
  startedAt: number;
  finishedAt: number | null;
  /** Loggade set för block med format "sets". */
  entries: EntryLog[];
  /** Avbockade listövningar (nyckel = övningsnyckel) och klara timerblock (nyckel = blocknyckel). */
  checks: Record<string, boolean>;
  /** Antal varv i AMRAP-block. */
  rounds: Record<string, number>;
  rpe: number | null;
  note: string;
}

export interface Settings {
  sound: boolean;
  vibrate: boolean;
  keepAwake: boolean;
}

export interface AppState {
  version: 1;
  programId: string;
  cycle: number;
  logs: WorkoutLog[];
  active: WorkoutLog | null;
  settings: Settings;
}
