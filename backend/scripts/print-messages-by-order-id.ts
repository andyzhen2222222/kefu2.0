/**
 * 按平台订单号查找会话并打印消息详情（需 NEZHA_API_TOKEN）。
 * 说明：母系统 platform-conversation-message 列表在实测中忽略 conversationId 参数，
 * 需分页扫描全局消息并筛 conversationId（较慢，可用环境变量控制上限）。
 *
 * 用法: npx tsx scripts/print-messages-by-order-id.ts [订单号]
 * 可选: NEZHA_MESSAGE_SCAN_MAX_PAGES=60（默认 60，每页 100 条）
 */
import '../src/load-env.js';
import {
  NEZHA_PLATFORM_CONVERSATION_API,
  NEZHA_PLATFORM_CONVERSATION_MESSAGE_API,
  nezhaPlatformConversationDetailPath,
} from '../src/lib/nezhaEcommercePaths.js';

const MOTHER_SYSTEM_API_URL =
  process.env.MOTHER_SYSTEM_API_URL?.replace(/\/$/, '') ||
  process.env.NEZHA_API_BASE?.replace(/\/$/, '') ||
  'https://tiaojia.nezhachuhai.com';

const tokenRaw = process.env.NEZHA_API_TOKEN?.trim() ?? '';
const TIMEOUT_MS = Math.min(120_000, parseInt(process.env.MOTHER_FETCH_TIMEOUT_MS || '120000', 10) || 120_000);
const SCAN_MAX_PAGES = Math.max(1, Math.min(500, parseInt(process.env.NEZHA_MESSAGE_SCAN_MAX_PAGES || '60', 10) || 60));

function bearer(): string {
  return tokenRaw.startsWith('Bearer ') ? tokenRaw : `Bearer ${tokenRaw}`;
}

async function motherGet(path: string, params: Record<string, string | number | boolean | undefined>) {
  const url = new URL(`${MOTHER_SYSTEM_API_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: bearer(), Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  const json = JSON.parse(text) as { code?: number; data?: unknown; msg?: string };
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path} ${text.slice(0, 300)}`);
  return json;
}

function convMatchesOrder(conv: Record<string, unknown>, orderId: string): boolean {
  const oid = orderId.trim();
  const fields = [
    conv.orderReference,
    conv.platformOrderId,
    conv.originalOrderId,
    conv.ordersId,
    conv.orderSn,
    conv.subject,
  ];
  for (const f of fields) {
    if (f != null && String(f).includes(oid)) return true;
  }
  const order = conv.order;
  if (order && typeof order === 'object') {
    const o = order as Record<string, unknown>;
    for (const x of [o.originalOrderId, o.platformOrderId, o.ordersId, o.orderId, o.id]) {
      if (x != null && String(x).includes(oid)) return true;
    }
  }
  return false;
}

async function findConversationIds(orderId: string): Promise<string[]> {
  const wide = new Date();
  wide.setFullYear(wide.getFullYear() - 2);
  const startTime = wide.toISOString();
  const ids = new Set<string>();

  for (const extra of [{ keyword: orderId }, {}] as const) {
    for (let page = 1; page <= 30; page++) {
      const j = await motherGet(NEZHA_PLATFORM_CONVERSATION_API, {
        page,
        limit: 100,
        startTime,
        updateTime: startTime,
        ...extra,
      });
      if (j.code !== 0) break;
      const list = (j.data as { list?: Record<string, unknown>[] })?.list ?? [];
      for (const c of list) {
        if (convMatchesOrder(c, orderId) && c.id != null) ids.add(String(c.id));
      }
      if (list.length < 100) break;
    }
    if (ids.size > 0) break;
  }
  return [...ids];
}

async function fetchConversationDetail(conversationId: string): Promise<Record<string, unknown> | null> {
  const j = await motherGet(nezhaPlatformConversationDetailPath(conversationId), {});
  const raw = (j as { data?: unknown }).data ?? j;
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

/** 分页扫描全局消息列表，收集属于指定会话的消息（母系统未按 conversationId 过滤） */
async function collectMessagesByScanning(conversationId: string): Promise<Record<string, unknown>[]> {
  const want = String(conversationId);
  const wide = new Date();
  wide.setFullYear(wide.getFullYear() - 2);
  const startTime = wide.toISOString();
  const hits: Record<string, unknown>[] = [];

  for (let page = 1; page <= SCAN_MAX_PAGES; page++) {
    const j = await motherGet(NEZHA_PLATFORM_CONVERSATION_MESSAGE_API, {
      page,
      limit: 100,
      startTime,
      updateTime: startTime,
    });
    if (j.code !== 0) {
      console.error('消息列表 code!=0', j.code, (j as { msg?: string }).msg);
      break;
    }
    const list = (j.data as { list?: Record<string, unknown>[]; totalSize?: number })?.list ?? [];
    for (const m of list) {
      const cid = m.conversationId != null ? String(m.conversationId) : '';
      if (cid === want) hits.push(m);
    }
    if (page % 10 === 0) {
      process.stderr.write(`  已扫消息页 ${page}/${SCAN_MAX_PAGES}，命中 ${hits.length} 条\n`);
    }
    if (list.length < 100) break;
  }

  hits.sort((a, b) => {
    const ta = new Date(String(a.sendAt || a.createAt || 0)).getTime();
    const tb = new Date(String(b.sendAt || b.createAt || 0)).getTime();
    return ta - tb;
  });
  return hits;
}

function summarizeMessage(m: Record<string, unknown>) {
  return {
    id: m.id,
    messageId: m.messageId,
    sendAt: m.sendAt,
    senderType: m.senderType,
    senderNickname: m.senderNickname,
    content: m.content,
    attachments: m.attachments,
  };
}

async function main() {
  const orderId = (process.argv[2] || '').trim();
  if (!orderId) {
    console.error('用法: npx tsx scripts/print-messages-by-order-id.ts <订单号>');
    process.exit(1);
  }
  if (!tokenRaw) {
    console.error('缺少 NEZHA_API_TOKEN');
    process.exit(1);
  }

  console.log('订单号:', orderId);
  console.log('母系统:', MOTHER_SYSTEM_API_URL);
  console.log('消息扫描最多页数:', SCAN_MAX_PAGES, '（可调 NEZHA_MESSAGE_SCAN_MAX_PAGES）');
  console.log('--- 会话 ---\n');

  const convIds = await findConversationIds(orderId);
  if (convIds.length === 0) {
    console.log('未找到关联会话。');
    process.exit(0);
  }

  for (const cid of convIds) {
    const detail = await fetchConversationDetail(cid);
    console.log(JSON.stringify({ conversationId: cid, detail }, null, 2));
    process.stderr.write('--- 拉取该会话消息（分页扫描，可能较慢）---\n');
    const msgs = await collectMessagesByScanning(cid);
    console.log(
      JSON.stringify(
        {
          conversationId: cid,
          messageCount: msgs.length,
          messages: msgs.map(summarizeMessage),
        },
        null,
        2
      )
    );
    if (msgs.length === 0) {
      console.log('（本窗口内未扫到消息，可增大 NEZHA_MESSAGE_SCAN_MAX_PAGES 后重试）');
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
