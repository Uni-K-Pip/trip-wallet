import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const ORIGIN = 'https://uni-k-pip.github.io';
const BASE = '/trip-wallet/';
const SITE_URL = `${ORIGIN}${BASE}`;

/**
 * index.html の %SITE_URL% を公開先の絶対 URL に置き換える。
 * OGP の og:url と og:image は相対パスを受け付けないので、ここから 1 箇所で配る。
 * vite が既定で置き換える %BASE_URL% は相対パスのままなので使えない。
 */
function siteUrl(): Plugin {
  return {
    name: 'trip-wallet-site-url',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', SITE_URL),
  };
}

export default defineConfig(({ mode }) => ({
  base: BASE,
  plugins: [
    react(),
    siteUrl(),
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
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // og.png は SNS のクローラだけが読む 250KB。利用者に前もって配る意味がない。
        globIgnores: ['**/og.png'],
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
