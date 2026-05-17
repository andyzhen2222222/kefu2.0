import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Loader2, Pencil } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  getEnabledPolishPresets,
  subscribeAiPolishPresets,
  type AiPolishPreset,
} from '@/src/lib/aiPolishPresetsStore';

export type AiPolishPickerProps = {
  disabled?: boolean;
  isPolishing: boolean;
  polishingPresetId: string | null;
  onSelectPreset: (preset: AiPolishPreset) => void;
  className?: string;
  /** bottom-full 浮层（PC）或作为列表块（H5 Sheet 内） */
  variant?: 'popover' | 'list';
};

export default function AiPolishPicker({
  disabled,
  isPolishing,
  polishingPresetId,
  onSelectPreset,
  className,
  variant = 'popover',
}: AiPolishPickerProps) {
  const [presets, setPresets] = useState(() => getEnabledPolishPresets());

  useEffect(() => {
    return subscribeAiPolishPresets(() => setPresets(getEnabledPolishPresets()));
  }, []);

  const list = (
    <ul className={cn(variant === 'list' ? 'space-y-1' : 'max-h-[min(70vh,20rem)] overflow-y-auto p-1')}>
      {presets.length === 0 ? (
        <li className="px-3 py-4 text-center text-xs text-slate-500">
          暂无启用的润色方案，请前往
          <Link to="/settings/ai-polish" className="mx-0.5 font-medium text-[#F97316] hover:underline">
            设置
          </Link>
          添加
        </li>
      ) : (
        presets.map((preset) => {
          const loading = isPolishing && polishingPresetId === preset.id;
          return (
            <li key={preset.id}>
              <button
                type="button"
                disabled={disabled || isPolishing}
                onClick={() => onSelectPreset(preset)}
                className={cn(
                  'flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition-colors',
                  variant === 'list' ? 'active:bg-slate-50' : 'hover:bg-slate-50',
                  loading && 'bg-indigo-50/80'
                )}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-indigo-600" />
                  ) : (
                    <Pencil className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                  )}
                  {preset.name}
                </span>
                {preset.hint ? (
                  <span className="text-[11px] leading-snug text-slate-500">{preset.hint}</span>
                ) : null}
              </button>
            </li>
          );
        })
      )}
    </ul>
  );

  if (variant === 'list') {
    return <div className={className}>{list}</div>;
  }

  return (
    <div
      className={cn(
        'absolute right-0 bottom-full z-50 mb-2 w-[min(20rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200',
        className
      )}
    >
      <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <p className="text-xs font-semibold text-slate-700">选择润色方案</p>
      </div>
      {list}
      <div className="border-t border-slate-100 bg-slate-50/50 p-2 flex justify-center">
        <Link
          to="/settings/ai-polish"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
        >
          管理润色方案
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
