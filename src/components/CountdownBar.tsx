import { useEffect, useRef } from 'react';
import { signal } from '../lib/feedback';
import { formatClock } from '../lib/format';
import { useNow } from '../lib/useNow';
import { Icon } from './Icon';

export interface Countdown {
  id: number;
  label: string;
  endsAt: number;
  totalSec: number;
  /** Tidpunkt för signal om sidbyte, för övningar som görs per sida. */
  switchAt?: number;
  /** Nyckel som bockas av när tiden är ute (övningar på tid). */
  checkKey?: string;
}

interface Props {
  countdown: Countdown;
  onAdjust: (deltaSec: number) => void;
  onDismiss: () => void;
  onFinished: (countdown: Countdown) => void;
}

/** Nedräkning för vila och övningar på tid. Ligger fast ovanför knapparna i passet. */
export function CountdownBar({ countdown, onAdjust, onDismiss, onFinished }: Props) {
  const now = useNow(true);
  const remaining = Math.max(0, (countdown.endsAt - now) / 1000);
  const whole = Math.ceil(remaining);
  const lastTick = useRef(-1);
  const switched = useRef(false);
  const finished = useRef(false);

  useEffect(() => {
    lastTick.current = -1;
    switched.current = false;
    finished.current = false;
  }, [countdown.id]);

  useEffect(() => {
    if (finished.current) return;
    if (countdown.switchAt && !switched.current && now >= countdown.switchAt && whole > 0) {
      switched.current = true;
      signal('rest');
    }
    if (whole <= 3 && whole > 0 && lastTick.current !== whole) {
      lastTick.current = whole;
      signal('tick');
    }
    if (whole === 0) {
      finished.current = true;
      signal('done');
      onFinished(countdown);
    }
  }, [whole, now, countdown, onFinished]);

  const secondSide = countdown.switchAt !== undefined && now >= countdown.switchAt;

  return (
    <div className="countdown" role="timer" aria-label={countdown.label}>
      <div className="countdown-fill" style={{ width: `${(1 - remaining / countdown.totalSec) * 100}%` }} />
      <div className="countdown-body">
        <div className="countdown-text">
          <span className="label">{secondSide ? `${countdown.label} · andra sidan` : countdown.label}</span>
          <span className="countdown-clock num">{formatClock(whole)}</span>
        </div>
        <div className="countdown-actions">
          <button className="pill-btn" onClick={() => onAdjust(-15)} aria-label="Minska med 15 sekunder">
            −15
          </button>
          <button className="pill-btn" onClick={() => onAdjust(15)} aria-label="Öka med 15 sekunder">
            +15
          </button>
          <button className="icon-btn" onClick={onDismiss} aria-label="Hoppa över">
            <Icon name="close" />
          </button>
        </div>
      </div>
    </div>
  );
}
