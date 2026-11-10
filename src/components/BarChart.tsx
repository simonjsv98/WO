import { useState } from 'react';

export interface Bar {
  label: string;
  /** Längre etikett för avläsning och tabell. */
  title: string;
  value: number;
}

/** Jämn övre gräns för axeln: 1, 2 eller 5 gånger en tiopotens, i fyra steg. */
export function niceMax(max: number): number {
  if (max <= 0) return 4;
  const step = max / 4;
  const pow = 10 ** Math.floor(Math.log10(step));
  const unit = [1, 2, 2.5, 5, 10].find((u) => u * pow >= step)!;
  return unit * pow * 4;
}

interface Props {
  bars: Bar[];
  format: (value: number) => string;
  /** Namn på mätvärdet, används i tabellen. */
  measure: string;
  /** Värdena är antal: håll axelns steg till heltal. */
  integer?: boolean;
}

/** Stapeldiagram med en serie. Tryck eller hovra på en stapel för att läsa av värdet. */
export function BarChart({ bars, format, measure, integer }: Props) {
  const [selected, setSelected] = useState(bars.length - 1);
  const rawTop = niceMax(Math.max(...bars.map((b) => b.value)));
  const top = integer ? Math.max(2, Math.ceil(rawTop / 2) * 2) : rawTop;
  const ticks = [top, top / 2, 0];
  const current = bars[Math.min(selected, bars.length - 1)];

  return (
    <figure className="chart">
      <figcaption className="chart-readout" aria-live="polite">
        <strong className="num">{format(current.value)}</strong>
        <span className="muted">{current.title}</span>
      </figcaption>

      <div className="chart-plot">
        <div className="chart-grid" aria-hidden="true">
          {ticks.map((t) => (
            <div key={t} className="chart-tick">
              <span className="num">{format(t)}</span>
            </div>
          ))}
        </div>
        <div className="chart-bars">
          {bars.map((bar, i) => (
            <button
              key={bar.title}
              className={`chart-col ${i === selected ? 'is-on' : ''}`}
              onPointerEnter={() => setSelected(i)}
              onFocus={() => setSelected(i)}
              onClick={() => setSelected(i)}
              aria-label={`${bar.title}: ${format(bar.value)}`}
            >
              <span className="chart-bar" style={{ height: `${(bar.value / top) * 100}%` }} />
            </button>
          ))}
        </div>
      </div>
      <div className="chart-axis" aria-hidden="true">
        {bars.map((bar, i) => (
          <span key={bar.title} className={`num ${i === selected ? 'is-on' : ''}`}>
            {/* Varannan etikett räcker; den valda stapeln får alltid sin. */}
            {(bars.length - 1 - i) % 2 === 0 || i === selected ? bar.label : ''}
          </span>
        ))}
      </div>

      <details className="chart-table">
        <summary>Visa som tabell</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Vecka</th>
              <th scope="col">{measure}</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.title}>
                <th scope="row">{bar.title}</th>
                <td className="num">{format(bar.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
