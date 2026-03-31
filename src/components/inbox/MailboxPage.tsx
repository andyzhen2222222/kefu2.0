import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import InboxList from './InboxList';
import TicketDetail from '../ticket/TicketDetail';
import {
  Ticket,
  TicketStatus,
  Sentiment,
  Message,
  Order,
  Customer,
  LogisticsStatus,
} from '@/src/types';
import { useAuth } from '@/src/hooks/useAuth';
import { MessageSquare } from 'lucide-react';
import {
  intellideskConfigured,
  intellideskTenantId,
  intellideskUserIdForApi,
  fetchTicketsList,
  fetchTicketDetail,
  fetchAgentSeats,
  patchTicket,
  postTicketMessage,
  mapApiTicketToUi,
  mapApiMessageToUi,
  mapApiCustomerToUi,
  mapApiOrderToUi,
  intellideskWsUrl,
  type PatchTicketBody,
  type ApiMessageRaw,
  type ApiTicketRaw,
} from '@/src/services/intellideskApi';

/** 与设置-坐席与分配中的演示坐席 id 对齐 */
const MAILBOX_SEAT_OPTIONS: { id: string; label: string }[] = [
  { id: 'seat-1', label: '李娜' },
  { id: 'seat-2', label: '王强' },
];

/** 演示：模拟译为店铺平台语言（真实环境由母系统语种 + 翻译接口生成） */
function mockTranslateToPlatformLanguage(text: string, channelId: string): string {
  const prefix = channelId.toLowerCase().includes('amazon')
    ? '[Amazon US · English]'
    : channelId.toLowerCase().includes('ebay')
      ? '[eBay · English]'
      : `[${channelId} · 平台语]`;
  const rough = text
    .replace(/你好/g, 'Hello')
    .replace(/抱歉/g, 'sorry')
    .replace(/退款/g, 'refund')
    .replace(/。/g, '. ')
    .replace(/，/g, ', ')
    .replace(/？/g, '? ')
    .trim();
  return `${prefix} ${rough || text}`;
}

