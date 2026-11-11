import { VERSION_EQUIPMENT, VERSION_LABEL } from '../data/programs';
import { WEEKDAY_SHORT, defaultWeekdays } from '../lib/schedule';
import type { Days, Plan, Version } from '../lib/types';

const DAY_TEXT: Record<Days, string> = {
  2: 'Två helkroppspass',
  3: 'Tre helkroppspass',
  4: 'Under- och överkropp, två gånger var',
};

export const planIsValid = (plan: Plan): boolean => plan.weekdays.length === plan.days;

/** Val av gym eller hemma, antal pass i veckan och vilka dagar. */
export function PlanEditor({ plan, onChange }: { plan: Plan; onChange: (plan: Plan) => void }) {
  const toggleDay = (day: number) => {
    const weekdays = plan.weekdays.includes(day)
      ? plan.weekdays.filter((d) => d !== day)
      : [...plan.weekdays, day].sort();
    onChange({ ...plan, weekdays });
  };

  return (
    <div className="stack">
      <fieldset className="choice-group">
        <legend className="label">Var tränar du?</legend>
        {(['gym', 'home'] as Version[]).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={plan.version === v}
            className={`choice ${plan.version === v ? 'is-on' : ''}`}
            onClick={() => onChange({ ...plan, version: v })}
          >
            <span className="choice-title">{VERSION_LABEL[v]}</span>
            <span className="choice-body">{VERSION_EQUIPMENT[v]}</span>
          </button>
        ))}
      </fieldset>

      <fieldset className="choice-group">
        <legend className="label">Hur många pass i veckan?</legend>
        <div className="choice-row">
          {([2, 3, 4] as Days[]).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={plan.days === d}
              aria-label={`${d} pass i veckan`}
              className={`choice choice-num ${plan.days === d ? 'is-on' : ''}`}
              onClick={() => onChange({ ...plan, days: d, weekdays: defaultWeekdays(d) })}
            >
              <span className="choice-big num">{d}</span>
            </button>
          ))}
        </div>
        <p className="muted small">{DAY_TEXT[plan.days]}.</p>
      </fieldset>

      <fieldset className="choice-group">
        <legend className="label">Vilka dagar?</legend>
        <div className="weekday-row">
          {WEEKDAY_SHORT.map((name, day) => (
            <button
              key={name}
              type="button"
              aria-pressed={plan.weekdays.includes(day)}
              className={`weekday ${plan.weekdays.includes(day) ? 'is-on' : ''}`}
              onClick={() => toggleDay(day)}
            >
              {name}
            </button>
          ))}
        </div>
        <p className={`small ${planIsValid(plan) ? 'muted' : 'danger'}`} role="status">
          {planIsValid(plan)
            ? 'Passen läggs ut på de här dagarna. Missar du ett pass flyttas det fram.'
            : `Välj ${plan.days} dagar. Just nu är ${plan.weekdays.length} valda.`}
        </p>
      </fieldset>
    </div>
  );
}
