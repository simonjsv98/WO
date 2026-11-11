import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Highlights, MetricLogSheet } from '../components/Metrics';
import { BLOCK_LABEL, VERSION_LABEL, phaseTitle } from '../data/programs';
import { formatClock, formatLongDate } from '../lib/format';
import { navigate } from '../lib/router';
import { WEEKDAY_SHORT, addDays, dayStart } from '../lib/schedule';
import { finished, sessionKey, weekStart } from '../lib/stats';
import { actions, useStore } from '../lib/store';
import { useNow } from '../lib/useNow';
import { useProgram } from '../lib/useProgram';

export function Home() {
  const { plan, phase, logs, program, done, upcoming, next, total, doneCount } = useProgram();
  const active = useStore((s) => s.active);
  const [logging, setLogging] = useState(false);

  const today = dayStart(Date.now());
  const doneLogs = finished(logs);
  const trainedToday = doneLogs.some((l) => dayStart(l.finishedAt!) === today);
  const nextTemplate = next ? program.sessions.find((s) => s.id === next.sessionId)! : null;
  const isToday = next?.date === today;

  const monday = weekStart(today);
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    return {
      date,
      log: doneLogs.find((l) => dayStart(l.finishedAt!) === date),
      planned: upcoming.find((u) => u.date === date),
    };
  });

  return (
    <div className="screen">
      <header className="top-bar">
        <div>
          <span className="label">{formatLongDate(today)}</span>
          <span className="wordmark">Idag</span>
        </div>
        <button className="icon-btn" onClick={() => navigate('/installningar')} aria-label="Inställningar">
          <Icon name="settings" />
        </button>
      </header>

      <nav className="week-strip" aria-label="Veckans träning">
        {week.map(({ date, log, planned }, i) => {
          const state = log ? 'done' : planned ? 'planned' : 'rest';
          const target = log ? `/du/pass/${log.id}` : planned ? `/pass/${planned.week}/${planned.sessionId}` : null;
          const what = log ? `${log.sessionName}, avklarat` : planned ? 'planerat pass' : 'vila';
          return (
            <button
              key={date}
              className={`day day-${state} ${date === today ? 'is-today' : ''}`}
              disabled={!target}
              onClick={() => target && navigate(target)}
              aria-label={`${WEEKDAY_SHORT[i]} ${new Date(date).getDate()}: ${what}`}
              aria-current={date === today ? 'date' : undefined}
            >
              <span className="day-name">{WEEKDAY_SHORT[i]}</span>
              <span className="day-mark num">{log ? <Icon name="check" size={16} /> : new Date(date).getDate()}</span>
            </button>
          );
        })}
      </nav>

      {active && <ActiveBanner name={active.sessionName} since={active.startedAt} />}

      {!next || !nextTemplate ? (
        <section className="hero">
          <span className="label">{phaseTitle(phase)}</span>
          <h1 className="display">Fasen är klar</h1>
          <p className="hero-focus">Alla {total} pass är avklarade. Nästa fas har nya övningar och ett nytt upplägg.</p>
          <div className="stack-sm">
            <button className="btn btn-dark" onClick={() => actions.startPhase(phase + 1)}>
              Starta {phaseTitle(phase + 1)}
            </button>
            <button className="btn btn-dark-outline" onClick={() => actions.restartPhase()}>
              Kör fasen igen
            </button>
          </div>
        </section>
      ) : isToday ? (
        <section className="hero">
          <span className="label">
            Dagens pass · Vecka {next.week + 1} · {program.weeks[next.week].title}
          </span>
          <h1 className="display">{nextTemplate.name}</h1>
          <p className="hero-focus">{nextTemplate.focus}</p>
          <div className="chip-row">
            <span className="chip chip-dark">{nextTemplate.estMin} min</span>
            {nextTemplate.blocks.slice(1, 4).map((b) => (
              <span key={b.type} className="chip chip-dark">
                {BLOCK_LABEL[b.type]}
              </span>
            ))}
          </div>
          <button className="btn btn-dark" onClick={() => navigate(`/pass/${next.week}/${next.sessionId}`)}>
            Visa passet
          </button>
        </section>
      ) : (
        <section className="card rest-card">
          <span className="rest-icon">
            <Icon name={trainedToday ? 'check' : 'moon'} size={22} />
          </span>
          <h1 className="h1">{trainedToday ? 'Klart för idag' : 'Vilodag'}</h1>
          <p className="muted">
            {trainedToday ? 'Bra jobbat. ' : 'Återhämtning är en del av programmet. '}
            Nästa pass är {nextTemplate.name.toLowerCase()} på {formatLongDate(next.date)}.
          </p>
          <button className="btn btn-outline" onClick={() => navigate(`/pass/${next.week}/${next.sessionId}`)}>
            {trainedToday ? 'Visa nästa pass' : 'Träna ändå'}
          </button>
        </section>
      )}

      <section className="stack-sm">
        <div className="section-head">
          <h2 className="h2">Höjdpunkter</h2>
          <button className="pill-btn" onClick={() => setLogging(true)}>
            <Icon name="plus" size={16} /> Logga mått
          </button>
        </div>
        <Highlights />
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="h3">{phaseTitle(phase)}</h2>
          <span className="muted num">
            {doneCount} av {total} pass
          </span>
        </div>
        <p className="muted small">
          {VERSION_LABEL[plan.version]} · {plan.days} pass i veckan
        </p>
        <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneCount}>
          <div style={{ width: `${(doneCount / total) * 100}%` }} />
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

      {logging && <MetricLogSheet onClose={() => setLogging(false)} />}
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