// Mock Data（同店铺多条时：字段最全、时间最新的排在该店铺首位 → 列表按时间降序）
const MOCK_TICKETS: Ticket[] = [
  /** Amazon US · 演示「完整字段」置顶：未读红点 + 短 SLA + 退款单 + 愤怒 + 未回复 */
  {
    id: 'T-1001',
    channelId: 'Amazon US',
    customerId: 'C-5001',
    orderId: 'ORD-9901',
    status: TicketStatus.NEW,
    priority: 1,
    sentiment: Sentiment.ANGRY,
    intent: '要求退款',
    subject: '商品到达时已损坏 - 需要立即退款',
    subjectOriginal: 'Item arrived damaged — need immediate refund',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
    slaDueAt: new Date(Date.now() + 1000 * 60 * 35).toISOString(),
    isImportant: true,
    isFavorite: true,
    isShared: true,
    tags: ['损坏', '退款', '紧急', 'A-to-Z'],
    assignedSeatId: 'seat-1',
    messageProcessingStatus: 'unread',
  },
  /** Amazon US · SLA 已超时（红钟）+ 已发货 + 平静 + 未回复 */
  {
    id: 'T-1010',
    channelId: 'Amazon US',
    customerId: 'C-5010',
    orderId: 'ORD-9910',
    status: TicketStatus.TODO,
    priority: 2,
    sentiment: Sentiment.NEUTRAL,
    intent: '物流查询',
    subject: '物流卡在海关一周了，什么时候能更新？',
    subjectOriginal: 'Package stuck at customs for a week — any updates?',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    slaDueAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    isImportant: false,
    isFavorite: false,
    isShared: false,
    tags: ['物流'],
    assignedSeatId: 'seat-2',
    messageProcessingStatus: 'unreplied',
  },
  /** Amazon US · SLA 已达标（绿）+ 未发货 + 开心 + 已回复 */
  {
    id: 'T-1011',
    channelId: 'Amazon US',
    customerId: 'C-5011',
    orderId: 'ORD-9911',
    status: TicketStatus.RESOLVED,
    priority: 3,
    sentiment: Sentiment.JOYFUL,
    intent: '产品咨询',
    subject: '谢谢，蓝色款已下单，期待收货',
    subjectOriginal: 'Thanks — ordered the blue one, looking forward to delivery',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    slaDueAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    isImportant: false,
    isFavorite: false,
    isShared: false,
    tags: ['售前'],
    messageProcessingStatus: 'replied',
  },
  /** Amazon US · 长剩余 SLA（琥珀钟）+ 部分退款 + 焦急 + 未回复 */
  {
    id: 'T-1012',
    channelId: 'Amazon US',
    customerId: 'C-5012',
    orderId: 'ORD-9912',
    status: TicketStatus.WAITING,
    priority: 2,
    sentiment: Sentiment.ANXIOUS,
    intent: '部分退款进度',
    subject: '部分退款什么时候到账？银行还没收到',
    subjectOriginal: 'When will the partial refund post? Bank still shows nothing',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    slaDueAt: new Date(Date.now() + 1000 * 60 * 60 * 5).toISOString(),
    isImportant: true,
    isFavorite: false,
    isShared: false,
    tags: ['退款', '财务'],
    messageProcessingStatus: 'unreplied',
  },
  /** Amazon US · 无关联订单（订单图标「未知」）+ 未读 */
  {
    id: 'T-1013',
    channelId: 'Amazon US',
    customerId: 'C-5013',
    orderId: undefined,
    status: TicketStatus.NEW,
    priority: 4,
    sentiment: Sentiment.NEUTRAL,
    intent: '账号与优惠券',
    subject: 'Prime 会员折扣没有自动应用，请核实',
    subjectOriginal: 'Prime discount was not applied at checkout — please verify',
    createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    slaDueAt: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(),
    isImportant: false,
    isFavorite: false,
    isShared: false,
    tags: ['账号'],
    messageProcessingStatus: 'unread',
  },
  /** Amazon US · 已回复 + 已发货（蓝货车） */
  {
    id: 'T-1014',
    channelId: 'Amazon US',
    customerId: 'C-5014',
    orderId: 'ORD-9913',
    status: TicketStatus.WAITING,
    priority: 3,
    sentiment: Sentiment.NEUTRAL,
    intent: '修改地址',
    subject: '发货前能否改成次日达地址？',
    subjectOriginal: 'Can you switch to a next-day delivery address before ship?',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    slaDueAt: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(),
    isImportant: false,
    isFavorite: false,
    isShared: false,
    tags: ['地址'],
    messageProcessingStatus: 'replied',
  },
  {
    id: 'T-1002',
    channelId: 'eBay UK',
    customerId: 'C-5002',
    orderId: 'ORD-9902',
    status: TicketStatus.TODO,
    priority: 2,
    sentiment: Sentiment.ANXIOUS,
    intent: '查询物流',
    subject: '我的订单在哪里？物流信息未更新',
    subjectOriginal: 'Where is my order? Tracking has not updated',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
    slaDueAt: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
    isImportant: false,
    isFavorite: true,
    isShared: false,
    tags: ['物流', '追踪'],
    messageProcessingStatus: 'unreplied',
  },
  {
    id: 'T-1003',
    channelId: 'Shopify Main Store',
    customerId: 'C-5003',
    orderId: 'ORD-9903',
    status: TicketStatus.WAITING,
    priority: 3,
    sentiment: Sentiment.JOYFUL,
    intent: '产品咨询',
    subject: '非常喜欢这个产品！有蓝色的吗？',
    subjectOriginal: 'I really love this product! Do you have it in blue?',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    slaDueAt: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(),
    isImportant: false,
    isFavorite: false,
    isShared: false,
    tags: ['售前', '产品信息'],
    messageProcessingStatus: 'replied',
  },
  {
    id: 'T-1004',
    channelId: 'Amazon UK',
    customerId: 'C-5004',
    orderId: 'ORD-9904',
    status: TicketStatus.NEW,
    priority: 2,
    sentiment: Sentiment.NEUTRAL,
    intent: '索要发票',
    subject: 'Need VAT invoice for order 123-456789',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    slaDueAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    isImportant: false,
    isFavorite: false,
    isShared: false,
    tags: ['发票', '财务'],
    messageProcessingStatus: 'unread',
  },
  {
    id: 'T-1005',
    channelId: 'Amazon DE',
    customerId: 'C-5005',
    orderId: 'ORD-9905',
    status: TicketStatus.RESOLVED,
    priority: 3,
    sentiment: Sentiment.NEUTRAL,
    intent: '修改地址',
    subject: 'Can I change my shipping address?',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 47).toISOString(),
    slaDueAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    isImportant: false,
    isFavorite: false,
    isShared: false,
    tags: ['修改信息', '售中'],
    messageProcessingStatus: 'replied',
  },
  {
    id: 'T-1006',
    channelId: 'Walmart',
    customerId: 'C-5006',
    orderId: 'ORD-9906',
    status: TicketStatus.TODO,
    priority: 1,
    sentiment: Sentiment.ANGRY,
    intent: '未收到货',
    subject: 'Tracking says delivered but I got nothing!',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    slaDueAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    isImportant: true,
    isFavorite: false,
    isShared: true,
    tags: ['丢件', '紧急', '售后'],
    messageProcessingStatus: 'unreplied',
  },
];

