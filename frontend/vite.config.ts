import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },

  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png', 'login_bg.jpg', 'register_bg.jpg'],
      manifest: {
        name: 'FISCA · Plateforme Fiscale Burkina Faso',
        short_name: 'FISCA',
        description: 'Gestion fiscale, déclarations et paie au Burkina Faso',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        lang: 'fr',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Lecture offline : NetworkFirst avec fallback rapide (4s) vers le cache
            // maxAgeSeconds: 86400 = 24h → données lisibles même sans connexion le lendemain
            urlPattern: /^https:\/\/fisca-backend\.onrender\.com\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
              networkTimeoutSeconds: 4,         // 4s max → bascule cache immédiatement
              cacheableResponse: { statuses: [200] }, // Ne jamais cacher 401/403/500
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
