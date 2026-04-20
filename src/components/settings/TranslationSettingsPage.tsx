import { useState, useEffect, useRef } from 'react';
import { Languages, Sparkles, Info, Search, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { Ticket } from '@/src/types';
import { useMembershipTier } from '@/src/lib/membership';
import { LockedFeatureNotice, MemberOnlyBadge } from '@/src/components/membership/MemberUi';

const STORAGE_KEY = 'edesk_translation_settings_v1';

export interface TranslationSettingsState {
  inboundTranslateEnabled: boolean;
  inboundTargetLang: string;
  outboundTranslateOnSend: boolean;
}

const DEFAULT_SETTINGS: TranslationSettingsState = {
  inboundTranslateEnabled: true,
  inboundTargetLang: 'zh-CN',
  outboundTranslateOnSend: true,
};

const PINNED_LANGUAGES = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁体中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'de', label: 'Deutsch' },
];

const ALL_LANGUAGES = [
  ...PINNED_LANGUAGES,
  { value: 'fr', label: 'Français (法语)' },
  { value: 'es', label: 'Español (西班牙语)' },
  { value: 'it', label: 'Italiano (意大利语)' },
  { value: 'pt', label: 'Português (葡萄牙语)' },
  { value: 'ru', label: 'Русский (俄语)' },
  { value: 'ko', label: '한국어 (韩语)' },
  { value: 'ar', label: 'العربية (阿拉伯语)' },
  { value: 'nl', label: 'Nederlands (荷兰语)' },
  { value: 'pl', label: 'Polski (波兰语)' },
  { value: 'tr', label: 'Türkçe (土耳其语)' },
  { value: 'vi', label: 'Tiếng Việt (越南语)' },
  { value: 'th', label: 'ไทย (泰语)' },
  { value: 'id', label: 'Bahasa Indonesia (印尼语)' },
  { value: 'ms', label: 'Bahasa Melayu (马来语)' },
  { value: 'hi', label: 'हिन्दी (印地语)' },
  { value: 'sv', label: 'Svenska (瑞典语)' },
  { value: 'da', label: 'Dansk (丹麦语)' },
  { value: 'fi', label: 'Suomi (芬兰语)' },
  { value: 'no', label: 'Norsk (挪威语)' },
  { value: 'cs', label: 'Čeština (捷克语)' },
  { value: 'el', label: 'Ελληνικά (希腊语)' },
  { value: 'he', label: 'עברית (希伯来语)' },
];

/** 传给 AI 翻译接口的 targetLang 文案（与设置页下拉一致） */
export function getInboundTargetLangLabel(code: string): string {
  return ALL_LANGUAGES.find((o) => o.value === code)?.label ?? code;
}

/** 会话气泡里「译文」行前缀展示 */
export function inboundTranslationDisplayTag(code: string): string {
  switch (code) {
    case 'zh-CN':
      return '🇨🇳 中文';
    case 'zh-TW':
      return '🇨🇳 繁中';
    case 'en':
      return '🇺🇸 English';
    case 'ja':
      return '🇯🇵 日本語';
    case 'de':
      return '🇩🇪 Deutsch';
    default:
      return getInboundTargetLangLabel(code);
  }
}

function SearchableLanguageSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      return;
    }
    const handlePointerDown = (e: MouseEvent) => {
      // Because we are inside a button that might also be listening to clicks, 
      // we need to be careful. The outer container handles clicks correctly.
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    // Use mousedown instead of pointerdown to avoid interference with outer buttons
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  const selectedLabel = ALL_LANGUAGES.find((l) => l.value === value)?.label || value;

  const filteredLanguages = ALL_LANGUAGES.filter(
    (l) =>
      l.label.toLowerCase().includes(search.toLowerCase()) ||
      l.value.toLowerCase().includes(search.toLowerCase())
  );

  // 分离置顶和非置顶
  const pinnedIds = new Set(PINNED_LANGUAGES.map((l) => l.value));
  const filteredPinned = filteredLanguages.filter((l) => pinnedIds.has(l.value));
  const filteredOthers = filteredLanguages.filter((l) => !pinnedIds.has(l.value));

  return (
    <div className="relative flex-1 min-w-0" ref={containerRef}>
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
          }
        }}
        className={cn(
          'w-full flex items-center justify-between px-2 py-1.5 bg-white border rounded-md text-xs font-medium outline-none transition-all cursor-pointer',
          disabled
            ? 'opacity-50 bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed'
            : isOpen
            ? 'border-[#F97316] ring-2 ring-[#F97316]/20 text-slate-800'
            : 'border-slate-200 text-slate-800 hover:border-slate-300'
        )}
      >
        <span className="truncate select-none">{selectedLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1 pointer-events-none" />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-[240px] right-0 sm:left-0 sm:right-auto bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                placeholder="搜索语言..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]"
              />
            </div>
          </div>
          <div className="overflow-y-auto p-1 custom-scrollbar max-h-[260px]">
            {filteredLanguages.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-500">未找到匹配的语言</div>
            ) : (
              <>
                {filteredPinned.length > 0 && (
                  <div className="mb-1">
                    <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      常用语言
                    </div>
                    {filteredPinned.map((lang) => (
                      <button
                        key={lang.value}
                        type="button"
                        onClick={() => {
                          onChange(lang.value);
                          setIsOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-md transition-colors',
                          value === lang.value
                            ? 'bg-orange-50 text-orange-700 font-bold'
                            : 'text-slate-700 hover:bg-slate-100'
                        )}
                      >
                        <span className="truncate">{lang.label}</span>
                        {value === lang.value && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
                
                {filteredPinned.length > 0 && filteredOthers.length > 0 && (
                  <div className="h-px bg-slate-100 my-1 mx-2" />
                )}

                {filteredOthers.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      所有语言
                    </div>
                    {filteredOthers.map((lang) => (
                      <button
                        key={lang.value}
                        type="button"
                        onClick={() => {
                          onChange(lang.value);
                          setIsOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-md transition-colors',
                          value === lang.value
                            ? 'bg-orange-50 text-orange-700 font-bold'
                            : 'text-slate-700 hover:bg-slate-100'
                        )}
                      >
                        <span className="truncate">{lang.label}</span>
                        {value === lang.value && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
      aria-label={title}
      title={title}
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
  const [settings, setSettings] = useState<TranslationSettingsState>(loadSettings);
  const { isMember } = useMembershipTier();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const patch = (partial: Partial<TranslationSettingsState>) =>
    setSettings((s) => ({ ...s, ...partial }));

  return (
    <div className="flex flex-1 flex-col min-h-0 min-w-0 bg-slate-50">
      <div className="flex flex-col flex-1 min-h-0 max-w-5xl mx-auto w-full px-5 py-4 gap-2">
        <header className="flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">智能翻译</h1>
              {!isMember ? <MemberOnlyBadge /> : null}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">店铺语种、积分在母系统查看。</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 shrink-0">
            <Languages className="w-5 h-5" strokeWidth={2} />
          </div>
        </header>

        <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto">
          {!isMember ? (
            <LockedFeatureNotice
              title="翻译配置仅会员可用"
              description="非会员仍可查看翻译配置界面与能力说明，但无法修改翻译开关、目标语言或发送前自动翻译。"
            />
          ) : null}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            <section className="flex flex-col rounded-xl border bg-white shadow-sm w-full border-slate-200">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 shrink-0 bg-slate-50/50 rounded-t-xl">
                <Info className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-bold text-slate-900">入站</h2>
              </div>
              <div className="p-3 flex flex-col gap-2">
                <div className="flex flex-col gap-3">
                  <div
                    className={cn(
                      'flex flex-col gap-3 rounded-xl border px-3 py-2.5 transition-all',
                      settings.inboundTranslateEnabled
                        ? 'border-orange-200 bg-orange-50/80 ring-1 ring-orange-100'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    )}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-slate-900">自动翻译买家消息</span>
                        <button
                          type="button"
                          aria-label="自动翻译买家消息"
                          title="自动翻译买家消息"
                          disabled={!isMember}
                          onClick={() => patch({ inboundTranslateEnabled: !settings.inboundTranslateEnabled })}
                          className={cn(
                            'shrink-0 h-6 w-11 rounded-full p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-500',
                            settings.inboundTranslateEnabled ? 'bg-[#F97316]' : 'bg-slate-200',
                            !isMember && 'cursor-not-allowed opacity-60'
                          )}
                        >
                          <span
                            className={cn(
                              'block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                              settings.inboundTranslateEnabled ? 'translate-x-5' : 'translate-x-0'
                            )}
                          />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        开启后，工单详情内买家与平台消息将自动翻译
                      </p>
                      <div
                        className={cn(
                          'mt-3 flex items-center gap-2 pt-3 border-t',
                          settings.inboundTranslateEnabled ? 'border-orange-200/50' : 'border-slate-100'
                        )}
                      >
                        <span className="text-[11px] text-slate-500 shrink-0">自动将买家消息改为：</span>
                        <SearchableLanguageSelect
                          value={settings.inboundTargetLang}
                          onChange={(val) => patch({ inboundTargetLang: val })}
                          disabled={!isMember || !settings.inboundTranslateEnabled}
                        />
                      </div>
                      {!isMember ? (
                        <p className="text-[11px] text-amber-700">当前为非会员，翻译配置仅展示不可修改。</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="flex flex-col rounded-xl border bg-white shadow-sm w-full border-slate-200">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 shrink-0 bg-slate-50/50 rounded-t-xl">
                <Languages className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-bold text-slate-900">出站</h2>
              </div>
              <div className="p-3 flex flex-col gap-2">
                <p className="text-[11px] text-slate-500 leading-snug">平台语由母系统按店铺同步；此处定发送前是否翻译。</p>
                <ToggleRow
                  on={settings.outboundTranslateOnSend}
                  onToggle={() => patch({ outboundTranslateOnSend: !settings.outboundTranslateOnSend })}
                  disabled={!isMember}
                  title="发送前译为平台语"
                  subtitle="计翻译积分。"
                />
                {!isMember ? (
                  <p className="text-[11px] text-amber-700">开通会员后，才可启用发送前自动翻译并实际生效。</p>
                ) : null}
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

export function saveTranslationSettings(settings: TranslationSettingsState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** 列表/详情标题：开启自动翻译用译入 subject；关闭则用平台原文，不触发翻译模型 */
export function getTicketSubjectForDisplay(ticket: Ticket): string {
  if (getTranslationSettings().inboundTranslateEnabled) return ticket.subject;
  return ticket.subjectOriginal ?? ticket.subject;
}
