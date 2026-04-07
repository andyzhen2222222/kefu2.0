import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
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
import { MessageSquare, Loader2 } from 'lucide-react';
import {
  intellideskConfigured,
  intellideskTenantId,
  DEFAULT_DEMO_TENANT_ID,
  intellideskUserIdForApi,
  fetchTicketsList,
  fetchTicketDetail,
  fetchTicketMessagesPage,
  fetchAgentSeats,
  patchTicket,
  postTicketMessage,
  patchTicketMessage,
  deleteTicketMessage,
  mapApiTicketToUi,
  mapApiMessageToUi,
  mapApiCustomerToUi,
  mapApiOrderToUi,
  lastCustomerMessagePreviewFromApi,
  intellideskWsUrl,
  intellideskFetchErrorMessage,
  type PatchTicketBody,
  type ApiMessageRaw,
  type ApiTicketRaw,
  type ApiTicketDetail,
} from '@/src/services/intellideskApi';

/** 与设置-坐席与分配中的演示坐席 id 对齐 */
const MAILBOX_SEAT_OPTIONS: { id: string; label: string }[] = [
  { id: 'seat-1', label: '李娜' },
  { id: 'seat-2', label: '王强' },
];

/** 演示：模拟译为店铺平台语言（真实环境由母系统语种 + 翻译接口生成） */
function mockTranslateToPlatformLanguage(text: string, channelId: string, platformLanguage?: string | null): string {
  const c = channelId.toLowerCase();
  const pl = (platformLanguage || '').toLowerCase();
  
  let prefix = '';

  // 1. 优先使用母系统同步的 platformLanguage (pl)
  if (pl.includes('fr') || pl.includes('french') || pl.includes('français')) {
    prefix = '🇫🇷 Français';
  } else if (pl.includes('de') || pl.includes('german') || pl.includes('deutsch')) {
    prefix = '🇩🇪 Deutsch';
  } else if (pl.includes('es') || pl.includes('spanish') || pl.includes('español')) {
    prefix = '🇪🇸 Español';
  } else if (pl.includes('it') || pl.includes('italian') || pl.includes('italiano')) {
    prefix = '🇮🇹 Italiano';
  } else if (pl.includes('jp') || pl.includes('japanese') || pl.includes('日本語')) {
    prefix = '🇯🇵 日本語';
  } else if (pl.includes('kr') || pl.includes('korean') || pl.includes('한국어') || pl.includes('ko')) {
    prefix = '🇰🇷 한국어';
  } else if (pl.includes('ru') || pl.includes('russian') || pl.includes('русский')) {
    // 排除 rueducommerce 误伤：只有在 pl 确实指代俄语且不是法语平台时才识别为俄语
    if (!c.includes('rueducommerce') && !c.includes('fnac')) {
      prefix = '🇷🇺 Русский';
    }
  } else if (pl.includes('en') || pl.includes('english')) {
    prefix = c.includes('uk') ? '🇬🇧 English' : '🇺🇸 English';
  }

  // 2. 如果 pl 为空，则根据渠道特征进行最后一道兜底识别
  if (!prefix) {
    if (c.includes('rueducommerce') || c.includes('fnac')) {
      prefix = '🇫🇷 Français';
    } else if (c.includes('de')) {
      prefix = '🇩🇪 Deutsch';
    } else if (c.includes('es')) {
      prefix = '🇪🇸 Español';
    } else if (c.includes('it')) {
      prefix = '🇮🇹 Italiano';
    } else if (c.includes('jp')) {
      prefix = '🇯🇵 日本語';
    } else if (c.includes('uk') || c.includes('ebay')) {
      prefix = '🇬🇧 English';
    } else {
      prefix = '🇺🇸 English';
    }
  }

  const rough = text
    .replace(/你好/g, 'Hello')
    .replace(/抱歉/g, 'sorry')
    .replace(/退款/g, 'refund')
    .replace(/。/g, '. ')
    .replace(/，/g, ', ')
    .replace(/？/g, '? ')
    .trim();
  return `[${prefix}] ${rough || text}`;
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
    lastInboundPreview:
      'Item arrived damaged — need immediate refund and replacement if possible.',
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
  {
    id: 'T-INV-TEST',
    channelId: 'Amazon DE',
    customerId: 'C-5005',
    orderId: 'ORD-INV-TEST',
    status: TicketStatus.TODO,
    priority: 2,
    sentiment: Sentiment.NEUTRAL,
    intent: '发票相关',
    subject: '【测试】请提供该订单的发票 (完整主体信息)',
    subjectOriginal: 'Please provide invoice for this order',
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    slaDueAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    isImportant: false,
    isFavorite: false,
    isShared: false,
    tags: ['发票测试'],
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
      deliveryStatus: 'success',
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
      translatedContent: '你好，物流信息已经 3 天没更新了。我的订单在哪里？',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: 'M-3-1',
      ticketId: 'T-1002',
      senderId: '当前客服',
      senderType: 'agent',
      content: '您好，可以换货。请在 48 小时内寄回原鞋并保持原包装。',
      createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      deliveryStatus: 'failed',
      deliveryError: '平台接口超时',
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
  'T-INV-TEST': [
    {
      id: 'M-INV-1',
      ticketId: 'T-INV-TEST',
      senderId: 'Klaus Müller',
      senderType: 'customer',
      content: "I need a commercial invoice for order DE-INV-TEST-2026. My company needs it for tax purposes.",
      translatedContent: '我需要订单 DE-INV-TEST-2026 的商业发票。我们公司报税需要用到。',
      createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
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
      translatedContent: '我能把收货地址改到柏林吗？',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    },
    {
      id: 'M-8',
      ticketId: 'T-1005',
      senderId: '客服',
      senderType: 'agent',
      content: "Hi Klaus, I have updated your shipping address to Berlin. The package will be shipped there.",
      sentPlatformText: '[🇩🇪 Deutsch] Hallo Klaus, ich habe Ihre Lieferadresse auf Berlin aktualisiert. Das Paket wird dorthin versandt.',
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
      translatedContent: '物流显示我的包裹昨天已经送达了，但我到处都找过了，根本不在这里！这太让人无法接受了！',
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
      translatedContent: '我的包裹已经在海关卡了一个星期了。你能帮我联系一下物流商吗？',
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
    storeEntity: {
      id: 'SE-001',
      legalName: 'VibeSports Global Ltd.',
      displayName: 'Amazon US - VibeSports',
      address: '100 California St, San Francisco, CA 94111, USA',
      vatNumber: 'US123456789',
    },
    eanList: ['6971234567890'],
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
    eanList: ['5012345678901'],
    logisticsStatus: LogisticsStatus.IN_TRANSIT,
    logisticsEvents: [
      {
        id: 'rm-1',
        status: LogisticsStatus.IN_TRANSIT,
        subStatus: 'In Transit',
        description: 'Your item is currently at the Heathrow Worldwide Distribution Centre and is being prepared for export.',
        location: 'Heathrow, UK',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      },
      {
        id: 'rm-2',
        status: LogisticsStatus.IN_TRANSIT,
        subStatus: 'Accepted',
        description: 'Item received at Jubilee Mail Centre.',
        location: 'London, UK',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      },
      {
        id: 'rm-3',
        status: LogisticsStatus.INFO_RECEIVED,
        subStatus: 'Sender preparing item',
        description: 'The sender has let us know they are providing your item to Royal Mail.',
        location: 'London, UK',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      }
    ]
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
    storeEntity: {
      id: 'SE-004',
      legalName: 'UK Gadget Masters Ltd.',
      displayName: 'Amazon UK - Gadgets',
      address: '45 Tech Lane, Manchester, M1 4BT, UK',
      vatNumber: 'GB112233445',
    },
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
    storeEntity: {
      id: 'SE-003',
      legalName: 'NextGen Retail DE GmbH',
      displayName: 'Amazon DE - NextGen',
      address: 'Kurfürstendamm 21, 10719 Berlin, Germany',
      vatNumber: 'DE321654987',
    },
    logisticsStatus: LogisticsStatus.IN_TRANSIT,
    logisticsEvents: [
      {
        id: 'ev-1',
        status: LogisticsStatus.IN_TRANSIT,
        subStatus: '海关查验中',
        description: '您的包裹目前正在进行海关查验，可能会产生额外延迟。',
        location: 'Los Angeles, CA, US',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      },
      {
        id: 'ev-2',
        status: LogisticsStatus.IN_TRANSIT,
        subStatus: '到达转运中心',
        description: '包裹已到达转运中心。',
        location: 'Los Angeles, CA, US',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
      },
      {
        id: 'ev-3',
        status: LogisticsStatus.IN_TRANSIT,
        subStatus: '离开分拨中心',
        description: '包裹已离开分拨中心，正在运往目的地。',
        location: 'Shenzhen, CN',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
      },
    ],
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
    paymentStatus: 'Paid',
    carrier: 'USPS',
    hasVatInfo: true,
    storeEntity: {
      id: 'SE-002',
      legalName: 'Global E-Commerce Solutions Inc.',
      displayName: 'Amazon US Outlet - GES',
      address: '200 Broadway Ave, New York, NY 10007, USA',
      vatNumber: 'US987654321',
    },
    logisticsStatus: LogisticsStatus.DELIVERED,
    logisticsEvents: [
      {
        id: 'us-1',
        status: LogisticsStatus.DELIVERED,
        subStatus: 'Delivered, Left with Individual',
        description: 'Your item was delivered to an individual at the address at 1:45 pm.',
        location: 'Miami, FL 33101',
        timestamp: '2026-03-18T13:45:00Z',
      },
      {
        id: 'us-2',
        status: LogisticsStatus.OUT_FOR_DELIVERY,
        subStatus: 'Out for Delivery',
        description: 'Your item is out for delivery in MIAMI, FL 33101.',
        location: 'Miami, FL 33101',
        timestamp: '2026-03-18T08:15:00Z',
      },
      {
        id: 'us-3',
        status: LogisticsStatus.IN_TRANSIT,
        subStatus: 'Arrived at Post Office',
        description: 'Your item arrived at the Post Office.',
        location: 'Miami, FL 33101',
        timestamp: '2026-03-17T21:30:00Z',
      },
      {
        id: 'us-4',
        status: LogisticsStatus.IN_TRANSIT,
        subStatus: 'Departed USPS Regional Facility',
        description: 'Your item departed our USPS facility in MIAMI FL DISTRIBUTION CENTER.',
        location: 'Miami, FL 33112',
        timestamp: '2026-03-16T22:45:00Z',
      }
    ],
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
  'ORD-INV-TEST': {
    id: 'ORD-INV-TEST',
    platformOrderId: 'DE-INV-TEST-2026',
    customerId: 'C-5005',
    channelId: 'Amazon DE',
    skuList: ['YG-MAT-01', 'FR-RED-01'],
    productTitles: ['Pro-Grade Yoga Mat', 'Foam Roller'],
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
    logisticsStatus: LogisticsStatus.DELIVERED,
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
  const [listReloadNonce, setListReloadNonce] = useState(0);
  /** 联调：收件箱搜索框输入，防抖后作为 GET /api/tickets?search= */
  const [inboxListSearchInput, setInboxListSearchInput] = useState('');
  const [inboxListSearchApi, setInboxListSearchApi] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailMessagesTotal, setDetailMessagesTotal] = useState<number | null>(null);
  const [olderMessagesLoading, setOlderMessagesLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    import('@/src/services/intellideskApi').then((m) => m.setGlobalApiError(apiError));
  }, [apiError]);

  const listReqId = useRef(0);

  useEffect(() => {
    if (!live) return;
    const t = window.setTimeout(() => {
      setInboxListSearchApi(inboxListSearchInput.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [inboxListSearchInput, live]);

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
          ...(inboxListSearchApi ? { search: inboxListSearchApi } : {}),
        });
        if (cancelled || req !== listReqId.current) return;
        setTickets(res.items.map(mapApiTicketToUi));
        setCustomersMap((prev) => {
          const next = { ...prev };
          for (const row of res.items) {
            if (row.customer) next[row.customer.id] = mapApiCustomerToUi(row.customer);
          }
          return next;
        });
        setOrdersMap((prev) => {
          const next = { ...prev };
          for (const row of res.items) {
            if (row.order) next[row.order.id] = mapApiOrderToUi(row.order);
          }
          return next;
        });
      } catch (e) {
        if (!cancelled && req === listReqId.current) {
          setApiError(intellideskFetchErrorMessage(e));
        }
      } finally {
        if (!cancelled && req === listReqId.current) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [live, tenantId, apiUserId, filter, listReloadNonce, inboxListSearchApi]);

  useLayoutEffect(() => {
    if (!live) return;
    if (!ticketId) {
      setDetailLoading(false);
      setDetailMessagesTotal(null);
      return;
    }
    setDetailLoading(true);
    setDetailMessagesTotal(null);
  }, [live, ticketId]);

  const mergeTicketDetailIntoState = useCallback(
    async (id: string): Promise<ApiTicketDetail> => {
      const d = await fetchTicketDetail(tenantId, apiUserId, id, { messagesLimit: 200 });
      const msgs = d.messages ?? [];
      const preview = lastCustomerMessagePreviewFromApi(msgs);
      const t = mapApiTicketToUi({
        ...d,
        ...(preview ? { lastInboundPreview: preview } : {}),
      });
      setTickets((prev) => {
        const i = prev.findIndex((x) => x.id === t.id);
        if (i < 0) return [t, ...prev];
        const n = [...prev];
        n[i] = { ...n[i], ...t };
        return n;
      });
      const incoming = msgs.map(mapApiMessageToUi);
      setMessagesByTicket((prev) => {
        const had = prev[id] ?? [];
        if (had.length === 0) return { ...prev, [id]: incoming };
        const byId = new Map<string, Message>();
        for (const m of incoming) byId.set(m.id, m);
        for (const m of had) {
          if (!byId.has(m.id)) byId.set(m.id, m);
        }
        const merged = [...byId.values()].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        return { ...prev, [id]: merged };
      });
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
      setDetailMessagesTotal(typeof d.messagesTotal === 'number' ? d.messagesTotal : null);
      return d;
    },
    [tenantId, apiUserId]
  );

  const mergeTicketDetailRef = useRef(mergeTicketDetailIntoState);
  mergeTicketDetailRef.current = mergeTicketDetailIntoState;
  const ticketIdRef = useRef(ticketId);
  ticketIdRef.current = ticketId;
  const messagesByTicketRef = useRef(messagesByTicket);
  messagesByTicketRef.current = messagesByTicket;

  const prefetchTicketDetail = useCallback(
    (id: string) => {
      if (!live) return;
      void fetchTicketDetail(tenantId, apiUserId, id, { messagesLimit: 150 }).catch(() => {});
    },
    [live, tenantId, apiUserId]
  );

  const loadOlderTicketMessages = useCallback(async () => {
    if (!live || !ticketId) return;
    const cur = messagesByTicketRef.current[ticketId] ?? [];
    if (cur.length === 0) return;
    let oldest = cur[0];
    let oldestMs = new Date(oldest.createdAt).getTime();
    for (const m of cur) {
      const t = new Date(m.createdAt).getTime();
      if (t < oldestMs) {
        oldestMs = t;
        oldest = m;
      }
    }
    setOlderMessagesLoading(true);
    try {
      const page = await fetchTicketMessagesPage(tenantId, apiUserId, ticketId, {
        before: oldest.createdAt,
        limit: 100,
      });
      const mapped = page.messages.map(mapApiMessageToUi);
      setMessagesByTicket((prev) => {
        const exist = new Set((prev[ticketId] ?? []).map((m) => m.id));
        const add = mapped.filter((m) => !exist.has(m.id));
        const merged = [...add, ...(prev[ticketId] ?? [])].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        return { ...prev, [ticketId]: merged };
      });
    } catch {
      /* 静默失败，用户可点重新加载 */
    } finally {
      setOlderMessagesLoading(false);
    }
  }, [live, ticketId, tenantId, apiUserId]);

  useEffect(() => {
    if (!live || !ticketId) return;
    let cancelled = false;
    let hydrateRetryTimer: number | undefined;
    setDetailError(null);
    void (async () => {
      try {
        setDetailLoading(true);
        const d = await mergeTicketDetailIntoState(ticketId);
        if (cancelled) return;
        setApiError(null);
        setDetailError(null);
        /** 后端异步 hydrate 后靠 WS 刷新；WS 未连通时补一次延迟拉取 */
        const hasTimeline = (d.messages ?? []).some((m) => !m.isInternal);
        if (!hasTimeline && d.motherConversationLinked) {
          hydrateRetryTimer = window.setTimeout(() => {
            if (cancelled) return;
            void mergeTicketDetailIntoState(ticketId).catch(() => {});
          }, 2800);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = intellideskFetchErrorMessage(e);
          setApiError(msg);
          setDetailError(msg);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (hydrateRetryTimer) clearTimeout(hydrateRetryTimer);
    };
  }, [live, ticketId, tenantId, apiUserId, mergeTicketDetailIntoState]);

  const reloadConversation = useCallback(() => {
    if (!live || !ticketId) return;
    void (async () => {
      try {
        setDetailLoading(true);
        setDetailError(null);
        await mergeTicketDetailIntoState(ticketId);
        setApiError(null);
        setDetailError(null);
      } catch (e) {
        const msg = intellideskFetchErrorMessage(e);
        setApiError(msg);
        setDetailError(msg);
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [live, ticketId, mergeTicketDetailIntoState]);

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
          messageId?: string;
        };
        if (
          data.type === 'ticket_detail_synced' &&
          data.ticketId &&
          data.ticketId === ticketIdRef.current
        ) {
          void mergeTicketDetailRef.current(data.ticketId);
        }
        if (data.type === 'message_created' && data.ticketId && data.message) {
          const msg = mapApiMessageToUi(data.message);
          setMessagesByTicket((prev) => {
            const cur = prev[data.ticketId!] ?? [];
            if (cur.some((m) => m.id === msg.id)) return prev;
            return { ...prev, [data.ticketId!]: [...cur, msg] };
          });
          setTickets((prev) =>
            prev.map((x) => {
              if (x.id !== data.ticketId) return x;
              const base = { ...x, updatedAt: msg.createdAt };
              const inbound =
                !msg.isInternal &&
                (msg.senderType === 'customer' || msg.senderType === 'manager');
              if (inbound) {
                const withUnread = { ...base, messageProcessingStatus: 'unread' as const };
                if (msg.senderType === 'customer' && msg.content?.trim()) {
                  const c = msg.content.trim();
                  const p = c.length > 240 ? c.slice(0, 240) : c;
                  return { ...withUnread, lastInboundPreview: p };
                }
                return withUnread;
              }
              return base;
            })
          );
        }
        if (data.type === 'message_updated' && data.ticketId && data.message) {
          const msg = mapApiMessageToUi(data.message);
          setMessagesByTicket((prev) => {
            const cur = prev[data.ticketId!] ?? [];
            return { ...prev, [data.ticketId!]: cur.map((m) => (m.id === msg.id ? msg : m)) };
          });
        }
        if (data.type === 'message_deleted' && data.ticketId && data.messageId) {
          setMessagesByTicket((prev) => {
            const cur = prev[data.ticketId!] ?? [];
            return { ...prev, [data.ticketId!]: cur.filter((m) => m.id !== data.messageId) };
          });
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

  /** 按工单 id 打补丁（供路由同步与详情内操作共用；避免 effect 里误用旧的 selectedTicket） */
  const handleUpdateTicketById = (id: string, patch: Partial<Ticket>) => {
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
          setApiError(intellideskFetchErrorMessage(e));
        }
      })();
      return;
    }

    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setSelectedTicket((t) => (t && t.id === id ? { ...t, ...patch } : t));
  };

  /** 仅在 URL 中的 ticketId 变化时触发：从列表点进工单时未读→未回复；同页内手动改回「未读」或 WS 刷新列表不再重复覆盖 */
  const prevMailboxTicketIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (live) {
      if (ticketId) {
        const ticket = tickets.find((t) => t.id === ticketId);
        if (ticket) {
          setSelectedTicket(ticket);
          const navigatedToThisTicket = prevMailboxTicketIdRef.current !== ticketId;
          prevMailboxTicketIdRef.current = ticketId;
          if (
            navigatedToThisTicket &&
            (ticket.messageProcessingStatus === 'unread' || ticket.status === TicketStatus.NEW)
          ) {
            const patch: Partial<Ticket> = { messageProcessingStatus: 'unreplied' };
            if (ticket.status === TicketStatus.NEW) {
              patch.status = TicketStatus.TODO;
            }
            handleUpdateTicketById(ticket.id, patch);
          }
        } else {
          setSelectedTicket(null);
        }
      } else {
        prevMailboxTicketIdRef.current = undefined;
        if (!listLoading && tickets.length > 0) {
          const firstUnread = tickets.find((t) => t.messageProcessingStatus === 'unread' || t.messageProcessingStatus === 'unreplied');
          const targetId = firstUnread ? firstUnread.id : tickets[0].id;
          navigate(`/mailbox/${targetId}${mailboxSearchSuffix}`, { replace: true });
        } else if (!listLoading && tickets.length === 0) {
          setSelectedTicket(null);
        }
      }
      return;
    }
    if (ticketId) {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (ticket) {
        setSelectedTicket(ticket);
        const navigatedToThisTicket = prevMailboxTicketIdRef.current !== ticketId;
        prevMailboxTicketIdRef.current = ticketId;
        if (
          navigatedToThisTicket &&
          (ticket.messageProcessingStatus === 'unread' || ticket.status === TicketStatus.NEW)
        ) {
          const patch: Partial<Ticket> = { messageProcessingStatus: 'unreplied' };
          if (ticket.status === TicketStatus.NEW) {
            patch.status = TicketStatus.TODO;
          }
          handleUpdateTicketById(ticket.id, patch);
        }
      }
    } else {
      prevMailboxTicketIdRef.current = undefined;
      if (tickets.length > 0) {
        const firstUnread = tickets.find((t) => t.messageProcessingStatus === 'unread' || t.messageProcessingStatus === 'unreplied');
        const targetId = firstUnread ? firstUnread.id : tickets[0].id;
        navigate(`/mailbox/${targetId}`);
      }
    }
  }, [ticketId, navigate, tickets, live, listLoading, mailboxSearchSuffix]);

  const ordersForList = live ? ordersMap : MOCK_ORDERS;
  const customersForList = live ? customersMap : MOCK_CUSTOMERS;

  const handleSendMessage = (payload: {
    content: string;
    recipients: ('customer' | 'manager')[];
    isInternal: boolean;
    translateToPlatform?: boolean;
    isAiGenerated?: boolean;
    attachments?: string[];
  }): void | Promise<void> => {
    if (!selectedTicket) return;
    const tid = selectedTicket.id;
    const doTranslate =
      !payload.isInternal &&
      payload.translateToPlatform &&
      payload.recipients.length > 0;

    if (live) {
      return (async () => {
        try {
          const created = await postTicketMessage(tenantId, apiUserId, tid, {
            content: payload.content,
            senderType: payload.isAiGenerated ? 'ai' : 'agent',
            senderId: payload.isAiGenerated ? 'AI 助手' : (user?.name || 'agent'),
            isInternal: payload.isInternal,
            attachments: payload.attachments,
            sentPlatformText: doTranslate
              ? mockTranslateToPlatformLanguage(
                  payload.content,
                  selectedTicket.channelId,
                  selectedTicket.channelPlatformLanguage
                )
              : undefined,
            deliveryTargets:
              !payload.isInternal && payload.recipients.length > 0
                ? [...payload.recipients]
                : undefined,
          });
          setMessagesByTicket((prev) => {
            const cur = prev[tid] || [];
            const mapped = mapApiMessageToUi(created);
            mapped.deliveryStatus = 'success';
            if (cur.some((m) => m.id === mapped.id)) return prev;
            return { ...prev, [tid]: [...cur, mapped] };
          });
          // 回复后自动标记为已回复
          if (!payload.isInternal && selectedTicket.messageProcessingStatus !== 'replied') {
            handleUpdateTicket({ messageProcessingStatus: 'replied' });
          }
          setApiError(null);
        } catch (e) {
          setApiError(intellideskFetchErrorMessage(e));
          throw e;
        }
      })();
    }

    const newMsg: Message = {
      id: `M-${Date.now()}`,
      ticketId: tid,
      senderId: payload.isAiGenerated ? 'AI 助手' : (user?.name || '当前客服'),
      senderType: payload.isAiGenerated ? 'ai' : 'agent',
      content: payload.content,
      createdAt: new Date().toISOString(),
      isInternal: payload.isInternal,
      ...(!payload.isInternal ? { deliveryStatus: 'sending' } : {}),
      ...(payload.attachments?.length ? { attachments: [...payload.attachments] } : {}),
      ...(doTranslate
        ? {
            sentPlatformText: mockTranslateToPlatformLanguage(
              payload.content,
              selectedTicket.channelId,
              selectedTicket.channelPlatformLanguage
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

    if (!payload.isInternal) {
      setTimeout(() => {
        setMessagesByTicket((prev) => {
          const cur = prev[tid] || [];
          const idx = cur.findIndex((m) => m.id === newMsg.id);
          if (idx === -1) return prev;
          const updated = [...cur];
          updated[idx] = { ...updated[idx], deliveryStatus: 'success' };
          return { ...prev, [tid]: updated };
        });
      }, 1000);
    }

    // 回复后自动标记为已回复
    if (!payload.isInternal && selectedTicket.messageProcessingStatus !== 'replied') {
      handleUpdateTicket({ messageProcessingStatus: 'replied' });
    }
    return Promise.resolve();
  };

  const handleUpdateInternalNote = (messageId: string, content: string) => {
    if (!selectedTicket) return;
    const tid = selectedTicket.id;
    if (live) {
      return (async () => {
        try {
          const updated = await patchTicketMessage(tenantId, apiUserId, tid, messageId, { content });
          const mapped = mapApiMessageToUi(updated);
          setMessagesByTicket((prev) => ({
            ...prev,
            [tid]: (prev[tid] || []).map((m) => (m.id === messageId ? mapped : m)),
          }));
          setApiError(null);
        } catch (e) {
          setApiError(intellideskFetchErrorMessage(e));
          throw e;
        }
      })();
    }
    setMessagesByTicket((prev) => ({
      ...prev,
      [tid]: (prev[tid] || []).map((m) => (m.id === messageId ? { ...m, content } : m)),
    }));
  };

  const handleDeleteInternalNote = (messageId: string) => {
    if (!selectedTicket) return;
    const tid = selectedTicket.id;
    if (live) {
      return (async () => {
        try {
          await deleteTicketMessage(tenantId, apiUserId, tid, messageId);
          setMessagesByTicket((prev) => ({
            ...prev,
            [tid]: (prev[tid] || []).filter((m) => m.id !== messageId),
          }));
          setApiError(null);
        } catch (e) {
          setApiError(intellideskFetchErrorMessage(e));
          throw e;
        }
      })();
    }
    setMessagesByTicket((prev) => ({
      ...prev,
      [tid]: (prev[tid] || []).filter((m) => m.id !== messageId),
    }));
  };

  const handleUpdateTicket = (patch: Partial<Ticket>) => {
    if (!selectedTicket) return;
    handleUpdateTicketById(selectedTicket.id, patch);
  };

  const agentSeatDisplayName = useMemo(() => {
    if (!selectedTicket) return user?.name?.trim() || user?.email?.trim() || null;
    const seatId =
      seatAssignmentByTicket[selectedTicket.id] ??
      selectedTicket.assignedSeatId ??
      null;
    if (seatId) {
      const opt = seatOptions.find((s) => s.id === seatId);
      if (opt?.label?.trim()) return opt.label.trim();
    }
    return user?.name?.trim() || user?.email?.trim() || null;
  }, [
    selectedTicket?.id,
    selectedTicket?.assignedSeatId,
    seatAssignmentByTicket,
    seatOptions,
    user?.name,
    user?.email,
  ]);

  return (
    <div className="flex h-full overflow-hidden flex-col">
      {live && !listLoading && !apiError && tickets.length === 0 ? (
        <div className="shrink-0 px-4 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-950">
          <p className="font-semibold">当前没有可显示的工单</p>
          {filter ? (
            <p className="mt-1 text-amber-900/90">
              地址栏含筛选参数 <code className="rounded bg-amber-100 px-1 text-xs">?filter={filter}</code>
              ，可能没有符合条件的工单。可
              <Link to="/mailbox" className="underline font-medium text-amber-950 mx-0.5">
                进入收件箱（清除筛选）
              </Link>
              再试。
            </p>
          ) : (
            <>
              <p className="mt-1 text-amber-900/90 leading-relaxed">
                <strong>从上游拉工单：</strong>须先同步店铺与订单，再同步会话。管理员可在{' '}
                <Link to="/admin/system-sync" className="underline font-medium text-amber-950">
                  管理后台 · 数据同步
                </Link>
                （<code className="rounded bg-amber-100 px-1 text-xs">/admin/system-sync</code>
                ，不在设置菜单中）执行全量拉取；若开启「无真实会话时不生成演示工单」且近 90 天无会话，列表会为空。也可在工单列表标题旁点
                <strong>刷新</strong>，拉取会话与消息并跑 AI 意图/情绪。
              </p>
              {user?.role !== 'admin' ? (
                <p className="mt-1 text-xs text-amber-800/90 leading-relaxed">
                  数据同步仅管理员可用；请联系管理员执行全量拉取，或请其为您打开上述地址。
                </p>
              ) : null}
              <p className="mt-2 text-amber-900/90 leading-relaxed">
                <strong>本地演示数据：</strong>
                <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">db:seed:production</code> 不含工单；需要演示工单请在同一数据库执行{' '}
                <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">cd backend && npm run db:seed</code>。
              </p>
              <p className="mt-2 text-xs text-amber-800/80 leading-relaxed">
                收件箱与接口使用工作区 ID：<code className="rounded bg-amber-100 px-1">{tenantId}</code>
                （与 <code className="rounded bg-amber-100 px-1">localStorage.intellidesk_tenant_id</code> 或{' '}
                <code className="rounded bg-amber-100 px-1">VITE_INTELLIDESK_TENANT_ID</code> 一致，默认同演示环境{' '}
                <code className="rounded bg-amber-100 px-1">{DEFAULT_DEMO_TENANT_ID}</code>）。若与拉取请求使用的{' '}
                <code className="rounded bg-amber-100 px-1">X-Tenant-Id</code> 不一致，会看不到刚拉取的数据。
              </p>
            </>
          )}
        </div>
      ) : null}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <InboxList
          tickets={tickets}
          orders={ordersForList}
          customers={customersForList}
          selectedTicketId={ticketId}
          mailboxSearchSuffix={mailboxSearchSuffix}
          onInboxSynced={() => setListReloadNonce((n) => n + 1)}
          onTicketHover={live ? prefetchTicketDetail : undefined}
          {...(live
            ? {
                listSearchQuery: inboxListSearchInput,
                onListSearchQueryChange: setInboxListSearchInput,
                listSearchServerBacked: true,
              }
            : {})}
        />

        <div className="flex-1 overflow-hidden relative">
          {live && listLoading && !ticketId ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 text-sm text-slate-500">
              加载中…
            </div>
          ) : null}
          {live && ticketId && !selectedTicket && (listLoading || detailLoading) ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/70 text-sm text-slate-600 gap-2">
              <Loader2 className="w-8 h-8 text-[#F97316] animate-spin" />
              <span>正在加载工单详情…</span>
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
              onUpdateInternalNote={handleUpdateInternalNote}
              onDeleteInternalNote={handleDeleteInternalNote}
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
              conversationLoading={live && detailLoading}
              conversationError={live ? detailError : null}
              conversationMessagesTotal={live ? detailMessagesTotal : null}
              onLoadOlderMessages={live && ticketId ? loadOlderTicketMessages : undefined}
              olderMessagesLoading={live ? olderMessagesLoading : false}
              onReloadConversation={live && ticketId ? reloadConversation : undefined}
              agentSeatDisplayName={agentSeatDisplayName}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 px-4 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8" />
              </div>
              <p className="text-sm font-medium">
                {live && ticketId && !listLoading && !detailLoading && tickets.length > 0
                  ? '未在列表中找到该工单（可能超出当前列表条数），请从左侧列表进入或确认工单 ID'
                  : live && !listLoading && tickets.length === 0
                    ? '暂无工单（请确认已 seed 数据库）'
                    : '请选择一个工单查看详情'}
              </p>
              {live && ticketId && detailError ? (
                <p className="mt-3 text-xs text-red-600 max-w-md">{detailError}</p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
