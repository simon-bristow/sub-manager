import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Sub Manager',
        short_name: 'SubMgr',
        description: 'Soccer substitution manager for coaches',
        theme_color: '#0e1a2b',
        background_color: '#0e1a2b',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/favicon.png', sizes: '32x32', type: 'image/png' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/__\//],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
