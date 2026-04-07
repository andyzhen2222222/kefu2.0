import type { TicketRoutingRule } from '@/src/types';

/**
 * 与 backend/src/lib/ticketRoutingAssign.ts 中
 * routingConditionsSpecificityScore + sortTicketRoutingRulesForEvaluation 保持一致。
 */
export function ticketRoutingRuleSpecificityScore(rule: Pick<TicketRoutingRule, 'platformTypes' | 'channelIds' | 'afterSalesTypes'>): number {
  const hasPt = rule.platformTypes.length > 0;
  const hasCh = rule.channelIds.length > 0;
  const hasAst = rule.afterSalesTypes.length > 0;
  return (hasPt ? 2 : 0) + (hasCh ? 4 : 0) + (hasAst ? 1 : 0);
}

  /** 列表与指派遍历顺序一致 */
export function compareTicketRoutingRulesForEvaluation(a: TicketRoutingRule, b: TicketRoutingRule): number {
  const sb = ticketRoutingRuleSpecificityScore(b) - ticketRoutingRuleSpecificityScore(a);
  if (sb !== 0) return sb;
  // Use priority as a hidden fallback to ensure a stable sort if specificity is identical
  if (a.priority !== b.priority) return a.priority - b.priority;
  const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
  const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
  if (ta !== tb) return ta - tb;
  return a.id.localeCompare(b.id);
}

export function sortTicketRoutingRulesForDisplay(rules: TicketRoutingRule[]): TicketRoutingRule[] {
  return [...rules].sort(compareTicketRoutingRulesForEvaluation);
}
