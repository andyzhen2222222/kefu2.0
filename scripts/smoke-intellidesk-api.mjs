#!/usr/bin/env node
/**
 * 工单界面 API 冒烟：阶段 A–H（需后端已启动，默认 http://127.0.0.1:4000）
 * 用法: node scripts/smoke-intellidesk-api.mjs
 * 环境: SMOKE_API_BASE=http://127.0.0.1:4000 SMOKE_MOTHER_TOKEN=xxx（可选，测 inbox 同步）
 */
const BASE = (process.env.SMOKE_API_BASE || 'http://127.0.0.1:4000').replace(/\/$/, '');
const TENANT = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';

const headers = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'X-Tenant-Id': TENANT,
  'X-User-Id': USER,
};

function ok(name, cond, detail = '') {
  const s = cond ? 'OK' : 'FAIL';
  console.log(`[${s}] ${name}${detail ? ` ${detail}` : ''}`);
  return cond;
}

async function main() {
  let failed = 0;
  const run = (name, cond, detail) => {
    if (!ok(name, cond, detail)) failed++;
  };

  // A1 health
  let r = await fetch(`${BASE}/health`).catch(() => null);
  run('A1 GET /health', r?.ok, r ? String(r.status) : 'no response');
  if (!r?.ok) {
    console.error('后端未就绪，请先: cd backend && npm run dev');
    process.exit(1);
  }

  // A1b 按账号登录（与前端登录框联调一致）
  r = await fetch(`${BASE}/api/auth/session-from-account`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ account: 'admin@demo.local' }),
  });
  run('A1b POST /api/auth/session-from-account', r.ok, String(r.status));
  if (!r.ok) {
    console.error('若 404：请确认后端为当前代码并已重启；路由应为 POST /api/auth/session-from-account');
  }

  // A2 list
  r = await fetch(`${BASE}/api/tickets?limit=5`, { headers });
  run('A2 GET /api/tickets', r.ok, String(r.status));
  const listJson = r.ok ? await r.json() : {};
  const items = listJson.items || [];
  run('A2 has items', items.length > 0, `count=${items.length}`);
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const firstUuidTicket = items.find((t) => t?.id && uuidRe.test(t.id));
  const ticketId = firstUuidTicket?.id || items[0]?.id;
  const orderId = (firstUuidTicket || items[0])?.order?.id;

  if (ticketId) {
    r = await fetch(`${BASE}/api/tickets/${ticketId}`, { headers });
    run('A3 GET /api/tickets/:id', r.ok, String(r.status));
    r = await fetch(`${BASE}/api/tickets/${ticketId}/messages?limit=5`, { headers });
    run('A3b GET /api/tickets/:id/messages', r.ok, String(r.status));
  } else {
    run('A3 GET /api/tickets/:id', false, 'no ticket id from seed');
  }

  // B1 PATCH + B2 seats
  r = await fetch(`${BASE}/api/settings/agent-seats`, { headers });
  run('B2 GET /api/settings/agent-seats', r.ok, String(r.status));

  if (ticketId) {
    r = await fetch(`${BASE}/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ priority: 3 }),
    });
    run('B1 PATCH /api/tickets/:id (priority)', r.ok, String(r.status));
  }

  // C messages: internal note then patch/delete
  let internalMsgId = null;
  if (ticketId) {
    r = await fetch(`${BASE}/api/tickets/${ticketId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content: `[smoke] internal ${Date.now()}`,
        senderType: 'agent',
        isInternal: true,
      }),
    });
    run('C1 POST internal message', r.ok, String(r.status));
    if (r.ok) {
      const msg = await r.json();
      internalMsgId = msg.id;
    }
  }

  if (ticketId && internalMsgId) {
    r = await fetch(`${BASE}/api/tickets/${ticketId}/messages/${internalMsgId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ content: `[smoke] edited ${Date.now()}` }),
    });
    run('C2 PATCH internal message', r.ok, String(r.status));

    r = await fetch(`${BASE}/api/tickets/${ticketId}/messages/${internalMsgId}`, {
      method: 'DELETE',
      headers,
    });
    run('C2 DELETE internal message', r.ok || r.status === 204, String(r.status));
  }

  // E orders
  if (orderId) {
    r = await fetch(`${BASE}/api/orders/${orderId}?upstreamEnrich=1`, { headers });
    run('E1 GET /api/orders/:id', r.ok, String(r.status));
  } else {
    run('E1 GET /api/orders/:id', false, 'no order on first ticket');
  }

  // F after-sales
  if (ticketId) {
    r = await fetch(`${BASE}/api/after-sales?ticketId=${encodeURIComponent(ticketId)}`, { headers });
    run('F1 GET /api/after-sales?ticketId=', r.ok, String(r.status));
  }

  // G AI (expect 503 or 502 if no LLM — still "reachable"；需 ticketId 为 UUID)
  if (ticketId && uuidRe.test(ticketId)) {
    r = await fetch(`${BASE}/api/ai/classify-intent`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ticketId }),
    });
    const aiReachable = r.status === 200 || r.status === 503 || r.status === 429 || r.status === 502;
    run('G1 POST /api/ai/classify-intent (reachable)', aiReachable, String(r.status));
  } else {
    run('G1 POST /api/ai/classify-intent', false, 'no UUID ticket in first page (skip)');
  }

  // H sync (optional token)
  const tok = (process.env.SMOKE_MOTHER_TOKEN || '').trim();
  if (tok) {
    r = await fetch(`${BASE}/api/sync/inbox-tickets`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ token: tok, days: 7, runAi: false, aiMax: 1 }),
    });
    run('H1 POST /api/sync/inbox-tickets', r.ok, String(r.status));
  } else {
    console.log('[SKIP] H1 POST /api/sync/inbox-tickets (set SMOKE_MOTHER_TOKEN to test)');
  }

  console.log('\n[D] WebSocket: manual — open devtools on mailbox with live API; URL from intellideskWsUrl()');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
