import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Draco Sheets',
        short_name: 'Draco Sheets',
        description: 'A full spreadsheet in your browser.',
        theme_color: '#0f5132',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['productivity', 'business'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
        file_handlers: [
          {
            action: '/',
            accept: {
              'text/csv': ['.csv'],
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            },
          },
        ] as never,
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        // Precache the app + engine; the ~80 lazy hyphenation-language chunks are cached on first use instead.
        globPatterns: ['**/*.{css,html,svg,png,woff2,ico}', 'assets/index-*.js', 'assets/engine-*.js', 'assets/*worker*.js'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) => url.origin === self.location.origin && request.destination === 'script',
            handler: 'CacheFirst',
            options: { cacheName: 'draco-lazy-js', expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 90 } },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 8000,
    rollupOptions: { output: { chunkFileNames: (c) => (c.name === 'engine' || c.facadeModuleId?.endsWith('engine.ts') ? 'assets/engine-[hash].js' : 'assets/[name]-[hash].js') } },
  },
  worker: { format: 'es' },
});
