/**
 * IntelliDesk 自建后端 API（与 backend/openapi/openapi.yaml 对齐）。
 *
 * - 默认：未设 `VITE_API_BASE_URL` → 演示/mock 数据。
 * - 显式：`VITE_INTELLIDESK_DATA_SOURCE=mock` 时强制 mock（即使误配了 API 地址）。
 * - 联调：`VITE_INTELLIDESK_DATA_SOURCE=api` 且配置 `VITE_API_BASE_URL`。
 * 本地端口：`npm run dev` / `dev:mock` → UI :3000（mock）；`dev:api` / `dev:live` → UI :4001 代理到后端 :4000。
 */
import { enrichOrderStoreEntityWithNezha } from '@/src/lib/shippingAddressText';
import type { AfterSalesRecord, Customer, Message, Order, Ticket, User } from '@/src/types';
import {
  LogisticsStatus,
  Sentiment,
  TicketStatus,
  type MessageProcessingStatus,
} from '@/src/types';

const base = () => (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

/**
 * 拼接后端 API URL。联调站点根应为 `http://localhost:4001`（由 Vite 代理 /api 至后端 :4000）；
 * 若误配为 `.../api` 则不再重复拼一段 `/api`。
 */
export function resolveApiUrl(pathAfterApi: string): string {
  const raw = base().replace(/\/$/, '');
  if (!raw) return '';
  const tail = pathAfterApi.replace(/^\//, '');
  if (raw.toLowerCase().endsWith('/api')) {
    return `${raw}/${tail}`;
  }
  return `${raw}/api/${tail}`;
}

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
  // 检查 URL 参数，如果带了 ?live=1 强制进入 API 模式，最高优先级
  const params = new URLSearchParams(window.location.search);
  if (params.get('live') === '1') return true;

  const explicit = intellideskDataSourceExplicit();
  if (explicit === 'mock') return false;
  if (explicit === 'api') return Boolean(base());
  return Boolean(base());
}

/** 是否为纯前端演示/mock（与 intellideskConfigured 互斥） */
export function intellideskMockMode(): boolean {
  return !intellideskConfigured();
}

/** 优先本地存储的工作区 ID，再环境变量，最后 seed 默认 */
export function intellideskTenantId(): string {
  if (typeof window !== 'undefined') {
    try {
      const fromLs = localStorage.getItem('intellidesk_tenant_id')?.trim();
      if (fromLs) return fromLs;
    } catch {
      /* ignore */
    }
  }
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

/**
 * 联调：按登录框输入解析租户内用户（管理员用邮箱；坐席用与后台「登录账号」或邮箱一致的字符串）。
 * 对应后端 POST /api/auth/session-from-account（非 production 或 ALLOW_ACCOUNT_SESSION=1）。
 */
export async function resolveSessionUserFromAccount(
  tenantId: string,
  account: string | undefined
): Promise<{ user: User } | { user: null; error: string }> {
  if (!base()) return { user: null, error: '未配置 VITE_API_BASE_URL' };
  const body = JSON.stringify({ account: account ?? '' });
  const headers = { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId };

  let url = resolveApiUrl('auth/session-from-account');
  let res = await fetch(url, { method: 'POST', headers, body });
  if (res.status === 404) {
    const alt = resolveApiUrl('settings/session-from-account');
    if (alt !== url) {
      res = await fetch(alt, { method: 'POST', headers, body });
      url = alt;
    }
  }
  const text = await res.text();
  let data: { user?: User; message?: string; error?: string } = {};
  try {
    if (text) data = JSON.parse(text) as typeof data;
  } catch {
    /* 可能是代理/HTML 错误页 */
  }
  if (!res.ok) {
    const fromBody =
      (typeof data.message === 'string' && data.message) ||
      (typeof data.error === 'string' && data.error) ||
      '';
    if (fromBody) return { user: null, error: fromBody };
    if (res.status === 403) {
      return {
        user: null,
        error: '服务端未开启按账号登录（生产环境需设置 ALLOW_ACCOUNT_SESSION=1）',
      };
    }
    if (res.status === 404) {
      return {
        user: null,
        error:
          '登录接口返回 404：请确认 ① 后端已用当前代码重启（含 POST /api/auth/session-from-account）；② VITE_API_BASE_URL 为站点根（联调如 http://localhost:4001），不要写成 …/api；③ 租户 ID 与数据库一致。',
      };
    }
    return { user: null, error: `请求失败（${res.status}）` };
  }
  const u = data.user;
  if (!u?.id || !u.role) return { user: null, error: '登录响应格式异常' };
  return { user: u };
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

let globalApiError: string | null = null;
const errorListeners = new Set<(err: string | null) => void>();

export function setGlobalApiError(err: string | null) {
  globalApiError = err;
  errorListeners.forEach((l) => l(err));
}

export function subscribeToGlobalApiError(l: (err: string | null) => void) {
  errorListeners.add(l);
  return () => {
    errorListeners.delete(l);
  };
}

export function getGlobalApiError() {
  return globalApiError;
}

async function parseError(res: Response): Promise<string> {
  const t = await res.text();
  try {
    const j = JSON.parse(t) as { message?: string; error?: string };
    const msg = j.message || j.error;
    if (msg) {
      if (res.status === 503) {
        return `后端暂时不可用（503）：${msg}。若使用 Docker 数据库：先启动 Docker Desktop，再在项目根目录执行 npm run dev:stack，然后 backend 终端 npm run dev、根目录 npm run dev:api。`;
      }
      if (res.status >= 500) {
        return `服务异常（${res.status}）：${msg}。请确认 4000 为后端（非 Vite）、PostgreSQL 已启动；可在 backend 执行 npx prisma db push 与 npm run db:seed，或根目录 npm run dev:stack。`;
      }
      if (res.status === 401 || res.status === 403) {
        return `鉴权失败（${res.status}）：${msg}`;
      }
      return msg;
    }
    return t || res.statusText;
  } catch {
    if (res.status === 502 || res.status === 504) {
      return `网关超时或无法连接后端（${res.status}）。请另开终端 cd backend && npm run dev（默认 4000），并确认本机 netstat 中 4000 为 LISTENING；前端保持 npm run dev:api 占 4001。`;
    }
    const raw = (t || '').trim();
    const looksHtml = raw.startsWith('<!') || raw.toLowerCase().includes('<html');
    if (
      res.status === 500 &&
      (looksHtml || !raw || raw === 'Internal Server Error')
    ) {
      return '后端未响应或返回了非 JSON（多为 4000 上没有跑 Express）。请：① 另开终端 cd backend && npm run dev；② 若 Prisma 报连不上库，在项目根目录执行 npm run dev:stack 启动 Docker 里的 Postgres；③ 用 netstat -ano | findstr :4000 确认 4000 在监听（只有 4001 没有 4000 时一定会失败）。';
    }
    return raw || res.statusText;
  }
}

/** 将 fetch 错误与 HTTP 错误统一成可读文案 */
export function intellideskFetchErrorMessage(e: unknown): string {
  if (e instanceof TypeError && (e.message.includes('fetch') || e.message.includes('Failed'))) {
    return '无法连接后端：浏览器显示 Failed to fetch 时，多为后端 4000 未监听或 tsx watch 正在重启（Vite 代理会短暂 ECONNREFUSED）。请在 backend 目录执行 npm run dev，看到「IntelliDesk API http://localhost:4000」后再提交；开发时避免在提交瞬间保存后端文件触发重启。';
  }
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null) return JSON.stringify(e);
  return String(e);
}

/**
 * 设置页「坐席同步」等：顶栏只显示短句，长诊断收进 details，避免整屏琥珀条。
 */
export function splitSeatSyncApiError(detail: string): { summary: string; detail: string } {
  const d = detail.trim();
  if (!d) return { summary: '坐席列表暂时无法更新', detail: '' };
  if (d.includes('无法连接后端') || d.includes('Failed to fetch') || d.includes('ECONNREFUSED')) {
    return {
      summary: '无法连接后端：请先在 backend 目录执行 npm run dev（默认监听 4000），前端使用 npm run dev:api（4001 代理到 4000）。',
      detail: d,
    };
  }
  if (d.includes('非 JSON') || (d.includes('4000') && d.includes('Express'))) {
    return {
      summary: '后端未返回有效接口数据：常见为 4000 未跑 API、或返回了 HTML 错误页；请确认仅后端占 4000、Vite 占 4001。',
      detail: d,
    };
  }
  if (d.includes('网关超时') || d.includes('502') || d.includes('504')) {
    return { summary: '网关超时或暂时连不上后端，请稍后重试或检查 4000 是否在监听。', detail: d };
  }
  if (d.includes('鉴权失败') || d.includes('401') || d.includes('403')) {
    return { summary: '鉴权失败，请重新登录或检查租户/用户请求头。', detail: d };
  }
  if (d.includes('503') || d.includes('暂时不可用')) {
    return { summary: '后端暂时不可用，请确认数据库已启动（如 npm run dev:stack）后再试。', detail: d };
  }
  if (d.includes('服务异常') && d.includes('500')) {
    return { summary: '后端报错，请查看 backend 终端日志并确认 PostgreSQL 可用。', detail: d };
  }
  if (d.length > 120) {
    return { summary: `${d.slice(0, 120)}…`, detail: d };
  }
  return { summary: d, detail: '' };
}

/** AI 专用：短文案，适合顶栏/表单提示（不暴露堆栈） */
export function formatAiUserVisibleError(e: unknown): string {
  const raw = intellideskFetchErrorMessage(e);
  const lower = raw.toLowerCase();
  if (lower.includes('rate_limit') || lower.includes('too many ai') || raw.includes('429')) {
    return 'AI 调用过于频繁，请稍后再试。';
  }
  if (
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504') ||
    lower.includes('网关') ||
    lower.includes('doubao_http') ||
    lower.includes('gemini_')
  ) {
    return 'AI 服务暂时不可用，请稍后重试或检查后端模型配置。';
  }
  if (raw.length > 200) return `${raw.slice(0, 200)}…`;
  return raw;
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
  channelDefaultCurrency?: string | null;
  channelPlatformLanguage?: string | null;
  motherConversationLinked?: boolean;
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
  logisticsPrimaryStatus?: string | null;
  logisticsSecondaryStatus?: string | null;
  logisticsStatusCode?: string | null;
  logisticsSubStatusCode?: string | null;
  isLogisticsException?: boolean;
  logisticsLastSyncedAt?: string | null;
  logisticsIsRegistered?: boolean;
  logisticsEvents?: ApiLogisticsEventRaw[];
  carrier?: string | null;
  hasVatInfo?: boolean;
  eanList?: string[];
  storeEntity?: any;
  createdAt?: string;
  updatedAt?: string;
  /** 订单回源（如 Nezha）原始 JSON，可用于回填收货地址 */
  nezhaRaw?: unknown;
  nezhaSync?: boolean;
};

/** GET /api/tickets 列表项在 mapTicket 之外附带预览与客户/订单摘要 */
export type ApiTicketListItemRaw = ApiTicketRaw & {
  lastInboundPreview?: string | null;
  customer?: ApiCustomerRaw | null;
  order?: ApiOrderRaw | null;
};

export type ApiTicketDetail = ApiTicketRaw & {
  messages: ApiMessageRaw[];
  /** 该工单消息总条数（可能大于本次返回的 messages 长度） */
  messagesTotal?: number;
  /** 本次请求使用的消息条数上限 */
  messagesLimit?: number;
  /** 为 false 时本次未附带 messages（首包瘦身，罕见） */
  includeMessages?: boolean;
  customer: ApiCustomerRaw | null;
  order: ApiOrderRaw | null;
};

export type TicketMessagesPageResponse = {
  messages: ApiMessageRaw[];
  hasMore: boolean;
};

export type TicketsListResponse = {
  limit: number;
  cursor: string | null;
  nextCursor: string | null;
  items: ApiTicketListItemRaw[];
};

/** 从详情消息列表得到最近一条买家可见正文（用于同步 lastInboundPreview） */
export function lastCustomerMessagePreviewFromApi(
  messages: ApiMessageRaw[],
  maxLen = 240
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.senderType === 'customer' && !m.isInternal && m.content?.trim()) {
      const c = m.content.trim();
      return c.length > maxLen ? c.slice(0, maxLen) : c;
    }
  }
  return null;
}

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

