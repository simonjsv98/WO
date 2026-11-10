import { useState } from 'react';
import { ExerciseInfo } from '../components/ExerciseInfo';
import { Icon } from '../components/Icon';
import { ConfirmSheet, Sheet } from '../components/Sheet';
import { describeItem, describeTimer, getProgram, resolveSession } from '../data/programs';
import { unlockAudio } from '../lib/feedback';
import { goBack, navigate } from '../lib/router';
import { completedSessions, sessionKey } from '../lib/stats';
import { actions, useStore } from '../lib/store';
import type { Exercise } from '../lib/types';

export function SessionPreview({ week, sessionId }: { week: number; sessionId: string }) {
  const programId = useStore((s) => s.programId);
  const cycle = useStore((s) => s.cycle);
  const logs = useStore((s) => s.logs);
  const active = useStore((s) => s.active);
  const [info, setInfo] = useState<Exercise | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const program = getProgram(programId);
  const session = week >= 0 && week < program.weeks.length ? resolveSession(program, week, sessionId) : null;

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

  const isDone = completedSessions(logs, programId, cycle).has(sessionKey(week, sessionId));
  const isActive = active?.programId === programId && active.week === week && active.sessionId === sessionId;

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
          <span className="chip">{session.blocks.length} block</span>
          {isDone && <span className="chip chip-accent">Avklarat</span>}
        </div>
      </div>

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
                <button className="row-link" onClick={() => setInfo(item.exercise)}>
                  <span>{item.exercise.name}</span>
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

      {info && (
        <Sheet title={info.name} onClose={() => setInfo(null)}>
          <ExerciseInfo exercise={info} />
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
