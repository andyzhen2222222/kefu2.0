import 'dotenv/config';
import {
  PrismaClient,
  TicketStatus,
  UserRole,
  AfterSalesType,
  AfterSalesStatus,
  AfterSalesPriority,
} from '@prisma/client';

const prisma = new PrismaClient();

/** 固定 UUID 便于 curl / 前端配置 */
export const SEED = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  adminUserId: '22222222-2222-4222-8222-222222222222',
  channelAmazonUs: '33333333-3333-4333-8333-333333333333',
  customerJohn: '44444444-4444-4444-8444-444444444444',
  order1: '55555555-5555-4555-8555-555555555555',
  ticket1: '66666666-6666-4666-8666-666666666666',
  ticket2: '77777777-7777-4777-8777-777777777777',
  seat1: '88888888-8888-4888-8888-888888888888',
};

async function main() {
  await prisma.tenant.upsert({
    where: { id: SEED.tenantId },
    create: { id: SEED.tenantId, name: 'Demo Merchant' },
    update: { name: 'Demo Merchant' },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: SEED.tenantId, email: 'admin@demo.local' } },
    create: {
      id: SEED.adminUserId,
      tenantId: SEED.tenantId,
      email: 'admin@demo.local',
      name: 'Admin Demo',
      role: UserRole.admin,
    },
    update: { name: 'Admin Demo', role: UserRole.admin },
  });

  await prisma.channel.upsert({
    where: { id: SEED.channelAmazonUs },
    create: {
      id: SEED.channelAmazonUs,
      tenantId: SEED.tenantId,
      displayName: 'Amazon US',
      platformType: 'AMAZON',
      defaultSlaHours: 24,
    },
    update: { displayName: 'Amazon US' },
  });

  await prisma.customer.upsert({
    where: { id: SEED.customerJohn },
    create: {
      id: SEED.customerJohn,
      tenantId: SEED.tenantId,
      name: 'John Doe',
      email: 'john@example.com',
      shippingCountry: 'US',
      sentiment: 'neutral',
      totalOrderValue: 100,
      ordersCount: 1,
    },
    update: { name: 'John Doe' },
  });

  await prisma.order.upsert({
    where: {
      tenantId_platformOrderId: {
        tenantId: SEED.tenantId,
        platformOrderId: '114-1234567-1234567',
      },
    },
    create: {
      id: SEED.order1,
      tenantId: SEED.tenantId,
      customerId: SEED.customerJohn,
      channelId: SEED.channelAmazonUs,
      platformOrderId: '114-1234567-1234567',
      productTitles: ['Demo SKU A'],
      skuList: ['SKU-A'],
      amount: 89.99,
      currency: 'USD',
      orderStatus: 'shipped',
      shippingStatus: 'In Transit',
      paymentStatus: 'Paid',
      hasVatInfo: true,
    },
    update: { orderStatus: 'shipped' },
  });

  await prisma.agentSeat.upsert({
    where: { id: SEED.seat1 },
    create: {
      id: SEED.seat1,
      tenantId: SEED.tenantId,
      displayName: '李娜',
      email: 'lina@demo.local',
      account: 'lina',
      roleId: 'default',
      status: 'active',
    },
    update: { displayName: '李娜' },
  });

  const slaDue = new Date(Date.now() + 36 * 60 * 60 * 1000);

  await prisma.ticket.upsert({
    where: { id: SEED.ticket1 },
    create: {
      id: SEED.ticket1,
      tenantId: SEED.tenantId,
      channelId: SEED.channelAmazonUs,
      customerId: SEED.customerJohn,
      orderId: SEED.order1,
      status: TicketStatus.new,
      priority: 1,
      sentiment: 'angry',
      intent: '要求退款',
      messageProcessingStatus: 'unread',
      subject: '商品损坏需要退款',
      subjectOriginal: 'Item damaged — need refund',
      slaDueAt: slaDue,
      tags: ['退款'],
      assignedSeatId: SEED.seat1,
    },
    update: {
      subject: '商品损坏需要退款',
      messageProcessingStatus: 'unread',
    },
  });

  await prisma.message.deleteMany({ where: { ticketId: SEED.ticket1 } });
  await prisma.message.createMany({
    data: [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
        ticketId: SEED.ticket1,
        senderId: 'John Doe',
        senderType: 'customer',
        content: 'The item arrived broken. I need a full refund.',
        isInternal: false,
      },
    ],
  });

  await prisma.ticket.upsert({
    where: { id: SEED.ticket2 },
    create: {
      id: SEED.ticket2,
      tenantId: SEED.tenantId,
      channelId: SEED.channelAmazonUs,
      customerId: SEED.customerJohn,
      status: TicketStatus.todo,
      priority: 2,
      sentiment: 'neutral',
      intent: '物流查询',
      messageProcessingStatus: 'unreplied',
      subject: '物流多久更新？',
      subjectOriginal: 'Any tracking updates?',
      slaDueAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      tags: ['物流'],
    },
    update: {},
  });

  await prisma.message.deleteMany({ where: { ticketId: SEED.ticket2 } });
  await prisma.message.create({
    data: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002',
      ticketId: SEED.ticket2,
      senderId: 'John Doe',
      senderType: 'customer',
      content: 'Package stuck — please advise.',
      isInternal: false,
    },
  });

  await prisma.slaRule.upsert({
    where: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001' },
    create: {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001',
      tenantId: SEED.tenantId,
      name: '默认 Amazon SLA',
      channelPattern: 'Amazon',
      warningHours: 4,
      timeoutHours: 24,
      enabled: true,
    },
    update: {},
  });

  await prisma.autoReplyRule.upsert({
    where: { id: 'cccccccc-cccc-4ccc-8ccc-000000000001' },
    create: {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000001',
      tenantId: SEED.tenantId,
      name: '物流自动回复（演示）',
      enabled: false,
      intentMatch: '物流查询',
      keywords: ['物流', 'tracking'],
      markRepliedOnSend: true,
    },
    update: {},
  });

  await prisma.ticketRoutingRule.upsert({
    where: { id: 'dddddddd-dddd-4ddd-8ddd-000000000001' },
    create: {
      id: 'dddddddd-dddd-4ddd-8ddd-000000000001',
      tenantId: SEED.tenantId,
      name: '高优先级 → 李娜',
      priority: 10,
      conditions: { minPriority: 1 },
      targetSeatId: SEED.seat1,
      enabled: true,
    },
    update: {},
  });

  const existingAs = await prisma.afterSalesRecord.findFirst({
    where: { tenantId: SEED.tenantId, ticketId: SEED.ticket1 },
  });
  if (!existingAs) {
    await prisma.afterSalesRecord.create({
      data: {
        id: 'eeeeeeee-eeee-4eee-8eee-000000000001',
        tenantId: SEED.tenantId,
        orderId: SEED.order1,
        ticketId: SEED.ticket1,
        type: AfterSalesType.refund,
        status: AfterSalesStatus.submitted,
        priority: AfterSalesPriority.high,
        handlingMethod: '原路退款',
        problemType: '损坏',
        buyerFeedback: '外包装破损',
      },
    });
  }

  console.log('Seed OK. Use headers:');
  console.log(`  X-Tenant-Id: ${SEED.tenantId}`);
  console.log(`  X-User-Id: ${SEED.adminUserId} (admin, for settings write)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
