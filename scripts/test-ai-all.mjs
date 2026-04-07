#!/usr/bin/env node
/**
 * 全系统 AI 接口回归：顺序调用 7 个 POST /api/ai/* + GET /api/ai/audit。
 * 用法：
 *   npm run test:ai
 *   API_BASE=http://127.0.0.1:4000 node scripts/test-ai-all.mjs
 *   API_BASE=http://localhost:4001 npm run test:ai   # 经 Vite 代理
 * 严格模式（要求真实模型、本次请求无 *_fallback 审计项）：
 *   STRICT_AI=1 npm run test:ai
 *
 * 需后端已配置豆包/Gemini；请求头与 prisma seed 默认租户一致。
 */

const BASE = (process.env.API_BASE || 'http://127.0.0.1:4000').replace(/\/$/, '');
const TENANT = process.env.X_TENANT_ID || '11111111-1111-4111-8111-111111111111';
const USER = process.env.X_USER_ID || '22222222-2222-4222-8222-222222222222';

const headers = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'X-Tenant-Id': TENANT,
  'X-User-Id': USER,
};

async function req(method, path, body) {
  const url = `${BASE}${path}`;
  const r = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text.slice(0, 500) };
  }
  return { ok: r.ok, status: r.status, json, text };
}

function fail(name, res) {
  console.error(`\n[FAIL] ${name} HTTP ${res.status}`);
  console.error(JSON.stringify(res.json ?? res.text?.slice(0, 400), null, 2));
  process.exit(1);
}

const STRICT_AI = process.env.STRICT_AI === '1' || process.env.STRICT_AI === 'true';

async function main() {
  console.log(`API_BASE=${BASE}${STRICT_AI ? ' STRICT_AI=1' : ''}`);
  console.log('--- pre: 就绪检查 ---');
  let health = await req('GET', '/health');
  if (!health.ok && health.status === 404) {
    health = await req('GET', '/api/tickets?limit=1');
    if (health.ok) console.log('经 Vite 代理：以 GET /api/tickets 作为就绪信号');
  }
  if (!health.ok) {
    console.error('后端未就绪，请先 cd backend && npm run dev（联调时另开 npm run dev:api）');
    fail('readiness', health);
  }
  if (health.json?.ok !== undefined) console.log('health:', health.json);

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  /** 与 prisma seed-constants SEED.ticket1 一致（保证有消息） */
  const fallbackTicketId = '66666666-6666-4666-8666-666666666666';

  console.log('\n--- GET /api/tickets?limit=50 ---');
  const list = await req('GET', '/api/tickets?limit=50');
  if (!list.ok) fail('list tickets', list);
  const items = list.json?.items ?? [];
  const preferred =
    items.find((t) => t?.id === fallbackTicketId)?.id ||
    items.find((t) => t?.id && uuidRe.test(t.id))?.id;
  let ticketId = preferred;
  if (!ticketId) {
    if (items.length === 0) {
      console.error('库中无工单，请执行 npm run dev:stack 或 backend npm run db:seed');
      process.exit(1);
    }
    ticketId = fallbackTicketId;
    console.warn('列表中无标准 UUID 工单，使用 seed 固定 ticket1:', ticketId);
  } else {
    console.log('ticketId:', ticketId);
  }

  let auditLenBefore = 0;
  if (STRICT_AI) {
    const preAudit = await req('GET', '/api/ai/audit');
    if (!preAudit.ok) fail('audit (before)', preAudit);
    auditLenBefore = (preAudit.json?.items ?? []).length;
    if (preAudit.json?.provider === 'none') {
      console.error('[STRICT_AI] provider=none，请配置 ARK_API_KEY+ep 或 GEMINI_API_KEY 后重试');
      process.exit(1);
    }
  }

  const steps = [
    {
      name: 'POST /api/ai/summarize',
      path: '/api/ai/summarize',
      body: { ticketId },
      check: (j) => typeof j.summary === 'string' && j.summary.length > 0,
    },
    {
      name: 'POST /api/ai/suggest-reply',
      path: '/api/ai/suggest-reply',
      body: { ticketId },
      check: (j) => typeof j.suggestion === 'string' && j.suggestion.length > 0,
    },
    {
      name: 'POST /api/ai/polish',
      path: '/api/ai/polish',
      body: { ticketId, draftText: '测试草稿：请协助查询物流进度，谢谢。' },
      check: (j) => typeof j.polished === 'string' && j.polished.length > 0,
    },
    {
      name: 'POST /api/ai/recognize-after-sales',
      path: '/api/ai/recognize-after-sales',
      body: { buyerFeedback: '物流三天没更新，我要退款', currency: 'USD' },
      check: (j) => j.result && typeof j.result === 'object',
    },
    {
      name: 'POST /api/ai/summarize-messages',
      path: '/api/ai/summarize-messages',
      body: {
        messages: [
          { role: 'system', content: '未读 3、未回复 2、已回复 10。' },
          { role: 'user', content: '用中文给一句今日建议。' },
        ],
      },
      check: (j) => typeof j.summary === 'string' && j.summary.length > 0,
    },
    {
      name: 'POST /api/ai/translate',
      path: '/api/ai/translate',
      body: { text: 'Hello, where is my package?', targetLang: '简体中文' },
      check: (j) => typeof j.translated === 'string' && j.translated.length > 0,
    },
    {
      name: 'POST /api/ai/classify-intent',
      path: '/api/ai/classify-intent',
      body: { ticketId },
      check: (j) => typeof j.intent === 'string' && j.intent.length > 0,
    },
  ];

  for (const s of steps) {
    console.log(`\n--- ${s.name} ---`);
    const res = await req('POST', s.path, s.body);
    if (!res.ok) fail(s.name, res);
    if (!s.check(res.json)) {
      console.error('响应字段不符合预期:', res.json);
      fail(s.name, res);
    }
    const preview = JSON.stringify(res.json).slice(0, 200);
    console.log('OK', preview + (preview.length >= 200 ? '…' : ''));
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log('\n--- GET /api/ai/audit ---');
  const audit = await req('GET', '/api/ai/audit');
  if (!audit.ok) fail('audit', audit);
  console.log('provider:', audit.json?.provider);
  console.log('recent ops:', (audit.json?.items ?? []).slice(-12).map((i) => i.op).join(', '));

  if (audit.json?.provider === 'none') {
    console.warn('\n[WARN] provider=none，未配置 ARK_API_KEY+ep 或 GEMINI_API_KEY，上述 200 可能为回退文案而非真实模型。');
  }

  if (STRICT_AI) {
    const items = audit.json?.items ?? [];
    const newItems = items.slice(auditLenBefore);
    const bad = newItems.filter((i) => typeof i?.op === 'string' && i.op.endsWith('_fallback'));
    if (bad.length > 0) {
      console.error('[STRICT_AI] 本次调用仍产生回退审计项（应走真实模型）：', bad.map((i) => i.op).join(', '));
      process.exit(1);
    }
    if (audit.json?.provider === 'none') {
      process.exit(1);
    }
    console.log('[STRICT_AI] provider=', audit.json.provider, '新增审计条数', newItems.length, '无 *_fallback');
  }

  console.log('\n=== 阶段 A 全部通过 ===');
  console.log('\n阶段 B（浏览器自测清单）：');
  console.log('  1) http://localhost:4001/ 工作台 — AI 效能洞察');
  console.log('  2) 工单详情 — AI 智能生成 / AI 润色 / 自动翻译 / 意图刷新');
  console.log('  3) 提交售后 — AI 自动识别');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
