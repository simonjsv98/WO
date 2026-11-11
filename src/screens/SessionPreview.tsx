import { useState } from 'react';
import { ExerciseInfo } from '../components/ExerciseInfo';
import { Icon } from '../components/Icon';
import { ConfirmSheet, Sheet } from '../components/Sheet';
import { alternativesFor } from '../data/exercises';
import { describeItem, describeTimer, resolveSession } from '../data/programs';
import { unlockAudio } from '../lib/feedback';
import { formatDate } from '../lib/format';
import { goBack, navigate } from '../lib/router';
import { dayStart } from '../lib/schedule';
import { sessionKey } from '../lib/stats';
import { actions, useStore } from '../lib/store';
import { useProgram } from '../lib/useProgram';

export function SessionPreview({ week, sessionId }: { week: number; sessionId: string }) {
  const { program, done, swaps, upcoming } = useProgram();
  const active = useStore((s) => s.active);
  /** Nyckeln till raden som är öppen, så att panelen följer med när övningen byts. */
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const session = week >= 0 && week < program.weeks.length ? resolveSession(program, week, sessionId, swaps) : null;

  if (!session) {
    return (
      <div className="screen">
        <h1 className="h1">Passet finns inte</h1>
        <button className="btn btn-outline" onClick={() => navigate('/program', true)}>
          Till programmet
        </button>
      </div>
    );
  }

  const isDone = done.has(sessionKey(week, sessionId));
  const isActive = active?.programId === program.id && active.week === week && active.sessionId === sessionId;
  const planned = upcoming.find((u) => u.week === week && u.sessionId === sessionId);
  const open = session.blocks.flatMap((b) => b.items.map((item) => ({ item, block: b }))).find((x) => x.item.key === openKey);
  const hasAlternatives = session.blocks.some((b) => b.format === 'sets' && b.items.some((i) => alternativesFor(i.baseExerciseId).length));

  const start = () => {
    unlockAudio();
    actions.startWorkout(session);
    navigate('/traning');
  };

  return (
    <div className="screen has-cta">
      <header className="top-bar">
        <button className="icon-btn" onClick={() => goBack('/program')} aria-label="Tillbaka">
          <Icon name="back" />
        </button>
        <span className="label">
          Vecka {week + 1} · {program.weeks[week].title}
        </span>
        <span className="top-bar-spacer" />
      </header>

      <div className="stack-sm">
        <h1 className="display">{session.name}</h1>
        <p className="muted">{session.focus}</p>
        <div className="chip-row">
          <span className="chip">{session.estMin} min</span>
          {isDone ? (
            <span className="chip chip-accent">Avklarat</span>
          ) : (
            planned && <span className="chip">{planned.date === dayStart(Date.now()) ? 'Idag' : formatDate(planned.date)}</span>
          )}
        </div>
      </div>

      {hasAlternatives && (
        <p className="tip">
          <Icon name="swap" size={18} />
          <span>Saknar du utrustning eller vill ha en lättare variant? Tryck på en övning för att se alternativ och byta.</span>
        </p>
      )}

      {session.blocks.map((block, i) => (
        <section key={block.key} className="card">
          <div className="block-head">
            <span className="block-no num">{String(i + 1).padStart(2, '0')}</span>
            <h2 className="h3">{block.title}</h2>
          </div>
          {block.timer && <p className="muted small">{describeTimer(block.timer)}</p>}
          <ul className="plain-list">
            {block.items.map((item) => (
              <li key={item.key}>
                <button className="row-link" onClick={() => setOpenKey(item.key)}>
                  <span>
                    {item.group && <span className="group-tag num">{item.group}</span>}
                    {item.exercise.name}
                    {item.exercise.id !== item.baseExerciseId && <span className="muted small"> · bytt</span>}
                  </span>
                  <span className="muted num">{describeItem(item, block.format)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="cta">
        {isActive ? (
          <button className="btn btn-primary" onClick={() => navigate('/traning')}>
            Fortsätt passet
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => (active ? setConfirmReplace(true) : start())}>
            <Icon name="play" size={18} /> {isDone ? 'Kör passet igen' : 'Starta passet'}
          </button>
        )}
      </div>

      {open && (
        <Sheet title={open.block.format === 'sets' ? 'Din övning' : open.item.exercise.name} onClose={() => setOpenKey(null)}>
          {open.block.format === 'sets' && <h3 className="h1 sheet-title">{open.item.exercise.name}</h3>}
          <ExerciseInfo
            exercise={open.item.exercise}
            baseId={open.item.baseExerciseId}
            // Under ett pågående pass byter man i passvyn, där loggen följer med.
            onSwap={
              open.block.format === 'sets' && !active
                ? (id) => actions.swapExercise(open.item.baseExerciseId, id, [])
                : undefined
            }
          />
        </Sheet>
      )}
      {confirmReplace && active && (
        <ConfirmSheet
          title="Du har redan ett pågående pass"
          body={`Om du startar det här passet tas det du loggat i ${active.sessionName} bort.`}
          confirmLabel="Starta nytt pass"
          danger
          onCancel={() => setConfirmReplace(false)}
          onConfirm={start}
        />
      )}
    </div>
  );
}
