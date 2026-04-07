import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Database,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Save,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/hooks/useAuth';
import {
  intellideskConfigured,
  intellideskTenantId,
  intellideskUserIdForApi,
  fetchMotherSyncBundle,
  patchMotherSyncSettings,
  patchChannelMotherSync,
  type ApiMotherSyncBundle,
  type ApiChannelSyncRow,
  type BackfillMode,
} from '@/src/services/intellideskApi';

const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:4001';

const BACKFILL_OPTIONS: { value: BackfillMode; label: string }[] = [
  { value: 'full', label: '全量（受单次窗口上限限制）' },
  { value: 'recent_days', label: '最近 N 天' },
  { value: 'from_date', label: '从指定日期起' },
];

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MotherSystemSyncPage() {
  const { user } = useAuth();
  const tenantId = intellideskTenantId();
  const userId = intellideskUserIdForApi(user?.id);

  const [bundle, setBundle] = useState<ApiMotherSyncBundle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState('');
  const [clearExisting, setClearExisting] = useState(false);
  const [manualSkipMock, setManualSkipMock] = useState(true);
  const [manualDays, setManualDays] = useState(90);
  const [syncing, setSyncing] = useState(false);
  const [invoiceSyncing, setInvoiceSyncing] = useState(false);
  const [result, setResult] = useState<{
    channels?: number;
    invoiceEntities?: number;
    orders?: number;
    convs?: number;
    mockTickets?: number;
    error?: string;
    invoiceOnly?: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const b = await fetchMotherSyncBundle(tenantId, userId);
      setBundle(b);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : '加载失败');
      setBundle(null);
    }
  }, [tenantId, userId]);

  useEffect(() => {
    if (!intellideskConfigured()) {
      setLoadError('当前为演示模式或未配置 VITE_API_BASE_URL，无法加载同步设置。');
      return;
    }
    void load();
  }, [load]);

  const apiHeaders = () => ({
    'Content-Type': 'application/json',
    'X-Tenant-Id': tenantId,
    ...(userId ? { 'X-User-Id': userId } : {}),
  } as Record<string, string>);

  const handleSaveSettings = async () => {
    if (!bundle) return;
    const s = bundle.settings;
    setSaving(true);
    setLoadError(null);
    try {
      const lines = s.messageSyncDisabledPlatformTypes.map((x) => x.trim()).filter(Boolean);
      const updated = await patchMotherSyncSettings(tenantId, userId, {
        syncEnabled: s.syncEnabled,
        messagePollIntervalSec: s.messagePollIntervalSec,
        orderPollIntervalSec: s.orderPollIntervalSec,
        incrementalSyncDays: s.incrementalSyncDays,
        useSyncWatermark: s.useSyncWatermark,
        messageSyncDisabledPlatformTypes: lines,
        defaultNewShopOrderBackfillMode: s.defaultNewShopOrderBackfillMode as BackfillMode,
        defaultNewShopOrderBackfillFrom: s.defaultNewShopOrderBackfillFrom,
        defaultNewShopOrderBackfillRecentDays: s.defaultNewShopOrderBackfillRecentDays,
        defaultNewShopTicketBackfillMode: s.defaultNewShopOrderBackfillMode as BackfillMode,
        defaultNewShopTicketBackfillFrom: s.defaultNewShopOrderBackfillFrom,
        defaultNewShopTicketBackfillRecentDays: s.defaultNewShopOrderBackfillRecentDays,
        skipMockTickets: s.skipMockTickets,
      });
      setBundle(updated);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const patchChannelLocal = (id: string, partial: Partial<ApiChannelSyncRow>) => {
    setBundle((prev) =>
      prev
        ? {
            ...prev,
            channels: prev.channels.map((c) => (c.id === id ? { ...c, ...partial } : c)),
          }
        : prev
    );
  };

  const handleChannelToggle = async (
    ch: ApiChannelSyncRow,
    field: 'syncMessagesEnabled' | 'syncOrdersEnabled',
    value: boolean
  ) => {
    patchChannelLocal(ch.id, { [field]: value });
    try {
      const row = await patchChannelMotherSync(tenantId, userId, ch.id, { [field]: value });
      patchChannelLocal(ch.id, row);
    } catch (e: unknown) {
      patchChannelLocal(ch.id, { [field]: ch[field] });
      setLoadError(e instanceof Error ? e.message : '更新店铺失败');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch(`${apiBase}/api/sync/mother-system`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          ...(token.trim() ? { token: token.trim() } : {}),
          days: manualDays,
          incremental: false,
          clearExisting,
          skipMockTickets: manualSkipMock,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Sync failed');
      setResult({
        channels: data.channelsSynced,
        invoiceEntities: data.invoiceEntitiesSynced,
        orders: data.ordersSynced,
        convs: data.convsSynced,
        mockTickets: data.mockTicketsGenerated,
      });
      await load();
    } catch (e: unknown) {
      setResult({ error: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setSyncing(false);
    }
  };

  const handleInvoiceOnlySync = async () => {
    setInvoiceSyncing(true);
    setResult(null);
    try {
      const res = await fetch(`${apiBase}/api/sync/invoice-entities`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify(token.trim() ? { token: token.trim() } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Sync failed');
      setResult({
        invoiceOnly: true,
        invoiceEntities: data.invoiceEntitiesSynced,
      });
      await load();
    } catch (e: unknown) {
      setResult({ error: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setInvoiceSyncing(false);
    }
  };

  const s = bundle?.settings;

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回工作台
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <Database className="w-6 h-6 text-[#F97316]" />
          管理后台 · 数据同步
        </h1>
        <p className="text-slate-500 mt-2 text-sm">
          不在「系统设置」菜单中展示，仅通过本页地址访问。后端定时任务需配置环境变量中的接口 Token。
        </p>
      </div>

      {loadError && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm flex gap-2 items-start">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{loadError}</span>
        </div>
      )}

      {s && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-800">同步策略</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <RefreshCw className="w-4 h-4" />
                重新加载
              </button>
              <button
                type="button"
                onClick={() => void handleSaveSettings()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#F97316] text-white rounded-lg hover:bg-[#ea580c] disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                保存设置
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={s.syncEnabled}
              onChange={(e) =>
                setBundle((prev) =>
                  prev ? { ...prev, settings: { ...prev.settings, syncEnabled: e.target.checked } } : prev
                )
              }
              className="w-4 h-4 text-[#F97316] border-slate-300 rounded"
            />
            <span className="text-sm font-medium text-slate-700">启用后台定时同步</span>
          </label>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">消息 / 会话轮询间隔（秒）</label>
              <input
                type="number"
                min={30}
                max={86400}
                value={s.messagePollIntervalSec}
                onChange={(e) =>
                  setBundle((prev) =>
                    prev
                      ? {
                          ...prev,
                          settings: {
                            ...prev.settings,
                            messagePollIntervalSec: parseInt(e.target.value, 10) || 300,
                          },
                        }
                      : prev
                  )
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">订单轮询间隔（秒）</label>
              <input
                type="number"
                min={60}
                max={86400}
                value={s.orderPollIntervalSec}
                onChange={(e) =>
                  setBundle((prev) =>
                    prev
                      ? {
                          ...prev,
                          settings: {
                            ...prev.settings,
                            orderPollIntervalSec: parseInt(e.target.value, 10) || 900,
                          },
                        }
                      : prev
                  )
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">增量回溯上限（天，≤90）</label>
              <input
                type="number"
                min={1}
                max={90}
                value={s.incrementalSyncDays}
                onChange={(e) =>
                  setBundle((prev) =>
                    prev
                      ? {
                          ...prev,
                          settings: {
                            ...prev.settings,
                            incrementalSyncDays: parseInt(e.target.value, 10) || 14,
                          },
                        }
                      : prev
                  )
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none pt-7">
              <input
                type="checkbox"
                checked={s.useSyncWatermark}
                onChange={(e) =>
                  setBundle((prev) =>
                    prev
                      ? { ...prev, settings: { ...prev.settings, useSyncWatermark: e.target.checked } }
                      : prev
                  )
                }
                className="w-4 h-4 text-[#F97316] border-slate-300 rounded"
              />
              <span className="text-sm text-slate-700">使用水位线减少重复拉取</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              默认关闭消息同步的平台类型（每行一个 platformType；填 <code className="text-xs">__unset__</code> 表示未分类店铺）
            </label>
            <textarea
              aria-label="默认关闭消息同步的平台类型"
              value={s.messageSyncDisabledPlatformTypes.join('\n')}
              onChange={(e) =>
                setBundle((prev) =>
                  prev
                    ? {
                        ...prev,
                        settings: {
                          ...prev.settings,
                          messageSyncDisabledPlatformTypes: e.target.value.split('\n').map((x) => x.trim()),
                        },
                      }
                    : prev
                )
              }
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
              placeholder={'每行一个，例如：SHOPIFY'}
            />
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-sm font-semibold text-slate-800">新接入店铺 · 默认历史范围（订单与工单相同）</p>
            <div className="space-y-3 rounded-xl border border-slate-100 p-4 bg-slate-50/80 max-w-lg">
              <select
                  aria-label="新店铺历史范围模式"
                  value={s.defaultNewShopOrderBackfillMode}
                  onChange={(e) =>
                    setBundle((prev) =>
                      prev
                        ? {
                            ...prev,
                            settings: {
                              ...prev.settings,
                              defaultNewShopOrderBackfillMode: e.target.value,
                            },
                          }
                        : prev
                    )
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  {BACKFILL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {s.defaultNewShopOrderBackfillMode === 'recent_days' && (
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={s.defaultNewShopOrderBackfillRecentDays}
                    onChange={(e) =>
                      setBundle((prev) =>
                        prev
                          ? {
                              ...prev,
                              settings: {
                                ...prev.settings,
                                defaultNewShopOrderBackfillRecentDays: parseInt(e.target.value, 10) || 90,
                              },
                            }
                          : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                )}
                {s.defaultNewShopOrderBackfillMode === 'from_date' && (
                  <input
                    type="datetime-local"
                    value={toDatetimeLocalValue(s.defaultNewShopOrderBackfillFrom)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBundle((prev) =>
                        prev
                          ? {
                              ...prev,
                              settings: {
                                ...prev.settings,
                                defaultNewShopOrderBackfillFrom: v ? new Date(v).toISOString() : null,
                              },
                            }
                          : prev
                      );
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                )}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={s.skipMockTickets}
                onChange={(e) =>
                  setBundle((prev) =>
                    prev ? { ...prev, settings: { ...prev.settings, skipMockTickets: e.target.checked } } : prev
                  )
                }
                className="w-4 h-4 text-[#F97316] border-slate-300 rounded"
              />
              <span className="text-sm text-slate-700">无真实会话时不生成演示工单</span>
            </label>
          </div>
        </div>
      )}

      {bundle && bundle.channels.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800">店铺同步开关</h2>
            <p className="text-xs text-slate-500 mt-1">关闭后该店数据不再写入本系统。</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="px-6 py-3 font-medium">店铺</th>
                  <th className="px-4 py-3 font-medium">平台类型</th>
                  <th className="px-4 py-3 font-medium">同步消息</th>
                  <th className="px-4 py-3 font-medium">同步订单</th>
                </tr>
              </thead>
              <tbody>
                {bundle.channels.map((ch) => (
                  <tr key={ch.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                    <td className="px-6 py-3">
                      <div className="font-medium text-slate-800">{ch.displayName}</div>
                      <div className="text-xs text-slate-400 font-mono">{ch.externalShopId ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{ch.platformType ?? '—'}</td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-[#F97316] rounded"
                        checked={ch.syncMessagesEnabled}
                        onChange={(e) => void handleChannelToggle(ch, 'syncMessagesEnabled', e.target.checked)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-[#F97316] rounded"
                        checked={ch.syncOrdersEnabled}
                        onChange={(e) => void handleChannelToggle(ch, 'syncOrdersEnabled', e.target.checked)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">手动拉取</h2>
        <p className="text-sm text-slate-500">接口 Token 可留空则用服务端环境变量。按最近 N 天整窗拉取（不使用水位线）。</p>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">接口 Token（可选）</label>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm"
            placeholder="留空则使用服务端环境变量"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">全量窗口（天）</label>
          <input
            type="number"
            min={1}
            max={90}
            value={manualDays}
            onChange={(e) => setManualDays(parseInt(e.target.value, 10) || 90)}
            className="w-full max-w-xs px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={clearExisting}
              onChange={(e) => setClearExisting(e.target.checked)}
              className="w-4 h-4 text-[#F97316] rounded"
            />
            <span className="text-sm text-slate-700">同步前清空本地业务数据（危险）</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={manualSkipMock}
              onChange={(e) => setManualSkipMock(e.target.checked)}
              className="w-4 h-4 text-[#F97316] rounded"
            />
            <span className="text-sm text-slate-700">无真实会话时不生成演示工单</span>
          </label>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing || invoiceSyncing}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#F97316] text-white rounded-xl font-bold hover:bg-[#ea580c] disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            立即全量同步
          </button>
          <button
            type="button"
            onClick={() => void handleInvoiceOnlySync()}
            disabled={syncing || invoiceSyncing}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-900 disabled:opacity-50"
          >
            {invoiceSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
            仅同步发票主体与 VAT
          </button>
        </div>
        <p className="text-xs text-slate-400">API：{apiBase}</p>

        {result && (
          <div
            className={cn(
              'p-4 rounded-xl border flex items-start gap-3',
              result.error ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
            )}
          >
            {result.error ? (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
            )}
            <div>
              <h4 className={cn('font-bold text-sm', result.error ? 'text-red-900' : 'text-green-900')}>
                {result.error ? '操作失败' : '操作成功'}
              </h4>
              <p className={cn('text-sm mt-1', result.error ? 'text-red-700' : 'text-green-700')}>
                {result.error
                  ? result.error
                  : result.invoiceOnly
                    ? `已更新 ${result.invoiceEntities ?? 0} 个渠道的发票主体/VAT。`
                    : `店铺 ${result.channels ?? 0}；订单 ${result.orders ?? 0}；会话工单 ${result.convs ?? 0}；演示工单 ${result.mockTickets ?? 0}。`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
