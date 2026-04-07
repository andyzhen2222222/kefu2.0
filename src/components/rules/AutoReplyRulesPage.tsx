import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Plus, Save, Trash2, Edit2 } from 'lucide-react';
import AddAutoReplyRuleModal, { type AutoReplyRuleSavePayload } from './AddAutoReplyRuleModal';
import { useAuth } from '@/src/hooks/useAuth';
import {
  intellideskConfigured,
  intellideskTenantId,
  intellideskUserIdForApi,
  fetchAutoReplyRules,
  createAutoReplyRule,
  patchAutoReplyRule,
  deleteAutoReplyRule,
  type ApiAutoReplyRuleRow,
} from '@/src/services/intellideskApi';
import { routingAfterSalesLabel } from '@/src/lib/routingRuleOptions';

function describeTrigger(r: ApiAutoReplyRuleRow): string {
  if (r.keywords?.length) return `关键字：${r.keywords.join('、')}`;
  const im = r.intentMatch ?? '';
  if (im.startsWith('__time__:')) {
    const rest = im.slice('__time__:'.length);
    const idx = rest.indexOf(':');
    const t = idx === -1 ? rest : rest.slice(0, idx);
    const times = idx === -1 ? '' : rest.slice(idx + 1);
    let label = '';
    if (t === 'weekend') label = '周末';
    else if (t === 'weekday') label = '工作日';
    else if (t === 'daily') label = '每天';
    else label = t;
    return `时间段：${label}${times ? ` (${times})` : ''}`;
  }
  if (im.startsWith('__after_sales_type__:')) {
    const v = im.slice('__after_sales_type__:'.length);
    return `售后类型：${routingAfterSalesLabel(v)}`;
  }
  if (im) return `意图：${im}`;
  return '—';
}

export default function AutoReplyRulesPage() {
  const { user } = useAuth();
  const apiOn = intellideskConfigured();
  const [isAddAutoReplyModalOpen, setIsAddAutoReplyModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ApiAutoReplyRuleRow | null>(null);
  const [rows, setRows] = useState<ApiAutoReplyRuleRow[]>([]);
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
      const list = await fetchAutoReplyRules(tenantId, userId);
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

  const closeRuleModal = () => {
    setIsAddAutoReplyModalOpen(false);
    setEditingRule(null);
  };

  const handleSaveRule = async (payload: AutoReplyRuleSavePayload) => {
    if (!apiOn) return;
    setSavingModal(true);
    setError(null);
    try {
      if (payload.ruleId) {
        await patchAutoReplyRule(tenantId, userId, payload.ruleId, {
          name: payload.name,
          intentMatch: payload.intentMatch,
          keywords: payload.keywords,
          replyContent: payload.replyContent,
          markRepliedOnSend: payload.markRepliedOnSend,
        });
      } else {
        await createAutoReplyRule(tenantId, userId, {
          name: payload.name,
          enabled: true,
          intentMatch: payload.intentMatch,
          keywords: payload.keywords,
          replyContent: payload.replyContent,
          markRepliedOnSend: payload.markRepliedOnSend,
        });
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingModal(false);
    }
  };

  const toggleEnabled = async (rule: ApiAutoReplyRuleRow, enabled: boolean) => {
    if (!apiOn) return;
    setError(null);
    try {
      await patchAutoReplyRule(tenantId, userId, rule.id, { enabled });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const removeRule = async (id: string) => {
    if (!apiOn || !window.confirm('删除该自动回复规则？')) return;
    setError(null);
    try {
      await deleteAutoReplyRule(tenantId, userId, id);
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
            <h1 className="text-2xl font-bold text-slate-900">自动回复规则</h1>
            <p className="text-sm text-slate-500 mt-1">
              基于时间、关键字、售后类型配置自动回复；支持修改与启用开关（后端规则表）
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingRule(null);
              setIsAddAutoReplyModalOpen(true);
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
              {rows.map((rule) => (
                <div
                  key={rule.id}
                  className="p-5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <MessageSquare className="w-5 h-5 text-[#F97316] shrink-0" />
                      <h3 className="font-bold text-slate-900 truncate">{rule.name}</h3>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="relative inline-flex items-center cursor-pointer">
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
                          setIsAddAutoReplyModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-[#F97316] rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
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
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-slate-500 shrink-0">触发条件</span>
                      <span className="font-medium text-slate-900">{describeTrigger(rule)}</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-slate-500 shrink-0">回复正文</span>
                      <span className="font-medium text-slate-900 line-clamp-2 break-words">
                        {rule.replyContent?.trim() ? rule.replyContent.trim() : '（未配置正文，规则不会发出内容）'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-slate-500 w-24 shrink-0">执行动作</span>
                      <span className="font-medium text-slate-900">
                        {rule.markRepliedOnSend
                          ? '发送后标记已回复并结案（resolved）'
                          : '仅发往平台，本系统不自动结案'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-slate-900">节假日自动回复</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input type="checkbox" className="sr-only peer" defaultChecked readOnly />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F97316]" />
                  </label>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-20 shrink-0">触发条件:</span>
                    <span className="font-medium text-slate-900">非工作时间 (周六 00:00 - 周日 23:59)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-20 shrink-0">回复模板:</span>
                    <span className="font-medium text-blue-600">周末安抚模板 (多语言)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-20 shrink-0">执行动作:</span>
                    <span className="font-medium text-slate-900">发送回复并标记为&quot;已回复&quot;</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                未配置 VITE_API_BASE_URL 时为演示静态数据；配置后可读写后端自动回复规则。
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

      <AddAutoReplyRuleModal
        isOpen={isAddAutoReplyModalOpen}
        initialRule={editingRule}
        onClose={closeRuleModal}
        onSubmit={apiOn ? handleSaveRule : undefined}
        submitting={savingModal}
      />
    </div>
  );
}
