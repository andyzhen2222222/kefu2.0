import type { Ticket } from '@/src/types';
import { platformGroupLabelForTicket } from '@/src/lib/platformLabels';

/**
 * 演示：各平台「店铺套餐」到期时间（ISO）。未列出的平台视为未到期。
 * 联调时可改为从母系统/配置接口拉取。
 */
const DEMO_PLATFORM_PLAN_EXPIRES_AT: Partial<Record<string, string>> = {
  eBay: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  Amazon: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  Shopify: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

export function isPlatformPlanExpired(platformKey: string): boolean {
  const iso = DEMO_PLATFORM_PLAN_EXPIRES_AT[platformKey];
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

/** 从当前工单集合提取去重后的平台分组键（与列表「平台」下拉一致） */
export function uniquePlatformKeysFromTickets(tickets: Ticket[]): string[] {
  const s = new Set<string>();
  tickets.forEach((t) => {
    s.add(platformGroupLabelForTicket(t.platformType, t.channelId));
  });
  return [...s].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

export function ticketPassesPlatformPlan(ticket: Ticket): boolean {
  const p = platformGroupLabelForTicket(ticket.platformType, ticket.channelId);
  return !isPlatformPlanExpired(p);
}
