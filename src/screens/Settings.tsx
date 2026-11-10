import { useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { ConfirmSheet } from '../components/Sheet';
import { goBack } from '../lib/router';
import { actions, useStore } from '../lib/store';
import type { Settings as SettingsType } from '../lib/types';

const TOGGLES: { key: keyof SettingsType; title: string; body: string }[] = [
  { key: 'sound', title: 'Ljudsignaler', body: 'Pip när vilan är slut och när intervaller byter fas.' },
  { key: 'vibrate', title: 'Vibration', body: 'Vibrerar vid samma tillfällen, på telefoner som stöder det.' },
  { key: 'keepAwake', title: 'Håll skärmen tänd', body: 'Skärmen släcks inte under ett pågående pass.' },
];

export function Settings() {
  const settings = useStore((s) => s.settings);
  const logCount = useStore((s) => s.logs.length);
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingImport, setPendingImport] = useState<string | null>(null);

  const exportData = () => {
    const blob = new Blob([actions.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('Filen har sparats.');
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setPendingImport(await file.text());
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <div className="screen">
      <header className="top-bar">
        <button className="icon-btn" onClick={() => goBack('/')} aria-label="Tillbaka">
          <Icon name="back" />
        </button>
        <span className="label">Inställningar</span>
        <span className="top-bar-spacer" />
      </header>

      <section className="card">
        <h2 className="label">Under passet</h2>
        {TOGGLES.map((t) => (
          <label key={t.key} className="toggle-row">
            <span>
              <span className="toggle-title">{t.title}</span>
              <span className="muted small">{t.body}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={settings[t.key]}
              onChange={(e) => actions.updateSettings({ [t.key]: e.target.checked })}
            />
          </label>
        ))}
      </section>

      <section className="card stack-sm">
        <h2 className="label">Din data</h2>
        <p className="muted small">
          Allt sparas bara i den här webbläsaren. Exportera en säkerhetskopia om du byter telefon eller rensar webbdata.
        </p>
        <button className="btn btn-outline" onClick={exportData}>
          Exportera säkerhetskopia
        </button>
        <button className="btn btn-outline" onClick={() => fileInput.current?.click()}>
          Importera säkerhetskopia
        </button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        <button className="btn btn-ghost danger" onClick={() => setConfirmReset(true)}>
          Radera all data
        </button>
        <p className="muted small" role="status">
          {message}
        </p>
      </section>

      <p className="muted small center">WO · {logCount} sparade pass</p>

      {pendingImport !== null && (
        <ConfirmSheet
          title="Importera säkerhetskopia?"
          body="Innehållet i filen ersätter allt som finns i appen just nu."
          confirmLabel="Importera"
          onCancel={() => setPendingImport(null)}
          onConfirm={() => {
            const ok = actions.importJson(pendingImport);
            setMessage(ok ? 'Säkerhetskopian är inläst.' : 'Filen gick inte att läsa. Välj en fil som exporterats från WO.');
            setPendingImport(null);
          }}
        />
      )}
      {confirmReset && (
        <ConfirmSheet
          title="Radera all data?"
          body="Alla pass, all statistik och dina inställningar tas bort. Det går inte att ångra."
          confirmLabel="Radera allt"
          danger
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            actions.resetAll();
            setConfirmReset(false);
            setMessage('All data är raderad.');
          }}
        />
      )}
    </div>
  );
}
