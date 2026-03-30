/**
 * 母系统（哪吒 / evol OpenAPI）请求与 DTO 映射（参考实现）。
 *
 * 前端收件箱已恢复为纯演示 Mock；待自建后端按 PRD 提供 /api/tickets 等接口后，
 * 由后端聚合母系统数据，前端只请求同源 API，勿在浏览器直连母系统 Token。
 */
import type { Customer, Message, Ticket } from '@/src/types';
import { Sentiment, TicketStatus } from '@/src/types';

const DEFAULT_REMOTE_BASE = 'https://tiaojia.nezhachuhai.com';

export function getNezhaApiBase(): string {
  const fromEnv = import.meta.env.VITE_NEZHA_API_BASE?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return DEFAULT_REMOTE_BASE;
}

export function getNezhaApiToken(): string | undefined {
  const t = import.meta.env.VITE_NEZHA_API_TOKEN?.trim();
  return t || undefined;
}

export function isNezhaInboxConfigured(): boolean {
  return Boolean(getNezhaApiToken());
}

interface NezhaEnvelope<T> {
  code: number;
  msg: string;
  data: T;
}

export interface NezhaFeedbackItem {
  id: number;
  createAt: string;
  typeId?: number | null;
  typeName?: string | null;
  content: string;
  images?: string[];
  concat?: string | null;
  state: string;
  handleResult?: string | null;
  beginAt?: string | null;
  finishAt?: string | null;
}

interface NezhaFeedbackPage {
  page: number;
  limit: number;
  size: number;
  totalSize: number;
  list: NezhaFeedbackItem[];
  lastPage: boolean;
  totalPages: number;
}

export interface NezhaPlatformSite {
  id: number;
  name: string;
  aliasName?: string;
  platformTypeName?: string;
}

export interface NezhaAuthShopTiny {
  id: number;
  platformSiteId: number;
  name: string;
}

/** 收件箱树状分组用：与 mapFeedbackToTicket 的 channelId 一致 */
export const NEZHA_FEEDBACK_CHANNEL_LABEL = '母系统 问题反馈';

function parseNezhaDate(s: string): string {
  if (!s) return new Date().toISOString();
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function subjectFromFeedback(content: string): { subject: string; subjectOriginal?: string } {
  const raw = content?.trim() || '（无内容）';
  const first = raw.split(/&&|\r?\n/).map((x) => x.trim()).filter(Boolean)[0] || raw;
  const clipped = first.length > 120 ? `${first.slice(0, 117)}…` : first;
  return { subject: clipped, subjectOriginal: clipped };
}

function slaDueFrom(createdIso: string): string {
  const t = new Date(createdIso).getTime() + 48 * 60 * 60 * 1000;
  return new Date(t).toISOString();
}

/** 将反馈记录映射为 IntelliDesk 工单（渠道列用于树状分组：首词为平台、整串为店铺） */
export function mapFeedbackToTicket(
  row: NezhaFeedbackItem,
  channelLabel: string
): Ticket {
  const { subject, subjectOriginal } = subjectFromFeedback(row.content);
  const createdAt = parseNezhaDate(row.createAt);
  const isComplete = row.state === 'COMPLETE';
  const inProcess = row.state === 'IN_PROCESS';
  const status = isComplete
    ? TicketStatus.RESOLVED
    : inProcess
      ? TicketStatus.WAITING
      : TicketStatus.TODO;
  const updatedAt = row.finishAt
    ? parseNezhaDate(row.finishAt)
    : row.beginAt
      ? parseNezhaDate(row.beginAt)
      : parseNezhaDate(row.createAt);
  return {
    id: `FB-${row.id}`,
    channelId: channelLabel,
    customerId: `C-FB-${row.id}`,
    orderId: undefined,
    status,
    priority: isComplete ? 4 : inProcess ? 3 : 2,
    sentiment: Sentiment.NEUTRAL,
    intent: row.typeName?.trim() || '问题反馈',
    messageProcessingStatus: isComplete ? 'replied' : 'unreplied',
    subject,
    subjectOriginal,
    createdAt,
    updatedAt,
    slaDueAt: slaDueFrom(createdAt),
    isImportant: row.state === 'WAIT' || row.state === 'IN_PROCESS',
    isFavorite: false,
    isShared: false,
    tags: row.typeName ? [row.typeName] : [],
  };
}

export function mapFeedbackToCustomer(row: NezhaFeedbackItem): Customer {
  const id = `C-FB-${row.id}`;
  const nameFromConcat = row.concat?.trim() || '反馈用户';
  return {
    id,
    name: nameFromConcat,
    email: '',
    shippingCountry: '—',
    sentiment: Sentiment.NEUTRAL,
    segments: [],
    totalOrderValue: 0,
    ordersCount: 0,
    latestPurchaseAt: parseNezhaDate(row.createAt),
    customerSince: parseNezhaDate(row.createAt),
  };
}

/** 将反馈正文拆成多条用户消息（母系统常用 && 拼接多段）；客服处理结果单独一条 */
export function mapFeedbackToMessages(row: NezhaFeedbackItem): Message[] {
  const tid = `FB-${row.id}`;
  const baseMs = new Date(parseNezhaDate(row.createAt)).getTime();
  const raw = row.content?.trim() || '';
  const parts = raw
    .split('&&')
    .map((s) => s.trim())
    .filter(Boolean);
  const segments = parts.length > 0 ? parts : [raw || '（无内容）'];

  const list: Message[] = segments.map((text, i) => ({
    id: `M-FB-${row.id}-u${i + 1}`,
    ticketId: tid,
    senderId: row.concat?.trim() || '用户',
    senderType: 'customer' as const,
    content: text,
    createdAt: new Date(baseMs + i * 60_000).toISOString(),
    attachments: i === 0 && row.images?.length ? row.images : undefined,
  }));

  if (row.beginAt?.trim()) {
    list.push({
      id: `M-FB-${row.id}-sys`,
      ticketId: tid,
      senderId: '系统',
      senderType: 'system',
      content: '客服已开始处理此反馈',
      createdAt: parseNezhaDate(row.beginAt),
    });
  }

  if (row.handleResult?.trim()) {
    list.push({
      id: `M-FB-${row.id}-agent`,
      ticketId: tid,
      senderId: '客服',
      senderType: 'agent',
      content: row.handleResult.trim(),
      createdAt: row.finishAt
        ? parseNezhaDate(row.finishAt)
        : row.beginAt
          ? parseNezhaDate(row.beginAt)
          : new Date(baseMs + segments.length * 60_000).toISOString(),
    });
  }

  list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return list;
}

async function nezhaFetch<T>(path: string, token: string): Promise<T> {
  const base = getNezhaApiBase();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const body = (await res.json()) as NezhaEnvelope<T>;
  if (body.code !== 0) {
    throw new Error(body.msg || `业务错误 code=${body.code}`);
  }
  return body.data;
}

export async function fetchNezhaFeedbackPage(
  token: string,
  page: number,
  limit: number,
  filters?: { id?: number }
): Promise<NezhaFeedbackPage> {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filters?.id != null) q.set('id', String(filters.id));
  return nezhaFetch<NezhaFeedbackPage>(`/v1/api/biz/feedback?${q}`, token);
}

