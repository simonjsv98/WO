import type { ResolvedItem, TimerSpec } from './types';

export interface Phase {
  kind: 'ready' | 'work' | 'rest';
  sec: number;
  /** Vad som ska göras i fasen. */
  label: string;
  /** Vad som kommer härnäst (visas under vila och nedräkning). */
  next?: string;
  round: number;
  rounds: number;
}

export const READY_SEC = 5;

const itemLabel = (item: ResolvedItem): string =>
  item.target ? `${item.exercise.name} · ${item.target}` : item.exercise.name;

/** Bygger hela fasföljden för ett timerblock, inklusive en kort nedräkning först. */
export function buildPhases(spec: TimerSpec, items: ResolvedItem[]): Phase[] {
  const labels = items.length ? items.map(itemLabel) : ['Arbete'];
  const at = (i: number) => labels[i % labels.length];
  const phases: Phase[] = [];

  if (spec.kind === 'amrap') {
    phases.push({ kind: 'ready', sec: READY_SEC, label: 'Gör dig redo', next: at(0), round: 1, rounds: 1 });
    phases.push({ kind: 'work', sec: spec.minutes * 60, label: 'Så många varv som möjligt', round: 1, rounds: 1 });
    return phases;
  }

  const rounds = spec.kind === 'intervals' ? spec.rounds : spec.minutes;
  const workSec = spec.kind === 'intervals' ? spec.workSec : 60;
  const restSec = spec.kind === 'intervals' ? spec.restSec : 0;

  phases.push({ kind: 'ready', sec: READY_SEC, label: 'Gör dig redo', next: at(0), round: 1, rounds });
  for (let r = 0; r < rounds; r++) {
    phases.push({ kind: 'work', sec: workSec, label: at(r), round: r + 1, rounds });
    if (restSec > 0 && r < rounds - 1) {
      phases.push({ kind: 'rest', sec: restSec, label: 'Vila', next: at(r + 1), round: r + 1, rounds });
    }
  }
  return phases;
}

export interface Position {
  index: number;
  phase: Phase;
  /** Sekunder kvar i fasen. */
  remaining: number;
  /** Andel av hela timern som är avklarad, 0–1. */
  progress: number;
  finished: boolean;
}

/** Var i fasföljden man befinner sig efter ett antal sekunder. */
export function locate(phases: Phase[], elapsedSec: number): Position {
  const total = phases.reduce((n, p) => n + p.sec, 0);
  let start = 0;
  for (let i = 0; i < phases.length; i++) {
    const end = start + phases[i].sec;
    if (elapsedSec < end) {
      return { index: i, phase: phases[i], remaining: end - elapsedSec, progress: elapsedSec / total, finished: false };
    }
    start = end;
  }
  const last = phases.length - 1;
  return { index: last, phase: phases[last], remaining: 0, progress: 1, finished: true };
}
