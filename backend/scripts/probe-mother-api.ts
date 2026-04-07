/**
 * 探测母系统：店铺、站点语言、VAT、订单、会话、消息、回复接口可达性。
 * 依赖 backend/.env：NEZHA_API_TOKEN（及可选 NEZHA_API_BASE / MOTHER_SYSTEM_API_URL）。
 * 回复：默认 POST 无效会话 ID，仅验证鉴权与路由；勿对生产会话误发。
 * 若需真实试发：设置环境变量 PROBE_REPLY_CONVERSATION_ID 与 PROBE_REPLY_CONFIRM=1。
 */
import '../src/load-env.js';
import {
  NEZHA_PLATFORM_CONVERSATION_API,
  NEZHA_PLATFORM_CONVERSATION_MESSAGE_API,
  nezhaPlatformConversationReplyPath,
} from '../src/lib/nezhaEcommercePaths.js';

const base = (
  process.env.MOTHER_SYSTEM_API_URL?.replace(/\/$/, '') ||
  process.env.NEZHA_API_BASE?.replace(/\/$/, '') ||
  'https://tiaojia.nezhachuhai.com'
).replace(/\/$/, '');

const tokenRaw = process.env.NEZHA_API_TOKEN?.trim() ?? '';
const timeoutMs = Math.max(
  5_000,
  Math.min(120_000, parseInt(process.env.MOTHER_FETCH_TIMEOUT_MS || '60000', 10) || 60_000)
);

function bearer(): string {
  return tokenRaw.startsWith('Bearer ') ? tokenRaw : `Bearer ${tokenRaw}`;
}

async function motherGet(path: string, params?: Record<string, string | number | boolean>): Promise<unknown> {
  const url = new URL(`${base}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: bearer(), Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`non-json ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const snippet = typeof json === 'object' && json && 'message' in json ? String((json as { message?: string }).message) : text.slice(0, 200);
    throw new Error(`HTTP ${res.status} ${path}: ${snippet}`);
  }
  const bizCode = (json as { code?: unknown }).code;
  if (bizCode !== undefined && bizCode !== 0 && bizCode !== '0') {
    const msg =
      typeof json === 'object' && json && 'message' in json ? String((json as { message?: string }).message) : text.slice(0, 200);
    throw new Error(`business code=${String(bizCode)} ${path}: ${msg}`);
  }
  return json;
}

