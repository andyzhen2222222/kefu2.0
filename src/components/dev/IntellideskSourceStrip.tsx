import { useState, useEffect } from 'react';
import {
  intellideskConfigured,
  subscribeToGlobalApiError,
  getGlobalApiError,
  setGlobalApiError,
} from '@/src/services/intellideskApi';
import { AlertCircle, RotateCw } from 'lucide-react';

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
        className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-1.5 text-center text-xs text-red-900"
        role="alert"
      >
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
          <span className="font-bold shrink-0">提示：</span>
          <span className="text-left max-w-3xl" title={globalError}>
            {globalError}
          </span>
          <button
            type="button"
            onClick={() => {
              setGlobalApiError(null);
              handleRetry();
            }}
            className="ml-1 p-1 hover:bg-red-100 rounded-md transition-colors flex items-center gap-1 font-bold text-red-700"
            title="清除提示并刷新"
          >
            <RotateCw className="w-3 h-3" />
            重试
          </button>
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
        <code className="rounded bg-amber-200/80 px-1">npm run dev:api</code>（端口 4001，代理到后端 4000），并另开终端{' '}
        <code className="rounded bg-amber-200/80 px-1">cd backend && npm run dev</code>、数据库已就绪。
      </span>
      <span className="ml-2 text-amber-800/80">vite mode: {mode}</span>
    </div>
  );
}
