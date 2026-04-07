import { PrismaClient } from '@prisma/client';
import { SEED } from '../prisma/seed-constants.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up all seed/example data...');

  // Order of deletion to respect FKs
  
  // 1. AfterSalesRecord
  const delAfterSales = await prisma.afterSalesRecord.deleteMany({
    where: {
      OR: [
        { id: { startsWith: 'eeeeeeee-' } },
        { id: { startsWith: 'mock-' } }
      ]
    }
  });
  console.log(`Deleted ${delAfterSales.count} AfterSalesRecords.`);

  // 2. Messages
  const delMessages = await prisma.message.deleteMany({
    where: {
      OR: [
        { id: { startsWith: 'aaaaaaaa-' } },
        { id: { startsWith: 'msg-' } }
      ]
    }
  });
  console.log(`Deleted ${delMessages.count} Messages.`);

  // 3. Tickets
  const delTickets = await prisma.ticket.deleteMany({
    where: {
      OR: [
        { id: { startsWith: '66666666-' } },
        { id: { startsWith: '77777777-' } },
        { id: { startsWith: 'mock-' } },
        { id: 'aaaaaaaa-aaaa-4aaa-8aaa-ticket000013' }
      ]
    }
  });
  console.log(`Deleted ${delTickets.count} Tickets.`);

  // 4. LogisticsEvent (demo ones)
  // Our sync might have created some real ones, but we check by orderId link
  // If we delete demo orders later, these should cascade if prisma is set up, 
  // but let's be safe.

  // 5. Orders
  const delOrders = await prisma.order.deleteMany({
    where: {
      OR: [
        { id: { startsWith: '55555555-' } },
        { platformOrderId: '114-1234567-1234567' },
        { platformOrderId: '112-9988776-5544332' },
        { platformOrderId: '113-1111222-3333444' },
        { platformOrderId: '114-2222333-4444555' },
        { platformOrderId: '115-6666777-8888999' },
        { platformOrderId: 'DE-AMZ-2024-0001' },
        { platformOrderId: 'DE-AMZ-2024-0002' },
        { platformOrderId: '26-12345-67890' },
        { platformOrderId: '26-99887-11223' },
        { platformOrderId: 'SHOPIFY-1001' },
        { platformOrderId: 'SHOPIFY-1002' },
        { platformOrderId: '114-8877665-5544332' },
        { platformOrderId: 'DE-INV-TEST-2026' },
        { id: 'aaaaaaaa-aaaa-4aaa-8aaa-order0000013' }
      ]
    }
  });
  console.log(`Deleted ${delOrders.count} Orders.`);

  // 6. Customers (optional, keep if you want)
  const delCustomers = await prisma.customer.deleteMany({
    where: {
      id: { startsWith: '44444444-' }
    }
  });
  console.log(`Deleted ${delCustomers.count} Customers.`);

  // 7. Channels (optional, keep if you want, but these are clearly demo)
  // Note: real channels are synced with numeric externalShopId. 
  // Seed channels have UUIDs.
  const delChannels = await prisma.channel.deleteMany({
    where: {
      id: { startsWith: '33333333-' }
    }
  });
  console.log(`Deleted ${delChannels.count} Channels.`);

  console.log('Cleanup complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
