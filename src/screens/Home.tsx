import { Icon } from '../components/Icon';
import { SessionCard } from '../components/SessionCard';
import { BLOCK_LABEL, getProgram } from '../data/programs';
import { formatClock, formatMinutes } from '../lib/format';
import { navigate } from '../lib/router';
import { completedSessions, finished, nextSession, sessionKey, streakWeeks, weeklySeries } from '../lib/stats';
import { actions, useStore } from '../lib/store';
import { useNow } from '../lib/useNow';

export function Home() {
  const programId = useStore((s) => s.programId);
  const cycle = useStore((s) => s.cycle);
  const logs = useStore((s) => s.logs);
  const active = useStore((s) => s.active);

  const program = getProgram(programId);
  const done = completedSessions(logs, programId, cycle);
  const next = nextSession(program, done);
  const total = program.weeks.length * program.sessions.length;
  const thisWeek = weeklySeries(logs, 1)[0];
  const week = next?.week ?? program.weeks.length - 1;
  const nextTemplate = next ? program.sessions.find((s) => s.id === next.sessionId)! : null;

  return (
    <div className="screen">
      <header className="top-bar">
        <span className="wordmark">WO</span>
        <button className="icon-btn" onClick={() => navigate('/installningar')} aria-label="Inställningar">
          <Icon name="settings" />
        </button>
      </header>

      {active && <ActiveBanner name={active.sessionName} since={active.startedAt} />}

      {nextTemplate && next ? (
        <section className="hero">
          <span className="label">
            Nästa pass · Vecka {next.week + 1} · {program.weeks[next.week].title}
          </span>
          <h1 className="display">{nextTemplate.name}</h1>
          <p className="hero-focus">{nextTemplate.focus}</p>
          <div className="chip-row">
            <span className="chip chip-dark">{nextTemplate.estMin} min</span>
            {[...new Set(nextTemplate.blocks.map((b) => BLOCK_LABEL[b.type]))].slice(1, 4).map((label) => (
              <span key={label} className="chip chip-dark">
                {label}
              </span>
            ))}
          </div>
          <button className="btn btn-dark" onClick={() => navigate(`/pass/${next.week}/${next.sessionId}`)}>
            Visa passet
          </button>
        </section>
      ) : (
        <section className="hero">
          <span className="label">{program.name}</span>
          <h1 className="display">Månaden är klar</h1>
          <p className="hero-focus">Alla {total} pass är avklarade. Kör programmet en gång till eller välj ett nytt.</p>
          <div className="stack-sm">
            <button className="btn btn-dark" onClick={() => actions.restartProgram()}>
              Starta om programmet
            </button>
            <button className="btn btn-dark-outline" onClick={() => navigate('/program')}>
              Byt program
            </button>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2 className="h3">{program.name}</h2>
          <span className="muted num">
            {done.size} av {total} pass
          </span>
        </div>
        <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done.size}>
          <div style={{ width: `${(done.size / total) * 100}%` }} />
        </div>
        <div className="week-grid">
          {program.weeks.map((w, wi) => (
            <div key={w.title} className="week-col">
              <span className="label">V{wi + 1}</span>
              <div className="dots">
                {program.sessions.map((s) => (
                  <span key={s.id} className={`dot ${done.has(sessionKey(wi, s.id)) ? 'is-done' : ''}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="stack-sm">
        <div className="section-head">
          <h2 className="h2">
            Vecka {week + 1} · {program.weeks[week].title}
          </h2>
        </div>
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

      <section className="tiles">
        <div className="tile">
          <span className="tile-value num">{streakWeeks(logs)}</span>
          <span className="tile-label">Veckor i rad</span>
        </div>
        <div className="tile">
          <span className="tile-value num">{thisWeek.sessions}</span>
          <span className="tile-label">Pass i veckan</span>
        </div>
        <div className="tile">
          <span className="tile-value num">{finished(logs).length ? formatMinutes(thisWeek.minutes * 60) : '0 min'}</span>
          <span className="tile-label">Tid i veckan</span>
        </div>
      </section>
    </div>
  );
}

function ActiveBanner({ name, since }: { name: string; since: number }) {
  const now = useNow(true, 1000);
  return (
    <button className="active-banner" onClick={() => navigate('/traning')}>
      <span>
        <span className="label">Pågående pass</span>
        <span className="active-name">{name}</span>
      </span>
      <span className="num">{formatClock((now - since) / 1000)}</span>
      <Icon name="forward" size={18} />
    </button>
  );
}
