import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// La app se instala en el celular y abre SIN INTERNET (PWA).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'logo.jpg', 'icon-64.png'],
      manifest: {
        name: 'Envia2 Express',
        short_name: 'Envia2',
        description: 'Entregas con rastreo, firma en el celular y comprobante por WhatsApp',
        lang: 'es',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#020c28',
        theme_color: '#0a1f5c',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // Guarda los pedazos de mapa ya vistos para verlos sin señal
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'mapa', expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 30 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  base: './',
  // Número de versión visible en la app (sale de package.json)
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
});
