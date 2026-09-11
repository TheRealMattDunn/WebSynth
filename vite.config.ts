import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { audioWorklet } from './plugins/vite-plugin-audio-worklet.ts';

// GitHub Pages serves a project site from /<repo>/, so the base path has to match
// or every asset 404s. CI sets BASE_PATH; locally it stays '/'.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [audioWorklet(), react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    // The pure layers only. The audio graph is verified by hand, not by unit test —
    // see docs/architecture.md, "What we do and don't test".
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
