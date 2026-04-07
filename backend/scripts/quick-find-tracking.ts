import crypto from 'crypto';
import dotenv from 'dotenv';
import { NEZHA_PLATFORM_CONVERSATION_API } from '../src/lib/nezhaEcommercePaths.js';

dotenv.config();

const MOTHER_SYSTEM_API_URL = process.env.MOTHER_SYSTEM_API_URL || process.env.NEZHA_API_BASE || 'https://tiaojia.nezhachuhai.com';

function getOrderLineItems(order: any): any[] {
  if (!order || typeof order !== 'object') return [];
  const items = order.items || order.orderItems || order.productList || order.products || order.lineItems;
  return Array.isArray(items) ? items : [];
}

async function fetchMotherSystem(path: string, token: string, params: any) {
  const url = new URL(MOTHER_SYSTEM_API_URL + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v != null) url.searchParams.set(k, String(v));
    }
  }
  
  const nonce = crypto.randomUUID();
  const timestamp = Date.now().toString();

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-timestamp': timestamp,
      'x-nonce': nonce,
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const token = process.env.NEZHA_API_TOKEN;
  if (!token) {
    console.error('No NEZHA_API_TOKEN found.');
    process.exit(1);
  }

  console.log('正在拉取近期工单，寻找带有物流单号信息的订单，以供测试...\n');

  let page = 1;
  let found = 0;
  
  while (found < 10 && page <= 5) {
    const res = await fetchMotherSystem(NEZHA_PLATFORM_CONVERSATION_API, token, {
      page,
      limit: 50,
    });
    
    const list = res.data?.list || [];
    if (list.length === 0) break;

    for (const conv of list) {
      const orderRef = conv.orderReference || conv.ordersId || conv.originalOrderId || conv.platformOrderId;
      if (!orderRef) continue;

      // 查详情
      try {
        const orderRes = await fetchMotherSystem(`/v1/api/ecommerce/platform-order/${encodeURIComponent(orderRef)}`, token, {});
        const orderDetail = orderRes.data || orderRes;
        
        if (orderDetail) {
          const items = getOrderLineItems(orderDetail);
          let trackingNumber = null;
          let carrier = null;
          
          for (const item of items) {
            const it = item as any;
            if (it.shippingTracking) {
              trackingNumber = String(it.shippingTracking).trim();
              carrier = (it.shippingCompany || it.shippingCarrierCode || '').trim();
              break;
            }
          }

          if (trackingNumber) {
            console.log(`- 工单 ID (External): ${conv.id}`);
            console.log(`  工单标题: ${conv.subject || 'N/A'}`);
            console.log(`  订单号: ${orderRef}`);
            console.log(`  物流承运商: ${carrier || 'N/A'}`);
            console.log(`  物流单号: ${trackingNumber}`);
            console.log(`  订单状态: ${orderDetail.state}`);
            console.log('----------------------------------------------------');
            found++;
            if (found >= 10) break;
          }
        }
      } catch (err) {
        // ignore
      }
    }
    page++;
  }

  if (found === 0) {
    console.log('在前几页近期工单中，未找到包含物流单号的订单关联。');
  } else {
    console.log(`\n已成功找到 ${found} 个示例供您测试。`);
  }
}

main().catch(console.error);
