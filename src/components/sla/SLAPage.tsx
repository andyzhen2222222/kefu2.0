import { useState, useEffect, useCallback } from 'react';
import { Plus, Save, Trash2, Pencil } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import AddSLARuleModal, { type NewSlaRulePayload } from './AddSLARuleModal';
import { useAuth } from '@/src/hooks/useAuth';
import {
  intellideskConfigured,
  intellideskTenantId,
  intellideskUserIdForApi,
  fetchSlaRules,
  createSlaRule,
  patchSlaRule,
  deleteSlaRule,
  fetchRoutingRuleOptions,
  type ApiSlaRuleRow,
} from '@/src/services/intellideskApi';

import { platformGroupLabelFromType } from '@/src/lib/platformLabels';

function channelBadge(rule: ApiSlaRuleRow, platforms: { value: string; label: string }[] = []): { label: string; className: string } {
  const raw = rule.channelPattern ?? '';
  // 1. 全平台/未设置识别
  if (!raw || raw === '%' || raw.toLowerCase() === 'all' || raw.toLowerCase() === 'global') {
    return { label: '全平台', className: 'bg-slate-100 text-slate-700' };
  }
  
  const clean = raw.replace(/[%[\]]/g, '').trim(); // 移除 SQL % 或可能的方括号
  const lowerClean = clean.toLowerCase();

  // 2. 优先从租户平台列表中寻找精确或模糊匹配（处理如 Amazon vs Amazon_SP_API）
  const matched = platforms.find((pl) => {
    const val = pl.value.toLowerCase();
    return val === lowerClean || lowerClean === val.replace(/_.*$/, '') || val === lowerClean.replace(/_.*$/, '');
  });
  
  if (matched) {
    // 优先使用租户配置的 Label，其次尝试标准格式化
    const displayLabel = matched.label || platformGroupLabelFromType(matched.value) || clean;
    let className = 'bg-indigo-100 text-indigo-700';
    const lowerValue = matched.value.toLowerCase();
    if (lowerValue.includes('amazon')) className = 'bg-blue-100 text-blue-700';
    else if (lowerValue.includes('ebay')) className = 'bg-purple-100 text-purple-700';
    else if (lowerValue.includes('shopify')) className = 'bg-green-100 text-green-700';
    return { label: displayLabel, className };
  }

  // 3. 兜底内置标准格式化（使用统一的平台标签转换工具）
  const stdLabel = platformGroupLabelFromType(clean);
  if (stdLabel) {
    let className = 'bg-amber-100 text-amber-800';
    const l = stdLabel.toLowerCase();
    if (l.includes('amazon')) className = 'bg-blue-100 text-blue-700';
    else if (l.includes('ebay')) className = 'bg-purple-100 text-purple-700';
    else if (l.includes('shopify')) className = 'bg-green-100 text-green-700';
    return { label: stdLabel, className };
  }
  
  // 4. 最后兜底：直接显示清理后的内容
  return { label: clean, className: 'bg-amber-100 text-amber-800' };
}

