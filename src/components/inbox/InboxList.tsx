import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Inbox,
  ArrowUpDown,
  RefreshCw,
  Loader2,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Ticket, TicketStatus, Order, Customer, Sentiment } from '@/src/types';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { InboxTicketStatusIcons } from '@/src/lib/ticketStatusUi';
import { getTicketSubjectForDisplay } from '@/src/components/settings/TranslationSettingsPage';
import { platformGroupLabelForTicket } from '@/src/lib/platformLabels';
import { InboxListPlatformMark } from '@/src/components/inbox/InboxListPlatformMark';
import { useAuth } from '@/src/hooks/useAuth';
import {
  intellideskConfigured,
  intellideskTenantId,
  intellideskUserIdForApi,
  postInboxTicketsSync,
} from '@/src/services/intellideskApi';

const MOTHER_TOKEN_STORAGE_KEY = 'intellidesk_mother_token';

const SENTIMENT_LABEL: Record<string, string> = {
  [Sentiment.ANGRY]: '愤怒抱怨',
  [Sentiment.ANXIOUS]: '焦急催促',
  [Sentiment.NEUTRAL]: '平静中性',
  [Sentiment.JOYFUL]: '开心满意',
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  unshipped: '未发货',
  shipped: '已发货',
  refunded: '已退款',
  partial_refund: '部分退款',
};

const INBOX_PREVIEW_MAX = 30;
/** 左侧工单列表按店铺分页（模拟异步分页加载） */
const INBOX_SHOP_PAGE_SIZE = 8;
/** 下拉框「全部」用空字符串，表示不按平台/店铺收窄 */
const ALL_PLATFORMS = '';
const ALL_SHOPS = '';

