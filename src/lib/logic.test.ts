import { describe, expect, it } from 'vitest';
import { niceMax } from '../components/BarChart';
import { EXERCISES } from '../data/exercises';
import { PROGRAMS, describeItem, parseScheme, resolveSession, timerTotalSec } from '../data/programs';
import { parseDecimal } from './format';
import {
  completedSessions,
  e1rm,
  exerciseHistory,
  logVolume,
  nextSession,
  personalRecords,
  streakWeeks,
  weekStart,
  weeklySeries,
} from './stats';
import { defaultState, parseState } from './store';
import { buildPhases, locate, READY_SEC } from './timer';
import type { WorkoutLog } from './types';

const DAY = 86_400_000;
// Onsdag 11 november 2026, mitt på dagen.
const NOW = new Date(2026, 10, 11, 12).getTime();

function log(partial: Partial<WorkoutLog>): WorkoutLog {
  return {
    id: Math.random().toString(36),
    programId: 'atlet',
    cycle: 1,
    week: 0,
    sessionId: 'a',
    sessionName: 'Underkropp',
    startedAt: NOW - 3600_000,
    finishedAt: NOW,
    entries: [],
    checks: {},
    rounds: {},
    rpe: null,
    note: '',
    ...partial,
  };
}

const set = (weight: number | null, reps: number, done = true) => ({ weight, reps, done });

describe('programdata', () => {
  it('varje pass i varje vecka går att lösa upp och pekar på kända övningar', () => {
    for (const program of PROGRAMS) {
      for (let week = 0; week < 4; week++) {
        for (const tpl of program.sessions) {
          const session = resolveSession(program, week, tpl.id);
          expect(session).not.toBeNull();
          for (const block of session!.blocks) {
            expect(block.items.length).toBeGreaterThan(0);
            if (block.format === 'timer') expect(block.timer).not.toBeNull();
            for (const item of block.items) {
              expect(item.sets).toBeGreaterThan(0);
              if (block.format !== 'timer') expect(item.target).not.toBe('');
            }
          }
        }
      }
    }
  });

  it('har unika övnings-id:n', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
  });

  it('veckorna skiljer sig åt: toppveckan är tyngre och sista veckan lättare', () => {
    const squat = (week: number) =>
      resolveSession(PROGRAMS[0], week, 'a')!.blocks.flatMap((b) => b.items).find((i) => i.exercise.id === 'back-squat')!;
    expect([squat(0).sets, squat(2).sets, squat(3).sets]).toEqual([3, 5, 3]);
    expect([squat(0).targetReps, squat(2).targetReps]).toEqual([8, 5]);
  });

  it('beskriver mål i klartext', () => {
    const warmup = resolveSession(PROGRAMS[0], 0, 'a')!.blocks[0];
    expect(warmup.items.map((i) => describeItem(i, 'list'))).toEqual(['3 min', '8 reps', '5 reps/sida', '2 × 10', '10 reps/sida']);
    const strength = resolveSession(PROGRAMS[0], 0, 'a')!.blocks[2];
    expect(describeItem(strength.items[2], 'sets')).toBe('2 × 8/sida');
  });

  it('okänt pass ger null', () => {
    expect(resolveSession(PROGRAMS[0], 0, 'finns-inte')).toBeNull();
  });
});

describe('parseScheme', () => {
  it('tolkar set och repetitioner', () => {
    expect(parseScheme('3x8')).toEqual({ sets: 3, target: '8', targetReps: 8, targetSec: null, perSide: false });
    expect(parseScheme('2x10/sida')).toMatchObject({ sets: 2, target: '10/sida', targetReps: 10, perSide: true });
  });

  it('tolkar tid, med och utan sida', () => {
    expect(parseScheme('60s')).toEqual({ sets: 1, target: '1 min', targetReps: null, targetSec: 60, perSide: false });
    expect(parseScheme('45s/sida')).toMatchObject({ target: '45 s/sida', targetSec: 45, perSide: true });
  });

  it('tom sträng ger ett set utan mål', () => {
    expect(parseScheme('')).toEqual({ sets: 1, target: '', targetReps: null, targetSec: null, perSide: false });
  });
});

describe('timer', () => {
  const items = resolveSession(PROGRAMS[0], 0, 'a')!.blocks[3].items;

  it('intervaller: nedräkning, arbete och vila utan vila efter sista varvet', () => {
    const phases = buildPhases({ kind: 'intervals', workSec: 30, restSec: 15, rounds: 3 }, items);
    expect(phases.map((p) => p.kind)).toEqual(['ready', 'work', 'rest', 'work', 'rest', 'work']);
    expect(phases[1].label).toContain('Dead bug');
    expect(phases[2].next).toContain('Sidoplanka');
    const total = phases.reduce((n, p) => n + p.sec, 0);
    expect(total - READY_SEC).toBe(timerTotalSec({ kind: 'intervals', workSec: 30, restSec: 15, rounds: 3 }));
  });

  it('EMOM växlar övning varje minut', () => {
    const phases = buildPhases({ kind: 'emom', minutes: 4 }, items.slice(0, 2));
    expect(phases.filter((p) => p.kind === 'work').map((p) => p.sec)).toEqual([60, 60, 60, 60]);
    expect(phases[1].label).not.toBe(phases[2].label);
    expect(phases[1].label).toBe(phases[3].label);
  });

  it('locate hittar rätt fas och markerar slutet', () => {
    const phases = buildPhases({ kind: 'intervals', workSec: 30, restSec: 15, rounds: 2 }, items);
    expect(locate(phases, 0)).toMatchObject({ index: 0, remaining: 5, finished: false });
    expect(locate(phases, 5)).toMatchObject({ index: 1, remaining: 30 });
    expect(locate(phases, 36)).toMatchObject({ index: 2, remaining: 14 });
    expect(locate(phases, 80)).toMatchObject({ finished: true, progress: 1, remaining: 0 });
  });
});

