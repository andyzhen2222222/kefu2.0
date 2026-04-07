import { prisma } from '../src/lib/prisma.js';
import { 
  syncChannelsFromMotherSystem, 
  syncInboxRefreshFromMotherSystem 
} from '../src/services/motherSystemSync.js';

async function main() {
  const token = process.env.NEZHA_API_TOKEN;
  if (!token) {
    console.error('No NEZHA_API_TOKEN found in environment variables.');
    process.exit(1);
  }

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('No tenant found in local DB.');
    process.exit(1);
  }

  console.log(`[1/3] 同步店铺 (Channels) ...`);
  const channelsCount = await syncChannelsFromMotherSystem(tenant.id, token);
  console.log(`已同步 ${channelsCount} 个店铺。`);

  console.log(`\n[2/3] 开始拉取母系统近 90 天数据 ...`);
  // 为了快点，我们可以先拉近 14 天的？不行，用户要求 90 天。
  const syncRes = await syncInboxRefreshFromMotherSystem(tenant.id, token, 90, { incremental: false });
  console.log('拉取结果:', syncRes);

  console.log(`\n[3/3] 正在筛选包含物流单号的关联工单...`);
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
