import { useSyncExternalStore } from 'react';

function subscribe(fn: () => void): () => void {
  window.addEventListener('hashchange', fn);
  return () => window.removeEventListener('hashchange', fn);
}

const currentPath = (): string => window.location.hash.replace(/^#/, '') || '/';

/** Aktuell sökväg uppdelad i delar: "#/pass/0/a" → ["pass", "0", "a"]. */
export function useRoute(): string[] {
  const path = useSyncExternalStore(subscribe, currentPath);
  return path.split('/').filter(Boolean).map(decodeURIComponent);
}

export function navigate(path: string, replace = false): void {
  const url = `#${path}`;
  if (replace) {
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = path;
  }
  window.scrollTo(0, 0);
}

export function goBack(fallback: string): void {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback, true);
}
