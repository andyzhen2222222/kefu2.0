import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { ensureUserLinkedToAgentSeat } from '../lib/ensureAgentSeatUser.js';
import type { TenantRequest } from '../middleware/tenant.js';
import { requireRoles } from '../middleware/rbac.js';
import { UserRole } from '@prisma/client';
import { sortTicketRoutingRulesForEvaluation } from '../lib/ticketRoutingAssign.js';
import { ensureTenantSyncSettings } from '../lib/tenantSyncSettings.js';
import { sessionFromAccountHandler } from './auth.js';

const router = Router();

/** 与 POST /api/auth/session-from-account 相同逻辑，作备用路径（与 agent-seats 同属 settings 挂载链） */
router.post('/session-from-account', sessionFromAccountHandler);

const BACKFILL_MODES = z.enum(['full', 'from_date', 'recent_days']);

function parseOptionalIsoDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v.trim());
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

// --- 母系统正式同步设置（管理员）---
router.get('/mother-sync', requireRoles(UserRole.admin), async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const settings = await ensureTenantSyncSettings(tenantId);
  const channels = await prisma.channel.findMany({
    where: { tenantId },
    select: {
      id: true,
      displayName: true,
      platformType: true,
      externalShopId: true,
      syncMessagesEnabled: true,
      syncOrdersEnabled: true,
      orderBackfillMode: true,
      orderBackfillFrom: true,
      orderBackfillRecentDays: true,
      ticketBackfillMode: true,
      ticketBackfillFrom: true,
      ticketBackfillRecentDays: true,
      initialBackfillCompletedAt: true,
    },
    orderBy: { displayName: 'asc' },
  });
  res.json({ settings, channels });
});

router.patch('/mother-sync', requireRoles(UserRole.admin), async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  await ensureTenantSyncSettings(tenantId);
  const b = z
    .object({
      syncEnabled: z.boolean().optional(),
      messagePollIntervalSec: z.number().int().min(30).max(86400).optional(),
      orderPollIntervalSec: z.number().int().min(60).max(86400).optional(),
      incrementalSyncDays: z.number().int().min(1).max(90).optional(),
      useSyncWatermark: z.boolean().optional(),
      messageSyncDisabledPlatformTypes: z.array(z.string()).optional(),
      defaultNewShopOrderBackfillMode: BACKFILL_MODES.optional(),
      defaultNewShopOrderBackfillFrom: z.union([z.string(), z.null()]).optional(),
      defaultNewShopOrderBackfillRecentDays: z.number().int().min(1).max(90).optional(),
      defaultNewShopTicketBackfillMode: BACKFILL_MODES.optional(),
      defaultNewShopTicketBackfillFrom: z.union([z.string(), z.null()]).optional(),
      defaultNewShopTicketBackfillRecentDays: z.number().int().min(1).max(90).optional(),
      skipMockTickets: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!b.success) {
    res.status(400).json({ error: 'bad_request', message: JSON.stringify(b.error.flatten()) });
    return;
  }
  const data = { ...b.data };
  const fromOrder = parseOptionalIsoDate(data.defaultNewShopOrderBackfillFrom);
  if (
    data.defaultNewShopOrderBackfillFrom !== undefined &&
    data.defaultNewShopOrderBackfillFrom !== null &&
    fromOrder === undefined
  ) {
    res.status(400).json({ error: 'bad_request', message: 'invalid defaultNewShopOrderBackfillFrom' });
    return;
  }
  const fromTicket = parseOptionalIsoDate(data.defaultNewShopTicketBackfillFrom);
  if (
    data.defaultNewShopTicketBackfillFrom !== undefined &&
    data.defaultNewShopTicketBackfillFrom !== null &&
    fromTicket === undefined
  ) {
    res.status(400).json({ error: 'bad_request', message: 'invalid defaultNewShopTicketBackfillFrom' });
    return;
  }

  const { defaultNewShopOrderBackfillFrom: _o, defaultNewShopTicketBackfillFrom: _t, ...rest } = data as Record<
    string,
    unknown
  >;
  const updatePayload: Record<string, unknown> = { ...rest };
  if (data.defaultNewShopOrderBackfillFrom !== undefined) {
    updatePayload.defaultNewShopOrderBackfillFrom = fromOrder ?? null;
  }
  if (data.defaultNewShopTicketBackfillFrom !== undefined) {
    updatePayload.defaultNewShopTicketBackfillFrom = fromTicket ?? null;
  }

  if (Object.keys(updatePayload).length === 0) {
    const settings = await prisma.tenantSyncSettings.findUniqueOrThrow({ where: { tenantId } });
    const channels = await prisma.channel.findMany({
      where: { tenantId },
      select: {
        id: true,
        displayName: true,
        platformType: true,
        externalShopId: true,
        syncMessagesEnabled: true,
        syncOrdersEnabled: true,
        orderBackfillMode: true,
        orderBackfillFrom: true,
        orderBackfillRecentDays: true,
        ticketBackfillMode: true,
        ticketBackfillFrom: true,
        ticketBackfillRecentDays: true,
        initialBackfillCompletedAt: true,
      },
      orderBy: { displayName: 'asc' },
    });
    res.json({ settings, channels });
    return;
  }

  await prisma.tenantSyncSettings.update({
    where: { tenantId },
    data: updatePayload as object,
  });
  const settings = await prisma.tenantSyncSettings.findUniqueOrThrow({ where: { tenantId } });
  const channels = await prisma.channel.findMany({
    where: { tenantId },
    select: {
      id: true,
      displayName: true,
      platformType: true,
      externalShopId: true,
      syncMessagesEnabled: true,
      syncOrdersEnabled: true,
      orderBackfillMode: true,
      orderBackfillFrom: true,
      orderBackfillRecentDays: true,
      ticketBackfillMode: true,
      ticketBackfillFrom: true,
      ticketBackfillRecentDays: true,
      initialBackfillCompletedAt: true,
    },
    orderBy: { displayName: 'asc' },
  });
  res.json({ settings, channels });
});

