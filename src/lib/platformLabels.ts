/**
 * 平台类型（Channel.platformType）→ 仪表盘/树状分组展示名（Amazon、eBay 等）。
 * 无类型时可根据店铺 displayName 做弱推断（兼容 Mock）。
 */
export function platformGroupLabelFromType(platformType?: string | null): string | null {
  const p = (platformType || '').toUpperCase();
  if (p === 'AMAZON') return 'Amazon';
  if (p === 'EBAY') return 'eBay';
  if (p === 'SHOPIFY') return 'Shopify';
  if (p === 'WALMART') return 'Walmart';
  if (!p) return null;
  return '其他';
}

function inferPlatformFromShopDisplay(shop: string): string {
  const s = shop.toLowerCase();
  if (s.includes('amazon')) return 'Amazon';
  if (s.includes('ebay')) return 'eBay';
  if (s.includes('shopify')) return 'Shopify';
  if (s.includes('walmart')) return 'Walmart';
  return '其他';
}

/** 工单列表分组：优先 API 的 platformType，否则从店铺名推断 */
export function platformGroupLabelForTicket(platformType?: string | null, shopDisplayName?: string): string {
  const fromType = platformGroupLabelFromType(platformType);
  if (fromType) return fromType;
  return inferPlatformFromShopDisplay(shopDisplayName ?? '');
}
