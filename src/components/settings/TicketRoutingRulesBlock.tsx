import { useState } from 'react';
import { Plus, Trash2, Edit2, GitBranch, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { TicketRoutingRule } from '@/src/types';
import { Link } from 'react-router-dom';

const PLATFORM_OPTS = [
  { value: '', label: '全部平台' },
  { value: 'Amazon US', label: 'Amazon US' },
  { value: 'Amazon UK', label: 'Amazon UK' },
  { value: 'Amazon DE', label: 'Amazon DE' },
  { value: 'eBay', label: 'eBay' },
  { value: 'Shopify', label: 'Shopify' },
];

const STORE_OPTS = [
  { value: '', label: '全部店铺' },
  { value: 'store_us_official', label: 'US Official Store' },
  { value: 'store_eu_official', label: 'EU Official Store' },
  { value: 'store_de_main', label: 'DE 主店' },
];

const AFTER_SALES_TYPE_OPTS = [
  { value: '', label: '全部售后类型' },
  { value: 'logistics', label: '物流问题' },
  { value: 'quality', label: '质量问题' },
  { value: 'wrong_item', label: '发错货' },
  { value: 'missing_part', label: '少发漏发' },
  { value: 'not_received', label: '未收到货' },
  { value: 'customer_reason', label: '客户原因' },
];

const INITIAL_RULES: TicketRoutingRule[] = [
  {
    id: 'rule-1',
    priority: 10,
    platform: 'Amazon US',
    store: '',
    afterSalesType: 'logistics',
    assignToSeatId: 'seat-1',
    enabled: true,
  },
  {
    id: 'rule-2',
    priority: 20,
    platform: 'Amazon UK',
    store: 'store_eu_official',
    afterSalesType: '',
    assignToSeatId: 'seat-2',
    enabled: true,
  },
];

function labelFrom(opts: { value: string; label: string }[], value: string): string {
  return opts.find((o) => o.value === value)?.label || (value || '—');
}

export interface TicketRoutingRulesBlockProps {
  /** 当前可用坐席，与上一步「客服坐席」列表同步 */
  seatOptions: { id: string; label: string }[];
  /** 「先到坐席维护」提示中的链接，默认本页第二步 */
  seatsStepHref?: string;
}

export default function TicketRoutingRulesBlock({
  seatOptions,
  seatsStepHref = '/settings/seats?step=2',
}: TicketRoutingRulesBlockProps) {
  const [rules, setRules] = useState<TicketRoutingRule[]>(INITIAL_RULES);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TicketRoutingRule | null>(null);
  const [form, setForm] = useState<TicketRoutingRule>({
    id: '',
    priority: 100,
    platform: '',
    store: '',
    afterSalesType: '',
    assignToSeatId: '',
    enabled: true,
  });

  const seatLabel = (id: string) => seatOptions.find((s) => s.id === id)?.label || id;

  const openNew = () => {
    setEditing(null);
    const nextPriority = Math.max(0, ...rules.map((r) => r.priority), 0) + 10;
    setForm({
      id: '',
      priority: nextPriority,
      platform: '',
      store: '',
      afterSalesType: '',
      assignToSeatId: seatOptions[0]?.id || '',
      enabled: true,
    });
    setModalOpen(true);
  };

  const openEdit = (r: TicketRoutingRule) => {
    setEditing(r);
    setForm({ ...r });
    setModalOpen(true);
  };

  const saveRule = () => {
    if (!form.assignToSeatId) return;
    if (editing) {
      setRules((prev) =>
        prev
          .map((x) => (x.id === editing.id ? { ...form, id: editing.id } : x))
          .sort((a, b) => a.priority - b.priority)
      );
    } else {
      setRules((prev) =>
        [...prev, { ...form, id: `rule-${Date.now()}` }].sort((a, b) => a.priority - b.priority)
      );
    }
    setModalOpen(false);
  };

  const deleteRule = (id: string) => {
    if (!window.confirm('删除该规则？')) return;
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">工单分配规则</h2>
        <p className="text-sm text-slate-500 mt-1">
          <span className="font-medium text-slate-700">数字越小越优先</span>
          ，依次匹配平台、店铺、售后类型（与字段管理里「售后类型」一致）。命中则派给对应坐席；若
          <span className="font-medium text-slate-700">未命中或目标坐席不可用</span>
          ，由<span className="font-medium text-slate-700">系统兜底分配给租户管理员</span>
          ，每条工单必有负责人。
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-950">
        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
        <div>
          <p className="font-bold text-amber-900">配置前提</p>
          <p className="mt-1 text-amber-900/90 leading-relaxed">
            建议至少配置一条规则，便于按平台/店铺/类型自动分流；即使暂不配置，新工单也会由系统分配给管理员，不会无主。规则中的「分配给坐席」需先在
            <Link to={seatsStepHref} className="font-semibold text-[#F97316] hover:underline mx-1">
              第二步 · 客服坐席
            </Link>
            中创建。
          </p>
        </div>
      </div>

      {seatOptions.length === 0 && (
        <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-sm text-slate-700">
          暂无可用坐席，请先在第二步添加并启用坐席后再配置分配规则。
        </div>
      )}

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-[#F97316]" />
            <h3 className="text-lg font-bold text-slate-900">规则列表</h3>
          </div>
          <button
            type="button"
            onClick={openNew}
            disabled={seatOptions.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#F97316] text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            <Plus className="w-4 h-4" />
            新建规则
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[800px]">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-semibold">优先级</th>
                <th className="px-4 py-3 font-semibold">平台</th>
                <th className="px-4 py-3 font-semibold">店铺</th>
                <th className="px-4 py-3 font-semibold">售后类型</th>
                <th className="px-4 py-3 font-semibold">分配给坐席</th>
                <th className="px-4 py-3 font-semibold">启用</th>
                <th className="px-4 py-3 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono text-slate-800">{r.priority}</td>
                  <td className="px-4 py-3 text-slate-700">{labelFrom(PLATFORM_OPTS, r.platform)}</td>
                  <td className="px-4 py-3 text-slate-700">{labelFrom(STORE_OPTS, r.store)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {labelFrom(AFTER_SALES_TYPE_OPTS, r.afterSalesType)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{seatLabel(r.assignToSeatId)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'text-xs font-bold px-2 py-1 rounded-full',
                        r.enabled ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {r.enabled ? '是' : '否'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="p-2 text-slate-500 hover:text-[#F97316] rounded-lg inline-flex"
                      title="编辑"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRule(r.id)}
                      className="p-2 text-slate-500 hover:text-red-600 rounded-lg inline-flex"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">{editing ? '编辑规则' : '新建规则'}</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">优先级（越小越先匹配）</label>
                <input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm((p) => ({ ...p, priority: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">平台</label>
                <select
                  value={form.platform}
                  onChange={(e) => setForm((p) => ({ ...p, platform: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none"
                >
                  {PLATFORM_OPTS.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">店铺</label>
                <select
                  value={form.store}
                  onChange={(e) => setForm((p) => ({ ...p, store: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none"
                >
                  {STORE_OPTS.map((o) => (
                    <option key={o.value || 'all-store'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">售后类型</label>
                <select
                  value={form.afterSalesType}
                  onChange={(e) => setForm((p) => ({ ...p, afterSalesType: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none"
                >
                  {AFTER_SALES_TYPE_OPTS.map((o) => (
                    <option key={o.value || 'all-type'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">分配给坐席</label>
                <select
                  value={form.assignToSeatId}
                  onChange={(e) => setForm((p) => ({ ...p, assignToSeatId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none"
                >
                  {seatOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">
                  下拉选项与当前页的「客服坐席」列表同步；接入后端后与坐席接口一致。
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
                  className="rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
                />
                启用该规则
              </label>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-200"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveRule}
                disabled={!form.assignToSeatId || seatOptions.length === 0}
                className="px-5 py-2 text-sm font-bold text-white bg-[#F97316] rounded-xl hover:bg-orange-600 disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
