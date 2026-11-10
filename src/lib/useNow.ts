import { useEffect, useState } from 'react';

/** Aktuell tid som uppdateras flera gånger per sekund medan `running` är sant. */
export function useNow(running: boolean, intervalMs = 200): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [running, intervalMs]);
  return now;
}
