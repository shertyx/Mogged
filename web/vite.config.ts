import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    port: 3000,
    proxy: {
      '/auth': 'http://localhost:8080',
      '/user': 'http://localhost:8080',
      '/elo': 'http://localhost:8080',
      '/face': 'http://localhost:8080',
      '/matchmaking': { target: 'ws://localhost:8080', ws: true },
    },
  },
});
