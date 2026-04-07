import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const tracked = await prisma.order.findMany({
    where: {
      trackingNumber: { 
        not: null,
        not: ''
      }
    },
    select: {
      platformOrderId: true,
      trackingNumber: true,
      carrier: true,
      orderStatus: true
    },
    take: 50
  });
  console.log('Orders with tracking number:', tracked.length);
  console.log(JSON.stringify(tracked, null, 2));
}
main().finally(() => prisma.$disconnect());
