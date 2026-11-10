import { useState } from 'react';
import { SessionCard } from '../components/SessionCard';
import { ConfirmSheet } from '../components/Sheet';
import { PROGRAMS, getProgram } from '../data/programs';
import { completedSessions, nextSession, sessionKey } from '../lib/stats';
import { actions, useStore } from '../lib/store';
import type { Program } from '../lib/types';

export function ProgramScreen() {
  const programId = useStore((s) => s.programId);
  const cycle = useStore((s) => s.cycle);
  const logs = useStore((s) => s.logs);
  const hasActive = useStore((s) => s.active !== null);

  const program = getProgram(programId);
  const done = completedSessions(logs, programId, cycle);
  const next = nextSession(program, done);
  const [week, setWeek] = useState(next?.week ?? 0);
  const [switchTo, setSwitchTo] = useState<Program | null>(null);

  return (
    <div className="screen">
      <header className="stack-sm">
        <span className="label">Månadsprogram</span>
        <h1 className="display">{program.name}</h1>
        <p className="muted">{program.description}</p>
        <div className="chip-row">
          <span className="chip">{program.sessions.length} pass/vecka</span>
          <span className="chip">{program.level}</span>
          <span className="chip">{program.equipment}</span>
        </div>
      </header>

      <div className="tabs" role="tablist" aria-label="Vecka">
        {program.weeks.map((w, i) => (
          <button key={w.title} role="tab" aria-selected={week === i} className={`tab ${week === i ? 'is-on' : ''}`} onClick={() => setWeek(i)}>
            <span className="tab-top num">V{i + 1}</span>
            <span className="tab-sub">{w.title}</span>
          </button>
        ))}
      </div>

      <section className="stack-sm">
        <p className="muted">{program.weeks[week].focus}</p>
        <div className="list">
          {program.sessions.map((s, i) => (
            <SessionCard
              key={s.id}
              session={s}
              week={week}
              index={i}
              done={done.has(sessionKey(week, s.id))}
              isNext={next?.week === week && next.sessionId === s.id}
            />
          ))}
        </div>
      </section>

      <section className="stack-sm">
        <h2 className="h2">Fler program</h2>
        {PROGRAMS.filter((p) => p.id !== program.id).map((p) => (
          <div key={p.id} className="card stack-sm">
            <div>
              <h3 className="h3">{p.name}</h3>
              <p className="muted">{p.tagline}</p>
            </div>
            <p className="small">{p.description}</p>
            <div className="chip-row">
              <span className="chip">{p.sessions.length} pass/vecka</span>
              <span className="chip">{p.equipment}</span>
            </div>
            <button className="btn btn-outline" onClick={() => setSwitchTo(p)} disabled={hasActive}>
              Byt till {p.name}
            </button>
            {hasActive && <p className="muted small">Avsluta det pågående passet innan du byter program.</p>}
          </div>
        ))}
      </section>

      {switchTo && (
        <ConfirmSheet
          title={`Byta till ${switchTo.name}?`}
          body="Du börjar om från vecka 1 i det nya programmet. Din träningshistorik finns kvar."
          confirmLabel={`Byt till ${switchTo.name}`}
          onCancel={() => setSwitchTo(null)}
          onConfirm={() => {
            actions.selectProgram(switchTo.id);
            setSwitchTo(null);
            setWeek(0);
            window.scrollTo(0, 0);
          }}
        />
      )}
    </div>
  );
}
