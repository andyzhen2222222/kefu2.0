/**
 * 平台类型（Channel.platformType）→ 仪表盘/树状分组展示名（Amazon、eBay 等）。
 * 无类型时可根据店铺 displayName 做弱推断（兼容 Mock）。
 */
export function platformGroupLabelFromType(platformType?: string | null): string | null {
  const p = (platformType || '').toUpperCase();
  if (p === 'AMAZON') return 'Amazon';
  if (p === 'EBAY') return 'eBay';
  if (p === 'SHOPIFY') return 'Shopify';
  if (p === 'WALMART' || p.startsWith('WALMART')) return 'Walmart';
  if (p.includes('CDISCOUNT')) return 'Cdiscount';
  if (p.includes('WORTEN')) return 'Worten';
  if (p.includes('EMAG')) return 'eMAG';
  if (p.includes('OZON')) return 'Ozon';
  if (p.includes('TEMU')) return 'Temu';
  if (p.includes('SHEIN')) return 'Shein';
  if (p.includes('TIKTOK')) return 'TikTok';
  if (p.includes('SHOPEE')) return 'Shopee';
  if (p.includes('LAZADA')) return 'Lazada';
  if (p.includes('MERCADO')) return 'Mercado';
  if (p.includes('FNAC')) return 'Fnac';
  if (p.includes('CARREFOUR')) return 'Carrefour';
  if (p.includes('MEDIAMARKT')) return 'MediaMarkt';
  if (p.includes('BOULANGER')) return 'Boulanger';
  if (p.includes('PCCOMPONENTES')) return 'PcComponentes';
  if (p.includes('RUEDUCOMMERCE')) return 'Rue du Commerce';
  if (p.includes('MANOMANO')) return 'ManoMano';
  if (p.includes('VEEPEE')) return 'Veepee';
  if (p.includes('PRIVALIA')) return 'Privalia';
  if (p.includes('CASHCONVERTERS')) return 'Cash Converters';
  if (p.includes('BACKMARKET')) return 'Back Market';
  if (p.includes('ALLEGRO')) return 'Allegro';
  if (p.includes('KAUFLAND')) return 'Kaufland';
  if (p.includes('WISH')) return 'Wish';
  if (!p) return null;
  // 如果是其他未知但有值的类型，直接返回大写（或首字母大写），而不是归类为“其他”
  return p.charAt(0) + p.slice(1).toLowerCase();
}

function inferPlatformFromShopDisplay(shop: string): string {
  const s = shop.toLowerCase();
  if (s.includes('amazon')) return 'Amazon';
  if (s.includes('ebay')) return 'eBay';
  if (s.includes('shopify')) return 'Shopify';
  if (s.includes('walmart')) return 'Walmart';
  if (s.includes('cdiscount')) return 'Cdiscount';
  if (s.includes('worten')) return 'Worten';
  if (s.includes('emag')) return 'eMAG';
  if (s.includes('ozon')) return 'Ozon';
  return '其他';
}

/** 工单列表分组：优先 API 的 platformType，否则从店铺名推断 */
export function platformGroupLabelForTicket(platformType?: string | null, shopDisplayName?: string): string {
  const fromType = platformGroupLabelFromType(platformType);
  if (fromType) return fromType;
  return inferPlatformFromShopDisplay(shopDisplayName ?? '');
}
