import { useState, useEffect } from 'react';
import { X, Clock, AlertTriangle } from 'lucide-react';

export type NewSlaRulePayload = {
  name: string;
  channelPattern: string | null;
  warningHours: number;
  timeoutHours: number;
  conditions?: Record<string, unknown>;
};

interface AddSLARuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (payload: NewSlaRulePayload) => Promise<void>;
  submitting?: boolean;
  initialData?: {
    name: string;
    channelPattern: string | null;
    warningHours: number;
    timeoutHours: number;
    conditions?: any;
  } | null;
  platforms?: { value: string; label: string }[];
}

function platformToChannelPattern(platform: string): string | null {
  if (!platform || platform === 'all') return null;
  // If it's a known static lower-case fallback, we preserve the original casing style if needed, 
  // but `%platform%` is generally fine as it matches via ILIKE or our local includes.
  if (platform === 'amazon') return '%Amazon%';
  if (platform === 'ebay') return '%eBay%';
  if (platform === 'shopify') return '%Shopify%';
  return `%${platform}%`;
}

function channelPatternToPlatform(pattern: string | null, platforms: { value: string; label: string }[] = []): string {
  if (!pattern) return 'all';
  const clean = pattern.replace(/%/g, '');
  const lowerClean = clean.toLowerCase();
  
  const matched = platforms.find((p) => p.value.toLowerCase() === lowerClean);
  if (matched) return matched.value;

  if (lowerClean === 'amazon') return 'amazon';
  if (lowerClean === 'ebay') return 'ebay';
  if (lowerClean === 'shopify') return 'shopify';

  return clean;
}

export default function AddSLARuleModal({
  isOpen,
  onClose,
  onSubmit,
  submitting = false,
  initialData = null,
  platforms = [],
}: AddSLARuleModalProps) {
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('all');
  const [timeoutHours, setTimeoutHours] = useState(24);
  const [warningHours, setWarningHours] = useState(2);
  const [workNatural, setWorkNatural] = useState(true);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setPlatform(channelPatternToPlatform(initialData.channelPattern, platforms));
        setTimeoutHours(initialData.timeoutHours);
        setWarningHours(initialData.warningHours);
        setWorkNatural(
          !initialData.conditions ||
          (initialData.conditions as Record<string, any>).calendar !== 'weekdays'
        );
      } else {
        setName('');
        setPlatform('all');
        setTimeoutHours(24);
        setWarningHours(2);
        setWorkNatural(true);
      }
    }
  }, [isOpen, initialData, platforms]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const n = name.trim();
    if (!n) return;
    if (onSubmit) {
      await onSubmit({
        name: n,
        channelPattern: platformToChannelPattern(platform),
        warningHours,
        timeoutHours,
        conditions: workNatural ? { calendar: 'natural' } : { calendar: 'weekdays' },
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{initialData ? '编辑 SLA 规则' : '新增 SLA 规则'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">规则名称</label>
            <input
              type="text"
              placeholder="例如：Amazon 标准回复时效"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">适用平台</label>
            <select
              title="适用平台"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              <option value="all">所有平台</option>
              {platforms && platforms.length > 0 ? (
                platforms.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))
              ) : (
                <>
                  <option value="amazon">Amazon</option>
                  <option value="ebay">eBay</option>
                  <option value="shopify">Shopify</option>
                </>
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                目标回复时间 (小时)
              </label>
              <input
                type="number"
                min={1}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                value={timeoutHours}
                onChange={(e) => setTimeoutHours(Number(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                预警时间 (剩余小时)
              </label>
              <input
                type="number"
                min={1}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                value={warningHours}
                onChange={(e) => setWarningHours(Number(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">工作时间计算</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="workhours"
                  className="w-4 h-4 border-slate-300 text-[#F97316] focus:ring-[#F97316]"
                  checked={workNatural}
                  onChange={() => setWorkNatural(true)}
                />
                <span className="text-sm font-medium text-slate-700">7x24 小时 (自然时间)</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="workhours"
                  className="w-4 h-4 border-slate-300 text-[#F97316] focus:ring-[#F97316]"
                  checked={!workNatural}
                  onChange={() => setWorkNatural(false)}
                />
                <span className="text-sm font-medium text-slate-700">仅工作日 (跳过周末)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!name.trim() || submitting}
            onClick={() => void handleSave()}
            className="px-5 py-2.5 bg-[#F97316] text-white rounded-xl text-sm font-bold hover:bg-[#ea580c] transition-colors shadow-sm disabled:opacity-50"
          >
            {submitting ? '保存中…' : '保存规则'}
          </button>
        </div>
      </div>
    </div>
  );
}