const MOCK_MESSAGES: Record<string, Message[]> = {
  'T-1001': [
    {
      id: 'M-1',
      ticketId: 'T-1001',
      senderId: 'John Doe',
      senderType: 'customer',
      content:
        "Hello, I received my order today but the package was completely crushed and the product inside is damaged. I've attached photos. I need a refund as soon as possible.",
      translatedContent:
        '你好，我今天收到了我的订单，但是包装完全被压坏了，里面的产品也坏了。我附上了照片。我需要尽快退款。',
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: 'M-1m',
      ticketId: 'T-1001',
      senderId: 'Amazon 账户经理',
      senderType: 'manager',
      content:
        'The buyer has opened an A-to-z claim on this order. Please respond within 24 hours and complete a refund or negotiate a resolution to protect account health.',
      translatedContent:
        '该订单买家已发起 A-to-Z，请优先在 24 小时内响应并完成退款或协商方案，避免影响账户绩效。',
      createdAt: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
    },
    {
      id: 'M-2',
      ticketId: 'T-1001',
      senderId: 'AI 助手',
      senderType: 'ai',
      content:
        "We're sorry to hear your item arrived damaged. Under our damaged goods policy, we can offer a full refund or a replacement. Would you prefer a refund to your original payment method, or should we ship a replacement today?",
      translatedContent:
        '很抱歉听到您的商品到达时已损坏。根据我们的损坏商品政策，我们可以提供全额退款或换货。您希望退款到原支付方式，还是我们今天给您寄一个新的？',
      createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    },
    {
      id: 'M-2n',
      ticketId: 'T-1001',
      senderId: 'Lisa（客服）',
      senderType: 'agent',
      content: '@组长 买家已上传破损照片，建议走全额退款，避免纠纷升级。',
      createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
      isInternal: true,
    }
  ],
  'T-1002': [
    {
      id: 'M-3',
      ticketId: 'T-1002',
      senderId: 'Alice Smith',
      senderType: 'customer',
      content: "Hi, tracking information hasn't updated for 3 days. Where is my order?",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    }
  ],
  'T-1003': [
    {
      id: 'M-4',
      ticketId: 'T-1003',
      senderId: 'Bob Johnson',
      senderType: 'customer',
      content: "I really love the product! Do you have it in blue color?",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      id: 'M-5',
      ticketId: 'T-1003',
      senderId: 'Customer Service',
      senderType: 'agent',
      content: "Hi Bob! Thank you for your support. Yes, we do have it in blue. Here is the link to the blue version: ...",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    }
  ],
  'T-1004': [
    {
      id: 'M-6',
      ticketId: 'T-1004',
      senderId: 'Company Ltd',
      senderType: 'customer',
      content: "Hello, could you please provide a VAT invoice for my recent order?",
      createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    }
  ],
  'T-1005': [
    {
      id: 'M-7',
      ticketId: 'T-1005',
      senderId: 'Klaus Müller',
      senderType: 'customer',
      content: "Can I change my shipping address to Berlin?",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    },
    {
      id: 'M-8',
      ticketId: 'T-1005',
      senderId: 'Customer Service',
      senderType: 'agent',
      content: "Hi Klaus, I have updated your shipping address to Berlin. The package will be shipped there.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 47).toISOString(),
    }
  ],
  'T-1006': [
    {
      id: 'M-9',
      ticketId: 'T-1006',
      senderId: 'Mike Brown',
      senderType: 'customer',
      content: "The tracking says my package was delivered yesterday, but I checked everywhere and it's not here! This is unacceptable!",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
    }
  ],
  'T-1010': [
    {
      id: 'M-10',
      ticketId: 'T-1010',
      senderId: 'Sarah Chen',
      senderType: 'customer',
      content: 'My package has been stuck at customs for a week. Can you check with the carrier?',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    },
  ],
  'T-1011': [
    {
      id: 'M-11',
      ticketId: 'T-1011',
      senderId: 'Tom Lee',
      senderType: 'customer',
      content: 'Do you have the blue version? I want to place another order.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    },
    {
      id: 'M-12',
      ticketId: 'T-1011',
      senderId: '客服',
      senderType: 'agent',
      content: 'Hi Tom, yes — here is the link to the blue SKU. Thank you for your support!',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 11).toISOString(),
    },
  ],
  'T-1012': [
    {
      id: 'M-13',
      ticketId: 'T-1012',
      senderId: 'Emma Davis',
      senderType: 'customer',
      content: 'You approved a partial refund but my bank still shows nothing after 5 days.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    },
  ],
  'T-1013': [
    {
      id: 'M-14',
      ticketId: 'T-1013',
      senderId: 'Alex Rivera',
      senderType: 'customer',
      content: 'My Prime discount was not applied at checkout for order #pending. Please fix.',
      createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    },
  ],
  'T-1014': [
    {
      id: 'M-15',
      ticketId: 'T-1014',
      senderId: 'Jordan Kim',
      senderType: 'customer',
      content: 'Can I change the ship-to address before it leaves the warehouse?',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    },
    {
      id: 'M-16',
      ticketId: 'T-1014',
      senderId: '客服',
      senderType: 'agent',
      content: 'Updated to your new address. You will receive a confirmation email shortly.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
  ],
};

const MOCK_ORDERS: Record<string, Order> = {
  'ORD-9901': {
    id: 'ORD-9901',
    platformOrderId: '114-1234567-1234567',
    customerId: 'C-5001',
    channelId: 'Amazon US',
    skuList: ['SKU-VIBE-RED'],
    productTitles: ['Vibrant Red Skateboard - Pro Edition'],
    amount: 89.99,
    currency: 'USD',
    orderStatus: 'refunded',
    shippingStatus: 'Delivered',
    trackingNumber: '1Z999AA10123456784',
    deliveryEta: 'Mar 24, 2026',
    paymentStatus: 'Paid',
    carrier: 'UPS',
    hasVatInfo: true,
    logisticsStatus: LogisticsStatus.DELIVERED,
    logisticsEvents: [
      {
        id: 'L-1',
        status: LogisticsStatus.DELIVERED,
        subStatus: 'Delivered_Signed',
        description: '包裹已由收件人签收确认 (Signed by: JOHN DOE)',
        location: 'Madrid, ES',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString()
      },
      {
        id: 'L-2',
        status: LogisticsStatus.OUT_FOR_DELIVERY,
        subStatus: 'OutForDelivery_Other',
        description: '快递员已取出包裹，正在派送途中',
        location: 'Madrid, ES',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2 - 1000 * 60 * 60 * 4).toISOString()
      },
      {
        id: 'L-3',
        status: LogisticsStatus.IN_TRANSIT,
        subStatus: 'InTransit_Arrival',
        description: '包裹已抵达目的国 / 地区处理中心',
        location: 'Madrid, ES',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString()
      },
      {
        id: 'L-4',
        status: LogisticsStatus.IN_TRANSIT,
        subStatus: 'InTransit_Departure',
        description: '包裹已离开出发国 / 地区处理中心',
        location: 'Shenzhen, CN',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString()
      },
      {
        id: 'L-5',
        status: LogisticsStatus.IN_TRANSIT,
        subStatus: 'InTransit_PickedUp',
        description: '运输商已从发件人处取件',
        location: 'Shenzhen, CN',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString()
      },
      {
        id: 'L-6',
        status: LogisticsStatus.INFO_RECEIVED,
        subStatus: 'InfoReceived',
        description: '发货人创建面单、物流商接单，尚未揽收',
        location: '',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString()
      }
    ]
  },
  'ORD-9902': {
    id: 'ORD-9902',
    platformOrderId: '115-9876543-1234567',
    customerId: 'C-5002',
    channelId: 'eBay UK',
    skuList: ['SKU-EBOOK-123'],
    productTitles: ['Digital eReader Pro Max'],
    amount: 199.99,
    currency: 'GBP',
    orderStatus: 'shipped',
    shippingStatus: 'In Transit',
    trackingNumber: 'RM123456789GB',
    deliveryEta: 'Mar 28, 2026',
    paymentStatus: 'Paid',
    carrier: 'Royal Mail',
    hasVatInfo: false,
    logisticsStatus: LogisticsStatus.IN_TRANSIT,
    logisticsEvents: []
  },
  'ORD-9903': {
    id: 'ORD-9903',
    platformOrderId: 'SHOPIFY-8899',
    customerId: 'C-5003',
    channelId: 'Shopify Main Store',
    skuList: ['SKU-CASE-BLU'],
    productTitles: ['Premium Silicone Case - Blue'],
    amount: 15.00,
    currency: 'USD',
    orderStatus: 'unshipped',
    shippingStatus: 'Pending',
    trackingNumber: '',
    deliveryEta: '',
    paymentStatus: 'Paid',
    carrier: '',
    hasVatInfo: true,
    logisticsStatus: LogisticsStatus.NOT_FOUND,
    logisticsEvents: []
  },
  'ORD-9904': {
    id: 'ORD-9904',
    platformOrderId: '116-1111111-2222222',
    customerId: 'C-5004',
    channelId: 'Amazon UK',
    skuList: ['SKU-DESK-001'],
    productTitles: ['Ergonomic Office Desk'],
    amount: 250.00,
    currency: 'GBP',
    orderStatus: 'shipped',
    shippingStatus: 'Delivered',
    trackingNumber: 'DHL987654321',
    deliveryEta: 'Mar 20, 2026',
    paymentStatus: 'Paid',
    carrier: 'DHL',
    hasVatInfo: true,
    logisticsStatus: LogisticsStatus.DELIVERED,
    logisticsEvents: []
  },
  'ORD-9905': {
    id: 'ORD-9905',
    platformOrderId: '117-3333333-4444444',
    customerId: 'C-5005',
    channelId: 'Amazon DE',
    skuList: ['SKU-LAMP-002'],
    productTitles: ['LED Desk Lamp with Wireless Charging'],
    amount: 45.99,
    currency: 'EUR',
    orderStatus: 'shipped',
    shippingStatus: 'In Transit',
    trackingNumber: 'HERMES12345',
    deliveryEta: 'Mar 27, 2026',
    paymentStatus: 'Paid',
    carrier: 'Hermes',
    hasVatInfo: false,
    logisticsStatus: LogisticsStatus.IN_TRANSIT,
    logisticsEvents: []
  },
  'ORD-9906': {
    id: 'ORD-9906',
    platformOrderId: 'WM-88889999',
    customerId: 'C-5006',
    channelId: 'Walmart',
    skuList: ['SKU-TV-55INCH'],
    productTitles: ['55-inch 4K Smart TV'],
    amount: 399.00,
    currency: 'USD',
    orderStatus: 'shipped',
    shippingStatus: 'Delivered',
    trackingNumber: 'FEDEX99998888',
    deliveryEta: 'Mar 25, 2026',
    paymentStatus: 'Paid',
    carrier: 'FedEx',
    hasVatInfo: true,
    logisticsStatus: LogisticsStatus.DELIVERED,
    logisticsEvents: []
  },
  'ORD-9910': {
    id: 'ORD-9910',
    platformOrderId: '114-9988776-5544332',
    customerId: 'C-5010',
    channelId: 'Amazon US',
    skuList: ['SKU-CAM-PRO'],
    productTitles: ['4K Action Camera Kit'],
    amount: 179.99,
    currency: 'USD',
    orderStatus: 'shipped',
    shippingStatus: 'Customs Delay',
    trackingNumber: 'UPS8877665544',
    deliveryEta: 'Apr 2, 2026',
    paymentStatus: 'Paid',
    carrier: 'UPS',
    hasVatInfo: true,
    logisticsStatus: LogisticsStatus.IN_TRANSIT,
    logisticsEvents: [],
  },
  'ORD-9911': {
    id: 'ORD-9911',
    platformOrderId: '114-7766554-3322110',
    customerId: 'C-5011',
    channelId: 'Amazon US',
    skuList: ['SKU-CASE-BLU'],
    productTitles: ['Premium Silicone Case - Blue'],
    amount: 19.99,
    currency: 'USD',
    orderStatus: 'unshipped',
    shippingStatus: 'Pending',
    trackingNumber: '',
    deliveryEta: '',
    paymentStatus: 'Paid',
    carrier: '',
    hasVatInfo: false,
    logisticsStatus: LogisticsStatus.INFO_RECEIVED,
    logisticsEvents: [],
  },
  'ORD-9912': {
    id: 'ORD-9912',
    platformOrderId: '114-5544332-1100998',
    customerId: 'C-5012',
    channelId: 'Amazon US',
    skuList: ['SKU-WATCH-X'],
    productTitles: ['Smart Watch Series X'],
    amount: 249.0,
    currency: 'USD',
    orderStatus: 'partial_refund',
    shippingStatus: 'Delivered',
    trackingNumber: 'USPS1122334455',
    deliveryEta: 'Mar 18, 2026',
    paymentStatus: 'Partial Refund',
    carrier: 'USPS',
    hasVatInfo: true,
    logisticsStatus: LogisticsStatus.DELIVERED,
    logisticsEvents: [],
  },
  'ORD-9913': {
    id: 'ORD-9913',
    platformOrderId: '114-2211009-8877665',
    customerId: 'C-5014',
    channelId: 'Amazon US',
    skuList: ['SKU-DESK-L'],
    productTitles: ['Standing Desk Large'],
    amount: 429.0,
    currency: 'USD',
    orderStatus: 'shipped',
    shippingStatus: 'Shipped',
    trackingNumber: 'FDX5566778899',
    deliveryEta: 'Mar 29, 2026',
    paymentStatus: 'Paid',
    carrier: 'FedEx',
    hasVatInfo: true,
    logisticsStatus: LogisticsStatus.OUT_FOR_DELIVERY,
    logisticsEvents: [],
  },
};

const MOCK_CUSTOMERS: Record<string, Customer> = {
  'C-5001': {
    id: 'C-5001',
    name: 'John Doe',
    email: 'john.doe@example.com',
    shippingCountry: 'USA',
    sentiment: Sentiment.ANGRY,
    segments: ['VIP', 'Repeat Customer'],
    totalOrderValue: 450.50,
    ordersCount: 5,
    latestPurchaseAt: '2026-03-20T10:00:00Z',
    customerSince: '2025-01-15T00:00:00Z'
  },
  'C-5002': {
    id: 'C-5002',
    name: 'Alice Smith',
    email: 'alice.smith@example.co.uk',
    shippingCountry: 'UK',
    sentiment: Sentiment.ANXIOUS,
    segments: ['New Customer'],
    totalOrderValue: 199.99,
    ordersCount: 1,
    latestPurchaseAt: '2026-03-22T10:00:00Z',
    customerSince: '2026-03-22T00:00:00Z'
  },
  'C-5003': {
    id: 'C-5003',
    name: 'Bob Johnson',
    email: 'bob.j@example.com',
    shippingCountry: 'USA',
    sentiment: Sentiment.JOYFUL,
    segments: ['Repeat Customer'],
    totalOrderValue: 150.00,
    ordersCount: 3,
    latestPurchaseAt: '2026-03-01T10:00:00Z',
    customerSince: '2025-06-10T00:00:00Z'
  },
  'C-5004': {
    id: 'C-5004',
    name: 'Company Ltd',
    email: 'accounts@companyltd.co.uk',
    shippingCountry: 'UK',
    sentiment: Sentiment.NEUTRAL,
    segments: ['B2B', 'VIP'],
    totalOrderValue: 2500.00,
    ordersCount: 10,
    latestPurchaseAt: '2026-03-18T10:00:00Z',
    customerSince: '2024-11-05T00:00:00Z'
  },
  'C-5005': {
    id: 'C-5005',
    name: 'Klaus Müller',
    email: 'klaus.m@example.de',
    shippingCountry: 'Germany',
    sentiment: Sentiment.NEUTRAL,
    segments: ['Repeat Customer'],
    totalOrderValue: 120.50,
    ordersCount: 2,
    latestPurchaseAt: '2026-03-24T10:00:00Z',
    customerSince: '2025-12-10T00:00:00Z'
  },
  'C-5006': {
    id: 'C-5006',
    name: 'Mike Brown',
    email: 'mike.b@example.com',
    shippingCountry: 'USA',
    sentiment: Sentiment.ANGRY,
    segments: ['At Risk'],
    totalOrderValue: 399.00,
    ordersCount: 1,
    latestPurchaseAt: '2026-03-15T10:00:00Z',
    customerSince: '2026-03-15T00:00:00Z'
  },
  'C-5010': {
    id: 'C-5010',
    name: 'Sarah Chen',
    email: 'sarah.chen@example.com',
    shippingCountry: 'USA',
    sentiment: Sentiment.NEUTRAL,
    segments: ['Repeat Customer'],
    totalOrderValue: 179.99,
    ordersCount: 2,
    latestPurchaseAt: '2026-03-20T10:00:00Z',
    customerSince: '2025-08-01T00:00:00Z'
  },
  'C-5011': {
    id: 'C-5011',
    name: 'Tom Lee',
    email: 'tom.lee@example.com',
    shippingCountry: 'USA',
    sentiment: Sentiment.JOYFUL,
    segments: ['VIP'],
    totalOrderValue: 89.0,
    ordersCount: 4,
    latestPurchaseAt: '2026-03-25T10:00:00Z',
    customerSince: '2024-05-12T00:00:00Z'
  },
  'C-5012': {
    id: 'C-5012',
    name: 'Emma Davis',
    email: 'emma.d@example.com',
    shippingCountry: 'USA',
    sentiment: Sentiment.ANXIOUS,
    segments: ['Repeat Customer'],
    totalOrderValue: 249.0,
    ordersCount: 1,
    latestPurchaseAt: '2026-03-22T10:00:00Z',
    customerSince: '2026-03-22T00:00:00Z'
  },
  'C-5013': {
    id: 'C-5013',
    name: 'Alex Rivera',
    email: 'alex.r@example.com',
    shippingCountry: 'USA',
    sentiment: Sentiment.NEUTRAL,
    segments: ['New Customer'],
    totalOrderValue: 0,
    ordersCount: 0,
    latestPurchaseAt: '2026-03-27T10:00:00Z',
    customerSince: '2026-03-27T00:00:00Z'
  },
  'C-5014': {
    id: 'C-5014',
    name: 'Jordan Kim',
    email: 'jordan.k@example.com',
    shippingCountry: 'USA',
    sentiment: Sentiment.NEUTRAL,
    segments: ['B2B'],
    totalOrderValue: 429.0,
    ordersCount: 1,
    latestPurchaseAt: '2026-03-26T10:00:00Z',
    customerSince: '2026-03-26T00:00:00Z'
  }
};

function cloneMockMessages(): Record<string, Message[]> {
  const copy: Record<string, Message[]> = {};
  for (const key of Object.keys(MOCK_MESSAGES)) {
    copy[key] = MOCK_MESSAGES[key].map((m) => ({ ...m }));
  }
  return copy;
}

export default function MailboxPage() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const live = intellideskConfigured();
  const tenantId = intellideskTenantId();
  const apiUserId = intellideskUserIdForApi(user?.id);

  const filter = useMemo(() => {
    const f = searchParams.get('filter');
    if (
      f === 'unread' ||
      f === 'unreplied' ||
      f === 'replied' ||
      f === 'sla_overdue'
    ) {
      return f;
    }
    return undefined;
  }, [searchParams]);

  const mailboxSearchSuffix = filter ? `?filter=${encodeURIComponent(filter)}` : '';

  const [tickets, setTickets] = useState<Ticket[]>(() =>
    live ? [] : MOCK_TICKETS.map((t) => ({ ...t }))
  );
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messagesByTicket, setMessagesByTicket] = useState<Record<string, Message[]>>(() =>
    live ? {} : cloneMockMessages()
  );
  const [seatAssignmentByTicket, setSeatAssignmentByTicket] = useState<Record<string, string>>({});
  const [seatOptions, setSeatOptions] = useState<{ id: string; label: string }[]>(
    MAILBOX_SEAT_OPTIONS
  );
  const [ordersMap, setOrdersMap] = useState<Record<string, Order>>({});
  const [customersMap, setCustomersMap] = useState<Record<string, Customer>>({});
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const listReqId = useRef(0);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    fetchAgentSeats(tenantId, apiUserId)
      .then((rows) => {
        if (cancelled) return;
        const opts = rows
          .filter((r) => r.status === 'active')
          .map((r) => ({ id: r.id, label: r.displayName }));
        setSeatOptions(opts.length ? opts : MAILBOX_SEAT_OPTIONS);
      })
      .catch(() => {
        if (!cancelled) setSeatOptions(MAILBOX_SEAT_OPTIONS);
      });
    return () => {
      cancelled = true;
    };
  }, [live, tenantId, apiUserId]);

  useEffect(() => {
    if (!live) return;
    const req = ++listReqId.current;
    let cancelled = false;
    setApiError(null);
    void (async () => {
      try {
        setListLoading(true);
        const res = await fetchTicketsList(tenantId, apiUserId, {
          ...(filter ? { filter } : {}),
          limit: '200',
        });
        if (cancelled || req !== listReqId.current) return;
        setTickets(res.items.map(mapApiTicketToUi));
        setMessagesByTicket({});
      } catch (e) {
        if (!cancelled && req === listReqId.current) {
          setApiError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled && req === listReqId.current) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [live, tenantId, apiUserId, filter]);

  useEffect(() => {
    if (!live || !ticketId) return;
    let cancelled = false;
    void (async () => {
      try {
        setDetailLoading(true);
        const d = await fetchTicketDetail(tenantId, apiUserId, ticketId);
        if (cancelled) return;
        const t = mapApiTicketToUi(d);
        setTickets((prev) => {
          const i = prev.findIndex((x) => x.id === t.id);
          if (i < 0) return [t, ...prev];
          const n = [...prev];
          n[i] = t;
          return n;
        });
        setMessagesByTicket((prev) => ({
          ...prev,
          [t.id]: d.messages.map(mapApiMessageToUi),
        }));
        if (d.customer) {
          setCustomersMap((prev) => ({
            ...prev,
            [d.customer.id]: mapApiCustomerToUi(d.customer),
          }));
        }
        if (d.order) {
          setOrdersMap((prev) => ({
            ...prev,
            [d.order.id]: mapApiOrderToUi(d.order),
          }));
        }
        setApiError(null);
      } catch (e) {
        if (!cancelled) setApiError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [live, ticketId, tenantId, apiUserId]);

  useEffect(() => {
    if (!live) return;
    const url = intellideskWsUrl(tenantId);
    if (!url) return;
    const ws = new WebSocket(url);
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as {
          type?: string;
          ticketId?: string;
          message?: ApiMessageRaw;
          ticket?: ApiTicketRaw;
        };
        if (data.type === 'message_created' && data.ticketId && data.message) {
          const msg = mapApiMessageToUi(data.message);
          setMessagesByTicket((prev) => {
            const cur = prev[data.ticketId!] ?? [];
            if (cur.some((m) => m.id === msg.id)) return prev;
            return { ...prev, [data.ticketId!]: [...cur, msg] };
          });
          setTickets((prev) =>
            prev.map((x) =>
              x.id === data.ticketId ? { ...x, updatedAt: msg.createdAt } : x
            )
          );
        }
        if (data.type === 'ticket_updated' && data.ticket) {
          const t = mapApiTicketToUi(data.ticket);
          setTickets((prev) => {
            const i = prev.findIndex((x) => x.id === t.id);
            if (i < 0) return [t, ...prev];
            const n = [...prev];
            n[i] = { ...n[i], ...t };
            return n;
          });
        }
      } catch {
        /* ignore malformed */
      }
    };
    return () => {
      ws.close();
    };
  }, [live, tenantId]);

  useEffect(() => {
    if (live) {
      if (ticketId) {
        const ticket = tickets.find((t) => t.id === ticketId);
        setSelectedTicket(ticket ?? null);
      } else if (!listLoading && tickets.length > 0) {
        navigate(`/mailbox/${tickets[0].id}${mailboxSearchSuffix}`, { replace: true });
      } else if (!listLoading && tickets.length === 0) {
        setSelectedTicket(null);
      }
      return;
    }
    if (ticketId) {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (ticket) setSelectedTicket(ticket);
    } else if (tickets.length > 0) {
      navigate(`/mailbox/${tickets[0].id}`);
    }
  }, [ticketId, navigate, tickets, live, listLoading, mailboxSearchSuffix]);

  const ordersForList = live ? ordersMap : MOCK_ORDERS;
  const customersForList = live ? customersMap : MOCK_CUSTOMERS;

  const handleSendMessage = (payload: {
    content: string;
    recipients: ('customer' | 'manager')[];
    isInternal: boolean;
    translateToPlatform?: boolean;
  }) => {
    if (!selectedTicket) return;
    const tid = selectedTicket.id;
    const doTranslate =
      !payload.isInternal &&
      payload.translateToPlatform &&
      payload.recipients.length > 0;

    if (live) {
      void (async () => {
        try {
          const created = await postTicketMessage(tenantId, apiUserId, tid, {
            content: payload.content,
            senderType: 'agent',
            senderId: user?.name || 'agent',
            isInternal: payload.isInternal,
            sentPlatformText: doTranslate
              ? mockTranslateToPlatformLanguage(payload.content, selectedTicket.channelId)
              : undefined,
            deliveryTargets:
              !payload.isInternal && payload.recipients.length > 0
                ? [...payload.recipients]
                : undefined,
          });
          setMessagesByTicket((prev) => {
            const cur = prev[tid] || [];
            const mapped = mapApiMessageToUi(created);
            if (cur.some((m) => m.id === mapped.id)) return prev;
            return { ...prev, [tid]: [...cur, mapped] };
          });
          setApiError(null);
        } catch (e) {
          setApiError(e instanceof Error ? e.message : String(e));
        }
      })();
      return;
    }

    const newMsg: Message = {
      id: `M-${Date.now()}`,
      ticketId: tid,
      senderId: user?.name || '当前客服',
      senderType: 'agent',
      content: payload.content,
      createdAt: new Date().toISOString(),
      isInternal: payload.isInternal,
      ...(doTranslate
        ? {
            sentPlatformText: mockTranslateToPlatformLanguage(
              payload.content,
              selectedTicket.channelId
            ),
          }
        : {}),
      ...(!payload.isInternal && payload.recipients.length > 0
        ? { deliveryTargets: [...payload.recipients] }
        : {}),
    };
    setMessagesByTicket((prev) => ({
      ...prev,
      [tid]: [...(prev[tid] || []), newMsg],
    }));
  };

  const handleUpdateTicket = (patch: Partial<Ticket>) => {
    if (!selectedTicket) return;
    const id = selectedTicket.id;

    if (live) {
      const body: PatchTicketBody = {};
      if (patch.messageProcessingStatus != null)
        body.messageProcessingStatus = patch.messageProcessingStatus;
      if (patch.status != null) body.status = patch.status;
      if (patch.assignedSeatId !== undefined)
        body.assignedSeatId = patch.assignedSeatId ?? null;
      if (patch.priority != null) body.priority = patch.priority;
      if (patch.tags != null) body.tags = patch.tags;
      if (patch.isFavorite != null) body.isFavorite = patch.isFavorite;
      if (patch.isImportant != null) body.isImportant = patch.isImportant;
      if (patch.subject != null) body.subject = patch.subject;
      if (patch.subjectOriginal !== undefined)
        body.subjectOriginal = patch.subjectOriginal ?? null;
      if (patch.intent != null) body.intent = patch.intent;
      if (patch.sentiment != null) body.sentiment = patch.sentiment;

      if (Object.keys(body).length === 0) return;

      void (async () => {
        try {
          const updated = await patchTicket(tenantId, apiUserId, id, body);
          const t = mapApiTicketToUi(updated);
          setTickets((prev) => prev.map((x) => (x.id === id ? t : x)));
          setSelectedTicket((s) => (s?.id === id ? t : s));
          setApiError(null);
        } catch (e) {
          setApiError(e instanceof Error ? e.message : String(e));
        }
      })();
      return;
    }

    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setSelectedTicket((t) => (t && t.id === id ? { ...t, ...patch } : t));
  };

  return (
    <div className="flex h-full overflow-hidden flex-col">
      {apiError ? (
        <div className="shrink-0 px-4 py-2 bg-red-50 text-red-800 text-sm border-b border-red-100">
          {apiError}
        </div>
      ) : null}
      {live && !listLoading && !apiError && tickets.length === 0 ? (
        <div className="shrink-0 px-4 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-950">
          <p className="font-semibold">当前 API 下没有工单，左侧「店铺」分组也不会出现</p>
          <p className="mt-1 text-amber-900/90 leading-relaxed">
            若刚执行过 <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">db:seed:production</code>，它
            <strong>只建租户/平台店铺/坐席骨架</strong>，不含工单、订单、售后。要看完整演示数据，请在连接<strong>同一数据库</strong>的机器上执行：
          </p>
          <pre className="mt-2 rounded-lg bg-white/80 border border-amber-200 px-3 py-2 text-xs font-mono text-slate-800 overflow-x-auto">
            cd backend{'\n'}
            npm run db:seed
          </pre>
          <p className="mt-2 text-xs text-amber-800/80">
            并确认本页能访问后端（另开终端 <code className="rounded bg-amber-100 px-1">cd backend && npm run dev</code>，默认端口 4001），前端 :4000 会通过代理转发请求。
          </p>
        </div>
      ) : null}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <InboxList
          tickets={tickets}
          orders={ordersForList}
          customers={customersForList}
          selectedTicketId={ticketId}
          mailboxSearchSuffix={mailboxSearchSuffix}
        />

        <div className="flex-1 overflow-hidden relative">
          {live && (listLoading || detailLoading) ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 text-sm text-slate-500">
              加载中…
            </div>
          ) : null}
          {selectedTicket ? (
            <TicketDetail
              ticket={selectedTicket}
              messages={messagesByTicket[selectedTicket.id] || []}
              order={
                selectedTicket.orderId ? ordersForList[selectedTicket.orderId] : undefined
              }
              customer={customersForList[selectedTicket.customerId]}
              onSendMessage={handleSendMessage}
              seatOptions={seatOptions}
              assignedSeatId={
                seatAssignmentByTicket[selectedTicket.id] ??
                selectedTicket.assignedSeatId ??
                null
              }
              onAssignSeat={(seatId) => {
                if (live) {
                  handleUpdateTicket({ assignedSeatId: seatId ?? undefined });
                  return;
                }
                setSeatAssignmentByTicket((prev) => {
                  const next = { ...prev };
                  if (!seatId) delete next[selectedTicket.id];
                  else next[selectedTicket.id] = seatId;
                  return next;
                });
              }}
              onUpdateTicket={handleUpdateTicket}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8" />
              </div>
              <p className="text-sm font-medium">
                {live && !listLoading && tickets.length === 0
                  ? '暂无工单（请确认已 seed 数据库）'
                  : '请选择一个工单查看详情'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
