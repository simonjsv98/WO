import { useCallback, useEffect, useMemo, useState } from 'react';
import { CountdownBar, type Countdown } from '../components/CountdownBar';
import { ExerciseInfo, describeSets } from '../components/ExerciseInfo';
import { Icon } from '../components/Icon';
import { IntervalTimer } from '../components/IntervalTimer';
import { ConfirmSheet, Sheet } from '../components/Sheet';
import { alternativesFor } from '../data/exercises';
import { describeItem, programFromId, resolveSession } from '../data/programs';
import { keepScreenAwake, unlockAudio } from '../lib/feedback';
import { formatClock, formatMinutes, formatVolume, inputValue, parseDecimal } from '../lib/format';
import { navigate } from '../lib/router';
import { exerciseHistory, logDurationSec, logSetCount, logVolume } from '../lib/stats';
import { actions, useStore } from '../lib/store';
import type { ResolvedBlock, ResolvedItem, SetLog, WorkoutLog } from '../lib/types';
import { useNow } from '../lib/useNow';

function blockDone(block: ResolvedBlock, log: WorkoutLog): boolean {
  if (block.format === 'timer') return !!log.checks[block.key];
  if (block.format === 'list') return block.items.every((i) => log.checks[i.key]);
  return block.items.every((i) => log.entries.find((e) => e.key === i.key)?.sets.every((s) => s.done));
}

function Elapsed({ since }: { since: number }) {
  const now = useNow(true, 1000);
  return <span className="num">{formatClock((now - since) / 1000)}</span>;
}

const RPE_TEXT: Record<number, string> = {
  1: 'Mycket lätt',
  2: 'Lätt',
  3: 'Lätt',
  4: 'Måttligt',
  5: 'Måttligt',
  6: 'Något ansträngande',
  7: 'Ansträngande',
  8: 'Tungt',
  9: 'Mycket tungt',
  10: 'Maximalt',
};

