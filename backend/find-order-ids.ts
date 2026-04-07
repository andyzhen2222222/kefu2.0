
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const trackingNumbers = [
    'UL013831660YP',
    '4PX3002621305097CN',
    'ES2481303486',
    '4PX3002626562853CN'
  ];

  console.log('Searching for orders with the following tracking numbers:');
  console.log(trackingNumbers);

  const results = [];

  for (const num of trackingNumbers) {
    const orders = await prisma.order.findMany({
      where: {
        trackingNumber: {
          contains: num
        }
      },
      select: {
        id: true,
        platformOrderId: true,
        trackingNumber: true
      }
    });

    if (orders.length > 0) {
      for (const order of orders) {
        results.push({
          requestedNumber: num,
          actualTrackingNumber: order.trackingNumber,
          platformOrderId: order.platformOrderId,
          internalOrderId: order.id
        });
      }
    } else {
      results.push({
        requestedNumber: num,
        status: 'Not Found'
      });
    }
  }

  console.log('\nResults:');
  console.log(JSON.stringify(results, null, 2));

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