describe('statistik', () => {
  it('volym räknar bara genomförda set med vikt', () => {
    const l = log({
      entries: [{ key: '2.0', exerciseId: 'back-squat', sets: [set(100, 5), set(100, 5, false), set(null, 10)] }],
    });
    expect(logVolume(l)).toBe(500);
  });

  it('personbästa väljer högst uppskattat maxlyft', () => {
    const logs = [
      log({ entries: [{ key: '2.0', exerciseId: 'back-squat', sets: [set(100, 5), set(110, 1)] }] }),
      log({ finishedAt: NOW - DAY, entries: [{ key: '2.0', exerciseId: 'back-squat', sets: [set(90, 10)] }] }),
    ];
    const [record] = personalRecords(logs);
    expect(record).toMatchObject({ weight: 90, reps: 10 });
    expect(record.e1rm).toBeCloseTo(e1rm(90, 10));
    expect(e1rm(100, 1)).toBe(100);
  });

  it('övningshistorik kommer med senaste passet först och utan pågående pass', () => {
    const logs = [
      log({ finishedAt: NOW - 2 * DAY, entries: [{ key: 'k', exerciseId: 'rdl', sets: [set(60, 8)] }] }),
      log({ finishedAt: NOW, entries: [{ key: 'k', exerciseId: 'rdl', sets: [set(70, 8)] }] }),
      log({ finishedAt: null, entries: [{ key: 'k', exerciseId: 'rdl', sets: [set(999, 1)] }] }),
    ];
    expect(exerciseHistory(logs, 'rdl').map((h) => h.sets[0].weight)).toEqual([70, 60]);
  });

  it('veckan börjar på måndag', () => {
    const start = new Date(weekStart(NOW));
    expect([start.getDay(), start.getDate(), start.getHours()]).toEqual([1, 9, 0]);
    // Söndag hör till veckan som började måndagen innan.
    expect(new Date(weekStart(new Date(2026, 10, 15, 23).getTime())).getDate()).toBe(9);
  });

  it('veckoserien lägger pass i rätt vecka', () => {
    const logs = [log({}), log({ finishedAt: NOW - 7 * DAY }), log({ finishedAt: NOW - 7 * DAY }), log({ finishedAt: NOW - 70 * DAY })];
    const series = weeklySeries(logs, 8, NOW);
    expect(series).toHaveLength(8);
    expect(series.map((b) => b.sessions)).toEqual([0, 0, 0, 0, 0, 0, 2, 1]);
    expect(series[7].minutes).toBe(60);
  });

  it('sviten räknar veckor i rad och tål att veckans pass inte är gjort än', () => {
    expect(streakWeeks([], NOW)).toBe(0);
    expect(streakWeeks([log({})], NOW)).toBe(1);
    expect(streakWeeks([log({ finishedAt: NOW - 7 * DAY }), log({ finishedAt: NOW - 14 * DAY })], NOW)).toBe(2);
    expect(streakWeeks([log({ finishedAt: NOW - 14 * DAY })], NOW)).toBe(0);
  });

  it('nästa pass följer programordningen och bara aktuell omgång räknas', () => {
    const program = PROGRAMS[0];
    const logs = [log({ week: 0, sessionId: 'a' }), log({ week: 0, sessionId: 'b' }), log({ week: 0, sessionId: 'c', cycle: 0 })];
    const done = completedSessions(logs, 'atlet', 1);
    expect(done.size).toBe(2);
    expect(nextSession(program, done)).toEqual({ week: 0, sessionId: 'c' });

    const all = new Set(program.weeks.flatMap((_, w) => program.sessions.map((s) => `${w}:${s.id}`)));
    expect(nextSession(program, all)).toBeNull();
  });
});

describe('lagring och inmatning', () => {
  it('parseState avvisar skräp och reparerar okända värden', () => {
    expect(parseState(null)).toBeNull();
    expect(parseState({ version: 2, logs: [] })).toBeNull();
    const repaired = parseState({ version: 1, programId: 'borta', logs: [{ trasig: true }, log({})], settings: { sound: false } });
    expect(repaired).toMatchObject({ programId: defaultState().programId, settings: { sound: false, vibrate: true } });
    expect(repaired!.logs).toHaveLength(1);
  });

  it('parseDecimal klarar decimalkomma och avvisar ogiltigt', () => {
    expect(parseDecimal('62,5')).toBe(62.5);
    expect(parseDecimal(' 40 ')).toBe(40);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('-5')).toBeNull();
  });

  it('niceMax ger jämna axelvärden', () => {
    expect([niceMax(0), niceMax(3), niceMax(5), niceMax(130), niceMax(7400)]).toEqual([4, 4, 8, 200, 8000]);
  });
});
