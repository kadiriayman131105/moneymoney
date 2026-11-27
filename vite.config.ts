import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Moneymoney',
        short_name: 'Moneymoney',
        description: 'Ta vie d’argent : salaire, dépenses, crédits, dettes et Nouran Parfums.',
        lang: 'fr',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f0f2f5',
        theme_color: '#f0f2f5',
        icons: [
          { src: `${base}pwa-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${base}pwa-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: `${base}index.html`,
      },
      devOptions: { enabled: false },
    }),
  ],
})
