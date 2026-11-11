import { useState } from 'react';
import { formatDayMonth, formatNumber, parseDecimal } from '../lib/format';
import { METRICS, getMetric, latest, type MetricDef } from '../lib/metrics';
import { navigate } from '../lib/router';
import { actions, useStore } from '../lib/store';
import { Sheet } from './Sheet';

export function formatMetric(def: MetricDef, value: number): string {
  return `${formatNumber(Number(value.toFixed(def.decimals)))} ${def.unit}`;
}

/** Fästa mått som rutor. Visas både på Idag och på Du. */
export function Highlights() {
  const pinned = useStore((s) => s.pinned);
  const metrics = useStore((s) => s.metrics);
  const defs = pinned.map(getMetric).filter((d): d is MetricDef => !!d);

  if (defs.length === 0) return null;
  return (
    <div className="tiles tiles-2">
      {defs.map((def) => {
        const last = latest(metrics[def.id]);
        const delta = last?.delta ? Number(last.delta.toFixed(def.decimals)) : 0;
        return (
          <button key={def.id} className="tile tile-btn" onClick={() => navigate(`/du/matt/${def.id}`)}>
            <span className="tile-label">{def.name}</span>
            <span className="tile-value num">{last ? formatMetric(def, last.value) : '–'}</span>
            <span className="tile-label num">
              {!last
                ? 'Logga första värdet'
                : delta !== 0
                  ? `${delta > 0 ? '+' : '−'}${formatNumber(Math.abs(delta))} sedan förra · ${formatDayMonth(last.at)}`
                  : formatDayMonth(last.at)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const toDateInput = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Panel för att logga ett mätvärde. Utan fast mått får man välja vilket. */
export function MetricLogSheet({ metricId, onClose }: { metricId?: string; onClose: () => void }) {
  const [id, setId] = useState(metricId ?? METRICS[0].id);
  const [text, setText] = useState('');
  const [date, setDate] = useState(() => toDateInput(Date.now()));
  const [error, setError] = useState('');
  const def = getMetric(id)!;

  const save = () => {
    const value = parseDecimal(text);
    if (value === null || value < def.min || value > def.max) {
      setError(`Ange ett värde mellan ${formatNumber(def.min)} och ${formatNumber(def.max)} ${def.unit}.`);
      return;
    }
    const [y, m, d] = date.split('-').map(Number);
    const now = new Date();
    const at = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds()).getTime();
    if (!Number.isFinite(at) || at > Date.now() + 60_000) {
      setError('Välj dagens datum eller ett tidigare.');
      return;
    }
    actions.logMetric(id, value, at);
    onClose();
  };

  return (
    <Sheet title="Logga mått" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {!metricId && (
          <div className="filter-row filter-wrap" role="radiogroup" aria-label="Mått">
            {METRICS.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={id === m.id}
                className={`filter ${id === m.id ? 'is-on' : ''}`}
                onClick={() => {
                  setId(m.id);
                  setError('');
                }}
              >
                {m.name}
              </button>
            ))}
          </div>
        )}
        <label className="form-field">
          <span className="label">
            {def.name} ({def.unit})
          </span>
          <input
            className="input"
            inputMode="decimal"
            autoFocus
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError('');
            }}
            aria-invalid={!!error}
          />
        </label>
        <label className="form-field">
          <span className="label">Datum</span>
          <input className="input" type="date" value={date} max={toDateInput(Date.now())} onChange={(e) => setDate(e.target.value)} />
        </label>
        <p className="danger small" role="alert">
          {error}
        </p>
        <button className="btn btn-primary" type="submit">
          Spara
        </button>
      </form>
    </Sheet>
  );
}
