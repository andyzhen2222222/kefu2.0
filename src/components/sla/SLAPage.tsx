import { useState, useEffect, useCallback } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
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
  type ApiSlaRuleRow,
} from '@/src/services/intellideskApi';

function channelBadge(rule: ApiSlaRuleRow): { label: string; className: string } {
  const p = rule.channelPattern?.toLowerCase() ?? '';
  if (!p || p === '%') return { label: '全平台', className: 'bg-slate-100 text-slate-700' };
  if (p.includes('amazon')) return { label: 'Amazon', className: 'bg-blue-100 text-blue-700' };
  if (p.includes('ebay')) return { label: 'eBay', className: 'bg-purple-100 text-purple-700' };
  if (p.includes('shopify')) return { label: 'Shopify', className: 'bg-green-100 text-green-700' };
  return { label: '自定义', className: 'bg-amber-100 text-amber-800' };
}

export default function SLAPage() {
  const { user } = useAuth();
  const apiOn = intellideskConfigured();
  const [isAddSLAModalOpen, setIsAddSLAModalOpen] = useState(false);
  const [rows, setRows] = useState<ApiSlaRuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingModal, setSavingModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tenantId = intellideskTenantId();
  const userId = intellideskUserIdForApi(user?.id);

  const reload = useCallback(async () => {
    if (!apiOn) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchSlaRules(tenantId, userId);
      setRows(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [apiOn, tenantId, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleCreate = async (payload: NewSlaRulePayload) => {
    if (!apiOn) return;
    setSavingModal(true);
    setError(null);
    try {
      await createSlaRule(tenantId, userId, {
        name: payload.name,
        channelPattern: payload.channelPattern,
        warningHours: payload.warningHours,
        timeoutHours: payload.timeoutHours,
        conditions: payload.conditions,
      });
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
            onClick={() => setIsAddSLAModalOpen(true)}
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
                const badge = channelBadge(rule);
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
              <div className="p-5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">
                      Amazon
                    </span>
                    <h3 className="font-bold text-slate-900">标准回复时效</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-600">目标: 24小时</span>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input type="checkbox" className="sr-only peer" defaultChecked readOnly />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F97316]" />
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="space-y-1">
                    <span className="text-slate-500">警告阈值 (Warning)</span>
                    <p className="font-medium text-slate-900">剩余 2 小时</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500">超时阈值 (Timeout)</span>
                    <p className="font-medium text-slate-900">24 小时</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500">适用条件</span>
                    <p className="font-medium text-slate-900">所有 Amazon 消息</p>
                  </div>
                </div>
              </div>

              <div className="p-5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold">
                      eBay
                    </span>
                    <h3 className="font-bold text-slate-900">周末回复时效</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-600">目标: 48小时</span>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input type="checkbox" className="sr-only peer" defaultChecked readOnly />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F97316]" />
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="space-y-1">
                    <span className="text-slate-500">警告阈值 (Warning)</span>
                    <p className="font-medium text-slate-900">剩余 4 小时</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500">超时阈值 (Timeout)</span>
                    <p className="font-medium text-slate-900">48 小时</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500">适用条件</span>
                    <p className="font-medium text-slate-900">周六、周日</p>
                  </div>
                </div>
              </div>
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
        onClose={() => setIsAddSLAModalOpen(false)}
        onSubmit={apiOn ? handleCreate : undefined}
        submitting={savingModal}
      />
    </div>
  );
}
