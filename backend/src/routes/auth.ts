import type { Response } from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { TenantRequest } from '../middleware/tenant.js';
import { ensureUserLinkedToAgentSeat } from '../lib/ensureAgentSeatUser.js';

type UiRole = 'admin' | 'team_lead' | 'agent' | 'finance' | 'operations' | 'external';

function mapUserRole(r: UserRole): UiRole {
  return r as UiRole;
}

function allowAccountSession(): boolean {
  if (process.env.ALLOW_ACCOUNT_SESSION === '1' || process.env.ALLOW_ACCOUNT_SESSION === 'true') {
    return true;
  }
  return process.env.NODE_ENV !== 'production';
}

/**
 * 开发/联调用：根据登录框「账号」解析租户内 User，用于前端写入 mockUser 并作为 X-User-Id。
 * - 含 @ 时按 User.email 精确匹配（管理员/财务等）
 * - 否则按 AgentSeat.account 或 AgentSeat.email 匹配坐席，并确保存在对应 User
 *
 * 由 index.ts `app.post('/api/auth/session-from-account')` 与 settings 路由
 * `POST /api/settings/session-from-account` 共用，避免子路由挂载在部分环境下 404。
 */
export async function sessionFromAccountHandler(req: TenantRequest, res: Response): Promise<void> {
  if (!allowAccountSession()) {
    res.status(403).json({
      error: 'forbidden',
      message: '当前环境未开启按账号解析会话（需非 production 或设置 ALLOW_ACCOUNT_SESSION=1）',
    });
    return;
  }

  const tenantId = req.tenantId!;
  const b = z
    .object({
      account: z.string().optional(),
    })
    .safeParse(req.body);
  if (!b.success) {
    res.status(400).json({ error: 'bad_request', message: b.error.flatten().toString() });
    return;
  }

  const raw = (b.data.account ?? '').trim();
  const lookup = raw || 'admin@demo.local';

  try {
    if (lookup.includes('@')) {
      const user = await prisma.user.findUnique({
        where: { tenantId_email: { tenantId, email: lookup } },
      });
      if (!user) {
        res.status(404).json({
          error: 'user_not_found',
          message: `未找到邮箱为「${lookup}」的租户用户，请确认已在用户表中创建或使用正确邮箱登录`,
        });
        return;
      }
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: mapUserRole(user.role),
          avatar: user.avatar ?? undefined,
        },
      });
      return;
    }

    const seat = await prisma.agentSeat.findFirst({
      where: {
        tenantId,
        status: 'active',
        OR: [
          { account: { equals: lookup, mode: 'insensitive' } },
          { email: { equals: lookup, mode: 'insensitive' } },
        ],
      },
    });

    if (!seat) {
      res.status(404).json({
        error: 'seat_not_found',
        message: `未找到登录账号「${lookup}」对应的启用坐席；请检查坐席的「登录账号」或邮箱是否与输入一致`,
      });
      return;
    }

    const userId = await ensureUserLinkedToAgentSeat(seat);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(500).json({ error: 'internal_error', message: '坐席关联用户失败' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: mapUserRole(user.role),
        avatar: user.avatar ?? undefined,
      },
    });
  } catch (e) {
    console.error('[auth/session-from-account]', e);
    res.status(500).json({
      error: 'internal_error',
      message: e instanceof Error ? e.message : String(e),
    });
  }
}
