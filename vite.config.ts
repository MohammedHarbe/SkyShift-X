/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the static build works from any sub-path (GitHub Pages, S3, etc.).
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Remote previews reach the dev server through a proxy hostname, which Vite rejects by default.
  // Opt in per run with SKYSHIFT_ALLOW_ANY_HOST=1; leave it off for normal local development.
  server: { port: 5173, strictPort: false, allowedHosts: process.env.SKYSHIFT_ALLOW_ANY_HOST ? true : undefined },
  build: { chunkSizeWarningLimit: 1300 },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
