import {
  Users,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Loader2,
  ChevronRight,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/hooks/useAuth';
import { summarizeTicket } from '@/src/services/geminiService';
import {
  intellideskConfigured,
  intellideskTenantId,
  intellideskUserIdForApi,
  fetchDashboardInboxMetrics,
  fetchDashboardStructure,
  fetchDashboardTrends,
  intellideskFetchErrorMessage,
  setGlobalApiError,
  formatAiUserVisibleError,
  type DashboardInboxMetrics,
  type StructureBucket,
} from '@/src/services/intellideskApi';
import { Link } from 'react-router-dom';
import OnlineSeatsModal from './OnlineSeatsModal';
import { DEMO_AGENT_SEATS_INITIAL, DEMO_SEAT_ONLINE_BY_ID } from '@/src/data/demoAgentSeats';

/**
 * 与工单「消息处理 / SLA」口径对齐的仪表盘指标。
 * 环比徽章：产品定义为「较昨日同时段」——今日当前时刻的快照值 vs 昨日同一时刻快照值。
 * 公式：变化率 = (今日值 − 昨日值) ÷ max(|昨日值|, ε) × 100%，四舍五入保留一位小数；昨日为 0 且今日 > 0 时展示「新增」类文案（由后端/前端约定）。
 * 当前数值与百分比为静态 Mock，接入统计接口后由服务端按上述口径返回 current、previous、changePercent。
 */
const INBOX_METRICS: {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon: LucideIcon;
  color: string;
  bg: string;
  link: string;
  configLink?: string;
  configLinkAdminOnly?: boolean;
}[] = [
  {
    title: '未读',
    value: '1,284',
    change: '+12.5%',
    trend: 'up',
    icon: MessageSquare,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    link: '/mailbox?filter=unread',
  },
  {
    title: '已读未回复',
    value: '342',
    change: '-5.2%',
    trend: 'down',
    icon: Users,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    link: '/mailbox?filter=unreplied',
  },
  {
    title: '已回复',
    value: '8,432',
    change: '+18.4%',
    trend: 'up',
    icon: CheckCircle2,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    link: '/mailbox?filter=replied',
  },
  {
    title: '超时',
    value: '28',
    change: '+2.1%',
    trend: 'up',
    icon: AlertCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    link: '/mailbox?filter=sla_overdue',
  },
];

/** 与 UI 副标题、接口文档对齐的环比时间基准说明 */
const INBOX_METRICS_PERIOD_LABEL = '较昨日同时段';

type DistSlice = { name: string; value: number; fill: string; count?: number };

const PIE_PALETTE = ['#9333EA', '#F97316', '#3B82F6', '#10B981', '#94A3B8', '#64748B', '#DC2626', '#EA580C'];

function formatPercentForLabel(p: number): string {
  const r = Math.round(p * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** 列表/提示：统计数 + 占比，如 8 (20%) */
function formatCountWithPercent(count: number, percent: number): string {
  return `${count} (${formatPercentForLabel(percent)}%)`;
}

function structureBucketToPie(data: StructureBucket): DistSlice[] {
  return Object.entries(data).map(([name, v], i) => ({
    name,
    value: v.percent,
    count: v.count,
    fill: PIE_PALETTE[i % PIE_PALETTE.length],
  }));
}

function formatInboxChangePct(pct: number | null): { text: string; trend: 'up' | 'down' } {
  if (pct === null) return { text: '—', trend: 'up' };
  const sign = pct > 0 ? '+' : '';
  return { text: `${sign}${pct}%`, trend: pct >= 0 ? 'up' : 'down' };
}

const AFTER_SALES_TYPE_DIST: DistSlice[] = [
  { name: '退款/售后', value: 32, count: 32, fill: '#9333EA' },
  { name: '物流查询', value: 24, count: 24, fill: '#F97316' },
  { name: '发票/凭证', value: 18, count: 18, fill: '#3B82F6' },
  { name: '修改地址', value: 12, count: 12, fill: '#10B981' },
  { name: '其他', value: 14, count: 14, fill: '#94A3B8' },
];

/** 买家侧情绪（与工单 sentiment 一致）；标题沿用产品常用「用户情绪」 */
const BUYER_SENTIMENT_DIST: DistSlice[] = [
  { name: '平静中性', value: 45, count: 45, fill: '#64748B' },
  { name: '愤怒抱怨', value: 22, count: 22, fill: '#DC2626' },
  { name: '焦急催促', value: 20, count: 20, fill: '#EA580C' },
  { name: '开心满意', value: 13, count: 13, fill: '#16A34A' },
];

const ORDER_STATUS_DIST: DistSlice[] = [
  { name: '已发货', value: 40, count: 40, fill: '#2563EB' },
  { name: '未发货', value: 28, count: 28, fill: '#64748B' },
  { name: '已退款', value: 22, count: 22, fill: '#7C3AED' },
  { name: '部分退款', value: 10, count: 10, fill: '#A855F7' },
];

/** 工作台使用引导：按顺序完成基础配置（仅数字序号，无图标） */
const USAGE_NAV: { step: number; title: string; desc: string; path: string }[] = [
  {
    step: 1,
    title: '绑定店铺',
    desc: '接入各平台下的店铺，同步订单与买家消息',
    path: 'https://tiaojia.nezhachuhai.com/authorization',
  },
  {
    step: 2,
    title: '配置坐席',
    desc: '角色、坐席账号与工单分配规则（需管理员权限）',
    path: '/settings/seats',
  },
  {
    step: 3,
    title: '配置模版',
    desc: '快捷回复与话术模板，提升回复效率',
    path: '/settings/templates',
  },
  {
    step: 4,
    title: '配置SLA',
    desc: '响应时效与超时预警规则',
    path: '/settings/sla',
  },
];

const MOCK_CHART_DATA = [
  { name: '周一', tickets: 120, resolved: 100 },
  { name: '周二', tickets: 150, resolved: 130 },
  { name: '周三', tickets: 180, resolved: 160 },
  { name: '周四', tickets: 140, resolved: 145 },
  { name: '周五', tickets: 210, resolved: 190 },
  { name: '周六', tickets: 90, resolved: 85 },
  { name: '周日', tickets: 70, resolved: 75 },
];

function DistributionPieCard({ title, data }: { title: string; data: DistSlice[] }) {
  return (
    <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex flex-col min-h-[320px]">
      <div className="mb-2">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      </div>
      <div className="flex-1 min-h-[220px] w-full flex flex-col">
        <div className="h-[220px] w-full shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={2}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, _name: string, item: { payload?: DistSlice }) => {
                  const p = item?.payload;
                  const label =
                    p?.count != null ? formatCountWithPercent(p.count, value) : `${formatPercentForLabel(value)}%`;
                  return [label, '占比'];
                }}
                contentStyle={{
                  borderRadius: '12px',
                  border: 'none',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 border-t border-slate-100 pt-4 flex-1">
          <ul className="space-y-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
            {data.map((row) => (
              <li key={row.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: row.fill }}
                  />
                  <span className="truncate">{row.name}</span>
                </span>
                <span className="font-semibold text-slate-900 tabular-nums shrink-0 ml-2">
                  {row.count != null
                    ? formatCountWithPercent(row.count, row.value)
                    : `${formatPercentForLabel(row.value)}%`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function seatInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const s = name.slice(0, 2);
  return s.length ? s.toUpperCase() : '?';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const liveDash = intellideskConfigured();
  const tenantId = intellideskTenantId();
  const apiUserId = intellideskUserIdForApi(user?.id);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [onlineSeatsOpen, setOnlineSeatsOpen] = useState(false);
  const [apiMetrics, setApiMetrics] = useState<DashboardInboxMetrics | null>(null);
  const [apiStructure, setApiStructure] = useState<{
    afterSalesIntent: StructureBucket;
    sentiment: StructureBucket;
    orderStatus: StructureBucket;
    channels?: StructureBucket;
  } | null>(null);
  const [trendRange, setTrendRange] = useState<'7d' | '30d'>('7d');
  const [trendSeries, setTrendSeries] = useState<{ name: string; tickets: number; resolved: number }[]>(
    []
  );
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState<string | null>(null);

  useEffect(() => {
    import('@/src/services/intellideskApi').then((m) => m.setGlobalApiError(dashError));
  }, [dashError]);

  const [dashRetryKey, setDashRetryKey] = useState(0);

  const onlineSeatPreview = useMemo(() => {
    const online = DEMO_AGENT_SEATS_INITIAL.filter(
      (s) => s.status === 'active' && DEMO_SEAT_ONLINE_BY_ID[s.id]
    );
    const shown = online.slice(0, 3).map((s) => seatInitials(s.displayName));
    const rest = Math.max(0, online.length - 3);
    return { shown, rest };
  }, []);

  useEffect(() => {
    if (!liveDash) return;
    let cancelled = false;
    setDashError(null);
    void (async () => {
      try {
        setDashLoading(true);
        const [m, s, t] = await Promise.all([
          fetchDashboardInboxMetrics(tenantId, apiUserId),
          fetchDashboardStructure(tenantId, apiUserId),
          fetchDashboardTrends(tenantId, apiUserId, trendRange),
        ]);
        if (cancelled) return;
        setApiMetrics(m);
        setApiStructure(s);
        setTrendSeries(t.series);
      } catch (e) {
        if (!cancelled) setDashError(intellideskFetchErrorMessage(e));
      } finally {
        if (!cancelled) setDashLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveDash, tenantId, apiUserId, trendRange, dashRetryKey]);

  const inboxStatCards = useMemo(() => {
    if (!liveDash || !apiMetrics) return INBOX_METRICS;
    const m = apiMetrics;
    const row = (
      key: keyof DashboardInboxMetrics,
      title: string,
      icon: LucideIcon,
      color: string,
      bg: string,
      link: string
    ) => {
      const card = m[key];
      const { text, trend } = formatInboxChangePct(card.changePercent);
      return {
        title,
        value: String(card.current),
        change: text,
        trend,
        icon,
        color,
        bg,
        link,
      };
    };
    return [
      row('unread', '未读', MessageSquare, 'text-orange-600', 'bg-orange-50', '/mailbox?filter=unread'),
      row('unreplied', '已读未回复', Users, 'text-emerald-600', 'bg-emerald-50', '/mailbox?filter=unreplied'),
      row('replied', '已回复', CheckCircle2, 'text-blue-600', 'bg-blue-50', '/mailbox?filter=replied'),
      row('slaOverdue', '超时', AlertCircle, 'text-red-600', 'bg-red-50', '/mailbox?filter=sla_overdue'),
    ];
  }, [liveDash, apiMetrics]);

  const intentPie = useMemo(
    () =>
      liveDash && apiStructure
        ? structureBucketToPie(apiStructure.afterSalesIntent)
        : AFTER_SALES_TYPE_DIST,
    [liveDash, apiStructure]
  );
  const sentimentPie = useMemo(
    () =>
      liveDash && apiStructure ? structureBucketToPie(apiStructure.sentiment) : BUYER_SENTIMENT_DIST,
    [liveDash, apiStructure]
  );
  const orderStatusPie = useMemo(
    () =>
      liveDash && apiStructure ? structureBucketToPie(apiStructure.orderStatus) : ORDER_STATUS_DIST,
    [liveDash, apiStructure]
  );

  const channelBars = useMemo(() => {
    const fallback = [
      { name: 'Amazon', value: 45, count: 45, color: 'bg-[#F97316]' },
      { name: 'eBay', value: 25, count: 25, color: 'bg-[#9333EA]' },
      { name: 'Shopify', value: 20, count: 20, color: 'bg-blue-500' },
      { name: 'Walmart', value: 10, count: 10, color: 'bg-emerald-500' },
    ];
    if (!liveDash) return fallback;
    const ch = apiStructure?.channels;
    if (!ch || Object.keys(ch).length === 0) return [];
    const colors = ['bg-[#F97316]', 'bg-[#9333EA]', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-slate-500'];
    return Object.entries(ch)
      .map(([name, v], i) => ({
        name,
        value: Math.round(v.percent * 10) / 10,
        count: v.count,
        color: colors[i % colors.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [liveDash, apiStructure]);

  const chartData = useMemo(
    () => (liveDash && trendSeries.length > 0 ? trendSeries : MOCK_CHART_DATA),
    [liveDash, trendSeries]
  );

  useEffect(() => {
    const generateInsight = async () => {
      setIsGeneratingInsight(true);
      setGlobalApiError(null);
      const statsLine =
        liveDash && apiMetrics
          ? `未读 ${apiMetrics.unread.current}、已读未回复 ${apiMetrics.unreplied.current}、已回复 ${apiMetrics.replied.current}、SLA超时 ${apiMetrics.slaOverdue.current}。`
          : 'Dashboard Stats: Total Tickets: 1284 (+12.5%), Avg Response Time: 1h 24m (-18.4%), SLA: 98.2%.';
      const mockConversation = [
        { role: 'system' as const, content: statsLine },
        {
          role: 'user' as const,
          content:
            'Provide a 2-sentence summary of our current performance and one actionable recommendation in Chinese.',
        },
      ];
      try {
        const summary = await summarizeTicket(mockConversation);
        setAiInsight(summary);
      } catch (e) {
        setGlobalApiError(`[工作台 AI 洞察] ${formatAiUserVisibleError(e)}`);
        setAiInsight('暂时无法生成 AI 洞察，请稍后刷新页面重试。');
      } finally {
        setIsGeneratingInsight(false);
      }
    };

    void generateInsight();
  }, [liveDash, apiMetrics]);

  return (
    <div className="p-8 space-y-8 bg-slate-50/50 min-h-full">
      {liveDash && dashLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          正在同步仪表盘数据…
        </div>
      ) : null}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">欢迎回来, {user?.name.split(' ')[0]}!</h1>
          <p className="text-slate-500 text-sm mt-1">这是您今天的工作台概览。</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOnlineSeatsOpen(true)}
            className="flex -space-x-2 cursor-pointer rounded-lg p-1 -m-1 hover:bg-slate-100/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40"
            title="查看在线坐席"
            aria-label="查看在线坐席"
          >
            {onlineSeatPreview.shown.length === 0 && onlineSeatPreview.rest === 0 ? (
              <span className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">
                —
              </span>
            ) : (
              <>
                {onlineSeatPreview.shown.map((initials, i) => (
                  <span
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-800"
                  >
                    {initials}
                  </span>
                ))}
                {onlineSeatPreview.rest > 0 ? (
                  <span className="w-8 h-8 rounded-full border-2 border-white bg-[#F97316] text-white flex items-center justify-center text-[10px] font-bold">
                    +{onlineSeatPreview.rest}
                  </span>
                ) : null}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setOnlineSeatsOpen(true)}
            className="px-4 py-2 bg-[#F97316] text-white rounded-lg text-sm font-bold shadow-md shadow-orange-500/20 hover:bg-orange-600 transition-all"
          >
            在线坐席
          </button>
        </div>
      </header>
      
      {/* AI Insights Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex items-start gap-4">
          <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
            <Sparkles className="w-6 h-6 text-[#F97316]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold">AI 效能洞察</h3>
            {isGeneratingInsight ? (
              <div className="flex items-center gap-2 text-slate-300 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                正在分析当前趋势...
              </div>
            ) : (
              <p className="text-slate-300 text-sm leading-relaxed max-w-3xl">
                {aiInsight || "今日表现强劲！工单量上升 12.5%，但响应时间缩短了 18.4%。建议在高峰时段向亚马逊北美站重新分配客服资源。"}
              </p>
            )}
          </div>
        </div>
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-64 h-64 bg-[#F97316]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 translate-y-1/2 w-48 h-48 bg-[#9333EA]/20 rounded-full blur-3xl" />
      </div>

      {/* 使用导航：紧跟 AI 洞察下方，以数字 1–4 为步骤标识 */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4">使用导航</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {USAGE_NAV.map((nav) => {
            const isExternal = nav.path.startsWith('http');
            const innerContent = (
              <>
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-2xl font-bold tabular-nums text-slate-800 group-hover:border-[#F97316]/40 group-hover:bg-orange-50/60 group-hover:text-[#F97316] transition-colors"
                  aria-hidden
                >
                  {nav.step}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <h4 className="font-bold text-slate-900 group-hover:text-[#F97316] transition-colors">
                    {nav.title}
                  </h4>
                  <p className="text-sm text-slate-500 mt-1 leading-snug">{nav.desc}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 shrink-0 mt-1" />
              </>
            );

            const className = "bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 hover:border-slate-300 hover:shadow-md transition-all group";

            if (isExternal) {
              return (
                <a key={nav.step} href={nav.path} className={className} target="_blank" rel="noopener noreferrer">
                  {innerContent}
                </a>
              );
            }
            return (
              <Link key={nav.step} to={nav.path} className={className}>
                {innerContent}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 工单指标：与消息处理状态 / SLA 口径一致 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-bold text-slate-900">工单</h3>
          <div className="group relative flex items-center">
            <HelpCircle className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help transition-colors" />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3 bg-slate-800 text-slate-200 text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none z-10">
              环比（角标百分比）基准为<strong className="text-white mx-1">{INBOX_METRICS_PERIOD_LABEL}</strong>：用当前统计时刻的指标值与昨日同一时刻对比，按
              <span className="font-mono text-white/80 mx-1">(今日值 − 昨日值) ÷ |昨日值|</span>
              计算。昨日为 0 时由系统约定展示「—」或「新增」。↑ 红 / ↓ 绿仅表示增减方向，不代表业务好坏。
              <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-800" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {inboxStatCards.map((stat) => (
          <div
            key={stat.title}
            className="bg-white rounded-[24px] shadow-sm border border-slate-100 hover:shadow-md transition-all group flex flex-col"
          >
            <Link to={stat.link} className="p-6 space-y-4 flex-1 block">
              <div className="flex items-center justify-between">
                <div className={cn('p-3 rounded-2xl transition-colors', stat.bg)}>
                  <stat.icon className={cn('w-6 h-6', stat.color)} />
                </div>
                <div
                  className={cn(
                    'flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full',
                    stat.trend === 'up' ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'
                  )}
                  title={`${INBOX_METRICS_PERIOD_LABEL}环比：${stat.change}`}
                >
                  {stat.trend === 'up' ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {stat.change}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800">{stat.title}</p>
                <div className="flex items-end justify-between pt-2">
                  <p className="text-3xl font-bold text-slate-900 tracking-tight">{stat.value}</p>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 transition-colors mb-1 shrink-0" />
                </div>
              </div>
            </Link>
          </div>
        ))}
        </div>
      </div>

      {/* 业务结构分布（在线模式由 /api/dashboard/structure 提供） */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4">业务结构分布</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <DistributionPieCard title="工单意图分布" data={intentPie} />
          <DistributionPieCard title="用户情绪分布" data={sentimentPie} />
          <DistributionPieCard title="订单状态分布" data={orderStatusPie} />
        </div>
      </div>

      {/* Main Charts Section：右侧「平台分布」高度与左侧趋势卡（图表区 300px + 内边距/标题）对齐，列表超出时滚动 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:items-start">
        <div className="lg:col-span-2 bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">工单处理趋势</h3>
            <select
              className="bg-slate-50 border-none text-xs font-medium rounded-lg px-3 py-1.5 outline-none text-slate-600"
              value={trendRange}
              onChange={(e) => setTrendRange(e.target.value === '30d' ? '30d' : '7d')}
              disabled={!liveDash}
            >
              <option value="7d">最近 7 天</option>
              <option value="30d">最近 30 天</option>
            </select>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#94a3b8' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#94a3b8' }} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="tickets" 
                  stroke="#F97316" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorTickets)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex flex-col min-h-0 lg:h-[412px]">
          <h3 className="text-lg font-bold text-slate-900 shrink-0">平台分布</h3>
          <div className="mt-6 flex-1 min-h-0 overflow-y-auto pr-1 space-y-5 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
            {channelBars.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                {liveDash ? '暂无工单平台数据' : '演示数据'}
              </p>
            ) : null}
            {channelBars.map((channel) => (
              <div key={channel.name} className="space-y-2">
                <div className="flex justify-between text-sm gap-2">
                  <span className="font-medium text-slate-700">{channel.name}</span>
                  <span className="font-bold text-slate-900 tabular-nums shrink-0">
                    {formatCountWithPercent(channel.count, channel.value)}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', channel.color)} style={{ width: `${channel.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <OnlineSeatsModal
        isOpen={onlineSeatsOpen}
        onClose={() => setOnlineSeatsOpen(false)}
        seats={DEMO_AGENT_SEATS_INITIAL}
        onlineBySeatId={DEMO_SEAT_ONLINE_BY_ID}
      />
    </div>
  );
}
