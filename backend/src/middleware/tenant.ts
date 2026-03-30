import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

export interface TenantRequest extends Request {
  tenantId?: string;
  userId?: string | null;
}

/** 校验 X-Tenant-Id 存在且对应 Tenant 存在 */
export async function requireTenant(req: TenantRequest, res: Response, next: NextFunction) {
  const tenantId = req.header('x-tenant-id')?.trim();
  if (!tenantId) {
    res.status(401).json({ error: 'missing_tenant', message: 'Header X-Tenant-Id is required' });
    return;
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    res.status(404).json({ error: 'tenant_not_found', message: 'Invalid X-Tenant-Id' });
    return;
  }
  req.tenantId = tenantId;
  req.userId = req.header('x-user-id')?.trim() || null;
  next();
}

export function optionalTenant(req: TenantRequest, res: Response, next: NextFunction) {
  req.tenantId = req.header('x-tenant-id')?.trim();
  req.userId = req.header('x-user-id')?.trim() || null;
  next();
}
