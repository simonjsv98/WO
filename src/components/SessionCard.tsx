import { navigate } from '../lib/router';
import type { SessionTemplate } from '../lib/types';
import { Icon } from './Icon';

interface Props {
  session: SessionTemplate;
  week: number;
  index: number;
  done: boolean;
  isNext?: boolean;
  /** Text före passets fokus, t.ex. planerat datum. */
  meta?: string;
}

/** Rad för ett pass i veckolistan. */
export function SessionCard({ session, week, index, done, isNext, meta }: Props) {
  return (
    <button className={`session-row ${done ? 'is-done' : ''}`} onClick={() => navigate(`/pass/${week}/${session.id}`)}>
      <span className={`session-mark num ${done ? 'is-done' : ''}`}>
        {done ? <Icon name="check" size={18} /> : index + 1}
      </span>
      <span className="session-text">
        <span className="session-name">
          {session.name}
          {isNext && <span className="badge">Nästa</span>}
        </span>
        <span className="muted small">
          {done ? 'Avklarat' : (meta ?? `${session.estMin} min`)} · {session.focus}
        </span>
      </span>
      <Icon name="forward" size={18} />
    </button>
  );
}
