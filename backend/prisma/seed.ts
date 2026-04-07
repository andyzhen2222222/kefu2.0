import 'dotenv/config';
import {
  PrismaClient,
  TicketStatus,
  UserRole,
  AfterSalesType,
  AfterSalesStatus,
  AfterSalesPriority,
} from '@prisma/client';
import { SEED } from './seed-constants.js';

const prisma = new PrismaClient();

async function main() {
  await prisma.tenant.upsert({
    where: { id: SEED.tenantId },
    create: { id: SEED.tenantId, name: 'Demo Merchant' },
    update: { name: 'Demo Merchant' },
  });

  await prisma.tenantSyncSettings.upsert({
    where: { tenantId: SEED.tenantId },
    create: {
      tenantId: SEED.tenantId,
      syncEnabled: true,
      messagePollIntervalSec: 300,
      orderPollIntervalSec: 900,
      incrementalSyncDays: 90,
      useSyncWatermark: true,
      messageSyncDisabledPlatformTypes: [],
      defaultNewShopOrderBackfillMode: 'recent_days',
      defaultNewShopOrderBackfillRecentDays: 90,
      defaultNewShopTicketBackfillMode: 'recent_days',
      defaultNewShopTicketBackfillRecentDays: 90,
      skipMockTickets: true,
    },
    update: {},
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

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: SEED.tenantId, email: 'finance@demo.local' } },
    create: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0002',
      tenantId: SEED.tenantId,
      email: 'finance@demo.local',
      name: 'Finance Demo',
      role: UserRole.finance,
    },
    update: { role: UserRole.finance },
  });

  await prisma.channel.upsert({
    where: { id: SEED.channelAmazonUs },
    create: {
      id: SEED.channelAmazonUs,
      tenantId: SEED.tenantId,
      displayName: 'Amazon US',
      platformType: 'AMAZON',
      region: 'US',
      defaultSlaHours: 24,
    },
    update: { displayName: 'Amazon US' },
  });

  await prisma.channel.upsert({
    where: { id: SEED.channelAmazonOutlet },
    create: {
      id: SEED.channelAmazonOutlet,
      tenantId: SEED.tenantId,
      displayName: 'Amazon US Outlet',
      platformType: 'AMAZON',
      region: 'US',
      defaultSlaHours: 48,
    },
    update: { displayName: 'Amazon US Outlet' },
  });

  await prisma.channel.upsert({
    where: { id: SEED.channelAmazonDe },
    create: {
      id: SEED.channelAmazonDe,
      tenantId: SEED.tenantId,
      displayName: 'Amazon DE',
      platformType: 'AMAZON',
      region: 'DE',
      defaultSlaHours: 24,
    },
    update: { displayName: 'Amazon DE' },
  });

  await prisma.channel.upsert({
    where: { id: SEED.channelEbayUk },
    create: {
      id: SEED.channelEbayUk,
      tenantId: SEED.tenantId,
      displayName: 'eBay UK',
      platformType: 'EBAY',
      region: 'UK',
      defaultSlaHours: 36,
    },
    update: { displayName: 'eBay UK' },
  });

  await prisma.channel.upsert({
    where: { id: SEED.channelShopify },
    create: {
      id: SEED.channelShopify,
      tenantId: SEED.tenantId,
      displayName: 'Shopify Main Store',
      platformType: 'SHOPIFY',
      region: 'GLOBAL',
      defaultSlaHours: 12,
    },
    update: { displayName: 'Shopify Main Store' },
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
      totalOrderValue: 320,
      ordersCount: 3,
    },
    update: { name: 'John Doe', totalOrderValue: 320, ordersCount: 3 },
  });

  await prisma.customer.upsert({
    where: { id: SEED.customerJane },
    create: {
      id: SEED.customerJane,
      tenantId: SEED.tenantId,
      name: 'Jane Smith',
      email: 'jane@example.com',
      shippingCountry: 'US',
      sentiment: 'joyful',
      totalOrderValue: 156.5,
      ordersCount: 2,
    },
    update: { name: 'Jane Smith' },
  });

  await prisma.customer.upsert({
    where: { id: SEED.customerWei },
    create: {
      id: SEED.customerWei,
      tenantId: SEED.tenantId,
      name: '王伟',
      email: 'wangwei@example.cn',
      shippingCountry: 'CN',
      sentiment: 'anxious',
      totalOrderValue: 49.99,
      ordersCount: 1,
    },
    update: { name: '王伟' },
  });

  await prisma.customer.upsert({
    where: { id: SEED.customerMaria },
    create: {
      id: SEED.customerMaria,
      tenantId: SEED.tenantId,
      name: 'Maria Garcia',
      email: 'maria@example.eu',
      shippingCountry: 'DE',
      sentiment: 'neutral',
      totalOrderValue: 210,
      ordersCount: 2,
    },
    update: { name: 'Maria Garcia' },
  });

  await prisma.customer.upsert({
    where: { id: SEED.customerTom },
    create: {
      id: SEED.customerTom,
      tenantId: SEED.tenantId,
      name: 'Tom Wilson',
      email: 'tom@example.co.uk',
      shippingCountry: 'GB',
      sentiment: 'angry',
      totalOrderValue: 88,
      ordersCount: 2,
    },
    update: { name: 'Tom Wilson' },
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
      storeEntity: {
        id: 'SE-001',
        legalName: 'VibeSports Global Ltd.',
        displayName: 'Amazon US - VibeSports',
        address: '100 California St, San Francisco, CA 94111, USA',
        vatNumber: 'US123456789',
      },
    },
    update: { orderStatus: 'shipped' },
  });

  /** 模拟订单 2：关联物流类工单 ticket2，便于侧栏展示订单 */
  await prisma.order.upsert({
    where: {
      tenantId_platformOrderId: {
        tenantId: SEED.tenantId,
        platformOrderId: '112-9988776-5544332',
      },
    },
    create: {
      id: SEED.order2,
      tenantId: SEED.tenantId,
      customerId: SEED.customerJane,
      channelId: SEED.channelAmazonUs,
      platformOrderId: '112-9988776-5544332',
      productTitles: ['Bluetooth Speaker X200'],
      skuList: ['SKU-BTX200'],
      amount: 56.5,
      currency: 'USD',
      orderStatus: 'shipped',
      shippingStatus: 'Out for delivery',
      trackingNumber: '1Z999AA10123456784',
      paymentStatus: 'Paid',
      hasVatInfo: false,
    },
    update: { orderStatus: 'shipped' },
  });

  /** 模拟订单 3：待发货 + 工单（产品咨询） */
  await prisma.order.upsert({
    where: {
      tenantId_platformOrderId: {
        tenantId: SEED.tenantId,
        platformOrderId: '113-1111222-3333444',
      },
    },
    create: {
      id: SEED.order3,
      tenantId: SEED.tenantId,
      customerId: SEED.customerWei,
      channelId: SEED.channelAmazonUs,
      platformOrderId: '113-1111222-3333444',
      productTitles: ['USB-C 数据线 2m'],
      skuList: ['SKU-USBC-2M'],
      amount: 12.99,
      currency: 'USD',
      orderStatus: 'unshipped',
      shippingStatus: 'Pending',
      paymentStatus: 'Paid',
      hasVatInfo: false,
    },
    update: { orderStatus: 'unshipped' },
  });

  /** 模拟订单 4：已发货 + 换货诉求工单 */
  await prisma.order.upsert({
    where: {
      tenantId_platformOrderId: {
        tenantId: SEED.tenantId,
        platformOrderId: '114-2222333-4444555',
      },
    },
    create: {
      id: SEED.order4,
      tenantId: SEED.tenantId,
      customerId: SEED.customerJohn,
      channelId: SEED.channelAmazonUs,
      platformOrderId: '114-2222333-4444555',
      productTitles: ['Running Shoes Size 42', 'Sport Socks'],
      skuList: ['SKU-SHOE-42', 'SKU-SOCK'],
      amount: 129.0,
      currency: 'USD',
      orderStatus: 'shipped',
      shippingStatus: 'Delivered',
      paymentStatus: 'Paid',
      hasVatInfo: true,
    },
    update: { orderStatus: 'shipped' },
  });

  /** 模拟订单 5：部分退款，暂无工单（可测「只搜订单号」登记售后） */
  await prisma.order.upsert({
    where: {
      tenantId_platformOrderId: {
        tenantId: SEED.tenantId,
        platformOrderId: '115-6666777-8888999',
      },
    },
    create: {
      id: SEED.order5,
      tenantId: SEED.tenantId,
      customerId: SEED.customerJane,
      channelId: SEED.channelAmazonUs,
      platformOrderId: '115-6666777-8888999',
      productTitles: ['Kitchen Scale Pro'],
      skuList: ['SCALE-PRO-01'],
      amount: 34.5,
      currency: 'USD',
      orderStatus: 'partial_refund',
      shippingStatus: 'Delivered',
      paymentStatus: 'Partially Refunded',
      refundStatus: 'Partial',
      hasVatInfo: false,
    },
    update: { orderStatus: 'partial_refund' },
  });

  /** 跨渠道订单：DE 待发货 · 发票 */
  await prisma.order.upsert({
    where: {
      tenantId_platformOrderId: {
        tenantId: SEED.tenantId,
        platformOrderId: 'DE-AMZ-2024-0001',
      },
    },
    create: {
      id: SEED.order6,
      tenantId: SEED.tenantId,
      customerId: SEED.customerMaria,
      channelId: SEED.channelAmazonDe,
      platformOrderId: 'DE-AMZ-2024-0001',
      productTitles: ['Kaffeemaschine Modell K'],
      skuList: ['DE-KAFFEE-01'],
      amount: 79.99,
      currency: 'EUR',
      orderStatus: 'unshipped',
      shippingStatus: 'Pending',
      paymentStatus: 'Paid',
      hasVatInfo: true,
      storeEntity: {
        id: 'SE-005',
        legalName: 'NextGen Retail DE GmbH',
        displayName: 'Amazon DE - NextGen',
        address: 'Kurfürstendamm 21, 10719 Berlin, Germany',
        vatNumber: 'DE321654987',
      },
    },
    update: { orderStatus: 'unshipped' },
  });

  /** eBay UK 已发货 */
  await prisma.order.upsert({
    where: {
      tenantId_platformOrderId: {
        tenantId: SEED.tenantId,
        platformOrderId: '26-12345-67890',
      },
    },
    create: {
      id: SEED.order7,
      tenantId: SEED.tenantId,
      customerId: SEED.customerTom,
      channelId: SEED.channelEbayUk,
      platformOrderId: '26-12345-67890',
      productTitles: ['Vintage Camera Lens 50mm'],
      skuList: ['EBAY-LENS-50'],
      amount: 145.0,
      currency: 'GBP',
      orderStatus: 'shipped',
      shippingStatus: 'In Transit',
      trackingNumber: 'EBAY-UK-TRK-998877',
      paymentStatus: 'Paid',
      hasVatInfo: false,
    },
    update: { orderStatus: 'shipped' },
  });

  /** Shopify 已妥投 */
  await prisma.order.upsert({
    where: {
      tenantId_platformOrderId: {
        tenantId: SEED.tenantId,
        platformOrderId: 'SHOPIFY-1001',
      },
    },
    create: {
      id: SEED.order8,
      tenantId: SEED.tenantId,
      customerId: SEED.customerJohn,
      channelId: SEED.channelShopify,
      platformOrderId: 'SHOPIFY-1001',
      productTitles: ['Organic Cotton Tee'],
      skuList: ['SPF-TEE-BLK-M'],
      amount: 29.0,
      currency: 'USD',
      orderStatus: 'shipped',
      shippingStatus: 'Delivered',
      paymentStatus: 'Paid',
      hasVatInfo: false,
    },
    update: { orderStatus: 'shipped' },
  });

  /** DE 已全额退款（仅历史工单，不测新建售后） */
  await prisma.order.upsert({
    where: {
      tenantId_platformOrderId: {
        tenantId: SEED.tenantId,
        platformOrderId: 'DE-AMZ-2024-0002',
      },
    },
    create: {
      id: SEED.order9,
      tenantId: SEED.tenantId,
      customerId: SEED.customerMaria,
      channelId: SEED.channelAmazonDe,
      platformOrderId: 'DE-AMZ-2024-0002',
      productTitles: ['Bluetooth Kopfhörer'],
      skuList: ['DE-BT-HP'],
      amount: 49.99,
      currency: 'EUR',
      orderStatus: 'refunded',
      shippingStatus: 'Returned',
      paymentStatus: 'Refunded',
      refundStatus: 'Full',
      hasVatInfo: true,
    },
    update: { orderStatus: 'refunded' },
  });

  /** eBay 部分退款 */
  await prisma.order.upsert({
    where: {
      tenantId_platformOrderId: {
        tenantId: SEED.tenantId,
        platformOrderId: '26-99887-11223',
      },
    },
    create: {
      id: SEED.order10,
      tenantId: SEED.tenantId,
      customerId: SEED.customerTom,
      channelId: SEED.channelEbayUk,
      platformOrderId: '26-99887-11223',
      productTitles: ['Desk Lamp LED'],
      skuList: ['EBAY-LAMP-LED'],
      amount: 32.5,
      currency: 'GBP',
      orderStatus: 'partial_refund',
      shippingStatus: 'Delivered',
      paymentStatus: 'Partially Refunded',
      refundStatus: 'Partial',
      hasVatInfo: false,
    },
    update: { orderStatus: 'partial_refund' },
  });

  /** Shopify 待发货 */
  await prisma.order.upsert({
    where: {
      tenantId_platformOrderId: {
        tenantId: SEED.tenantId,
        platformOrderId: 'SHOPIFY-1002',
      },
    },
    create: {
      id: SEED.order11,
      tenantId: SEED.tenantId,
      customerId: SEED.customerWei,
      channelId: SEED.channelShopify,
      platformOrderId: 'SHOPIFY-1002',
      productTitles: ['Yoga Mat Pro'],
      skuList: ['SPF-YOGA-PRO'],
      amount: 45.0,
      currency: 'USD',
      orderStatus: 'unshipped',
      shippingStatus: 'Pending',
      paymentStatus: 'Paid',
      hasVatInfo: false,
    },
    update: { orderStatus: 'unshipped' },
  });

  /** Amazon US Outlet 已发货（重发场景） */
  await prisma.order.upsert({
    where: {
      tenantId_platformOrderId: {
        tenantId: SEED.tenantId,
        platformOrderId: '114-8877665-5544332',
      },
    },
    create: {
      id: SEED.order12,
      tenantId: SEED.tenantId,
      customerId: SEED.customerJane,
      channelId: SEED.channelAmazonOutlet,
      platformOrderId: '114-8877665-5544332',
      productTitles: ['Phone Case Clear'],
      skuList: ['OUT-CASE-CLR'],
      amount: 19.99,
      currency: 'USD',
      orderStatus: 'shipped',
      shippingStatus: 'Delivered',
      paymentStatus: 'Paid',
      hasVatInfo: false,
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
      customerId: SEED.customerJane,
      orderId: SEED.order2,
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
    update: {
      customerId: SEED.customerJane,
      orderId: SEED.order2,
    },
  });

  await prisma.message.deleteMany({ where: { ticketId: SEED.ticket2 } });
  await prisma.message.create({
    data: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002',
      ticketId: SEED.ticket2,
      senderId: 'Jane Smith',
      senderType: 'customer',
      content: 'Package stuck — please advise.',
      translatedContent: '包裹卡住了，请提供建议。',
      isInternal: false,
    },
  });

  await prisma.ticket.upsert({
    where: { id: SEED.ticket3 },
    create: {
      id: SEED.ticket3,
      tenantId: SEED.tenantId,
      channelId: SEED.channelAmazonUs,
      customerId: SEED.customerWei,
      orderId: SEED.order3,
      status: TicketStatus.new,
      priority: 3,
      sentiment: 'anxious',
      intent: '产品咨询',
      messageProcessingStatus: 'unread',
      subject: '还没发货能改地址吗？',
      subjectOriginal: 'Can I change shipping address before ship?',
      slaDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      tags: ['地址'],
    },
    update: {},
  });

  await prisma.message.deleteMany({ where: { ticketId: SEED.ticket3 } });
  await prisma.message.create({
    data: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003',
      ticketId: SEED.ticket3,
      senderId: '王伟',
      senderType: 'customer',
      content: '你好，订单 113-1111222-3333444 请改寄深圳市南山区。',
      translatedContent: 'Hello, order 113-1111222-3333444 please redirect to Nanshan District, Shenzhen.',
      isInternal: false,
    },
  });

  await prisma.ticket.upsert({
    where: { id: SEED.ticket4 },
    create: {
      id: SEED.ticket4,
      tenantId: SEED.tenantId,
      channelId: SEED.channelAmazonUs,
      customerId: SEED.customerJohn,
      orderId: SEED.order4,
      status: TicketStatus.waiting,
      priority: 2,
      sentiment: 'neutral',
      intent: '换货',
      messageProcessingStatus: 'replied',
      subject: '鞋码偏小想换 43 码',
      subjectOriginal: 'Shoes too small — need size 43',
      slaDueAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      tags: ['换货'],
    },
    update: {},
  });

  await prisma.message.deleteMany({ where: { ticketId: SEED.ticket4 } });
  await prisma.message.createMany({
    data: [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004',
        ticketId: SEED.ticket4,
        senderId: 'John Doe',
        senderType: 'customer',
        content: 'Ordered 42 but too tight. Can I exchange for 43?',
        isInternal: false,
      },
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000005',
        ticketId: SEED.ticket4,
        senderId: '李娜',
        senderType: 'agent',
        content: '您好，可以换货。请在 48 小时内寄回原鞋并保持原包装。',
        isInternal: false,
      },
    ],
  });

  const slaOverdue2d = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const slaOverdue5d = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const slaFuture8h = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const slaFuture3d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const slaFuture7d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  /** ticket5 Amazon DE · 待发货 · SLA 已超时 · 发票 · 中性 · 待回复 */
  await prisma.ticket.upsert({
    where: { id: SEED.ticket5 },
    create: {
      id: SEED.ticket5,
      tenantId: SEED.tenantId,
      channelId: SEED.channelAmazonDe,
      customerId: SEED.customerMaria,
      orderId: SEED.order6,
      status: TicketStatus.todo,
      priority: 2,
      sentiment: 'neutral',
      intent: '发票相关',
      messageProcessingStatus: 'unreplied',
      subject: '需要开具公司抬头发票',
      subjectOriginal: 'Need VAT invoice with company name',
      slaDueAt: slaOverdue2d,
      tags: ['发票', 'B2B'],
    },
    update: {},
  });
  await prisma.message.deleteMany({ where: { ticketId: SEED.ticket5 } });
  await prisma.message.create({
    data: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000006',
      ticketId: SEED.ticket5,
      senderId: 'Maria Garcia',
      senderType: 'customer',
      content: 'Please send invoice to billing@firma.de — order DE-AMZ-2024-0001.',
      isInternal: false,
    },
  });

  /** ticket6 eBay UK · 已发货 · SLA 严重超时 · 差评威胁 · 愤怒 · 未读 */
  await prisma.ticket.upsert({
    where: { id: SEED.ticket6 },
    create: {
      id: SEED.ticket6,
      tenantId: SEED.tenantId,
      channelId: SEED.channelEbayUk,
      customerId: SEED.customerTom,
      orderId: SEED.order7,
      status: TicketStatus.new,
      priority: 1,
      sentiment: 'angry',
      intent: '差评威胁',
      messageProcessingStatus: 'unread',
      subject: '再不回就留差评',
      subjectOriginal: 'Leaving negative feedback if no reply',
      slaDueAt: slaOverdue5d,
      tags: ['紧急', 'eBay'],
    },
    update: {},
  });
  await prisma.message.deleteMany({ where: { ticketId: SEED.ticket6 } });
  await prisma.message.create({
    data: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000007',
      ticketId: SEED.ticket6,
      senderId: 'Tom Wilson',
      senderType: 'customer',
      content: 'Item not as described. I want return label TODAY.',
      isInternal: false,
    },
  });

  /** ticket7 Shopify · 已发货 · SLA 充裕 · 少发漏发 · 焦虑 · 已回复 */
  await prisma.ticket.upsert({
    where: { id: SEED.ticket7 },
    create: {
      id: SEED.ticket7,
      tenantId: SEED.tenantId,
      channelId: SEED.channelShopify,
      customerId: SEED.customerJohn,
      orderId: SEED.order8,
      status: TicketStatus.waiting,
      priority: 2,
      sentiment: 'anxious',
      intent: '少发漏发',
      messageProcessingStatus: 'replied',
      subject: '少发了一件黑色 M 码',
      subjectOriginal: 'Missing one black M tee from bundle',
      slaDueAt: slaFuture7d,
      tags: ['漏发', 'Shopify'],
      assignedSeatId: SEED.seat1,
    },
    update: {},
  });
  await prisma.message.deleteMany({ where: { ticketId: SEED.ticket7 } });
  await prisma.message.createMany({
    data: [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000008',
        ticketId: SEED.ticket7,
        senderId: 'John Doe',
        senderType: 'customer',
        content: 'Ordered 2 tees, only got 1. Order SHOPIFY-1001.',
        isInternal: false,
      },
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000009',
        ticketId: SEED.ticket7,
        senderId: '李娜',
        senderType: 'agent',
        content: '抱歉给您带来不便，我们正在仓库核实，24h 内给您补发单号。',
        isInternal: false,
      },
    ],
  });

  /** ticket8 Shopify · 已解决 · 营销关怀 · 开心 · 已回复（测已结单不占超时） */
  await prisma.ticket.upsert({
    where: { id: SEED.ticket8 },
    create: {
      id: SEED.ticket8,
      tenantId: SEED.tenantId,
      channelId: SEED.channelShopify,
      customerId: SEED.customerJohn,
      orderId: SEED.order8,
      status: TicketStatus.resolved,
      priority: 4,
      sentiment: 'joyful',
      intent: '营销关怀',
      messageProcessingStatus: 'replied',
      subject: '谢谢你们的快速发货！',
      subjectOriginal: 'Thanks for fast shipping!',
      slaDueAt: slaOverdue2d,
      resolvedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      firstResponseAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      tags: ['好评'],
    },
    update: {},
  });
  await prisma.message.deleteMany({ where: { ticketId: SEED.ticket8 } });
  await prisma.message.createMany({
    data: [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000081',
        ticketId: SEED.ticket8,
        senderId: 'John Doe',
        senderType: 'customer',
        content: 'Love the tee! Will order again.',
        isInternal: false,
      },
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000082',
        ticketId: SEED.ticket8,
        senderId: '李娜',
        senderType: 'agent',
        content: '感谢支持，欢迎常来！',
        isInternal: false,
      },
    ],
  });

  /** ticket9 Amazon DE · 订单已退款 · SLA 超时 · 中性 · 未读 */
  await prisma.ticket.upsert({
    where: { id: SEED.ticket9 },
    create: {
      id: SEED.ticket9,
      tenantId: SEED.tenantId,
      channelId: SEED.channelAmazonDe,
      customerId: SEED.customerMaria,
      orderId: SEED.order9,
      status: TicketStatus.new,
      priority: 3,
      sentiment: 'neutral',
      intent: '退款进度',
      messageProcessingStatus: 'unread',
      subject: '退款何时到账？',
      subjectOriginal: 'When will refund hit my card?',
      slaDueAt: slaOverdue2d,
      tags: ['退款查询'],
    },
    update: {},
  });
  await prisma.message.deleteMany({ where: { ticketId: SEED.ticket9 } });
  await prisma.message.create({
    data: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-00000000000c',
      ticketId: SEED.ticket9,
      senderId: 'Maria Garcia',
      senderType: 'customer',
      content: 'Order DE-AMZ-2024-0002 shows refunded but bank has nothing yet.',
      isInternal: false,
    },
  });

  /** ticket10 eBay · 部分退款 · 质量问题 · 愤怒 · 未读 · SLA 即将到期 */
  await prisma.ticket.upsert({
    where: { id: SEED.ticket10 },
    create: {
      id: SEED.ticket10,
      tenantId: SEED.tenantId,
      channelId: SEED.channelEbayUk,
      customerId: SEED.customerTom,
      orderId: SEED.order10,
      status: TicketStatus.todo,
      priority: 1,
      sentiment: 'angry',
      intent: '质量问题',
      messageProcessingStatus: 'unread',
      subject: '灯罩有裂纹，只退一半？',
      subjectOriginal: 'Lamp shade cracked — partial refund not OK',
      slaDueAt: slaFuture8h,
      tags: ['质量', '部分退款'],
    },
    update: {},
  });
  await prisma.message.deleteMany({ where: { ticketId: SEED.ticket10 } });
  await prisma.message.create({
    data: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-00000000000d',
      ticketId: SEED.ticket10,
      senderId: 'Tom Wilson',
      senderType: 'customer',
      content: '26-99887-11223 — I want full refund or replacement.',
      isInternal: false,
    },
  });

  /** ticket11 Shopify · 待发货 · 未分类意图 · 搁置 */
  await prisma.ticket.upsert({
    where: { id: SEED.ticket11 },
    create: {
      id: SEED.ticket11,
      tenantId: SEED.tenantId,
      channelId: SEED.channelShopify,
      customerId: SEED.customerWei,
      orderId: SEED.order11,
      status: TicketStatus.snoozed,
      priority: 4,
      sentiment: 'neutral',
      intent: '',
      messageProcessingStatus: 'unreplied',
      subject: '随机咨询',
      subjectOriginal: 'Quick question',
      slaDueAt: slaFuture3d,
      tags: [],
    },
    update: {},
  });
  await prisma.message.deleteMany({ where: { ticketId: SEED.ticket11 } });
  await prisma.message.create({
    data: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-00000000000e',
      ticketId: SEED.ticket11,
      senderId: '王伟',
      senderType: 'customer',
      content: '你好，瑜伽垫能刻字吗？不急，下周再回也行。',
      isInternal: false,
    },
  });

  /** ticket12 Amazon Outlet · 重发诉求 · 焦虑 · 已回复待买家 · SLA 超时 */
  await prisma.ticket.upsert({
    where: { id: SEED.ticket12 },
    create: {
      id: SEED.ticket12,
      tenantId: SEED.tenantId,
      channelId: SEED.channelAmazonOutlet,
      customerId: SEED.customerJane,
      orderId: SEED.order12,
      status: TicketStatus.waiting,
      priority: 2,
      sentiment: 'anxious',
      intent: '重发',
      messageProcessingStatus: 'replied',
      subject: '手机壳寄丢了请重发',
      subjectOriginal: 'Case never arrived — please reship',
      slaDueAt: slaOverdue2d,
      tags: ['重发', 'Outlet'],
      assignedSeatId: SEED.seat1,
    },
    update: {},
  });
  await prisma.message.deleteMany({ where: { ticketId: SEED.ticket12 } });
  await prisma.message.createMany({
    data: [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-00000000000f',
        ticketId: SEED.ticket12,
        senderId: 'Jane Smith',
        senderType: 'customer',
        content: 'Tracking shows delivered but I never got the package.',
        isInternal: false,
      },
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000010',
        ticketId: SEED.ticket12,
        senderId: '李娜',
        senderType: 'agent',
        content: '已为您登记重发，新单号将在明日邮件发送。',
        isInternal: false,
      },
    ],
  });

  /** ticket13 Amazon DE · 发票功能测试专用 (完整主体信息) */
  const orderId13 = 'aaaaaaaa-aaaa-4aaa-8aaa-order0000013';
  const ticketId13 = 'aaaaaaaa-aaaa-4aaa-8aaa-ticket000013';
  await prisma.order.upsert({
    where: {
      tenantId_platformOrderId: {
        tenantId: SEED.tenantId,
        platformOrderId: 'DE-INV-TEST-2026',
      },
    },
    create: {
      id: orderId13,
      tenantId: SEED.tenantId,
      customerId: SEED.customerMaria,
      channelId: SEED.channelAmazonDe,
      platformOrderId: 'DE-INV-TEST-2026',
      productTitles: ['Pro-Grade Yoga Mat', 'Foam Roller'],
      skuList: ['YG-MAT-01', 'FR-RED-01'],
      eanList: ['4250123456789', '4250123456790'],
      amount: 115.50,
      currency: 'EUR',
      orderStatus: 'shipped',
      shippingStatus: 'Delivered',
      paymentStatus: 'Paid',
      hasVatInfo: true,
      storeEntity: {
        id: 'SE-TEST-DE',
        legalName: 'IntelliDesk Global Trading GmbH',
        displayName: 'IntelliDesk DE Store',
        address: 'Friedrichstraße 100, 10117 Berlin, Germany',
        vatNumber: 'DE123456789',
        taxCode: 'HRB 123456 B',
      },
    },
    update: {
      hasVatInfo: true,
      storeEntity: {
        id: 'SE-TEST-DE',
        legalName: 'IntelliDesk Global Trading GmbH',
        displayName: 'IntelliDesk DE Store',
        address: 'Friedrichstraße 100, 10117 Berlin, Germany',
        vatNumber: 'DE123456789',
        taxCode: 'HRB 123456 B',
      },
    },
  });

  await prisma.ticket.upsert({
    where: { id: ticketId13 },
    create: {
      id: ticketId13,
      tenantId: SEED.tenantId,
      channelId: SEED.channelAmazonDe,
      customerId: SEED.customerMaria,
      orderId: orderId13,
      status: TicketStatus.todo,
      priority: 2,
      sentiment: 'neutral',
      intent: '发票相关',
      messageProcessingStatus: 'unreplied',
      subject: '【测试】请提供该订单的发票',
      subjectOriginal: 'Please provide invoice for this order',
      slaDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      tags: ['发票测试'],
    },
    update: {},
  });

  await prisma.message.deleteMany({ where: { ticketId: ticketId13 } });
  await prisma.message.create({
    data: {
      id: 'msg-inv-test-001',
      ticketId: ticketId13,
      senderId: 'Maria Garcia',
      senderType: 'customer',
      content: 'I need a commercial invoice for order DE-INV-TEST-2026. My company needs it for tax purposes.',
      translatedContent: '我需要订单 DE-INV-TEST-2026 的商业发票。我们公司报税需要用到。',
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
      replyContent: '您好，我们正在为您查询物流信息，请稍候。',
      markRepliedOnSend: true,
    },
    update: {
      replyContent: '您好，我们正在为您查询物流信息，请稍候。',
    },
  });

  await prisma.ticketRoutingRule.upsert({
    where: { id: 'dddddddd-dddd-4ddd-8ddd-000000000001' },
    create: {
      id: 'dddddddd-dddd-4ddd-8ddd-000000000001',
      tenantId: SEED.tenantId,
      name: 'Amazon US 店铺 → 李娜',
      priority: 10,
      conditions: {
        platformTypes: ['AMAZON'],
        channelIds: [SEED.channelAmazonUs],
        afterSalesTypes: [],
      },
      targetSeatId: SEED.seat1,
      enabled: true,
    },
    update: {
      conditions: {
        platformTypes: ['AMAZON'],
        channelIds: [SEED.channelAmazonUs],
        afterSalesTypes: [],
      },
    },
  });

  await prisma.afterSalesRecord.upsert({
    where: { id: 'eeeeeeee-eeee-4eee-8eee-000000000001' },
    create: {
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
    update: {
      buyerFeedback: '外包装破损',
    },
  });

  await prisma.afterSalesRecord.upsert({
    where: { id: 'eeeeeeee-eeee-4eee-8eee-000000000002' },
    create: {
      id: 'eeeeeeee-eeee-4eee-8eee-000000000002',
      tenantId: SEED.tenantId,
      orderId: SEED.order7,
      ticketId: SEED.ticket6,
      type: AfterSalesType.return,
      status: AfterSalesStatus.processing,
      priority: AfterSalesPriority.high,
      handlingMethod: '退货退款',
      problemType: '与描述不符',
      buyerFeedback: 'eBay 镜头与描述不符，已申请退货',
      returnCarrier: 'Royal Mail',
      returnTrackingNumber: 'RM-UK-778899',
    },
    update: {},
  });

  await prisma.afterSalesRecord.upsert({
    where: { id: 'eeeeeeee-eeee-4eee-8eee-000000000003' },
    create: {
      id: 'eeeeeeee-eeee-4eee-8eee-000000000003',
      tenantId: SEED.tenantId,
      orderId: SEED.order8,
      ticketId: SEED.ticket7,
      type: AfterSalesType.exchange,
      status: AfterSalesStatus.submitted,
      priority: AfterSalesPriority.medium,
      handlingMethod: '换货',
      problemType: '少发漏发',
      buyerFeedback: '补发黑色 M 码 T 恤',
    },
    update: {},
  });

  await prisma.afterSalesRecord.upsert({
    where: { id: 'eeeeeeee-eeee-4eee-8eee-000000000004' },
    create: {
      id: 'eeeeeeee-eeee-4eee-8eee-000000000004',
      tenantId: SEED.tenantId,
      orderId: SEED.order12,
      ticketId: SEED.ticket12,
      type: AfterSalesType.reissue,
      status: AfterSalesStatus.processing,
      priority: AfterSalesPriority.medium,
      handlingMethod: '重发',
      problemType: '物流丢件',
      buyerFeedback: '快递显示妥投但买家未收到，登记重发',
      reissueSku: 'OUT-CASE-CLR',
      reissueQuantity: 1,
    },
    update: {},
  });

  // --------- 新增近一周（过去 7 天内每天一条）的工单，用于丰富仪表盘折线图等统计数据 ---------
  for (let i = 1; i <= 7; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const mockId = `mock-trend-ticket-00${i}`;
    
    // 随机分配属性
    const cId = i % 2 === 0 ? SEED.channelAmazonUs : SEED.channelShopify;
    const custId = i % 2 === 0 ? SEED.customerJane : SEED.customerWei;
    const ordId = i % 2 === 0 ? SEED.order2 : SEED.order3;
    const status = i % 3 === 0 ? TicketStatus.resolved : TicketStatus.todo;
    const processing = status === TicketStatus.resolved ? 'replied' : (i % 2 === 0 ? 'unread' : 'unreplied');
    
    await prisma.ticket.upsert({
      where: { id: mockId },
      create: {
        id: mockId,
        tenantId: SEED.tenantId,
        channelId: cId,
        customerId: custId,
        orderId: ordId,
        status: status,
        priority: 2,
        sentiment: i % 2 === 0 ? 'neutral' : 'anxious',
        intent: '物流查询',
        messageProcessingStatus: processing,
        subject: `[测试] ${m}-${day} 工单`,
        subjectOriginal: `[Test] Ticket on ${m}-${day}`,
        slaDueAt: new Date(d.getTime() + 48 * 60 * 60 * 1000),
        createdAt: d,
        updatedAt: d,
        tags: ['趋势测试'],
      },
      update: {
        createdAt: d,
        updatedAt: d,
        status: status,
        messageProcessingStatus: processing,
      },
    });

    await prisma.message.deleteMany({ where: { ticketId: mockId } });
    await prisma.message.create({
      data: {
        id: `msg-trend-${i}-1`,
        ticketId: mockId,
        senderId: 'Test User',
        senderType: 'customer',
        content: `这是 ${m}月${day}日 的一条买家消息。`,
        isInternal: false,
        createdAt: d,
      },
    });
    
    // 如果是已解决的，再加一条回复
    if (status === TicketStatus.resolved) {
      const replyTime = new Date(d.getTime() + 2 * 60 * 60 * 1000); // 两小时后回复
      await prisma.message.create({
        data: {
          id: `msg-trend-${i}-2`,
          ticketId: mockId,
          senderId: '李娜',
          senderType: 'agent',
          content: `这是客服在 ${m}月${day}日 的回复。`,
          isInternal: false,
          createdAt: replyTime,
        },
      });
      // 更新解决时间
      await prisma.ticket.update({
        where: { id: mockId },
        data: { resolvedAt: replyTime, updatedAt: replyTime },
      });
    }
  }

  console.log('Seed OK. Use headers:');
  console.log(`  X-Tenant-Id: ${SEED.tenantId}`);
  console.log(`  X-User-Id: ${SEED.adminUserId} (admin) | finance@demo.local id: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0002`);
  console.log('Demo platform order IDs (搜索 / 售后登记):');
  console.log('  Amazon US: 114-1234567-1234567  112-9988776-5544332  114-2222333-4444555  115-6666777-8888999  114-8877665-5544332');
  console.log('  Amazon DE: DE-AMZ-2024-0001  DE-AMZ-2024-0002');
  console.log('  eBay UK: 26-12345-67890  26-99887-11223');
  console.log('  Shopify: SHOPIFY-1001  SHOPIFY-1002');
  console.log('工单矩阵：12 张（跨 5 店铺、多意图/情绪/SLA/订单状态/消息处理状态 + 4 种售后类型样例）');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
