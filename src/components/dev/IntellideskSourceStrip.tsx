import { intellideskConfigured } from '@/src/services/intellideskApi';

/**
 * 开发态提示当前是「内置演示数据」还是「自建后端」，避免误用 npm run dev 却以为在联调。
 */
export default function IntellideskSourceStrip() {
  if (!import.meta.env.DEV) return null;

  const live = intellideskConfigured();
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  const mode = (import.meta.env.MODE ?? '').trim();

  if (live) {
    return (
      <div
        className="shrink-0 border-b border-emerald-200 bg-emerald-50 px-4 py-1.5 text-center text-xs text-emerald-900 space-y-1"
        role="status"
      >
        <div>
          <span className="font-semibold">Live API</span>
          <span className="mx-2 text-emerald-700/80">|</span>
          <span className="font-mono text-[11px]">{base || '（未解析到地址）'}</span>
          <span className="ml-2 text-emerald-800/70">vite mode: {mode}</span>
        </div>
        <p className="text-[11px] text-emerald-800/85 leading-snug max-w-3xl mx-auto">
          收件箱为空时：在 <code className="rounded bg-emerald-100/90 px-1">backend</code> 执行{' '}
          <code className="rounded bg-emerald-100/90 px-1">npm run db:seed</code>（全量演示）。
          <code className="rounded bg-emerald-100/90 px-1">db:seed:production</code> 不含工单/订单/售后。
        </p>
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
        <code className="rounded bg-amber-200/80 px-1">dev:mock</code>，端口 3000）。要看真实数据：改跑{' '}
        <code className="rounded bg-amber-200/80 px-1">npm run dev:api</code>（端口 4000，代理到后端 4001），并另开终端{' '}
        <code className="rounded bg-amber-200/80 px-1">cd backend && npm run dev</code>、数据库已就绪。
      </span>
      <span className="ml-2 text-amber-800/80">vite mode: {mode}</span>
    </div>
  );
}
