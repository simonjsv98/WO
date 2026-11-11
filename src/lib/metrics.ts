import type { MetricEntry } from './types';

export interface MetricDef {
  id: string;
  name: string;
  unit: string;
  /** Rimligt intervall för inmatning, som skydd mot felskrivningar. */
  min: number;
  max: number;
  decimals: number;
}

export const METRICS: MetricDef[] = [
  { id: 'weight', name: 'Kroppsvikt', unit: 'kg', min: 20, max: 400, decimals: 1 },
  { id: 'bodyfat', name: 'Kroppsfett', unit: '%', min: 2, max: 70, decimals: 1 },
  { id: 'waist', name: 'Midjemått', unit: 'cm', min: 30, max: 250, decimals: 1 },
  { id: 'resting-hr', name: 'Vilopuls', unit: 'slag/min', min: 25, max: 150, decimals: 0 },
  { id: 'sleep', name: 'Sömn', unit: 'h', min: 0, max: 24, decimals: 1 },
  { id: 'steps', name: 'Steg', unit: 'steg', min: 0, max: 200000, decimals: 0 },
];

export const getMetric = (id: string): MetricDef | undefined => METRICS.find((m) => m.id === id);

/** Senaste värdet och förändringen mot värdet före. Poster förutsätts sorterade äldst först. */
export function latest(entries: MetricEntry[] | undefined): { value: number; at: number; delta: number | null } | null {
  if (!entries?.length) return null;
  const last = entries[entries.length - 1];
  const prev = entries[entries.length - 2];
  return { value: last.value, at: last.at, delta: prev ? last.value - prev.value : null };
}
