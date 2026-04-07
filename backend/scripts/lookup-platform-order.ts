import { PrismaClient } from '@prisma/client';

/** 用法: npx tsx scripts/lookup-platform-order.ts <platformOrderId> */
const prisma = new PrismaClient();

async function main() {
  const oid = process.argv[2] || '2603171446Q7K0O';
  const orders = await prisma.order.findMany({
    where: {
      OR: [{ platformOrderId: oid }, { platformOrderId: { contains: oid.slice(0, 8) } }],
    },
    select: {
      id: true,
      platformOrderId: true,
      tenantId: true,
      channelId: true,
      createdAt: true,
    },
    take: 30,
  });
  console.log('orders', JSON.stringify(orders, null, 2));

  const tickets = await prisma.ticket.findMany({
    where: {
      OR: [
        { subject: { contains: oid, mode: 'insensitive' } },
        { subjectOriginal: { contains: oid, mode: 'insensitive' } },
        { order: { platformOrderId: oid } },
        { order: { platformOrderId: { contains: oid.slice(0, 8) } } },
      ],
    },
    select: {
      id: true,
      externalId: true,
      orderId: true,
      subject: true,
      tenantId: true,
      channelId: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
    take: 30,
  });
  console.log('tickets', JSON.stringify(tickets, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
