import { useEffect, useMemo, useRef, useState } from 'react';
import { describeTimer } from '../data/programs';
import { signal, unlockAudio } from '../lib/feedback';
import { formatClock } from '../lib/format';
import { buildPhases, locate } from '../lib/timer';
import type { ResolvedItem, TimerSpec } from '../lib/types';
import { useNow } from '../lib/useNow';
import { Icon } from './Icon';

interface Props {
  spec: TimerSpec;
  items: ResolvedItem[];
  done: boolean;
  rounds: number;
  onRounds: (rounds: number) => void;
  onDone: (done: boolean) => void;
}

const PHASE_LABEL = { ready: 'Redo', work: 'Arbete', rest: 'Vila' } as const;

/** Intervall-, EMOM- och AMRAP-timer. Räknar på klocktid så den håller takten även om fliken pausas. */
export function IntervalTimer({ spec, items, done, rounds, onRounds, onDone }: Props) {
  const phases = useMemo(() => buildPhases(spec, items), [spec, items]);
  /** Löpande: startedAt satt. Pausad: startedAt null och banked > 0. */
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [banked, setBanked] = useState(0);
  const running = startedAt !== null;
  const now = useNow(running);

  const elapsed = banked + (running ? Math.max(0, now - startedAt) / 1000 : 0);
  const pos = locate(phases, elapsed);
  const whole = Math.ceil(pos.remaining);

  const lastPhase = useRef(-1);
  const lastTick = useRef(-1);

  useEffect(() => {
    if (!running) return;
    if (pos.finished) {
      setBanked(elapsed);
      setStartedAt(null);
      signal('done');
      onDone(true);
      return;
    }
    if (lastPhase.current !== pos.index) {
      if (lastPhase.current !== -1) signal(pos.phase.kind === 'work' ? 'go' : 'rest');
      lastPhase.current = pos.index;
      lastTick.current = -1;
    } else if (whole <= 3 && whole > 0 && lastTick.current !== whole) {
      lastTick.current = whole;
      signal('tick');
    }
  }, [running, pos.finished, pos.index, pos.phase.kind, whole, elapsed, onDone]);

  const start = () => {
    unlockAudio();
    setStartedAt(Date.now());
  };
  const pause = () => {
    setBanked(elapsed);
    setStartedAt(null);
  };
  const reset = () => {
    setStartedAt(null);
    setBanked(0);
    lastPhase.current = -1;
    lastTick.current = -1;
  };

  const idle = !running && banked === 0;
  const state = pos.finished ? 'finished' : idle ? 'idle' : pos.phase.kind;

  return (
    <div className={`itimer itimer-${state}`}>
      <div className="itimer-top">
        <span className="label">{pos.finished ? 'Klart' : idle ? describeTimer(spec) : PHASE_LABEL[pos.phase.kind]}</span>
        {spec.kind !== 'amrap' && !idle && !pos.finished && (
          <span className="label num">
            {pos.phase.round}/{pos.phase.rounds}
          </span>
        )}
      </div>

      <div className="itimer-clock num" role="timer" aria-live="off">
        {formatClock(idle ? phases.slice(1).reduce((n, p) => n + p.sec, 0) : whole)}
      </div>

      <div className="itimer-now">
        {pos.finished ? 'Bra jobbat' : idle ? 'Tryck på start när du är redo' : pos.phase.label}
      </div>
      <div className="itimer-next">{!pos.finished && !idle && pos.phase.next ? `Nästa: ${pos.phase.next}` : ' '}</div>

      <div className="itimer-bar">
        <div style={{ width: `${pos.progress * 100}%` }} />
      </div>

      <div className="itimer-actions">
        {pos.finished ? (
          <button className="btn btn-outline" onClick={reset}>
            <Icon name="reset" size={18} /> Kör igen
          </button>
        ) : running ? (
          <button className="btn btn-outline" onClick={pause}>
            <Icon name="pause" size={18} /> Pausa
          </button>
        ) : (
          <>
            <button className="btn btn-solid" onClick={start}>
              <Icon name="play" size={18} /> {idle ? 'Starta' : 'Fortsätt'}
            </button>
            {!idle && (
              <button className="btn btn-outline" onClick={reset}>
                <Icon name="reset" size={18} /> Nollställ
              </button>
            )}
          </>
        )}
      </div>

      {spec.kind === 'amrap' && (
        <div className="rounds">
          <span className="label">Varv</span>
          <div className="stepper">
            <button className="icon-btn" onClick={() => onRounds(rounds - 1)} aria-label="Ett varv mindre" disabled={rounds === 0}>
              <Icon name="minus" />
            </button>
            <span className="stepper-value num" aria-live="polite">
              {rounds}
            </span>
            <button className="icon-btn" onClick={() => onRounds(rounds + 1)} aria-label="Ett varv till">
              <Icon name="plus" />
            </button>
          </div>
        </div>
      )}

      <label className="check-line">
        <input type="checkbox" checked={done} onChange={(e) => onDone(e.target.checked)} />
        <span>Blocket är klart</span>
      </label>
    </div>
  );
}
