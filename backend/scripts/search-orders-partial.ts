import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const ids = await prisma.order.findMany({
    where: {
      OR: [
        { platformOrderId: { contains: '82443972' } },
        { platformOrderId: { contains: '49642214' } },
        { platformOrderId: { contains: '2603221641' } }
      ]
    },
    select: { platformOrderId: true }
  });
  console.log(JSON.stringify(ids, null, 2));
}
main().finally(() => prisma.$disconnect());
