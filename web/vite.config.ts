import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const BACKEND = 'http://localhost:8000'

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
        manifest: {
          id: '/',
          name: 'Trust Issues | أزمة ثقة',
          short_name: 'Trust Issues',
          description: 'Check any link or message for scams before you tap. افحص أي رابط أو رسالة قبل أن تضغط.',
          lang: 'en',
          dir: 'ltr',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          theme_color: '#101215',
          background_color: '#101215',
          categories: ['security', 'utilities'],
          icons: [
            { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          share_target: {
            action: '/share',
            method: 'GET',
            params: { title: 'title', text: 'text', url: 'url' },
          },
        },
      }),
    ],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': { target: BACKEND, changeOrigin: true },
        '/media': { target: BACKEND, changeOrigin: true },
        '/dns-query': { target: BACKEND, changeOrigin: true },
      },
    },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 1200,
    },
  }
})
