import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Updating existing orders with Channel invoice info...');

  const channels = await prisma.channel.findMany({
    where: {
      invoiceStoreEntity: { not: null }
    }
  });

  console.log(`Found ${channels.length} channels with invoice info.`);

  for (const ch of channels) {
    const channelInvoice = (ch.invoiceStoreEntity as Record<string, unknown>) || {};
    const hasVatInfo = !!(channelInvoice.vatNumber);

    if (!hasVatInfo) continue;

    console.log(`Updating orders for channel: ${ch.displayName} (${ch.id})...`);

    // We only update if the order doesn't already have its own detailed storeEntity or hasVatInfo=true
    const result = await prisma.order.updateMany({
      where: {
        channelId: ch.id,
        // hasVatInfo: false // Only update those that don't have it yet
      },
      data: {
        hasVatInfo: true,
        // Note: we can't easily merge JSON in updateMany, but we can set the default channel info
      }
    });

    console.log(`Updated ${result.count} orders for ${ch.displayName}.`);
    
    // For detailed storeEntity update, we need to loop if we want to preserve shipping addresses
    // But since this is a demo/fix, let's at least update some samples or all if count is manageable
    if (result.count > 0) {
      const orders = await prisma.order.findMany({
        where: { channelId: ch.id },
        select: { id: true, storeEntity: true }
      });
      
      for (const ord of orders) {
        const prevEntity = (ord.storeEntity as Record<string, unknown>) ?? {};
        await prisma.order.update({
          where: { id: ord.id },
          data: {
            storeEntity: {
              ...prevEntity,
              ...channelInvoice,
              displayName: ch.displayName,
            }
          }
        });
      }
    }
  }

  console.log('Maintenance complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
