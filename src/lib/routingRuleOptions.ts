/**
 * 工单分配规则：售后归因类型（与字段管理「售后类型」字典 value 对齐）。
 * 后端 `/api/settings/routing-rule-options` 返回同构列表，此处供离线/演示兜底。
 */
export const ROUTING_AFTER_SALES_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'logistics', label: '物流问题' },
  { value: 'after_sales_refund', label: '售后退款' },
  { value: 'quality', label: '质量问题' },
  { value: 'wrong_item', label: '发错货' },
  { value: 'missing_part', label: '少发漏发' },
  { value: 'not_received', label: '未收到货' },
  { value: 'customer_reason', label: '客户原因/不想要了' },
  { value: 'invoice', label: '发票相关' },
  { value: 'marketing', label: '营销关怀' },
];

/** 无租户渠道数据时的演示平台选项（展示名，可与历史规则 conditions.platform 兼容） */
export const ROUTING_DEMO_PLATFORM_OPTIONS: { value: string; label: string }[] = [
  { value: 'Amazon US', label: 'Amazon US' },
  { value: 'Amazon UK', label: 'Amazon UK' },
  { value: 'Amazon DE', label: 'Amazon DE' },
  { value: 'eBay', label: 'eBay' },
  { value: 'Shopify', label: 'Shopify' },
  { value: 'Walmart', label: 'Walmart' },
  { value: '__unset__', label: '未分类' },
];

/**
 * 演示用店铺 id（与旧版 mock store 字段一致）；接入 API 后由真实 Channel.id 替换。
 */
export const ROUTING_DEMO_CHANNELS: { id: string; displayName: string; platformType: string | null }[] = [
  { id: 'store_us_official', displayName: 'US Official Store', platformType: 'Amazon' },
  { id: 'store_eu_official', displayName: 'EU Official Store', platformType: 'Amazon' },
  { id: 'store_de_main', displayName: 'DE 主店', platformType: 'Amazon' },
];

export function routingAfterSalesLabel(value: string): string {
  return ROUTING_AFTER_SALES_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
