import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { AfterSalesType, AfterSalesStatus, AfterSalesPriority } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  computeAssignedSeatForChannelId,
  findTicketIfVisible,
} from '../lib/ticketRoutingAssign.js';
import { computeSlaDueAtForTicket } from '../lib/slaCompute.js';
import type { TenantRequest } from '../middleware/tenant.js';
import { mapAfterSales } from '../dto/mappers.js';
import { UserRole } from '@prisma/client';
import { refundOrderInMotherSystem } from '../services/motherSystemRefund.js';

/** 母系统 Bearer：优先请求头，其次服务端 NEZHA_API_TOKEN（与同步接口一致） */
function motherSystemAuthHeader(req: TenantRequest): string | null {
  const h = req.headers.authorization?.trim();
  if (h) return h;
  const t = process.env.NEZHA_API_TOKEN?.trim();
  if (!t) return null;
  return t.startsWith('Bearer ') ? t : `Bearer ${t}`;
}

const router = Router();

const afterSalesListInclude = {
  ticket: {
    include: {
      channel: {
        select: { displayName: true, platformType: true },
      },
    },
  },
  order: {
    include: {
      channel: {
        select: { displayName: true, platformType: true },
      },
    },
  },
} as const;

const createBody = z.object({
  orderId: z.string().uuid(),
  /** 可选：不传则按订单查找最近工单，若无则自动创建一条关联工单 */
  ticketId: z.string().uuid().optional(),
  type: z.nativeEnum(AfterSalesType),
  status: z.nativeEnum(AfterSalesStatus).optional(),
  priority: z.nativeEnum(AfterSalesPriority).optional(),
  handlingMethod: z.string().optional(),
  problemType: z.string().optional(),
  buyerFeedback: z.string().optional(),
  refundAmount: z.number().optional(),
  refundReason: z.string().optional(),
  returnTrackingNumber: z.string().optional(),
  returnCarrier: z.string().optional(),
  reissueSku: z.string().optional(),
  reissueQuantity: z.number().int().optional(),
  refundExecutionType: z.enum(['manual', 'api']).optional(),
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
    include: afterSalesListInclude,
  });
  res.json(rows.map(mapAfterSales));
});

router.post('/', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const body = createBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'bad_request', message: JSON.stringify(body.error.flatten().fieldErrors) });
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
    const ticket = await findTicketIfVisible(tenantId, resolvedTicketId, req.userId);
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
    const linkedCandidates = await prisma.ticket.findMany({
      where: { tenantId, orderId: body.data.orderId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    let linked: (typeof linkedCandidates)[0] | null = null;
    for (const t of linkedCandidates) {
      const v = await findTicketIfVisible(tenantId, t.id, req.userId);
      if (v) {
        linked = t;
        break;
      }
    }
    if (linked) {
      resolvedTicketId = linked.id;
    } else {
      const assignedSeatId = await computeAssignedSeatForChannelId(tenantId, order.channelId);
      const channel = await prisma.channel.findUnique({ where: { id: order.channelId } });
      const slaDueAt = channel ? await computeSlaDueAtForTicket(tenantId, channel, new Date()) : new Date(Date.now() + 48 * 3600000);
      const created = await prisma.ticket.create({
        data: {
          id: randomUUID(),
          tenantId,
          channelId: order.channelId,
          customerId: order.customerId,
          orderId: order.id,
          subject: `售后登记 · 订单 ${order.platformOrderId}`,
          slaDueAt,
          assignedSeatId,
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

  // 如果选择 API 退款且金额 > 0，则尝试调用母系统接口
  if (body.data.refundExecutionType === 'api' && body.data.type === AfterSalesType.refund && body.data.refundAmount && body.data.refundAmount > 0) {
    const token = motherSystemAuthHeader(req);
    if (!token) {
      res.status(401).json({
        error: 'missing_token',
        message: '母系统授权缺失：请在请求中带 Authorization: Bearer，或在 backend/.env 配置 NEZHA_API_TOKEN。',
      });
      return;
    }
    try {
      const channel = await prisma.channel.findFirst({ where: { id: order.channelId } });
      await refundOrderInMotherSystem(token, order.platformOrderId, {
        amount: body.data.refundAmount,
        reason: body.data.refundReason || body.data.buyerFeedback,
        platformType: channel?.platformType || 'Unknown'
      });
      // API 退款成功，自动将售后状态标为完成
      body.data.status = AfterSalesStatus.completed;
    } catch (e: any) {
      // API 报错：阻止提交，或者标记为手动。这里选择报错让用户知晓，不自动静默。
      res.status(502).json({ 
        error: 'mother_system_api_error', 
        message: `API 退款调用失败：${e.message}。您可以切换为「登记退款申请」手动处理。` 
      });
      return;
    }
  }

  const newAfterSalesId = randomUUID();
  await prisma.afterSalesRecord.create({
    data: {
      id: newAfterSalesId,
      tenantId,
      orderId: body.data.orderId,
      ticketId: resolvedTicketId,
      type: body.data.type,
      status: body.data.status ?? AfterSalesStatus.submitted,
      priority: body.data.priority ?? AfterSalesPriority.medium,
      handlingMethod: body.data.handlingMethod ?? '',
      problemType: body.data.problemType ?? '',
      buyerFeedback: body.data.buyerFeedback ?? '',
      refundAmount: body.data.refundAmount,
      refundReason: body.data.refundReason,
      returnTrackingNumber: body.data.returnTrackingNumber,
      returnCarrier: body.data.returnCarrier,
      reissueSku: body.data.reissueSku,
      reissueQuantity: body.data.reissueQuantity,
    },
  });
  const created = await prisma.afterSalesRecord.findFirst({
    where: { id: newAfterSalesId, tenantId },
    include: afterSalesListInclude,
  });
  if (!created) {
    res.status(500).json({ error: 'internal_error', message: 'after_sales_create_fetch_failed' });
    return;
  }

  if (created.status === AfterSalesStatus.completed && created.type === AfterSalesType.refund) {
    await prisma.order.update({
      where: { id: order.id },
      data: { orderStatus: 'refunded', refundStatus: 'Full' },
    });
  }

  res.status(201).json(mapAfterSales(created));
});

router.get('/:id', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const row = await prisma.afterSalesRecord.findFirst({
    where: { id: req.params.id, tenantId },
    include: afterSalesListInclude,
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
    res.status(400).json({ error: 'bad_request', message: JSON.stringify(body.error.flatten().fieldErrors) });
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
  await prisma.afterSalesRecord.update({
    where: { id: existing.id },
    data: body.data as object,
  });

  if (!wasCompleted && becomesCompleted && existing.type === AfterSalesType.refund) {
    await prisma.order.update({
      where: { id: existing.orderId },
      data: { orderStatus: 'refunded', refundStatus: 'Full' },
    });
  }

  const updated = await prisma.afterSalesRecord.findFirst({
    where: { id: existing.id, tenantId },
    include: afterSalesListInclude,
  });
  if (!updated) {
    res.status(500).json({ error: 'internal_error', message: 'after_sales_patch_fetch_failed' });
    return;
  }
  res.json(mapAfterSales(updated));
});

export default router;
