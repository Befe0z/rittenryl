import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite + Vitest config. Tests run in jsdom; app is a pure client-side SPA.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
  },
});
