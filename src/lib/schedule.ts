import type { Days, Program } from './types';
import { finished, sessionKey, type SessionRef } from './stats';
import type { WorkoutLog } from './types';

export const WEEKDAY_SHORT = ['Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör', 'Sön'];
export const WEEKDAY_LONG = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'];

export function defaultWeekdays(days: Days): number[] {
  return days === 4 ? [0, 1, 3, 4] : days === 3 ? [0, 2, 4] : [0, 3];
}

/** Midnatt lokal tid för dagen som innehåller tidpunkten. */
export function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(day: number, count: number): number {
  const d = new Date(day);
  d.setDate(d.getDate() + count);
  return d.getTime();
}

/** Veckodag där 0 är måndag. */
export const weekdayOf = (ts: number): number => (new Date(ts).getDay() + 6) % 7;

export interface Planned extends SessionRef {
  /** Midnatt för dagen passet är planerat. */
  date: number;
}

/**
 * Lägger ut alla pass som återstår i fasen på kommande träningsdagar.
 * Schemat räknas om från i dag varje gång, så ett missat pass flyttas fram i stället för att hamna efter.
 * I dag räknas som träningsdag bara om inget pass redan är sparat i dag.
 */
export function upcomingSessions(
  program: Program,
  done: Set<string>,
  weekdays: number[],
  logs: WorkoutLog[],
  now = Date.now(),
): Planned[] {
  const remaining: SessionRef[] = [];
  for (let week = 0; week < program.weeks.length; week++) {
    for (const session of program.sessions) {
      if (!done.has(sessionKey(week, session.id))) remaining.push({ week, sessionId: session.id });
    }
  }
  const training = new Set(weekdays.length ? weekdays : defaultWeekdays(program.days));
  const today = dayStart(now);
  const trainedToday = finished(logs).some((l) => dayStart(l.finishedAt!) === today);

  const out: Planned[] = [];
  let day = trainedToday ? addDays(today, 1) : today;
  for (const ref of remaining) {
    while (!training.has(weekdayOf(day))) day = addDays(day, 1);
    out.push({ ...ref, date: day });
    day = addDays(day, 1);
  }
  return out;
}
