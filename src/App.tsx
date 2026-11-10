import { Icon, type IconName } from './components/Icon';
import { navigate, useRoute } from './lib/router';
import { ExerciseDetail, Exercises } from './screens/Exercises';
import { Home } from './screens/Home';
import { LogDetail, Progress } from './screens/Progress';
import { ProgramScreen } from './screens/ProgramScreen';
import { SessionPreview } from './screens/SessionPreview';
import { Settings } from './screens/Settings';
import { Workout } from './screens/Workout';

const TABS: { path: string; root: string; label: string; icon: IconName }[] = [
  { path: '/', root: '', label: 'Idag', icon: 'home' },
  { path: '/program', root: 'program', label: 'Program', icon: 'program' },
  { path: '/ovningar', root: 'ovningar', label: 'Övningar', icon: 'dumbbell' },
  { path: '/framsteg', root: 'framsteg', label: 'Framsteg', icon: 'chart' },
];

function Screen({ route }: { route: string[] }) {
  const [root, a, b] = route;
  switch (root) {
    case undefined:
      return <Home />;
    case 'program':
      return <ProgramScreen />;
    case 'pass':
      return <SessionPreview week={Number(a)} sessionId={b ?? ''} />;
    case 'traning':
      return <Workout />;
    case 'ovningar':
      return a ? <ExerciseDetail id={a} /> : <Exercises />;
    case 'framsteg':
      return a ? <LogDetail id={a} /> : <Progress />;
    case 'installningar':
      return <Settings />;
    default:
      return <Home />;
  }
}

export function App() {
  const route = useRoute();
  const root = route[0] ?? '';
  // Flikraden visas bara på huvudskärmarna, inte under pass eller på undersidor.
  const showTabs = route.length <= 1 && TABS.some((t) => t.root === root);

  return (
    <div className="app">
      <Screen route={route} />
      {showTabs && (
        <nav className="tab-bar" aria-label="Huvudmeny">
          {TABS.map((t) => (
            <button
              key={t.path}
              className={`tab-item ${t.root === root ? 'is-on' : ''}`}
              aria-current={t.root === root ? 'page' : undefined}
              onClick={() => navigate(t.path)}
            >
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
