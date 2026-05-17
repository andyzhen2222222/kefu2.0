import { ChevronLeft } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  H5_HEADER,
  H5_HEADER_INNER,
  H5_TAB_PILL_ACTIVE,
  H5_TAB_PILL_INACTIVE,
} from '@/src/h5/h5UiSpec';

export type H5DetailTab = {
  id: string;
  label: string;
};

type H5DetailHeaderProps = {
  title: string;
  subtitle?: string;
  tabs: H5DetailTab[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  onBack: () => void;
  children?: React.ReactNode;
};

export default function H5DetailHeader({
  title,
  subtitle,
  tabs,
  activeTabId,
  onTabChange,
  onBack,
  children,
}: H5DetailHeaderProps) {
  return (
    <header className={H5_HEADER}>
      <div className={H5_HEADER_INNER}>
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition-colors active:bg-slate-100"
          aria-label="返回"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2} />
        </button>
        <h1 className="min-w-0 truncate text-center text-[15px] font-bold text-slate-900">工单详情</h1>
        <div className="w-11 shrink-0" aria-hidden />
      </div>

      <div className="space-y-2 px-3 pb-2 pt-1">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900" title={title}>
          {title}
        </p>
        {subtitle ? (
          <p className="truncate text-[11px] tabular-nums text-slate-500" title={subtitle}>
            {subtitle}
          </p>
        ) : null}

        <div
          className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="工单业务分区"
        >
          {tabs.map((t) => {
            const active = activeTabId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(t.id)}
                className={active ? H5_TAB_PILL_ACTIVE : H5_TAB_PILL_INACTIVE}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {children}
      </div>
    </header>
  );
}