router.patch('/channels/:id/mother-sync', requireRoles(UserRole.admin), async (req: TenantRequest, res) => {
  const tenantId = req.tenantId!;
  const channelId = req.params.id;
  const b = z
    .object({
      syncMessagesEnabled: z.boolean().optional(),
      syncOrdersEnabled: z.boolean().optional(),
      orderBackfillMode: BACKFILL_MODES.nullable().optional(),
      orderBackfillFrom: z.union([z.string(), z.null()]).optional(),
      orderBackfillRecentDays: z.number().int().min(1).max(90).nullable().optional(),
      ticketBackfillMode: BACKFILL_MODES.nullable().optional(),
      ticketBackfillFrom: z.union([z.string(), z.null()]).optional(),
      ticketBackfillRecentDays: z.number().int().min(1).max(90).nullable().optional(),
      initialBackfillCompletedAt: z.union([z.string(), z.null()]).optional(),
    })
    .safeParse(req.body);
  if (!b.success) {
    res.status(400).json({ error: 'bad_request', message: JSON.stringify(b.error.flatten()) });
    return;
  }
  const d = b.data;
  const updateData: Record<string, unknown> = {};
  if (d.syncMessagesEnabled !== undefined) updateData.syncMessagesEnabled = d.syncMessagesEnabled;
  if (d.syncOrdersEnabled !== undefined) updateData.syncOrdersEnabled = d.syncOrdersEnabled;
  if (d.orderBackfillMode !== undefined) updateData.orderBackfillMode = d.orderBackfillMode;
  if (d.orderBackfillRecentDays !== undefined) updateData.orderBackfillRecentDays = d.orderBackfillRecentDays;
  if (d.ticketBackfillMode !== undefined) updateData.ticketBackfillMode = d.ticketBackfillMode;
  if (d.ticketBackfillRecentDays !== undefined) updateData.ticketBackfillRecentDays = d.ticketBackfillRecentDays;

  if (d.orderBackfillFrom !== undefined) {
    if (d.orderBackfillFrom === null) updateData.orderBackfillFrom = null;
    else {
      const dt = parseOptionalIsoDate(d.orderBackfillFrom);
      if (dt === undefined) {
        res.status(400).json({ error: 'bad_request', message: 'invalid orderBackfillFrom' });
        return;
      }
      updateData.orderBackfillFrom = dt;
    }
  }
  if (d.ticketBackfillFrom !== undefined) {
    if (d.ticketBackfillFrom === null) updateData.ticketBackfillFrom = null;
    else {
      const dt = parseOptionalIsoDate(d.ticketBackfillFrom);
      if (dt === undefined) {
        res.status(400).json({ error: 'bad_request', message: 'invalid ticketBackfillFrom' });
        return;
      }
      updateData.ticketBackfillFrom = dt;
    }
  }
  if (d.initialBackfillCompletedAt !== undefined) {
    if (d.initialBackfillCompletedAt === null) updateData.initialBackfillCompletedAt = null;
    else {
      const dt = parseOptionalIsoDate(d.initialBackfillCompletedAt);
      if (dt === undefined) {
        res.status(400).json({ error: 'bad_request', message: 'invalid initialBackfillCompletedAt' });
        return;
      }
      updateData.initialBackfillCompletedAt = dt;
    }
  }

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: 'bad_request', message: 'no fields to update' });
    return;
  }

  const u = await prisma.channel.updateMany({
    where: { id: channelId, tenantId },
    data: updateData as object,
  });
  if (u.count === 0) {
    res.status(404).json({ error: 'not_found', message: 'Channel not found' });
    return;
  }
  const row = await prisma.channel.findFirst({
    where: { id: channelId, tenantId },
    select: {
      id: true,
      displayName: true,
      platformType: true,
      externalShopId: true,
      syncMessagesEnabled: true,
      syncOrdersEnabled: true,
      orderBackfillMode: true,
      orderBackfillFrom: true,
      orderBackfillRecentDays: true,
      ticketBackfillMode: true,
      ticketBackfillFrom: true,
      ticketBackfillRecentDays: true,
      initialBackfillCompletedAt: true,
    },
  });
  res.json(row);
});

