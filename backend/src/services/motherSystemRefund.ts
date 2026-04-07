const MOTHER_SYSTEM_API_URL = process.env.MOTHER_SYSTEM_API_URL || 'https://tiaojia.nezhachuhai.com';

/**
 * 调用母系统退款接口（演示对接）
 * 由于母系统 OpenAPI 文档中尚未明确退款 endpoint，此处目前按推测路径尝试
 */
export async function refundOrderInMotherSystem(
  token: string,
  platformOrderId: string,
  payload: { amount: number; reason?: string; platformType?: string }
) {
  // 目前母系统并未在 openapi-evol.json 中暴露明确的 refund 接口。
  // Node.js 18+ 已内置 global fetch
  
  console.log(`[motherSystemRefund] Attempting refund for order ${platformOrderId} (Amount: ${payload.amount}, Type: ${payload.platformType})`);
  
  // 模拟对几个可能的路径进行尝试
  const paths = [
    `/v1/api/ecommerce/platform-order/${platformOrderId}/refund`,
    `/v1/api/biz/order/refund`,
    `/v1/api/ecommerce/refund`
  ];
  
  let lastError: Error | null = null;
  
  for (const path of paths) {
    try {
      const url = `${MOTHER_SYSTEM_API_URL}${path}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          platformOrderId,
          amount: payload.amount,
          reason: payload.reason || 'Customer Service Refund',
          ...(path.includes('biz') ? { id: platformOrderId } : {})
        }),
      });

      if (res.ok) {
        const text = await res.text();
        let data: unknown = text;
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          /* 非 JSON 也视为成功 */
        }
        console.log(`[motherSystemRefund] Refund SUCCESS via ${path}:`, data);
        return data;
      }
      
      const text = await res.text();
      console.warn(`[motherSystemRefund] Refund FAILED via ${path}: ${res.status} ${text}`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(`[motherSystemRefund] Refund ERROR via ${path}:`, lastError.message);
    }
  }

  // 如果所有路径都失败，返回一个错误但允许本地流程继续（标记为手动）
  throw lastError || new Error(`母系统暂未提供针对平台 ${payload.platformType} 的直接退款 API 接口。`);
}