export function Workout() {
  const active = useStore((s) => s.active);
  const logs = useStore((s) => s.logs);
  const settings = useStore((s) => s.settings);
  const swaps = useStore((s) => s.swaps);
  const keepAwake = settings.keepAwake;

  const session = useMemo(() => {
    const program = active && programFromId(active.programId);
    return program ? resolveSession(program, active.week, active.sessionId, swaps) : null;
  }, [active?.programId, active?.week, active?.sessionId, swaps]);

  const [blockIndex, setBlockIndex] = useState(() => {
    if (!active || !session) return 0;
    const first = session.blocks.findIndex((b) => !blockDone(b, active));
    return first === -1 ? session.blocks.length - 1 : first;
  });
  const [countdown, setCountdown] = useState<Countdown | null>(null);
  /** Nyckeln till övningen vars panel är öppen, så att panelen följer med vid byte. */
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (active && session) return;
    // Ett pass från ett upplägg som inte längre går att läsa kan inte fortsätta.
    if (active) actions.discardWorkout();
    navigate('/', true);
  }, [active, session]);

  useEffect(() => (keepAwake ? keepScreenAwake() : undefined), [keepAwake]);

  const startCountdown = useCallback((label: string, sec: number, extra: Partial<Countdown> = {}) => {
    unlockAudio();
    setCountdown({ id: Date.now(), label, endsAt: Date.now() + sec * 1000, totalSec: sec, ...extra });
  }, []);

  const onCountdownFinished = useCallback((c: Countdown) => {
    if (c.checkKey) actions.setCheck(c.checkKey, true);
    window.setTimeout(() => setCountdown((cur) => (cur?.id === c.id ? null : cur)), 1500);
  }, []);

  if (!active || !session) return null;

  if (finishing) {
    return <Finish log={active} onBack={() => setFinishing(false)} />;
  }

  const block = session.blocks[blockIndex];
  const isLast = blockIndex === session.blocks.length - 1;
  const open = session.blocks.flatMap((b) => b.items.map((item) => ({ item, block: b }))).find((x) => x.item.key === openKey);

  // Övningar i samma superset (B1, B2) visas ihop.
  const clusters: ResolvedItem[][] = [];
  if (block.format === 'sets') {
    for (const item of block.items) {
      const last = clusters[clusters.length - 1];
      const letter = item.group?.[0];
      if (last && item.group && item.group.length > 1 && last[0].group?.[0] === letter) last.push(item);
      else clusters.push([item]);
    }
  }

  const go = (index: number) => {
    setBlockIndex(index);
    window.scrollTo(0, 0);
  };

  return (
    <div className="workout">
      <header className="workout-head">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="Minimera passet">
          <Icon name="back" />
        </button>
        <div className="workout-title">
          <span className="label">
            Vecka {session.week + 1} · {session.name}
          </span>
          <Elapsed since={active.startedAt} />
        </div>
        <button className="pill-btn" onClick={() => setFinishing(true)}>
          Avsluta
        </button>
      </header>

      <nav className="steps" aria-label="Block">
        {session.blocks.map((b, i) => (
          <button
            key={b.key}
            className={`step ${i === blockIndex ? 'is-current' : ''} ${blockDone(b, active) ? 'is-done' : ''}`}
            onClick={() => go(i)}
            aria-label={`Block ${i + 1}: ${b.title}`}
            aria-current={i === blockIndex ? 'step' : undefined}
          />
        ))}
      </nav>

      <main className="workout-body">
        <div className="block-head">
          <span className="block-no num">{String(blockIndex + 1).padStart(2, '0')}</span>
          <h1 className="h1">{block.title}</h1>
        </div>
        {block.intro && <p className="muted">{block.intro}</p>}

        {block.format === 'list' && (
          <ul className="plain-list checklist">
            {block.items.map((item) => (
              <ListRow
                key={item.key}
                item={item}
                checked={!!active.checks[item.key]}
                onInfo={() => setOpenKey(item.key)}
                onTimer={() => {
                  const perSide = item.perSide;
                  const sec = (item.targetSec ?? 0) * (perSide ? 2 : 1);
                  startCountdown(item.exercise.name, sec, {
                    checkKey: item.key,
                    switchAt: perSide ? Date.now() + (sec / 2) * 1000 : undefined,
                  });
                }}
              />
            ))}
          </ul>
        )}

        {clusters.map((cluster) => {
          const cards = cluster.map((item) => (
            <SetCard
              key={item.key}
              item={item}
              sets={active.entries.find((e) => e.key === item.key)?.sets ?? []}
              previous={exerciseHistory(logs, item.exercise.id)[0]?.sets ?? null}
              autofill={settings.autofill}
              onInfo={() => setOpenKey(item.key)}
              onRest={() => settings.restTimer && item.restSec > 0 && startCountdown('Vila', item.restSec)}
            />
          ));
          if (cluster.length === 1) return cards[0];
          return (
            <section key={cluster[0].key} className="superset">
              <p className="label superset-head">
                Superset {cluster[0].group![0]} · växla mellan övningarna, vila efter {cluster[cluster.length - 1].group}
              </p>
              {cards}
            </section>
          );
        })}

        {block.format === 'timer' && block.timer && (
          <>
            <ul className="plain-list timer-items">
              {block.items.map((item) => (
                <li key={item.key}>
                  <button className="row-link" onClick={() => setOpenKey(item.key)}>
                    <span>
                      {item.exercise.name}
                      {item.note && <small className="muted"> · {item.note}</small>}
                    </span>
                    <span className="muted num">{describeItem(item, 'timer')}</span>
                  </button>
                </li>
              ))}
            </ul>
            <IntervalTimer
              key={block.key}
              spec={block.timer}
              items={block.items}
              done={!!active.checks[block.key]}
              rounds={active.rounds[block.key] ?? 0}
              onRounds={(n) => actions.setRounds(block.key, n)}
              onDone={(v) => actions.setCheck(block.key, v)}
            />
          </>
        )}

        <button className="text-btn danger discard" onClick={() => setConfirmDiscard(true)}>
          Avbryt passet utan att spara
        </button>
      </main>

      <footer className="workout-foot">
        {countdown && (
          <CountdownBar
            countdown={countdown}
            onAdjust={(d) =>
              setCountdown((c) => (c ? { ...c, endsAt: c.endsAt + d * 1000, totalSec: Math.max(1, c.totalSec + d) } : c))
            }
            onDismiss={() => setCountdown(null)}
            onFinished={onCountdownFinished}
          />
        )}
        <div className="foot-nav">
          <button className="btn btn-ghost" onClick={() => go(blockIndex - 1)} disabled={blockIndex === 0}>
            Föregående
          </button>
          {isLast ? (
            <button className="btn btn-primary" onClick={() => setFinishing(true)}>
              Avsluta pass
            </button>
          ) : (
            <button className={`btn ${blockDone(block, active) ? 'btn-primary' : 'btn-outline'}`} onClick={() => go(blockIndex + 1)}>
              Nästa block
            </button>
          )}
        </div>
      </footer>

      {open && (
        <Sheet title={open.block.format === 'sets' ? 'Din övning' : open.item.exercise.name} onClose={() => setOpenKey(null)}>
          {open.block.format === 'sets' && <h3 className="h1 sheet-title">{open.item.exercise.name}</h3>}
          <ExerciseInfo
            exercise={open.item.exercise}
            baseId={open.item.baseExerciseId}
            onSwap={
              open.block.format === 'sets'
                ? (id) => {
                    const base = open.item.baseExerciseId;
                    const keys = session.blocks
                      .filter((b) => b.format === 'sets')
                      .flatMap((b) => b.items)
                      .filter((i) => i.baseExerciseId === base)
                      .map((i) => i.key);
                    actions.swapExercise(base, id, keys);
                    setOpenKey(null);
                  }
                : undefined
            }
          />
        </Sheet>
      )}
      {confirmDiscard && (
        <ConfirmSheet
          title="Avbryta passet?"
          body="Allt du har loggat i det här passet tas bort."
          confirmLabel="Avbryt passet"
          danger
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => {
            actions.discardWorkout();
            navigate('/', true);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Rad i uppvärmning och nedvarvning ---------- */

function ListRow(props: { item: ResolvedItem; checked: boolean; onInfo: () => void; onTimer: () => void }) {
  const { item, checked } = props;
  return (
    <li className={`check-row ${checked ? 'is-done' : ''}`}>
      <button
        className="check"
        role="checkbox"
        aria-checked={checked}
        aria-label={`${item.exercise.name} klar`}
        onClick={() => actions.setCheck(item.key, !checked)}
      >
        {checked && <Icon name="check" size={18} />}
      </button>
      <button className="check-main" onClick={props.onInfo}>
        <span className="check-name">{item.exercise.name}</span>
        <span className="muted num">{describeItem(item, 'list')}</span>
      </button>
      {item.targetSec !== null && (
        <button className="pill-btn" onClick={props.onTimer} aria-label={`Starta timer för ${item.exercise.name}`}>
          <Icon name="timer" size={16} /> Timer
        </button>
      )}
    </li>
  );
}

/* ---------- Övning med loggade set ---------- */

interface SetCardProps {
  item: ResolvedItem;
  sets: SetLog[];
  previous: SetLog[] | null;
  /** Föreslå förra passets vikter i tomma fält. */
  autofill: boolean;
  onInfo: () => void;
  onRest: () => void;
}

function SetCard({ item, sets, previous, autofill, onInfo, onRest }: SetCardProps) {
  const canSwap = alternativesFor(item.baseExerciseId).length > 0;
  const loaded = item.exercise.tracking === 'load';
  const repsUnit = item.exercise.tracking === 'time' ? 's' : 'reps';

  /** Förslag på vikt: föregående set i dag, annars samma set förra gången. */
  const weightHint = (index: number): number | null => {
    for (let i = index - 1; i >= 0; i--) if (sets[i].weight !== null) return sets[i].weight;
    if (!autofill || !previous?.length) return null;
    return previous[Math.min(index, previous.length - 1)].weight;
  };
  const repsHint = item.targetReps ?? item.targetSec;

  const toggle = (index: number) => {
    const set = sets[index];
    if (set.done) {
      actions.updateSet(item.key, index, { done: false });
      return;
    }
    actions.updateSet(item.key, index, {
      done: true,
      weight: loaded ? (set.weight ?? weightHint(index)) : null,
      reps: set.reps ?? repsHint,
    });
    onRest();
  };

  return (
    <section className="card set-card">
      <button className="set-card-head" onClick={onInfo} aria-label={`${item.exercise.name}: instruktioner${canSwap ? ' och alternativ' : ''}`}>
        <span>
          <span className="h3">
            {item.group && <span className="group-tag num">{item.group}</span>}
            {item.exercise.name}
          </span>
          <span className="muted set-card-meta num">
            {item.sets} × {item.target}
            {item.restSec > 0 ? ` · vila ${formatClock(item.restSec)}` : ' · direkt vidare'}
          </span>
        </span>
        <span className="set-card-action">
          <Icon name={canSwap ? 'swap' : 'info'} size={18} />
          {canSwap ? 'Byt' : 'Info'}
        </span>
      </button>
      <p className="note">{item.note ?? item.exercise.cues[0]}</p>
      {previous && <p className="muted small num">Senast: {describeSets(previous)}</p>}

      <div className="set-grid" role="group" aria-label={`Set för ${item.exercise.name}`}>
        {sets.map((set, i) => (
          <div key={i} className={`set-row ${set.done ? 'is-done' : ''}`}>
            <span className="set-no num">{i + 1}</span>
            {loaded && (
              <label className="field">
                <input
                  inputMode="decimal"
                  value={inputValue(set.weight)}
                  placeholder={inputValue(weightHint(i)) || '–'}
                  onChange={(e) => actions.updateSet(item.key, i, { weight: parseDecimal(e.target.value) })}
                  aria-label={`Vikt set ${i + 1}`}
                />
                <span className="field-unit">kg</span>
              </label>
            )}
            <label className="field">
              <input
                inputMode="numeric"
                value={inputValue(set.reps)}
                placeholder={repsHint !== null ? String(repsHint) : '–'}
                onChange={(e) => {
                  const n = parseDecimal(e.target.value);
                  actions.updateSet(item.key, i, { reps: n === null ? null : Math.round(n) });
                }}
                aria-label={`${repsUnit === 's' ? 'Sekunder' : 'Repetitioner'} set ${i + 1}`}
              />
              <span className="field-unit">{repsUnit}</span>
            </label>
            <button
              className="check"
              role="checkbox"
              aria-checked={set.done}
              aria-label={`Set ${i + 1} klart`}
              onClick={() => toggle(i)}
            >
              {set.done && <Icon name="check" size={18} />}
            </button>
          </div>
        ))}
      </div>

      <div className="set-card-foot">
        <button className="text-btn" onClick={() => actions.removeSet(item.key)} disabled={sets.length <= 1}>
          Ta bort set
        </button>
        <button className="text-btn" onClick={() => actions.addSet(item.key)}>
          Lägg till set
        </button>
      </div>
    </section>
  );
}

/* ---------- Sammanfattning innan passet sparas ---------- */

function Finish({ log, onBack }: { log: WorkoutLog; onBack: () => void }) {
  const [rpe, setRpe] = useState<number | null>(log.rpe);
  const [note, setNote] = useState(log.note);
  const [durationSec] = useState(() => logDurationSec(log));
  const volume = logVolume(log);

  const save = () => {
    const id = actions.finishWorkout(rpe, note);
    navigate(id ? `/du/pass/${id}` : '/', true);
  };

  return (
    <div className="screen">
      <header className="top-bar">
        <button className="icon-btn" onClick={onBack} aria-label="Tillbaka till passet">
          <Icon name="back" />
        </button>
        <span className="label">Sammanfattning</span>
        <span className="top-bar-spacer" />
      </header>

      <h1 className="display">Bra jobbat</h1>
      <p className="muted">
        Vecka {log.week + 1} · {log.sessionName}
      </p>

      <div className="tiles">
        <div className="tile">
          <span className="tile-value num">{formatMinutes(durationSec)}</span>
          <span className="tile-label">Tid</span>
        </div>
        <div className="tile">
          <span className="tile-value num">{logSetCount(log)}</span>
          <span className="tile-label">Set</span>
        </div>
        <div className="tile">
          <span className="tile-value num">{formatVolume(volume)}</span>
          <span className="tile-label">Lyft vikt</span>
        </div>
      </div>

      <section className="stack-sm">
        <h2 className="label">Hur tungt var passet?</h2>
        <div className="rpe" role="radiogroup" aria-label="Ansträngning 1 till 10">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={rpe === n}
              className={`rpe-btn num ${rpe === n ? 'is-on' : ''}`}
              onClick={() => setRpe(rpe === n ? null : n)}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="muted small">{rpe ? RPE_TEXT[rpe] : 'Valfritt. 1 är mycket lätt, 10 är maximalt.'}</p>
      </section>

      <section className="stack-sm">
        <label className="label" htmlFor="note">
          Anteckning
        </label>
        <textarea
          id="note"
          className="textarea"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Hur kändes det? Något att tänka på nästa gång?"
        />
      </section>

      <div className="stack-sm">
        <button className="btn btn-primary" onClick={save}>
          Spara pass
        </button>
        <button className="btn btn-ghost" onClick={onBack}>
          Fortsätt träna
        </button>
      </div>
    </div>
  );
}
