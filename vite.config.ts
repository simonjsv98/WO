import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relativ bas gör att bygget fungerar på valfri statisk host (t.ex. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
});
