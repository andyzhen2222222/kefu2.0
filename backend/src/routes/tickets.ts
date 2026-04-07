import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { TicketStatus, type Message as PMessage } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { TenantRequest } from '../middleware/tenant.js';
import {
  mapTicket,
  mapMessage,
  mapCustomer,
  mapOrder,
  lastInboundPreviewFromMessages,
} from '../dto/mappers.js';
import { broadcastTenant } from '../lib/wsHub.js';
import {
  hydrateTicketFromNezhaOnRead,
  replyToConversationInMotherSystem,
} from '../services/motherSystemSync.js';
import {
  resolveTicketVisibility,
  ticketVisibilityWhereClause,
} from '../lib/ticketRoutingAssign.js';

const router = Router();

/** 详情接口默认只拉最近 N 条消息，避免长会话一次读出上万行 Text */
function parseTicketDetailMessagesLimit(queryVal: unknown): number {
  const envRaw = Number(process.env.TICKET_DETAIL_MESSAGES_LIMIT);
  const fallback =
    Number.isFinite(envRaw) && envRaw >= 50 ? Math.min(2000, Math.floor(envRaw)) : 500;
  const raw = Array.isArray(queryVal) ? queryVal[0] : queryVal;
  const q =
    typeof raw === 'string'
      ? Number(raw)
      : typeof raw === 'number'
        ? raw
        : NaN;
  const n = Number.isFinite(q) && q >= 50 ? Math.floor(q) : fallback;
  return Math.min(2000, Math.max(50, n));
}

function parseTicketDetailLogisticsEventsCap(): number {
  const envRaw = Number(process.env.TICKET_DETAIL_LOGISTICS_EVENTS_LIMIT);
  const fallback =
    Number.isFinite(envRaw) && envRaw >= 20 ? Math.min(500, Math.floor(envRaw)) : 120;
  return Math.min(500, Math.max(20, fallback));
}

function buildTicketDetailInclude(messagesLimit: number, logisticsCap: number) {
  return {
    channel: true,
    customer: true,
    order: {
      include: {
        channel: true,
        logisticsEvents: {
          orderBy: [{ sortIndex: 'desc' as const }, { timestamp: 'desc' as const }],
          take: logisticsCap,
        },
      },
    },
    messages: { orderBy: { createdAt: 'desc' as const }, take: messagesLimit },
  };
}

function buildTicketDetailShellInclude(logisticsCap: number) {
  return {
    channel: true,
    customer: true,
    order: {
      include: {
        channel: true,
        logisticsEvents: {
          orderBy: [{ sortIndex: 'desc' as const }, { timestamp: 'desc' as const }],
          take: logisticsCap,
        },
      },
    },
  };
}

function parseIncludeMessages(q: unknown): boolean {
  const v = Array.isArray(q) ? q[0] : q;
  if (v === '0' || v === 'false') return false;
  return true;
}

function parseMessagesPageLimit(raw: unknown): number {
  const n =
    typeof raw === 'string'
      ? parseInt(raw, 10)
      : typeof raw === 'number'
        ? raw
        : NaN;
  const v = Number.isFinite(n) ? Math.floor(n) : 100;
  return Math.min(500, Math.max(20, v));
}

/** 当前用户对指定工单的 where 条件（含路由可见性）；无权限时 findFirst 返回 null */
async function ticketWhereForViewer(
  tenantId: string,
  ticketId: string,
  userId: string | null | undefined
) {
  const vis = await resolveTicketVisibility(tenantId, userId);
  const visClause = ticketVisibilityWhereClause(vis);
  return { id: ticketId, tenantId, ...(Object.keys(visClause).length > 0 ? visClause : {}) };
}

