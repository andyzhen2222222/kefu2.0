/**
 * 与「模板管理」页共享的本地话术库（localStorage），供工单回复「插入模版」使用。
 */
const STORAGE_KEY = 'intellidesk.templates.v1';

export type StoredReplyTemplate = {
  id: string;
  name: string;
  platform: string;
  category: string;
  categoryValue: string;
  content: string;
  languages: string[];
  updatedAt: string;
  status: 'active' | 'draft';
};

const DEFAULT_TEMPLATES: StoredReplyTemplate[] = [
  {
    id: '1',
    name: '物流延误安抚',
    platform: 'Amazon',
    category: '物流问题',
    categoryValue: 'logistics',
    content:
      'Dear {买家姓名},\n\nWe apologize for the delay on order {订单号}. Tracking: {物流单号}.\n\nBest regards,\n{店铺名称}',
    languages: ['EN', 'DE', 'FR'],
    updatedAt: '2026-03-24',
    status: 'active',
  },
  {
    id: '2',
    name: '退款确认通知',
    platform: 'All',
    category: '售后退款',
    categoryValue: 'after_sales_refund',
    content:
      'Hi {买家姓名},\n\nYour refund for order {订单号} has been processed. Thank you for your patience.\n\n{店铺名称}',
    languages: ['EN', 'ES'],
    updatedAt: '2026-03-23',
    status: 'active',
  },
  {
    id: '3',
    name: '好评邀请 (节假日)',
    platform: 'eBay',
    category: '营销关怀',
    categoryValue: 'marketing',
    content:
      'Dear {买家姓名},\n\nHappy holidays! If you enjoyed {商品名称}, we would appreciate your feedback.\n\n{店铺名称}',
    languages: ['EN'],
    updatedAt: '2026-03-20',
    status: 'draft',
  },
];

export function loadStoredReplyTemplates(): StoredReplyTemplate[] {
  if (typeof window === 'undefined') return [...DEFAULT_TEMPLATES];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_TEMPLATES];
    const parsed = JSON.parse(raw) as StoredReplyTemplate[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_TEMPLATES];
  } catch {
    return [...DEFAULT_TEMPLATES];
  }
}

export function persistStoredReplyTemplates(rows: StoredReplyTemplate[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  window.dispatchEvent(new Event('intellidesk-templates-changed'));
}

/** 工单详情「插入模版」列表项（仅 active） */
export function getActiveReplyTemplatesForPicker(): {
  id: string;
  title: string;
  category: string;
  platform: string;
  content: string;
}[] {
  return loadStoredReplyTemplates()
    .filter((t) => t.status === 'active')
    .map((t) => ({
      id: t.id,
      title: t.name,
      category: t.category,
      platform: t.platform,
      content: t.content,
    }));
}
