import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { AfterSalesType, AfterSalesStatus, AfterSalesPriority } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { TenantRequest } from '../middleware/tenant.js';
import { mapAfterSales } from '../dto/mappers.js';
import { UserRole } from '@prisma/client';

const router = Router();

const createBody = z.object({
  orderId: z.string().uuid(),
  /** 可选：不传则按订单查找最近工单，若无则自动创建一条关联工单 */
  ticketId: z.string().uuid().optional(),
  type: z.nativeEnum(AfterSalesType),
  status: z.nativeEnum(AfterSalesStatus).optional(),
  priority: z.nativeEnum(AfterSalesPriority).optional(),
  handlingMethod: z.string().optional(),
  problemType: z.string().optional(),
  buyerFeedback: z.string().min(1),
  refundAmount: z.number().optional(),
  refundReason: z.string().optional(),
  returnTrackingNumber: z.string().optional(),
  returnCarrier: z.string().optional(),
  reissueSku: z.string().optional(),
  reissueQuantity: z.number().int().optional(),
});

const patchBody = z
  .object({
    status: z.nativeEnum(AfterSalesStatus).optional(),
    priority: z.nativeEnum(AfterSalesPriority).optional(),
    handlingMethod: z.string().optional(),
    problemType: z.string().optional(),
    buyerFeedback: z.string().optional(),
    refundAmount: z.number().nullable().optional(),
    refundReason: z.string().nullable().optional(),
    returnTrackingNumber: z.string().nullable().optional(),
    returnCarrier: z.string().nullable().optional(),
    reissueSku: z.string().nullable().optional(),
    reissueQuantity: z.number().int().nullable().optional(),
  })
  .strict();

router.get('/', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const ticketId = req.query.ticketId as string | undefined;
  const orderId = req.query.orderId as string | undefined;
  const rows = await prisma.afterSalesRecord.findMany({
    where: {
      tenantId,
      ...(ticketId ? { ticketId } : {}),
      ...(orderId ? { orderId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(rows.map(mapAfterSales));
});

router.post('/', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const body = createBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'bad_request', message: body.error.flatten().toString() });
    return;
  }

  const order = await prisma.order.findFirst({
    where: { id: body.data.orderId, tenantId },
  });
  if (!order) {
    res.status(404).json({ error: 'not_found', message: 'Order not found' });
    return;
  }
  if (order.orderStatus === 'refunded') {
    res.status(400).json({
      error: 'invalid_order',
      message: 'Cannot create after-sales for refunded order',
    });
    return;
  }

  let resolvedTicketId = body.data.ticketId;
  if (resolvedTicketId) {
    const ticket = await prisma.ticket.findFirst({
      where: { id: resolvedTicketId, tenantId },
    });
    if (!ticket) {
      res.status(404).json({ error: 'not_found', message: 'Ticket not found' });
      return;
    }
    if (ticket.orderId && ticket.orderId !== body.data.orderId) {
      res.status(400).json({
        error: 'ticket_order_mismatch',
        message: '工单与订单不匹配',
      });
      return;
    }
  } else {
    const linked = await prisma.ticket.findFirst({
      where: { tenantId, orderId: body.data.orderId },
      orderBy: { updatedAt: 'desc' },
    });
    if (linked) {
      resolvedTicketId = linked.id;
    } else {
      const created = await prisma.ticket.create({
        data: {
          id: randomUUID(),
          tenantId,
          channelId: order.channelId,
          customerId: order.customerId,
          orderId: order.id,
          subject: `售后登记 · 订单 ${order.platformOrderId}`,
          slaDueAt: new Date(Date.now() + 48 * 3600000),
        },
      });
      resolvedTicketId = created.id;
    }
  }

  if (body.data.refundAmount != null) {
    const amt = body.data.refundAmount;
    if (amt > Number(order.amount)) {
      res.status(400).json({
        error: 'refund_exceeds_order',
        message: 'Refund amount cannot exceed order total',
      });
      return;
    }
  }

  const rec = await prisma.afterSalesRecord.create({
    data: {
      id: randomUUID(),
      tenantId,
      orderId: body.data.orderId,
      ticketId: resolvedTicketId,
      type: body.data.type,
      status: body.data.status ?? AfterSalesStatus.submitted,
      priority: body.data.priority ?? AfterSalesPriority.medium,
      handlingMethod: body.data.handlingMethod ?? '',
      problemType: body.data.problemType ?? '',
      buyerFeedback: body.data.buyerFeedback,
      refundAmount: body.data.refundAmount,
      refundReason: body.data.refundReason,
      returnTrackingNumber: body.data.returnTrackingNumber,
      returnCarrier: body.data.returnCarrier,
      reissueSku: body.data.reissueSku,
      reissueQuantity: body.data.reissueQuantity,
    },
  });

  res.status(201).json(mapAfterSales(rec));
});

router.get('/:id', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const row = await prisma.afterSalesRecord.findFirst({
    where: { id: req.params.id, tenantId },
  });
  if (!row) {
    res.status(404).json({ error: 'not_found', message: 'Not found' });
    return;
  }
  res.json(mapAfterSales(row));
});

router.patch('/:id', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const body = patchBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'bad_request', message: body.error.flatten().toString() });
    return;
  }

  const existing = await prisma.afterSalesRecord.findFirst({
    where: { id: req.params.id, tenantId },
    include: { order: true },
  });
  if (!existing) {
    res.status(404).json({ error: 'not_found', message: 'Not found' });
    return;
  }

  const financeComplete =
    body.data.status === AfterSalesStatus.completed &&
    existing.type === AfterSalesType.refund &&
    existing.status !== AfterSalesStatus.completed;
  if (financeComplete) {
    const uid = req.userId;
    if (!uid) {
      res.status(401).json({
        error: 'missing_user',
        message: 'X-User-Id required to complete refund',
      });
      return;
    }
    const u = await prisma.user.findFirst({ where: { id: uid, tenantId } });
    const allowed = new Set<UserRole>([UserRole.finance, UserRole.admin, UserRole.operations]);
    const ok = u && allowed.has(u.role);
    if (!ok) {
      res.status(403).json({
        error: 'forbidden',
        message: '需要 finance / admin / operations 角色完成退款类售后',
      });
      return;
    }
  }

  if (body.data.refundAmount != null && body.data.refundAmount > Number(existing.order.amount)) {
    res.status(400).json({
      error: 'refund_exceeds_order',
      message: 'Refund amount cannot exceed order total',
    });
    return;
  }

  const wasCompleted = existing.status === AfterSalesStatus.completed;
  const becomesCompleted = body.data.status === AfterSalesStatus.completed;
  const rec = await prisma.afterSalesRecord.update({
    where: { id: existing.id },
    data: body.data as object,
  });

  if (!wasCompleted && becomesCompleted && existing.type === AfterSalesType.refund) {
    await prisma.order.update({
      where: { id: existing.orderId },
      data: { orderStatus: 'refunded', refundStatus: 'Full' },
    });
  }

  res.json(mapAfterSales(rec));
});

export default router;
