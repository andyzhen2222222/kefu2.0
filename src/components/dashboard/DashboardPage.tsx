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
import { Link } from 'react-router-dom';
import OnlineSeatsModal from './OnlineSeatsModal';
import { DEMO_AGENT_SEATS_INITIAL, DEMO_SEAT_ONLINE_BY_ID } from '@/src/data/demoAgentSeats';

/**
 * 与收件箱「消息处理 / SLA」口径对齐的仪表盘指标。
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

const AFTER_SALES_TYPE_DIST = [
  { name: '退款/售后', value: 32, fill: '#9333EA' },
  { name: '物流查询', value: 24, fill: '#F97316' },
  { name: '发票/凭证', value: 18, fill: '#3B82F6' },
  { name: '修改地址', value: 12, fill: '#10B981' },
  { name: '其他', value: 14, fill: '#94A3B8' },
];

/** 买家侧情绪（与工单 sentiment 一致）；标题沿用产品常用「用户情绪」 */
const BUYER_SENTIMENT_DIST = [
  { name: '平静中性', value: 45, fill: '#64748B' },
  { name: '愤怒抱怨', value: 22, fill: '#DC2626' },
  { name: '焦急催促', value: 20, fill: '#EA580C' },
  { name: '开心满意', value: 13, fill: '#16A34A' },
];

const ORDER_STATUS_DIST = [
  { name: '已发货', value: 40, fill: '#2563EB' },
  { name: '未发货', value: 28, fill: '#64748B' },
  { name: '已退款', value: 22, fill: '#7C3AED' },
  { name: '部分退款', value: 10, fill: '#A855F7' },
];

/** 工作台使用引导：按顺序完成基础配置（仅数字序号，无图标） */
const USAGE_NAV: { step: number; title: string; desc: string; path: string }[] = [
  {
    step: 1,
    title: '绑定店铺',
    desc: '接入各平台店铺与渠道，同步订单与买家消息',
    path: '/settings',
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

type DistSlice = { name: string; value: number; fill: string };

function DistributionPieCard({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle?: string;
  data: DistSlice[];
}) {
  return (
    <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex flex-col min-h-[320px]">
      <div className="mb-2">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        {subtitle ? <p className="text-xs text-slate-500 mt-1">{subtitle}</p> : null}
      </div>
      <div className="flex-1 min-h-[220px] w-full">
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
              formatter={(value: number) => [`${value}%`, '占比']}
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 space-y-2 border-t border-slate-100 pt-4">
        {data.map((row) => (
          <li key={row.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-slate-600 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: row.fill }}
              />
              <span className="truncate">{row.name}</span>
            </span>
            <span className="font-semibold text-slate-900 tabular-nums shrink-0 ml-2">{row.value}%</span>
          </li>
        ))}
      </ul>
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
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [onlineSeatsOpen, setOnlineSeatsOpen] = useState(false);

  const onlineSeatPreview = useMemo(() => {
    const online = DEMO_AGENT_SEATS_INITIAL.filter(
      (s) => s.status === 'active' && DEMO_SEAT_ONLINE_BY_ID[s.id]
    );
    const shown = online.slice(0, 3).map((s) => seatInitials(s.displayName));
    const rest = Math.max(0, online.length - 3);
    return { shown, rest };
  }, []);

  useEffect(() => {
    const generateInsight = async () => {
      setIsGeneratingInsight(true);
      // Simulate generating insight based on dashboard data
      const mockConversation = [
        { role: 'system', content: `Dashboard Stats: Total Tickets: 1284 (+12.5%), Avg Response Time: 1h 24m (-18.4%), SLA: 98.2%.` },
        { role: 'user', content: 'Provide a 2-sentence summary of our current performance and one actionable recommendation in Chinese.' }
      ];
      const summary = await summarizeTicket(mockConversation);
      setAiInsight(summary);
      setIsGeneratingInsight(false);
    };

    generateInsight();
  }, []);

  return (
    <div className="p-8 space-y-8 bg-slate-50/50 min-h-full">
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
          {USAGE_NAV.map((nav) => (
            <Link
              key={nav.step}
              to={nav.path}
              className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 hover:border-slate-300 hover:shadow-md transition-all group"
            >
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
            </Link>
          ))}
        </div>
      </div>

      {/* 收件箱指标：与消息处理状态 / SLA 口径一致 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-bold text-slate-900">收件箱</h3>
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
        {INBOX_METRICS.map((stat) => (
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

      {/* 业务结构分布（Mock，后续对接统计接口） */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4">业务结构分布</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <DistributionPieCard title="售后类型分布" subtitle="按 AI / 工单标注的售后类型聚合" data={AFTER_SALES_TYPE_DIST} />
          <DistributionPieCard
            title="用户情绪分布"
            subtitle="买家消息情绪识别（与收件箱情绪标签一致）"
            data={BUYER_SENTIMENT_DIST}
          />
          <DistributionPieCard title="订单状态分布" subtitle="关联订单：发货 / 退款等状态占比" data={ORDER_STATUS_DIST} />
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">工单处理趋势</h3>
            <select className="bg-slate-50 border-none text-xs font-medium rounded-lg px-3 py-1.5 outline-none text-slate-600">
              <option>最近 7 天</option>
              <option>最近 30 天</option>
            </select>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_CHART_DATA}>
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
        
        <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 space-y-6">
          <h3 className="text-lg font-bold text-slate-900">渠道分布</h3>
          <div className="space-y-5">
            {[
              { name: 'Amazon US', value: 45, color: 'bg-[#F97316]' },
              { name: 'eBay UK', value: 25, color: 'bg-[#9333EA]' },
              { name: 'Shopify Store', value: 20, color: 'bg-blue-500' },
              { name: 'Walmart', value: 10, color: 'bg-emerald-500' },
            ].map(channel => (
              <div key={channel.name} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-700">{channel.name}</span>
                  <span className="font-bold text-slate-900">{channel.value}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", channel.color)} style={{ width: `${channel.value}%` }} />
                </div>
              </div>
            ))}
          </div>
          
          <div className="pt-6 border-t border-slate-50">
            <Link to="/settings" className="block w-full text-center py-2.5 text-[#F97316] text-sm font-bold hover:bg-orange-50 rounded-xl transition-all">
              管理渠道
            </Link>
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
