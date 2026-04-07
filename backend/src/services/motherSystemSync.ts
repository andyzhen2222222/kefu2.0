import type { TicketStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { shippingAddressLineFromObject } from '../lib/shippingAddressText.js';
import { normalizeClassifiedIntent, normalizeClassifiedSentiment } from '../lib/ticketIntentLabels.js';
import {
  buildInvoiceStoreEntityJson,
  buildShopIndexFromRows,
  matchVatRowForChannel,
  type InvoiceEntitySyncResult,
} from '../lib/invoiceEntityMother.js';
import { computeAssignedSeatForChannelId } from '../lib/ticketRoutingAssign.js';
import { computeSlaDueAtForTicket } from '../lib/slaCompute.js';
import {
  getScopedSyncStartDate,
  touchScopedSyncWatermark,
  INBOX_REFRESH_SCOPE,
  ORDER_INCREMENTAL_SCOPE,
} from '../lib/syncWatermark.js';
import { ensureTenantSyncSettings, syncMessagesEnabledForPlatform } from '../lib/tenantSyncSettings.js';
import {
  NEZHA_PLATFORM_CONVERSATION_API,
  NEZHA_PLATFORM_CONVERSATION_MESSAGE_API,
  nezhaPlatformConversationDetailPath,
  nezhaPlatformConversationReplyPath,
} from '../lib/nezhaEcommercePaths.js';

// 母系统 API 基础 URL（与 NEZHA_API_BASE 对齐，避免只配一处时同步指向默认域名）
const MOTHER_SYSTEM_API_URL =
  process.env.MOTHER_SYSTEM_API_URL?.replace(/\/$/, '') ||
  process.env.NEZHA_API_BASE?.replace(/\/$/, '') ||
  'https://tiaojia.nezhachuhai.com';

/** 订单/会话/消息拉取与收件箱刷新：默认回溯天数上限（与 sync 路由一致） */
/** 母系统单次同步时间窗口上限（天），与会话「最近更新时间」、订单 startTime 等一致 */
export const MOTHER_SYNC_MAX_DAYS = 90;

const MOTHER_FETCH_TIMEOUT_MS = Math.max(
  5_000,
  Math.min(600_000, parseInt(process.env.MOTHER_FETCH_TIMEOUT_MS || '120000', 10) || 120_000)
);

/**
 * 通用 Fetch 请求封装（带超时，错误信息含路径便于排查「fetch failed」）
 */
async function fetchMotherSystem(path: string, token: string, params?: Record<string, any>) {
  const url = new URL(`${MOTHER_SYSTEM_API_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.append(k, String(v));
    });
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: {
        Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(MOTHER_FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    const hint = e instanceof Error ? e.message : String(e);
    throw new Error(`Mother fetch failed ${path} (${MOTHER_FETCH_TIMEOUT_MS}ms): ${hint}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Mother system API error: ${res.status} ${res.statusText} ${path} ${text.slice(0, 200)}`);
  }

  return res.json();
}

/**
 * 同步母系统的店铺/渠道 (AuthPlatformShop)
 */
export async function syncChannelsFromMotherSystem(tenantId: string, token: string) {
  const syncSettings = await ensureTenantSyncSettings(tenantId);
  let page = 1;
  const limit = 100;
  let hasMore = true;
  let totalSynced = 0;

  while (hasMore) {
    const res = await fetchMotherSystem('/v1/api/ecommerce/auth-platform-shop', token, { page, limit });
    const list = res.data?.list || [];
    
    if (list.length === 0) {
      hasMore = false;
      break;
    }

    // 遍历保存到本地 Channel 表（母系统 shop.currency 多为嵌套 currencyCode）
    for (const shop of list) {
      const externalShopId = String(shop.id);
      const defaultCurrency = pickCurrencyCodeFromMotherPayload(shop);

      const existing = await prisma.channel.findFirst({
        where: { tenantId, externalShopId }
      });

      if (existing) {
        await prisma.channel.update({
          where: { id: existing.id },
          data: {
            displayName: shop.name || `Shop-${shop.id}`,
            platformType: shop.platformApiType,
            ...(defaultCurrency ? { defaultCurrency } : {}),
          }
        });
      } else {
        const platformType = shop.platformApiType != null ? String(shop.platformApiType) : null;
        const syncMessagesEnabled = syncMessagesEnabledForPlatform(syncSettings, platformType);
        await prisma.channel.create({
          data: {
            tenantId,
            externalShopId,
            displayName: shop.name || `Shop-${shop.id}`,
            platformType: shop.platformApiType,
            region: null,
            defaultSlaHours: 24,
            syncMessagesEnabled,
            syncOrdersEnabled: true,
            orderBackfillMode: syncSettings.defaultNewShopOrderBackfillMode,
            orderBackfillFrom: syncSettings.defaultNewShopOrderBackfillFrom,
            orderBackfillRecentDays: syncSettings.defaultNewShopOrderBackfillRecentDays,
            ticketBackfillMode: syncSettings.defaultNewShopTicketBackfillMode,
            ticketBackfillFrom: syncSettings.defaultNewShopTicketBackfillFrom,
            ticketBackfillRecentDays: syncSettings.defaultNewShopTicketBackfillRecentDays,
            ...(defaultCurrency ? { defaultCurrency } : {}),
          }
        });
      }
      totalSynced++;
    }

    if (list.length < limit) {
      hasMore = false;
    } else {
      page++;
    }
  }

  console.log(`[syncChannels] Synced ${totalSynced} channels for tenant ${tenantId}.`);
  const siteRows = await syncPlatformSitesFromMotherSystem(tenantId, token);
  console.log(`[syncChannels] Platform sites updated for ${siteRows} channels.`);
  return totalSynced;
}

function pickStringField(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** 母系统常见：currency 为 { currencyCode: "EUR" }，订单上也可能缺顶层 currency */
function pickCurrencyCodeFromMotherPayload(row: unknown): string | null {
  if (!row || typeof row !== 'object') return null;
  const s = row as Record<string, unknown>;
  const flat = pickStringField(s, [
    'currencyCode',
    'orderCurrency',
    'platformCurrency',
    'isoCurrencyCode',
    'siteCurrency',
    'totalPriceCurrency',
  ]);
  if (flat && /^[A-Za-z]{3}$/.test(flat)) return flat.toUpperCase();
  const nested = s.currency;
  if (nested && typeof nested === 'object') {
    const code = pickStringField(nested as Record<string, unknown>, ['currencyCode', 'code', 'isoCode']);
    if (code && /^[A-Za-z]{3}$/.test(code)) return code.toUpperCase();
  }
  if (typeof s.currency === 'string' && /^[A-Za-z]{3}$/.test(s.currency.trim())) {
    return s.currency.trim().toUpperCase();
  }
  return flat ? flat.toUpperCase() : null;
}

function getOrderLineItems(order: Record<string, unknown>): unknown[] {
  const candidates = [
    order.items,
    order.orderItems,
    order.lineItems,
    order.itemList,
    order.products,
    order.orderItemList,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function pickOrderAmount(order: Record<string, unknown>): number {
  const n = (v: unknown) => {
    const x = typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  const tp = order.totalPrice;
  if (tp != null && typeof tp === 'object') {
    const o = tp as Record<string, unknown>;
    const v = o.value ?? o.amount ?? o.price;
    if (v != null) return n(v);
  }
  if (tp != null) return n(tp);
  for (const k of ['totalAmount', 'payAmount', 'orderAmount', 'price', 'paidAmount']) {
    const v = order[k];
    if (v != null) return n(v);
  }
  return 0;
}

function lineItemSku(item: Record<string, unknown>): string {
  const product = item.product;
  const p = product && typeof product === 'object' ? (product as Record<string, unknown>) : null;
  return String(
    p?.platformSku ?? item.platformSku ?? item.sku ?? item.sellerSku ?? item.merchantSku ?? ''
  ).trim();
}

function lineItemTitle(item: Record<string, unknown>): string {
  const product = item.product;
  const p = product && typeof product === 'object' ? (product as Record<string, unknown>) : null;
  const t = String(
    p?.title ?? item.title ?? item.productName ?? item.name ?? item.productTitle ?? ''
  ).trim();
  return t || 'Product';
}

function orderRowNeedsDetailFetch(order: Record<string, unknown>): boolean {
  const items = getOrderLineItems(order);
  if (items.length === 0) return true;
  if (pickOrderAmount(order) <= 0) return true;
  const skus = items.map((i) => lineItemSku(i as Record<string, unknown>)).filter(Boolean);
  return skus.length === 0;
}

/** 列表接口字段少时，用单笔订单接口补全（见 scripts/probe-order-detail.mjs） */
async function tryFetchMotherPlatformOrderDetail(
  token: string,
  listRow: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const candidates = [
    listRow.id,
    listRow.orderId,
    listRow.ordersId,
    listRow.originalOrderId,
    listRow.platformOrderId,
  ]
    .filter((x) => x != null && String(x).trim() !== '')
    .map((x) => String(x).trim());
  const seen = new Set<string>();
  for (const oid of candidates) {
    if (seen.has(oid)) continue;
    seen.add(oid);
    try {
      const res = await fetchMotherSystem(
        `/v1/api/ecommerce/platform-order/${encodeURIComponent(oid)}`,
        token,
        {}
      );
      const d = res?.data ?? res;
      if (d && typeof d === 'object' && !Array.isArray(d)) {
        const dr = d as Record<string, unknown>;
        if (getOrderLineItems(dr).length > 0 || pickOrderAmount(dr) > 0) {
          return { ...listRow, ...dr };
        }
      }
    } catch {
      /* try next id */
    }
  }
  return null;
}

/** 母系统 /v1/api/biz/platform-site/all → Channel.defaultCurrency / platformLanguage */
export async function syncPlatformSitesFromMotherSystem(tenantId: string, token: string): Promise<number> {
  let updated = 0;
  try {
    const res = await fetchMotherSystem('/v1/api/biz/platform-site/all', token, {});
    const d = res.data;
    const list: unknown[] = Array.isArray(d)
      ? d
      : Array.isArray(d?.list)
        ? d.list
        : Array.isArray(d?.records)
          ? d.records
          : [];

    for (const row of list) {
      if (!row || typeof row !== 'object') continue;
      const s = row as Record<string, unknown>;
      const shopKey =
        pickStringField(s, [
          'platformShopId',
          'authPlatformShopId',
          'shopId',
          'authShopId',
          'platformShop',
        ]) ??
        (typeof s.platformShop === 'object' && s.platformShop
          ? pickStringField(s.platformShop as Record<string, unknown>, ['id'])
          : null) ??
        pickStringField(s, ['id']);

      if (!shopKey) continue;

      const currency = pickCurrencyCodeFromMotherPayload(s);
      const language = pickStringField(s, [
        'languageCode',
        'language',
        'locale',
        'platformLanguage',
        'lang',
        'defaultLanguage',
        'siteLanguage',
      ]);

      const externalShopId = shopKey.trim();
      const ch = await prisma.channel.findFirst({
        where: { tenantId, externalShopId },
      });
      if (!ch) continue;

      const data: { defaultCurrency?: string | null; platformLanguage?: string | null } = {};
      if (currency) data.defaultCurrency = currency;
      if (language) data.platformLanguage = language;
      if (Object.keys(data).length === 0) continue;

      await prisma.channel.update({
        where: { id: ch.id },
        data,
      });
      updated++;
    }
  } catch (e) {
    console.warn('[syncPlatformSites] skipped:', e instanceof Error ? e.message : e);
  }
  return updated;
}

function automationRowMatchesShopId(row: Record<string, unknown>, shopId: string): boolean {
  for (const k of ['id', 'platformShopId', 'authPlatformShopId', 'shopId', 'authShopId']) {
    const v = pickStringField(row, [k]);
    if (v === shopId) return true;
  }
  return false;
}

/** 全量列表对不上 Channel.externalShopId 时，按店铺维度再请求 automation 列表 */
async function fetchAutomationShopById(token: string, shopId: string): Promise<Record<string, unknown> | null> {
  const keys = ['platformShopId', 'authPlatformShopId', 'shopId', 'id'];
  for (const k of keys) {
    try {
      const res = await fetchMotherSystem('/v1/api/ecommerce/auth-platform-shop', token, {
        page: 1,
        limit: 50,
        [k]: shopId,
      });
      const raw = res.data?.list ?? res.data;
      const list = Array.isArray(raw) ? raw : [];
      for (const row of list) {
        if (row && typeof row === 'object') {
          const r = row as Record<string, unknown>;
          if (automationRowMatchesShopId(r, shopId)) return r;
        }
      }
    } catch {
      /* try next param */
    }
  }
  return null;
}

/** VAT 全量页未匹配时，带店铺过滤再拉一页 */
async function fetchVatPageFiltered(token: string, shopId: string): Promise<Record<string, unknown>[]> {
  const keys = ['platformShopId', 'authPlatformShopId', 'shopId', 'id'];
  for (const k of keys) {
    try {
      const res = await fetchMotherSystem('/v1/api/ecommerce/vat-info/page', token, {
        page: 1,
        limit: 100,
        [k]: shopId,
      });
      const raw = res.data?.list ?? res.data?.records ?? res.data;
      const list = Array.isArray(raw) ? raw : [];
      const out: Record<string, unknown>[] = [];
      for (const row of list) {
        if (row && typeof row === 'object') out.push(row as Record<string, unknown>);
      }
      if (out.length) return out;
    } catch {
      /* try next param */
    }
  }
  return [];
}

/**
 * 发票：automation 店铺主体 + VAT 分页 → Channel.invoiceStoreEntity
 * - /v1/automation/ecommerce/auth-platform-shop
 * - /v1/api/ecommerce/vat-info/page
 */
export async function syncInvoiceEntitiesFromMotherSystem(
  tenantId: string,
  token: string
): Promise<InvoiceEntitySyncResult> {
  const shopRows: Record<string, unknown>[] = [];
  let page = 1;
  const limit = 100;
  while (true) {
    try {
      const res = await fetchMotherSystem('/v1/api/ecommerce/auth-platform-shop', token, {
        page,
        limit,
      });
      const raw = res.data?.list ?? res.data;
      const list = Array.isArray(raw) ? raw : [];
      if (list.length === 0) break;
      for (const row of list) {
        if (row && typeof row === 'object') shopRows.push(row as Record<string, unknown>);
      }
      if (list.length < limit) break;
      page++;
    } catch (e) {
      console.warn('[syncInvoiceEntities] automation auth-platform-shop:', e);
      break;
    }
  }

  const shopByEx = buildShopIndexFromRows(shopRows);

  const vatRows: Record<string, unknown>[] = [];
  page = 1;
  while (true) {
    try {
      const res = await fetchMotherSystem('/v1/api/ecommerce/vat-info/page', token, { page, limit });
      const raw = res.data?.list ?? res.data?.records ?? res.data;
      const list = Array.isArray(raw) ? raw : [];
      if (list.length === 0) break;
      for (const row of list) {
        if (row && typeof row === 'object') vatRows.push(row as Record<string, unknown>);
      }
      if (list.length < limit) break;
      page++;
    } catch (e) {
      console.warn('[syncInvoiceEntities] vat-info/page:', e);
      break;
    }
  }

  const channels = await prisma.channel.findMany({
    where: { tenantId, externalShopId: { not: null } },
  });

  let updated = 0;
  let shopByShopFallback = 0;
  let vatByShopFilter = 0;

  for (const ch of channels) {
    const ex = ch.externalShopId!.trim();
    let shop = shopByEx.get(ex) ?? null;
    if (!shop) {
      shop = await fetchAutomationShopById(token, ex);
      if (shop) shopByShopFallback++;
    }

    let vat = matchVatRowForChannel(shop, ex, vatRows);
    if (!vat) {
      const filtered = await fetchVatPageFiltered(token, ex);
      vat = matchVatRowForChannel(shop, ex, filtered);
      if (vat) vatByShopFilter++;
    }

    const invoice = buildInvoiceStoreEntityJson(shop, vat, ch.displayName);
    if (!invoice) continue;

    await prisma.channel.update({
      where: { id: ch.id },
      data: { invoiceStoreEntity: invoice },
    });
    updated++;
  }

  const result: InvoiceEntitySyncResult = {
    updated,
    channelCount: channels.length,
    shopListRows: shopRows.length,
    vatListRows: vatRows.length,
    shopByShopFallback,
    vatByShopFilter,
  };
  console.log(
    `[syncInvoiceEntities] Updated ${updated}/${channels.length} channels (shopRows=${shopRows.length}, vatRows=${vatRows.length}, shopFallback=${shopByShopFallback}, vatFilter=${vatByShopFilter}).`
  );
  return result;
}

/**
 * 将母系统的订单状态映射为本系统识别的四个标准状态
 * 基于哪吒服务-订单.md 文档枚举
 */
function mapMotherSystemOrderStatus(state: string): string {
  const s = state || '';
  // 未发货类
  if (['AwaitingDeliver', 'ToCollect', 'WaitConfirm', 'Verification', 'SET_TO_PACK', 'PACK', 'REPACK', 'PAID', 'BUYER_PAY_OR_SELLER_REFUND_PENDING'].includes(s)) {
    return 'unshipped';
  }
  // 已发货类
  if (['Shipped', 'Received', 'NotReceived'].includes(s)) {
    return 'shipped';
  }
  // 已退款/取消类
  if (['Refunded', 'SellCancelled', 'CustomerCancelled', 'PayOrRefund_FAILED', 'CANCEL_COMPLETE', 'CANCEL_CLOSED_NO_REFUND', 'CANCEL_CLOSED_WITH_REFUND', 'RETUNED', 'Damaged_by_3pl', 'Lost_by_3pl'].includes(s)) {
    return 'refunded';
  }
  // 部分退款
  if (['PARTIALLY_REFUNDED'].includes(s)) {
    return 'partial_refund';
  }
  return 'shipped'; // 默认
}

/**
 * 将单条母系统订单行 upsert 到本地（列表/详情/按需拉单共用）
 */
async function upsertOnePlatformOrderFromMother(
  tenantId: string,
  order: Record<string, unknown>
): Promise<'upserted' | 'skipped'> {
  const platformOrderId = String(order.originalOrderId || order.ordersId || order.id);

  const channel = await prisma.channel.findFirst({
    where: { tenantId, externalShopId: String(order.platformShopId) },
  });

  if (!channel) {
    console.log(`[syncOrders] Skipping order ${platformOrderId} - channel ${order.platformShopId} not found.`);
    return 'skipped';
  }

  if (!channel.syncOrdersEnabled) {
    return 'skipped';
  }

  const shippingAddress = order.shippingAddress as Record<string, string | undefined> | undefined;

  let customerId = '';
  const firstName = shippingAddress?.firstname || '';
  const lastName = shippingAddress?.lastname || '';
  const combinedName = [firstName, lastName].filter(Boolean).join(' ');

  const customerEmail =
    shippingAddress?.email ||
    (order.customerId ? `customer_${order.customerId}@example.com` : `buyer_${order.id}@example.com`);
  const customerName =
    combinedName ||
    (order.customerId ? `Customer ${order.customerId}` : `Buyer ${order.id}`);

  const customer = await prisma.customer.findFirst({
    where: { tenantId, email: customerEmail },
  });

  if (customer) {
    customerId = customer.id;
  } else {
    const newCustomer = await prisma.customer.create({
      data: {
        tenantId,
        name: customerName,
        email: customerEmail,
        shippingCountry: shippingAddress?.countryCode || shippingAddress?.country || 'Unknown',
        sentiment: 'neutral',
      },
    });
    customerId = newCustomer.id;
  }

  const mappedStatus = mapMotherSystemOrderStatus(String(order.state ?? ''));

  const addrLine = shippingAddressLineFromObject(shippingAddress ?? order.shippingAddress);

  const orderCurrency =
    pickCurrencyCodeFromMotherPayload(order) ||
    (channel.defaultCurrency?.trim() ? channel.defaultCurrency.trim().toUpperCase() : null) ||
    'USD';

  const channelInvoice = (channel.invoiceStoreEntity as Record<string, unknown>) || {};
  const hasVatInfo = !!(channelInvoice.vatNumber || (order as any).vatNumber || (order as any).taxNumber);

  const existingOrder = await prisma.order.findUnique({
    where: {
      tenantId_platformOrderId: { tenantId, platformOrderId },
    },
    select: { storeEntity: true },
  });
  const prevEntity = (existingOrder?.storeEntity as Record<string, unknown>) ?? {};

  const nextStoreEntity: Record<string, unknown> = {
    ...prevEntity,
    ...channelInvoice,
    displayName: channel.displayName,
  };
  if (addrLine) {
    nextStoreEntity.address = addrLine;
  }

  const lineItems = getOrderLineItems(order);
  const skuList = lineItems.map((i) => lineItemSku(i as Record<string, unknown>)).filter(Boolean);
  const productTitles = lineItems.map((i) => lineItemTitle(i as Record<string, unknown>));
  const amountDecimal = pickOrderAmount(order);

  let trackingNumber = null;
  let carrier = null;
  for (const item of lineItems) {
    const it = item as Record<string, unknown>;
    if (it.shippingTracking) {
      trackingNumber = String(it.shippingTracking).trim();
      const comp = it.shippingCompany || it.shippingCarrierCode;
      carrier = comp ? String(comp).trim() : null;
      break;
    }
  }

  await prisma.order.upsert({
    where: {
      tenantId_platformOrderId: {
        tenantId,
        platformOrderId,
      },
    },
    create: {
      tenantId,
      customerId,
      channelId: channel.id,
      platformOrderId,
      amount: amountDecimal,
      currency: orderCurrency,
      orderStatus: mappedStatus,
      shippingStatus: String(order.state || 'Unknown'),
      skuList,
      productTitles,
      createdAt: order.originalCreatedAt
        ? new Date(String(order.originalCreatedAt))
        : order.createAt
          ? new Date(String(order.createAt))
          : new Date(),
      updatedAt: new Date(),
      paidAt: order.originalCreatedAt ? new Date(String(order.originalCreatedAt)) : null,
      shippedAt: mappedStatus === 'shipped' && order.originalUpdatedAt ? new Date(String(order.originalUpdatedAt)) : null,
      refundedAt: mappedStatus === 'refunded' && order.originalUpdatedAt ? new Date(String(order.originalUpdatedAt)) : null,
      hasVatInfo,
      storeEntity: nextStoreEntity ? (nextStoreEntity as any) : null,
      trackingNumber,
      carrier,
    },
    update: {
      customerId,
      channelId: channel.id,
      amount: amountDecimal,
      currency: orderCurrency,
      orderStatus: mappedStatus,
      shippingStatus: String(order.state || 'Unknown'),
      updatedAt: new Date(),
      skuList,
      productTitles,
      paidAt: order.originalCreatedAt ? new Date(String(order.originalCreatedAt)) : undefined,
      shippedAt: mappedStatus === 'shipped' && order.originalUpdatedAt ? new Date(String(order.originalUpdatedAt)) : undefined,
      refundedAt: mappedStatus === 'refunded' && order.originalUpdatedAt ? new Date(String(order.originalUpdatedAt)) : undefined,
      hasVatInfo,
      storeEntity: nextStoreEntity ? (nextStoreEntity as any) : null,
      trackingNumber,
      carrier,
    },
  });

  return 'upserted';
}

/**
 * 按平台订单号从母系统回源并 upsert（PRD：按需拉单）
 */
export async function syncSingleOrderByPlatformOrderId(
  tenantId: string,
  token: string,
  platformOrderId: string
): Promise<{ ok: boolean; reason?: string; platformOrderId?: string }> {
  const pid = platformOrderId.trim();
  if (!pid) return { ok: false, reason: 'empty_platform_order_id' };

  let order: Record<string, unknown> | null =
    (await tryFetchMotherPlatformOrderDetail(token, {
      originalOrderId: pid,
      id: pid,
      ordersId: pid,
      platformOrderId: pid,
    })) ?? null;

  if (!order) {
    try {
      const wide = new Date();
      wide.setFullYear(wide.getFullYear() - 2);
      const res = await fetchMotherSystem('/v1/api/ecommerce/platform-order', token, {
        page: 1,
        limit: 100,
        startTime: wide.toISOString(),
        keyword: pid,
      });
      const list = (res.data?.list || []) as Record<string, unknown>[];
      const hit =
        list.find((o) => {
          const po = String(o.originalOrderId ?? o.ordersId ?? o.id ?? '').trim();
          return po === pid || po.includes(pid) || pid.includes(po);
        }) ?? null;
      order = hit ?? list[0] ?? null;
    } catch {
      order = null;
    }
  }

  if (!order) return { ok: false, reason: 'not_found_upstream' };

  if (orderRowNeedsDetailFetch(order)) {
    const enriched = await tryFetchMotherPlatformOrderDetail(token, order);
    if (enriched) order = enriched;
  }

  const r = await upsertOnePlatformOrderFromMother(tenantId, order);
  if (r === 'skipped') return { ok: false, reason: 'channel_not_synced' };
  const resolved = String(order.originalOrderId || order.ordersId || order.id);
  return { ok: true, platformOrderId: resolved };
}

export type SyncOrdersOptions = {
  /** 收件箱刷新用：跳过逐条 GET 订单详情，避免 N 次上游请求导致超时（全量 POST /mother-system 仍默认拉详情） */
  skipDetailFetch?: boolean;
};

/**
 * 同步母系统订单 (PlatformOrder)
 */
export async function syncOrdersFromMotherSystem(
  tenantId: string,
  token: string,
  startDate?: Date,
  options?: SyncOrdersOptions
) {
  if (!startDate) {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - MOTHER_SYNC_MAX_DAYS);
  }

  let page = 1;
  const limit = 100;
  let hasMore = true;
  let totalSynced = 0;

  while (hasMore) {
    // 恢复为之前验证通过的路径，但保留更详细的 startDate 和分页逻辑
    // 经测试，order 接口必须使用 startTime 或 start_at，使用 startAt (驼峰) 会导致 500
    const res = await fetchMotherSystem('/v1/api/ecommerce/platform-order', token, { 
      page, 
      limit,
      startTime: startDate.toISOString() 
    });
    
    const list = res.data?.list || [];
    console.log(`[syncOrders] Page ${page} returned ${list.length} items. (Total: ${res.data?.totalSize})`);
    
    if (list.length === 0) {
      hasMore = false;
      break;
    }

    for (const orderRaw of list) {
      let order = orderRaw as Record<string, unknown>;
      if (!options?.skipDetailFetch && orderRowNeedsDetailFetch(order)) {
        const enriched = await tryFetchMotherPlatformOrderDetail(token, order);
        if (enriched) order = enriched;
      }

      const r = await upsertOnePlatformOrderFromMother(tenantId, order);
      if (r === 'upserted') totalSynced++;
    }

    if (list.length < limit) {
      hasMore = false;
    } else {
      page++;
    }

    // 这里移除之前为了测试加的限制。全量同步订单应该全部拉取完，以备后续"主动发起工单"功能使用。
    // 但是订单量特别大（如3万）时耗时可能数分钟，全量同步本来就应该是低频/后台操作。
  }

  console.log(`[syncOrders] Synced ${totalSynced} orders for tenant ${tenantId}.`);
  return totalSynced;
}

function inferMessageProcessingStatusFromConv(conv: Record<string, unknown>): string {
  const unread = conv.unreadCount ?? conv.buyerUnreadCount ?? conv.unreadMessageCount;
  if (typeof unread === 'number' && unread > 0) return 'unread';
  const lur = conv.lastUnrepliedMessageAt;
  if (lur != null && lur !== '') return 'unreplied';
  const sender = String(conv.lastMessageSender ?? '').toUpperCase();
  if (
    sender === 'BUYER' ||
    sender === 'CUSTOMER' ||
    sender === 'INCOMING' ||
    sender.endsWith('_BUYER')
  ) {
    return 'unreplied';
  }
  return 'replied';
}

function mapMotherConvToTicketStatus(conv: Record<string, unknown>, fallback: TicketStatus): TicketStatus {
  const s = String(conv.state ?? conv.status ?? '')
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (['CLOSED', 'RESOLVED', 'ARCHIVED', 'DONE', 'COMPLETE'].includes(s)) return 'resolved';
  if (['OPEN', 'ACTIVE', 'PENDING', 'IN_PROGRESS', 'TODO'].includes(s)) return 'todo';
  if (s === 'WAITING' || s === 'WAITING_FOR_CUSTOMER') return 'waiting';
  return fallback;
}

function pickIntentFromConversation(conv: Record<string, unknown>): string | undefined {
  const v = pickStringField(conv, [
    'aiIntent',
    'intent',
    'intentLabel',
    'classification',
    'ticketIntent',
    'convIntent',
    'nlpIntent',
  ]);
  return v ? normalizeClassifiedIntent(v) : undefined;
}

function pickSentimentFromConversation(conv: Record<string, unknown>): string | undefined {
  const v = pickStringField(conv, [
    'sentiment',
    'emotion',
    'buyerEmotion',
    'sentimentLabel',
    'mood',
    'tone',
    'buyerSentiment',
  ]);
  return v ? normalizeClassifiedSentiment(v) : undefined;
}

/** 母系统会话上订单号字段名不一致，统一解析为平台订单号（用于关联本地 Order） */
function pickOrderReferenceFromConversation(conv: Record<string, unknown>): string | null {
  const flat = pickStringField(conv, [
    'orderReference',
    'platformOrderId',
    'originalOrderId',
    'ordersId',
    'orderSn',
    'orderNumber',
    'salesRecordNumber',
    'platformOrderSn',
    'ebayOrderId',
  ]);
  if (flat) return flat;
  const nested = conv.order;
  if (nested && typeof nested === 'object') {
    return pickStringField(nested as Record<string, unknown>, [
      'originalOrderId',
      'platformOrderId',
      'ordersId',
      'orderId',
      'id',
    ]);
  }
  return null;
}

/**
 * 部分平台把单号放在会话标题里，母系统未给 orderReference 时用标题尝试匹配本地 Order（保守规则，避免整句标题误匹配）
 */
function guessPlatformOrderIdFromSubject(subject: string): string | null {
  const s = subject.trim();
  if (!s || s.length < 10) return null;
  if (/\s/.test(s)) return null;
  if (/^\d{2,3}-\d{7}-\d{7}$/.test(s)) return s;
  if (/^\d{8,}[A-Za-z0-9][A-Za-z0-9-]*$/.test(s)) return s;
  return null;
}

/**
 * 母系统会话「最近活动时间」：优先更新时间 / 最后消息时间，再退回创建时间（用于「最近 N 天内有更新」的工单同步）
 */
function motherConversationActivityAt(conv: Record<string, unknown>): Date | null {
  const activityKeys = [
    'originalUpdateAt',
    'updateAt',
    'updatedAt',
    'lastMessageTime',
    'lastMessageAt',
    'lastReplyTime',
    'lastReplyAt',
    'latestMessageAt',
  ];
  for (const k of activityKeys) {
    const v = conv[k];
    if (v != null && String(v).trim()) {
      const d = new Date(String(v));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  const createKeys = ['originalCreateAt', 'createAt', 'createdAt'];
  for (const k of createKeys) {
    const v = conv[k];
    if (v != null && String(v).trim()) {
      const d = new Date(String(v));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function motherMessageSentAt(msg: Record<string, unknown>): Date | null {
  const keys = ['sendTime', 'sentAt', 'createAt', 'createdAt', 'create_time', 'messageTime', 'timestamp', 'msgTime'];
  for (const k of keys) {
    const v = msg[k];
    if (v != null && String(v).trim()) {
      const d = new Date(String(v));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

/**
 * 同步母系统会话 (PlatformConversation -> Ticket)
 * 仅落库「最近活动时间」不早于 startDate 的会话（默认窗口 MOTHER_SYNC_MAX_DAYS 天）。
 */
export async function syncConversationsFromMotherSystem(tenantId: string, token: string, startDate?: Date) {
  if (!startDate) {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - MOTHER_SYNC_MAX_DAYS);
  }

  const windowStart = startDate;
  const timeParam = windowStart.toISOString();

  let page = 1;
  const limit = 100;
  let hasMore = true;
  let totalSynced = 0;

  while (hasMore) {
    const res = await fetchMotherSystem(NEZHA_PLATFORM_CONVERSATION_API, token, {
      page,
      limit,
      startTime: timeParam,
      updateTime: timeParam,
    });

    const list = res.data?.list || [];
    console.log(`[syncConvs] Page ${page} returned ${list.length} conversations. (Total: ${res.data?.totalSize})`);
    
    if (list.length === 0) {
      hasMore = false;
      break;
    }

    for (const conv of list) {
      try {
        const convRec = conv as Record<string, unknown>;
        const activityAt = motherConversationActivityAt(convRec);
        if (activityAt != null && activityAt < windowStart) {
          continue;
        }

        // 1. 查找关联店铺
        const externalShopId = String(conv.platformShopId);
        const channel = await prisma.channel.findFirst({
          where: { tenantId, externalShopId }
        });
        
        if (!channel) {
          // console.log(`[syncConvs] Skipping conversation ${conv.id} - shop ${externalShopId} not in tenant ${tenantId}.`);
          continue;
        }

        if (!channel.syncMessagesEnabled) {
          continue;
        }

        const draftSubjectTrim =
          conv.subject != null && String(conv.subject).trim()
            ? String(conv.subject).trim()
            : '';

        // 3. 查找关联订单（须先有订单同步；pick 字段 + 标题猜单号 + 租户内回退）
        let linkedOrderId: string | null = null;
        let orderCustomerId: string | null = null;

        const orderRef =
          pickOrderReferenceFromConversation(convRec) ?? guessPlatformOrderIdFromSubject(draftSubjectTrim);
        if (orderRef) {
          let order = await prisma.order.findFirst({
            where: {
              tenantId,
              channelId: channel.id,
              platformOrderId: orderRef,
            },
            select: { id: true, customerId: true },
          });
          if (!order) {
            order = await prisma.order.findFirst({
              where: { tenantId, platformOrderId: orderRef },
              select: { id: true, customerId: true },
            });
          }
          if (order) {
            linkedOrderId = order.id;
            orderCustomerId = order.customerId;
          }
        }

        // 2. 映射买家/客户信息 (如果订单里已经有了，优先使用订单的客户)
        let customerId = orderCustomerId || '';
        
        if (!customerId) {
          // 平台买家 ID 优先；否则真实邮箱；再否则按会话 ID 生成占位邮箱，避免全部落到同一 Unknown Buyer
          const externalCustomerId = conv.customerId ? String(conv.customerId) : null;
          const customerEmail =
            conv.buyerEmail ||
            (externalCustomerId ? `customer_${externalCustomerId}@example.com` : `conv_${conv.id}@example.com`);
          const customerName =
            conv.buyerName || (externalCustomerId ? `Customer ${externalCustomerId}` : `Guest ${conv.id}`);

          let customer = await prisma.customer.findFirst({
            where: { tenantId, email: customerEmail }
          });

          if (customer) {
            customerId = customer.id;
            // 如果找到了客户但没有 externalId，或者需要同步姓名
            if (conv.buyerName && customer.name === 'Unknown Buyer') {
              await prisma.customer.update({
                where: { id: customer.id },
                data: { name: conv.buyerName }
              });
            }
          } else {
            customer = await prisma.customer.create({
              data: {
                tenantId,
                name: customerName,
                email: customerEmail,
                shippingCountry: conv.countryCode || '',
                sentiment: 'neutral'
              }
            });
            customerId = customer.id;
          }
        }

        // 4. 创建/更新工单 (Ticket)
        const externalId = String(conv.id);
        
        const conditions: any[] = [{ externalId: externalId }];
        if (conv.subject) {
          conditions.push({
            subject: conv.subject,
            channelId: channel.id,
            customerId
          });
        }

        // 使用 externalId 或 subject + channelId + customerId 尝试找到已有工单
        const existingTicket = await prisma.ticket.findFirst({
          where: { 
            tenantId, 
            OR: conditions
          }
        });

        const subj = draftSubjectTrim || 'No Subject';
        const updatedAt = conv.originalUpdateAt
          ? new Date(String(conv.originalUpdateAt))
          : conv.updateAt
            ? new Date(String(conv.updateAt))
            : new Date();
        const motherIntent = pickIntentFromConversation(convRec);
        const motherSentiment = pickSentimentFromConversation(convRec);
        const procStatus = inferMessageProcessingStatusFromConv(convRec);

        if (existingTicket) {
          let assignPatch: { assignedSeatId?: string } = {};
          if (existingTicket.assignedSeatId == null) {
            const sid = await computeAssignedSeatForChannelId(tenantId, channel.id, {
              intent: motherIntent ?? undefined,
            });
            if (sid) assignPatch = { assignedSeatId: sid };
          }
          await prisma.ticket.update({
            where: { id: existingTicket.id },
            data: {
              externalId: externalId,
              customerId,
              orderId: linkedOrderId || existingTicket.orderId,
              updatedAt,
              status: mapMotherConvToTicketStatus(convRec, existingTicket.status),
              subject: subj,
              subjectOriginal: draftSubjectTrim ? subj : existingTicket.subjectOriginal,
              messageProcessingStatus: procStatus,
              ...(motherIntent ? { intent: motherIntent } : {}),
              ...(motherSentiment ? { sentiment: motherSentiment } : {}),
              ...assignPatch,
            },
          });
        } else {
          const assignedSeatId = await computeAssignedSeatForChannelId(tenantId, channel.id, {
            intent: motherIntent ?? undefined,
          });
          await prisma.ticket.create({
            data: {
              tenantId,
              channelId: channel.id,
              customerId,
              externalId: externalId,
              orderId: linkedOrderId,
              status: mapMotherConvToTicketStatus(convRec, 'todo'),
              priority: 3,
              intent: motherIntent ?? '',
              sentiment: motherSentiment ?? 'neutral',
              subject: subj,
              subjectOriginal: draftSubjectTrim ? subj : null,
              messageProcessingStatus: procStatus,
              slaDueAt: await computeSlaDueAtForTicket(tenantId, channel, updatedAt),
              createdAt: conv.originalCreateAt
                ? new Date(String(conv.originalCreateAt))
                : conv.createAt
                  ? new Date(String(conv.createAt))
                  : new Date(),
              updatedAt,
              assignedSeatId,
            },
          });
        }
        totalSynced++;
      } catch (itemErr: any) {
        console.error(`[syncConvs] Error syncing conversation ${conv.id}:`, itemErr.message);
        // 继续同步下一个
      }
    }

    if (list.length < limit) hasMore = false;
    else page++;

    // 同步所有的真实会话（按日期过滤）
  }

  console.log(`[syncConversations] Synced ${totalSynced} conversations for tenant ${tenantId}.`);
  return totalSynced;
}

/**
 * 母系统会话消息方向 -> 本库 senderType（兼容大小写、字段名差异）。
 * 若母系统返回值不在白名单内，会落在默认「agent」，易导致买家消息全部显示在右侧；发现后把原始 direction 记入日志再扩展映射。
 */
function motherMessageDirectionToSenderType(msg: Record<string, unknown>): 'customer' | 'agent' | 'manager' | 'system' {
  const raw =
    msg.senderType ??
    msg.direction ??
    msg.messageDirection ??
    msg.msgDirection ??
    msg.type ??
    msg.messageType;
  if (raw == null || raw === '') return 'agent';

  const s = String(raw).trim().toUpperCase();

  // 1. 优先映射明确的数字类型（部分上游消息接口返回 1/2/3）
  if (s === '1') return 'customer';
  if (s === '2') return 'agent';
  if (s === '3') return 'manager';

  // 2. 映射字符串类型
  if (
    s === 'INCOMING' ||
    s === 'INBOUND' ||
    s === 'FROM_BUYER' ||
    s === 'FROM_CUSTOMER' ||
    s === 'CUSTOMER' ||
    s === 'BUYER' ||
    s === 'RECEIVE' ||
    s === 'RECEIVED' ||
    s === 'TO_MERCHANT'
  ) {
    return 'customer';
  }

  if (
    s === 'MANAGER' ||
    s === 'OPERATOR' ||
    s === 'PLATFORM_OPERATOR' ||
    s === 'MARKETPLACE' ||
    s === 'PLATFORM'
  ) {
    return 'manager';
  }

  if (
    s === 'SYSTEM' ||
    s === 'NOTIFICATION' ||
    s === 'ROBOT'
  ) {
    return 'system';
  }

  if (
    s === 'OUTGOING' ||
    s === 'OUTBOUND' ||
    s === 'TO_BUYER' ||
    s === 'FROM_SELLER' ||
    s === 'SELLER' ||
    s === 'MERCHANT' ||
    s === 'AGENT' ||
    s === 'STAFF' ||
    s === 'PLATFORM' ||
    s === 'SEND' ||
    s === 'SENT'
  ) {
    return 'agent';
  }

  return 'agent';
}

function motherMessageSenderDisplayName(
  msg: Record<string, unknown>,
  senderType: 'customer' | 'agent' | 'manager' | 'system'
): string {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = msg[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  };
  const direct = pick(
    'senderName',
    'sender',
    'operatorName',
    'operator',
    'fromUserName',
    'userName'
  );
  if (direct) return direct;
  if (senderType === 'customer') {
    return pick('buyerName', 'customerName', 'buyer', 'customerNick') || '买家';
  }
  if (senderType === 'manager') {
    return pick('senderNickname', 'platformOperator', 'managerName') || '平台操作员';
  }
  if (senderType === 'system') {
    return '系统通知';
  }
  return pick('sellerName', 'shopName', 'storeName') || '客服';
}

/** 母系统消息正文字段名不一致 */
function pickMessageBodyText(msg: Record<string, unknown>): string {
  const c =
    msg.content ??
    msg.body ??
    msg.text ??
    msg.message ??
    msg.messageText ??
    msg.msgContent ??
    msg.msg ??
    msg.plainText;
  if (typeof c === 'string') return c;
  if (c && typeof c === 'object') {
    const o = c as Record<string, unknown>;
    const inner = o.text ?? o.content ?? o.body;
    if (typeof inner === 'string') return inner;
  }
  if (typeof c === 'number' || typeof c === 'boolean') return String(c);
  return '';
}

/** 母系统消息体里会话 id 字段名不一致（camelCase / snake_case / 嵌套 conversation） */
function pickConversationIdFromMessage(msg: Record<string, unknown>): string | null {
  const v =
    msg.conversationId ??
    msg.conversation_id ??
    msg.platformConversationId ??
    msg.platform_conversation_id ??
    msg.platformConversationID ??
    msg.convId ??
    msg.conv_id ??
    msg.chatId ??
    msg.sessionId;
  if (v != null && v !== '') return String(v).trim();
  const conv = msg.conversation;
  if (conv && typeof conv === 'object') {
    const c = conv as Record<string, unknown>;
    const inner = c.id ?? c.conversationId;
    if (inner != null && inner !== '') return String(inner).trim();
  }
  return null;
}

/** 母系统消息 id（多字段兼容），用于 (ticketId, motherMessageId) 去重 */
function pickMotherMessageId(msg: Record<string, unknown>): string | null {
  const v =
    msg.id ??
    msg.messageId ??
    msg.msgId ??
    msg.msg_id ??
    msg.externalId ??
    msg.external_id;
  if (v == null || v === '') return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/**
 * 将单条母系统消息写入本地工单；已存在（按 motherMessageId 或 content+时间）则跳过。
 * @returns 是否新插入
 */
async function storeMotherMessageIfNew(
  tenantId: string,
  ticketId: string,
  msgRec: Record<string, unknown>,
  ticketIntent?: string
): Promise<boolean> {
  const senderType = motherMessageDirectionToSenderType(msgRec);
  const senderId = motherMessageSenderDisplayName(msgRec, senderType);
  const createdRaw = msgRec.createAt ?? msgRec.createdAt ?? msgRec.create_time;
  const msgCreatedAt = createdRaw ? new Date(String(createdRaw)) : new Date();
  const contentStr = pickMessageBodyText(msgRec);
  const mid = pickMotherMessageId(msgRec);

  if (mid) {
    const byMid = await prisma.message.findFirst({
      where: { ticketId, motherMessageId: mid },
    });
    if (byMid) return false;
  }

  const existingMsg = await prisma.message.findFirst({
    where: {
      ticketId,
      content: contentStr,
      createdAt: msgCreatedAt,
    },
  });
  if (existingMsg) return false;

  const rawAtt = msgRec.attachments;
  const attArr = Array.isArray(rawAtt) ? rawAtt : [];
  await prisma.message.create({
    data: {
      ticketId,
      senderId,
      senderType,
      content: contentStr,
      isInternal: false,
      createdAt: msgCreatedAt,
      motherMessageId: mid,
      attachments: attArr
        .map((a: any) => (typeof a === 'string' ? a : (a.url || '')))
        .filter((url: string) => url.length > 0),
    },
  });

  // 触发自动回复（动态 import，避免与 autoReplyEngine 循环依赖）
  if (senderType === 'customer' || senderType === 'manager') {
    void import('../lib/autoReplyEngine.js').then(({ triggerAutoReplyIfNeeded }) =>
      triggerAutoReplyIfNeeded(tenantId, ticketId, contentStr, ticketIntent ?? '').catch((e) =>
        console.error(`[autoReply] error triggering:`, e)
      )
    );
  }

  return true;
}

function messageMatchesConversation(msg: Record<string, unknown>, externalConversationId: string): boolean {
  const want = String(externalConversationId).trim();
  if (!want) return false;
  const picked = pickConversationIdFromMessage(msg);
  if (picked && picked === want) return true;
  const alt =
    msg.refConversationId ??
    msg.referenceConversationId ??
    msg.platformConversationId ??
    msg.platform_conversation_id;
  if (alt != null && String(alt).trim() === want) return true;
  const conv = msg.conversation;
  if (conv && typeof conv === 'object') {
    const c = conv as Record<string, unknown>;
    const cid = c.id ?? c.conversationId;
    if (cid != null && String(cid).trim() === want) return true;
  }
  return false;
}

/**
 * 同步母系统消息 (PlatformConversationMessage -> Message)
 * 仅写入发送/创建时间不早于 startDate 的消息（与工单同步窗口一致，默认 90 天）。
 */
export async function syncMessagesFromMotherSystem(tenantId: string, token: string, startDate?: Date) {
  if (!startDate) {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - MOTHER_SYNC_MAX_DAYS);
  }

  const windowStart = startDate;
  const timeParam = windowStart.toISOString();

  let page = 1;
  const limit = 100;
  let hasMore = true;
  let totalSynced = 0;

  while (hasMore) {
    const res = await fetchMotherSystem(NEZHA_PLATFORM_CONVERSATION_MESSAGE_API, token, {
      page,
      limit,
      startTime: timeParam,
      updateTime: timeParam,
    });

    const d = res.data;
    const list: unknown[] = Array.isArray(d?.list)
      ? d.list
      : Array.isArray(d?.records)
        ? d.records
        : Array.isArray(d)
          ? d
          : [];
    console.log(`[syncMessages] Page ${page} returned ${list.length} messages. (Total: ${d?.totalSize})`);

    if (list.length === 0) {
      hasMore = false;
      break;
    }

    // 1. 批量获取本页消息对应的工单
    const conversationIds: string[] = Array.from(
      new Set(
        list
          .map((m) => pickConversationIdFromMessage(m as Record<string, unknown>))
          .filter((id): id is string => Boolean(id))
      )
    );
    const tickets = await prisma.ticket.findMany({
      where: {
        tenantId,
        externalId: { in: conversationIds }
      },
      include: {
        channel: { select: { syncMessagesEnabled: true } },
      },
    });
    const ticketMap = new Map<string, (typeof tickets)[number]>();
    for (const t of tickets) {
      const ex = String(t.externalId ?? '').trim();
      if (!ex) continue;
      ticketMap.set(ex, t);
      ticketMap.set(ex.toLowerCase(), t);
    }

    let pageSkipNoConv = 0;
    let pageSkipNoTicket = 0;

    for (const msg of list) {
      const msgRec = msg as Record<string, unknown>;
      const sentAt = motherMessageSentAt(msgRec);
      if (sentAt != null && sentAt < windowStart) {
        continue;
      }
      const conversationId = pickConversationIdFromMessage(msgRec);
      if (!conversationId) {
        pageSkipNoConv++;
        continue;
      }
      let ticket: (typeof tickets)[number] | null | undefined =
        ticketMap.get(conversationId) ?? ticketMap.get(conversationId.toLowerCase());

      // 如果按 externalId 没找到，尝试按主题找（回退方案）
      if (!ticket) {
        const subjHint =
          pickStringField(msgRec, ['subject', 'title', 'conversationSubject']) || '___';
        ticket = await prisma.ticket.findFirst({
          where: { 
            tenantId, 
            OR: [
              { subject: { contains: subjHint } },
              { subjectOriginal: { contains: subjHint } }
            ]
          },
          orderBy: { createdAt: 'desc' },
          include: {
            channel: { select: { syncMessagesEnabled: true } },
          },
        });
      }

      if (!ticket) {
        pageSkipNoTicket++;
        continue;
      }

      if (ticket.channel && !ticket.channel.syncMessagesEnabled) {
        continue;
      }

      const inserted = await storeMotherMessageIfNew(tenantId, ticket.id, msgRec, ticket.intent);
      if (inserted) totalSynced++;
    }

    if (pageSkipNoConv || pageSkipNoTicket) {
      console.warn(
        `[syncMessages] Page ${page}: skipped noConversationId=${pageSkipNoConv}, noLocalTicket=${pageSkipNoTicket}`
      );
    }

    if (list.length < limit) hasMore = false;
    else page++;

    // 同步所有的真实消息（按日期过滤）
  }

  console.log(`[syncMessages] Synced ${totalSynced} messages for tenant ${tenantId}.`);
  return totalSynced;
}

/**
 * 收件箱专用：先同步订单再会话 + 消息，否则工单无法关联 Order（仅刷新会话时 orderId 会一直为空）
 */
export async function syncInboxRefreshFromMotherSystem(
  tenantId: string,
  token: string,
  days: number,
  options?: { incremental?: boolean; useSyncWatermark?: boolean }
): Promise<{ ordersSynced: number; conversationsSynced: number; messagesSynced: number }> {
  const capped = Math.max(1, Math.min(Math.floor(days), MOTHER_SYNC_MAX_DAYS));
  const useWatermark = options?.useSyncWatermark !== false && options?.incremental !== false;
  const orderStart = await getScopedSyncStartDate(tenantId, ORDER_INCREMENTAL_SCOPE, capped, useWatermark);
  const msgStart = await getScopedSyncStartDate(tenantId, INBOX_REFRESH_SCOPE, capped, useWatermark);
  const ordersSynced = await syncOrdersFromMotherSystem(tenantId, token, orderStart, {
    skipDetailFetch: true,
  });
  const conversationsSynced = await syncConversationsFromMotherSystem(tenantId, token, msgStart);
  const messagesSynced = await syncMessagesFromMotherSystem(tenantId, token, msgStart);
  if (useWatermark) {
    await touchScopedSyncWatermark(tenantId, INBOX_REFRESH_SCOPE);
    await touchScopedSyncWatermark(tenantId, ORDER_INCREMENTAL_SCOPE);
  }
  return { ordersSynced, conversationsSynced, messagesSynced };
}

type SyncPollSettingsPick = {
  incrementalSyncDays: number;
  useSyncWatermark: boolean;
};

/** 定时任务：仅会话 + 消息（订单由 runTenantOrderSync 单独跑） */
export async function runTenantMessageSync(
  tenantId: string,
  token: string,
  settings: SyncPollSettingsPick
): Promise<{ conversationsSynced: number; messagesSynced: number }> {
  const capped = Math.max(
    1,
    Math.min(Math.floor(settings.incrementalSyncDays), MOTHER_SYNC_MAX_DAYS)
  );
  const useW = settings.useSyncWatermark;
  const msgStart = await getScopedSyncStartDate(tenantId, INBOX_REFRESH_SCOPE, capped, useW);
  const conversationsSynced = await syncConversationsFromMotherSystem(tenantId, token, msgStart);
  const messagesSynced = await syncMessagesFromMotherSystem(tenantId, token, msgStart);
  if (useW) await touchScopedSyncWatermark(tenantId, INBOX_REFRESH_SCOPE);
  return { conversationsSynced, messagesSynced };
}

/** 定时任务：仅订单 */
export async function runTenantOrderSync(
  tenantId: string,
  token: string,
  settings: SyncPollSettingsPick
): Promise<{ ordersSynced: number }> {
  const capped = Math.max(
    1,
    Math.min(Math.floor(settings.incrementalSyncDays), MOTHER_SYNC_MAX_DAYS)
  );
  const useW = settings.useSyncWatermark;
  const orderStart = await getScopedSyncStartDate(tenantId, ORDER_INCREMENTAL_SCOPE, capped, useW);
  const ordersSynced = await syncOrdersFromMotherSystem(tenantId, token, orderStart);
  if (useW) await touchScopedSyncWatermark(tenantId, ORDER_INCREMENTAL_SCOPE);
  return { ordersSynced };
}

/** 尝试 GET 单笔会话详情（母系统路径多版本兜底） */
export async function tryFetchMotherConversationById(
  token: string,
  conversationId: string
): Promise<Record<string, unknown> | null> {
  const id = String(conversationId).trim();
  if (!id) return null;
  const path = nezhaPlatformConversationDetailPath(id);
  try {
    const res = await fetchMotherSystem(path, token, {});
    const raw = res?.data ?? res;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const row = raw as Record<string, unknown>;
      if (row.id != null || row.orderReference != null || row.subject != null) return row;
    }
    const list = (raw as { list?: unknown })?.list;
    if (Array.isArray(list) && list[0] && typeof list[0] === 'object') {
      return list[0] as Record<string, unknown>;
    }
  } catch (e) {
    console.warn('[tryFetchMotherConversationById]', path, e instanceof Error ? e.message : e);
  }
  return null;
}

/**
 * 仅为一条本地工单从哪吒拉取消息（分页，限 maxPages；接口若忽略 conversationId 则按列表过滤）。
 */
export async function importMessagesForSingleConversation(
  tenantId: string,
  token: string,
  ticketId: string,
  externalConversationId: string,
  maxPages = 15
): Promise<number> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - MOTHER_SYNC_MAX_DAYS);

  const ticketRow = await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId },
    select: { id: true, intent: true },
  });
  if (!ticketRow) return 0;

  const ext = String(externalConversationId).trim();
  if (!ext) return 0;

  let imported = 0;
  let page = 1;
  const limit = 100;
  let pagesDone = 0;

  while (pagesDone < maxPages) {
    pagesDone++;
    let res: { data?: { list?: unknown[] } };
    try {
      res = await fetchMotherSystem(NEZHA_PLATFORM_CONVERSATION_MESSAGE_API, token, {
        page,
        limit,
        startTime: startDate.toISOString(),
        updateTime: startDate.toISOString(),
        conversationId: ext,
      });
    } catch {
      break;
    }

    const list = (res?.data?.list || []) as Record<string, unknown>[];
    if (list.length === 0) break;

    let filtered = list.filter((m) => messageMatchesConversation(m, ext));
    if (filtered.length === 0 && list.length > 0) {
      const firstPick = pickConversationIdFromMessage(list[0] as Record<string, unknown>);
      if (firstPick == null || firstPick === '') {
        filtered = list;
        console.warn(
          `[importMessages] page ${page}: messages lack conversationId; treating ${list.length} rows as conv ${ext}`
        );
      }
    }
    for (const msg of filtered) {
      const mRec = msg as Record<string, unknown>;
      const st = motherMessageSentAt(mRec);
      if (st != null && st < startDate) continue;
      const inserted = await storeMotherMessageIfNew(tenantId, ticketRow.id, mRec, ticketRow.intent);
      if (inserted) imported++;
    }

    if (list.length < limit) break;
    page++;
  }

  return imported;
}

/**
 * 打开工单详情时：无关联订单或无消息时，用母系统 token 尝试补全（依赖 NEZHA_API_TOKEN）。
 */
export async function hydrateTicketFromNezhaOnRead(
  tenantId: string,
  ticketRowId: string,
  token: string
): Promise<{ orderLinked: boolean; messagesImported: number }> {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketRowId, tenantId },
  });
  if (!ticket?.externalId?.trim()) {
    return { orderLinked: false, messagesImported: 0 };
  }

  let orderLinked = false;
  if (!ticket.orderId) {
    const conv = await tryFetchMotherConversationById(token, ticket.externalId);
    if (conv) {
      let orderRef =
        pickStringField(conv, [
          'orderReference',
          'ordersId',
          'originalOrderId',
          'platformOrderId',
          'orderId',
        ]) || null;
      if (!orderRef && conv.orderReference != null) {
        orderRef = String(conv.orderReference).trim();
      }
      if (orderRef) {
        const ord = await prisma.order.findFirst({
          where: { tenantId, platformOrderId: orderRef.trim() },
        });
        if (ord) {
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: { orderId: ord.id },
          });
          orderLinked = true;
        }
      }
    }
  }

  let messagesImported = 0;
  const timelineCount = await prisma.message.count({
    where: { ticketId: ticket.id, isInternal: false },
  });
  if (timelineCount === 0) {
    messagesImported = await importMessagesForSingleConversation(
      tenantId,
      token,
      ticket.id,
      ticket.externalId
    );
  }

  return { orderLinked, messagesImported };
}

/**
 * 主同步后补救：仍有 externalId 但时间轴上无对外消息（含「0 条」或「仅内部备注」）的工单，逐条向哪吒拉消息页。
 */
export async function backfillNezhaMessagesForEmptyTickets(
  tenantId: string,
  token: string,
  maxTickets = 50
): Promise<{ ticketsTried: number; messagesImported: number }> {
  const empty = await prisma.ticket.findMany({
    where: {
      tenantId,
      externalId: { not: null },
      messages: { none: { isInternal: false } },
    },
    select: { id: true, externalId: true },
    take: maxTickets,
    orderBy: { updatedAt: 'desc' },
  });
  let messagesImported = 0;
  for (const t of empty) {
    const ext = t.externalId?.trim();
    if (!ext) continue;
    messagesImported += await importMessagesForSingleConversation(tenantId, token, t.id, ext, 20);
  }
  return { ticketsTried: empty.length, messagesImported };
}

/**
 * 向母系统 POST 数据
 */
async function postMotherSystem(path: string, token: string, body: any) {
  const url = `${MOTHER_SYSTEM_API_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(MOTHER_FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    const hint = e instanceof Error ? e.message : String(e);
    throw new Error(`Mother POST failed ${path} (${MOTHER_FETCH_TIMEOUT_MS}ms): ${hint}`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mother system POST error: ${res.status} ${res.statusText} - ${text}`);
  }

  return res.json();
}

/**
 * 调用母系统回复接口（同 NEZHA_PLATFORM_CONVERSATION_API 下的 /reply 子路径）
 */
export async function replyToConversationInMotherSystem(
  token: string,
  conversationId: string,
  payload: { content: string; attachments?: string[]; deliveryTargets?: string[] }
) {
  return postMotherSystem(nezhaPlatformConversationReplyPath(conversationId), token, payload);
}
