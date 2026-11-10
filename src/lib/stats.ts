import type { Program, SetLog, WorkoutLog } from './types';

export const finished = (logs: WorkoutLog[]): WorkoutLog[] => logs.filter((l) => l.finishedAt !== null);

export function logDurationSec(log: WorkoutLog, now = Date.now()): number {
  return Math.max(0, Math.round(((log.finishedAt ?? now) - log.startedAt) / 1000));
}

export function logVolume(log: WorkoutLog): number {
  let total = 0;
  for (const entry of log.entries) {
    for (const set of entry.sets) {
      if (set.done && set.weight && set.reps) total += set.weight * set.reps;
    }
  }
  return total;
}

export function logSetCount(log: WorkoutLog): number {
  return log.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
}

/** Uppskattat maxlyft enligt Epley. */
export function e1rm(weight: number, reps: number): number {
  return reps <= 1 ? weight : weight * (1 + reps / 30);
}

export interface Performance {
  at: number;
  sets: SetLog[];
}

/** Genomförda set för en övning, senaste passet först. */
export function exerciseHistory(logs: WorkoutLog[], exerciseId: string): Performance[] {
  const out: Performance[] = [];
  for (const log of finished(logs)) {
    const sets = log.entries
      .filter((e) => e.exerciseId === exerciseId)
      .flatMap((e) => e.sets)
      .filter((s) => s.done);
    if (sets.length) out.push({ at: log.finishedAt!, sets });
  }
  return out.sort((a, b) => b.at - a.at);
}

export interface Record_ {
  exerciseId: string;
  weight: number;
  reps: number;
  e1rm: number;
  at: number;
}

/** Bästa uppskattade maxlyft per övning, starkast först. */
export function personalRecords(logs: WorkoutLog[]): Record_[] {
  const best = new Map<string, Record_>();
  for (const log of finished(logs)) {
    for (const entry of log.entries) {
      for (const set of entry.sets) {
        if (!set.done || !set.weight || !set.reps) continue;
        const value = e1rm(set.weight, set.reps);
        const current = best.get(entry.exerciseId);
        if (!current || value > current.e1rm) {
          best.set(entry.exerciseId, {
            exerciseId: entry.exerciseId,
            weight: set.weight,
            reps: set.reps,
            e1rm: value,
            at: log.finishedAt!,
          });
        }
      }
    }
  }
  return [...best.values()].sort((a, b) => b.e1rm - a.e1rm);
}

/** Måndag 00:00 lokal tid för veckan som innehåller tidpunkten. */
export function weekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** Måndagen ett antal veckor tidigare (tål sommartidsbyten). */
function shiftWeeks(start: number, weeks: number): number {
  const d = new Date(start);
  d.setDate(d.getDate() + weeks * 7);
  return d.getTime();
}

export interface WeekBucket {
  start: number;
  sessions: number;
  minutes: number;
  volume: number;
}

/** De senaste veckorna, äldst först. Sista elementet är innevarande vecka. */
export function weeklySeries(logs: WorkoutLog[], weeks: number, now = Date.now()): WeekBucket[] {
  const current = weekStart(now);
  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    buckets.push({ start: shiftWeeks(current, -i), sessions: 0, minutes: 0, volume: 0 });
  }
  const index = new Map(buckets.map((b) => [b.start, b]));
  for (const log of finished(logs)) {
    const bucket = index.get(weekStart(log.finishedAt!));
    if (!bucket) continue;
    bucket.sessions += 1;
    bucket.minutes += Math.round(logDurationSec(log) / 60);
    bucket.volume += logVolume(log);
  }
  return buckets;
}

/** Antal veckor i rad med minst ett pass. En vecka utan pass än så länge bryter inte sviten. */
export function streakWeeks(logs: WorkoutLog[], now = Date.now()): number {
  const active = new Set(finished(logs).map((l) => weekStart(l.finishedAt!)));
  let cursor = weekStart(now);
  if (!active.has(cursor)) cursor = shiftWeeks(cursor, -1);
  let streak = 0;
  while (active.has(cursor)) {
    streak += 1;
    cursor = shiftWeeks(cursor, -1);
  }
  return streak;
}

export const sessionKey = (week: number, sessionId: string): string => `${week}:${sessionId}`;

/** Vilka pass som är avklarade i aktuell omgång av programmet. */
export function completedSessions(logs: WorkoutLog[], programId: string, cycle: number): Set<string> {
  const done = new Set<string>();
  for (const log of finished(logs)) {
    if (log.programId === programId && log.cycle === cycle) done.add(sessionKey(log.week, log.sessionId));
  }
  return done;
}

export interface SessionRef {
  week: number;
  sessionId: string;
}

/** Första pass i programordning som inte är avklarat, eller null när månaden är klar. */
export function nextSession(program: Program, done: Set<string>): SessionRef | null {
  for (let week = 0; week < program.weeks.length; week++) {
    for (const session of program.sessions) {
      if (!done.has(sessionKey(week, session.id))) return { week, sessionId: session.id };
    }
  }
  return null;
}