export default function SLAPage() {
  const { user } = useAuth();
  const apiOn = intellideskConfigured();
  const [isAddSLAModalOpen, setIsAddSLAModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ApiSlaRuleRow | null>(null);
  const [rows, setRows] = useState<ApiSlaRuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingModal, setSavingModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<{ value: string; label: string }[]>([]);

  const tenantId = intellideskTenantId();
  const userId = intellideskUserIdForApi(user?.id);

  const reload = useCallback(async () => {
    if (!apiOn) return;
    setLoading(true);
    setError(null);
    try {
      const [list, opts] = await Promise.all([
        fetchSlaRules(tenantId, userId),
        fetchRoutingRuleOptions(tenantId, userId),
      ]);
      setRows(list);
      setPlatforms(opts.platforms);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [apiOn, tenantId, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSave = async (payload: NewSlaRulePayload) => {
    if (!apiOn) return;
    setSavingModal(true);
    setError(null);
    try {
      if (editingRule) {
        await patchSlaRule(tenantId, userId, editingRule.id, {
          name: payload.name,
          channelPattern: payload.channelPattern,
          warningHours: payload.warningHours,
          timeoutHours: payload.timeoutHours,
          conditions: payload.conditions,
        });
      } else {
        await createSlaRule(tenantId, userId, {
          name: payload.name,
          channelPattern: payload.channelPattern,
          warningHours: payload.warningHours,
          timeoutHours: payload.timeoutHours,
          conditions: payload.conditions,
        });
      }
      setEditingRule(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingModal(false);
    }
  };

  const toggleEnabled = async (rule: ApiSlaRuleRow, enabled: boolean) => {
    if (!apiOn) return;
    setError(null);
    try {
      await patchSlaRule(tenantId, userId, rule.id, { enabled });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const removeRule = async (id: string) => {
    if (!apiOn || !window.confirm('删除该 SLA 规则？')) return;
    setError(null);
    try {
      await deleteSlaRule(tenantId, userId, id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">SLA 规则配置</h1>
            <p className="text-sm text-slate-500 mt-1">自定义不同平台和优先级的超时时间</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingRule(null);
              setIsAddSLAModalOpen(true);
            }}
            className="px-4 py-2 bg-[#F97316] hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition-colors shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加规则
          </button>
        </div>

        {apiOn && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {apiOn ? (
            <div className="space-y-4">
              {loading && <p className="text-sm text-slate-500">加载中…</p>}
              {!loading && rows.length === 0 && (
                <p className="text-sm text-slate-500">暂无规则，点击「添加规则」创建。</p>
              )}
              {rows.map((rule) => {
                const badge = channelBadge(rule, platforms);
                return (
                  <div
                    key={rule.id}
                    className="p-5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-xs font-bold shrink-0',
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                        <h3 className="font-bold text-slate-900 truncate">{rule.name}</h3>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-medium text-slate-600">
                          超时 {rule.timeoutHours}h / 预警 {rule.warningHours}h
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer ml-2">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={rule.enabled}
                            onChange={(e) => void toggleEnabled(rule, e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F97316]" />
                        </label>
                        <button
                          type="button"
                          title="修改"
                          onClick={() => {
                            setEditingRule(rule);
                            setIsAddSLAModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="删除"
                          onClick={() => void removeRule(rule.id)}
                          className="p-2 text-slate-400 hover:text-red-600 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                      <div className="space-y-1">
                        <span className="text-slate-500">警告阈值</span>
                        <p className="font-medium text-slate-900">提前 {rule.warningHours} 小时</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-500">超时阈值</span>
                        <p className="font-medium text-slate-900">{rule.timeoutHours} 小时</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-500">平台/店铺匹配</span>
                        <p className="font-medium text-slate-900 font-mono text-xs">
                          {rule.channelPattern ?? '（全部）'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {[
                { name: '标准回复时效', platform: 'Amazon', timeout: 24, warning: 2, condition: '所有 Amazon 消息' },
                { name: '周末回复时效', platform: 'eBay', timeout: 48, warning: 4, condition: '周六、周日' },
              ].map((demo, idx) => {
                const badge = channelBadge({ channelPattern: demo.platform } as any, []);
                return (
                  <div key={idx} className="p-5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className={cn('px-2.5 py-1 rounded-lg text-xs font-bold', badge.className)}>
                          {badge.label}
                        </span>
                        <h3 className="font-bold text-slate-900">{demo.name}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-600">目标: {demo.timeout}小时</span>
                        <label className="relative inline-flex items-center cursor-pointer ml-4">
                          <input type="checkbox" className="sr-only peer" defaultChecked readOnly />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F97316]" />
                        </label>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="space-y-1">
                        <span className="text-slate-500">警告阈值 (Warning)</span>
                        <p className="font-medium text-slate-900">剩余 {demo.warning} 小时</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-500">超时阈值 (Timeout)</span>
                        <p className="font-medium text-slate-900">{demo.timeout} 小时</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-500">适用条件</span>
                        <p className="font-medium text-slate-900">{demo.condition}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-slate-500">
                未配置 VITE_API_BASE_URL 时为演示静态数据；配置后可读写后端 SLA 规则。
              </p>
            </div>
          )}

          {!apiOn && (
            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" />
                保存更改
              </button>
            </div>
          )}
        </div>
      </div>

      <AddSLARuleModal
        isOpen={isAddSLAModalOpen}
        onClose={() => {
          setIsAddSLAModalOpen(false);
          setEditingRule(null);
        }}
        onSubmit={apiOn ? handleSave : undefined}
        submitting={savingModal}
        initialData={editingRule}
        platforms={platforms}
      />
    </div>
  );
}
