import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { TenantRequest } from '../middleware/tenant.js';
import { mapOrder } from '../dto/mappers.js';
import { fetchNezhaOrderHint } from '../services/nezhaAdapter.js';

const router = Router();

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
  res.json(mapOrder(order));
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
  const hint = await fetchNezhaOrderHint(order.platformOrderId);
  if (hint?.raw) {
    res.json({ ...dto, nezhaSync: true as const, nezhaRaw: hint.raw });
    return;
  }
  res.json(dto);
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

export default router;
