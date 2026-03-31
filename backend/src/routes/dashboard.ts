import { Router } from 'express';
import { TicketStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { TenantRequest } from '../middleware/tenant.js';

const router = Router();

const SENTIMENT_ZH: Record<string, string> = {
  angry: '愤怒抱怨',
  anxious: '焦急催促',
  neutral: '平静中性',
  joyful: '开心满意',
};

function sentimentZh(raw: string): string {
  const k = (raw || 'neutral').toLowerCase();
  return SENTIMENT_ZH[k] ?? '平静中性';
}

const ORDER_STATUS_ZH: Record<string, string> = {
  unshipped: '未发货',
  shipped: '已发货',
  refunded: '已退款',
  partial_refund: '部分退款',
  unknown: '未知',
  no_order: '无关联订单',
};

function orderStatusZh(raw: string): string {
  return ORDER_STATUS_ZH[raw] ?? raw;
}

function platformLabelFromChannel(platformType: string | null | undefined): string {
  const p = (platformType || '').toUpperCase();
  if (p === 'AMAZON') return 'Amazon';
  if (p === 'EBAY') return 'eBay';
  if (p === 'SHOPIFY') return 'Shopify';
  if (p === 'WALMART') return 'Walmart';
  return '其他';
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addMs(d: Date, ms: number) {
  return new Date(d.getTime() + ms);
}

/** 较昨日同时段：用「昨日 0 点起经过与今日相同毫秒数」作为 cutoff，统计当时仍满足条件的工单（updatedAt <= cutoff 的近似快照） */
async function snapshotCount(
  tenantId: string,
  buildWhere: object,
  cutoff: Date
): Promise<number> {
  return prisma.ticket.count({
    where: {
      tenantId,
      AND: [buildWhere, { updatedAt: { lte: cutoff } }],
    },
  });
}

function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

router.get('/inbox-metrics', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const now = new Date();
  const sod = startOfDay(now);
  const elapsed = now.getTime() - sod.getTime();
  const y0 = startOfDay(addMs(now, -86400000));
  const cutoffYesterday = addMs(y0, elapsed);

  const unreadWhere = {
    OR: [{ messageProcessingStatus: 'unread' }, { status: TicketStatus['new'] }],
  };
  const unrepliedWhere = { messageProcessingStatus: 'unreplied' };
  const repliedWhere = { messageProcessingStatus: 'replied' };
  const overdueWhereNow = {
    AND: [{ status: { not: TicketStatus.resolved } }, { slaDueAt: { lt: now } }],
  };
  const overdueWhereCutoff = (cutoff: Date) => ({
    AND: [{ status: { not: TicketStatus.resolved } }, { slaDueAt: { lt: cutoff } }],
  });

  const [curU, curUr, curR, curO, prevU, prevUr, prevR, prevO] = await Promise.all([
    prisma.ticket.count({ where: { tenantId, OR: unreadWhere.OR } }),
    prisma.ticket.count({ where: { tenantId, messageProcessingStatus: 'unreplied' } }),
    prisma.ticket.count({ where: { tenantId, messageProcessingStatus: 'replied' } }),
    prisma.ticket.count({
      where: {
        tenantId,
        status: { not: TicketStatus.resolved },
        slaDueAt: { lt: now },
      },
    }),
    snapshotCount(tenantId, unreadWhere, cutoffYesterday),
    snapshotCount(tenantId, unrepliedWhere, cutoffYesterday),
    snapshotCount(tenantId, repliedWhere, cutoffYesterday),
    snapshotCount(tenantId, overdueWhereCutoff(cutoffYesterday), cutoffYesterday),
  ]);

  const card = (current: number, previous: number) => ({
    current,
    previousSameTimeYesterday: previous,
    changePercent: changePercent(current, previous),
    periodLabel: '较昨日同时段（近似：updatedAt 快照）',
  });

  res.json({
    unread: card(curU, prevU),
    unreplied: card(curUr, prevUr),
    replied: card(curR, prevR),
    slaOverdue: card(curO, prevO),
  });
});

router.get('/structure', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const tickets = await prisma.ticket.findMany({
    where: { tenantId },
    select: {
      intent: true,
      sentiment: true,
      orderId: true,
      channel: { select: { displayName: true, platformType: true } },
    },
  });
  const orders = await prisma.order.findMany({
    where: { tenantId },
    select: { id: true, orderStatus: true },
  });
  const orderMap = new Map(orders.map((o) => [o.id, o.orderStatus]));

  const intentBuckets: Record<string, number> = {};
  const sentimentBuckets: Record<string, number> = {};
  const orderStatusBuckets: Record<string, number> = {};
  const channelBuckets: Record<string, number> = {};

  for (const t of tickets) {
    const ik = t.intent?.trim() || '未分类';
    intentBuckets[ik] = (intentBuckets[ik] ?? 0) + 1;
    const sk = sentimentZh(t.sentiment || 'neutral');
    sentimentBuckets[sk] = (sentimentBuckets[sk] ?? 0) + 1;
    const okRaw = t.orderId ? orderMap.get(t.orderId) ?? 'unknown' : 'no_order';
    const ok = orderStatusZh(okRaw);
    orderStatusBuckets[ok] = (orderStatusBuckets[ok] ?? 0) + 1;
    const ck = platformLabelFromChannel(t.channel?.platformType);
    channelBuckets[ck] = (channelBuckets[ck] ?? 0) + 1;
  }

  const toPct = (o: Record<string, number>) => {
    const total = Object.values(o).reduce((a, b) => a + b, 0) || 1;
    return Object.fromEntries(
      Object.entries(o).map(([k, v]) => [k, { count: v, percent: Math.round((v / total) * 1000) / 10 }])
    );
  };

  res.json({
    afterSalesIntent: toPct(intentBuckets),
    sentiment: toPct(sentimentBuckets),
    orderStatus: toPct(orderStatusBuckets),
    channels: toPct(channelBuckets),
  });
});

router.get('/trends', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const range = (req.query.range as string) === '30d' ? 30 : 7;
  const since = addMs(new Date(), -range * 86400000);
  const tickets = await prisma.ticket.findMany({
    where: { tenantId, createdAt: { gte: since } },
    select: { createdAt: true, status: true },
  });
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const buckets: Record<string, { tickets: number; resolved: number }> = {};
  for (const t of tickets) {
    const k = dayKey(t.createdAt);
    if (!buckets[k]) buckets[k] = { tickets: 0, resolved: 0 };
    buckets[k].tickets += 1;
    if (t.status === TicketStatus.resolved) buckets[k].resolved += 1;
  }
  const series = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, v]) => ({ name, tickets: v.tickets, resolved: v.resolved }));
  res.json({ range: `${range}d`, series });
});

export default router;
