import { describe, expect, it } from 'vitest';
import { niceMax } from '../components/BarChart';
import { axisBounds } from '../components/LineChart';
import { EXERCISES as ALL, alternativesFor, getExercise } from '../data/exercises';
import { PHASE_TEMPLATE_COUNT, buildProgram, describeItem, parseScheme, programFromId, resolveSession, timerTotalSec } from '../data/programs';
import { addDays, dayStart, defaultWeekdays, upcomingSessions, weekdayOf } from './schedule';
import { parseDecimal } from './format';
import {
  completedSessions,
  e1rm,
  exerciseHistory,
  exerciseSeries,
  logVolume,
  newRecords,
  nextSession,
  personalRecords,
  streakWeeks,
  weekStart,
  weeklySeries,
} from './stats';
import { parseState } from './store';
import { buildPhases, locate, READY_SEC } from './timer';
import type { WorkoutLog } from './types';

const DAY = 86_400_000;
// Onsdag 11 november 2026, mitt på dagen.
const NOW = new Date(2026, 10, 11, 12).getTime();

function log(partial: Partial<WorkoutLog>): WorkoutLog {
  return {
    id: Math.random().toString(36),
    programId: 'f0-gym-4',
    cycle: 1,
    week: 0,
    sessionId: 'd1',
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

const GYM4 = buildProgram(0, 'gym', 4);

describe('programdata', () => {
  const versions = ['gym', 'home'] as const;
  const dayCounts = [2, 3, 4] as const;

  it('varje fas, version och antal dagar ger kompletta pass för alla veckor', () => {
    for (let phase = 0; phase < PHASE_TEMPLATE_COUNT; phase++) {
      for (const version of versions) {
        for (const days of dayCounts) {
          const program = buildProgram(phase, version, days);
          expect(program.sessions).toHaveLength(days);
          for (let week = 0; week < 4; week++) {
            for (const tpl of program.sessions) {
              const session = resolveSession(program, week, tpl.id)!;
              expect(session.blocks.map((b) => b.type)).toEqual(['warmup', 'power', 'strength', 'conditioning', 'cooldown']);
              for (const block of session.blocks) {
                expect(block.items.length).toBeGreaterThan(0);
                if (block.format === 'timer') expect(block.timer).not.toBeNull();
                for (const item of block.items) {
                  expect(item.sets).toBeGreaterThan(0);
                  if (block.format !== 'timer') expect(item.target).not.toBe('');
                  // Ensidiga övningar ska alltid anges per sida, och tidsövningar i sekunder.
                  if (block.format === 'sets') {
                    expect(item.perSide).toBe(item.exercise.unilateral);
                    expect(item.targetSec !== null).toBe(item.exercise.tracking === 'time');
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  it('hemmaversionen använder bara övningar som går att göra hemma', () => {
    for (let phase = 0; phase < PHASE_TEMPLATE_COUNT; phase++) {
      for (const days of dayCounts) {
        const program = buildProgram(phase, 'home', days);
        const ids = program.sessions.flatMap((s) => s.blocks.flatMap((b) => b.items.map((i) => i.exerciseId)));
        expect(ids.filter((id) => !getExercise(id).home)).toEqual([]);
      }
    }
  });

  it('faserna har olika huvudlyft och fortsätter med nytt nummer efter sista mallen', () => {
    const main = (phase: number) => buildProgram(phase, 'gym', 4).sessions[0].blocks[2].items[0].exerciseId;
    expect([main(0), main(1)]).toEqual(['back-squat', 'front-squat']);
    expect(main(PHASE_TEMPLATE_COUNT)).toBe(main(0));
    expect(buildProgram(PHASE_TEMPLATE_COUNT, 'gym', 4).id).not.toBe(GYM4.id);
  });

  it('programFromId hittar tillbaka till samma program och avvisar gamla id:n', () => {
    expect(programFromId(GYM4.id)).toBe(GYM4);
    expect(programFromId('f2-home-3')!.days).toBe(3);
    expect(programFromId('atlet')).toBeNull();
  });

  it('har unika övnings-id:n', () => {
    expect(new Set(ALL.map((e) => e.id)).size).toBe(ALL.length);
  });

  it('veckorna skiljer sig åt: toppveckan är tyngre och sista veckan lättare', () => {
    const squat = (week: number) => resolveSession(GYM4, week, 'd1')!.blocks[2].items[0];
    expect(squat(0).exercise.id).toBe('back-squat');
    expect([squat(0).sets, squat(1).sets, squat(3).sets]).toEqual([3, 4, 2]);
    expect([squat(0).targetReps, squat(2).targetReps]).toEqual([8, 6]);
  });

  it('supersets får etiketter och vila först efter den andra övningen', () => {
    const items = resolveSession(GYM4, 0, 'd1')!.blocks[2].items;
    expect(items.map((i) => i.group)).toEqual(['A', 'B1', 'B2', 'C1', 'C2']);
    expect(items[1].restSec).toBe(0);
    expect(items[2].restSec).toBeGreaterThan(0);
  });

  it('beskriver mål i klartext', () => {
    const session = resolveSession(GYM4, 0, 'd1')!;
    expect(session.blocks[0].items.map((i) => describeItem(i, 'list'))).toEqual([
      '3 min',
      '8 reps',
      '5 reps/sida',
      '10 reps/sida',
      '2 × 10',
      '2 × 15',
    ]);
    // Bulgarisk utfallsböj är ensidig, farmers walk går på tid.
    expect(describeItem(session.blocks[2].items[3], 'sets')).toBe('2 × 10/sida');
    expect(describeItem(session.blocks[2].items[4], 'sets')).toBe('2 × 30 s');
  });

  it('okänt pass ger null', () => {
    expect(resolveSession(GYM4, 0, 'finns-inte')).toBeNull();
  });
});

describe('övningsbyten', () => {
  it('alternativ har samma rörelsemönster och är sorterade lättast först', () => {
    const alts = alternativesFor('back-squat');
    expect(alts.length).toBeGreaterThan(1);
    expect(alts.every((e) => e.pattern === 'squat' && e.id !== 'back-squat')).toBe(true);
    expect(alts.map((e) => e.level)).toEqual([...alts.map((e) => e.level)].sort());
    expect(alternativesFor('cat-cow')).toEqual([]);
  });

  it('ett byte ersätter övningen men behåller platsen, och upplägget följer den nya övningen', () => {
    const swapped = resolveSession(GYM4, 0, 'd1', { 'back-squat': 'goblet-squat', 'dead-bug': 'plank' })!.blocks[2].items;
    expect(swapped[0]).toMatchObject({ baseExerciseId: 'back-squat', group: 'A', sets: 3, targetReps: 8 });
    expect(swapped[0].exercise.id).toBe('goblet-squat');
    // Dead bug räknas i repetitioner, plankan i sekunder.
    expect(swapped[2].exercise.id).toBe('plank');
    expect(swapped[2].targetSec).toBe(30);
  });

  it('byten gäller inte uppvärmningen och okända ersättare ignoreras', () => {
    const session = resolveSession(GYM4, 0, 'd1', { 'glute-bridge': 'hip-thrust', 'back-squat': 'finns-inte' })!;
    expect(session.blocks[0].items.some((i) => i.exercise.id === 'hip-thrust')).toBe(false);
    expect(session.blocks[2].items[0].exercise.id).toBe('back-squat');
  });
});

describe('schema', () => {
  // NOW är en onsdag.
  const today = dayStart(NOW);

  it('standarddagar matchar antalet pass', () => {
    expect([2, 3, 4].map((d) => defaultWeekdays(d as 2 | 3 | 4).length)).toEqual([2, 3, 4]);
    expect(weekdayOf(NOW)).toBe(2);
  });

  it('lägger återstående pass på kommande träningsdagar i ordning', () => {
    const plan = upcomingSessions(GYM4, new Set(), [0, 1, 3, 4], [], NOW);
    expect(plan).toHaveLength(16);
    // Onsdag är vilodag: första passet hamnar på torsdag, sedan fredag, måndag, tisdag.
    expect(plan.slice(0, 4).map((p) => (p.date - today) / DAY)).toEqual([1, 2, 5, 6]);
    expect(plan.slice(0, 5).map((p) => `${p.week}:${p.sessionId}`)).toEqual(['0:d1', '0:d2', '0:d3', '0:d4', '1:d1']);
  });

  it('i dag är träningsdag tills ett pass är sparat i dag', () => {
    const before = upcomingSessions(GYM4, new Set(), [2, 4], [], NOW);
    expect(before[0].date).toBe(today);
    const after = upcomingSessions(GYM4, new Set(['0:d1']), [2, 4], [log({ finishedAt: NOW - 1000 })], NOW);
    expect(after[0]).toMatchObject({ week: 0, sessionId: 'd2', date: addDays(today, 2) });
  });

  it('avklarade pass hoppas över och en klar fas ger tomt schema', () => {
    const all = new Set(GYM4.weeks.flatMap((_, w) => GYM4.sessions.map((s) => `${w}:${s.id}`)));
    expect(upcomingSessions(GYM4, all, [0, 1, 3, 4], [], NOW)).toEqual([]);
    all.delete('2:d3');
    expect(upcomingSessions(GYM4, all, [0, 1, 3, 4], [], NOW).map((p) => p.sessionId)).toEqual(['d3']);
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
  const items = resolveSession(GYM4, 0, 'd1')!.blocks[3].items;

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
    const logs = [log({ week: 0, sessionId: 'd1' }), log({ week: 0, sessionId: 'd2' }), log({ week: 0, sessionId: 'd3', cycle: 0 })];
    const done = completedSessions(logs, 1);
    expect(done.size).toBe(2);
    expect(nextSession(GYM4, done)).toEqual({ week: 0, sessionId: 'd3' });

    const all = new Set(GYM4.weeks.flatMap((_, w) => GYM4.sessions.map((s) => `${w}:${s.id}`)));
    expect(nextSession(GYM4, all)).toBeNull();
  });

  it('personbästa i ett pass jämförs bara med tidigare pass', () => {
    const first = log({ id: 'a', finishedAt: NOW - 7 * DAY, entries: [{ key: 'k', exerciseId: 'rdl', sets: [set(60, 8)] }] });
    const better = log({ id: 'b', finishedAt: NOW, entries: [{ key: 'k', exerciseId: 'rdl', sets: [set(65, 8), set(50, 8)] }] });
    const worse = log({ id: 'c', finishedAt: NOW + DAY, entries: [{ key: 'k', exerciseId: 'rdl', sets: [set(60, 8)] }] });
    const logs = [first, better, worse];

    expect(newRecords(logs, first)).toMatchObject([{ exerciseId: 'rdl', previous: null }]);
    const [record] = newRecords(logs, better);
    expect(record).toMatchObject({ weight: 65, reps: 8 });
    expect(record.previous).toBeCloseTo(e1rm(60, 8));
    expect(newRecords(logs, worse)).toEqual([]);
    expect(exerciseSeries(logs, 'rdl').map((p) => Math.round(p.value))).toEqual([76, 82, 76]);
  });
});

describe('lagring och inmatning', () => {
  it('parseState avvisar skräp och reparerar okända värden', () => {
    expect(parseState(null)).toBeNull();
    expect(parseState({ version: 3, logs: [] })).toBeNull();
    const repaired = parseState({
      version: 2,
      onboarded: true,
      plan: { version: 'home', days: 3, weekdays: [0, 0, 9] },
      phase: -4,
      swaps: { 'back-squat': 'goblet-squat', 'finns-inte': 'plank', rdl: 'borta' },
      metrics: { weight: [{ at: 2, value: 81 }, { at: 1, value: 82 }, { trasig: true }], okänt: [{ at: 1, value: 1 }] },
      pinned: ['weight', 'okänt'],
      logs: [{ trasig: true }, log({})],
      settings: { sound: false },
    })!;
    expect(repaired.plan).toEqual({ version: 'home', days: 3, weekdays: [0, 2, 4] });
    expect(repaired.phase).toBe(0);
    expect(repaired.swaps).toEqual({ 'back-squat': 'goblet-squat' });
    expect(repaired.metrics).toEqual({ weight: [{ at: 1, value: 82 }, { at: 2, value: 81 }] });
    expect(repaired.pinned).toEqual(['weight']);
    expect(repaired.logs).toHaveLength(1);
    expect(repaired.settings).toMatchObject({ sound: false, vibrate: true, restTimer: true });
  });

  it('data från första versionen flyttas över med historiken kvar och fasen från början', () => {
    const old = { version: 1, programId: 'hemma', cycle: 3, logs: [log({ cycle: 3 })], active: log({ finishedAt: null }), settings: { vibrate: false } };
    const migrated = parseState(old)!;
    expect(migrated).toMatchObject({ version: 2, onboarded: true, phase: 0, cycle: 4, active: null });
    expect(migrated.plan).toMatchObject({ version: 'home', days: 3 });
    expect(migrated.logs).toHaveLength(1);
    expect(migrated.settings).toMatchObject({ vibrate: false, autofill: true });
    // Gamla pass räknas inte som avklarade i den nya fasen.
    expect(completedSessions(migrated.logs, migrated.cycle).size).toBe(0);
    // En tom gammal installation får välja upplägg först.
    expect(parseState({ version: 1, programId: 'atlet', logs: [] })!.onboarded).toBe(false);
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
    expect(axisBounds([81.2, 82.9])).toEqual([80.8, 83.3].map((v) => expect.closeTo(v, 5)));
    expect(axisBounds([80, 80])).toEqual([76, 84]);
    expect(axisBounds([0.5, 2])[0]).toBeGreaterThanOrEqual(0);
  });
});
