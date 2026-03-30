import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { TicketStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { TenantRequest } from '../middleware/tenant.js';
import { mapTicket, mapMessage } from '../dto/mappers.js';
import { broadcastTenant } from '../lib/wsHub.js';

const router = Router();

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
  deliveryTargets: z.array(z.enum(['customer', 'manager'])).optional(),
});

router.get('/', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const q = listQuery.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: 'bad_request', message: q.error.flatten().toString() });
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
      OR: [{ messageProcessingStatus: 'unread' }, { status: TicketStatus.new }],
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
    and.push({
      OR: [
        { subject: { contains: s, mode: 'insensitive' } },
        { subjectOriginal: { contains: s, mode: 'insensitive' } },
        { intent: { contains: s, mode: 'insensitive' } },
      ],
    });
  }

  const where = { AND: and };

  const rows = await prisma.ticket.findMany({
    where,
    include: { channel: true, customer: true, order: true },
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
    items: items.map((t) => mapTicket(t)),
  });
});

router.get('/:id', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const id = req.params.id;
  const ticket = await prisma.ticket.findFirst({
    where: { id, tenantId },
    include: {
      channel: true,
      customer: true,
      order: true,
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!ticket) {
    res.status(404).json({ error: 'not_found', message: 'Ticket not found' });
    return;
  }
  const visMessages = ticket.messages.filter((m) => !m.isInternal || true);
  res.json({
    ...mapTicket(ticket),
    messages: visMessages.map(mapMessage),
  });
});

router.patch('/:id', async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const id = req.params.id;
  const body = patchBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'bad_request', message: body.error.flatten().toString() });
    return;
  }

  const existing = await prisma.ticket.findFirst({ where: { id, tenantId } });
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
    res.status(400).json({ error: 'bad_request', message: body.error.flatten().toString() });
    return;
  }

  const ticket = await prisma.ticket.findFirst({ where: { id, tenantId } });
  if (!ticket) {
    res.status(404).json({ error: 'not_found', message: 'Ticket not found' });
    return;
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

  await prisma.ticket.update({
    where: { id },
    data: {
      updatedAt: new Date(),
      firstResponseAt:
        ticket.firstResponseAt ??
        (!body.data.isInternal && body.data.senderType === 'agent' ? new Date() : undefined),
    },
  });

  const payload = { type: 'message_created', ticketId: id, message: mapMessage(msg) };
  broadcastTenant(tenantId, payload);
  res.status(201).json(mapMessage(msg));
});

export default router;
