import { useStore } from '../lib/store';
import { exerciseHistory, e1rm } from '../lib/stats';
import { formatDayMonth, formatNumber } from '../lib/format';
import type { Exercise, SetLog } from '../lib/types';

export function describeSets(sets: SetLog[], unit = 'kg'): string {
  return sets
    .map((s) => (s.weight ? `${formatNumber(s.weight)} ${unit} × ${s.reps ?? '–'}` : `${s.reps ?? '–'}`))
    .join(' · ');
}

/** Beskrivning, teknikpunkter och egen historik för en övning. */
export function ExerciseInfo({ exercise }: { exercise: Exercise }) {
  const logs = useStore((s) => s.logs);
  const history = exerciseHistory(logs, exercise.id);
  const best = history
    .flatMap((h) => h.sets)
    .filter((s) => s.weight && s.reps)
    .reduce<SetLog | null>((top, s) => (!top || e1rm(s.weight!, s.reps!) > e1rm(top.weight!, top.reps!) ? s : top), null);

  return (
    <div className="stack">
      <div className="chip-row">
        <span className="chip">{exercise.category}</span>
        <span className="chip">{exercise.equipment}</span>
      </div>
      <p>{exercise.description}</p>

      <section>
        <h3 className="label">Tänk på</h3>
        <ol className="cues">
          {exercise.cues.map((cue) => (
            <li key={cue}>{cue}</li>
          ))}
        </ol>
      </section>

      <section>
        <h3 className="label">Muskler</h3>
        <p className="muted">{exercise.muscles.join(', ')}</p>
      </section>

      {best && (
        <section>
          <h3 className="label">Ditt bästa</h3>
          <p>
            <strong className="num">
              {formatNumber(best.weight!)} kg × {best.reps}
            </strong>{' '}
            <span className="muted">≈ {formatNumber(Math.round(e1rm(best.weight!, best.reps!)))} kg i maxlyft</span>
          </p>
        </section>
      )}

      {history.length > 0 && (
        <section>
          <h3 className="label">Senaste gångerna</h3>
          <ul className="plain-list">
            {history.slice(0, 5).map((h) => (
              <li key={h.at} className="history-row">
                <span className="muted">{formatDayMonth(h.at)}</span>
                <span className="num">{describeSets(h.sets)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
