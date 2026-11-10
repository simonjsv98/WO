import { useMemo, useState } from 'react';
import { ExerciseInfo } from '../components/ExerciseInfo';
import { Icon } from '../components/Icon';
import { CATEGORIES, EXERCISES, getExercise } from '../data/exercises';
import { goBack, navigate } from '../lib/router';
import type { Category } from '../lib/types';

export function Exercises() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EXERCISES.filter(
      (e) =>
        (!category || e.category === category) &&
        (!q || e.name.toLowerCase().includes(q) || e.muscles.some((m) => m.toLowerCase().includes(q))),
    ).sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  }, [query, category]);

  return (
    <div className="screen">
      <header className="stack-sm">
        <span className="label">{EXERCISES.length} övningar</span>
        <h1 className="display">Övningar</h1>
      </header>

      <label className="search">
        <Icon name="search" size={18} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök övning eller muskel"
          aria-label="Sök övning eller muskel"
        />
      </label>

      <div className="filter-row" role="group" aria-label="Kategori">
        <button className={`filter ${category === null ? 'is-on' : ''}`} aria-pressed={category === null} onClick={() => setCategory(null)}>
          Alla
        </button>
        {CATEGORIES.map((c) => (
          <button key={c} className={`filter ${category === c ? 'is-on' : ''}`} aria-pressed={category === c} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <p className="muted empty">Inga övningar matchar sökningen.</p>
      ) : (
        <ul className="plain-list list">
          {results.map((e) => (
            <li key={e.id}>
              <button className="session-row" onClick={() => navigate(`/ovningar/${e.id}`)}>
                <span className="session-text">
                  <span className="session-name">{e.name}</span>
                  <span className="muted small">
                    {e.category} · {e.muscles.join(', ')}
                  </span>
                </span>
                <Icon name="forward" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ExerciseDetail({ id }: { id: string }) {
  const exercise = EXERCISES.some((e) => e.id === id) ? getExercise(id) : null;
  return (
    <div className="screen">
      <header className="top-bar">
        <button className="icon-btn" onClick={() => goBack('/ovningar')} aria-label="Tillbaka">
          <Icon name="back" />
        </button>
        <span className="label">Övning</span>
        <span className="top-bar-spacer" />
      </header>
      {exercise ? (
        <>
          <h1 className="display">{exercise.name}</h1>
          <ExerciseInfo exercise={exercise} />
        </>
      ) : (
        <p className="muted empty">Övningen finns inte.</p>
      )}
    </div>
  );
}
