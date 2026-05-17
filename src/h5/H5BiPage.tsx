import DashboardPage from '@/src/components/dashboard/DashboardPage';

const biEmbedUrl = (import.meta.env.VITE_NEZHA_BI_EMBED_URL as string | undefined)?.trim();

/**
 * BI Tab：优先嵌入母系统 BI 页面（小程序 WebView / H5 同域），否则展示 IntelliDesk 工作台看板。
 */
export default function H5BiPage() {
  if (biEmbedUrl) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-slate-50">
        <iframe
          title="哪吒 BI"
          src={biEmbedUrl}
          className="h-full w-full min-h-0 flex-1 border-0"
          allow="fullscreen"
        />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-y-contain bg-slate-50">
      <div className="sticky top-0 z-10 border-b border-orange-200/60 bg-gradient-to-b from-[#F97316] to-[#ea580c] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white shadow-sm">
        <h1 className="text-center text-lg font-bold tracking-tight">哪吒 BI</h1>
        <p className="mt-0.5 text-center text-[11px] text-white/85">数据概览 · 与客服工单联动</p>
      </div>
      <div className="p-3 sm:p-4">
        <DashboardPage />
      </div>
    </div>
  );
}
