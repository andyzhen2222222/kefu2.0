import type { LucideIcon } from 'lucide-react';
import {
  Clock,
  Package,
  Truck,
  RotateCcw,
  Percent,
  Sparkles,
  Flame,
  Zap,
  Smile,
  MinusCircle,
  Mail,
  MessageCircle,
  CheckCircle2,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { MessageProcessingStatus, Order, Ticket } from '@/src/types';
import { Sentiment, TicketStatus } from '@/src/types';
import type { ReactNode } from 'react';

export function formatSlaChipText(ticket: Ticket): string {
  if (ticket.status === TicketStatus.RESOLVED) return '已达标';
  const due = new Date(ticket.slaDueAt).getTime();
  const now = Date.now();
  if (now > due) {
    const mins = Math.max(1, Math.floor((now - due) / 60000));
    return `已超时 ${mins} 分钟`;
  }
  const remMins = Math.max(1, Math.ceil((due - now) / 60000));
  if (remMins >= 60) return `剩余 ${Math.round(remMins / 60)} 小时`;
  return `剩余 ${remMins} 分钟`;
}

export function formatSlaTooltip(ticket: Ticket): string {
  return `SLA：${formatSlaChipText(ticket)}`;
}

function slaIconStyles(ticket: Ticket): { wrap: string; icon: string } {
  if (ticket.status === TicketStatus.RESOLVED) {
    return { wrap: 'bg-green-50 border-green-200', icon: 'text-green-600' };
  }
  const due = new Date(ticket.slaDueAt).getTime();
  if (Date.now() > due) {
    return { wrap: 'bg-red-50 border-red-200', icon: 'text-red-600' };
  }
  const remMins = Math.ceil((due - Date.now()) / 60000);
  if (remMins < 60) {
    return { wrap: 'bg-orange-50 border-orange-200', icon: 'text-orange-600' };
  }
  return { wrap: 'bg-amber-50 border-amber-200', icon: 'text-amber-700' };
}

function orderPresentation(order?: Order | null): {
  label: string;
  tooltip: string;
  Icon: LucideIcon;
  wrap: string;
  icon: string;
} {
  const st = order?.orderStatus;
  switch (st) {
    case 'refunded':
      return {
        label: '已退款',
        tooltip: '订单状态：已退款',
        Icon: RotateCcw,
        wrap: 'bg-violet-50 border-violet-200',
        icon: 'text-violet-600',
      };
    case 'partial_refund':
      return {
        label: '部分退款',
        tooltip: '订单状态：部分退款',
        Icon: Percent,
        wrap: 'bg-violet-50/80 border-violet-200',
        icon: 'text-violet-600',
      };
    case 'shipped':
      return {
        label: '已发货',
        tooltip: '订单状态：已发货',
        Icon: Truck,
        wrap: 'bg-blue-50 border-blue-200',
        icon: 'text-blue-600',
      };
    case 'unshipped':
      return {
        label: '未发货',
        tooltip: '订单状态：未发货',
        Icon: Package,
        wrap: 'bg-slate-50 border-slate-200',
        icon: 'text-slate-600',
      };
    default:
      return {
        label: '未知',
        tooltip: '订单状态：未知',
        Icon: Package,
        wrap: 'bg-slate-50 border-slate-200',
        icon: 'text-slate-400',
      };
  }
}

function sentimentPresentation(s: Sentiment): {
  label: string;
  tooltip: string;
  Icon: LucideIcon;
  wrap: string;
  icon: string;
} {
  switch (s) {
    case Sentiment.ANGRY:
      return {
        label: '愤怒抱怨',
        tooltip: '用户情绪：愤怒抱怨',
        Icon: Flame,
        wrap: 'bg-red-50 border-red-200',
        icon: 'text-red-600',
      };
    case Sentiment.ANXIOUS:
      return {
        label: '焦急催促',
        tooltip: '用户情绪：焦急催促',
        Icon: Zap,
        wrap: 'bg-orange-50 border-orange-200',
        icon: 'text-orange-600',
      };
    case Sentiment.JOYFUL:
      return {
        label: '开心满意',
        tooltip: '用户情绪：开心满意',
        Icon: Smile,
        wrap: 'bg-green-50 border-green-200',
        icon: 'text-green-600',
      };
    default:
      return {
        label: '平静中性',
        tooltip: '用户情绪：平静中性',
        Icon: MinusCircle,
        wrap: 'bg-slate-50 border-slate-200',
        icon: 'text-slate-600',
      };
  }
}

function messageProcessingPresentation(
  st: MessageProcessingStatus
): { label: string; tooltip: string; Icon: LucideIcon; wrap: string; icon: string } {
  switch (st) {
    case 'unread':
      return {
        label: '未读',
        tooltip: '消息处理：未读',
        Icon: Mail,
        wrap: 'bg-indigo-50 border-indigo-200',
        icon: 'text-indigo-600',
      };
    case 'replied':
      return {
        label: '已回复',
        tooltip: '消息处理：已回复',
        Icon: CheckCircle2,
        wrap: 'bg-emerald-50 border-emerald-200',
        icon: 'text-emerald-600',
      };
    default:
      return {
        label: '未回复',
        tooltip: '消息处理：未回复',
        Icon: MessageCircle,
        wrap: 'bg-amber-50 border-amber-200',
        icon: 'text-amber-700',
      };
  }
}

export type InboxStatusIconItem = {
  key: string;
  tooltip: string;
  Icon: LucideIcon | null;
  wrap: string;
  icon: string;
};

export function buildInboxStatusIcons(ticket: Ticket, order?: Order | null): InboxStatusIconItem[] {
  const sla = slaIconStyles(ticket);
  const ord = orderPresentation(order);
  const sent = sentimentPresentation(ticket.sentiment);
  const conv = messageProcessingPresentation(ticket.messageProcessingStatus);

  return [
    {
      key: 'sla',
      tooltip: formatSlaTooltip(ticket),
      Icon: Clock,
      wrap: sla.wrap,
      icon: sla.icon,
    },
    {
      key: 'order',
      tooltip: ord.tooltip,
      Icon: ord.Icon,
      wrap: ord.wrap,
      icon: ord.icon,
    },
    {
      key: 'intent',
      tooltip: `用户意图（售后类型）：${ticket.intent || '未分类'}`,
      Icon: null,
      wrap: 'bg-purple-50 border-purple-200',
      icon: 'text-purple-600',
    },
    {
      key: 'sentiment',
      tooltip: sent.tooltip,
      Icon: sent.Icon,
      wrap: sent.wrap,
      icon: sent.icon,
    },
    {
      key: 'conv',
      tooltip: conv.tooltip,
      Icon: conv.Icon,
      wrap: conv.wrap,
      icon: conv.icon,
    },
  ];
}

/** 工单卡片：五枚状态图标，悬停见完整说明 */
export function InboxTicketStatusIcons({
  ticket,
  order,
  className,
  compact,
}: {
  ticket: Ticket;
  order?: Order | null;
  /** 默认居中；选中卡片内可传 justify-start */
  className?: string;
  /** 略小、略降饱和，减少列表里「花」感 */
  compact?: boolean;
}) {
  const items = buildInboxStatusIcons(ticket, order);
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-1 pt-1',
        compact && 'gap-0.5 pt-0',
        className
      )}
      aria-hidden={false}
    >
      {items.map((it) => (
        <span
          key={it.key}
          title={it.tooltip}
          className={cn(
            'flex items-center justify-center border shrink-0',
            compact ? 'w-6 h-6 rounded-[6px]' : 'w-7 h-7 rounded-md',
            compact && 'opacity-[0.92]',
            it.wrap
          )}
        >
          {it.Icon && (
            <it.Icon
              className={cn(compact ? 'w-3 h-3' : 'w-3.5 h-3.5', it.icon)}
              strokeWidth={compact ? 1.75 : 2}
              aria-hidden
            />
          )}
          {!it.Icon && it.key === 'intent' && (
            <span
              className={cn(
                'font-bold opacity-80',
                compact ? 'text-[9px]' : 'text-[10px]',
                it.icon
              )}
              aria-hidden
            >
              #
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function detailSlaChipClass(ticket: Ticket): string {
  if (ticket.status === TicketStatus.RESOLVED) {
    return 'bg-green-50 text-green-900 border-green-200';
  }
  const due = new Date(ticket.slaDueAt).getTime();
  if (Date.now() > due) return 'bg-red-50 text-red-900 border-red-200';
  const remMins = Math.ceil((due - Date.now()) / 60000);
  if (remMins < 60) return 'bg-orange-50 text-orange-900 border-orange-200';
  return 'bg-amber-50 text-amber-900 border-amber-200';
}

function detailOrderChipClass(order?: Order | null): string {
  const st = order?.orderStatus;
  if (st === 'refunded' || st === 'partial_refund') return 'bg-violet-50 text-violet-900 border-violet-200';
  if (st === 'shipped') return 'bg-blue-50 text-blue-900 border-blue-200';
  if (st === 'unshipped') return 'bg-slate-50 text-slate-800 border-slate-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function detailSentimentChipClass(s: Sentiment): string {
  if (s === Sentiment.ANGRY) return 'bg-red-50 text-red-900 border-red-200';
  if (s === Sentiment.ANXIOUS) return 'bg-orange-50 text-orange-900 border-orange-200';
  if (s === Sentiment.JOYFUL) return 'bg-green-50 text-green-900 border-green-200';
  return 'bg-slate-50 text-slate-800 border-slate-200';
}

function detailConvChipClass(st: MessageProcessingStatus): string {
  if (st === 'unread') return 'bg-indigo-50 text-indigo-900 border-indigo-200';
  if (st === 'replied') return 'bg-emerald-50 text-emerald-900 border-emerald-200';
  return 'bg-amber-50 text-amber-900 border-amber-200';
}

const MESSAGE_PROCESSING_SELECT: { value: MessageProcessingStatus; label: string }[] = [
  { value: 'unread', label: '未读' },
  { value: 'unreplied', label: '未回复' },
  { value: 'replied', label: '已回复' },
];

/** 与 TicketDetail「分配给坐席」下拉同一套视觉：白底、灰边框、slate 文字 */
export const detailHeaderSelectClassName =
  'w-full text-xs font-semibold border border-slate-200 rounded-lg pl-2 pr-5 py-1.5 bg-white text-slate-800 outline-none hover:border-slate-300 focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316] truncate cursor-pointer appearance-none';

/** 工单详情顶栏：会话处理状态下拉（样式与分配给坐席一致） */
export function TicketConversationStatusSelect({
  ticket,
  onChange,
  className,
  selectId,
}: {
  ticket: Ticket;
  onChange: (status: MessageProcessingStatus) => void;
  className?: string;
  selectId?: string;
}) {
  const conv = messageProcessingPresentation(ticket.messageProcessingStatus);
  return (
    <div className={cn('relative w-full min-w-0', className)} title={conv.tooltip}>
      <select
        id={selectId}
        value={ticket.messageProcessingStatus}
        onChange={(e) => onChange(e.target.value as MessageProcessingStatus)}
        className={detailHeaderSelectClassName}
        aria-label="会话状态"
      >
        {MESSAGE_PROCESSING_SELECT.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
    </div>
  );
}

/** 会话详情顶栏：五类状态完整文案 */
export function TicketDetailStatusChips({
  ticket,
  order,
  onMessageProcessingStatusChange,
  renderConversationAside = false,
  intentRefreshable = false,
  intentRefreshLoading = false,
  onIntentRefresh,
  sentimentRefreshable = false,
  sentimentRefreshLoading = false,
  onSentimentRefresh,
  renderTicketSummaryButton,
}: {
  ticket: Ticket;
  order?: Order | null;
  /** 传入时「会话」标签可点击展开系统下拉，直接修改处理状态 */
  onMessageProcessingStatusChange?: (status: MessageProcessingStatus) => void;
  /** 为 true 且同时传入 onMessageProcessingStatusChange 时，不在本行渲染「会话」控件（由顶栏右侧承载） */
  renderConversationAside?: boolean;
  /** 是否允许刷新意图分类 */
  intentRefreshable?: boolean;
  intentRefreshLoading?: boolean;
  onIntentRefresh?: () => void | Promise<void>;
  /** 是否允许刷新情绪识别 */
  sentimentRefreshable?: boolean;
  sentimentRefreshLoading?: boolean;
  onSentimentRefresh?: () => void | Promise<void>;
  /** 是否展示工单摘要按钮（如果外部传入了） */
  renderTicketSummaryButton?: ReactNode;
}) {
  const ord = orderPresentation(order);
  const sent = sentimentPresentation(ticket.sentiment);
  const conv = messageProcessingPresentation(ticket.messageProcessingStatus);
  const slaText = formatSlaChipText(ticket);

  const chips: { key: string; content: ReactNode; chip: string; title: string }[] = [
    {
      key: 'sla',
      title: 'SLA (服务级别协议)',
      chip: cn('border', detailSlaChipClass(ticket)),
      content: (
        <>
          <Clock className="w-3 h-3 shrink-0 opacity-80" />
          <span className="font-semibold">{slaText}</span>
        </>
      ),
    },
    {
      key: 'order',
      title: '订单状态',
      chip: cn('border', detailOrderChipClass(order)),
      content: (
        <>
          <ord.Icon className="w-3 h-3 shrink-0 opacity-80" />
          <span className="font-semibold">{ord.label}</span>
        </>
      ),
    },
    {
      key: 'intent',
      title: '意图分类',
      chip: 'bg-purple-50 text-purple-900 border border-purple-200',
      content: (
        <>
          <Sparkles className="w-3 h-3 shrink-0 opacity-80" />
          <span className="font-semibold">{ticket.intent || '未分类'}</span>
          {intentRefreshable ? (
            <button
              type="button"
              title="用 AI（豆包）识别意图并保存到工单"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void onIntentRefresh?.();
              }}
              disabled={intentRefreshLoading}
              className={cn(
                'inline-flex shrink-0 rounded-md p-0.5 text-purple-700 hover:bg-purple-100/90',
                'disabled:opacity-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60'
              )}
            >
              <RefreshCw
                className={cn('w-3.5 h-3.5', intentRefreshLoading && 'animate-spin')}
                strokeWidth={2}
                aria-label="刷新意图识别"
              />
            </button>
          ) : null}
        </>
      ),
    },
    {
      key: 'sentiment',
      title: '情绪识别',
      chip: cn('border', detailSentimentChipClass(ticket.sentiment)),
      content: (
        <>
          <sent.Icon className="w-3 h-3 shrink-0 opacity-80" />
          <span className="font-semibold">{sent.label}</span>
          {sentimentRefreshable ? (
            <button
              type="button"
              title="用 AI（豆包）识别情绪并保存到工单"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void onSentimentRefresh?.();
              }}
              disabled={sentimentRefreshLoading}
              className={cn(
                'inline-flex shrink-0 rounded-md p-0.5 text-slate-500 hover:bg-slate-200/80',
                'disabled:opacity-50 cursor-pointer focus:outline-none focus-visible:ring-2'
              )}
            >
              <RefreshCw
                className={cn('w-3.5 h-3.5', sentimentRefreshLoading && 'animate-spin')}
                strokeWidth={2}
                aria-label="刷新情绪识别"
              />
            </button>
          ) : null}
        </>
      ),
    },
    {
      key: 'conv',
      title: '会话处理状态',
      chip: cn('border', detailConvChipClass(ticket.messageProcessingStatus)),
      content: (
        <>
          <conv.Icon className="w-3 h-3 shrink-0 opacity-80" />
          <span className="font-semibold">{conv.label}</span>
        </>
      ),
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      {chips.map((c) => {
        if (c.key === 'conv' && renderConversationAside && onMessageProcessingStatusChange) {
          return null;
        }
        if (c.key === 'conv' && onMessageProcessingStatusChange) {
          return (
            <TicketConversationStatusSelect
              key={c.key}
              ticket={ticket}
              onChange={onMessageProcessingStatusChange}
            />
          );
        }
        return (
          <span
            key={c.key}
            title={c.title}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors hover:shadow-sm',
              (c.key === 'intent' || c.key === 'sentiment') && intentRefreshable ? 'cursor-default' : 'cursor-help',
              c.chip
            )}
          >
            {c.content}
          </span>
        );
      })}
      {renderTicketSummaryButton && renderTicketSummaryButton}
    </div>
  );
}
