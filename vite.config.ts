import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify: file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // 正式联调：Vite 占 4000，后端默认 4001，同源转发 /api 与 /ws（见 .env.api）
      ...(mode === 'api'
        ? {
            proxy: {
              '/api': { target: 'http://127.0.0.1:4001', changeOrigin: true },
              '/ws': { target: 'ws://127.0.0.1:4001', ws: true },
            },
          }
        : {}),
    },
  };
});
