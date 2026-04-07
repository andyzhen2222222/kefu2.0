import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, Edit2, GitBranch, AlertTriangle, X, Search } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { TicketRoutingRule } from '@/src/types';
import { Link } from 'react-router-dom';
import {
  fetchTicketRoutingRules,
  createTicketRoutingRule,
  patchTicketRoutingRule,
  deleteTicketRoutingRule,
  fetchRoutingRuleOptions,
  type ApiTicketRoutingRuleRow,
  type ApiRoutingRuleOptions,
} from '@/src/services/intellideskApi';
import {
  ROUTING_AFTER_SALES_TYPE_OPTIONS,
  ROUTING_DEMO_CHANNELS,
  routingAfterSalesLabel,
} from '@/src/lib/routingRuleOptions';
import { sortTicketRoutingRulesForDisplay } from '@/src/lib/ticketRoutingRuleOrder';
import {
  filterChannelsByPlatformKeys,
  inferPlatformKeysFromChannelIds,
  mergePlatformTypesWithChannels,
  platformKeyFromChannelType,
  pruneChannelIdsForPlatforms,
} from '@/src/lib/routingPlatformChannel';

const INITIAL_RULES: TicketRoutingRule[] = [
  {
    id: 'rule-1',
    priority: 10,
    platformTypes: ['Amazon'],
    channelIds: [],
    afterSalesTypes: ['logistics'],
    assignToSeatId: 'seat-1',
    enabled: true,
  },
  {
    id: 'rule-2',
    priority: 20,
    platformTypes: ['Amazon'],
    channelIds: ['store_eu_official'],
    afterSalesTypes: [],
    assignToSeatId: 'seat-2',
    enabled: true,
  },
];

