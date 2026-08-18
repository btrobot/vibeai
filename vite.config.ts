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
    port: Number(env.VITE_PORT) || 5001,
    host: '0.0.0.0',
    allowedHosts: true,
    hmr: {
      overlay: true,
      path: '/hot/vite-hmr',
      port: Number(env.VITE_PORT) || 5001,
      // Sandbox (COZE_PROJECT_ENV=DEV): HTTPS passthrough on 443
      // Test machine / direct access: use server port (no clientPort override)
      // Override: set HMR_CLIENT_PORT in .env.local
      ...(env.HMR_CLIENT_PORT
        ? { clientPort: Number(env.HMR_CLIENT_PORT) }
        : env.COZE_PROJECT_ENV === 'DEV'
          ? { clientPort: 443 }
          : {}),
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
