import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.ticket.count();
  console.log('Ticket count:', count);
  const tickets = await prisma.ticket.findMany({ take: 5, include: { channel: true, customer: true } });
  console.log('Sample tickets:', JSON.stringify(tickets, null, 2));
}

main().finally(() => prisma.$disconnect());