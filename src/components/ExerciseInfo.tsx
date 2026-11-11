import { alternativesFor, compareLevel, getExercise } from '../data/exercises';
import { formatDayMonth, formatNumber } from '../lib/format';
import { e1rm, exerciseHistory, exerciseSeries } from '../lib/stats';
import { useStore } from '../lib/store';
import type { Exercise, SetLog } from '../lib/types';
import { Icon } from './Icon';
import { LineChart } from './LineChart';

export function describeSets(sets: SetLog[], unit = 'kg'): string {
  return sets
    .map((s) => (s.weight ? `${formatNumber(s.weight)} ${unit} × ${s.reps ?? '–'}` : `${s.reps ?? '–'}`))
    .join(' · ');
}

const videoUrl = (exercise: Exercise): string =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise.name} teknik`)}`;

interface Props {
  exercise: Exercise;
  /** Programmets övning på den här platsen. Med onSwap går alternativen att välja. */
  baseId?: string;
  onSwap?: (replacementId: string) => void;
  /** Öppnar ett alternativ för läsning, där byte inte är aktuellt. */
  onOpen?: (exerciseId: string) => void;
}

/** Beskrivning, teknikpunkter, alternativ och egen historik för en övning. */
export function ExerciseInfo({ exercise, baseId, onSwap, onOpen }: Props) {
  const logs = useStore((s) => s.logs);
  const history = exerciseHistory(logs, exercise.id);
  const series = exerciseSeries(logs, exercise.id);
  const best = history
    .flatMap((h) => h.sets)
    .filter((s) => s.weight && s.reps)
    .reduce<SetLog | null>((top, s) => (!top || e1rm(s.weight!, s.reps!) > e1rm(top.weight!, top.reps!) ? s : top), null);

  // Alternativen utgår från programmets övning, så att man alltid kan byta tillbaka.
  const base = getExercise(baseId ?? exercise.id);
  const alternatives = [base, ...alternativesFor(base.id)].filter((e) => e.id !== exercise.id);

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

      <a className="link-row" href={videoUrl(exercise)} target="_blank" rel="noreferrer">
        <Icon name="play" size={16} />
        <span>Sök videoexempel på YouTube</span>
      </a>

      <section>
        <h3 className="label">Muskler</h3>
        <p className="muted">{exercise.muscles.join(', ')}</p>
      </section>

      {alternatives.length > 0 && (
        <section>
          <h3 className="label">Alternativ</h3>
          <ul className="plain-list">
            {alternatives.map((alt) => (
              <li key={alt.id} className="alt-row">
                <button className="alt-main" onClick={() => onOpen?.(alt.id)} disabled={!onOpen}>
                  <span className="alt-name">{alt.name}</span>
                  <span className="muted small">
                    {alt.id === base.id && exercise.id !== base.id ? 'Programmets val' : compareLevel(alt, exercise)} ·{' '}
                    {alt.equipment}
                  </span>
                </button>
                {onSwap && (
                  <button className="pill-btn" onClick={() => onSwap(alt.id)} aria-label={`Byt till ${alt.name}`}>
                    <Icon name="swap" size={16} /> Byt
                  </button>
                )}
              </li>
            ))}
          </ul>
          {onSwap && <p className="muted small">Bytet gäller resten av fasen. Du kan byta tillbaka när du vill.</p>}
        </section>
      )}

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

      {series.length >= 2 && (
        <section>
          <h3 className="label">Uppskattat maxlyft över tid</h3>
          <LineChart points={series} measure="Maxlyft" format={(v) => `${formatNumber(Math.round(v))} kg`} />
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
