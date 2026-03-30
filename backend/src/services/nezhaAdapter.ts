/**
 * 母系统订单回源（可选）。未配置 Token 或请求失败时返回 null，由调用方使用本地 Order。
 */
const base = () => process.env.NEZHA_API_BASE?.replace(/\/$/, '') ?? '';
const token = () => process.env.NEZHA_API_TOKEN?.trim() ?? '';

export interface NezhaOrderShape {
  platformOrderId: string;
  amount: number;
  currency: string;
  orderStatus: string;
  raw?: unknown;
}

export async function fetchNezhaOrderHint(platformOrderId: string): Promise<NezhaOrderShape | null> {
  if (!base() || !token()) return null;
  try {
    const url = `${base()}/v1/api/biz/order/platform-shop-review?page=1&limit=1&keyword=${encodeURIComponent(platformOrderId)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token()}`, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { code?: number; data?: { list?: unknown[] } };
    if (json.code !== 0 || !json.data?.list?.[0]) return null;
    return {
      platformOrderId,
      amount: 0,
      currency: 'USD',
      orderStatus: 'unshipped',
      raw: json.data.list[0],
    };
  } catch {
    return null;
  }
}
