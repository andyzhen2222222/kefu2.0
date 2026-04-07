import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const c = await prisma.channel.findMany({ take: 5 });
  console.log(c);
}

main().finally(() => prisma.$disconnect());