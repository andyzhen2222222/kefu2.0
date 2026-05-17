import { useState, useEffect } from 'react';
import {
  intellideskConfigured,
  subscribeToGlobalApiError,
  getGlobalApiError,
  setGlobalApiError,
} from '@/src/services/intellideskApi';
import { AlertCircle, RotateCw, X } from 'lucide-react';

/**
 * 开发态提示当前是「内置演示数据」还是「自建后端」，避免误用 npm run dev却以为在联调。
 */
export default function IntellideskSourceStrip() {
  const [globalError, setGlobalError] = useState<string | null>(getGlobalApiError());

  useEffect(() => {
    return subscribeToGlobalApiError((err) => setGlobalError(err));
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  /** 生产环境也展示全局 API/AI 错误，便于用户看到失败原因 */
  if (globalError) {
    return (
      <div
        className="shrink-0 border-b border-red-200 bg-red-50 px-3 py-1.5 text-red-900 sm:px-4"
        role="alert"
      >
        <div className="mx-auto flex max-w-5xl items-start gap-2">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold sm:text-xs">提示</p>
            <div
              className="mt-0.5 max-h-[3.5rem] overflow-y-auto rounded-md border border-red-100/90 bg-white/70 px-2 py-1 font-mono text-[10px] leading-snug text-red-900 [overflow-wrap:anywhere] sm:max-h-[4.5rem] sm:text-[11px]"
              title={globalError}
            >
              {globalError}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-0.5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setGlobalApiError(null)}
              className="rounded-md p-1.5 text-red-700 transition-colors hover:bg-red-100"
              title="关闭提示"
              aria-label="关闭提示"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setGlobalApiError(null);
                handleRetry();
              }}
              className="flex items-center gap-1 rounded-md p-1.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
              title="清除提示并刷新页面"
            >
              <RotateCw className="h-3 w-3 shrink-0" />
              <span className="hidden sm:inline">重试</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!import.meta.env.DEV) return null;

  const live = intellideskConfigured();
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  const mode = (import.meta.env.MODE ?? '').trim();

  if (live) {
    return (
      <div
        className="shrink-0 border-b px-4 py-1.5 text-center text-xs space-y-1 transition-colors bg-emerald-50 border-emerald-200 text-emerald-900"
        role="status"
      >
        <div className="flex items-center justify-center gap-2">
          <span className="font-semibold">Live API</span>
          <span className="mx-2 opacity-30">|</span>
          <span className="font-mono text-[11px] opacity-70">{base || '（未解析到地址）'}</span>
          <span className="ml-2 opacity-50 text-[10px]">mode: {mode}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="shrink-0 border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-xs text-amber-950 leading-relaxed"
      role="status"
    >
      <span className="font-bold">当前为内置演示数据（未连接 IntelliDesk 后端）</span>
      <span className="mx-2 text-amber-800">·</span>
      <span>
        你当前是 <strong>纯演示模式</strong>（<code className="rounded bg-amber-200/80 px-1">npm run dev</code> /{' '}
        <code className="rounded bg-amber-200/80 px-1">dev:mock</code>，建议访问{' '}
        <code className="rounded bg-amber-200/80 px-1">http://127.0.0.1:5173</code>
        ）。若 localhost 打不开请改用上述地址。要看真实数据：改跑{' '}
        <code className="rounded bg-amber-200/80 px-1">npm run dev:api</code>（PC 端口 4000，代理到后端默认 4001），并另开终端{' '}
        <code className="rounded bg-amber-200/80 px-1">cd backend && npm run dev</code>、数据库已就绪。
      </span>
      <span className="ml-2 text-amber-800/80">vite mode: {mode}</span>
    </div>
  );
}
