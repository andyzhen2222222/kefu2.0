import type {
  Ticket as PTicket,
  Message as PMessage,
  Order as POrder,
  Customer as PCustomer,
  Channel,
  LogisticsEvent,
  AfterSalesRecord,
} from '@prisma/client';

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
    amount: Number(o.amount),
    currency: o.currency,
    orderStatus: o.orderStatus,
    shippingStatus: o.shippingStatus ?? '',
    trackingNumber: o.trackingNumber,
    deliveryEta: o.deliveryEta,
    paymentStatus: o.paymentStatus ?? '',
    refundStatus: o.refundStatus,
    returnStatus: o.returnStatus,
    logisticsStatus: o.logisticsStatus,
    carrier: o.carrier,
    hasVatInfo: o.hasVatInfo,
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

export function mapAfterSales(a: AfterSalesRecord) {
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
  };
}
