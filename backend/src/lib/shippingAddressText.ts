/**
 * 从各类母系统/Nezha 订单 JSON 中拼「一行收货地址」，供 API 回填 storeEntity.address。
 */
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
  // 母系统 /v1/api/ecommerce/platform-order、BI 订单等常用
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

/** 在订单/回源对象上尝试常见字段名，得到收货地址一行文案 */
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
