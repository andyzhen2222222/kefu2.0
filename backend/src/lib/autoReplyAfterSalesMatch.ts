/**
 * 自动回复「售后类型」条件：与分配规则 / 字段管理中的 after_sales_type value 对齐，
 * 通过工单上 AI 归类后的中文 intent（ticket.intent）做集合匹配。
 */
const AFTER_SALES_VALUE_TO_INTENT_LABELS: Record<string, readonly string[]> = {
  logistics: ['物流查询', '未收到货'],
  after_sales_refund: ['退款请求', '退款进度', '换货', '重发'],
  quality: ['质量问题'],
  wrong_item: ['质量问题', '其它'],
  missing_part: ['少发漏发'],
  not_received: ['未收到货', '物流查询'],
  customer_reason: ['其它'],
  invoice: ['发票相关'],
  marketing: ['营销关怀'],
};

const PREFIX = '__after_sales_type__:';

export function parseAfterSalesTypeFromIntentMatch(intentMatch: string): string | null {
  const im = intentMatch.trim();
  if (!im.startsWith(PREFIX)) return null;
  const v = im.slice(PREFIX.length).trim();
  return v.length ? v : null;
}

/** 工单 intent（中文标签）是否属于该售后类型 value */
export function ticketIntentMatchesAfterSalesType(ticketIntent: string, afterSalesValue: string): boolean {
  const intent = ticketIntent.trim();
  if (!intent) return false;
  const labels = AFTER_SALES_VALUE_TO_INTENT_LABELS[afterSalesValue];
  if (labels?.length) return labels.includes(intent);
  return intent === afterSalesValue;
}
