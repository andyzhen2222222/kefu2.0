import type { Order } from '@/src/types';

/** 侧栏/发票等：按订单币种格式化金额（非法币种码时退回「币种 数值」） */
export function formatOrderMoney(amount: number, currency: string | undefined): string {
  const code = (currency || 'USD').trim().toUpperCase() || 'USD';
  try {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: code }).format(amount);
  } catch {
    return `${code} ${Number(amount).toFixed(2)}`;
  }
}

/** 收货地址：storeEntity.address 在同步里可能承载买家地址；兼容历史英文占位文案 */
export function displayOrderShippingAddress(order: Pick<Order, 'storeEntity'>): string {
  const raw = order.storeEntity?.address?.trim();
  if (!raw) return '未提供收货地址';
  if (raw === 'Address not provided') return '未提供收货地址';
  return raw;
}
