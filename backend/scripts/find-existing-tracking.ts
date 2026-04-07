import { prisma } from '../src/lib/prisma.js';

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('No tenant found in local DB.');
    process.exit(1);
  }

  console.log(`\n正在筛选数据库中已包含物流单号的关联工单...`);
  const tickets = await prisma.ticket.findMany({
    where: {
      tenantId: tenant.id,
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
    take: 50
  });

  const validTickets = tickets.filter(t => t.order?.trackingNumber && t.order.trackingNumber.trim() !== '');

  console.log(`\n找到 ${validTickets.length} 条工单所关联的订单包含物流信息：\n`);
  for (const t of validTickets) {
    console.log(`- 工单 ID: ${t.id}`);
    console.log(`  母系统工单 ID (externalId): ${t.externalId}`);
    console.log(`  工单标题: ${t.subject}`);
    console.log(`  订单号 (Platform): ${t.order?.platformOrderId}`);
    console.log(`  物流承运商: ${t.order?.carrier || 'N/A'}`);
    console.log(`  物流单号: ${t.order?.trackingNumber}`);
    console.log(`  订单状态: ${t.order?.orderStatus} / 物流状态: ${t.order?.shippingStatus}`);
    console.log('----------------------------------------------------');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