// --- Agent seats ---
router.get('/agent-seats', async (req: TenantRequest, res) => {
  const rows = await prisma.agentSeat.findMany({
    where: { tenantId: req.tenantId! },
    orderBy: { displayName: 'asc' },
  });
  res.json(rows);
});

router.post('/agent-seats', requireRoles(UserRole.admin, UserRole.team_lead), async (req: TenantRequest, res) => {
  const b = z
    .object({
      displayName: z.string().min(1),
      email: z.string().email(),
      account: z.string().min(1),
      roleId: z.string().optional(),
      status: z.enum(['active', 'inactive']).optional(),
    })
    .safeParse(req.body);
  if (!b.success) {
    res.status(400).json({ error: 'bad_request', message: JSON.stringify(b.error.flatten()) });
    return;
  }
  const roleId =
    b.data.roleId && String(b.data.roleId).trim() ? String(b.data.roleId).trim() : 'default';
  const row = await prisma.agentSeat.create({
    data: {
      id: randomUUID(),
      tenantId: req.tenantId!,
      displayName: b.data.displayName,
      email: b.data.email,
      account: b.data.account,
      roleId,
      status: b.data.status ?? 'active',
    },
  });
  await ensureUserLinkedToAgentSeat(row);
  const withUser = await prisma.agentSeat.findFirst({ where: { id: row.id } });
  res.status(201).json(withUser ?? row);
});

router.patch(
  '/agent-seats/:id',
  requireRoles(UserRole.admin, UserRole.team_lead),
  async (req: TenantRequest, res) => {
    const b = z
      .object({
        displayName: z.string().optional(),
        email: z.string().email().optional(),
        account: z.string().optional(),
        roleId: z.string().optional(),
        status: z.enum(['active', 'inactive']).optional(),
      })
      .safeParse(req.body);
    if (!b.success) {
      res.status(400).json({ error: 'bad_request', message: b.error.flatten().toString() });
      return;
    }
    const patch = { ...b.data };
    if (patch.roleId !== undefined) {
      patch.roleId =
        patch.roleId && String(patch.roleId).trim() ? String(patch.roleId).trim() : 'default';
    }
    const row = await prisma.agentSeat.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId! },
      data: patch,
    });
    if (row.count === 0) {
      res.status(404).json({ error: 'not_found', message: 'Seat not found' });
      return;
    }
    const updated = await prisma.agentSeat.findFirst({ where: { id: req.params.id } });
    res.json(updated);
  }
);

router.delete(
  '/agent-seats/:id',
  requireRoles(UserRole.admin),
  async (req: TenantRequest, res) => {
    const r = await prisma.agentSeat.deleteMany({
      where: { id: req.params.id, tenantId: req.tenantId! },
    });
    if (r.count === 0) {
      res.status(404).json({ error: 'not_found', message: 'Seat not found' });
      return;
    }
    res.status(204).send();
  }
);

// --- SLA rules ---
router.get('/sla-rules', async (req: TenantRequest, res) => {
  const rows = await prisma.slaRule.findMany({ where: { tenantId: req.tenantId! } });
  res.json(rows);
});

