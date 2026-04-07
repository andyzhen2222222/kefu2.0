import { fetchNezhaOrderHint } from '../services/nezhaAdapter.js';
import { mapOrder } from '../dto/mappers.js';
import { extractTrackingFromMotherPayload } from './motherOrderFields.js';
import {
  extractShippingAddressFromOrderLikePayload,
  isShippingAddressPlaceholder,
} from './shippingAddressText.js';

export type OrderDto = ReturnType<typeof mapOrder>;

/**
 * 合并哪吒订单回源：收货地址占位时回填；本地无物流单号时用 items[].shippingTracking 等字段补齐。
 */
export async function enrichOrderDtoWithNezha(
  dto: OrderDto
): Promise<OrderDto & { nezhaSync?: true; nezhaRaw?: unknown }> {
  // 当开启了禁用回源的环境变量时，直接返回
  if (process.env.NEZHA_ENRICH_ORDER === '0') return dto;

  const curAddr =
    dto.storeEntity &&
    typeof dto.storeEntity === 'object' &&
    'address' in dto.storeEntity &&
    typeof (dto.storeEntity as { address?: unknown }).address === 'string'
      ? (dto.storeEntity as { address: string }).address
      : '';
  const needAddr = isShippingAddressPlaceholder(curAddr);
  const dbTrk = (dto.trackingNumber ?? '').trim();
  const needTracking = !dbTrk;

  // 性能优化：如果既不需要补充地址，也不需要补充物流单号，跳过母系统实时请求
  if (!needAddr && !needTracking) {
    return dto;
  }

  const hint = await fetchNezhaOrderHint(dto.platformOrderId);
  let storeEntity = dto.storeEntity;
  if (needAddr && hint?.raw) {
    const line = extractShippingAddressFromOrderLikePayload(hint.raw);
    if (line) {
      storeEntity = {
        ...(typeof dto.storeEntity === 'object' && dto.storeEntity ? dto.storeEntity : {}),
        address: line,
      };
    }
  }

  let merged: OrderDto =
    needAddr && storeEntity !== dto.storeEntity ? { ...dto, storeEntity } : dto;
  if (hint?.raw) {
    const { trackingNumber: neoTrk, carrier: neoCar } = extractTrackingFromMotherPayload(hint.raw);
    const dbTrk = (dto.trackingNumber ?? '').trim();
    if (neoTrk && !dbTrk) {
      merged = {
        ...merged,
        trackingNumber: neoTrk,
        carrier: neoCar ?? merged.carrier ?? null,
      };
    }
    return { ...merged, nezhaSync: true as const, nezhaRaw: hint.raw };
  }
  return merged;
}
