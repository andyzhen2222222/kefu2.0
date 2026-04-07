import { Router } from 'express';
import {
  syncChannelsFromMotherSystem,
  syncOrdersFromMotherSystem,
  syncConversationsFromMotherSystem,
  syncMessagesFromMotherSystem,
  syncInvoiceEntitiesFromMotherSystem,
  syncInboxRefreshFromMotherSystem,
  syncSingleOrderByPlatformOrderId,
  backfillNezhaMessagesForEmptyTickets,
  MOTHER_SYNC_MAX_DAYS,
} from '../services/motherSystemSync.js';
import { batchEnrichTicketIntentSentiment } from '../services/ticketBatchAi.js';
import { generateMockTicketsForChannels } from '../services/mockTicketGenerator.js';
import { prisma } from '../lib/prisma.js';
import type { TenantRequest } from '../middleware/tenant.js';
import { ensureTenantSyncSettings } from '../lib/tenantSyncSettings.js';

import { INBOX_REFRESH_SCOPE, getScopedSyncStartDate, touchScopedSyncWatermark } from '../lib/syncWatermark.js';

const router = Router();

/** 单次拉取时间窗口：默认且最大见 MOTHER_SYNC_MAX_DAYS；会话/消息按母系统最近活动时间 + updateTime 参数对齐该窗口 */
function parseSyncWindowDays(bodyDays: unknown): number {
  const raw = parseInt(String(bodyDays ?? MOTHER_SYNC_MAX_DAYS), 10);
  if (!Number.isFinite(raw) || raw < 1) return MOTHER_SYNC_MAX_DAYS;
  return Math.min(MOTHER_SYNC_MAX_DAYS, Math.floor(raw));
}

/** 请求体 token 优先；未传时使用服务端环境变量 NEZHA_API_TOKEN（见 backend/.env） */
function resolveMotherToken(bodyToken: unknown): string {
  const fromBody = typeof bodyToken === 'string' ? bodyToken.trim() : '';
  if (fromBody) return fromBody;
  return process.env.NEZHA_API_TOKEN?.trim() || '';
}

router.post('/mother-system', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const token = resolveMotherToken(req.body.token);
  const days = parseSyncWindowDays(req.body.days);
  const clearExisting = req.body.clearExisting === true;
  const incremental = req.body.incremental !== false;
  const tenantSync = await ensureTenantSyncSettings(tenantId);
  const skipMockTickets =
    typeof req.body.skipMockTickets === 'boolean'
      ? req.body.skipMockTickets
      : tenantSync.skipMockTickets;

  if (!token) {
    res.status(400).json({ error: 'bad_request', message: 'token is required' });
    return;
  }

  try {
    if (clearExisting) {
      // 级联清理当前租户的所有业务数据
      await prisma.afterSalesRecord.deleteMany({ where: { tenantId } });
      await prisma.message.deleteMany({ where: { ticket: { tenantId } } });
      await prisma.ticket.deleteMany({ where: { tenantId } });
      await prisma.order.deleteMany({ where: { tenantId } });
      await prisma.customer.deleteMany({ where: { tenantId } });
      await prisma.channel.deleteMany({ where: { tenantId } });
    }

    // 1. 同步店铺（含 platform-site 货币/语言）
    const channelsSynced = await syncChannelsFromMotherSystem(tenantId, token);

    // 1b. 发票：automation 店铺主体 + VAT 页 → Channel.invoiceStoreEntity
    let invoiceEntitiesSynced = 0;
    let invoiceEntitiesSyncStats: Awaited<ReturnType<typeof syncInvoiceEntitiesFromMotherSystem>> | null = null;
    try {
      invoiceEntitiesSyncStats = await syncInvoiceEntitiesFromMotherSystem(tenantId, token);
      invoiceEntitiesSynced = invoiceEntitiesSyncStats.updated;
    } catch (e) {
      console.warn('[sync] invoice entities:', e);
    }

    // 2. 同步日期（支持水位线）
    const startDate = await getScopedSyncStartDate(tenantId, INBOX_REFRESH_SCOPE, days, incremental);

    // 3. 同步订单 (先同步订单，以便后续会话匹配)
    const ordersSynced = await syncOrdersFromMotherSystem(tenantId, token, startDate);

    // 4. 同步真实会话和消息
    let convsSynced = 0;
    let msgsSynced = 0;
    try {
      convsSynced = await syncConversationsFromMotherSystem(tenantId, token, startDate);
      msgsSynced = await syncMessagesFromMotherSystem(tenantId, token, startDate);
      
      if (incremental) {
        await touchScopedSyncWatermark(tenantId, INBOX_REFRESH_SCOPE);
      }
    } catch (e: any) {
      console.error('Real conversation/message sync failed:', e);
    }

    let messageBackfill = { ticketsTried: 0, messagesImported: 0 };
    try {
      messageBackfill = await backfillNezhaMessagesForEmptyTickets(tenantId, token, 80);
    } catch (e) {
      console.warn('[sync/mother-system] message backfill:', e);
    }

    // 5. 未拉到真实会话时默认生成演示工单；skipMockTickets 时跳过（仅保留母系统数据）
    let mockTicketsGenerated = 0;
    if (convsSynced === 0 && !skipMockTickets) {
      mockTicketsGenerated = await generateMockTicketsForChannels(tenantId, 3);
    }

    res.json({
      success: true,
      channelsSynced,
      invoiceEntitiesSynced,
      invoiceEntitiesSyncStats,
      ordersSynced,
      convsSynced,
      msgsSynced,
      messageBackfill,
      mockTicketsGenerated,
    });
  } catch (error: any) {
    console.error('Mother System Sync Error:', error);
    res.status(500).json({
      error: 'sync_failed',
      message: error.message || String(error)
    });
  }
});

