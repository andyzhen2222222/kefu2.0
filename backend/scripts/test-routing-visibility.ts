import { prisma } from '../src/lib/prisma.js';
import { resolveTicketVisibility, ticketVisibilityWhereClause } from '../src/lib/ticketRoutingAssign.js';

async function runTest() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.log('No tenant found. Exiting.');
    return;
  }

  console.log(`Using Tenant: ${tenant.id}\n`);

  // 获取该租户下的所有用户
  const users = await prisma.user.findMany({ where: { tenantId: tenant.id } });
  
  for (const user of users) {
    console.log(`=========================================`);
    console.log(`Simulating login for User: ${user.email} (Role: ${user.role})`);
    
    // 解析该用户在这个租户下的坐席配置、管理渠道等上下文
    const vis = await resolveTicketVisibility(tenant.id, user.id);
    
    // 依据上下文生成对应的 Prisma Where 语句
    const clause = ticketVisibilityWhereClause(vis);
    
    console.log('\n--- Visibility Context ---');
    console.log({
      isAdmin: vis.isAdmin,
      seatIds: vis.seatIds,
      responsibleChannelIds: vis.responsibleChannelIds,
      restrictedChannelIds: vis.restrictedChannelIds,
    });

    console.log('\n--- Prisma Where Clause ---');
    console.log(JSON.stringify(clause, null, 2));

    // 根据该 Where 条件查询他们能看到的工单总数
    const visibleTicketsCount = await prisma.ticket.count({
      where: {
        tenantId: tenant.id,
        ...(Object.keys(clause).length > 0 ? clause : {})
      }
    });

    console.log(`\n=> Visible Tickets Count: ${visibleTicketsCount}`);
    console.log(`=========================================\n`);
  }
}

runTest().catch(console.error).finally(() => prisma.$disconnect());
