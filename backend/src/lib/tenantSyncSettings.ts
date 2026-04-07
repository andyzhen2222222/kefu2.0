import type { TenantSyncSettings } from '@prisma/client';
import { prisma } from './prisma.js';

/** 保证租户有一条同步设置（首次访问时创建） */
export async function ensureTenantSyncSettings(tenantId: string): Promise<TenantSyncSettings> {
  const existing = await prisma.tenantSyncSettings.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return prisma.tenantSyncSettings.create({
    data: {
      tenantId,
      syncEnabled: true,
      messagePollIntervalSec: 300,
      orderPollIntervalSec: 900,
      incrementalSyncDays: 90,
      useSyncWatermark: true,
      messageSyncDisabledPlatformTypes: [],
      defaultNewShopOrderBackfillMode: 'recent_days',
      defaultNewShopOrderBackfillFrom: null,
      defaultNewShopOrderBackfillRecentDays: 90,
      defaultNewShopTicketBackfillMode: 'recent_days',
      defaultNewShopTicketBackfillFrom: null,
      defaultNewShopTicketBackfillRecentDays: 90,
      skipMockTickets: true,
    },
  });
}

export function syncMessagesEnabledForPlatform(
  settings: Pick<TenantSyncSettings, 'messageSyncDisabledPlatformTypes'>,
  platformType: string | null | undefined
): boolean {
  const blocked = settings.messageSyncDisabledPlatformTypes ?? [];
  if (blocked.length === 0) return true;
  const key = platformType?.trim() ? platformType.trim() : '__unset__';
  return !blocked.includes(key);
}