/**
 * 收件箱：刷新母系统会话 + 消息（状态/主题/处理状态等），可选批量 AI 意图+情绪
 * body: { token, days?, incremental? (默认 true；false 时整窗重拉并忽略收件箱水位), runAi?, aiMax? }
 */
router.post('/inbox-tickets', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const token = resolveMotherToken(req.body.token);
  const tenantSync = await ensureTenantSyncSettings(tenantId);
  const days = parseSyncWindowDays(req.body.days ?? tenantSync.incrementalSyncDays);
  const incremental = req.body.incremental !== false;
  const useSyncWatermark =
    typeof req.body.useSyncWatermark === 'boolean' ? req.body.useSyncWatermark : tenantSync.useSyncWatermark;
  const runAi = req.body.runAi !== false;
  const aiMax = Math.min(100, Math.max(1, parseInt(String(req.body.aiMax ?? '30'), 10) || 30));

  if (!token) {
    res.status(400).json({ error: 'bad_request', message: 'token is required' });
    return;
  }

  try {
    const { ordersSynced, conversationsSynced, messagesSynced } = await syncInboxRefreshFromMotherSystem(
      tenantId,
      token,
      days,
      { incremental, useSyncWatermark }
    );
    let messageBackfill = { ticketsTried: 0, messagesImported: 0 };
    try {
      messageBackfill = await backfillNezhaMessagesForEmptyTickets(tenantId, token, 80);
    } catch (e) {
      console.warn('[sync/inbox-tickets] message backfill:', e);
    }
    let aiUpdated = 0;
    let aiFailed = 0;
    let aiSkippedNoLlm = 0;
    if (runAi) {
      const ai = await batchEnrichTicketIntentSentiment(tenantId, aiMax);
      aiUpdated = ai.updated;
      aiFailed = ai.failed;
      aiSkippedNoLlm = ai.skippedNoLlm;
    }
    res.json({
      success: true,
      days,
      incremental,
      useSyncWatermark,
      ordersSynced,
      conversationsSynced,
      messagesSynced,
      messageBackfill,
      aiUpdated,
      aiFailed,
      aiSkippedNoLlm,
    });
  } catch (error: any) {
    console.error('Inbox tickets sync error:', error);
    res.status(500).json({
      error: 'sync_failed',
      message: error.message || String(error),
    });
  }
});

/** 按平台订单号从母系统回源并 upsert 本地订单（需店铺已同步为 Channel） */
router.post('/order-by-platform-id', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const token = resolveMotherToken(req.body.token);
  const platformOrderId =
    typeof req.body.platformOrderId === 'string'
      ? req.body.platformOrderId.trim()
      : typeof req.body.platform_order_id === 'string'
        ? req.body.platform_order_id.trim()
        : '';

  if (!token) {
    res.status(400).json({ error: 'bad_request', message: 'token is required' });
    return;
  }
  if (!platformOrderId) {
    res.status(400).json({ error: 'bad_request', message: 'platformOrderId is required' });
    return;
  }

  try {
    const out = await syncSingleOrderByPlatformOrderId(tenantId, token, platformOrderId);
    if (!out.ok) {
      res.status(out.reason === 'not_found_upstream' ? 404 : 400).json({
        success: false,
        ...out,
      });
      return;
    }
    res.json({ success: true, ...out });
  } catch (error: any) {
    console.error('Order-by-platform-id sync error:', error);
    res.status(500).json({
      error: 'sync_failed',
      message: error.message || String(error),
    });
  }
});

/** 仅同步 Channel.invoiceStoreEntity（母系统店铺主体 + VAT），不拉订单/工单 */
router.post('/invoice-entities', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const token = resolveMotherToken(req.body.token);

  if (!token) {
    res.status(400).json({ error: 'bad_request', message: 'token is required' });
    return;
  }

  try {
    const stats = await syncInvoiceEntitiesFromMotherSystem(tenantId, token);
    res.json({
      success: true,
      invoiceEntitiesSynced: stats.updated,
      invoiceEntitiesSyncStats: stats,
    });
  } catch (error: any) {
    console.error('Invoice entities sync error:', error);
    res.status(500).json({
      error: 'sync_failed',
      message: error.message || String(error),
    });
  }
});

export default router;