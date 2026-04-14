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
      // 避免仅绑定 0.0.0.0 时 Windows 上 localhost 优先走 ::1 导致浏览器打不开
      host: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify: file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // 正式联调：Vite 占 4001，后端默认 4000，同源转发 /api 与 /ws（见 .env.api）
      ...(mode === 'api'
        ? (() => {
            const apiProxyTarget =
              (env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:4000').replace(/\/$/, '');
            return {
              /** 禁止端口被占用时自动改占 4000，否则会与后端冲突并出现「服务内部错误」 */
              strictPort: true,
              port: 4001,
              proxy: {
                '/api': {
                  target: apiProxyTarget,
                  changeOrigin: true,
                },
                '/ws': { target: apiProxyTarget, ws: true },
              },
            };
          })()
        : {}),
    },
  };
});
