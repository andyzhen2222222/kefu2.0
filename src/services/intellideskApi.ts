/**
 * IntelliDesk 自建后端 API（与 backend/openapi/openapi.yaml 对齐）。
 *
 * - 默认：未设 `VITE_API_BASE_URL` → 演示/mock 数据。
 * - 显式：`VITE_INTELLIDESK_DATA_SOURCE=mock` 时强制 mock（即使误配了 API 地址）。
 * - 联调：`VITE_INTELLIDESK_DATA_SOURCE=api` 且配置 `VITE_API_BASE_URL`。
 * 本地端口：`npm run dev` / `dev:mock` → UI :3000（mock）；`dev:api` / `dev:live` → UI :4000 代理到后端 :4001。
 */
import type { AfterSalesRecord, Customer, Message, Order, Ticket } from '@/src/types';
import {
  LogisticsStatus,
  Sentiment,
  TicketStatus,
  type MessageProcessingStatus,
} from '@/src/types';

const base = () => (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

function intellideskDataSourceExplicit(): 'mock' | 'api' | '' {
  const v = (import.meta.env.VITE_INTELLIDESK_DATA_SOURCE ?? '').trim().toLowerCase();
  if (v === 'mock' || v === '0' || v === 'false' || v === 'demo') return 'mock';
  if (v === 'api' || v === '1' || v === 'true' || v === 'live') return 'api';
  return '';
}

/** 与 prisma seed 一致，便于本地联调 */
export const DEFAULT_DEMO_TENANT_ID = '11111111-1111-4111-8111-111111111111';
export const DEFAULT_DEMO_USER_ID = '22222222-2222-4222-8222-222222222222';

/** 是否使用自建后端（非演示数据） */
export function intellideskConfigured(): boolean {
  const explicit = intellideskDataSourceExplicit();
  if (explicit === 'mock') return false;
  if (explicit === 'api') return Boolean(base());
  return Boolean(base());
}

/** 是否为纯前端演示/mock（与 intellideskConfigured 互斥） */
export function intellideskMockMode(): boolean {
  return !intellideskConfigured();
}

export function intellideskTenantId(): string {
  return (import.meta.env.VITE_INTELLIDESK_TENANT_ID ?? '').trim() || DEFAULT_DEMO_TENANT_ID;
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** 写操作请求头：优先环境变量，其次 Firebase uid（若为 UUID），否则种子 admin */
export function intellideskUserIdForApi(authUserId?: string | null): string | undefined {
  const fromEnv = (import.meta.env.VITE_INTELLIDESK_USER_ID ?? '').trim();
  if (fromEnv) return fromEnv;
  if (authUserId && isUuid(authUserId)) return authUserId;
  return DEFAULT_DEMO_USER_ID;
}

export function intellideskHeaders(tenantId: string, userId?: string | null): HeadersInit {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Tenant-Id': tenantId,
  };
  if (userId) h['X-User-Id'] = userId;
  return h;
}

let bearerTokenGetter: (() => Promise<string | null>) | null = null;

/** 在 AuthProvider 中注册 Firebase `getIdToken`，请求将附带 `Authorization: Bearer` */
export function registerIntellideskBearerTokenGetter(fn: () => Promise<string | null>) {
  bearerTokenGetter = fn;
}

export async function intellideskHeadersWithAuth(
  tenantId: string,
  userId?: string | null
): Promise<HeadersInit> {
  const h = { ...(intellideskHeaders(tenantId, userId) as Record<string, string>) };
  if (bearerTokenGetter) {
    try {
      const t = await bearerTokenGetter();
      if (t) h.Authorization = `Bearer ${t}`;
    } catch {
      /* 忽略取 token 失败，仍可用 X-User-Id */
    }
  }
  return h;
}

export function intellideskWsUrl(tenantId: string): string | null {
  const b = base();
  if (!b) return null;
  let u: URL;
  try {
    u = new URL(b);
  } catch {
    return null;
  }
  const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${u.host}/ws?tenantId=${encodeURIComponent(tenantId)}`;
}

async function parseError(res: Response): Promise<string> {
  const t = await res.text();
  try {
    const j = JSON.parse(t) as { message?: string; error?: string };
    return j.message || j.error || t || res.statusText;
  } catch {
    return t || res.statusText;
  }
}

// --- Raw DTOs (subset; aligned with backend mappers) ---

export type ApiTicketRaw = {
  id: string;
  channelId: string;
  platformType?: string | null;
  customerId: string;
  orderId?: string | null;
  status: string;
  priority: number;
  sentiment: string;
  intent: string;
  messageProcessingStatus: string;
  subject: string;
  subjectOriginal?: string | null;
  createdAt: string;
  updatedAt: string;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  slaDueAt: string;
  isImportant: boolean;
  isFavorite: boolean;
  isShared: boolean;
  tags: string[];
  assignedSeatId?: string | null;
  ownerUserId?: string | null;
};

export type ApiMessageRaw = {
  id: string;
  ticketId: string;
  senderId: string;
  senderType: Message['senderType'];
  content: string;
  createdAt: string;
  attachments?: string[];
  isInternal?: boolean;
  translatedContent?: string | null;
  sentPlatformText?: string | null;
  deliveryTargets?: ('customer' | 'manager')[];
};

export type ApiCustomerRaw = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  shippingCountry: string;
  sentiment: string;
  segments: string[];
  totalOrderValue: number;
  ordersCount: number;
  latestPurchaseAt: string;
  customerSince: string;
};

export type ApiLogisticsEventRaw = {
  id: string;
  status: string;
  subStatus: string;
  description: string;
  location?: string | null;
  timestamp: string;
};

export type ApiOrderRaw = {
  id: string;
  platformOrderId: string;
  customerId: string;
  channelId: string;
  skuList: string[];
  productTitles: string[];
  amount: number;
  currency: string;
  orderStatus: string;
  shippingStatus: string;
  trackingNumber?: string | null;
  deliveryEta?: string | null;
  paymentStatus: string;
  refundStatus?: string | null;
  returnStatus?: string | null;
  logisticsStatus?: string | null;
  logisticsEvents?: ApiLogisticsEventRaw[];
  carrier?: string | null;
  hasVatInfo?: boolean;
};

export type ApiTicketDetail = ApiTicketRaw & {
  messages: ApiMessageRaw[];
  customer: ApiCustomerRaw | null;
  order: ApiOrderRaw | null;
};

export type TicketsListResponse = {
  limit: number;
  cursor: string | null;
  nextCursor: string | null;
  items: ApiTicketRaw[];
};

const SENTIMENT_VALUES = new Set<string>(Object.values(Sentiment));
const TICKET_STATUS_VALUES = new Set<string>(Object.values(TicketStatus));
const LOGISTICS_VALUES = new Set<string>(Object.values(LogisticsStatus));

function mapSentiment(s: string): Sentiment {
  const v = s?.toLowerCase?.() ?? '';
  if (SENTIMENT_VALUES.has(v)) return v as Sentiment;
  return Sentiment.NEUTRAL;
}

function mapTicketStatus(s: string): TicketStatus {
  const v = s?.toLowerCase?.() ?? '';
  if (TICKET_STATUS_VALUES.has(v)) return v as TicketStatus;
  return TicketStatus.NEW;
}

function mapMessageProcessingStatus(s: string): MessageProcessingStatus {
  if (s === 'unread' || s === 'unreplied' || s === 'replied') return s;
  return 'unread';
}

function mapLogisticsStatus(s: string | undefined): LogisticsStatus | undefined {
  if (!s) return undefined;
  if (LOGISTICS_VALUES.has(s)) return s as LogisticsStatus;
  return LogisticsStatus.NOT_FOUND;
}

export function mapApiTicketToUi(raw: ApiTicketRaw): Ticket {
  return {
    id: raw.id,
    channelId: raw.channelId,
    platformType: raw.platformType ?? null,
    customerId: raw.customerId,
    orderId: raw.orderId ?? undefined,
    status: mapTicketStatus(raw.status),
    priority: raw.priority,
    sentiment: mapSentiment(raw.sentiment),
    intent: raw.intent ?? '',
    messageProcessingStatus: mapMessageProcessingStatus(raw.messageProcessingStatus),
    subject: raw.subject ?? '',
    subjectOriginal: raw.subjectOriginal ?? undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    firstResponseAt: raw.firstResponseAt ?? undefined,
    resolvedAt: raw.resolvedAt ?? undefined,
    slaDueAt: raw.slaDueAt,
    isImportant: Boolean(raw.isImportant),
    isFavorite: Boolean(raw.isFavorite),
    isShared: Boolean(raw.isShared),
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    assignedSeatId: raw.assignedSeatId ?? undefined,
    ownerUserId: raw.ownerUserId ?? undefined,
  };
}

export function mapApiMessageToUi(raw: ApiMessageRaw): Message {
  return {
    id: raw.id,
    ticketId: raw.ticketId,
    senderId: raw.senderId,
    senderType: raw.senderType,
    content: raw.content,
    createdAt: raw.createdAt,
    attachments: raw.attachments,
    isInternal: raw.isInternal,
    translatedContent: raw.translatedContent ?? undefined,
    sentPlatformText: raw.sentPlatformText ?? undefined,
    deliveryTargets: raw.deliveryTargets,
  };
}

export function mapApiCustomerToUi(raw: ApiCustomerRaw): Customer {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email ?? '',
    phone: raw.phone ?? undefined,
    shippingCountry: raw.shippingCountry ?? '—',
    sentiment: mapSentiment(raw.sentiment),
    segments: Array.isArray(raw.segments) ? raw.segments : [],
    totalOrderValue: Number(raw.totalOrderValue) || 0,
    ordersCount: raw.ordersCount ?? 0,
    latestPurchaseAt: raw.latestPurchaseAt,
    customerSince: raw.customerSince,
  };
}

export function mapApiOrderToUi(raw: ApiOrderRaw): Order {
  const events = (raw.logisticsEvents ?? []).map((e) => ({
    id: e.id,
    status: mapLogisticsStatus(e.status) ?? LogisticsStatus.NOT_FOUND,
    subStatus: e.subStatus ?? '',
    description: e.description ?? '',
    location: e.location ?? undefined,
    timestamp: e.timestamp,
  }));
  const os = raw.orderStatus as Order['orderStatus'];
  const allowed: Order['orderStatus'][] = ['unshipped', 'shipped', 'refunded', 'partial_refund'];
  const orderStatus = allowed.includes(os) ? os : 'shipped';
  return {
    id: raw.id,
    platformOrderId: raw.platformOrderId,
    customerId: raw.customerId,
    channelId: raw.channelId,
    skuList: Array.isArray(raw.skuList) ? raw.skuList : [],
    productTitles: Array.isArray(raw.productTitles) ? raw.productTitles : [],
    amount: Number(raw.amount) || 0,
    currency: raw.currency ?? 'USD',
    orderStatus,
    shippingStatus: raw.shippingStatus ?? '',
    trackingNumber: raw.trackingNumber ?? undefined,
    deliveryEta: raw.deliveryEta ?? undefined,
    paymentStatus: raw.paymentStatus ?? '',
    refundStatus: raw.refundStatus ?? undefined,
    returnStatus: raw.returnStatus ?? undefined,
    logisticsStatus: mapLogisticsStatus(raw.logisticsStatus ?? undefined),
    logisticsEvents: events.length ? events : undefined,
    carrier: raw.carrier ?? undefined,
    hasVatInfo: raw.hasVatInfo,
  };
}

export async function fetchTicketsList(
  tenantId: string,
  userId: string | undefined,
  qs?: Record<string, string | undefined>
): Promise<TicketsListResponse> {
  const u = new URL(`${base()}/api/tickets`);
  if (qs) {
    for (const [k, v] of Object.entries(qs)) {
      if (v != null) u.searchParams.set(k, v);
    }
  }
  const res = await fetch(u.toString(), { headers: await intellideskHeadersWithAuth(tenantId, userId) });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<TicketsListResponse>;
}

export async function fetchTicketDetail(
  tenantId: string,
  userId: string | undefined,
  ticketId: string
): Promise<ApiTicketDetail> {
  const res = await fetch(`${base()}/api/tickets/${ticketId}`, {
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiTicketDetail>;
}

export type PatchTicketBody = Partial<{
  status: TicketStatus;
  priority: number;
  tags: string[];
  messageProcessingStatus: MessageProcessingStatus;
  assignedSeatId: string | null;
  isFavorite: boolean;
  isImportant: boolean;
  subject: string;
  subjectOriginal: string | null;
  intent: string;
  sentiment: string;
}>;

export async function patchTicket(
  tenantId: string,
  userId: string | undefined,
  ticketId: string,
  body: PatchTicketBody
): Promise<ApiTicketRaw> {
  const res = await fetch(`${base()}/api/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiTicketRaw>;
}

export type PostTicketMessageBody = {
  content: string;
  senderType: Message['senderType'];
  senderId?: string;
  isInternal?: boolean;
  attachments?: string[];
  translatedContent?: string;
  sentPlatformText?: string;
  deliveryTargets?: ('customer' | 'manager')[];
};

export async function postTicketMessage(
  tenantId: string,
  userId: string | undefined,
  ticketId: string,
  body: PostTicketMessageBody
): Promise<ApiMessageRaw> {
  const res = await fetch(`${base()}/api/tickets/${ticketId}/messages`, {
    method: 'POST',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiMessageRaw>;
}

export type AgentSeatRow = {
  id: string;
  displayName: string;
  email: string;
  account: string;
  roleId: string;
  status: 'active' | 'inactive';
};

export async function fetchAgentSeats(
  tenantId: string,
  userId: string | undefined
): Promise<AgentSeatRow[]> {
  const res = await fetch(`${base()}/api/settings/agent-seats`, {
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<AgentSeatRow[]>;
}

export async function fetchOrderDetail(
  tenantId: string,
  userId: string | undefined,
  orderId: string
): Promise<ApiOrderRaw> {
  const res = await fetch(`${base()}/api/orders/${orderId}`, {
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiOrderRaw>;
}

export async function fetchOrderByPlatformOrderId(
  tenantId: string,
  userId: string | undefined,
  platformOrderId: string
): Promise<ApiOrderRaw> {
  const u = new URL(`${base()}/api/orders`);
  u.searchParams.set('platformOrderId', platformOrderId.trim());
  const res = await fetch(u.toString(), { headers: await intellideskHeadersWithAuth(tenantId, userId) });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiOrderRaw>;
}

// --- Dashboard ---

export type InboxMetricCard = {
  current: number;
  previousSameTimeYesterday: number;
  changePercent: number | null;
  periodLabel: string;
};

export type DashboardInboxMetrics = {
  unread: InboxMetricCard;
  unreplied: InboxMetricCard;
  replied: InboxMetricCard;
  slaOverdue: InboxMetricCard;
};

export type StructureBucket = Record<string, { count: number; percent: number }>;

export type DashboardStructure = {
  afterSalesIntent: StructureBucket;
  sentiment: StructureBucket;
  orderStatus: StructureBucket;
  /** 按工单关联店铺的 platformType 聚合为平台级（Amazon、eBay 等） */
  channels: StructureBucket;
};

export type TrendPoint = { name: string; tickets: number; resolved: number };

export async function fetchDashboardInboxMetrics(
  tenantId: string,
  userId: string | undefined
): Promise<DashboardInboxMetrics> {
  const res = await fetch(`${base()}/api/dashboard/inbox-metrics`, {
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<DashboardInboxMetrics>;
}

export async function fetchDashboardStructure(
  tenantId: string,
  userId: string | undefined
): Promise<DashboardStructure> {
  const res = await fetch(`${base()}/api/dashboard/structure`, {
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<DashboardStructure>;
}

export async function fetchDashboardTrends(
  tenantId: string,
  userId: string | undefined,
  range: '7d' | '30d' = '7d'
): Promise<{ range: string; series: TrendPoint[] }> {
  const u = new URL(`${base()}/api/dashboard/trends`);
  u.searchParams.set('range', range === '30d' ? '30d' : '7d');
  const res = await fetch(u.toString(), { headers: await intellideskHeadersWithAuth(tenantId, userId) });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ range: string; series: TrendPoint[] }>;
}

// --- After-sales ---

export type ApiAfterSalesRaw = {
  id: string;
  orderId: string;
  ticketId: string;
  type: string;
  status: string;
  handlingMethod: string;
  priority: string;
  problemType: string;
  buyerFeedback: string;
  createdAt: string;
  updatedAt: string;
  refundAmount?: number;
  refundReason?: string;
  returnTrackingNumber?: string;
  returnCarrier?: string;
  reissueSku?: string;
  reissueQuantity?: number;
};

function mapAfterSalesToUi(raw: ApiAfterSalesRaw): AfterSalesRecord {
  return {
    id: raw.id,
    orderId: raw.orderId,
    ticketId: raw.ticketId,
    type: raw.type as AfterSalesRecord['type'],
    status: raw.status as AfterSalesRecord['status'],
    handlingMethod: raw.handlingMethod,
    priority: (['low', 'medium', 'high'].includes(raw.priority) ? raw.priority : 'medium') as
      | 'low'
      | 'medium'
      | 'high',
    problemType: raw.problemType,
    buyerFeedback: raw.buyerFeedback,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    refundAmount: raw.refundAmount,
    refundReason: raw.refundReason,
    returnTrackingNumber: raw.returnTrackingNumber,
    returnCarrier: raw.returnCarrier,
    reissueSku: raw.reissueSku,
    reissueQuantity: raw.reissueQuantity,
  };
}

export async function fetchAfterSalesList(
  tenantId: string,
  userId: string | undefined,
  qs?: { ticketId?: string; orderId?: string }
): Promise<AfterSalesRecord[]> {
  const u = new URL(`${base()}/api/after-sales`);
  if (qs?.ticketId) u.searchParams.set('ticketId', qs.ticketId);
  if (qs?.orderId) u.searchParams.set('orderId', qs.orderId);
  const res = await fetch(u.toString(), { headers: await intellideskHeadersWithAuth(tenantId, userId) });
  if (!res.ok) throw new Error(await parseError(res));
  const rows = (await res.json()) as ApiAfterSalesRaw[];
  return rows.map(mapAfterSalesToUi);
}

export type CreateAfterSalesBody = {
  orderId: string;
  /** 不传时由后端按订单解析或自动建联工单 */
  ticketId?: string;
  type: AfterSalesRecord['type'];
  status?: AfterSalesRecord['status'];
  priority?: 'low' | 'medium' | 'high';
  handlingMethod?: string;
  problemType?: string;
  buyerFeedback: string;
  refundAmount?: number;
  refundReason?: string;
  returnTrackingNumber?: string;
  returnCarrier?: string;
  reissueSku?: string;
  reissueQuantity?: number;
};

export async function createAfterSalesRecord(
  tenantId: string,
  userId: string | undefined,
  body: CreateAfterSalesBody
): Promise<AfterSalesRecord> {
  const res = await fetch(`${base()}/api/after-sales`, {
    method: 'POST',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return mapAfterSalesToUi((await res.json()) as ApiAfterSalesRaw);
}

export type PatchAfterSalesBody = Partial<{
  status: AfterSalesRecord['status'];
  priority: 'low' | 'medium' | 'high';
  handlingMethod: string;
  problemType: string;
  buyerFeedback: string;
  refundAmount: number | null;
  refundReason: string | null;
  returnTrackingNumber: string | null;
  returnCarrier: string | null;
  reissueSku: string | null;
  reissueQuantity: number | null;
}>;

export async function patchAfterSalesRecord(
  tenantId: string,
  userId: string | undefined,
  id: string,
  body: PatchAfterSalesBody
): Promise<AfterSalesRecord> {
  const res = await fetch(`${base()}/api/after-sales/${id}`, {
    method: 'PATCH',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return mapAfterSalesToUi((await res.json()) as ApiAfterSalesRaw);
}

export async function postAiSuggestReply(
  tenantId: string,
  userId: string | undefined,
  ticketId: string
): Promise<{ suggestion: string }> {
  const res = await fetch(`${base()}/api/ai/suggest-reply`, {
    method: 'POST',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify({ ticketId }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ suggestion: string }>;
}

export type CreateAgentSeatBody = {
  displayName: string;
  email: string;
  account: string;
  roleId?: string;
  status?: 'active' | 'inactive';
};

export async function createAgentSeat(
  tenantId: string,
  userId: string | undefined,
  body: CreateAgentSeatBody
): Promise<AgentSeatRow> {
  const res = await fetch(`${base()}/api/settings/agent-seats`, {
    method: 'POST',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<AgentSeatRow>;
}

export async function deleteAgentSeat(
  tenantId: string,
  userId: string | undefined,
  seatId: string
): Promise<void> {
  const res = await fetch(`${base()}/api/settings/agent-seats/${seatId}`, {
    method: 'DELETE',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

// --- Settings: SLA / 自动回复 / 工单路由 ---

export type ApiSlaRuleRow = {
  id: string;
  name: string;
  channelPattern: string | null;
  warningHours: number;
  timeoutHours: number;
  enabled: boolean;
  conditions?: unknown;
};

export async function fetchSlaRules(
  tenantId: string,
  userId: string | undefined
): Promise<ApiSlaRuleRow[]> {
  const res = await fetch(`${base()}/api/settings/sla-rules`, {
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiSlaRuleRow[]>;
}

export type CreateSlaRuleBody = {
  name: string;
  channelPattern?: string | null;
  warningHours?: number;
  timeoutHours?: number;
  enabled?: boolean;
  conditions?: Record<string, unknown>;
};

export async function createSlaRule(
  tenantId: string,
  userId: string | undefined,
  body: CreateSlaRuleBody
): Promise<ApiSlaRuleRow> {
  const res = await fetch(`${base()}/api/settings/sla-rules`, {
    method: 'POST',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiSlaRuleRow>;
}

export type PatchSlaRuleBody = Partial<{
  name: string;
  channelPattern: string | null;
  warningHours: number;
  timeoutHours: number;
  enabled: boolean;
  conditions: Record<string, unknown> | null;
}>;

export async function patchSlaRule(
  tenantId: string,
  userId: string | undefined,
  id: string,
  body: PatchSlaRuleBody
): Promise<ApiSlaRuleRow> {
  const res = await fetch(`${base()}/api/settings/sla-rules/${id}`, {
    method: 'PATCH',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiSlaRuleRow>;
}

export async function deleteSlaRule(
  tenantId: string,
  userId: string | undefined,
  id: string
): Promise<void> {
  const res = await fetch(`${base()}/api/settings/sla-rules/${id}`, {
    method: 'DELETE',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export type ApiAutoReplyRuleRow = {
  id: string;
  name: string;
  enabled: boolean;
  intentMatch: string | null;
  keywords: string[];
  templateId: string | null;
  markRepliedOnSend: boolean;
};

export async function fetchAutoReplyRules(
  tenantId: string,
  userId: string | undefined
): Promise<ApiAutoReplyRuleRow[]> {
  const res = await fetch(`${base()}/api/settings/auto-reply-rules`, {
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiAutoReplyRuleRow[]>;
}

export type CreateAutoReplyRuleBody = {
  name: string;
  enabled?: boolean;
  intentMatch?: string | null;
  keywords?: string[];
  templateId?: string | null;
  markRepliedOnSend?: boolean;
};

export async function createAutoReplyRule(
  tenantId: string,
  userId: string | undefined,
  body: CreateAutoReplyRuleBody
): Promise<ApiAutoReplyRuleRow> {
  const res = await fetch(`${base()}/api/settings/auto-reply-rules`, {
    method: 'POST',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiAutoReplyRuleRow>;
}

export type PatchAutoReplyRuleBody = Partial<{
  name: string;
  enabled: boolean;
  intentMatch: string | null;
  keywords: string[];
  templateId: string | null;
  markRepliedOnSend: boolean;
}>;

export async function patchAutoReplyRule(
  tenantId: string,
  userId: string | undefined,
  id: string,
  body: PatchAutoReplyRuleBody
): Promise<ApiAutoReplyRuleRow> {
  const res = await fetch(`${base()}/api/settings/auto-reply-rules/${id}`, {
    method: 'PATCH',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiAutoReplyRuleRow>;
}

export async function deleteAutoReplyRule(
  tenantId: string,
  userId: string | undefined,
  id: string
): Promise<void> {
  const res = await fetch(`${base()}/api/settings/auto-reply-rules/${id}`, {
    method: 'DELETE',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export type ApiTicketRoutingRuleRow = {
  id: string;
  name: string;
  priority: number;
  conditions: unknown;
  targetSeatId: string | null;
  enabled: boolean;
};

export async function fetchTicketRoutingRules(
  tenantId: string,
  userId: string | undefined
): Promise<ApiTicketRoutingRuleRow[]> {
  const res = await fetch(`${base()}/api/settings/ticket-routing-rules`, {
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiTicketRoutingRuleRow[]>;
}

export type CreateTicketRoutingRuleBody = {
  name: string;
  priority?: number;
  conditions: Record<string, unknown>;
  targetSeatId?: string | null;
  enabled?: boolean;
};

export async function createTicketRoutingRule(
  tenantId: string,
  userId: string | undefined,
  body: CreateTicketRoutingRuleBody
): Promise<ApiTicketRoutingRuleRow> {
  const res = await fetch(`${base()}/api/settings/ticket-routing-rules`, {
    method: 'POST',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiTicketRoutingRuleRow>;
}

export type PatchTicketRoutingRuleBody = Partial<{
  name: string;
  priority: number;
  conditions: Record<string, unknown>;
  targetSeatId: string | null;
  enabled: boolean;
}>;

export async function patchTicketRoutingRule(
  tenantId: string,
  userId: string | undefined,
  id: string,
  body: PatchTicketRoutingRuleBody
): Promise<ApiTicketRoutingRuleRow> {
  const res = await fetch(`${base()}/api/settings/ticket-routing-rules/${id}`, {
    method: 'PATCH',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiTicketRoutingRuleRow>;
}

export async function deleteTicketRoutingRule(
  tenantId: string,
  userId: string | undefined,
  id: string
): Promise<void> {
  const res = await fetch(`${base()}/api/settings/ticket-routing-rules/${id}`, {
    method: 'DELETE',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
}
