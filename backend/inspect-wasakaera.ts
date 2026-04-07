import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const channels = await prisma.channel.findMany({
    where: {
      displayName: { contains: 'WasakaEra' }
    }
  });

  console.log('--- Channels matching WasakaEra ---');
  channels.forEach(ch => {
    console.log(`ID: ${ch.id}`);
    console.log(`DisplayName: ${ch.displayName}`);
    console.log(`ExternalShopId: ${ch.externalShopId}`);
    console.log(`InvoiceStoreEntity: ${JSON.stringify(ch.invoiceStoreEntity, null, 2)}`);
    console.log('-----------------------------------');
  });

  const orders = await prisma.order.findMany({
    where: {
      channel: {
        displayName: { contains: 'WasakaEra' }
      }
    },
    take: 5
  });

  console.log('\n--- Sample Orders for WasakaEra ---');
  orders.forEach(ord => {
    console.log(`PlatformOrderId: ${ord.platformOrderId}`);
    console.log(`HasVatInfo: ${ord.hasVatInfo}`);
    console.log(`StoreEntity (Order Level): ${JSON.stringify(ord.storeEntity, null, 2)}`);
    console.log('-----------------------------------');
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
