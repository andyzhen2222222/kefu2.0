
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const order = await prisma.order.findFirst({
    where: {
      trackingNumber: '4PX3002626562853CN'
    },
    select: {
      id: true,
      platformOrderId: true,
      trackingNumber: true
    }
  });

  if (order) {
    console.log(JSON.stringify(order, null, 2));
  } else {
    console.log('Order not found');
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