function uniquePlatformKeysFromTickets(tickets: Ticket[]): string[] {
  const s = new Set<string>();
  tickets.forEach((t) => {
    s.add(platformGroupLabelForTicket(t.platformType, t.channelId));
  });
  return [...s].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

/** 列表第二行：优先展示最近一条买家消息摘要，否则回退主题 */
function inboxListPreviewLine(ticket: Ticket): string {
  const raw = ticket.lastInboundPreview?.trim();
  if (raw) {
    const oneLine = raw.replace(/\s+/g, ' ');
    return oneLine.length > INBOX_PREVIEW_MAX
      ? `${oneLine.slice(0, INBOX_PREVIEW_MAX)}…`
      : oneLine;
  }
  return getTicketSubjectForDisplay(ticket);
}

function inboxListPreviewTitle(ticket: Ticket): string {
  const raw = ticket.lastInboundPreview?.trim();
  if (raw) return raw.replace(/\s+/g, ' ');
  return getTicketSubjectForDisplay(ticket);
}

type ConversationStatusFilter = '' | 'unread' | 'unreplied' | 'replied';
type SlaFilter = '' | 'overdue';

interface InboxListProps {
  tickets: Ticket[];
  orders?: Record<string, Order>;
  customers?: Record<string, Customer>;
  selectedTicketId?: string;
  /** 例如 ?filter=unread，与仪表盘入口一致 */
  mailboxSearchSuffix?: string;
  /** 母系统收件箱同步完成后刷新列表（由 MailboxPage 触发重新拉取） */
  onInboxSynced?: () => void;
  /** 悬停列表行时预取工单详情（减轻点击后首包等待） */
  onTicketHover?: (ticketId: string) => void;
  /** 联调：由父组件传入搜索框内容（与 GET /api/tickets?search= 同步） */
  listSearchQuery?: string;
  onListSearchQueryChange?: (q: string) => void;
  /** 为 true 时不在本地再按搜索词过滤（列表已由后端按 search 筛过） */
  listSearchServerBacked?: boolean;
  /** 联调：正在重新拉取工单列表（与右侧刷新按钮联动） */
  listReloading?: boolean;
  /** 联调：点击后触发父组件重新请求工单列表 */
  onReloadList?: () => void;
}

export default function InboxList({
  tickets,
  orders = {},
  customers = {},
  selectedTicketId,
  mailboxSearchSuffix = '',
  onInboxSynced,
  onTicketHover,
  listSearchQuery: listSearchQueryProp,
  onListSearchQueryChange,
  listSearchServerBacked = false,
  listReloading = false,
  onReloadList,
}: InboxListProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const searchControlled = typeof onListSearchQueryChange === 'function';
  const searchQuery = searchControlled ? (listSearchQueryProp ?? '') : localSearchQuery;
  const setSearchQuery = searchControlled ? onListSearchQueryChange! : setLocalSearchQuery;
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'time_desc' | 'time_asc' | 'priority'>('time_desc');
  const [filterChannel, setFilterChannel] = useState('');
  const [filterIntent, setFilterIntent] = useState('');
  const [filterSentiment, setFilterSentiment] = useState('');
  const [filterOrderStatus, setFilterOrderStatus] = useState('');
  const [filterConversationStatus, setFilterConversationStatus] = useState<ConversationStatusFilter>('');
  const [filterSla, setFilterSla] = useState<SlaFilter>('');
  const [inboxSyncing, setInboxSyncing] = useState(false);
  const [inboxSyncHint, setInboxSyncHint] = useState<string | null>(null);

  const [selectedPlatform, setSelectedPlatform] = useState<string>(ALL_PLATFORMS);
  const [selectedShop, setSelectedShop] = useState<string>(ALL_SHOPS);
  const [shopTicketsPage, setShopTicketsPage] = useState(0);
  const [shopListLoading, setShopListLoading] = useState(false);

  const allPlatformKeys = useMemo(() => uniquePlatformKeysFromTickets(tickets), [tickets]);

  const platformVisibleCounts = useMemo(() => {
    const m: Record<string, number> = {};
    tickets.forEach((t) => {
      const p = platformGroupLabelForTicket(t.platformType, t.channelId);
      m[p] = (m[p] ?? 0) + 1;
    });
    return m;
  }, [tickets]);

  const channelOptions = useMemo(() => {
    const s = new Set<string>();
    tickets.forEach((t) => {
      if (t.channelId?.trim()) s.add(t.channelId);
    });
    return [...s].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [tickets]);

  /** 列表中的意图标签，产品侧称「售后类型」 */
  const afterSalesTypeOptions = useMemo(() => {
    const s = new Set<string>();
    tickets.forEach((t) => {
      const v = t.intent?.trim();
      if (v) s.add(v);
    });
    return [...s].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [tickets]);

  const sentimentOptions = useMemo(() => {
    const s = new Set<string>();
    tickets.forEach((t) => {
      if (t.sentiment) s.add(t.sentiment);
    });
    return [...s].sort();
  }, [tickets]);

  const orderStatusOptions = useMemo(() => {
    const s = new Set<string>();
    tickets.forEach((t) => {
      if (!t.orderId) return;
      const st = orders[t.orderId]?.orderStatus;
      if (st) s.add(st);
    });
    return [...s].sort();
  }, [tickets, orders]);

  // 1. Stable Sort Logic: Only re-sort on major changes to prevent items "jumping" while interacting
  const [displayTickets, setDisplayTickets] = useState<Ticket[]>([]);
  
  // Track major dependencies that should trigger a full re-sort/re-filter
  // We don't include 'tickets' directly because we want to handle internal updates separately
  const majorDepsKey = JSON.stringify({
    count: tickets.length,
    sortBy,
    searchQuery,
    listSearchServerBacked,
    filterChannel,
    filterIntent,
    filterSentiment,
    filterOrderStatus,
    filterConversationStatus,
    filterSla,
  });

  useEffect(() => {
    // Perform full filtering and sorting
    let result = [...tickets];

    if (searchQuery.trim() && !listSearchServerBacked) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((t) => {
        const shown = getTicketSubjectForDisplay(t);
        const buyerName = customers[t.customerId]?.name ?? '';
        const platformOrderId = t.orderId ? orders[t.orderId]?.platformOrderId : '';

        const preview = (t.lastInboundPreview ?? '').toLowerCase();
        return (
          shown.toLowerCase().includes(query) ||
          preview.includes(query) ||
          t.subject.toLowerCase().includes(query) ||
          (t.subjectOriginal?.toLowerCase().includes(query) ?? false) ||
          t.channelId.toLowerCase().includes(query) ||
          (t.orderId?.toLowerCase().includes(query) ?? false) ||
          platformOrderId?.toLowerCase().includes(query) ||
          buyerName.toLowerCase().includes(query)
        );
      });
    }

    if (filterChannel) result = result.filter((t) => t.channelId === filterChannel);
    if (filterIntent) result = result.filter((t) => (t.intent?.trim() || '') === filterIntent);
    if (filterSentiment) result = result.filter((t) => t.sentiment === filterSentiment);
    if (filterOrderStatus) {
      result = result.filter((t) => orders[t.orderId ?? '']?.orderStatus === filterOrderStatus);
    }
    if (filterConversationStatus === 'unread') {
      result = result.filter((t) => t.messageProcessingStatus === 'unread');
    } else if (filterConversationStatus === 'unreplied') {
      result = result.filter((t) => t.messageProcessingStatus === 'unreplied');
    } else if (filterConversationStatus === 'replied') {
      result = result.filter((t) => t.messageProcessingStatus === 'replied');
    }
    if (filterSla === 'overdue') {
      result = result.filter(
        (t) =>
          t.status !== TicketStatus.RESOLVED &&
          t.status !== TicketStatus.SPAM &&
          new Date(t.slaDueAt).getTime() < Date.now()
      );
    }

    // Sort according to PRD: unread (1) > unreplied (2) > replied (3)
    result.sort((a, b) => {
      // 1. Status priority: 未读 (unread) > 未回复 (unreplied) > 已回复 (replied)
      const statusWeight: Record<string, number> = { unread: 1, unreplied: 2, replied: 3 };
      const weightA = statusWeight[a.messageProcessingStatus] || 99;
      const weightB = statusWeight[b.messageProcessingStatus] || 99;

      if (weightA !== weightB) {
        return weightA - weightB;
      }

      // 2. Secondary sort
      if (sortBy === 'time_desc') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sortBy === 'time_asc') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'priority') {
        return a.priority - b.priority;
      }
      return 0;
    });

    setDisplayTickets(result);
  }, [majorDepsKey, tickets.length]); // Re-sort on major deps OR when a ticket is added/removed

  // 2. Minor Update Logic: Keep the current order but update the ticket content
  useEffect(() => {
    setDisplayTickets((prev) => {
      let changed = false;
      const next = prev.map((pt) => {
        const fresh = tickets.find((t) => t.id === pt.id);
        if (fresh && fresh !== pt) {
          changed = true;
          return fresh;
        }
        return pt;
      });
      return changed ? next : prev;
    });
  }, [tickets]);

  const groupedTickets = useMemo(() => {
    return displayTickets.reduce((acc, ticket) => {
      const platform = platformGroupLabelForTicket(ticket.platformType, ticket.channelId);
      const shop = ticket.channelId;
      if (!acc[platform]) acc[platform] = {};
      if (!acc[platform][shop]) acc[platform][shop] = [];
      acc[platform][shop].push(ticket);
      return acc;
    }, {} as Record<string, Record<string, Ticket[]>>);
  }, [displayTickets]);

  /** 下拉用：各平台在当前工单集合中的条数（与列表过滤一致） */
  const platformTicketCounts = useMemo(() => {
    const m: Record<string, number> = { ...platformVisibleCounts };
    for (const p of allPlatformKeys) {
      if (m[p] === undefined) m[p] = 0;
    }
    return m;
  }, [allPlatformKeys, platformVisibleCounts]);

  const sortedShopsForPlatform = useMemo(() => {
    if (selectedPlatform === ALL_PLATFORMS) {
      const s = new Set<string>();
      displayTickets.forEach((t) => {
        if (t.channelId?.trim()) s.add(t.channelId);
      });
      return [...s].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    }
    if (!groupedTickets[selectedPlatform]) return [];
    return Object.keys(groupedTickets[selectedPlatform]).sort((a, b) =>
      a.localeCompare(b, 'zh-CN')
    );
  }, [displayTickets, groupedTickets, selectedPlatform]);

  const shopTicketCounts = useMemo(() => {
    const m: Record<string, number> = {};
    if (selectedPlatform === ALL_PLATFORMS) {
      displayTickets.forEach((t) => {
        const c = t.channelId?.trim();
        if (!c) return;
        m[c] = (m[c] ?? 0) + 1;
      });
      return m;
    }
    if (!groupedTickets[selectedPlatform]) return m;
    for (const [shop, list] of Object.entries(groupedTickets[selectedPlatform])) {
      m[shop] = list.length;
    }
    return m;
  }, [displayTickets, groupedTickets, selectedPlatform]);

  /** 当前平台范围下、尚未按店铺筛选的工单（用于「全部店铺」数量） */
  const ticketsBeforeShopFilter = useMemo(() => {
    if (selectedPlatform === ALL_PLATFORMS) return displayTickets;
    return displayTickets.filter(
      (t) => platformGroupLabelForTicket(t.platformType, t.channelId) === selectedPlatform
    );
  }, [displayTickets, selectedPlatform]);

  const allShopsScopeCount = ticketsBeforeShopFilter.length;

  useLayoutEffect(() => {
    if (allPlatformKeys.length === 0) {
      setSelectedPlatform(ALL_PLATFORMS);
      setSelectedShop(ALL_SHOPS);
      return;
    }
    setSelectedPlatform((prev) => {
      if (prev === ALL_PLATFORMS) return ALL_PLATFORMS;
      return allPlatformKeys.includes(prev) ? prev : ALL_PLATFORMS;
    });
  }, [allPlatformKeys]);

  useLayoutEffect(() => {
    if (selectedShop === ALL_SHOPS) return;
    if (selectedPlatform === ALL_PLATFORMS) {
      const ok = displayTickets.some((t) => t.channelId === selectedShop);
      if (!ok) setSelectedShop(ALL_SHOPS);
      return;
    }
    if (!groupedTickets[selectedPlatform]?.[selectedShop]) {
      setSelectedShop(ALL_SHOPS);
    }
  }, [groupedTickets, selectedPlatform, displayTickets, selectedShop]);

  useEffect(() => {
    setShopTicketsPage(0);
  }, [selectedShop]);

  const shopLoadingSkipOnce = useRef(true);
  useEffect(() => {
    if (shopLoadingSkipOnce.current) {
      shopLoadingSkipOnce.current = false;
      return;
    }
    setShopListLoading(true);
    const t = window.setTimeout(() => setShopListLoading(false), 240);
    return () => window.clearTimeout(t);
  }, [selectedShop, selectedPlatform]);

  const ticketsForSelectedShop = useMemo(() => {
    const allP = selectedPlatform === ALL_PLATFORMS;
    const allS = selectedShop === ALL_SHOPS;
    if (allP && allS) return displayTickets;
    return displayTickets.filter((t) => {
      const p = platformGroupLabelForTicket(t.platformType, t.channelId);
      const shop = t.channelId;
      if (allP && !allS) return shop === selectedShop;
      if (!allP && allS) return p === selectedPlatform;
      return p === selectedPlatform && shop === selectedShop;
    });
  }, [displayTickets, selectedPlatform, selectedShop]);

  const shopTotalPages = Math.max(1, Math.ceil(ticketsForSelectedShop.length / INBOX_SHOP_PAGE_SIZE));
  const safeShopPage = Math.min(shopTicketsPage, shopTotalPages - 1);
  const pagedShopTickets = useMemo(() => {
    const start = safeShopPage * INBOX_SHOP_PAGE_SIZE;
    return ticketsForSelectedShop.slice(start, start + INBOX_SHOP_PAGE_SIZE);
  }, [ticketsForSelectedShop, safeShopPage]);

  useEffect(() => {
    setShopTicketsPage((p) => Math.min(p, Math.max(0, shopTotalPages - 1)));
  }, [shopTotalPages]);

  const resetFilters = () => {
    setFilterChannel('');
    setFilterIntent('');
    setFilterSentiment('');
    setFilterOrderStatus('');
    setFilterConversationStatus('');
    setFilterSla('');
  };

  const handleInboxMotherSync = async () => {
    setInboxSyncHint(null);
    if (!intellideskConfigured()) {
      setInboxSyncHint('当前为演示模式，请使用 API 模式后再同步。');
      return;
    }
    let tok = '';
    try {
      tok = (localStorage.getItem(MOTHER_TOKEN_STORAGE_KEY) ?? '').trim();
    } catch {
      tok = '';
    }
    setInboxSyncing(true);
    try {
      const r = await postInboxTicketsSync(intellideskTenantId(), intellideskUserIdForApi(user?.id), {
        ...(tok ? { token: tok } : {}),
        days: 90,
        runAi: true,
        aiMax: 40,
      });
      setInboxSyncHint(
        `已同步：订单 ${r.ordersSynced ?? 0} 条，会话 ${r.conversationsSynced} 条，消息 ${r.messagesSynced} 条；AI 更新意图/情绪 ${r.aiUpdated} 条` +
          (r.aiFailed ? `（失败 ${r.aiFailed}）` : '') +
          (r.aiSkippedNoLlm > 0 ? '（未配置 LLM，AI 未执行）' : '')
      );
      onInboxSynced?.();
    } catch (e) {
      setInboxSyncHint(e instanceof Error ? e.message : String(e));
    } finally {
      setInboxSyncing(false);
    }
  };

  return (
    <div className="w-[320px] flex flex-col bg-white border-r border-slate-200/90 shrink-0 h-full">
      {/* Header & Search */}
      <div className="p-4 border-b border-slate-200/90 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-800 tracking-tight shrink-0">工单</h2>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              title="手动新建工单"
              onClick={() => alert('新建工单弹窗（开发中）')}
              className="p-2 rounded-lg text-slate-500 hover:text-[#F97316] hover:bg-orange-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="从母系统刷新近 90 天会话与消息，并批量更新 AI 意图与情绪"
              onClick={() => void handleInboxMotherSync()}
              disabled={inboxSyncing}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              {inboxSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#F97316]" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </button>
            <div className="relative group">
              <button className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
                <ArrowUpDown className="w-4 h-4" />
              </button>
              <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 py-1">
                <button 
                  onClick={() => setSortBy('time_desc')}
                  className={cn("w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50", sortBy === 'time_desc' ? "text-[#F97316] font-bold" : "text-slate-700")}
                >
                  按创建时间降序 (默认)
                </button>
                <button 
                  onClick={() => setSortBy('time_asc')}
                  className={cn("w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50", sortBy === 'time_asc' ? "text-[#F97316] font-bold" : "text-slate-700")}
                >
                  按创建时间升序
                </button>
                <button 
                  onClick={() => setSortBy('priority')}
                  className={cn("w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50", sortBy === 'priority' ? "text-[#F97316] font-bold" : "text-slate-700")}
                >
                  按优先级排序
                </button>
              </div>
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                showFilters ? "bg-orange-50 text-[#F97316]" : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
        {inboxSyncHint ? (
          <p className="text-[11px] leading-snug text-slate-500">{inboxSyncHint}</p>
        ) : null}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索平台订单号、主题、买家…"
            className="w-full pl-9 pr-3 py-2 bg-slate-50/90 border border-slate-200/90 focus:bg-white focus:border-slate-300 focus:ring-1 focus:ring-slate-200 rounded-lg text-[13px] text-slate-700 placeholder:text-slate-400 transition-all outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* 7-Dimension Advanced Filters (Collapsible) */}
        {showFilters && (
          <div className="pt-2 space-y-2 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={filterChannel}
                onChange={(e) => setFilterChannel(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#F97316]"
              >
                <option value="">全部店铺</option>
                {channelOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={filterIntent}
                onChange={(e) => setFilterIntent(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#F97316]"
              >
                <option value="">全部售后类型</option>
                {afterSalesTypeOptions.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={filterSentiment}
                onChange={(e) => setFilterSentiment(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#F97316]"
              >
                <option value="">全部买家情绪</option>
                {sentimentOptions.map((s) => (
                  <option key={s} value={s}>
                    {SENTIMENT_LABEL[s] ?? s}
                  </option>
                ))}
              </select>
              <select
                value={filterOrderStatus}
                onChange={(e) => setFilterOrderStatus(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#F97316]"
              >
                <option value="">全部订单状态</option>
                {orderStatusOptions.map((st) => (
                  <option key={st} value={st}>
                    {ORDER_STATUS_LABEL[st] ?? st}
                  </option>
                ))}
              </select>
              <select
                value={filterConversationStatus}
                onChange={(e) => setFilterConversationStatus(e.target.value as ConversationStatusFilter)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#F97316]"
              >
                <option value="">全部会话</option>
                <option value="unread">未读消息</option>
                <option value="unreplied">待回复</option>
                <option value="replied">已回复</option>
              </select>
              <select
                value={filterSla}
                onChange={(e) => setFilterSla(e.target.value as SlaFilter)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#F97316]"
              >
                <option value="">全部 SLA</option>
                <option value="overdue">SLA 已超时</option>
              </select>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-[#F97316] font-medium hover:underline"
              >
                重置过滤
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ticket List：平台 → 店铺 → 分页工单 */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {displayTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center overflow-y-auto">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Inbox className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-900">暂无消息</p>
            <p className="text-xs text-slate-500 mt-1">当前过滤条件下没有找到工单</p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="shrink-0 border-b border-slate-200/80 bg-white px-3 py-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <label
                  htmlFor="inbox-list-platform"
                  className="shrink-0 text-[10px] font-medium text-slate-500"
                >
                  平台
                </label>
                <select
                  id="inbox-list-platform"
                  aria-label="收件箱：选择平台"
                  title="选择平台"
                  className="min-w-0 flex-1 rounded-md border border-slate-200/90 bg-slate-50/90 py-1 pl-1.5 pr-5 text-[11px] text-slate-700 outline-none focus:border-[#F97316] focus:ring-1 focus:ring-orange-200/80"
                  value={selectedPlatform}
                  onChange={(e) => {
                    setSelectedPlatform(e.target.value);
                    setSelectedShop(ALL_SHOPS);
                  }}
                >
                  <option value={ALL_PLATFORMS}>
                    全部平台（{displayTickets.length}）
                  </option>
                  {allPlatformKeys.map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}（{platformTicketCounts[platform] ?? 0}）
                    </option>
                  ))}
                </select>

                <label
                  htmlFor="inbox-list-shop"
                  className="shrink-0 text-[10px] font-medium text-slate-500"
                >
                  店铺
                </label>
                {sortedShopsForPlatform.length === 0 ? (
                  <span className="min-w-0 flex-1 truncate rounded-md border border-dashed border-slate-200/90 bg-slate-50/50 py-1 pl-1.5 text-[11px] text-slate-400">
                    暂无店铺
                  </span>
                ) : (
                  <select
                    id="inbox-list-shop"
                    aria-label="收件箱：选择店铺"
                    title="选择店铺"
                    className="min-w-0 flex-1 rounded-md border border-slate-200/90 bg-slate-50/90 py-1 pl-1.5 pr-5 text-[11px] text-slate-700 outline-none focus:border-[#F97316] focus:ring-1 focus:ring-orange-200/80"
                    value={selectedShop}
                    onChange={(e) => setSelectedShop(e.target.value)}
                  >
                    <option value={ALL_SHOPS}>全部店铺（{allShopsScopeCount}）</option>
                    {sortedShopsForPlatform.map((shop) => (
                      <option key={shop} value={shop}>
                        {shop}（{shopTicketCounts[shop] ?? 0}）
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  title={
                    onReloadList
                      ? listReloading
                        ? '正在加载…'
                        : '重新加载工单列表'
                      : '演示模式不支持刷新列表'
                  }
                  aria-label={onReloadList ? '重新加载工单列表' : '演示模式不支持刷新列表'}
                  disabled={listReloading || !onReloadList}
                  onClick={() => onReloadList?.()}
                  className={cn(
                    'shrink-0 rounded-md border p-1.5 transition-colors',
                    listReloading
                      ? 'cursor-wait border-orange-200/60 bg-orange-50/50 text-[#F97316]'
                      : onReloadList
                        ? 'border-slate-200/90 text-slate-500 hover:bg-slate-100 hover:text-[#F97316]'
                        : 'cursor-not-allowed border-slate-100/90 text-slate-300'
                  )}
                >
                  {listReloading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#F97316]" aria-hidden />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
              <div className="relative flex-1 min-h-0 overflow-y-auto">
                {shopListLoading ? (
                  <div
                    className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 bg-white/75 backdrop-blur-[1px]"
                    aria-busy
                  >
                    <Loader2 className="h-6 w-6 animate-spin text-[#F97316]" />
                    <span className="text-[11px] text-slate-500">加载工单…</span>
                  </div>
                ) : null}

                {ticketsForSelectedShop.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                    <p className="text-xs font-medium text-slate-600">当前范围暂无工单</p>
                    <p className="mt-1 text-[11px] text-slate-400">请切换平台/店铺或调整筛选</p>
                  </div>
                ) : (
                  <div className="px-2 pt-2 pb-1">
                    <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 overflow-hidden">
                      {pagedShopTickets.map((ticket) => {
                        const order = ticket.orderId ? orders[ticket.orderId] : null;
                        const previewLine = inboxListPreviewLine(ticket);
                        const previewTitle = inboxListPreviewTitle(ticket);
                        const buyerName = customers[ticket.customerId]?.name ?? '买家';

                        const isSelected = selectedTicketId === ticket.id;
                        const showUnreadDot =
                          ticket.messageProcessingStatus === 'unread' || ticket.status === TicketStatus.NEW;
                        const platformMark = platformGroupLabelForTicket(
                          ticket.platformType,
                          ticket.channelId
                        );

                        return (
                          <div
                            key={ticket.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => navigate(`/mailbox/${ticket.id}${mailboxSearchSuffix}`)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                navigate(`/mailbox/${ticket.id}${mailboxSearchSuffix}`);
                              }
                            }}
                            onMouseEnter={() => onTicketHover?.(ticket.id)}
                            className={cn(
                              'px-3 py-2.5 cursor-pointer transition-colors relative border-b border-slate-200/70 last:border-b-0',
                              isSelected
                                ? 'bg-slate-100/90 hover:bg-slate-100'
                                : 'bg-white hover:bg-slate-50/90'
                            )}
                          >
                            {isSelected ? (
                              <div className="absolute left-0 top-2 bottom-2 w-px rounded-full bg-orange-400/90" />
                            ) : null}

                            <div className={cn('min-w-0', isSelected ? 'pl-2.5' : 'pl-1')}>
                              <div className="flex min-h-[15px] items-center justify-start gap-1.5">
                                <span
                                  className={cn(
                                    'h-1 w-1 shrink-0 rounded-full',
                                    showUnreadDot ? 'bg-rose-500/90' : 'bg-transparent'
                                  )}
                                  aria-hidden
                                />
                                <span className="pointer-events-none shrink-0" aria-hidden>
                                  <InboxListPlatformMark platformLabel={platformMark} />
                                </span>
                                <span
                                  className="min-w-0 flex-1 truncate text-left text-xs font-bold text-slate-700"
                                  title={buyerName}
                                >
                                  {buyerName}
                                </span>
                                <span className="shrink-0 tabular-nums text-[11px] text-slate-500">
                                  {formatDistanceToNow(new Date(ticket.createdAt), {
                                    addSuffix: true,
                                    locale: zhCN,
                                  })}
                                </span>
                              </div>
                              <h3
                                className={cn(
                                  'mt-1 line-clamp-2 text-left text-[13px] leading-snug',
                                  showUnreadDot
                                    ? 'font-medium text-slate-800'
                                    : 'font-normal text-slate-600'
                                )}
                                title={`${previewTitle}\n完整工单 ID：${ticket.id}`}
                              >
                                {previewLine}
                              </h3>
                              {isSelected ? (
                                <div className="-mx-3 mt-2 rounded-b-md border-t border-slate-200/80 bg-slate-50/50 px-3 pb-0.5 pt-2">
                                  <InboxTicketStatusIcons
                                    ticket={ticket}
                                    order={order}
                                    compact
                                    className="justify-start pt-0 flex-wrap gap-0.5"
                                  />
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {ticketsForSelectedShop.length > 0 ? (
                <div className="shrink-0 border-t border-slate-200/80 bg-white px-2 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={safeShopPage <= 0}
                      onClick={() => setShopTicketsPage((p) => Math.max(0, p - 1))}
                      className={cn(
                        'inline-flex items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors',
                        safeShopPage <= 0
                          ? 'cursor-not-allowed border-slate-100 text-slate-300'
                          : 'border-slate-200/90 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      上一页
                    </button>
                    <span className="tabular-nums text-[11px] text-slate-500">
                      {safeShopPage + 1} / {shopTotalPages}
                      <span className="text-slate-300"> · </span>
                      {ticketsForSelectedShop.length} 条
                    </span>
                    <button
                      type="button"
                      disabled={safeShopPage >= shopTotalPages - 1}
                      onClick={() =>
                        setShopTicketsPage((p) => Math.min(p + 1, Math.max(0, shopTotalPages - 1)))
                      }
                      className={cn(
                        'inline-flex items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors',
                        safeShopPage >= shopTotalPages - 1
                          ? 'cursor-not-allowed border-slate-100 text-slate-300'
                          : 'border-slate-200/90 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      下一页
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
