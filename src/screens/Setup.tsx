import { useState } from 'react';
import { PlanEditor, planIsValid } from '../components/PlanEditor';
import { phaseTitle } from '../data/programs';
import { actions, useStore } from '../lib/store';

/** Första skärmen: välj upplägg innan fas 1 startar. */
export function Setup() {
  const [plan, setPlan] = useState(useStore((s) => s.plan));

  return (
    <div className="screen">
      <header className="stack-sm">
        <span className="wordmark">WO</span>
        <h1 className="display">Välj ditt upplägg</h1>
        <p className="muted">
          Varje månad är en fas på fyra veckor med uppvärmning, kraftutveckling, styrka, finisher och nedvarvning i varje
          pass. Du kan ändra upplägget när du vill.
        </p>
      </header>

      <PlanEditor plan={plan} onChange={setPlan} />

      <button className="btn btn-primary" disabled={!planIsValid(plan)} onClick={() => actions.completeOnboarding(plan)}>
        Starta {phaseTitle(0)}
      </button>
    </div>
  );
}
