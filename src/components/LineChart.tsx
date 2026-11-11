import { useState } from 'react';
import { formatDayMonth } from '../lib/format';
import type { SeriesPoint } from '../lib/stats';

type Range = '3m' | '1y' | 'all';
const RANGES: { id: Range; label: string; days: number }[] = [
  { id: '3m', label: '3 mån', days: 92 },
  { id: '1y', label: '1 år', days: 366 },
  { id: 'all', label: 'Allt', days: Infinity },
];

interface Props {
  points: SeriesPoint[];
  format: (value: number) => string;
  /** Namn på mätvärdet, används i tabellen. */
  measure: string;
}

/** Axelgränser med lite luft runt värdena, avrundade till jämna tal. */
export function axisBounds(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.2 || Math.abs(max) * 0.05 || 1;
  const step = 10 ** Math.floor(Math.log10(pad));
  const lo = Math.floor((min - pad) / step) * step;
  const hi = Math.ceil((max + pad) / step) * step;
  return [min >= 0 ? Math.max(0, lo) : lo, hi];
}

/** Linjediagram med en serie över tid. Tryck eller hovra på en punkt för att läsa av värdet. */
export function LineChart({ points, format, measure }: Props) {
  const [range, setRange] = useState<Range>('3m');
  const [picked, setPicked] = useState<number | null>(null);

  const days = RANGES.find((r) => r.id === range)!.days;
  const cutoff = days === Infinity ? -Infinity : Date.now() - days * 86_400_000;
  const visible = points.filter((p) => p.at >= cutoff);
  const selected = Math.min(picked ?? visible.length - 1, visible.length - 1);

  const filters = (
    <div className="segmented" role="group" aria-label="Period">
      {RANGES.map((r) => (
        <button
          key={r.id}
          className={range === r.id ? 'is-on' : ''}
          aria-pressed={range === r.id}
          onClick={() => {
            setRange(r.id);
            setPicked(null);
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  if (visible.length === 0) {
    return (
      <div className="stack-sm">
        {filters}
        <p className="muted empty">Inga värden i den här perioden.</p>
      </div>
    );
  }

  const [lo, hi] = axisBounds(visible.map((p) => p.value));
  const t0 = visible[0].at;
  const t1 = visible[visible.length - 1].at;
  const x = (at: number) => (t1 === t0 ? 50 : ((at - t0) / (t1 - t0)) * 100);
  const y = (value: number) => ((value - lo) / (hi - lo)) * 100;
  const current = visible[selected];

  return (
    <div className="stack-sm">
      {filters}
      <figure className="chart">
        <figcaption className="chart-readout" aria-live="polite">
          <strong className="num">{format(current.value)}</strong>
          <span className="muted">{formatDayMonth(current.at)}</span>
        </figcaption>

        <div className="chart-plot">
          <div className="chart-grid" aria-hidden="true">
            {[hi, (hi + lo) / 2, lo].map((t) => (
              <div key={t} className="chart-tick">
                <span className="num">{format(t)}</span>
              </div>
            ))}
          </div>
          <div className="chart-line-area">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline
                points={visible.map((p) => `${x(p.at)},${100 - y(p.value)}`).join(' ')}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {visible.map((p, i) => (
              <button
                key={p.at}
                className={`chart-point ${i === selected ? 'is-on' : ''}`}
                style={{ left: `${x(p.at)}%`, bottom: `${y(p.value)}%` }}
                onPointerEnter={() => setPicked(i)}
                onFocus={() => setPicked(i)}
                onClick={() => setPicked(i)}
                aria-label={`${formatDayMonth(p.at)}: ${format(p.value)}`}
              />
            ))}
          </div>
        </div>
        <div className="chart-axis chart-axis-ends num" aria-hidden="true">
          <span>{formatDayMonth(t0)}</span>
          {t1 !== t0 && <span>{formatDayMonth(t1)}</span>}
        </div>

        <details className="chart-table">
          <summary>Visa som tabell</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">Datum</th>
                <th scope="col">{measure}</th>
              </tr>
            </thead>
            <tbody>
              {[...visible].reverse().map((p) => (
                <tr key={p.at}>
                  <th scope="row">{formatDayMonth(p.at)}</th>
                  <td className="num">{format(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </figure>
    </div>
  );
}
