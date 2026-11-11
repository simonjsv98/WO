import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/inter';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // Offline-stöd är en bonus: appen fungerar även där registreringen nekas.
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
