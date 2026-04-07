import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

export interface TenantRequest extends Request {
  tenantId?: string;
  userId?: string | null;
}

/** 未传 X-Tenant-Id 时：可用 DEFAULT_TENANT_ID，或库内仅有一个租户时自动选用（单租户/哪吒一体场景） */
async function resolveTenantIdFromRequest(req: Request): Promise<string> {
  const headerId = req.header('x-tenant-id')?.trim() || '';
  if (headerId) return headerId;
  const fromEnv = process.env.DEFAULT_TENANT_ID?.trim() || '';
  if (fromEnv) return fromEnv;
  const rows = await prisma.tenant.findMany({ take: 2, select: { id: true } });
  if (rows.length === 1) return rows[0].id;
  return '';
}

/** 校验租户存在；X-Tenant-Id 可省略时见 resolveTenantIdFromRequest */
export async function requireTenant(req: TenantRequest, res: Response, next: NextFunction) {
  let tenantId = '';
  try {
    tenantId = await resolveTenantIdFromRequest(req);
  } catch (e) {
    console.error('[requireTenant] resolve tenant:', e);
    res.status(503).json({
      error: 'database_unavailable',
      message: '无法连接数据库，请确认 PostgreSQL 已启动且 DATABASE_URL 正确',
    });
    return;
  }
  if (!tenantId) {
    res.status(401).json({
      error: 'missing_tenant',
      message:
        '请传 Header X-Tenant-Id，或在 backend/.env 设置 DEFAULT_TENANT_ID，或保证数据库中仅有 1 个租户',
    });
    return;
  }
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      res.status(404).json({
        error: 'tenant_not_found',
        message: '租户不存在：请检查 X-Tenant-Id / DEFAULT_TENANT_ID 是否与数据库一致',
      });
      return;
    }
    req.tenantId = tenantId;
    req.userId = req.header('x-user-id')?.trim() || null;
    next();
  } catch (e) {
    console.error('[requireTenant] database error:', e);
    res.status(503).json({
      error: 'database_unavailable',
      message: '无法连接数据库，请确认 PostgreSQL 已启动且 DATABASE_URL 正确',
    });
  }
}

export function optionalTenant(req: TenantRequest, res: Response, next: NextFunction) {
  req.tenantId = req.header('x-tenant-id')?.trim();
  req.userId = req.header('x-user-id')?.trim() || null;
  next();
}
