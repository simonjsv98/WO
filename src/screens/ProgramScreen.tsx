import { useState } from 'react';
import { PlanEditor, planIsValid } from '../components/PlanEditor';
import { SessionCard } from '../components/SessionCard';
import { ConfirmSheet, Sheet } from '../components/Sheet';
import { PHASE_TEMPLATE_COUNT, VERSION_LABEL, phaseInfo, phaseTitle } from '../data/programs';
import { formatDate } from '../lib/format';
import { WEEKDAY_SHORT } from '../lib/schedule';
import { sessionKey } from '../lib/stats';
import { actions, useStore } from '../lib/store';
import { useProgram } from '../lib/useProgram';

export function ProgramScreen() {
  const { plan, phase, program, done, upcoming, next } = useProgram();
  const hasActive = useStore((s) => s.active !== null);
  const [week, setWeek] = useState(next?.week ?? 0);
  const [draft, setDraft] = useState<typeof plan | null>(null);
  const [goTo, setGoTo] = useState<number | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);

  const otherPhases = Array.from({ length: PHASE_TEMPLATE_COUNT - 1 }, (_, i) => phase + 1 + i);

  return (
    <div className="screen">
      <header className="stack-sm">
        <span className="label">Fas {phase + 1} · fyra veckor</span>
        <h1 className="display">{program.name}</h1>
        <p className="muted">{program.description}</p>
        <div className="chip-row">
          <span className="chip">{VERSION_LABEL[plan.version]}</span>
          <span className="chip">{plan.days} pass/vecka</span>
          <span className="chip">{plan.weekdays.map((d) => WEEKDAY_SHORT[d]).join(' · ')}</span>
        </div>
        <button className="btn btn-outline" onClick={() => setDraft(plan)}>
          Ändra upplägg
        </button>
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
          {program.sessions.map((s, i) => {
            const planned = upcoming.find((u) => u.week === week && u.sessionId === s.id);
            return (
              <SessionCard
                key={s.id}
                session={s}
                week={week}
                index={i}
                done={done.has(sessionKey(week, s.id))}
                isNext={next?.week === week && next.sessionId === s.id}
                meta={planned ? formatDate(planned.date) : undefined}
              />
            );
          })}
        </div>
      </section>

      <section className="stack-sm">
        <h2 className="h2">Kommande faser</h2>
        <p className="muted">Varje fas är fyra veckor med nya övningar. När en fas är klar går du vidare till nästa.</p>
        {otherPhases.map((p) => (
          <div key={p} className="card stack-sm">
            <div>
              <h3 className="h3">{phaseTitle(p)}</h3>
              <p className="muted">{phaseInfo(p).tagline}</p>
            </div>
            <p className="small">{phaseInfo(p).description}</p>
            <button className="btn btn-outline" onClick={() => setGoTo(p)}>
              Byt till fas {p + 1}
            </button>
          </div>
        ))}
        <button className="text-btn" onClick={() => setConfirmRestart(true)}>
          Starta om den här fasen
        </button>
      </section>

      {draft && (
        <Sheet title="Ändra upplägg" onClose={() => setDraft(null)}>
          <div className="stack">
            <PlanEditor plan={draft} onChange={setDraft} />
            {hasActive && (draft.version !== plan.version || draft.days !== plan.days) && (
              <p className="muted small">Det pågående passet fortsätter med det gamla upplägget.</p>
            )}
            <button
              className="btn btn-primary"
              disabled={!planIsValid(draft)}
              onClick={() => {
                actions.updatePlan(draft);
                setDraft(null);
              }}
            >
              Spara upplägg
            </button>
          </div>
        </Sheet>
      )}
      {goTo !== null && (
        <ConfirmSheet
          title={`Byta till ${phaseTitle(goTo)}?`}
          body={`Du börjar från vecka 1 i den nya fasen${hasActive ? ' och det pågående passet avbryts' : ''}. Din träningshistorik finns kvar.`}
          confirmLabel={`Byt till fas ${goTo + 1}`}
          onCancel={() => setGoTo(null)}
          onConfirm={() => {
            actions.startPhase(goTo);
            setGoTo(null);
            setWeek(0);
            window.scrollTo(0, 0);
          }}
        />
      )}
      {confirmRestart && (
        <ConfirmSheet
          title="Starta om fasen?"
          body={`Alla pass i fasen blir oavklarade igen${hasActive ? ' och det pågående passet avbryts' : ''}. Din träningshistorik finns kvar.`}
          confirmLabel="Starta om"
          onCancel={() => setConfirmRestart(false)}
          onConfirm={() => {
            actions.restartPhase();
            setConfirmRestart(false);
            setWeek(0);
          }}
        />
      )}
    </div>
  );
}
