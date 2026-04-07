import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { TenantRequest } from '../middleware/tenant.js';
import { mapOrder } from '../dto/mappers.js';
import { fetchNezhaOrderHint } from '../services/nezhaAdapter.js';
import { syncOrderLogistics } from '../services/track17Adapter.js';
import { extractTrackingFromMotherPayload } from '../lib/motherOrderFields.js';
import { enrichOrderDtoWithNezha } from '../lib/orderNezhaEnrich.js';

const router = Router();

/** 是否在本次 GET 中同步请求母系统补全地址/单号（默认否，缩短工单详情关联路径） */
function wantsUpstreamEnrich(q: TenantRequest['query']): boolean {
  const v = q.upstreamEnrich ?? q.enrichOrder;
  return v === '1' || v === 'true';
}

/** 按平台订单号解析本库 order UUID（须注册在 /:id 之前） */
router.get('/', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const platformOrderId = (req.query.platformOrderId as string | undefined)?.trim();
  if (!platformOrderId) {
    res.status(400).json({ error: 'bad_request', message: 'Query platformOrderId is required' });
    return;
  }
  const order = await prisma.order.findFirst({
    where: { tenantId, platformOrderId },
    include: { channel: true, logisticsEvents: true },
  });
  if (!order) {
    res.status(404).json({ error: 'not_found', message: 'Order not found' });
    return;
  }
  const dto = mapOrder(order);
  res.json(wantsUpstreamEnrich(req.query) ? await enrichOrderDtoWithNezha(dto) : dto);
});

router.get('/:id', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const id = req.params.id;
  const order = await prisma.order.findFirst({
    where: { id, tenantId },
    include: { channel: true, logisticsEvents: true },
  });
  if (!order) {
    res.status(404).json({ error: 'not_found', message: 'Order not found' });
    return;
  }
  const dto = mapOrder(order);
  res.json(wantsUpstreamEnrich(req.query) ? await enrichOrderDtoWithNezha(dto) : dto);
});

router.get('/:id/logistics', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const id = req.params.id;
  const order = await prisma.order.findFirst({
    where: { id, tenantId },
    include: { logisticsEvents: true },
  });
  if (!order) {
    res.status(404).json({ error: 'not_found', message: 'Order not found' });
    return;
  }
  const events = order.logisticsEvents
    .slice()
    .sort((a, b) => b.sortIndex - a.sortIndex || b.timestamp.getTime() - a.timestamp.getTime());
  res.json({
    orderId: order.id,
    events: events.map((e) => ({
      id: e.id,
      status: e.status,
      subStatus: e.subStatus,
      description: e.description,
      location: e.location,
      timestamp: e.timestamp.toISOString(),
    })),
  });
});

router.post('/:id/logistics/sync', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const id = req.params.id;
  const order = await prisma.order.findFirst({
    where: { id, tenantId },
  });
  if (!order) {
    res.status(404).json({ error: 'not_found', message: 'Order not found' });
    return;
  }

  let tracking = (order.trackingNumber ?? '').trim();
  let carrier = order.carrier ?? null;
  if (!tracking) {
    const hint = await fetchNezhaOrderHint(order.platformOrderId);
    const neo = hint?.raw ? extractTrackingFromMotherPayload(hint.raw) : null;
    tracking = (neo?.trackingNumber ?? '').trim();
    if (neo?.carrier?.trim()) carrier = neo.carrier.trim();
  }

  if (!tracking) {
    res.status(404).json({
      error: 'not_found',
      message: 'Order or tracking number not found',
    });
    return;
  }

  if (tracking !== (order.trackingNumber ?? '').trim() || (carrier && carrier !== order.carrier)) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        trackingNumber: tracking,
        ...(carrier ? { carrier } : {}),
      },
    });
  }

  const force = req.query.force === 'true' || req.query.force === '1';
  const result = await syncOrderLogistics(order.id, tracking, force);
  if (!result.success) {
    res.status(502).json({
      error: 'sync_failed',
      message: result.message || '17track 同步失败，请稍后再试',
    });
    return;
  }

  res.json({ ok: true, message: result.message });
});

export default router;
