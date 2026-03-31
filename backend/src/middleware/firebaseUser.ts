import type { Response, NextFunction } from 'express';
import * as jose from 'jose';
import { prisma } from '../lib/prisma.js';
import type { TenantRequest } from './tenant.js';

const jwks = jose.createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

/**
 * 若设置 FIREBASE_PROJECT_ID 且请求带 `Authorization: Bearer <Firebase ID Token>`，
 * 则校验 JWT 并按 email 匹配本租户 User，覆盖 `req.userId`（用于替代纯演示头）。
 */
export async function augmentUserFromFirebase(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    next();
    return;
  }
  const auth = req.header('authorization');
  if (!auth?.startsWith('Bearer ')) {
    next();
    return;
  }
  const token = auth.slice(7).trim();
  if (!token || token.split('.').length !== 3) {
    next();
    return;
  }
  try {
    const { payload } = await jose.jwtVerify(token, jwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    const email = typeof payload.email === 'string' ? payload.email : null;
    const tenantId = req.tenantId;
    if (email && tenantId) {
      const u = await prisma.user.findFirst({
        where: { tenantId, email },
      });
      if (u) req.userId = u.id;
    }
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token', message: 'Invalid or expired Firebase ID token' });
    return;
  }
}
