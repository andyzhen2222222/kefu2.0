import type { Order } from '@/src/types';

export function shippingAddressLineFromObject(sa: unknown): string {
  if (!sa || typeof sa !== 'object') return '';
  const o = sa as Record<string, unknown>;
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (v == null) return;
    const s = String(v).trim();
    if (s) parts.push(s);
  };
  push(o.address);
  push(o.addressLine1);
  push(o.addressLine2);
  // 母系统 platform-order / BI 订单等
  push(o.address1);
  push(o.address2);
  push(o.address3);
  push(o.street1);
  push(o.street2);
  push(o.addressLine);
  push(o.fullAddress);
  push(o.detailAddress);
  const cityLine = [
    o.city,
    o.state ?? o.stateOrProvince,
    o.postalCode ?? o.zip ?? o.postcode ?? o.zipcode,
  ]
    .filter((x) => x != null && String(x).trim())
    .join(', ');
  if (cityLine) parts.push(cityLine);
  push(o.countryCode ?? o.country);
  return parts.join(' · ');
}

export function isShippingAddressPlaceholder(addr: string | undefined | null): boolean {
  const t = (addr ?? '').trim();
  return !t || t === 'Address not provided' || t === '未提供收货地址';
}

export function extractShippingAddressFromOrderLikePayload(root: unknown): string | null {
  if (!root || typeof root !== 'object') return null;
  const r = root as Record<string, unknown>;
  const nestedKeys = [
    'shippingAddress',
    'shipToAddress',
    'shipping_address',
    'receiverAddress',
    'receiverInfo',
    'consigneeAddress',
    'deliveryAddress',
    'buyerShippingAddress',
    'recipientAddress',
  ];
  for (const k of nestedKeys) {
    const line = shippingAddressLineFromObject(r[k]);
    if (line) return line;
  }
  const flat = shippingAddressLineFromObject(r);
  if (flat) return flat;

  for (const wrap of ['order', 'platformOrder', 'detail', 'orderDetail', 'data']) {
    const inner = r[wrap];
    if (inner && typeof inner === 'object') {
      const line = extractShippingAddressFromOrderLikePayload(inner);
      if (line) return line;
    }
  }

  return null;
}

/** 本地库无地址时，用订单接口附带的 nezhaRaw 等回填 storeEntity.address */
export function enrichOrderStoreEntityWithNezha(raw: {
  storeEntity?: Order['storeEntity'];
  nezhaRaw?: unknown;
}): Order['storeEntity'] | undefined {
  const se = raw.storeEntity;
  const cur = typeof se?.address === 'string' ? se.address.trim() : '';
  if (!isShippingAddressPlaceholder(cur)) return se;
  if (!raw.nezhaRaw) return se;
  const line = extractShippingAddressFromOrderLikePayload(raw.nezhaRaw);
  if (!line) return se;
  return {
    ...(typeof se === 'object' && se ? se : {}),
    address: line,
  } as Order['storeEntity'];
}
