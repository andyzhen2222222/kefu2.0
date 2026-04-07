import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const order = await prisma.order.findFirst({
    where: { platformOrderId: '2603221641QKXNG' },
    include: { logisticsEvents: { orderBy: { timestamp: 'desc' } } }
  });
  console.log('Order:', order?.platformOrderId);
  console.log('Tracking:', order?.trackingNumber);
  console.log('Logistics Status:', order?.logisticsStatus);
  console.log('Events Count:', order?.logisticsEvents.length);
  if (order?.logisticsEvents.length) {
    console.log('Latest Event:', order.logisticsEvents[0]);
  }
}
main().finally(() => prisma.$disconnect());
