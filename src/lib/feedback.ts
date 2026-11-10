import { getState } from './store';

let ctx: AudioContext | null = null;

/** Måste anropas från ett tryck så att webbläsaren tillåter ljud senare. */
export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* Ljud saknas: timern fungerar ändå. */
  }
}

function tone(freq: number, startIn: number, length: number): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t0 = ctx.currentTime + startIn;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + length + 0.02);
}

export type Signal = 'tick' | 'go' | 'rest' | 'done';

/** Ljud och vibration vid fasbyten, enligt användarens inställningar. */
export function signal(kind: Signal): void {
  const { sound, vibrate } = getState().settings;
  if (sound) {
    if (kind === 'tick') tone(660, 0, 0.08);
    if (kind === 'go') tone(990, 0, 0.3);
    if (kind === 'rest') tone(440, 0, 0.3);
    if (kind === 'done') {
      tone(660, 0, 0.15);
      tone(880, 0.18, 0.15);
      tone(1100, 0.36, 0.3);
    }
  }
  if (vibrate && kind !== 'tick' && 'vibrate' in navigator) {
    navigator.vibrate(kind === 'done' ? [120, 80, 120, 80, 240] : 180);
  }
}

/** Håller skärmen tänd så länge komponenten som anropar lever. Returnerar en städfunktion. */
export function keepScreenAwake(): () => void {
  let lock: WakeLockSentinel | null = null;
  let released = false;

  const request = async () => {
    if (released || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
    try {
      lock = await navigator.wakeLock.request('screen');
    } catch {
      /* Nekad av webbläsaren (t.ex. låg batterinivå). */
    }
  };

  void request();
  document.addEventListener('visibilitychange', request);
  return () => {
    released = true;
    document.removeEventListener('visibilitychange', request);
    void lock?.release();
  };
}
