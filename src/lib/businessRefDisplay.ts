import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale/zh-CN';
import { AfterSalesType, type Ticket } from '@/src/types';
import { platformGroupLabelForTicket } from '@/src/lib/platformLabels';

const AFTER_TYPE_LABEL: Record<AfterSalesType, string> = {
  [AfterSalesType.REFUND]: '退款',
  [AfterSalesType.RETURN]: '退货',
  [AfterSalesType.EXCHANGE]: '换货',
  [AfterSalesType.REISSUE]: '重发',
};

/** 去掉平台前缀后的店铺/站点片段；与平台完全相同时返回「主店」占位（由调用方决定是否省略） */
export function shortenShopSegment(channelId: string, platformLabel: string): string {
  const c = channelId.trim();
  const p = platformLabel.trim();
  if (!c) return '—';
  const pl = p.toLowerCase();
  const cl = c.toLowerCase();
  if (pl && cl === pl) return '主店';
  if (pl && (cl.startsWith(`${pl} `) || cl.startsWith(`${pl}-`))) {
    const rest = c.slice(p.length).trim().replace(/^[-\s]+/, '');
    return rest || '主店';
  }
  return c;
}

export function ellipsizeLabel(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(1, max - 1))}…`;
}

/**
 * 从原始 id 取短后缀：UUID → 去横线后末 4 位；AS-8291 / T-1001 → 数字段；其它 → 尾部若干字符。
 */
export function readableIdTail(rawId: string, uuidTailLen = 4): string {
  const m = rawId.match(/^[A-Za-z]+-([\d]+)$/);
  if (m) return m[1];
  const compact = rawId.replace(/-/g, '');
  if (/^[a-f0-9]{8,}$/i.test(compact)) {
    return compact.slice(-uuidTailLen).toLowerCase();
  }
  if (rawId.length <= 10) return rawId;
  return compact.slice(-6);
}

/** 取可见字符前 2 位（兼容中文与代理对） */
function leadingTwoChars(s: string): string {
  const t = s.trim();
  if (!t) return '';
  return Array.from(t).slice(0, 2).join('');
}

function formatMonthDayCn(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  return format(d, 'M月d日', { locale: zhCN });
}

/**
 * 工单可读编号：平台(前2字)·店铺(前2字)·月日·短后缀（hover 用 title 展示完整 id）。
 */
export function formatTicketReadableRef(ticket: Ticket): string {
  const platformFull = platformGroupLabelForTicket(ticket.platformType, ticket.channelId);
  const platform = leadingTwoChars(platformFull);
  const seg = shortenShopSegment(ticket.channelId, platformFull);
  const shop =
    seg && seg !== '—' && seg !== '主店' ? leadingTwoChars(seg) : '';
  const dateStr = formatMonthDayCn(ticket.createdAt);
  const tail = readableIdTail(ticket.id);
  return [platform, shop, dateStr, tail].filter(Boolean).join('·');
}

export type AfterSalesReadableOpts = {
  channelId?: string | null;
  platformType?: string | null;
  type: AfterSalesType;
  createdAt: string;
  rawId: string;
};

/**
 * 售后可读单号：平台(前2字)·店铺(前2字)·类型·月日（无店铺上下文时：类型·月日·短后缀）。
 */
export function formatAfterSalesReadableLabel(opts: AfterSalesReadableOpts): string {
  const typeLabel = AFTER_TYPE_LABEL[opts.type] ?? String(opts.type);
  const dateStr = formatMonthDayCn(opts.createdAt);
  const ch = (opts.channelId || '').trim();
  if (!ch) {
    return `${typeLabel}·${dateStr}·${readableIdTail(opts.rawId)}`;
  }
  const platformFull = platformGroupLabelForTicket(opts.platformType ?? null, ch);
  const platform = leadingTwoChars(platformFull);
  const seg = shortenShopSegment(ch, platformFull);
  const shop =
    seg && seg !== '—' && seg !== '主店' ? leadingTwoChars(seg) : '';
  return [platform, shop, typeLabel, dateStr].filter(Boolean).join('·');
}

/**
 * 仅有工单 id、无 Ticket 对象时（如售后列表「关联工单」）：UUID 显示为「工单·xxxx」，其余尽量保留可读形态。
 */
export function formatTicketIdDisplayFallback(rawId: string): string {
  const compact = rawId.replace(/-/g, '');
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(rawId.trim())) {
    return `工单·${readableIdTail(rawId)}`;
  }
  if (/^[a-f0-9]{8,}$/i.test(compact)) {
    return `工单·${compact.slice(-4).toLowerCase()}`;
  }
  return rawId;
}
