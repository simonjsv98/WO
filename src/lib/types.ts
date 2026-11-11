export type BlockType = 'warmup' | 'power' | 'strength' | 'conditioning' | 'cooldown';
export type Category = 'Styrka' | 'Kraft' | 'Kondition' | 'Bål' | 'Rörlighet';

/** Hur en övning loggas: vikt + reps, bara reps, eller tid. */
export type Tracking = 'load' | 'reps' | 'time';

export type Pattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'hpush'
  | 'vpush'
  | 'hpull'
  | 'vpull'
  | 'shoulder'
  | 'jump'
  | 'throw'
  | 'core'
  | 'carry'
  | 'calf'
  | 'cardio'
  | 'mobility';

export interface Exercise {
  id: string;
  name: string;
  category: Category;
  muscles: string[];
  equipment: string;
  tracking: Tracking;
  description: string;
  cues: string[];
  pattern: Pattern;
  /** Svårighetsnivå inom rörelsemönstret, 1 är lättast. */
  level: 1 | 2 | 3;
  /** Går att göra hemma med hantlar, kettlebell och gummiband. */
  home: boolean;
  /** Görs en sida i taget. */
  unilateral: boolean;
}

/** Upplägg per vecka ("3x8", "2x10/sida", "60s"). En sträng gäller alla veckor. */
export type Scheme = string | [string, string, string, string];

/** Övningens roll i passet. Styr set, repetitioner och vila för fasen. */
export type Role = 'main' | 'acc' | 'power' | 'core' | 'extra';

export interface PlanItem {
  exerciseId: string;
  /** Fast upplägg. Utelämnas för övningar som följer fasens upplägg för sin roll. */
  scheme?: Scheme;
  role?: Role;
  restSec?: number;
  note?: string;
  /** Etikett i passet: "A", eller "B1" och "B2" för ett superset. */
  group?: string;
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

export type Version = 'gym' | 'home';
export type Days = 2 | 3 | 4;

export interface Program {
  id: string;
  /** Fasens ordningsnummer, 0 är första fasen. */
  phase: number;
  version: Version;
  days: Days;
  name: string;
  tagline: string;
  description: string;
  equipment: string;
  weeks: [WeekInfo, WeekInfo, WeekInfo, WeekInfo];
  schemes: Record<Role, [string, string, string, string]>;
  /** Upplägg för bålövningar som görs på tid. */
  coreTime: [string, string, string, string];
  rest: Record<Role, number>;
  sessions: SessionTemplate[];
}

/* ---------- Upplöst pass för en viss vecka ---------- */

export interface ResolvedItem {
  key: string;
  exercise: Exercise;
  /** Programmets ursprungliga övning. Skiljer sig från exercise.id när användaren har bytt. */
  baseExerciseId: string;
  /** Etikett som "A" eller "B1". Null utanför styrke- och kraftblocken. */
  group: string | null;
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
  /** Starta vilotimern automatiskt när ett set bockas av. */
  restTimer: boolean;
  /** Föreslå förra passets vikter. */
  autofill: boolean;
}

export interface Plan {
  version: Version;
  days: Days;
  /** Träningsdagar, 0 är måndag. Lika många som days. */
  weekdays: number[];
}

export interface MetricEntry {
  at: number;
  value: number;
}

export interface AppState {
  version: 2;
  onboarded: boolean;
  plan: Plan;
  /** Aktuell fas, 0 är första. */
  phase: number;
  /** Ökar varje gång en fas startas eller startas om. Avgör vilka pass som räknas som avklarade. */
  cycle: number;
  /** Egna övningsbyten: programmets övning → vald ersättare. Nollställs vid ny fas. */
  swaps: Record<string, string>;
  metrics: Record<string, MetricEntry[]>;
  /** Mått som visas som höjdpunkter på Idag och Du. */
  pinned: string[];
  logs: WorkoutLog[];
  active: WorkoutLog | null;
  settings: Settings;
}
