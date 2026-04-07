import { prisma } from './prisma.js';

/** 收件箱手动刷新 / 定时消息任务：会话与消息共用起点 */
export const INBOX_REFRESH_SCOPE = 'inbox_refresh';

/** 订单增量轮询水位 */
export const ORDER_INCREMENTAL_SCOPE = 'order_incremental';

/** 定时任务上次执行时间（消息） */
export const SCHEDULED_MESSAGE_SCOPE = 'scheduled_message';

/** 定时任务上次执行时间（订单） */
export const SCHEDULED_ORDER_SCOPE = 'scheduled_order';

const OVERLAP_MS = 15 * 60 * 1000;

/**
 * 计算本次同步的起始时间：
 * - 无历史水位：自 now - days 起；
 * - 有水位：自 max(now - days, lastWatermark - 15min) 起。
 */
export async function getScopedSyncStartDate(
  tenantId: string,
  scope: string,
  days: number,
  useWatermark: boolean
): Promise<Date> {
  const floor = new Date();
  floor.setDate(floor.getDate() - Math.max(1, Math.floor(days)));

  if (!useWatermark) return floor;

  const row = await prisma.tenantSyncState.findUnique({
    where: {
      tenantId_scope: { tenantId, scope },
    },
    select: { lastWatermarkAt: true },
  });
  if (!row?.lastWatermarkAt) return floor;

  const overlap = new Date(row.lastWatermarkAt.getTime() - OVERLAP_MS);
  return new Date(Math.max(floor.getTime(), overlap.getTime()));
}

export async function touchScopedSyncWatermark(tenantId: string, scope: string): Promise<void> {
  const now = new Date();
  await prisma.tenantSyncState.upsert({
    where: {
      tenantId_scope: { tenantId, scope },
    },
    create: {
      tenantId,
      scope,
      lastWatermarkAt: now,
    },
    update: { lastWatermarkAt: now },
  });
}

/** @deprecated 使用 getScopedSyncStartDate(tenantId, INBOX_REFRESH_SCOPE, ...) */
export async function getInboxSyncStartDate(
  tenantId: string,
  days: number,
  useWatermark: boolean
): Promise<Date> {
  return getScopedSyncStartDate(tenantId, INBOX_REFRESH_SCOPE, days, useWatermark);
}

export async function touchInboxSyncWatermark(tenantId: string): Promise<void> {
  return touchScopedSyncWatermark(tenantId, INBOX_REFRESH_SCOPE);
}
