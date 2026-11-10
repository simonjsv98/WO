const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });

export const formatNumber = (n: number): string => nf.format(n);

/** Kompakt vikt: 950 → "950", 12 400 → "12,4 t". */
export function formatVolume(kg: number): string {
  if (kg >= 10000) return `${nf.format(kg / 1000)} t`;
  return `${nf0.format(kg)} kg`;
}

/** mm:ss, eller h:mm:ss över en timme. */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

export function formatMinutes(totalSec: number): string {
  const min = Math.round(totalSec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** Kort mål i sekunder: 180 → "3 min", 45 → "45 s". */
export function formatSeconds(sec: number): string {
  if (sec >= 60 && sec % 60 === 0) return `${sec / 60} min`;
  return `${sec} s`;
}

const dateFmt = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
const dayMonthFmt = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' });

export const formatDate = (ts: number): string => dateFmt.format(ts);
export const formatDayMonth = (ts: number): string => dayMonthFmt.format(ts);

/** Tolkar inmatning med decimalkomma. Tom eller ogiltig text ger null. */
export function parseDecimal(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export const inputValue = (n: number | null): string => (n === null ? '' : String(n).replace('.', ','));
