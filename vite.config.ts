import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@screens': path.resolve(__dirname, './src/screens'),
        '@types': path.resolve(__dirname, './src/types'),
    },
  },
  server: {
    proxy: {
      '/station': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/station/, ''),
      },
    },
  }
});