function buildDemoRoutingPlatforms(): { value: string; label: string }[] {
  const demoPlatformMap = new Map<string, string>();
  for (const c of ROUTING_DEMO_CHANNELS) {
    const k = platformKeyFromChannelType(c.platformType);
    const pl = c.platformType?.trim() || '未分类';
    if (!demoPlatformMap.has(k)) demoPlatformMap.set(k, pl);
  }
  return [...demoPlatformMap.entries()].map(([value, label]) => ({ value, label }));
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

function routingRuleApiToUi(row: ApiTicketRoutingRuleRow): TicketRoutingRule {
  const c =
    row.conditions && typeof row.conditions === 'object' && !Array.isArray(row.conditions)
      ? (row.conditions as Record<string, unknown>)
      : {};

  const pt = asStringArray(c.platformTypes);
  const ch = asStringArray(c.channelIds);
  const ast = asStringArray(c.afterSalesTypes);
  const createdAt = typeof row.createdAt === 'string' ? row.createdAt : undefined;
  if (pt.length > 0 || ch.length > 0 || ast.length > 0) {
    return {
      id: row.id,
      priority: row.priority,
      createdAt,
      platformTypes: pt,
      channelIds: ch,
      afterSalesTypes: ast,
      assignToSeatId: row.targetSeatId ?? '',
      enabled: row.enabled,
    };
  }

  const legacyPlatform = typeof c.platform === 'string' && c.platform ? [c.platform] : [];
  const legacyStore = typeof c.store === 'string' && c.store ? [c.store] : [];
  const legacyAst = typeof c.afterSalesType === 'string' && c.afterSalesType ? [c.afterSalesType] : [];
  return {
    id: row.id,
    priority: row.priority,
    createdAt,
    platformTypes: legacyPlatform,
    channelIds: legacyStore,
    afterSalesTypes: legacyAst,
    assignToSeatId: row.targetSeatId ?? '',
    enabled: row.enabled,
  };
}

function buildRoutingRuleName(form: TicketRoutingRule): string {
  const parts: string[] = [];
  if (form.platformTypes.length) parts.push(`${form.platformTypes.length}类平台`);
  if (form.channelIds.length) parts.push(`${form.channelIds.length}店`);
  if (form.afterSalesTypes.length) parts.push(`${form.afterSalesTypes.length}类售后`);
  return parts.length ? `路由·${parts.join('·')}` : `工单路由 #${form.priority}`;
}

function conditionsPayload(form: TicketRoutingRule): Record<string, unknown> {
  return {
    platformTypes: form.platformTypes,
    channelIds: form.channelIds,
    afterSalesTypes: form.afterSalesTypes,
  };
}

function summarizeDim(values: string[], labelByValue: Map<string, string>): string {
  if (values.length === 0) return '不限';
  const labels = values.map((v) => labelByValue.get(v) ?? v);
  if (labels.length <= 2) return labels.join('、');
  return `${labels.slice(0, 2).join('、')} 等${values.length}项`;
}

function storeColumnText(
  r: TicketRoutingRule,
  allChannels: { id: string; displayName: string; platformType: string | null }[],
  channelLabelMap: Map<string, string>
): { text: string; title: string } {
  const under = filterChannelsByPlatformKeys(allChannels, r.platformTypes);
  if (r.platformTypes.length > 0 && r.channelIds.length === 0) {
    const n = under.length;
    return {
      text: n > 0 ? `全部店铺（${n} 个渠道）` : '所选平台下暂无渠道',
      title: n > 0 ? under.map((c) => c.displayName).join('、') : '',
    };
  }
  if (r.channelIds.length > 0) {
    return {
      text: summarizeDim(r.channelIds, channelLabelMap),
      title: r.channelIds.map((id) => channelLabelMap.get(id) ?? id).join('、'),
    };
  }
  return { text: '不限', title: '' };
}

function PlatformChannelAccordionPanel({
  platforms,
  channels,
  selectedPlatforms,
  selectedChannels,
  onChange,
}: {
  platforms: { value: string; label: string }[];
  channels: { id: string; displayName: string; platformType: string | null }[];
  selectedPlatforms: string[];
  selectedChannels: string[];
  onChange: (platforms: string[], channels: string[]) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(selectedPlatforms));
  const [q, setQ] = useState('');

  const channelsByPlat = useMemo(() => {
    const map = new Map<string, typeof channels>();
    for (const p of platforms) {
      map.set(p.value, []);
    }
    for (const c of channels) {
      const pKey = platformKeyFromChannelType(c.platformType);
      if (map.has(pKey)) {
        map.get(pKey)!.push(c);
      }
    }
    return map;
  }, [platforms, channels]);

  const isChannelChecked = (platVal: string, chId: string) => {
    if (!selectedPlatforms.includes(platVal)) return false;
    if (selectedChannels.length === 0) return true;
    return selectedChannels.includes(chId);
  };

  const getPlatState = (platVal: string) => {
    if (!selectedPlatforms.includes(platVal)) return 'unchecked';
    const chs = channelsByPlat.get(platVal) || [];
    if (chs.length === 0) return 'checked';
    if (selectedChannels.length === 0) return 'checked';
    
    let checkedCount = 0;
    for (const c of chs) {
      if (selectedChannels.includes(c.id)) checkedCount++;
    }
    if (checkedCount === 0) return 'partial'; 
    if (checkedCount === chs.length) return 'checked';
    return 'partial';
  };

  const togglePlatform = (platVal: string) => {
    const chs = channelsByPlat.get(platVal) || [];
    const chIds = chs.map(c => c.id);
    const platState = getPlatState(platVal);

    let nextPlats = [...selectedPlatforms];
    let nextChannels = [...selectedChannels];

    if (platState === 'unchecked') {
      nextPlats.push(platVal);
      if (nextChannels.length > 0) {
        nextChannels = [...new Set([...nextChannels, ...chIds])];
      }
      setExpanded(prev => new Set(prev).add(platVal));
    } else {
      nextPlats = nextPlats.filter(p => p !== platVal);
      if (nextChannels.length > 0) {
        nextChannels = nextChannels.filter(id => !chIds.includes(id));
      }
    }

    let totalExpectedChs = 0;
    for (const p of nextPlats) {
      totalExpectedChs += (channelsByPlat.get(p) || []).length;
    }
    if (nextChannels.length === totalExpectedChs && totalExpectedChs > 0) {
      nextChannels = [];
    }

    onChange(nextPlats, nextChannels);
  };

  const toggleChannel = (platVal: string, chId: string) => {
    let nextPlats = [...selectedPlatforms];
    let nextChannels = [...selectedChannels];

    const isChecked = isChannelChecked(platVal, chId);

    if (isChecked) {
      if (nextChannels.length === 0) {
        for (const p of nextPlats) {
          const chs = channelsByPlat.get(p) || [];
          for (const c of chs) {
            if (c.id !== chId) nextChannels.push(c.id);
          }
        }
      } else {
        nextChannels = nextChannels.filter(id => id !== chId);
      }
      const platChs = channelsByPlat.get(platVal) || [];
      const hasAny = platChs.some(c => nextChannels.includes(c.id));
      if (!hasAny && platChs.length > 0) {
        nextPlats = nextPlats.filter(p => p !== platVal);
      }
    } else {
      if (!nextPlats.includes(platVal)) {
        nextPlats.push(platVal);
        setExpanded(prev => new Set(prev).add(platVal));
      }
      if (nextChannels.length > 0) {
        nextChannels.push(chId);
      }
    }

    let totalExpectedChs = 0;
    for (const p of nextPlats) {
      totalExpectedChs += (channelsByPlat.get(p) || []).length;
    }
    if (nextChannels.length === totalExpectedChs && totalExpectedChs > 0) {
      nextChannels = [];
    }

    onChange(nextPlats, nextChannels);
  };

  const toggleExpand = (platVal: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(platVal)) next.delete(platVal);
      else next.add(platVal);
      return next;
    });
  };

  const filteredPlatforms = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return platforms;
    return platforms.filter(p => {
      if (p.label.toLowerCase().includes(t) || p.value.toLowerCase().includes(t)) return true;
      const chs = channelsByPlat.get(p.value) || [];
      return chs.some(c => c.displayName.toLowerCase().includes(t));
    });
  }, [platforms, q, channelsByPlat]);

  const clearAll = () => onChange([], []);
  
  const totalChannels = channelsByPlat.size > 0 ? Array.from(channelsByPlat.values()).flat().length : 0;
  const selectedChannelsCount = selectedPlatforms.length === 0 ? 0 : (selectedChannels.length === 0 ? 
    selectedPlatforms.reduce((acc, p) => acc + (channelsByPlat.get(p) || []).length, 0) : 
    selectedChannels.length);

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="text-sm font-bold text-slate-800">平台与店铺选择</span>
          <p className="text-[11px] text-slate-500 mt-0.5">
            选平台时展开选择店铺，默认选中平台下所有店铺。未选表示不限。
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <button type="button" className="text-[#F97316] font-medium hover:underline" onClick={() => {
            onChange(platforms.map(p => p.value), []);
          }}>
            全选
          </button>
          <span className="text-slate-300">|</span>
          <button type="button" className="text-slate-600 font-medium hover:underline" onClick={clearAll}>
            清空
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索平台或店铺…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#F97316]/20"
        />
      </div>

      <div className="max-h-[300px] overflow-y-auto rounded-lg border border-slate-200 bg-white">
        {filteredPlatforms.length === 0 ? (
          <p className="p-4 text-sm text-slate-500 text-center">无匹配的平台或店铺</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredPlatforms.map(p => {
              const chs = channelsByPlat.get(p.value) || [];
              const platState = getPlatState(p.value);
              const isExpanded = expanded.has(p.value);

              const t = q.trim().toLowerCase();
              const visibleChs = t ? chs.filter(c => 
                p.label.toLowerCase().includes(t) || p.value.toLowerCase().includes(t) || c.displayName.toLowerCase().includes(t)
              ) : chs;

              if (t && visibleChs.length === 0 && !p.label.toLowerCase().includes(t)) {
                 return null;
              }

              return (
                <div key={p.value} className="flex flex-col">
                  <div 
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors",
                      isExpanded ? "bg-slate-50/50" : ""
                    )}
                    onClick={() => togglePlatform(p.value)}
                  >
                    <div 
                      className="p-1 -ml-1 text-slate-400 hover:bg-slate-200 rounded transition-colors"
                      onClick={(e) => toggleExpand(p.value, e)}
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                    
                    <div className="relative flex items-center justify-center w-4 h-4 shrink-0">
                      <input
                        type="checkbox"
                        checked={platState === 'checked'}
                        ref={el => { if (el) el.indeterminate = platState === 'partial'; }}
                        readOnly
                        className="w-4 h-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316] pointer-events-none"
                      />
                    </div>
                    
                    <span className="font-medium text-slate-800 text-sm select-none">{p.label}</span>
                    <span className="text-xs text-slate-400 ml-auto select-none">
                      {chs.length} 个店铺
                    </span>
                  </div>

                  {isExpanded && visibleChs.length > 0 && (
                    <div className="flex flex-col border-t border-slate-50 bg-slate-50/30 py-1">
                      {visibleChs.map(c => (
                        <label 
                          key={c.id} 
                          className="flex items-center gap-3 py-1.5 pl-11 pr-4 cursor-pointer hover:bg-slate-100 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChannelChecked(p.value, c.id)}
                            onChange={() => toggleChannel(p.value, c.id)}
                            className="rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
                          />
                          <span className="text-sm text-slate-700 select-none truncate">
                            {c.displayName}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
        <span>
          已选平台: <strong className="text-slate-700">{selectedPlatforms.length}</strong> / {platforms.length}
        </span>
        <span>
          已选店铺: <strong className="text-slate-700">{selectedChannelsCount}</strong> / {totalChannels}
        </span>
      </div>
    </div>
  );
}

function RoutingMultiSelectPanel({
  label,
  hint,
  options,
  selected,
  onChange,
  emptySelectionHint,
}: {
  label: string;
  hint?: string;
  options: { value: string; label: string; description?: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** 未选任何项时展示（默认「未选＝不限」） */
  emptySelectionHint?: string;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(t) ||
        o.value.toLowerCase().includes(t) ||
        (o.description && o.description.toLowerCase().includes(t))
    );
  }, [options, q]);

  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v));
    else onChange([...selected, v]);
  };

  const addAllFiltered = () => {
    const set = new Set(selected);
    filtered.forEach((o) => set.add(o.value));
    onChange([...set]);
  };

  const clear = () => onChange([]);

  const labelMap = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options]);

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="text-xs font-semibold text-slate-700">{label}</span>
          {hint ? <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p> : null}
        </div>
        <div className="flex gap-2 text-[11px]">
          <button type="button" className="text-[#F97316] font-medium hover:underline" onClick={addAllFiltered}>
            全选列表
          </button>
          <span className="text-slate-300">|</span>
          <button type="button" className="text-slate-600 font-medium hover:underline" onClick={clear}>
            清空
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 min-h-[26px]">
        {selected.length === 0 ? (
          <span className="text-[11px] text-slate-500 italic">
            {emptySelectionHint ?? '未选＝不限'}
          </span>
        ) : (
          selected.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2 py-0.5 text-[11px] text-slate-800 max-w-full"
            >
              <span className="truncate">{labelMap.get(v) ?? v}</span>
              <button
                type="button"
                className="text-slate-400 hover:text-red-600 shrink-0"
                onClick={() => onChange(selected.filter((x) => x !== v))}
                aria-label="移除"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="筛选…"
          aria-label={`${label}筛选`}
          className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#F97316]/20"
        />
      </div>

      <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <p className="p-3 text-xs text-slate-500 text-center">无匹配项</p>
        ) : (
          filtered.map((o) => (
            <label
              key={o.value}
              className="flex items-start gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() => toggle(o.value)}
                className="rounded border-slate-300 text-[#F97316] focus:ring-[#F97316] mt-0.5 shrink-0"
              />
              <span className="min-w-0">
                <span className="text-slate-800">{o.label}</span>
                {o.description ? (
                  <span className="block text-[10px] text-slate-400 truncate">{o.description}</span>
                ) : null}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

export interface TicketRoutingRulesBlockProps {
  /** 可用坐席，与「2 · 坐席」列表同步 */
  seatOptions: { id: string; label: string }[];
  /** 无坐席时引导链接，默认 step=2 */
  seatsStepHref?: string;
  /** 配置 API 后从后端读写工单路由规则 */
  routingApi?: { tenantId: string; userId: string | undefined };
}

export default function TicketRoutingRulesBlock({
  seatOptions,
  seatsStepHref = '/settings/seats?step=2',
  routingApi,
}: TicketRoutingRulesBlockProps) {
  const tid = routingApi?.tenantId;
  const uid = routingApi?.userId;

  const [rules, setRules] = useState<TicketRoutingRule[]>([]);
  const [routingErr, setRoutingErr] = useState<string | null>(null);
  const [routingBusy, setRoutingBusy] = useState(false);
  const [optionsBusy, setOptionsBusy] = useState(false);
  const [ruleOptions, setRuleOptions] = useState<ApiRoutingRuleOptions>({
    platforms: buildDemoRoutingPlatforms(),
    channels: ROUTING_DEMO_CHANNELS,
    afterSalesTypes: ROUTING_AFTER_SALES_TYPE_OPTIONS,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TicketRoutingRule | null>(null);
  const [form, setForm] = useState<TicketRoutingRule>({
    id: '',
    priority: 100,
    platformTypes: [],
    channelIds: [],
    afterSalesTypes: [],
    assignToSeatId: '',
    enabled: true,
  });

  const loadRules = useCallback(async () => {
    if (!tid) {
      setRules([...INITIAL_RULES]);
      setRoutingErr(null);
      return;
    }
    setRoutingBusy(true);
    setRoutingErr(null);
    try {
      const rows = await fetchTicketRoutingRules(tid, uid);
      setRules(rows.map(routingRuleApiToUi));
    } catch (e) {
      setRoutingErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRoutingBusy(false);
    }
  }, [tid, uid]);

  const loadOptions = useCallback(async () => {
    if (!tid) {
      setRuleOptions({
        platforms: buildDemoRoutingPlatforms(),
        channels: ROUTING_DEMO_CHANNELS,
        afterSalesTypes: ROUTING_AFTER_SALES_TYPE_OPTIONS,
      });
      return;
    }
    setOptionsBusy(true);
    try {
      const data = await fetchRoutingRuleOptions(tid, uid);
      setRuleOptions({
        platforms: data.platforms.length ? data.platforms : buildDemoRoutingPlatforms(),
        channels: data.channels.length ? data.channels : ROUTING_DEMO_CHANNELS,
        afterSalesTypes: data.afterSalesTypes.length ? data.afterSalesTypes : ROUTING_AFTER_SALES_TYPE_OPTIONS,
      });
    } catch {
      setRuleOptions({
        platforms: buildDemoRoutingPlatforms(),
        channels: ROUTING_DEMO_CHANNELS,
        afterSalesTypes: ROUTING_AFTER_SALES_TYPE_OPTIONS,
      });
    } finally {
      setOptionsBusy(false);
    }
  }, [tid, uid]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const platformLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    ruleOptions.platforms.forEach((p) => m.set(p.value, p.label));
    return m;
  }, [ruleOptions.platforms]);

  const channelLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    ruleOptions.channels.forEach((c) => m.set(c.id, c.displayName));
    return m;
  }, [ruleOptions.channels]);

  const afterSalesLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    ruleOptions.afterSalesTypes.forEach((o) => m.set(o.value, o.label));
    return m;
  }, [ruleOptions.afterSalesTypes]);

  const platformSelectOptions = useMemo(
    () => ruleOptions.platforms.map((p) => ({ value: p.value, label: p.label })),
    [ruleOptions.platforms]
  );

  const afterSalesSelectOptions = useMemo(
    () => ruleOptions.afterSalesTypes.map((o) => ({ value: o.value, label: o.label })),
    [ruleOptions.afterSalesTypes]
  );

  const seatLabel = (id: string) => seatOptions.find((s) => s.id === id)?.label || id;

  const multiSeatChannels = useMemo(() => {
    const channelToSeats = new Map<string, Set<string>>();
    
    rules.filter(r => r.enabled).forEach(r => {
      let affectedChannels: string[] = [];
      if (r.channelIds.length > 0) {
        affectedChannels = r.channelIds;
      } else if (r.platformTypes.length > 0) {
        affectedChannels = ruleOptions.channels
          .filter(c => r.platformTypes.includes(platformKeyFromChannelType(c.platformType)))
          .map(c => c.id);
      } else {
        affectedChannels = ruleOptions.channels.map(c => c.id);
      }
      
      affectedChannels.forEach(chId => {
        if (!channelToSeats.has(chId)) {
          channelToSeats.set(chId, new Set());
        }
        channelToSeats.get(chId)!.add(r.assignToSeatId);
      });
    });

    const multi = new Set<string>();
    for (const [chId, seats] of channelToSeats.entries()) {
      if (seats.size > 1) multi.add(chId);
    }
    return multi;
  }, [rules, ruleOptions.channels]);

  const isRuleMultiSeat = useCallback((r: TicketRoutingRule) => {
    if (!r.enabled) return false;
    let affectedChannels: string[] = [];
    if (r.channelIds.length > 0) {
      affectedChannels = r.channelIds;
    } else if (r.platformTypes.length > 0) {
      affectedChannels = ruleOptions.channels
        .filter(c => r.platformTypes.includes(platformKeyFromChannelType(c.platformType)))
        .map(c => c.id);
    } else {
      affectedChannels = ruleOptions.channels.map(c => c.id);
    }
    return affectedChannels.some(chId => multiSeatChannels.has(chId));
  }, [ruleOptions.channels, multiSeatChannels]);

  const openNew = () => {
    setEditing(null);
    setForm({
      id: '',
      priority: 100, // keep the default for backend compatibility, but hidden
      platformTypes: [],
      channelIds: [],
      afterSalesTypes: [],
      assignToSeatId: seatOptions[0]?.id || '',
      enabled: true,
    });
    setModalOpen(true);
  };

  const openEdit = (r: TicketRoutingRule) => {
    let platformTypes = [...r.platformTypes];
    const channelIds = [...r.channelIds];
    if (platformTypes.length === 0 && channelIds.length > 0 && ruleOptions.channels.length > 0) {
      platformTypes = inferPlatformKeysFromChannelIds(ruleOptions.channels, channelIds);
    }
    setEditing(r);
    setForm({ ...r, platformTypes, channelIds });
    setModalOpen(true);
  };

  const saveRule = async () => {
    if (!form.assignToSeatId) return;
    const platformTypesMerged = mergePlatformTypesWithChannels(
      form.platformTypes,
      form.channelIds,
      ruleOptions.channels
    );
    const formToSave = { ...form, platformTypes: platformTypesMerged };
    const conditions = conditionsPayload(formToSave);

    if (tid) {
      try {
        setRoutingBusy(true);
        setRoutingErr(null);
        const name = buildRoutingRuleName(formToSave);
        if (editing) {
          await patchTicketRoutingRule(tid, uid, editing.id, {
            name,
            priority: formToSave.priority,
            conditions,
            targetSeatId: formToSave.assignToSeatId,
            enabled: formToSave.enabled,
          });
        } else {
          await createTicketRoutingRule(tid, uid, {
            name,
            priority: formToSave.priority,
            conditions,
            targetSeatId: formToSave.assignToSeatId,
            enabled: formToSave.enabled,
          });
        }
        await loadRules();
        setModalOpen(false);
      } catch (e) {
        setRoutingErr(e instanceof Error ? e.message : String(e));
      } finally {
        setRoutingBusy(false);
      }
      return;
    }

    if (editing) {
      setRules((prev) =>
        sortTicketRoutingRulesForDisplay(
          prev.map((x) =>
            x.id === editing.id ? { ...formToSave, id: editing.id, createdAt: x.createdAt } : x
          )
        )
      );
    } else {
      const now = new Date().toISOString();
      setRules((prev) =>
        sortTicketRoutingRulesForDisplay([
          ...prev,
          { ...formToSave, id: `rule-${Date.now()}`, createdAt: now },
        ])
      );
    }
    setModalOpen(false);
  };

  const deleteRule = async (id: string) => {
    if (!window.confirm('删除该规则？')) return;
    if (tid) {
      try {
        setRoutingBusy(true);
        setRoutingErr(null);
        await deleteTicketRoutingRule(tid, uid, id);
        await loadRules();
      } catch (e) {
        setRoutingErr(e instanceof Error ? e.message : String(e));
      } finally {
        setRoutingBusy(false);
      }
      return;
    }
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const sorted = sortTicketRoutingRulesForDisplay(rules);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">分配规则</h2>
        <p className="text-sm text-slate-500 mt-1">
          有配置的店铺将按照规则分配给对应坐席，未配置的工单默认分配给管理员。同一家店铺允许分配给多个坐席（表格中会标注“多坐席”）。
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-950">
        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
        <div>
          <p className="font-bold text-amber-900">提示</p>
          <p className="mt-1 text-amber-900/90 leading-relaxed">
            「指派坐席」须先在
            <Link to={seatsStepHref} className="font-semibold text-[#F97316] hover:underline mx-1">
              2 · 坐席
            </Link>
            创建并启用；坐席账号邮箱需与租户内用户邮箱一致方可看到专属工单。
          </p>
        </div>
      </div>

      {routingErr && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {routingErr}
        </div>
      )}

      {tid && (routingBusy || optionsBusy) && !modalOpen ? (
        <p className="text-sm text-slate-500">同步中…</p>
      ) : null}

      {seatOptions.length === 0 && (
        <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-sm text-slate-700">
          无可用坐席，请先在「2 · 坐席」添加并启用。
        </div>
      )}

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-[#F97316]" />
            <h3 className="text-lg font-bold text-slate-900">规则</h3>
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
          <table className="w-full text-sm text-left min-w-[880px]">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-semibold">平台类型</th>
                <th className="px-4 py-3 font-semibold">店铺</th>
                <th className="px-4 py-3 font-semibold">售后类型</th>
                <th className="px-4 py-3 font-semibold">指派坐席</th>
                <th className="px-4 py-3 font-semibold">启用</th>
                <th className="px-4 py-3 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 text-slate-700 max-w-[200px]">
                    <span className="line-clamp-2" title={summarizeDim(r.platformTypes, platformLabelMap)}>
                      {summarizeDim(r.platformTypes, platformLabelMap)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-[220px]">
                    {(() => {
                      const { text, title } = storeColumnText(r, ruleOptions.channels, channelLabelMap);
                      const isMulti = isRuleMultiSeat(r);
                      return (
                        <div className="flex flex-col items-start gap-1">
                          <span className="line-clamp-2" title={title || text}>
                            {text}
                          </span>
                          {isMulti && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800" title="该店铺同时被分配给其他坐席">
                              多坐席共享
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-[200px]">
                    <span
                      className="line-clamp-2"
                      title={r.afterSalesTypes.map((v) => afterSalesLabelMap.get(v) ?? routingAfterSalesLabel(v)).join('、')}
                    >
                      {r.afterSalesTypes.length === 0
                        ? '不限'
                        : summarizeDim(
                            r.afterSalesTypes,
                            new Map(
                              r.afterSalesTypes.map((v) => [v, afterSalesLabelMap.get(v) ?? routingAfterSalesLabel(v)])
                            )
                          )}
                    </span>
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
                      onClick={() => void deleteRule(r.id)}
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">{editing ? '编辑规则' : '新建规则'}</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400"
                title="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <PlatformChannelAccordionPanel
                platforms={platformSelectOptions}
                channels={ruleOptions.channels}
                selectedPlatforms={form.platformTypes}
                selectedChannels={form.channelIds}
                onChange={(platformTypes, channelIds) => setForm(f => ({ ...f, platformTypes, channelIds }))}
              />

              <RoutingMultiSelectPanel
                label="售后类型"
                hint="与字段管理「售后类型」一致；未选＝不限。"
                options={afterSalesSelectOptions}
                selected={form.afterSalesTypes}
                onChange={(afterSalesTypes) => setForm((f) => ({ ...f, afterSalesTypes }))}
              />

              <div className="space-y-1.5">
                <label htmlFor="routing-assign-seat" className="text-xs font-medium text-slate-500">
                  指派坐席
                </label>
                <select
                  id="routing-assign-seat"
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
                <p className="text-[10px] text-slate-400">与坐席列表同步。</p>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
                  className="rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
                />
                启用
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
                onClick={() => void saveRule()}
                disabled={!form.assignToSeatId || seatOptions.length === 0 || routingBusy}
                className="px-5 py-2 text-sm font-bold text-white bg-[#F97316] rounded-xl hover:bg-orange-600 disabled:opacity-50"
              >
                {routingBusy ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
