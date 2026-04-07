/**
 * 从母系统拉取近 N 天订单+会话+消息写入本地（与 POST /api/sync/inbox-tickets 同源逻辑）。
 * 用法: npx tsx scripts/run-inbox-sync.ts [days]
 * 环境: backend/.env 中 NEZHA_API_TOKEN；可选 TENANT_ID（默认种子租户）
 */
import 'dotenv/config';
import {
  syncInboxRefreshFromMotherSystem,
  MOTHER_SYNC_MAX_DAYS,
} from '../src/services/motherSystemSync.js';

const tenantId =
  process.env.TENANT_ID?.trim() || '11111111-1111-4111-8111-111111111111';
const token = process.env.NEZHA_API_TOKEN?.trim();
const daysArg = parseInt(process.argv[2] || String(MOTHER_SYNC_MAX_DAYS), 10);
const days = Number.isFinite(daysArg) && daysArg >= 1 ? Math.min(MOTHER_SYNC_MAX_DAYS, daysArg) : MOTHER_SYNC_MAX_DAYS;

async function main() {
  if (!token) {
    console.error('缺少 NEZHA_API_TOKEN（backend/.env）');
    process.exit(1);
  }
  console.log(`tenant=${tenantId} days=${days} …`);
  const r = await syncInboxRefreshFromMotherSystem(tenantId, token, days);
  console.log('done', JSON.stringify(r, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