/** 按反馈单 ID 拉取最新详情（含 handleResult 等），用于详情页刷新真实客服回复 */
export async function fetchNezhaFeedbackById(
  token: string,
  numericId: number
): Promise<NezhaFeedbackItem | null> {
  const data = await fetchNezhaFeedbackPage(token, 1, 5, { id: numericId });
  const row = data.list?.find((r) => r.id === numericId) ?? data.list?.[0];
  return row ?? null;
}

export async function fetchAllNezhaFeedback(
  token: string,
  maxPages = 30
): Promise<NezhaFeedbackItem[]> {
  const all: NezhaFeedbackItem[] = [];
  let page = 1;
  const limit = 100;
  for (let i = 0; i < maxPages; i++) {
    const data = await fetchNezhaFeedbackPage(token, page, limit);
    all.push(...(data.list || []));
    if (data.lastPage || !data.list?.length) break;
    page += 1;
  }
  return all;
}

export async function fetchNezhaPlatformSites(token: string): Promise<NezhaPlatformSite[]> {
  return nezhaFetch<NezhaPlatformSite[]>('/v1/api/biz/platform-site/all', token);
}

export async function fetchNezhaAuthShopsTiny(token: string): Promise<NezhaAuthShopTiny[]> {
  return nezhaFetch<NezhaAuthShopTiny[]>('/v1/api/ecommerce/auth-platform-shop/tiny/all', token);
}

export interface NezhaInboxBundle {
  tickets: Ticket[];
  messagesByTicket: Record<string, Message[]>;
  customers: Record<string, Customer>;
  platformSites: NezhaPlatformSite[];
  authShops: NezhaAuthShopTiny[];
}

/**
 * 并行拉取：问题反馈 + 平台站点 + 授权店铺；会话内容由反馈正文与处理结果构成（OpenAPI 无独立买家会话列表）。
 */
export async function loadNezhaInboxBundle(token: string): Promise<NezhaInboxBundle> {
  const [rows, platformSites, authShops] = await Promise.all([
    fetchAllNezhaFeedback(token),
    fetchNezhaPlatformSites(token).catch(() => [] as NezhaPlatformSite[]),
    fetchNezhaAuthShopsTiny(token).catch(() => [] as NezhaAuthShopTiny[]),
  ]);

  const channelLabel = NEZHA_FEEDBACK_CHANNEL_LABEL;

  const tickets: Ticket[] = [];
  const messagesByTicket: Record<string, Message[]> = {};
  const customers: Record<string, Customer> = {};

  for (const row of rows) {
    const ticket = mapFeedbackToTicket(row, channelLabel);
    tickets.push(ticket);
    messagesByTicket[ticket.id] = mapFeedbackToMessages(row);
    customers[ticket.customerId] = mapFeedbackToCustomer(row);
  }

  tickets.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return { tickets, messagesByTicket, customers, platformSites, authShops };
}
