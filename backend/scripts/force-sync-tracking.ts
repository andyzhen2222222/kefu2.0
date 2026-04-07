import { PrismaClient } from '@prisma/client';
import { syncOrderLogistics } from '../src/services/track17Adapter.js';

const prisma = new PrismaClient();

const mappings = [
    { orderId: '82443972-A', tracking: '4PX3002628128019CN' },
    { orderId: '49642214-A', tracking: '4PX3002591138329CN' },
    { orderId: '2603221641QKXNG', tracking: '4PX3002591776439CN' }
];

async function main() {
  for (const m of mappings) {
    const order = await prisma.order.findFirst({
      where: { platformOrderId: m.orderId }
    });

    if (order) {
      console.log(`Found order ${m.orderId}, updating tracking to ${m.tracking}...`);
      await prisma.order.update({
        where: { id: order.id },
        data: { trackingNumber: m.tracking }
      });

      console.log(`Triggering 17track sync for ${m.tracking}...`);
      const success = await syncOrderLogistics(order.id, m.tracking);
      console.log(`Sync for ${m.orderId}: ${success ? 'SUCCESS' : 'FAILED/REGISTERED'}`);
    } else {
      console.log(`Order ${m.orderId} NOT FOUND in local DB.`);
    }
  }
}

main().finally(() => prisma.$disconnect());
