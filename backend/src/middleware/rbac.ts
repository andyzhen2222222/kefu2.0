import type { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import type { TenantRequest } from './tenant.js';
import { UserRole } from '@prisma/client';

export function requireRoles(...roles: UserRole[]) {
  return async (req: TenantRequest, res: Response, next: NextFunction) => {
    const uid = req.userId;
    if (!uid) {
      res.status(401).json({ error: 'missing_user', message: 'X-User-Id required for this operation' });
      return;
    }
    const user = await prisma.user.findFirst({
      where: { id: uid, tenantId: req.tenantId! },
    });
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: 'forbidden', message: 'Insufficient role' });
      return;
    }
    next();
  };
}
