import { useState } from 'react';
import { BarChart } from '../components/BarChart';
import { describeSets } from '../components/ExerciseInfo';
import { Icon } from '../components/Icon';
import { ConfirmSheet } from '../components/Sheet';
import { EXERCISES, getExercise } from '../data/exercises';
import { formatDate, formatDayMonth, formatMinutes, formatNumber, formatVolume } from '../lib/format';
import { goBack, navigate } from '../lib/router';
import {
  finished,
  logDurationSec,
  logSetCount,
  logVolume,
  personalRecords,
  streakWeeks,
  weeklySeries,
  type WeekBucket,
} from '../lib/stats';
import { actions, useStore } from '../lib/store';

type Metric = 'sessions' | 'minutes' | 'volume';

const METRICS: { id: Metric; label: string; measure: string; format: (v: number) => string }[] = [
  { id: 'sessions', label: 'Pass', measure: 'Antal pass', format: (v) => `${formatNumber(v)} pass` },
  { id: 'minutes', label: 'Tid', measure: 'Träningstid', format: (v) => `${formatNumber(v)} min` },
  { id: 'volume', label: 'Vikt', measure: 'Lyft vikt', format: formatVolume },
];

const knownExercise = (id: string) => EXERCISES.some((e) => e.id === id);

export function Progress() {
  const logs = useStore((s) => s.logs);
  const [metric, setMetric] = useState<Metric>('sessions');
  const done = finished(logs).sort((a, b) => b.finishedAt! - a.finishedAt!);
  const series = weeklySeries(logs, 8);
  const current = METRICS.find((m) => m.id === metric)!;
  const records = personalRecords(logs).filter((r) => knownExercise(r.exerciseId));
  const totalSec = done.reduce((n, l) => n + logDurationSec(l), 0);
  const totalVolume = done.reduce((n, l) => n + logVolume(l), 0);

  const weekTitle = (b: WeekBucket, i: number) =>
    i === series.length - 1 ? 'Den här veckan' : `Veckan från ${formatDayMonth(b.start)}`;

  return (
    <div className="screen">
      <header className="stack-sm">
        <span className="label">Statistik</span>
        <h1 className="display">Framsteg</h1>
      </header>

      <section className="tiles tiles-4">
        <div className="tile">
          <span className="tile-value num">{done.length}</span>
          <span className="tile-label">Pass</span>
        </div>
        <div className="tile">
          <span className="tile-value num">{formatMinutes(totalSec)}</span>
          <span className="tile-label">Total tid</span>
        </div>
        <div className="tile">
          <span className="tile-value num">{streakWeeks(logs)}</span>
          <span className="tile-label">Veckor i rad</span>
        </div>
        <div className="tile">
          <span className="tile-value num">{formatVolume(totalVolume)}</span>
          <span className="tile-label">Lyft vikt</span>
        </div>
      </section>

      <section className="card stack-sm">
        <div className="card-head">
          <h2 className="h3">Senaste åtta veckorna</h2>
        </div>
        <div className="segmented" role="group" aria-label="Mätvärde">
          {METRICS.map((m) => (
            <button key={m.id} className={metric === m.id ? 'is-on' : ''} aria-pressed={metric === m.id} onClick={() => setMetric(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <BarChart
          key={metric}
          measure={current.measure}
          integer={metric !== 'volume'}
          format={current.format}
          bars={series.map((b, i) => ({
            label: new Date(b.start).getDate() + '/' + (new Date(b.start).getMonth() + 1),
            title: weekTitle(b, i),
            value: b[metric],
          }))}
        />
      </section>

      <section className="stack-sm">
        <h2 className="h2">Personbästa</h2>
        {records.length === 0 ? (
          <p className="muted empty">Logga vikter i ett pass så dyker dina bästa lyft upp här.</p>
        ) : (
          <ul className="plain-list list">
            {records.slice(0, 8).map((r) => (
              <li key={r.exerciseId}>
                <button className="session-row" onClick={() => navigate(`/ovningar/${r.exerciseId}`)}>
                  <span className="session-text">
                    <span className="session-name">{getExercise(r.exerciseId).name}</span>
                    <span className="muted small">
                      {formatDayMonth(r.at)} · ≈ {formatNumber(Math.round(r.e1rm))} kg i maxlyft
                    </span>
                  </span>
                  <strong className="num">
                    {formatNumber(r.weight)} kg × {r.reps}
                  </strong>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack-sm">
        <h2 className="h2">Historik</h2>
        {done.length === 0 ? (
          <p className="muted empty">Inga pass än. Ditt första pass väntar på startsidan.</p>
        ) : (
          <ul className="plain-list list">
            {done.map((log) => (
              <li key={log.id}>
                <button className="session-row" onClick={() => navigate(`/framsteg/${log.id}`)}>
                  <span className="session-text">
                    <span className="session-name">{log.sessionName}</span>
                    <span className="muted small">
                      {formatDate(log.finishedAt!)} · {formatMinutes(logDurationSec(log))}
                      {logVolume(log) > 0 && ` · ${formatVolume(logVolume(log))}`}
                    </span>
                  </span>
                  <Icon name="forward" size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function LogDetail({ id }: { id: string }) {
  const log = useStore((s) => s.logs.find((l) => l.id === id));
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!log) {
    return (
      <div className="screen">
        <p className="muted empty">Passet finns inte längre.</p>
        <button className="btn btn-outline" onClick={() => navigate('/framsteg', true)}>
          Till framsteg
        </button>
      </div>
    );
  }

  const entries = log.entries
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
    .filter((e) => e.sets.length > 0 && knownExercise(e.exerciseId));
  const amrapRounds = Object.values(log.rounds).reduce((n, r) => n + r, 0);

  return (
    <div className="screen">
      <header className="top-bar">
        <button className="icon-btn" onClick={() => goBack('/framsteg')} aria-label="Tillbaka">
          <Icon name="back" />
        </button>
        <span className="label">{formatDate(log.finishedAt ?? log.startedAt)}</span>
        <button className="icon-btn" onClick={() => setConfirmDelete(true)} aria-label="Ta bort passet">
          <Icon name="trash" />
        </button>
      </header>

      <div className="stack-sm">
        <h1 className="display">{log.sessionName}</h1>
        <p className="muted">Vecka {log.week + 1}</p>
      </div>

      <div className="tiles">
        <div className="tile">
          <span className="tile-value num">{formatMinutes(logDurationSec(log))}</span>
          <span className="tile-label">Tid</span>
        </div>
        <div className="tile">
          <span className="tile-value num">{logSetCount(log)}</span>
          <span className="tile-label">Set</span>
        </div>
        <div className="tile">
          <span className="tile-value num">{log.rpe ?? '–'}</span>
          <span className="tile-label">Ansträngning</span>
        </div>
      </div>

      {log.note && (
        <section className="card">
          <h2 className="label">Anteckning</h2>
          <p>{log.note}</p>
        </section>
      )}

      <section className="card">
        <h2 className="label">Loggade set</h2>
        {entries.length === 0 ? (
          <p className="muted">Inga set loggades i det här passet.</p>
        ) : (
          <ul className="plain-list">
            {entries.map((e) => (
              <li key={e.key} className="log-entry">
                <span>{getExercise(e.exerciseId).name}</span>
                <span className="muted num">{describeSets(e.sets)}</span>
              </li>
            ))}
          </ul>
        )}
        {amrapRounds > 0 && (
          <p className="muted small" style={{ marginTop: 12 }}>
            Varv i avslutningen: <span className="num">{amrapRounds}</span>
          </p>
        )}
      </section>

      <button className="btn btn-outline" onClick={() => navigate('/', true)}>
        Till startsidan
      </button>

      {confirmDelete && (
        <ConfirmSheet
          title="Ta bort passet?"
          body="Passet försvinner från historiken och statistiken. Det går inte att ångra."
          confirmLabel="Ta bort"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            actions.deleteLog(log.id);
            navigate('/framsteg', true);
          }}
        />
      )}
    </div>
  );
}
