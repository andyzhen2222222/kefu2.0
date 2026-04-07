/**
 * 生产环境骨架数据（幂等 upsert）：
 * - 租户、管理员与财务账号、多店铺渠道、默认坐席、SLA/自动回复/路由规则
 * - 不含客户、订单、工单、消息、售后单（避免污染真实业务库）
 *
 * 可选环境变量：
 * - SEED_TENANT_DISPLAY_NAME  租户显示名（默认「生产环境」）
 * - SEED_ADMIN_DISPLAY_NAME   admin@demo.local 显示名（默认「系统管理员」）
 * - SEED_FINANCE_DISPLAY_NAME finance@demo.local 显示名（默认「财务」）
 *
 * 与全量演示种子共用 UUID（见 seed-constants.ts），便于与前端 VITE_INTELLIDESK_TENANT_ID 等对齐。
 */
import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import { SEED } from './seed-constants.js';

const prisma = new PrismaClient();

async function main() {
  const tenantName = process.env.SEED_TENANT_DISPLAY_NAME?.trim() || '生产环境';
  const adminName = process.env.SEED_ADMIN_DISPLAY_NAME?.trim() || '系统管理员';
  const financeName = process.env.SEED_FINANCE_DISPLAY_NAME?.trim() || '财务';

  await prisma.tenant.upsert({
    where: { id: SEED.tenantId },
    create: { id: SEED.tenantId, name: tenantName },
    update: { name: tenantName },
  });

  await prisma.tenantSyncSettings.upsert({
    where: { tenantId: SEED.tenantId },
    create: {
      tenantId: SEED.tenantId,
      syncEnabled: true,
      messagePollIntervalSec: 300,
      orderPollIntervalSec: 900,
      incrementalSyncDays: 90,
      useSyncWatermark: true,
      messageSyncDisabledPlatformTypes: [],
      defaultNewShopOrderBackfillMode: 'recent_days',
      defaultNewShopOrderBackfillRecentDays: 90,
      defaultNewShopTicketBackfillMode: 'recent_days',
      defaultNewShopTicketBackfillRecentDays: 90,
      skipMockTickets: true,
    },
    update: {},
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: SEED.tenantId, email: 'admin@demo.local' } },
    create: {
      id: SEED.adminUserId,
      tenantId: SEED.tenantId,
      email: 'admin@demo.local',
      name: adminName,
      role: UserRole.admin,
    },
    update: { name: adminName, role: UserRole.admin },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: SEED.tenantId, email: 'finance@demo.local' } },
    create: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0002',
      tenantId: SEED.tenantId,
      email: 'finance@demo.local',
      name: financeName,
      role: UserRole.finance,
    },
    update: { name: financeName, role: UserRole.finance },
  });

  await prisma.channel.upsert({
    where: { id: SEED.channelAmazonUs },
    create: {
      id: SEED.channelAmazonUs,
      tenantId: SEED.tenantId,
      displayName: 'Amazon US',
      platformType: 'AMAZON',
      region: 'US',
      defaultSlaHours: 24,
    },
    update: { displayName: 'Amazon US' },
  });

  await prisma.channel.upsert({
    where: { id: SEED.channelAmazonOutlet },
    create: {
      id: SEED.channelAmazonOutlet,
      tenantId: SEED.tenantId,
      displayName: 'Amazon US Outlet',
      platformType: 'AMAZON',
      region: 'US',
      defaultSlaHours: 48,
    },
    update: { displayName: 'Amazon US Outlet' },
  });

  await prisma.channel.upsert({
    where: { id: SEED.channelAmazonDe },
    create: {
      id: SEED.channelAmazonDe,
      tenantId: SEED.tenantId,
      displayName: 'Amazon DE',
      platformType: 'AMAZON',
      region: 'DE',
      defaultSlaHours: 24,
    },
    update: { displayName: 'Amazon DE' },
  });

  await prisma.channel.upsert({
    where: { id: SEED.channelEbayUk },
    create: {
      id: SEED.channelEbayUk,
      tenantId: SEED.tenantId,
      displayName: 'eBay UK',
      platformType: 'EBAY',
      region: 'UK',
      defaultSlaHours: 36,
    },
    update: { displayName: 'eBay UK' },
  });

  await prisma.channel.upsert({
    where: { id: SEED.channelShopify },
    create: {
      id: SEED.channelShopify,
      tenantId: SEED.tenantId,
      displayName: 'Shopify Main Store',
      platformType: 'SHOPIFY',
      region: 'GLOBAL',
      defaultSlaHours: 12,
    },
    update: { displayName: 'Shopify Main Store' },
  });

  await prisma.agentSeat.upsert({
    where: { id: SEED.seat1 },
    create: {
      id: SEED.seat1,
      tenantId: SEED.tenantId,
      displayName: '默认坐席',
      email: 'agent@company.local',
      account: 'agent',
      roleId: 'default',
      status: 'active',
    },
    update: {
      displayName: '默认坐席',
      status: 'active',
    },
  });

  await prisma.slaRule.upsert({
    where: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001' },
    create: {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001',
      tenantId: SEED.tenantId,
      name: '默认 Amazon SLA',
      channelPattern: 'Amazon',
      warningHours: 4,
      timeoutHours: 24,
      enabled: true,
    },
    update: {},
  });

  await prisma.autoReplyRule.upsert({
    where: { id: 'cccccccc-cccc-4ccc-8ccc-000000000001' },
    create: {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000001',
      tenantId: SEED.tenantId,
      name: '物流自动回复（默认关闭）',
      enabled: false,
      intentMatch: '物流查询',
      keywords: ['物流', 'tracking'],
      replyContent: '您好，我们正在为您查询物流信息，请稍候。',
      markRepliedOnSend: true,
    },
    update: {
      replyContent: '您好，我们正在为您查询物流信息，请稍候。',
    },
  });

  await prisma.ticketRoutingRule.upsert({
    where: { id: 'dddddddd-dddd-4ddd-8ddd-000000000001' },
    create: {
      id: 'dddddddd-dddd-4ddd-8ddd-000000000001',
      tenantId: SEED.tenantId,
      name: 'Amazon US 店铺 → 默认坐席',
      priority: 10,
      conditions: {
        platformTypes: ['AMAZON'],
        channelIds: [SEED.channelAmazonUs],
        afterSalesTypes: [],
      },
      targetSeatId: SEED.seat1,
      enabled: true,
    },
    update: {
      name: 'Amazon US 店铺 → 默认坐席',
      targetSeatId: SEED.seat1,
      conditions: {
        platformTypes: ['AMAZON'],
        channelIds: [SEED.channelAmazonUs],
        afterSalesTypes: [],
      },
    },
  });

  console.log('[seed-production] OK — 骨架已就绪（无工单/订单）。');
  console.log(`  X-Tenant-Id: ${SEED.tenantId}`);
  console.log(`  X-User-Id: ${SEED.adminUserId} (admin@demo.local)`);
  console.log('  需要演示级工单/订单请使用: npm run db:seed');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
