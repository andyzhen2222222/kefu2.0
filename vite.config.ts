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
      /**
       * 固定监听 IPv4 回环，避免 Windows 上「localhost → ::1」而 Vite 只绑在 IPv4 导致浏览器打不开。
       * 请用 http://127.0.0.1:端口 访问；需局域网设备访问时再改为 host: true 或 0.0.0.0。
       */
      host: '127.0.0.1',
      /** 本地启动后自动打开浏览器（用 127.0.0.1 避免 Windows localhost/IPv6 问题）；CI 设 CI=true 关闭 */
      open:
        process.env.CI === 'true'
          ? false
          : mode === 'api'
            ? 'http://127.0.0.1:4001/'
            : 'http://127.0.0.1:5173/',
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
        : {
            /** mock：与 npm 脚本 --port 一致；占用时顺延下一端口，避免端口冲突导致无法启动 */
            port: 5173,
            strictPort: false,
          }),
    },
  };
});
