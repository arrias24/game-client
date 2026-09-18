import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': src,
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@hooks': fileURLToPath(new URL('./src/hooks', import.meta.url)),
      '@services': fileURLToPath(new URL('./src/services', import.meta.url)),
      '@screens': fileURLToPath(new URL('./src/screens', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/station': {
        target: process.env.STATION_PROXY_TARGET || 'http://127.0.0.1:8090',
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/station/, ''),
      },
    },
  },
  preview: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/station': {
        target: process.env.STATION_PROXY_TARGET || 'http://127.0.0.1:8090',
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/station/, ''),
      },
    },
  },
});
