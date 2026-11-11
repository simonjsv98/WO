import { useState } from 'react';
import { BarChart } from '../components/BarChart';
import { describeSets } from '../components/ExerciseInfo';
import { Icon } from '../components/Icon';
import { LineChart } from '../components/LineChart';
import { Highlights, MetricLogSheet, formatMetric } from '../components/Metrics';
import { ConfirmSheet, Sheet } from '../components/Sheet';
import { EXERCISES, getExercise } from '../data/exercises';
import { formatDate, formatDayMonth, formatMinutes, formatNumber, formatVolume } from '../lib/format';
import { METRICS, getMetric, latest } from '../lib/metrics';
import { goBack, navigate } from '../lib/router';
import {
  finished,
  logDurationSec,
  logSetCount,
  logVolume,
  newRecords,
  personalRecords,
  streakWeeks,
  weeklySeries,
  type WeekBucket,
} from '../lib/stats';
import { actions, useStore } from '../lib/store';

type Measure = 'sessions' | 'minutes' | 'volume';

const MEASURES: { id: Measure; label: string; measure: string; format: (v: number) => string }[] = [
  { id: 'sessions', label: 'Pass', measure: 'Antal pass', format: (v) => `${formatNumber(v)} pass` },
  { id: 'minutes', label: 'Tid', measure: 'Träningstid', format: (v) => `${formatNumber(v)} min` },
  { id: 'volume', label: 'Vikt', measure: 'Lyft vikt', format: formatVolume },
];

const knownExercise = (id: string) => EXERCISES.some((e) => e.id === id);

