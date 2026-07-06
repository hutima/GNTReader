/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// base './' — the app must work from a GitHub Pages subpath (ADR-0001,
// invariant 2). Never absolute-root paths anywhere.
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      // Hand-written worker (injectManifest): install precaches and WAITS —
      // no skipWaiting on install, activation only via a user-tapped
      // SKIP_WAITING message or cold start. See ADR-0001 and src/pwa/pwa.ts.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'GNT Reader',
        short_name: 'GNT Reader',
        description:
          'Read the Greek New Testament and Hebrew Old Testament with morphology, glosses, and Strong’s — offline-capable.',
        theme_color: '#1f2933',
        background_color: '#f5f7fa',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        // App shell only. Corpus XML, fixtures, and lexicon JSON are runtime
        // cached (never precached) — ADR-0001 invariant 4.
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}', 'icons/*.png'],
        globIgnores: ['fixtures/**', 'lexicon/**'],
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
  },
});
