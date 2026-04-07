/**
 * 母系统：店铺(auth-platform-shop automation) + VAT 分页 → 合并为发票用 StoreEntity 形状
 */

function pickStr(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

export function shopRowExternalId(row: Record<string, unknown>): string {
  return pickStr(row, ['id', 'platformShopId', 'authPlatformShopId', 'shopId', 'authShopId']);
}

/** 列表里同一店铺可能用不同字段作 id，全部索引便于与 Channel.externalShopId 对齐 */
export function buildShopIndexFromRows(rows: Record<string, unknown>[]): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    for (const k of ['id', 'platformShopId', 'authPlatformShopId', 'shopId', 'authShopId']) {
      const v = pickStr(row, [k]);
      if (v) map.set(v, row);
    }
  }
  return map;
}

export function matchVatRowForChannel(
  shop: Record<string, unknown> | null,
  externalShopId: string,
  vatRows: Record<string, unknown>[]
): Record<string, unknown> | null {
  const pseudo: Record<string, unknown> = shop ?? {
    id: externalShopId,
    platformShopId: externalShopId,
    authPlatformShopId: externalShopId,
    shopId: externalShopId,
  };
  for (const v of vatRows) {
    if (vatRowMatchesShop(pseudo, v)) return v;
  }
  return null;
}

export interface InvoiceEntitySyncResult {
  updated: number;
  channelCount: number;
  shopListRows: number;
  vatListRows: number;
  shopByShopFallback: number;
  vatByShopFilter: number;
}

/** VAT 行是否与店铺行关联（多字段兜底） */
export function vatRowMatchesShop(shop: Record<string, unknown>, vat: Record<string, unknown>): boolean {
  const shopIds = new Set<string>();
  for (const k of ['id', 'platformShopId', 'authPlatformShopId', 'shopId', 'authShopId', 'vatInfo']) {
    const s = pickStr(shop, [k]);
    if (s) shopIds.add(s);
  }
  for (const k of [
    'id',
    'platformShopId',
    'authPlatformShopId',
    'shopId',
    'authShopId',
    'platformShop',
    'sellerId',
  ]) {
    const s = pickStr(vat, [k]);
    if (s && shopIds.has(s)) return true;
  }
  const sc = pickStr(shop, ['companyId', 'subjectId', 'legalEntityId', 'entityId', 'companySubjectId']);
  const vc = pickStr(vat, ['companyId', 'subjectId', 'legalEntityId', 'entityId', 'companySubjectId']);
  if (sc && vc && sc === vc) return true;
  return false;
}

export function buildInvoiceStoreEntityJson(
  shop: Record<string, unknown> | null,
  vat: Record<string, unknown> | null,
  channelDisplayName: string
): Record<string, string> | null {
  const legalName = pickStr(vat ?? {}, [
    'companyName',
    'legalName',
    'companyLegalName',
    'subjectName',
    'merchantName',
    'viesName',
  ]) ||
    pickStr(shop ?? {}, [
      'companyName',
      'legalName',
      'companyLegalName',
      'name',
      'shopName',
      'merchantName',
      'entityName',
      'sellerName',
      'subjectName',
    ]);
  const vatNumber = pickStr(vat ?? {}, [
    'vatNumber',
    'vatNo',
    'taxNumber',
    'vatCode',
    'vatId',
    'euVat',
    'vatTaxNumber',
    'taxVatNumber',
  ]);
  const address = pickStr(vat ?? {}, ['address', 'companyAddress', 'registeredAddress', 'viesAddress']) ||
    pickStr(shop ?? {}, ['address', 'companyAddress', 'registeredAddress', 'businessAddress']);
  const taxCode = pickStr(vat ?? {}, ['taxCode', 'taxId', 'tin']);
  const id =
    pickStr(vat ?? {}, ['id', 'subjectId', 'companyId']) ||
    pickStr(shop ?? {}, ['id', 'companyId', 'subjectId']) ||
    'shop-entity';

  // 至少要有 automation 店铺行或 VAT 行，避免空同步污染
  if (!shop && !vat) return null;

  const out: Record<string, string> = {
    id,
    legalName: legalName || channelDisplayName,
    displayName: channelDisplayName,
    address: address || '',
    vatNumber: vatNumber || '',
  };
  if (taxCode) out.taxCode = taxCode;
  return out;
}

/** 渠道默认发票主体 + 订单 storeEntity（后者覆盖前者，便于订单级收货地址等） */
export function mergeOrderStoreEntityForInvoice(orderJson: unknown, channelInvoiceJson: unknown): unknown {
  const c =
    channelInvoiceJson && typeof channelInvoiceJson === 'object' && !Array.isArray(channelInvoiceJson)
      ? { ...(channelInvoiceJson as Record<string, unknown>) }
      : {};
  const o =
    orderJson && typeof orderJson === 'object' && !Array.isArray(orderJson)
      ? { ...(orderJson as Record<string, unknown>) }
      : {};
  if (Object.keys(c).length === 0 && Object.keys(o).length === 0) return orderJson ?? null;
  const merged = { ...c, ...o };
  return Object.keys(merged).length ? merged : orderJson ?? null;
}
