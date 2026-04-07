import type { Channel } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { prisma } from './prisma.js';

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

/** 与前端路由规则 conditions JSON 对齐 */
export type RoutingConditionsShape = {
  platformTypes?: string[];
  channelIds?: string[];
  afterSalesTypes?: string[];
};

function platformKey(platformType: string | null | undefined): string {
  const t = platformType?.trim();
  return t && t.length > 0 ? t : '__unset__';
}

function matchesPlatform(required: string[], platformType: string | null | undefined): boolean {
  if (required.length === 0) return true;
  const key = platformKey(platformType);
  return required.some((r) => {
    const rr = r.trim();
    if (rr === key) return true;
    if (platformType?.trim() && rr.toLowerCase() === platformType.trim().toLowerCase()) return true;
    if (rr.toLowerCase() === key.toLowerCase()) return true;
    return false;
  });
}

function matchesChannel(required: string[], channelId: string): boolean {
  if (required.length === 0) return true;
  return required.includes(channelId);
}

/**
 * 新建工单时尚无售后 problemType 时，带「仅售后类型」条件的规则不参与匹配（避免误匹配）。
 */
function matchesAfterSalesDimension(
  required: string[],
  _ticket?: { intent?: string | null; tags?: string[] }
): boolean {
  if (required.length === 0) return true;
  return false;
}

export function routingConditionsMatchChannel(
  conditions: unknown,
  channel: Pick<Channel, 'id' | 'platformType'>,
  ticket?: { intent?: string | null; tags?: string[] }
): boolean {
  if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions)) return false;
  const c = conditions as Record<string, unknown>;
  const platformTypes = asStringArray(c.platformTypes);
  const channelIds = asStringArray(c.channelIds);
  const afterSalesTypes = asStringArray(c.afterSalesTypes);
  if (!matchesPlatform(platformTypes, channel.platformType)) return false;
  if (!matchesChannel(channelIds, channel.id)) return false;
  if (!matchesAfterSalesDimension(afterSalesTypes, ticket)) return false;
  return true;
}

/**
 * 条件越具体分数越高（先尝试细规则，再宽泛规则）。
 * 店铺维度权重高于平台，与「多选仍算一条约束」一致。
 */
export function routingConditionsSpecificityScore(conditions: unknown): number {
  if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions)) return 0;
  const c = conditions as Record<string, unknown>;
  const hasPt = asStringArray(c.platformTypes).length > 0;
  const hasCh = asStringArray(c.channelIds).length > 0;
  const hasAst = asStringArray(c.afterSalesTypes).length > 0;
  return (hasPt ? 2 : 0) + (hasCh ? 4 : 0) + (hasAst ? 1 : 0);
}

export type TicketRoutingRuleSortable = {
  conditions: unknown;
  priority: number;
  createdAt: Date;
};