router.post('/sla-rules', requireRoles(UserRole.admin, UserRole.team_lead), async (req: TenantRequest, res) => {
  const b = z
    .object({
      name: z.string().min(1),
      channelPattern: z.string().nullable().optional(),
      warningHours: z.number().int().optional(),
      timeoutHours: z.number().int().optional(),
      enabled: z.boolean().optional(),
      conditions: z.record(z.string(), z.any()).optional(),
    })
    .safeParse(req.body);
  if (!b.success) {
    res.status(400).json({ error: 'bad_request', message: JSON.stringify(b.error.flatten()) });
    return;
  }
  const row = await prisma.slaRule.create({
    data: {
      id: randomUUID(),
      tenantId: req.tenantId!,
      name: b.data.name,
      channelPattern: b.data.channelPattern ?? undefined,
      warningHours: b.data.warningHours ?? 4,
      timeoutHours: b.data.timeoutHours ?? 24,
      enabled: b.data.enabled ?? true,
      conditions: b.data.conditions ?? undefined,
    },
  });
  res.status(201).json(row);
});

router.patch(
  '/sla-rules/:id',
  requireRoles(UserRole.admin, UserRole.team_lead),
  async (req: TenantRequest, res) => {
    const b = z
      .object({
        name: z.string().optional(),
        channelPattern: z.string().nullable().optional(),
        warningHours: z.number().int().optional(),
        timeoutHours: z.number().int().optional(),
        enabled: z.boolean().optional(),
        conditions: z.record(z.string(), z.any()).nullable().optional(),
      })
      .safeParse(req.body);
    if (!b.success) {
      res.status(400).json({ error: 'bad_request', message: b.error.flatten().toString() });
      return;
    }
    const u = await prisma.slaRule.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId! },
      data: b.data as object,
    });
    if (u.count === 0) {
      res.status(404).json({ error: 'not_found', message: 'Not found' });
      return;
    }
    res.json(await prisma.slaRule.findFirst({ where: { id: req.params.id } }));
  }
);

router.delete('/sla-rules/:id', requireRoles(UserRole.admin), async (req: TenantRequest, res) => {
  const r = await prisma.slaRule.deleteMany({
    where: { id: req.params.id, tenantId: req.tenantId! },
  });
  if (r.count === 0) {
    res.status(404).json({ error: 'not_found', message: 'Not found' });
    return;
  }
  res.status(204).send();
});

// --- Auto reply rules ---
router.get('/auto-reply-rules', async (req: TenantRequest, res) => {
  const rows = await prisma.autoReplyRule.findMany({ where: { tenantId: req.tenantId! } });
  res.json(rows);
});

router.post(
  '/auto-reply-rules',
  requireRoles(UserRole.admin, UserRole.team_lead),
  async (req: TenantRequest, res) => {
    const b = z
      .object({
        name: z.string().min(1),
        enabled: z.boolean().optional(),
        intentMatch: z.string().nullable().optional(),
        keywords: z.array(z.string()).optional(),
        replyContent: z.string().nullable().optional(),
        markRepliedOnSend: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!b.success) {
      res.status(400).json({ error: 'bad_request', message: b.error.flatten().toString() });
      return;
    }
    const row = await prisma.autoReplyRule.create({
      data: {
        id: randomUUID(),
        tenantId: req.tenantId!,
        name: b.data.name,
        enabled: b.data.enabled ?? true,
        intentMatch: b.data.intentMatch ?? undefined,
        keywords: b.data.keywords ?? [],
        replyContent: b.data.replyContent ?? undefined,
        markRepliedOnSend: b.data.markRepliedOnSend ?? false,
      },
    });
    res.status(201).json(row);
  }
);

router.patch(
  '/auto-reply-rules/:id',
  requireRoles(UserRole.admin, UserRole.team_lead),
  async (req: TenantRequest, res) => {
    const b = z
      .object({
        name: z.string().optional(),
        enabled: z.boolean().optional(),
        intentMatch: z.string().nullable().optional(),
        keywords: z.array(z.string()).optional(),
        replyContent: z.string().nullable().optional(),
        markRepliedOnSend: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!b.success) {
      res.status(400).json({ error: 'bad_request', message: b.error.flatten().toString() });
      return;
    }
    const u = await prisma.autoReplyRule.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId! },
      data: b.data as object,
    });
    if (u.count === 0) {
      res.status(404).json({ error: 'not_found', message: 'Not found' });
      return;
    }
    res.json(await prisma.autoReplyRule.findFirst({ where: { id: req.params.id } }));
  }
);

