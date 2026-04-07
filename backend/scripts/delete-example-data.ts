import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const examplePlatformOrderIds = [
    '112-9988776-5544332',
    '26-12345-67890'
  ];

  console.log('Attempting to delete example orders:', examplePlatformOrderIds);

  const deleteResult = await prisma.order.deleteMany({
    where: {
      platformOrderId: {
        in: examplePlatformOrderIds
      }
    }
  });

  console.log(`Deleted ${deleteResult.count} orders.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
