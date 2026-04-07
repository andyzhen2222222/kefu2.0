import { PrismaClient, TicketStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { computeAssignedSeatForChannelId } from '../lib/ticketRoutingAssign.js';
import { computeSlaDueAtForTicket } from '../lib/slaCompute.js';

const prisma = new PrismaClient();

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const FIRST_NAMES = ['John', 'Emma', 'Klaus', 'Marie', 'Yuki', 'Hiroshi', 'Chen', 'Wei', 'Carlos', 'Lucia'];
const LAST_NAMES = ['Smith', 'Johnson', 'Müller', 'Schmidt', 'Tanaka', 'Watanabe', 'Wang', 'Li', 'Garcia', 'Martinez'];
const COUNTRIES = ['US', 'UK', 'DE', 'FR', 'IT', 'ES', 'JP', 'AU'];

// 模拟买家的真实咨询原文及其翻译
const INTENT_MOCKS = [
  {
    intent: '物流查询',
    subject: 'Where is my order? (Tracking Not Updating)',
    subjectZH: '我的订单在哪里？（物流未更新）',
    content: "Hello, I noticed that the tracking information for my package hasn't updated for over a week. Could you please check the status for me?",
    contentZH: '你好，我注意到我的包裹物流信息已经超过一周没有更新了。能帮我查一下状态吗？'
  },
  {
    intent: '退款请求',
    subject: 'Item Arrived Damaged - Requesting Refund',
    subjectZH: '收到货物破损 - 申请退款',
    content: "I received the package today but the product is broken. I have attached photos. I would like to request a full refund.",
    contentZH: '我今天收到了包裹，但产品坏了。我附上了照片。我希望能申请全额退款。'
  },
  {
    intent: '产品咨询',
    subject: 'Question about product size and availability',
    subjectZH: '关于产品尺码和库存的问题',
    content: "Do you have the blue version in size Large? I want to place another order but couldn't find it in your store.",
    contentZH: '请问蓝色款还有 L 码吗？我想再下一单，但在你店里没找到。'
  },
  {
    intent: '发票索要',
    subject: 'Need VAT Commercial Invoice for my business',
    subjectZH: '需要商业发票用于报税',
    content: "Could you please provide a formal commercial invoice for my recent order? I need it for tax purposes. Thank you.",
    contentZH: '能为我最近的订单提供一份正式的商业发票吗？我需要它用于报税。谢谢。'
  },
  {
    intent: '地址修改',
    subject: 'Wrong shipping address provided',
    subjectZH: '收货地址填写错误',
    content: "Hi, I realized I gave the wrong house number. Can you please change it to #102 before you ship the item?",
    contentZH: '你好，我发现我写错了门牌号。发货前能帮我改成 102 号吗？'
  }
];

const ORDER_STATUSES = ['unshipped', 'shipped', 'refunded', 'partial_refund'];

export async function generateMockTicketsForChannels(tenantId: string, countPerChannel: number = 2) {
  const channels = await prisma.channel.findMany({
    where: { tenantId }
  });

  if (channels.length === 0) {
    console.log("No channels found. Please sync channels first.");
    return 0;
  }

  const activeChannels = channels.slice(0, 15);
  let ticketsCreated = 0;

  for (const channel of activeChannels) {
    for (let i = 0; i < countPerChannel; i++) {
      // 2. 生成 Customer
      const firstName = randomItem(FIRST_NAMES);
      const lastName = randomItem(LAST_NAMES);
      const customer = await prisma.customer.create({
        data: {
          tenantId,
          name: `${firstName} ${lastName}`,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 1000)}@example.com`,
          shippingCountry: randomItem(COUNTRIES),
          sentiment: randomItem(['neutral', 'anxious', 'angry', 'joyful']),
          totalOrderValue: Math.floor(Math.random() * 500) + 50,
          ordersCount: Math.floor(Math.random() * 5) + 1,
        }
      });

      // 3. 生成 Mock Order
      const orderStatus = randomItem(ORDER_STATUSES);
      const platformOrderId = `ORD-${Math.floor(Math.random() * 10000000).toString().padStart(8, '0')}`;
      const order = await prisma.order.create({
        data: {
          tenantId,
          customerId: customer.id,
          channelId: channel.id,
          platformOrderId,
          amount: customer.totalOrderValue,
          currency: 'USD',
          orderStatus: orderStatus,
          shippingStatus: orderStatus === 'shipped' ? 'Shipped' : orderStatus === 'unshipped' ? 'AwaitingDeliver' : 'Refunded',
          skuList: ['SKU-' + Math.floor(Math.random() * 9999)],
          productTitles: [`${randomItem(['Premium', 'Ultra', 'Smart', 'Elite'])} ${randomItem(['Wireless Headphones', 'Mechanical Keyboard', 'Leather Wallet', 'Office Chair'])}`],
          storeEntity: {
            displayName: channel.displayName,
            address: `${Math.floor(Math.random() * 1000)} Main St, ${randomItem(['New York', 'London', 'Berlin', 'Paris', 'Tokyo'])}`,
          },
          createdAt: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 10), // 过去 10 天内
          updatedAt: new Date(),
        }
      });

      // 4. 生成 Ticket
      const mock = randomItem(INTENT_MOCKS);
      const createdAt = new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 48);
      const isRead = Math.random() > 0.4;
      const status: TicketStatus = isRead ? TicketStatus.todo : TicketStatus.new;
      
      const assignedSeatId = await computeAssignedSeatForChannelId(tenantId, channel.id, {
        intent: mock.intent,
      });
      const ticket = await prisma.ticket.create({
        data: {
          tenantId,
          channelId: channel.id,
          customerId: customer.id,
          orderId: order.id,
          status,
          priority: Math.floor(Math.random() * 3) + 1,
          sentiment: customer.sentiment,
          intent: mock.intent,
          messageProcessingStatus: isRead ? 'unreplied' : 'unread',
          // subject 存储为中文，subjectOriginal 存储为英文原文
          // 这样开启自动翻译时看到中文，关闭时看到英文，且不带店铺名
              subject: mock.subjectZH,
              subjectOriginal: mock.subject,
              slaDueAt: await computeSlaDueAtForTicket(tenantId, channel, createdAt),
              createdAt,
              updatedAt: new Date(createdAt.getTime() + 1000 * 60 * 5),
          isImportant: Math.random() > 0.8,
          assignedSeatId,
        }
      });

      // 5. 生成 Message
      await prisma.message.create({
        data: {
          ticketId: ticket.id,
          senderId: customer.name,
          senderType: 'customer',
          // content 为原文，translatedContent 为同步时自带的翻译
          content: mock.content,
          translatedContent: mock.contentZH,
          createdAt: createdAt,
        }
      });

      ticketsCreated++;
    }
  }

  console.log(`Successfully generated ${ticketsCreated} mock tickets with original text (English) and translations.`);
  return ticketsCreated;
}

async function run() {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  await generateMockTicketsForChannels(tenantId, 3);
  prisma.$disconnect();
}

import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run();
}