/** 与工单指派遍历顺序一致：具体度降序 → 创建时间升序 */
export function sortTicketRoutingRulesForEvaluation<T extends TicketRoutingRuleSortable>(rules: T[]): T[] {
  return [...rules].sort((a, b) => {
    const sb = routingConditionsSpecificityScore(b.conditions) - routingConditionsSpecificityScore(a.conditions);
    if (sb !== 0) return sb;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

/**
 * 按评估顺序取第一条匹配规则的目标坐席；无匹配返回 null。
 * 顺序：条件更具体者优先，再按创建先后稳定次序。
 */
export async function computeAssignedSeatForChannel(
  tenantId: string,
  channel: Pick<Channel, 'id' | 'platformType'>,
  ticket?: { intent?: string | null; tags?: string[] }
): Promise<string | null> {
  const raw = await prisma.ticketRoutingRule.findMany({
    where: { tenantId, enabled: true },
  });
  const rules = sortTicketRoutingRulesForEvaluation(raw);
  for (const rule of rules) {
    if (!rule.targetSeatId) continue;
    if (!routingConditionsMatchChannel(rule.conditions, channel, ticket)) continue;
    const seat = await prisma.agentSeat.findFirst({
      where: { id: rule.targetSeatId, tenantId, status: 'active' },
    });
    if (seat) return rule.targetSeatId;
  }
  return null;
}

export async function computeAssignedSeatForChannelId(
  tenantId: string,
  channelId: string,
  ticket?: { intent?: string | null; tags?: string[] }
): Promise<string | null> {
  const channel = await prisma.channel.findFirst({ where: { id: channelId, tenantId } });
  if (!channel) return null;
  return computeAssignedSeatForChannel(tenantId, channel, ticket);
}

export type TicketVisibilityContext = {
  isAdmin: boolean;
  /** 当前用户邮箱在租户下绑定的启用坐席 id */
  seatIds: string[];
  /** 该坐席通过路由规则明确负责的渠道 IDs */
  responsibleChannelIds: string[];
  /** 租户下所有被规则锁定的受限渠道 IDs */
  restrictedChannelIds: string[];
};

/** 收件箱列表与工单详情会连续调用可见性解析；短 TTL 缓存避免重复查库 */
const TICKET_VIS_CACHE_TTL_MS = 4000;
const ticketVisCache = new Map<string, { exp: number; ctx: TicketVisibilityContext }>();

/**
 * 解析当前请求的可见范围：
 * 1. 管理员看全部。
 * 2. 普通坐席看：指派给自己的 + (公海中非受限渠道的) + (公海中自己负责的受限渠道)。
 */
async function resolveTicketVisibilityUncached(
  tenantId: string,
  userId: string | null | undefined
): Promise<TicketVisibilityContext> {
  if (!userId) {
    return { isAdmin: false, seatIds: [], responsibleChannelIds: [], restrictedChannelIds: [] };
  }
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  });
  if (!user) {
    return { isAdmin: false, seatIds: [], responsibleChannelIds: [], restrictedChannelIds: [] };
  }
  if (user.role === UserRole.admin) {
    return { isAdmin: true, seatIds: [], responsibleChannelIds: [], restrictedChannelIds: [] };
  }

  // 1. 获取本人关联的活跃坐席
  const seats = await prisma.agentSeat.findMany({
    where: {
      tenantId,
      status: 'active',
      email: { equals: user.email, mode: 'insensitive' },
    },
    select: { id: true },
  });
  const seatIds = seats.map((s) => s.id);

  // 2. 获取所有启用的规则，解析哪些渠道被锁定
  const allRules = await prisma.ticketRoutingRule.findMany({
    where: { tenantId, enabled: true },
    select: { conditions: true, targetSeatId: true },
  });

  const restrictedChannelSet = new Set<string>();
  const myResponsibleChannelSet = new Set<string>();
  const restrictedPlatformSet = new Set<string>();
  const myResponsiblePlatformSet = new Set<string>();

  for (const rule of allRules) {
    const cond = rule.conditions as Record<string, unknown> | null;
    if (!cond) continue;

    const cIds = asStringArray(cond.channelIds);
    const pTypes = asStringArray(cond.platformTypes);
    const isMine = rule.targetSeatId && seatIds.includes(rule.targetSeatId);

    if (cIds.length > 0) {
      cIds.forEach((id) => restrictedChannelSet.add(id));
      if (isMine) cIds.forEach((id) => myResponsibleChannelSet.add(id));
    }

    if (pTypes.length > 0) {
      pTypes.forEach((p) => restrictedPlatformSet.add(p.toUpperCase()));
      if (isMine) pTypes.forEach((p) => myResponsiblePlatformSet.add(p.toUpperCase()));
    }
  }

  // 获取所有属于受限平台的渠道 ID，合并到受限渠道集合中
  if (restrictedPlatformSet.size > 0) {
    const channelsInRestrictedPlatforms = await prisma.channel.findMany({
      where: {
        tenantId,
        platformType: { in: Array.from(restrictedPlatformSet), mode: 'insensitive' },
      },
      select: { id: true, platformType: true },
    });

    for (const ch of channelsInRestrictedPlatforms) {
      restrictedChannelSet.add(ch.id);
      const pt = ch.platformType?.toUpperCase();
      if (pt && myResponsiblePlatformSet.has(pt)) {
        myResponsibleChannelSet.add(ch.id);
      }
    }
  }

  return {
    isAdmin: false,
    seatIds,
    restrictedChannelIds: Array.from(restrictedChannelSet),
    responsibleChannelIds: Array.from(myResponsibleChannelSet),
  };
}

export async function resolveTicketVisibility(
  tenantId: string,
  userId: string | null | undefined
): Promise<TicketVisibilityContext> {
  const key = `${tenantId}:${userId ?? ''}`;
  const now = Date.now();
  const hit = ticketVisCache.get(key);
  if (hit && hit.exp > now) return hit.ctx;
  const ctx = await resolveTicketVisibilityUncached(tenantId, userId);
  ticketVisCache.set(key, { exp: now + TICKET_VIS_CACHE_TTL_MS, ctx });
  if (ticketVisCache.size > 400) {
    for (const [k, v] of ticketVisCache) {
      if (v.exp <= now) ticketVisCache.delete(k);
    }
  }
  return ctx;
}

/** Prisma where 片段：实现平台+店铺配置后的可见性收紧 */
export function ticketVisibilityWhereClause(ctx: TicketVisibilityContext): object {
  if (ctx.isAdmin) {
    return {};
  }

  // 坐席可见：
  // 1. 已经明确指派给我的工单
  // 2. 公海工单（assignedSeatId 为 null），且：
  //    a. 所属渠道没有被任何规则锁定（真正公共的）
  //    b. 或者所属渠道虽然被锁定，但我是该渠道的负责人
  
  const mySeatClause = ctx.seatIds.length > 0 ? { assignedSeatId: { in: ctx.seatIds } } : null;

  const publicSeaClause = {
    assignedSeatId: null,
    OR: [
      // 渠道不受限
      { channelId: { notIn: ctx.restrictedChannelIds } },
      // 或者是我的受限渠道
      ...(ctx.responsibleChannelIds.length > 0 ? [{ channelId: { in: ctx.responsibleChannelIds } }] : []),
    ],
  };

  if (!mySeatClause) return publicSeaClause;

  return {
    OR: [mySeatClause, publicSeaClause],
  };
}

/** 不拉关联；用于售后等接口校验「当前用户是否可见该工单」 */
export async function findTicketIfVisible(
  tenantId: string,
  ticketId: string,
  userId: string | null | undefined
) {
  const vis = await resolveTicketVisibility(tenantId, userId);
  const visClause = ticketVisibilityWhereClause(vis);
  return prisma.ticket.findFirst({
    where: { id: ticketId, tenantId, ...(Object.keys(visClause).length > 0 ? visClause : {}) },
  });
}
