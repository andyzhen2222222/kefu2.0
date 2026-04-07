import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const order = await prisma.order.findFirst({
        where: { platformOrderId: '2603221641QKXNG' }
    });
    
    if (order) {
        console.log(`Updating order ${order.platformOrderId}...`);
        const now = new Date();
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
        
        await prisma.order.update({
            where: { id: order.id },
            data: {
                paidAt: twoHoursAgo,
                shippedAt: oneHourAgo,
                orderStatus: 'shipped'
            }
        });
        console.log('Update complete.');
        
        const updated = await prisma.order.findUnique({
            where: { id: order.id }
        });
        console.log('Updated Order Data:', JSON.stringify(updated, null, 2));
    } else {
        console.log('Order not found.');
    }
}

main().finally(() => prisma.$disconnect());