const listQuery = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.coerce.number().int().optional(),
  channelId: z.string().optional(),
  messageProcessingStatus: z.enum(['unread', 'unreplied', 'replied']).optional(),
  search: z.string().optional(),
  filter: z.enum(['unread', 'unreplied', 'replied', 'sla_overdue']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

const patchBody = z
  .object({
    status: z.nativeEnum(TicketStatus).optional(),
    priority: z.number().int().optional(),
    tags: z.array(z.string()).optional(),
    messageProcessingStatus: z.enum(['unread', 'unreplied', 'replied']).optional(),
    assignedSeatId: z.string().nullable().optional(),
    isFavorite: z.boolean().optional(),
    isImportant: z.boolean().optional(),
    subject: z.string().optional(),
    subjectOriginal: z.string().nullable().optional(),
    intent: z.string().optional(),
    sentiment: z.string().optional(),
  })
  .strict();

const postMessageBody = z.object({
  content: z.string().min(1),
  senderType: z.enum(['customer', 'manager', 'agent', 'system', 'ai']),
  senderId: z.string().optional(),
  isInternal: z.boolean().optional(),
  attachments: z.array(z.string()).optional(),
  translatedContent: z.string().optional(),
  sentPlatformText: z.string().optional(),
  deliveryTargets: z.array(z.string()).optional(),
  token: z.string().optional(),
});

router.get('/', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const q = listQuery.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: 'bad_request', message: JSON.stringify(q.error.flatten()) });
    return;
  }
  const { status, priority, channelId, messageProcessingStatus, search, filter, limit, cursor } =
    q.data;

  const and: object[] = [{ tenantId }];

  if (status) and.push({ status });
  if (priority != null) and.push({ priority });
  if (messageProcessingStatus) and.push({ messageProcessingStatus });

  if (filter === 'unread') {
    and.push({
      OR: [{ messageProcessingStatus: 'unread' }, { status: TicketStatus['new'] }],
    });
  } else if (filter === 'unreplied') {
    and.push({ messageProcessingStatus: 'unreplied' });
  } else if (filter === 'replied') {
    and.push({ messageProcessingStatus: 'replied' });
  } else if (filter === 'sla_overdue') {
    and.push({ status: { not: TicketStatus.resolved } }, { slaDueAt: { lt: new Date() } });
  }

  if (channelId) {
    and.push({
      OR: [
        { channelId },
        { channel: { displayName: { contains: channelId, mode: 'insensitive' } } },
      ],
    });
  }

  if (search?.trim()) {
    const s = search.trim();
    const ilikeOr: object[] = [
      { subject: { contains: s, mode: 'insensitive' } },
      { subjectOriginal: { contains: s, mode: 'insensitive' } },
      { intent: { contains: s, mode: 'insensitive' } },
      /** 平台订单号常在主题中不出现，允许按关联 Order.platformOrderId 搜索 */
      { order: { platformOrderId: { contains: s, mode: 'insensitive' } } },
    ];
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
    ) {
      ilikeOr.push({ id: s });
    }
    if (process.env.PG_TRGM_SEARCH === '1') {
      try {
        const extra = await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Ticket"
          WHERE "tenantId" = ${tenantId}
          AND (
            similarity(subject, ${s}) > 0.15
            OR similarity(COALESCE("subjectOriginal", ''), ${s}) > 0.15
          )
        `;
        if (extra.length) {
          ilikeOr.push({ id: { in: extra.map((e) => e.id) } });
        }
      } catch {
        /* 未启用 pg_trgm 扩展或查询失败时仅使用 ILIKE */
      }
    }
    and.push({ OR: ilikeOr });
  }

  const vis = await resolveTicketVisibility(tenantId, req.userId);
  const visClause = ticketVisibilityWhereClause(vis);
  if (Object.keys(visClause).length > 0) {
    and.push(visClause);
  }

  const where = { AND: and };

  const rows = await prisma.ticket.findMany({
    where,
    include: {
      channel: true,
      customer: true,
      order: { include: { channel: true } },
      messages: {
        where: { senderType: 'customer', isInternal: false },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true },
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  res.json({
    limit,
    cursor: cursor ?? null,
    nextCursor,
    items: items.map((t) => {
      const base = mapTicket(t);
      return {
        ...base,
        lastInboundPreview: lastInboundPreviewFromMessages(t.messages),
        customer: t.customer ? mapCustomer(t.customer) : null,
        order: t.order ? mapOrder({ ...t.order, channel: t.order.channel }) : null,
      };
    }),
  });
});

/** 早于主详情页的「仅消息分页」，用于向上翻页加载历史 */
router.get('/:id/messages', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const id = req.params.id;
  const where = await ticketWhereForViewer(tenantId, id, req.userId);
  const gate = await prisma.ticket.findFirst({ where, select: { id: true } });
  if (!gate) {
    res.status(404).json({ error: 'not_found', message: 'Ticket not found' });
    return;
  }
  const limit = parseMessagesPageLimit(req.query.limit);
  const beforeRaw = typeof req.query.before === 'string' ? req.query.before.trim() : '';
  const beforeDate = beforeRaw ? new Date(beforeRaw) : null;
  if (beforeDate && Number.isNaN(beforeDate.getTime())) {
    res.status(400).json({ error: 'bad_request', message: 'Invalid before cursor' });
    return;
  }
  const rows = await prisma.message.findMany({
    where: {
      ticketId: id,
      ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  const asc = [...rows].reverse();
  res.json({
    messages: asc.map(mapMessage),
    hasMore: rows.length >= limit,
  });
});

router.get('/:id', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const id = req.params.id;
  const where = await ticketWhereForViewer(tenantId, id, req.userId);
  const messagesLimit = parseTicketDetailMessagesLimit(req.query.messagesLimit);
  const logisticsCap = parseTicketDetailLogisticsEventsCap();
  const includeMessages = parseIncludeMessages(req.query.includeMessages);
  const detailInclude = includeMessages
    ? buildTicketDetailInclude(messagesLimit, logisticsCap)
    : buildTicketDetailShellInclude(logisticsCap);

  const [ticketRow, messagesTotal, timelineMsgCount] = await Promise.all([
    prisma.ticket.findFirst({
      where,
      include: detailInclude,
    }),
    prisma.message.count({ where: { ticketId: id } }),
    /** 时间轴展示排除内部备注；仅内部消息时不应阻止向母系统补拉会话 */
    prisma.message.count({ where: { ticketId: id, isInternal: false } }),
  ]);

  const ticket = ticketRow;
  if (!ticket) {
    res.status(404).json({ error: 'not_found', message: 'Ticket not found' });
    return;
  }

  /** 默认开启：与优化前一致，本地无消息时在后台异步补拉（不阻塞首包）。仅当 TICKET_DETAIL_NEZHA_HYDRATE=0 时关闭 */
  const hydrateDisabled = process.env.TICKET_DETAIL_NEZHA_HYDRATE === '0';
  const hydrateEnabled = !hydrateDisabled;
  const nezhaTok = process.env.NEZHA_API_TOKEN?.trim() || '';
  const embeddedMsgs = includeMessages
    ? (ticket as unknown as { messages: PMessage[] }).messages
    : [];
  if (
    hydrateEnabled &&
    nezhaTok &&
    ticket.externalId?.trim() &&
    (!ticket.orderId || timelineMsgCount === 0)
  ) {
    setImmediate(() => {
      void (async () => {
        try {
          await hydrateTicketFromNezhaOnRead(tenantId, id, nezhaTok);
          broadcastTenant(tenantId, { type: 'ticket_detail_synced', ticketId: id });
        } catch (e) {
          console.warn('[GET /tickets/:id] async hydrateTicketFromNezhaOnRead:', e);
        }
      })();
    });
  }

  const chronological = includeMessages ? [...embeddedMsgs].reverse() : [];

  const orderDto = ticket.order
    ? mapOrder({
        ...ticket.order,
        channel: ticket.order.channel ?? ticket.channel,
      })
    : null;
  res.json({
    ...mapTicket(ticket),
    messages: chronological.map(mapMessage),
    messagesTotal,
    messagesLimit: includeMessages ? messagesLimit : 0,
    includeMessages,
    customer: ticket.customer ? mapCustomer(ticket.customer) : null,
    order: orderDto,
  });
});

router.patch('/:id', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const id = req.params.id;
  const body = patchBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'bad_request', message: JSON.stringify(body.error.flatten()) });
    return;
  }

  const existing = await prisma.ticket.findFirst({
    where: await ticketWhereForViewer(tenantId, id, req.userId),
  });
  if (!existing) {
    res.status(404).json({ error: 'not_found', message: 'Ticket not found' });
    return;
  }

  const data: Record<string, unknown> = { ...body.data };
  if (body.data.status === TicketStatus.resolved && !existing.resolvedAt) {
    data.resolvedAt = new Date();
  }

  const ticket = await prisma.ticket.update({
    where: { id },
    data: data as object,
    include: { channel: true, customer: true, order: true },
  });

  broadcastTenant(tenantId, { type: 'ticket_updated', ticket: mapTicket(ticket) });
  res.json(mapTicket(ticket));
});

router.post('/:id/messages', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const id = req.params.id;
  const body = postMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'bad_request', message: JSON.stringify(body.error.flatten()) });
    return;
  }

  const ticket = await prisma.ticket.findFirst({
    where: await ticketWhereForViewer(tenantId, id, req.userId),
  });
  if (!ticket) {
    res.status(404).json({ error: 'not_found', message: 'Ticket not found' });
    return;
  }

  const agentOutbound = !body.data.isInternal && body.data.senderType === 'agent';
  const customerInbound =
    !body.data.isInternal &&
    (body.data.senderType === 'customer' || body.data.senderType === 'manager');

  // 如果是发给客户的真实回复，且本地存有母系统会话 ID，则尝试调用母系统回复接口
  if (agentOutbound && ticket.externalId) {
    const token = body.data.token?.trim() || process.env.NEZHA_API_TOKEN?.trim() || '';
    if (token) {
      try {
        await replyToConversationInMotherSystem(token, ticket.externalId, {
          content: body.data.sentPlatformText || body.data.content,
          attachments: body.data.attachments,
          deliveryTargets: body.data.deliveryTargets,
        });
      } catch (err) {
        console.error(`[replyToMotherSystem] error:`, err);
        res.status(500).json({
          error: 'upstream_error',
          message: `发送至母系统失败: ${err instanceof Error ? err.message : String(err)}`,
        });
        return;
      }
    }
  }

  const senderId = body.data.senderId ?? req.userId ?? 'agent';

  const msg = await prisma.message.create({
    data: {
      id: randomUUID(),
      ticketId: id,
      senderId,
      senderType: body.data.senderType,
      content: body.data.content,
      isInternal: body.data.isInternal ?? false,
      attachments: body.data.attachments ?? [],
      translatedContent: body.data.translatedContent,
      sentPlatformText: body.data.sentPlatformText,
      deliveryTargets: body.data.deliveryTargets ?? [],
    },
  });

  const updatedTicketRaw = await prisma.ticket.update({
    where: { id },
    data: {
      updatedAt: new Date(),
      firstResponseAt: ticket.firstResponseAt ?? (agentOutbound ? new Date() : undefined),
      ...(agentOutbound ? { messageProcessingStatus: 'replied' as const } : {}),
      ...(customerInbound ? { messageProcessingStatus: 'unread' as const } : {}),
    },
    include: { channel: true, customer: true, order: true },
  });

  const payload = { type: 'message_created', ticketId: id, message: mapMessage(msg) };
  broadcastTenant(tenantId, payload);
  broadcastTenant(tenantId, { type: 'ticket_updated', ticket: mapTicket(updatedTicketRaw) });

  if (customerInbound) {
    void import('../lib/autoReplyEngine.js').then(({ triggerAutoReplyIfNeeded }) =>
      triggerAutoReplyIfNeeded(tenantId, id, body.data.content, ticket.intent ?? '').catch((e) =>
        console.error('[autoReply] trigger from POST message:', e)
      )
    );
  }

  res.status(201).json(mapMessage(msg));
});

const patchInternalMessageBody = z.object({ content: z.string().min(1) }).strict();

/** 仅允许修改「内部备注」类消息：isInternal + agent */
router.patch('/:id/messages/:messageId', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const ticketId = req.params.id;
  const messageId = req.params.messageId;
  const parsed = patchInternalMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'bad_request', message: parsed.error.flatten().toString() });
    return;
  }

  const ticket = await prisma.ticket.findFirst({
    where: await ticketWhereForViewer(tenantId, ticketId, req.userId),
  });
  if (!ticket) {
    res.status(404).json({ error: 'not_found', message: 'Ticket not found' });
    return;
  }

  const existing = await prisma.message.findFirst({ where: { id: messageId, ticketId } });
  if (!existing) {
    res.status(404).json({ error: 'not_found', message: 'Message not found' });
    return;
  }
  if (!existing.isInternal || existing.senderType !== 'agent') {
    res.status(403).json({ error: 'forbidden', message: 'Only internal agent notes can be edited' });
    return;
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content: parsed.data.content.trim() },
  });

  broadcastTenant(tenantId, {
    type: 'message_updated',
    ticketId,
    message: mapMessage(updated),
  });
  res.json(mapMessage(updated));
});

/** 仅允许删除内部 agent 备注 */
router.delete('/:id/messages/:messageId', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const ticketId = req.params.id;
  const messageId = req.params.messageId;

  const ticket = await prisma.ticket.findFirst({
    where: await ticketWhereForViewer(tenantId, ticketId, req.userId),
  });
  if (!ticket) {
    res.status(404).json({ error: 'not_found', message: 'Ticket not found' });
    return;
  }

  const existing = await prisma.message.findFirst({ where: { id: messageId, ticketId } });
  if (!existing) {
    res.status(404).json({ error: 'not_found', message: 'Message not found' });
    return;
  }
  if (!existing.isInternal || existing.senderType !== 'agent') {
    res.status(403).json({ error: 'forbidden', message: 'Only internal agent notes can be deleted' });
    return;
  }

  await prisma.message.delete({ where: { id: messageId } });

  broadcastTenant(tenantId, {
    type: 'message_deleted',
    ticketId,
    messageId,
  });
  res.status(204).send();
});

export default router;