export function You() {
  const logs = useStore((s) => s.logs);
  const metrics = useStore((s) => s.metrics);
  const pinned = useStore((s) => s.pinned);
  const [measure, setMeasure] = useState<Measure>('sessions');
  const [customizing, setCustomizing] = useState(false);
  const [logging, setLogging] = useState(false);

  const done = finished(logs).sort((a, b) => b.finishedAt! - a.finishedAt!);
  const series = weeklySeries(logs, 8);
  const current = MEASURES.find((m) => m.id === measure)!;
  const records = personalRecords(logs).filter((r) => knownExercise(r.exerciseId));
  const totalSec = done.reduce((n, l) => n + logDurationSec(l), 0);
  const totalVolume = done.reduce((n, l) => n + logVolume(l), 0);

  const weekTitle = (b: WeekBucket, i: number) =>
    i === series.length - 1 ? 'Den här veckan' : `Veckan från ${formatDayMonth(b.start)}`;

  return (
    <div className="screen">
      <header className="stack-sm">
        <span className="label">Din utveckling</span>
        <h1 className="display">Du</h1>
      </header>

      <section className="stack-sm">
        <div className="section-head">
          <h2 className="h2">Höjdpunkter</h2>
          <button className="pill-btn" onClick={() => setCustomizing(true)}>
            <Icon name="pin" size={16} /> Anpassa
          </button>
        </div>
        {pinned.length === 0 && <p className="muted">Fäst de mått du bryr dig mest om, så visas de här och på Idag.</p>}
        <Highlights />
      </section>

      <section className="stack-sm">
        <div className="section-head">
          <h2 className="h2">Mått</h2>
          <button className="pill-btn" onClick={() => setLogging(true)}>
            <Icon name="plus" size={16} /> Logga mått
          </button>
        </div>
        <ul className="plain-list list">
          {METRICS.map((def) => {
            const last = latest(metrics[def.id]);
            return (
              <li key={def.id}>
                <button className="session-row" onClick={() => navigate(`/du/matt/${def.id}`)}>
                  <span className="session-text">
                    <span className="session-name">{def.name}</span>
                    <span className="muted small">{last ? `Senast ${formatDayMonth(last.at)}` : 'Inget värde än'}</span>
                  </span>
                  {last && <strong className="num">{formatMetric(def, last.value)}</strong>}
                  <Icon name="forward" size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="stack-sm">
        <h2 className="h2">Träning</h2>
        <div className="tiles tiles-2">
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
        </div>
        <div className="card stack-sm">
          <h3 className="h3">Senaste åtta veckorna</h3>
          <div className="segmented" role="group" aria-label="Mätvärde">
            {MEASURES.map((m) => (
              <button key={m.id} className={measure === m.id ? 'is-on' : ''} aria-pressed={measure === m.id} onClick={() => setMeasure(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          <BarChart
            key={measure}
            measure={current.measure}
            integer={measure !== 'volume'}
            format={current.format}
            bars={series.map((b, i) => ({
              label: new Date(b.start).getDate() + '/' + (new Date(b.start).getMonth() + 1),
              title: weekTitle(b, i),
              value: b[measure],
            }))}
          />
        </div>
      </section>

      <section className="stack-sm">
        <h2 className="h2">Personbästa</h2>
        {records.length === 0 ? (
          <p className="muted empty">Logga vikter i ett pass så dyker dina bästa lyft upp här.</p>
        ) : (
          <ul className="plain-list list">
            {records.map((r) => (
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
          <p className="muted empty">Inga pass än. Ditt första pass väntar på Idag.</p>
        ) : (
          <ul className="plain-list list">
            {done.map((log) => (
              <li key={log.id}>
                <button className="session-row" onClick={() => navigate(`/du/pass/${log.id}`)}>
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

      {logging && <MetricLogSheet onClose={() => setLogging(false)} />}
      {customizing && (
        <Sheet title="Anpassa höjdpunkter" onClose={() => setCustomizing(false)}>
          <p className="muted small">Valda mått visas överst här och på Idag.</p>
          {METRICS.map((def) => (
            <label key={def.id} className="toggle-row">
              <span>
                <span className="toggle-title">{def.name}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                className="switch"
                checked={pinned.includes(def.id)}
                onChange={() => actions.togglePin(def.id)}
              />
            </label>
          ))}
        </Sheet>
      )}
    </div>
  );
}

/* ---------- Ett mått: diagram och alla värden ---------- */

export function MetricDetail({ id }: { id: string }) {
  const def = getMetric(id);
  const entries = useStore((s) => s.metrics[id]);
  const pinned = useStore((s) => s.pinned.includes(id));
  const [logging, setLogging] = useState(false);

  if (!def) {
    return (
      <div className="screen">
        <p className="muted empty">Måttet finns inte.</p>
        <button className="btn btn-outline" onClick={() => navigate('/du', true)}>
          Till Du
        </button>
      </div>
    );
  }
  const last = latest(entries);

  return (
    <div className="screen">
      <header className="top-bar">
        <button className="icon-btn" onClick={() => goBack('/du')} aria-label="Tillbaka">
          <Icon name="back" />
        </button>
        <span className="label">Mått</span>
        <span className="top-bar-spacer" />
      </header>

      <div className="stack-sm">
        <h1 className="display">{def.name}</h1>
        <p className="muted">{last ? `${formatMetric(def, last.value)} · ${formatDate(last.at)}` : 'Inget värde loggat än.'}</p>
      </div>

      <button className="btn btn-primary" onClick={() => setLogging(true)}>
        <Icon name="plus" size={18} /> Logga värde
      </button>

      <label className="card toggle-row toggle-card">
        <span>
          <span className="toggle-title">Visa som höjdpunkt</span>
          <span className="muted small">Fäster måttet överst på Idag och Du.</span>
        </span>
        <input type="checkbox" role="switch" className="switch" checked={pinned} onChange={() => actions.togglePin(id)} />
      </label>

      {entries && entries.length >= 2 && (
        <section className="card">
          <LineChart points={entries} measure={def.name} format={(v) => formatMetric(def, v)} />
        </section>
      )}

      {entries && entries.length > 0 && (
        <section className="card">
          <h2 className="label">Alla värden</h2>
          <ul className="plain-list">
            {[...entries].reverse().map((e) => (
              <li key={e.at} className="log-entry entry-row">
                <span>{formatDate(e.at)}</span>
                <span className="num">{formatMetric(def, e.value)}</span>
                <button
                  className="icon-btn"
                  onClick={() => actions.deleteMetricEntry(id, e.at)}
                  aria-label={`Ta bort värdet från ${formatDate(e.at)}`}
                >
                  <Icon name="trash" size={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {logging && <MetricLogSheet metricId={id} onClose={() => setLogging(false)} />}
    </div>
  );
}

/* ---------- Resultat för ett pass ---------- */

export function LogDetail({ id }: { id: string }) {
  const logs = useStore((s) => s.logs);
  const log = logs.find((l) => l.id === id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!log) {
    return (
      <div className="screen">
        <p className="muted empty">Passet finns inte längre.</p>
        <button className="btn btn-outline" onClick={() => navigate('/du', true)}>
          Till Du
        </button>
      </div>
    );
  }

  const entries = log.entries
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
    .filter((e) => e.sets.length > 0 && knownExercise(e.exerciseId));
  const amrapRounds = Object.values(log.rounds).reduce((n, r) => n + r, 0);
  const records = newRecords(logs, log).filter((r) => r.previous !== null && knownExercise(r.exerciseId));
  const earlier = finished(logs).filter((l) => l.finishedAt! < (log.finishedAt ?? 0));
  const streak = streakWeeks(logs, log.finishedAt ?? Date.now());

  const badges: string[] = [];
  if (earlier.length === 0) badges.push('Första passet');
  if (records.length > 0) badges.push(records.length === 1 ? '1 personbästa' : `${records.length} personbästa`);
  if (streak >= 2) badges.push(`${streak} veckor i rad`);

  return (
    <div className="screen">
      <header className="top-bar">
        <button className="icon-btn" onClick={() => goBack('/du')} aria-label="Tillbaka">
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
        {badges.length > 0 && (
          <div className="chip-row">
            {badges.map((b) => (
              <span key={b} className="chip chip-accent">
                {b}
              </span>
            ))}
          </div>
        )}
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

      {records.length > 0 && (
        <section className="card">
          <h2 className="label">Personbästa i passet</h2>
          <ul className="plain-list">
            {records.map((r) => (
              <li key={r.exerciseId} className="log-entry pb-row">
                <span className="pb-icon">
                  <Icon name="trophy" size={18} />
                </span>
                <span className="pb-text">
                  <span>{getExercise(r.exerciseId).name}</span>
                  <span className="muted small num">
                    ≈ {formatNumber(Math.round(r.e1rm))} kg i maxlyft, tidigare {formatNumber(Math.round(r.previous!))} kg
                  </span>
                </span>
                <strong className="num">
                  {formatNumber(r.weight)} kg × {r.reps}
                </strong>
              </li>
            ))}
          </ul>
        </section>
      )}

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
              <li key={e.key}>
                <button className="row-link" onClick={() => navigate(`/ovningar/${e.exerciseId}`)}>
                  <span>{getExercise(e.exerciseId).name}</span>
                  <span className="muted num">{describeSets(e.sets)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {amrapRounds > 0 && (
          <p className="muted small" style={{ marginTop: 12 }}>
            Varv i finishern: <span className="num">{amrapRounds}</span>
          </p>
        )}
      </section>

      <button className="btn btn-outline" onClick={() => navigate('/', true)}>
        Till Idag
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
            navigate('/du', true);
          }}
        />
      )}
    </div>
  );
}
