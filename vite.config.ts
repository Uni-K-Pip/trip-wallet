import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const BASE = '/trip-wallet/';

export default defineConfig(({ mode }) => ({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      // テスト実行時は Service Worker を組み立てない(仮想モジュールは stub が入る)
      disable: mode === 'test',
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Trip Wallet',
        short_name: 'Trip Wallet',
        description: 'Track travel expenses in foreign currencies, converted at the rate of the day.',
        lang: 'en',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0c0a1d',
        theme_color: '#0c0a1d',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${BASE}index.html`,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.frankfurter\.dev\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'rates-frankfurter',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/open\.er-api\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'rates-er-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
}));
