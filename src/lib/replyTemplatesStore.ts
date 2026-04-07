/**
 * 与「模板管理」页共享的本地话术库（localStorage），供工单回复「插入模版」使用。
 */
import { channelMatchesPlatformKeys } from '@/src/lib/routingPlatformChannel';
import { ticketIntentMatchesAfterSalesCategoryValue } from '@/src/lib/replyTemplateIntentMatch';

const STORAGE_KEY = 'intellidesk.templates.v1';

export type StoredReplyTemplate = {
  id: string;
  name: string;
  platforms: string[]; // 改为数组
  categoryValues: string[]; // 改为数组
  category?: string; // 保持兼容性
  categoryValue?: string; // 保持兼容性
  content: string;
  languages: string[];
  updatedAt: string;
  status: 'active' | 'draft';
};

const DEFAULT_TEMPLATES: StoredReplyTemplate[] = [
  {
    id: '1',
    name: '物流延误安抚',
    platforms: ['All'],
    categoryValues: ['logistics'],
    category: '物流问题',
    categoryValue: 'logistics',
    content:
      '{买家姓名} 您好，\n\n关于订单 {订单号}，物流单号 {物流单号} 目前略有延误，我们已催促承运商尽快更新。\n\n给您带来不便深表歉意，感谢理解。\n\n{店铺名称} 客服',
    languages: ['ZH'],
    updatedAt: '2026-03-24',
    status: 'active',
  },
  {
    id: '2',
    name: '退款确认通知',
    platforms: ['All'],
    categoryValues: ['after_sales_refund'],
    category: '售后退款',
    categoryValue: 'after_sales_refund',
    content:
      '{买家姓名} 您好，\n\n订单 {订单号} 的退款已处理完成，款项将按支付渠道原路退回，请您留意到账。\n\n感谢您的耐心，{店铺名称} 客服',
    languages: ['ZH'],
    updatedAt: '2026-03-23',
    status: 'active',
  },
  {
    id: '3',
    name: '好评邀请 (节假日)',
    platforms: ['All'],
    categoryValues: ['marketing'],
    category: '营销关怀',
    categoryValue: 'marketing',
    content:
      '{买家姓名} 您好，\n\n节日快乐！若您对 {商品名称} 满意，欢迎留下评价，是我们最大的动力。\n\n{店铺名称} 客服',
    languages: ['ZH'],
    updatedAt: '2026-03-20',
    status: 'active',
  },
];

export function loadStoredReplyTemplates(): StoredReplyTemplate[] {
  if (typeof window === 'undefined') return [...DEFAULT_TEMPLATES];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_TEMPLATES];
    const parsed = JSON.parse(raw) as any[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed.map((t) => ({
          ...t,
          // 兼容性处理：如果旧数据是 platform 字符串，转为数组
          platforms: Array.isArray(t.platforms)
            ? t.platforms
            : t.platform
            ? [t.platform]
            : ['All'],
          categoryValues: Array.isArray(t.categoryValues)
            ? t.categoryValues
            : t.categoryValue
            ? [t.categoryValue]
            : [],
        }))
      : [...DEFAULT_TEMPLATES];
  } catch {
    return [...DEFAULT_TEMPLATES];
  }
}

export function persistStoredReplyTemplates(rows: StoredReplyTemplate[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  window.dispatchEvent(new Event('intellidesk-templates-changed'));
}

export type ReplyTemplatePickerRow = {
  id: string;
  title: string;
  category?: string;
  categoryValue?: string;
  categoryValues: string[];
  platforms: string[];
  content: string;
};

/** 平台：含「所有平台」或与工单 platformType 匹配；售后类型：未选则通用；已选则在意图已识别时需命中其一 */
export function replyTemplatePickerRowMatchesTicket(
  row: Pick<ReplyTemplatePickerRow, 'platforms' | 'categoryValues' | 'categoryValue'>,
  ticket: { platformType?: string | null; intent?: string | null }
): boolean {
  const plats =
    Array.isArray(row.platforms) && row.platforms.length > 0 ? row.platforms : (['All'] as string[]);
  const allPlatform = plats.some((p) => String(p).trim().toLowerCase() === 'all');
  if (!allPlatform && !channelMatchesPlatformKeys(ticket.platformType ?? null, plats)) {
    return false;
  }

  const cats =
    Array.isArray(row.categoryValues) && row.categoryValues.length > 0
      ? row.categoryValues
      : row.categoryValue
      ? [row.categoryValue]
      : [];
  if (cats.length === 0) return true;

  const intent = (ticket.intent ?? '').trim();
  if (!intent) return true;

  return cats.some((c) => ticketIntentMatchesAfterSalesCategoryValue(intent, String(c).trim()));
}

/** 工单详情「插入模版」列表项（仅 active） */
export function getActiveReplyTemplatesForPicker(): ReplyTemplatePickerRow[] {
  return loadStoredReplyTemplates()
    .filter((t) => t.status === 'active')
    .map((t) => {
      const categoryValues =
        Array.isArray(t.categoryValues) && t.categoryValues.length > 0
          ? t.categoryValues
          : t.categoryValue
          ? [t.categoryValue]
          : [];
      const platforms =
        Array.isArray(t.platforms) && t.platforms.length > 0 ? t.platforms : ['All'];
      return {
        id: t.id,
        title: t.name,
        category: t.category,
        categoryValue: t.categoryValue ?? categoryValues[0],
        categoryValues,
        platforms,
        content: t.content,
      };
    });
}