router.delete('/auto-reply-rules/:id', requireRoles(UserRole.admin), async (req: TenantRequest, res) => {
  const r = await prisma.autoReplyRule.deleteMany({
    where: { id: req.params.id, tenantId: req.tenantId! },
  });
  if (r.count === 0) {
    res.status(404).json({ error: 'not_found', message: 'Not found' });
    return;
  }
  res.status(204).send();
});

/** 与前端字段管理「售后类型」value 对齐，供分配规则多选 */
const ROUTING_AFTER_SALES_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'logistics', label: '物流问题' },
  { value: 'after_sales_refund', label: '售后退款' },
  { value: 'quality', label: '质量问题' },
  { value: 'wrong_item', label: '发错货' },
  { value: 'missing_part', label: '少发漏发' },
  { value: 'not_received', label: '未收到货' },
  { value: 'customer_reason', label: '客户原因/不想要了' },
  { value: 'invoice', label: '发票相关' },
  { value: 'marketing', label: '营销关怀' },
];

/** 平台类型去重（Channel.platformType），空值归为「未分类」 */
router.get('/routing-rule-options', async (req: TenantRequest, res) => {
  const channels = await prisma.channel.findMany({
    where: { tenantId: req.tenantId! },
    select: { id: true, displayName: true, platformType: true },
    orderBy: { displayName: 'asc' },
  });
  const platformMap = new Map<string, string>();
  for (const ch of channels) {
    const raw = ch.platformType?.trim();
    const key = raw && raw.length > 0 ? raw : '__unset__';
    const label = raw && raw.length > 0 ? raw : '未分类';
    if (!platformMap.has(key)) platformMap.set(key, label);
  }
  const platforms = [...platformMap.entries()].map(([value, label]) => ({ value, label }));
  res.json({
    platforms,
    channels: channels.map((c) => ({
      id: c.id,
      displayName: c.displayName,
      platformType: c.platformType,
    })),
    afterSalesTypes: ROUTING_AFTER_SALES_TYPE_OPTIONS,
  });
});

// --- Ticket routing rules ---
router.get('/ticket-routing-rules', async (req: TenantRequest, res) => {
  const rows = await prisma.ticketRoutingRule.findMany({
    where: { tenantId: req.tenantId! },
  });
  res.json(sortTicketRoutingRulesForEvaluation(rows));
});

router.post(
  '/ticket-routing-rules',
  requireRoles(UserRole.admin, UserRole.team_lead),
  async (req: TenantRequest, res) => {
    const b = z
      .object({
        name: z.string().min(1),
        priority: z.number().int().optional(),
        conditions: z.record(z.string(), z.any()),
        targetSeatId: z.string().nullable().optional(),
        enabled: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!b.success) {
      res.status(400).json({ error: 'bad_request', message: b.error.flatten().toString() });
      return;
    }
    const row = await prisma.ticketRoutingRule.create({
      data: {
        id: randomUUID(),
        tenantId: req.tenantId!,
        name: b.data.name,
        priority: b.data.priority ?? 0,
        conditions: b.data.conditions,
        targetSeatId: b.data.targetSeatId ?? undefined,
        enabled: b.data.enabled ?? true,
      },
    });
    res.status(201).json(row);
  }
);

router.patch(
  '/ticket-routing-rules/:id',
  requireRoles(UserRole.admin, UserRole.team_lead),
  async (req: TenantRequest, res) => {
    const b = z
      .object({
        name: z.string().optional(),
        priority: z.number().int().optional(),
        conditions: z.record(z.string(), z.any()).optional(),
        targetSeatId: z.string().nullable().optional(),
        enabled: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!b.success) {
      res.status(400).json({ error: 'bad_request', message: b.error.flatten().toString() });
      return;
    }
    const u = await prisma.ticketRoutingRule.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId! },
      data: b.data as object,
    });
    if (u.count === 0) {
      res.status(404).json({ error: 'not_found', message: 'Not found' });
      return;
    }
    res.json(await prisma.ticketRoutingRule.findFirst({ where: { id: req.params.id } }));
  }
);

router.delete('/ticket-routing-rules/:id', requireRoles(UserRole.admin), async (req: TenantRequest, res) => {
  const r = await prisma.ticketRoutingRule.deleteMany({
    where: { id: req.params.id, tenantId: req.tenantId! },
  });
  if (r.count === 0) {
    res.status(404).json({ error: 'not_found', message: 'Not found' });
    return;
  }
  res.status(204).send();
});

export default router;
