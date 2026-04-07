import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const channel = await prisma.channel.findFirst({
    where: {
      displayName: { contains: 'WasakaEra' }
    }
  });

  if (!channel) {
    console.log('Channel WasakaEra not found');
    return;
  }

  console.log(`Channel: ${channel.displayName} (${channel.id})`);
  console.log(`Channel InvoiceStoreEntity: ${JSON.stringify(channel.invoiceStoreEntity, null, 2)}`);

  const totalOrders = await prisma.order.count({
    where: { channelId: channel.id }
  });

  const vatOrders = await prisma.order.count({
    where: { channelId: channel.id, hasVatInfo: true }
  });

  console.log(`Total Orders: ${totalOrders}`);
  console.log(`Orders with VAT Info: ${vatOrders}`);

  if (vatOrders > 0) {
    const sample = await prisma.order.findFirst({
      where: { channelId: channel.id, hasVatInfo: true }
    });
    console.log(`Sample VAT Order StoreEntity: ${JSON.stringify(sample?.storeEntity, null, 2)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
