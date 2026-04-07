import type {
  Ticket as PTicket,
  Message as PMessage,
  Order as POrder,
  Customer as PCustomer,
  Channel,
  LogisticsEvent,
  AfterSalesRecord,
} from '@prisma/client';
import { mergeOrderStoreEntityForInvoice } from '../lib/invoiceEntityMother.js';

/** 列表用：最近一条买家（customer）入站消息正文，供前端截断展示 */
export function lastInboundPreviewFromMessages(
  messages: { content: string }[] | undefined | null,
  maxLen = 240
): string | null {
  const m = messages?.[0];
  const raw = m?.content?.trim() ?? '';
  if (!raw) return null;
  return raw.length > maxLen ? raw.slice(0, maxLen) : raw;
}

export function mapTicket(
  t: PTicket & { channel?: Channel; customer?: PCustomer; order?: POrder | null }
) {
  return {
    id: t.id,
    channelId: t.channel?.displayName ?? t.channelId,
    platformType: t.channel?.platformType ?? null,
    channelRefId: t.channelId,
    customerId: t.customerId,
    orderId: t.orderId,
    status: t.status,
    priority: t.priority,
    sentiment: t.sentiment,
    intent: t.intent,
    messageProcessingStatus: t.messageProcessingStatus,
    subject: t.subject,
    subjectOriginal: t.subjectOriginal,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    firstResponseAt: t.firstResponseAt?.toISOString() ?? null,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    slaDueAt: t.slaDueAt.toISOString(),
    isImportant: t.isImportant,
    isFavorite: t.isFavorite,
    isShared: t.isShared,
    tags: t.tags,
    assignedSeatId: t.assignedSeatId,
    ownerUserId: t.ownerUserId,
    channelDefaultCurrency: t.channel?.defaultCurrency ?? null,
    channelPlatformLanguage: t.channel?.platformLanguage ?? null,
    /** 已关联母系统会话 ID（不暴露原始 id，供前端空消息时提示同步） */
    motherConversationLinked: Boolean(t.externalId?.trim()),
  };
}

export function mapMessage(m: PMessage) {
  return {
    id: m.id,
    ticketId: m.ticketId,
    senderId: m.senderId,
    senderType: m.senderType,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    attachments: m.attachments,
    isInternal: m.isInternal,
    translatedContent: m.translatedContent,
    sentPlatformText: m.sentPlatformText,
    deliveryTargets: m.deliveryTargets,
  };
}

export function mapCustomer(c: PCustomer) {
  return {
    id: c.id,
    name: c.name,
    email: c.email ?? '',
    phone: c.phone,
    shippingCountry: c.shippingCountry ?? '—',
    sentiment: c.sentiment,
    segments: c.segments,
    totalOrderValue: Number(c.totalOrderValue),
    ordersCount: c.ordersCount,
    latestPurchaseAt: c.latestPurchaseAt?.toISOString() ?? c.createdAt.toISOString(),
    customerSince: c.customerSince.toISOString(),
  };
}

export function mapOrder(
  o: POrder & { channel?: Channel; logisticsEvents?: LogisticsEvent[] }
) {
  const events = (o.logisticsEvents ?? [])
    .slice()
    .sort((a, b) => b.sortIndex - a.sortIndex || b.timestamp.getTime() - a.timestamp.getTime());
  return {
    id: o.id,
    platformOrderId: o.platformOrderId,
    customerId: o.customerId,
    channelId: o.channel?.displayName ?? o.channelId,
    channelRefId: o.channelId,
    skuList: o.skuList,
    productTitles: o.productTitles,
    eanList: o.eanList,
    amount: Number(o.amount),
    currency: (() => {
      const c = (o.currency ?? '').trim().toUpperCase();
      if (c) return c;
      const dc = (o.channel?.defaultCurrency ?? '').trim().toUpperCase();
      if (dc) return dc;
      return 'USD';
    })(),
    orderStatus: o.orderStatus,
    shippingStatus: o.shippingStatus ?? '',
    trackingNumber: o.trackingNumber,
    deliveryEta: o.deliveryEta,
    paymentStatus: o.paymentStatus ?? '',
    refundStatus: o.refundStatus,
    returnStatus: o.returnStatus,
    logisticsStatus: o.logisticsStatus,
    logisticsPrimaryStatus: o.logisticsPrimaryStatus,
    logisticsSecondaryStatus: o.logisticsSecondaryStatus,
    logisticsStatusCode: o.logisticsStatusCode,
    logisticsSubStatusCode: o.logisticsSubStatusCode,
    isLogisticsException: o.isLogisticsException,
    logisticsLastSyncedAt: o.logisticsLastSyncedAt?.toISOString() ?? null,
    logisticsIsRegistered: o.logisticsIsRegistered,
    carrier: o.carrier,
    paidAt: o.paidAt?.toISOString() ?? null,
    shippedAt: o.shippedAt?.toISOString() ?? null,
    refundedAt: o.refundedAt?.toISOString() ?? null,
    platformType: o.channel?.platformType ?? null,
    hasVatInfo: o.hasVatInfo,
    storeEntity: mergeOrderStoreEntityForInvoice(o.storeEntity, o.channel?.invoiceStoreEntity) as any,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    logisticsEvents: events.map((e) => ({
      id: e.id,
      status: e.status,
      subStatus: e.subStatus,
      description: e.description,
      location: e.location,
      timestamp: e.timestamp.toISOString(),
    })),
  };
}

type AfterSalesWithRelations = AfterSalesRecord & {
  ticket?:
    | (PTicket & {
        channel?: Pick<Channel, 'displayName' | 'platformType'> | null;
      })
    | null;
  order?: (POrder & { channel?: Pick<Channel, 'displayName' | 'platformType'> | null }) | null;
};

export function mapAfterSales(a: AfterSalesWithRelations) {
  const titles = a.order?.productTitles?.filter(Boolean) ?? [];
  return {
    id: a.id,
    orderId: a.orderId,
    ticketId: a.ticketId,
    type: a.type,
    status: a.status,
    handlingMethod: a.handlingMethod,
    priority: a.priority,
    problemType: a.problemType,
    buyerFeedback: a.buyerFeedback,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    refundAmount: a.refundAmount != null ? Number(a.refundAmount) : undefined,
    refundReason: a.refundReason ?? undefined,
    returnTrackingNumber: a.returnTrackingNumber ?? undefined,
    returnCarrier: a.returnCarrier ?? undefined,
    reissueSku: a.reissueSku ?? undefined,
    reissueQuantity: a.reissueQuantity ?? undefined,
    channelShopLabel: a.ticket?.channel?.displayName ?? undefined,
    channelPlatformType: a.ticket?.channel?.platformType ?? undefined,
    orderPlatformOrderId: a.order?.platformOrderId ?? undefined,
    orderAmount: a.order?.amount != null ? Number(a.order.amount) : undefined,
    orderCurrency: a.order?.currency ?? undefined,
    orderProductTitles: titles.length ? titles : undefined,
    orderChannelShopLabel: a.order?.channel?.displayName ?? undefined,
    orderChannelPlatformType: a.order?.channel?.platformType ?? undefined,
  };
}
