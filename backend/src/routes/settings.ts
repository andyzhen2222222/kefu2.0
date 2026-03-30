import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.js';
import type { TenantRequest } from '../middleware/tenant.js';
import { requireRoles } from '../middleware/rbac.js';
import { UserRole } from '@prisma/client';

const router = Router();

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
    res.status(400).json({ error: 'bad_request', message: b.error.flatten().toString() });
    return;
  }
  const row = await prisma.agentSeat.create({
    data: {
      id: randomUUID(),
      tenantId: req.tenantId!,
      displayName: b.data.displayName,
      email: b.data.email,
      account: b.data.account,
      roleId: b.data.roleId ?? 'default',
      status: b.data.status ?? 'active',
    },
  });
  res.status(201).json(row);
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
    const row = await prisma.agentSeat.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId! },
      data: b.data,
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
    res.status(400).json({ error: 'bad_request', message: b.error.flatten().toString() });
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
        templateId: z.string().nullable().optional(),
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
        templateId: b.data.templateId ?? undefined,
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
        templateId: z.string().nullable().optional(),
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

// --- Ticket routing rules ---
router.get('/ticket-routing-rules', async (req: TenantRequest, res) => {
  const rows = await prisma.ticketRoutingRule.findMany({
    where: { tenantId: req.tenantId! },
    orderBy: { priority: 'desc' },
  });
  res.json(rows);
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
