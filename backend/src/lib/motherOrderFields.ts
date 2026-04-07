/**
 * 从母系统 / 哪吒订单结构中提取物流单号与承运商（与 motherSystemSync 中 items 遍历逻辑一致）。
 */
export function extractTrackingFromMotherPayload(raw: unknown): {
  trackingNumber: string | null;
  carrier: string | null;
} {
  if (!raw || typeof raw !== 'object') return { trackingNumber: null, carrier: null };
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return { trackingNumber: null, carrier: null };
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const it = item as Record<string, unknown>;
    const st = it.shippingTracking;
    if (st != null && String(st).trim()) {
      const trackingNumber = String(st).trim();
      const comp = it.shippingCompany ?? it.shippingCarrierCode;
      const carrier =
        comp != null && String(comp).trim() ? String(comp).trim() : null;
      return { trackingNumber, carrier };
    }
  }
  return { trackingNumber: null, carrier: null };
}
