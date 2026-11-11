import { buildProgram } from '../data/programs';
import { upcomingSessions } from './schedule';
import { completedSessions, sessionKey } from './stats';
import { useStore } from './store';

/** Aktuell fas med avklarade pass och schemat för de pass som återstår. */
export function useProgram() {
  const plan = useStore((s) => s.plan);
  const phase = useStore((s) => s.phase);
  const cycle = useStore((s) => s.cycle);
  const logs = useStore((s) => s.logs);
  const swaps = useStore((s) => s.swaps);

  const program = buildProgram(phase, plan.version, plan.days);
  const done = completedSessions(logs, cycle);
  const upcoming = upcomingSessions(program, done, plan.weekdays, logs);
  const total = program.weeks.length * program.sessions.length;
  const doneCount = program.weeks.reduce(
    (n, _, week) => n + program.sessions.filter((s) => done.has(sessionKey(week, s.id))).length,
    0,
  );

  return { plan, phase, logs, swaps, program, done, upcoming, next: upcoming[0] ?? null, total, doneCount };
}
