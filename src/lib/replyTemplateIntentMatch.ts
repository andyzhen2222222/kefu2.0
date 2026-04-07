import { ROUTING_AFTER_SALES_TYPE_OPTIONS } from '@/src/lib/routingRuleOptions';

/**
 * 工单 intent（多为中文标签/口语）与模板「售后类型」字典 value 的对应关系。
 * 覆盖后端 classify 允许列表、收件箱演示数据及常见口语变体。
 */
const TICKET_INTENT_TO_CATEGORY_VALUES: Record<string, string[]> = {
  物流查询: ['logistics'],
  物流咨询: ['logistics'],
  查询物流: ['logistics'],
  退款请求: ['after_sales_refund'],
  要求退款: ['after_sales_refund'],
  退货退款: ['after_sales_refund'],
  部分退款进度: ['after_sales_refund'],
  退款进度: ['after_sales_refund'],
  营销关怀: ['marketing'],
  发票相关: ['invoice'],
  索要发票: ['invoice'],
  未收到货: ['not_received'],
  少发漏发: ['missing_part'],
  质量问题: ['quality'],
  换货: ['after_sales_refund'],
  重发: ['wrong_item', 'after_sales_refund'],
  地址修改: ['logistics'],
  修改地址: ['logistics'],
  差评威胁: ['after_sales_refund', 'quality'],
  账号与优惠券: ['marketing'],
  产品咨询: [],
  其它: [],
  未分类: [],
};

/**
 * 判断当前工单的意图文案是否与某条模板售后类型 value 匹配（中英、字典标签、上表映射）。
 */
export function ticketIntentMatchesAfterSalesCategoryValue(
  ticketIntent: string,
  categoryValue: string
): boolean {
  const ti = ticketIntent.trim();
  const cv = categoryValue.trim();
  if (!ti || !cv) return false;

  if (ti === cv || ti.toLowerCase() === cv.toLowerCase()) return true;

  const opt = ROUTING_AFTER_SALES_TYPE_OPTIONS.find((o) => o.value === cv);
  if (opt) {
    if (ti === opt.label) return true;
    if (ti.includes(opt.label) || opt.label.includes(ti)) return true;
  }

  const mapped = TICKET_INTENT_TO_CATEGORY_VALUES[ti];
  if (mapped?.includes(cv)) return true;

  for (const [intentKey, values] of Object.entries(TICKET_INTENT_TO_CATEGORY_VALUES)) {
    if (values.includes(cv) && (ti === intentKey || ti.includes(intentKey))) {
      return true;
    }
  }

  return false;
}
