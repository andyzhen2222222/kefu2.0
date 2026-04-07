import { prisma } from '../src/lib/prisma.js';

async function main() {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  
  const tickets = await prisma.ticket.findMany({
    where: {
      tenantId,
      order: {
        trackingNumber: { not: null, notIn: [''] }
      }
    },
    include: {
      order: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 5
  });

  for (const t of tickets) {
    console.log(`- 工单 ID: ${t.id} \n  订单号: ${t.order?.platformOrderId} \n  物流单号: ${t.order?.trackingNumber} \n`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());