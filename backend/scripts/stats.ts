import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const channelCount = await prisma.channel.count();
  const orderCount = await prisma.order.count();
  const channelsWithOrders = await prisma.order.groupBy({ by: ['channelId'] });
  console.log('Total Channels in DB:', channelCount);
  console.log('Total Orders in DB:', orderCount);
  console.log('Unique Channels with Orders:', channelsWithOrders.length);
  
  const sampleChannels = await prisma.channel.findMany({ take: 5, select: { displayName: true, externalShopId: true } });
  console.log('Sample Channels:', JSON.stringify(sampleChannels, null, 2));
}
main().finally(() => prisma.$disconnect());