export function mapApiTicketToUi(raw: ApiTicketRaw & { lastInboundPreview?: string | null }): Ticket {
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
    lastInboundPreview: raw.lastInboundPreview ?? undefined,
    channelDefaultCurrency: raw.channelDefaultCurrency ?? undefined,
    channelPlatformLanguage: raw.channelPlatformLanguage ?? undefined,
    motherConversationLinked: raw.motherConversationLinked ?? undefined,
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
    logisticsPrimaryStatus: raw.logisticsPrimaryStatus ?? undefined,
    logisticsSecondaryStatus: raw.logisticsSecondaryStatus ?? undefined,
    logisticsStatusCode: raw.logisticsStatusCode ?? undefined,
    logisticsSubStatusCode: raw.logisticsSubStatusCode ?? undefined,
    isLogisticsException: raw.isLogisticsException,
    logisticsLastSyncedAt: raw.logisticsLastSyncedAt,
    logisticsIsRegistered: raw.logisticsIsRegistered,
    logisticsEvents: events.length ? events : undefined,
    carrier: raw.carrier ?? undefined,
    hasVatInfo: raw.hasVatInfo,
    eanList: raw.eanList,
    storeEntity:
      enrichOrderStoreEntityWithNezha({
        storeEntity: raw.storeEntity,
        nezhaRaw: raw.nezhaRaw,
      }) ?? raw.storeEntity,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
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

export type InboxTicketsSyncResult = {
  success: boolean;
  days: number;
  /** 是否使用收件箱水位做增量起点（false 表示整窗重拉） */
  incremental?: boolean;
  /** 收件箱刷新时同步的订单条数（与工单关联依赖此项） */
  ordersSynced: number;
  conversationsSynced: number;
  messagesSynced: number;
  aiUpdated: number;
  aiFailed: number;
  aiSkippedNoLlm: number;
};

/** 收件箱：母系统会话+消息刷新，可选批量 AI 意图/情绪 */
export async function postInboxTicketsSync(
  tenantId: string,
  userId: string | undefined,
  body: { token?: string; days?: number; incremental?: boolean; runAi?: boolean; aiMax?: number }
): Promise<InboxTicketsSyncResult> {
  const payload: Record<string, unknown> = {
    days: body.days ?? 90,
    incremental: body.incremental !== false,
    runAi: body.runAi !== false,
    aiMax: body.aiMax ?? 30,
  };
  const t = body.token?.trim();
  if (t) payload.token = t;
  const res = await fetch(`${base()}/api/sync/inbox-tickets`, {
    method: 'POST',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<InboxTicketsSyncResult>;
}

export type SyncOrderByPlatformIdResult =
  | { success: true; platformOrderId: string }
  | { success: false; ok: false; reason?: string };

/** 按平台订单号从母系统回源并 upsert 本地订单 */
export async function postSyncOrderByPlatformId(
  tenantId: string,
  userId: string | undefined,
  body: { token?: string; platformOrderId: string }
): Promise<SyncOrderByPlatformIdResult> {
  const payload: Record<string, unknown> = { platformOrderId: body.platformOrderId.trim() };
  const t = body.token?.trim();
  if (t) payload.token = t;
  const res = await fetch(`${base()}/api/sync/order-by-platform-id`, {
    method: 'POST',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<SyncOrderByPlatformIdResult>;
}

export async function fetchTicketDetail(
  tenantId: string,
  userId: string | undefined,
  ticketId: string,
  opts?: { messagesLimit?: number; includeMessages?: boolean }
): Promise<ApiTicketDetail> {
  const path = `tickets/${encodeURIComponent(ticketId)}`;
  const resolved = resolveApiUrl(path);
  if (!resolved) {
    throw new Error('未配置 VITE_API_BASE_URL，无法拉取工单详情');
  }
  const u = new URL(resolved);
  if (opts?.messagesLimit != null && opts.messagesLimit > 0) {
    u.searchParams.set('messagesLimit', String(opts.messagesLimit));
  }
  if (opts?.includeMessages === false) {
    u.searchParams.set('includeMessages', '0');
  }
  const res = await fetch(u.toString(), {
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiTicketDetail>;
}

/** 分页加载早于当前列表的消息（before 为当前最早一条的 createdAt ISO） */
export async function fetchTicketMessagesPage(
  tenantId: string,
  userId: string | undefined,
  ticketId: string,
  opts?: { before?: string; limit?: number }
): Promise<TicketMessagesPageResponse> {
  const resolved = resolveApiUrl(`tickets/${encodeURIComponent(ticketId)}/messages`);
  if (!resolved) throw new Error('未配置 VITE_API_BASE_URL');
  const u = new URL(resolved);
  if (opts?.before) u.searchParams.set('before', opts.before);
  if (opts?.limit != null && opts.limit > 0) {
    u.searchParams.set('limit', String(opts.limit));
  }
  const res = await fetch(u.toString(), {
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<TicketMessagesPageResponse>;
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
  deliveryTargets?: ('customer' | 'manager' | 'agent')[];
  token?: string;
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

export async function patchTicketMessage(
  tenantId: string,
  userId: string | undefined,
  ticketId: string,
  messageId: string,
  body: { content: string }
): Promise<ApiMessageRaw> {
  const res = await fetch(`${base()}/api/tickets/${ticketId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiMessageRaw>;
}

export async function deleteTicketMessage(
  tenantId: string,
  userId: string | undefined,
  ticketId: string,
  messageId: string
): Promise<void> {
  const res = await fetch(`${base()}/api/tickets/${ticketId}/messages/${messageId}`, {
    method: 'DELETE',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
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
  orderId: string,
  opts?: { upstreamEnrich?: boolean }
): Promise<ApiOrderRaw> {
  const u = new URL(`${base()}/api/orders/${encodeURIComponent(orderId)}`);
  if (opts?.upstreamEnrich) u.searchParams.set('upstreamEnrich', '1');
  const res = await fetch(u.toString(), {
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiOrderRaw>;
}

export async function fetchOrderByPlatformOrderId(
  tenantId: string,
  userId: string | undefined,
  platformOrderId: string,
  opts?: { upstreamEnrich?: boolean }
): Promise<ApiOrderRaw> {
  const u = new URL(`${base()}/api/orders`);
  u.searchParams.set('platformOrderId', platformOrderId.trim());
  if (opts?.upstreamEnrich !== false) u.searchParams.set('upstreamEnrich', '1');
  const res = await fetch(u.toString(), { headers: await intellideskHeadersWithAuth(tenantId, userId) });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiOrderRaw>;
}

export async function postOrderLogisticsSync(
  tenantId: string,
  userId: string | undefined,
  orderId: string,
  force = false
): Promise<{ ok: boolean; message?: string }> {
  const u = new URL(`${base()}/api/orders/${orderId}/logistics/sync`);
  if (force) u.searchParams.set('force', '1');
  const res = await fetch(u.toString(), {
    method: 'POST',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ ok: boolean; message?: string }>;
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

/** 工作台 AI 洞察用：售后分布、工单工作流、SLA 临近、在途退款金额 */
export type DashboardAiContext = {
  generatedAt: string;
  afterSalesByStatusZh: Record<string, number>;
  afterSalesByTypeZh: Record<string, number>;
  ticketsByWorkflowStatusZh: Record<string, number>;
  slaDueWithin24hCount: number;
  openRefundAmountSum: string | null;
};

export async function fetchDashboardAiContext(
  tenantId: string,
  userId: string | undefined
): Promise<DashboardAiContext> {
  const res = await fetch(`${base()}/api/dashboard/ai-context`, {
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<DashboardAiContext>;
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
  channelShopLabel?: string;
  channelPlatformType?: string | null;
  orderPlatformOrderId?: string;
  orderAmount?: number;
  orderCurrency?: string;
  orderProductTitles?: string[];
  orderChannelShopLabel?: string;
  orderChannelPlatformType?: string | null;
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
    channelShopLabel: raw.channelShopLabel,
    channelPlatformType: raw.channelPlatformType,
    orderPlatformOrderId: raw.orderPlatformOrderId,
    orderAmount: raw.orderAmount,
    orderCurrency: raw.orderCurrency,
    orderProductTitles: raw.orderProductTitles,
    orderChannelShopLabel: raw.orderChannelShopLabel,
    orderChannelPlatformType: raw.orderChannelPlatformType,
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
  refundExecutionType?: 'manual' | 'api';
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

export async function deleteAfterSalesRecord(
  tenantId: string,
  userId: string | undefined,
  id: string
): Promise<void> {
  const res = await fetch(`${base()}/api/after-sales/${id}`, {
    method: 'DELETE',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function postAiSummarize(
  tenantId: string,
  userId: string | undefined,
  ticketId: string
): Promise<{ summary: string }> {
  const res = await fetch(`${base()}/api/ai/summarize`, {
    method: 'POST',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify({ ticketId }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ summary: string }>;
}

export async function postAiSuggestReply(
  tenantId: string,
  userId: string | undefined,
  ticketId: string
): Promise<{ suggestion: string; platformSuggestion?: string }> {
  const res = await fetch(`${base()}/api/ai/suggest-reply`, {
    method: 'POST',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify({ ticketId }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ suggestion: string; platformSuggestion?: string }>;
}

export async function postAiPolish(
  tenantId: string,
  userId: string | undefined,
  ticketId: string,
  draftText: string
): Promise<{ polished: string }> {
  const res = await fetch(`${base()}/api/ai/polish`, {
    method: 'POST',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify({ ticketId, draftText }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ polished: string }>;
}

export async function postAiRecognizeAfterSales(
  tenantId: string,
  userId: string | undefined,
  body: { buyerFeedback?: string; ticketId?: string; maxRefund?: number; currency?: string }
): Promise<{ result: Record<string, unknown> }> {
  const res = await fetch(`${base()}/api/ai/recognize-after-sales`, {
    method: 'POST',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ result: Record<string, unknown> }>;
}

export async function postAiSummarizeMessages(
  tenantId: string,
  userId: string | undefined,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
): Promise<{ summary: string }> {
  const res = await fetch(`${base()}/api/ai/summarize-messages`, {
    method: 'POST',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ summary: string }>;
}

export async function postAiTranslate(
  tenantId: string,
  userId: string | undefined,
  body: { text: string; targetLang: string; sourceLang?: string }
): Promise<{ translated: string }> {
  const res = await fetch(`${base()}/api/ai/translate`, {
    method: 'POST',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ translated: string }>;
}

export async function postAiBatchTranslate(
  tenantId: string,
  userId: string | undefined,
  body: { messages: { id: string; content: string }[]; targetLang: string }
): Promise<{ results: Record<string, string> }> {
  const res = await fetch(`${base()}/api/ai/batch-translate`, {
    method: 'POST',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ results: Record<string, string> }>;
}

export async function postAiClassifyIntent(
  tenantId: string,
  userId: string | undefined,
  ticketId: string
): Promise<{ intent: string }> {
  const res = await fetch(`${base()}/api/ai/classify-intent`, {
    method: 'POST',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify({ ticketId }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ intent: string }>;
}

export async function postAiClassifySentiment(
  tenantId: string,
  userId: string | undefined,
  ticketId: string
): Promise<{ sentiment: string }> {
  const res = await fetch(`${base()}/api/ai/classify-sentiment`, {
    method: 'POST',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify({ ticketId }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ sentiment: string }>;
}

export async function postAiTicketInsight(
  tenantId: string,
  userId: string | undefined,
  ticketId: string
): Promise<{ summary: string; intent: string; sentiment: string }> {
  const res = await fetch(`${base()}/api/ai/ticket-insight`, {
    method: 'POST',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify({ ticketId }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ summary: string; intent: string; sentiment: string }>;
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
  conditionsJson?: unknown | null;
  replyContent: string | null;
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
  conditionsJson?: unknown;
  replyContent?: string | null;
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
  conditionsJson: unknown;
  replyContent: string | null;
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
  createdAt?: string;
};

export type ApiRoutingRuleOptions = {
  platforms: { value: string; label: string }[];
  channels: { id: string; displayName: string; platformType: string | null }[];
  afterSalesTypes: { value: string; label: string }[];
};

export async function fetchRoutingRuleOptions(
  tenantId: string,
  userId: string | undefined
): Promise<ApiRoutingRuleOptions> {
  const res = await fetch(`${base()}/api/settings/routing-rule-options`, {
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiRoutingRuleOptions>;
}

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

// --- 母系统正式同步设置 ---

export type BackfillMode = 'full' | 'from_date' | 'recent_days';

export type ApiTenantSyncSettings = {
  id: string;
  tenantId: string;
  syncEnabled: boolean;
  messagePollIntervalSec: number;
  orderPollIntervalSec: number;
  incrementalSyncDays: number;
  useSyncWatermark: boolean;
  messageSyncDisabledPlatformTypes: string[];
  defaultNewShopOrderBackfillMode: string;
  defaultNewShopOrderBackfillFrom: string | null;
  defaultNewShopOrderBackfillRecentDays: number;
  defaultNewShopTicketBackfillMode: string;
  defaultNewShopTicketBackfillFrom: string | null;
  defaultNewShopTicketBackfillRecentDays: number;
  skipMockTickets: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiChannelSyncRow = {
  id: string;
  displayName: string;
  platformType: string | null;
  externalShopId: string | null;
  syncMessagesEnabled: boolean;
  syncOrdersEnabled: boolean;
  orderBackfillMode: string | null;
  orderBackfillFrom: string | null;
  orderBackfillRecentDays: number | null;
  ticketBackfillMode: string | null;
  ticketBackfillFrom: string | null;
  ticketBackfillRecentDays: number | null;
  initialBackfillCompletedAt: string | null;
};

export type ApiMotherSyncBundle = {
  settings: ApiTenantSyncSettings;
  channels: ApiChannelSyncRow[];
};

export async function fetchMotherSyncBundle(
  tenantId: string,
  userId: string | undefined
): Promise<ApiMotherSyncBundle> {
  const res = await fetch(`${base()}/api/settings/mother-sync`, {
    headers: await intellideskHeadersWithAuth(tenantId, userId),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiMotherSyncBundle>;
}

export type PatchMotherSyncSettingsBody = Partial<{
  syncEnabled: boolean;
  messagePollIntervalSec: number;
  orderPollIntervalSec: number;
  incrementalSyncDays: number;
  useSyncWatermark: boolean;
  messageSyncDisabledPlatformTypes: string[];
  defaultNewShopOrderBackfillMode: BackfillMode;
  defaultNewShopOrderBackfillFrom: string | null;
  defaultNewShopOrderBackfillRecentDays: number;
  defaultNewShopTicketBackfillMode: BackfillMode;
  defaultNewShopTicketBackfillFrom: string | null;
  defaultNewShopTicketBackfillRecentDays: number;
  skipMockTickets: boolean;
}>;

export async function patchMotherSyncSettings(
  tenantId: string,
  userId: string | undefined,
  body: PatchMotherSyncSettingsBody
): Promise<ApiMotherSyncBundle> {
  const res = await fetch(`${base()}/api/settings/mother-sync`, {
    method: 'PATCH',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiMotherSyncBundle>;
}

export type PatchChannelMotherSyncBody = Partial<{
  syncMessagesEnabled: boolean;
  syncOrdersEnabled: boolean;
  orderBackfillMode: BackfillMode | null;
  orderBackfillFrom: string | null;
  orderBackfillRecentDays: number | null;
  ticketBackfillMode: BackfillMode | null;
  ticketBackfillFrom: string | null;
  ticketBackfillRecentDays: number | null;
  initialBackfillCompletedAt: string | null;
}>;

export async function patchChannelMotherSync(
  tenantId: string,
  userId: string | undefined,
  channelId: string,
  body: PatchChannelMotherSyncBody
): Promise<ApiChannelSyncRow> {
  const res = await fetch(`${base()}/api/settings/channels/${channelId}/mother-sync`, {
    method: 'PATCH',
    headers: await intellideskHeadersWithAuth(tenantId, userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ApiChannelSyncRow>;
}
