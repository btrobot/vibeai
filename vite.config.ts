import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// Load .env.local for HMR config (not exposed to client, only used in config)
const env = loadEnv('development', process.cwd(), '');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  server: {
    port: Number(env.VITE_PORT) || 5000,
    host: '0.0.0.0',
    allowedHosts: true,
    hmr: {
      overlay: true,
      path: '/hot/vite-hmr',
      port: Number(env.VITE_PORT) || 5000,
      // Sandbox: HMR_CLIENT_PORT=443 (HTTPS passthrough)
      // Dev server behind nginx: HMR_CLIENT_PORT=8082 in .env.local
      clientPort: Number(env.HMR_CLIENT_PORT) || 443,
      timeout: 30000,
    },
    watch: {
      usePolling: true,
      interval: 100,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
});