async function motherPost(path: string, body: Record<string, unknown>): Promise<{ status: number; json: unknown }> {
  const url = `${base}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: bearer(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    json = { _raw: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

function summarizeListPayload(label: string, data: unknown): string {
  if (!data || typeof data !== 'object') return `${label}: (no data object)`;
  const d = data as Record<string, unknown>;
  const list = d.list;
  const total = d.totalSize ?? d.total;
  if (Array.isArray(list)) return `${label}: list.length=${list.length}, totalSize=${total ?? 'n/a'}`;
  if (Array.isArray(d.records)) return `${label}: records.length=${d.records.length}, totalSize=${total ?? 'n/a'}`;
  return `${label}: keys=${Object.keys(d).join(',')}`;
}

function codeLine(j: unknown): string {
  if (!j || typeof j !== 'object') return 'code=?';
  const c = (j as { code?: unknown }).code;
  const m = (j as { message?: unknown }).message;
  return `code=${String(c)}${m != null ? ` message=${String(m).slice(0, 80)}` : ''}`;
}

async function main() {
  if (!tokenRaw) {
    console.error('缺少 NEZHA_API_TOKEN：请在 backend/.env 配置后重试。');
    process.exit(1);
  }

  console.log('Mother base:', base);
  console.log('Timeout ms:', timeoutMs);
  console.log('---');

  const startTime = new Date(Date.now() - 90 * 86400000).toISOString();

  // 1) 店铺
  try {
    const j = (await motherGet('/v1/api/ecommerce/auth-platform-shop', { page: 1, limit: 3 })) as Record<
      string,
      unknown
    >;
    console.log('[店铺] OK', codeLine(j), '|', summarizeListPayload('data', j.data));
  } catch (e) {
    console.log('[店铺] FAIL', e instanceof Error ? e.message : e);
  }

  // 2) 站点语言 / 货币（platform-site）
  try {
    const j = (await motherGet('/v1/api/biz/platform-site/all', {})) as Record<string, unknown>;
    const data = j.data;
    const n = Array.isArray(data) ? data.length : data && typeof data === 'object' ? Object.keys(data as object).length : 0;
    console.log('[站点语言/站点] OK', codeLine(j), '| data entries ~', n);
  } catch (e) {
    console.log('[站点语言/站点] FAIL', e instanceof Error ? e.message : e);
  }

  // 3) VAT
  try {
    const j = (await motherGet('/v1/api/ecommerce/vat-info/page', { page: 1, limit: 3 })) as Record<string, unknown>;
    console.log('[VAT] OK', codeLine(j), '|', summarizeListPayload('data', j.data));
  } catch (e) {
    console.log('[VAT] FAIL', e instanceof Error ? e.message : e);
  }

  // 4) 订单
  try {
    const j = (await motherGet('/v1/api/ecommerce/platform-order', {
      page: 1,
      limit: 3,
      startTime,
    })) as Record<string, unknown>;
    console.log('[订单] OK', codeLine(j), '|', summarizeListPayload('data', j.data));
  } catch (e) {
    console.log('[订单] FAIL', e instanceof Error ? e.message : e);
  }

  // 5) 会话
  let firstConvId: string | null = null;
  try {
    const j = (await motherGet(NEZHA_PLATFORM_CONVERSATION_API, {
      page: 1,
      limit: 3,
      startTime,
    })) as Record<string, unknown>;
    const list = (j.data as { list?: unknown[] } | undefined)?.list;
    if (Array.isArray(list) && list[0] && typeof list[0] === 'object') {
      const id = (list[0] as { id?: unknown }).id;
      if (id != null) firstConvId = String(id);
    }
    console.log('[会话] OK', codeLine(j), '|', summarizeListPayload('data', j.data));
  } catch (e) {
    console.log('[会话] FAIL', e instanceof Error ? e.message : e);
  }

  // 6) 消息（仅 /v1/api，与 motherSystemSync 一致）
  try {
    const j = (await motherGet(NEZHA_PLATFORM_CONVERSATION_MESSAGE_API, {
      page: 1,
      limit: 3,
      startTime,
    })) as Record<string, unknown>;
    console.log('[消息] OK', codeLine(j), '|', summarizeListPayload('data', j.data));
  } catch (e) {
    console.log('[消息] FAIL', e instanceof Error ? e.message : e);
  }

  // 7) 回写回复
  const confirm = process.env.PROBE_REPLY_CONFIRM === '1';
  const envId = process.env.PROBE_REPLY_CONVERSATION_ID?.trim();
  const probeId = confirm && envId ? envId : '00000000-0000-0000-0000-000000000001';

  if (confirm && envId) {
    const { status, json } = await motherPost(nezhaPlatformConversationReplyPath(probeId), {
      content: '[IntelliDesk API 探测] 请忽略',
    });
    console.log('[回复 POST 真实 ID?]', 'status=', status, codeLine(json));
  } else {
    const { status, json } = await motherPost(nezhaPlatformConversationReplyPath(probeId), {
      content: '[probe]',
    });
    console.log('[回复 POST 探测]', 'invalid-id=', probeId, 'status=', status, codeLine(json));
    if (!envId) {
      console.log('      （未设置 PROBE_REPLY_CONVERSATION_ID；首条会话 id=', firstConvId ?? '无', '）');
    }
    console.log('      真实试发：PROBE_REPLY_CONVERSATION_ID=<id> PROBE_REPLY_CONFIRM=1 npx tsx scripts/probe-mother-api.ts');
  }

  console.log('--- done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
