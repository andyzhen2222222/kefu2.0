import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Languages, Sparkles, Info } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { Ticket } from '@/src/types';
import { useAuth } from '@/src/hooks/useAuth';
import { getDefaultSettingsPath } from './settingsNavConfig';

const STORAGE_KEY = 'edesk_translation_settings_v1';

export interface TranslationSettingsState {
  autoTranslateEnabled: boolean;
  inboundTargetLang: string;
  outboundTranslateOnSend: boolean;
  allowSendOriginalChinese: boolean;
}

const DEFAULT_SETTINGS: TranslationSettingsState = {
  autoTranslateEnabled: true,
  inboundTargetLang: 'zh-CN',
  outboundTranslateOnSend: true,
  allowSendOriginalChinese: true,
};

const INBOUND_LANG_OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁体中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'de', label: 'Deutsch' },
];

function loadSettings(): TranslationSettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<TranslationSettingsState>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function ToggleRow({
  on,
  onToggle,
  disabled,
  title,
  subtitle,
}: {
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  title: string;
  subtitle?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
        disabled && 'opacity-50 pointer-events-none',
        on ? 'border-orange-200 bg-orange-50/80 ring-1 ring-orange-100' : 'border-slate-200 bg-white hover:bg-slate-50'
      )}
    >
      <div className="min-w-0">
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        {subtitle ? <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{subtitle}</p> : null}
      </div>
      <span
        className={cn(
          'shrink-0 h-6 w-11 rounded-full p-0.5 transition-colors',
          on ? 'bg-[#F97316]' : 'bg-slate-200'
        )}
      >
        <span
          className={cn(
            'block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
            on ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </span>
    </button>
  );
}

export default function TranslationSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<TranslationSettingsState>(loadSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const patch = (partial: Partial<TranslationSettingsState>) =>
    setSettings((s) => ({ ...s, ...partial }));

  const enabled = settings.autoTranslateEnabled;

  if (user?.role !== 'admin') {
    return <Navigate to={getDefaultSettingsPath(user?.role)} replace />;
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 min-w-0 bg-slate-50">
      <div className="flex flex-col flex-1 min-h-0 max-w-5xl mx-auto w-full px-5 py-4 gap-2">
        <header className="flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">智能翻译</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">店铺语种、积分在母系统查看。</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 shrink-0">
            <Languages className="w-5 h-5" strokeWidth={2} />
          </div>
        </header>

        <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto">
          <section className="shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/90">
              <Sparkles className="w-4 h-4 text-[#F97316]" />
              <h2 className="text-sm font-bold text-slate-900">总开关</h2>
            </div>
            <div className="p-3">
              <ToggleRow
                on={settings.autoTranslateEnabled}
                onToggle={() => patch({ autoTranslateEnabled: !settings.autoTranslateEnabled })}
                title="启用自动翻译"
                subtitle="关：收件箱不自动译，不发翻译类积分。"
              />
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            <section
              className={cn(
                'flex flex-col rounded-xl border bg-white shadow-sm overflow-hidden w-full',
                enabled ? 'border-slate-200' : 'border-slate-200 opacity-55 pointer-events-none'
              )}
            >
              <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 shrink-0">
                <Info className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-bold text-slate-900">入站</h2>
              </div>
              <div className="p-3 flex flex-col gap-2">
                <p className="text-[11px] text-slate-500 leading-snug">买家与平台消息在收件箱显示为：</p>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">译入语言</label>
                <select
                  value={settings.inboundTargetLang}
                  onChange={(e) => patch({ inboundTargetLang: e.target.value })}
                  disabled={!enabled}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] disabled:opacity-50"
                >
                  {INBOUND_LANG_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section
              className={cn(
                'flex flex-col rounded-xl border bg-white shadow-sm overflow-hidden w-full',
                enabled ? 'border-slate-200' : 'border-slate-200 opacity-55 pointer-events-none'
              )}
            >
              <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 shrink-0">
                <Languages className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-bold text-slate-900">出站</h2>
              </div>
              <div className="p-3 flex flex-col gap-2">
                <p className="text-[11px] text-slate-500 leading-snug">平台语由母系统按店铺同步；此处定发送前是否翻译。</p>
                <ToggleRow
                  on={settings.outboundTranslateOnSend}
                  onToggle={() => patch({ outboundTranslateOnSend: !settings.outboundTranslateOnSend })}
                  disabled={!enabled}
                  title="发送前译为平台语"
                  subtitle="计翻译积分。"
                />
                <ToggleRow
                  on={settings.allowSendOriginalChinese}
                  onToggle={() => patch({ allowSendOriginalChinese: !settings.allowSendOriginalChinese })}
                  disabled={!enabled}
                  title="允许「本次发中文原文」"
                  subtitle="勾选后不译、不扣翻译积分。"
                />
              </div>
            </section>
          </div>

          <p className="text-[10px] text-slate-400 text-center shrink-0 leading-tight">
            演示配置存本地；母系统查余额、账单与店铺语言。
          </p>
        </div>
      </div>
    </div>
  );
}

export function getTranslationSettings(): TranslationSettingsState {
  return loadSettings();
}

/** 列表/详情标题：开启自动翻译用译入 subject；关闭则用平台原文，不触发翻译模型 */
export function getTicketSubjectForDisplay(ticket: Ticket): string {
  if (getTranslationSettings().autoTranslateEnabled) return ticket.subject;
  return ticket.subjectOriginal ?? ticket.subject;
}
