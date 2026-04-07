
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    where: {
      trackingNumber: { not: null, not: '' }
    },
    select: {
      id: true,
      platformOrderId: true,
      trackingNumber: true
    }
  });

  console.log(JSON.stringify(orders, null, 2));

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
