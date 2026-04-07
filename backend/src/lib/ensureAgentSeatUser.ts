import { randomUUID } from 'crypto';
import { UserRole, type AgentSeat } from '@prisma/client';
import { prisma } from './prisma.js';

/**
 * 保证坐席在 User 表中有对应记录（邮箱一致），并写回 AgentSeat.userId。
 * 收件箱可见性按「登录 User.email ↔ 启用坐席.email」对齐，仅有坐席无 User 时无法以坐席身份请求 API。
 */
export async function ensureUserLinkedToAgentSeat(seat: AgentSeat): Promise<string> {
  if (seat.userId) {
    const u = await prisma.user.findFirst({ where: { id: seat.userId, tenantId: seat.tenantId } });
    if (u) return u.id;
  }

  const email = seat.email.trim();
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: seat.tenantId, email } },
    create: {
      id: randomUUID(),
      tenantId: seat.tenantId,
      email,
      name: seat.displayName,
      role: UserRole.agent,
    },
    update: { name: seat.displayName },
  });

  await prisma.agentSeat.updateMany({
    where: { id: seat.id, tenantId: seat.tenantId },
    data: { userId: user.id },
  });

  return user.id;
}
