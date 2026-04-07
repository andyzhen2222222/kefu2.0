import { GoogleGenAI } from '@google/genai';

const DOUBAO_DEFAULT_BASE = 'https://ark.cn-beijing.volces.com/api/v3';

export type LlmBackend = 'doubao' | 'gemini' | 'none';

function doubaoEnv() {
  const key =
    process.env.DOUBAO_API_KEY?.trim() || process.env.ARK_API_KEY?.trim() || '';
  const model =
    process.env.DOUBAO_MODEL_ID?.trim() ||
    process.env.DOUBAO_ENDPOINT_ID?.trim() ||
    process.env.ARK_MODEL_ID?.trim() ||
    process.env.ARK_ENDPOINT_ID?.trim() ||
    '';
  const base = (process.env.DOUBAO_BASE_URL || process.env.ARK_BASE_URL || DOUBAO_DEFAULT_BASE).replace(
    /\/$/,
    ''
  );
  return { key, model, base };
}

/** ep- 开头为 Chat Completions 接入点；否则视为模型名，走 Responses API（官方新手示例） */
function useArkResponsesApi(model: string): boolean {
  const mode = (process.env.DOUBAO_API_MODE || process.env.ARK_API_MODE || '').trim().toLowerCase();
  if (mode === 'responses') return true;
  if (mode === 'chat') return false;
  return !model.startsWith('ep-');
}

/**
 * 官方文档：关闭深度思考可配置 `"thinking":{"type":"disabled"}`（降低延迟与费用）。
 * 设为 enabled / on / true / 1 时省略该字段，由方舟使用模型默认行为。
 */
function arkResponsesThinking(): { type: 'disabled' } | undefined {
  const raw = (process.env.ARK_THINKING ?? process.env.DOUBAO_THINKING ?? 'disabled').trim().toLowerCase();
  if (raw === 'enabled' || raw === 'on' || raw === 'true' || raw === '1') return undefined;
  return { type: 'disabled' };
}

function extractArkResponsesText(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as {
    error?: { message?: string; code?: string };
    output?: unknown[];
    output_text?: string;
  };
  if (d.error?.message) {
    throw new Error(d.error.message);
  }
  if (typeof d.output_text === 'string' && d.output_text.trim()) {
    return d.output_text.trim();
  }
  const output = d.output;
  if (!Array.isArray(output) || output.length === 0) return null;
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const it = item as { type?: string; content?: unknown[]; text?: string };
    if (typeof it.text === 'string' && it.text.trim()) {
      chunks.push(it.text.trim());
    }
    if (it.type === 'message' && Array.isArray(it.content)) {
      for (const c of it.content) {
        if (c && typeof c === 'object') {
          const o = c as { type?: string; text?: string };
          if (typeof o.text === 'string' && o.text.trim()) {
            chunks.push(o.text.trim());
          }
        }
      }
    }
  }
  if (chunks.length) return chunks.join('\n').trim();

  const deep: string[] = [];
  const walk = (node: unknown): void => {
    if (node == null) return;
    if (typeof node === 'string' && node.trim()) {
      deep.push(node.trim());
      return;
    }
    if (typeof node !== 'object') return;
    const o = node as Record<string, unknown>;
    if (typeof o.text === 'string' && o.text.trim()) deep.push(o.text.trim());
    for (const key of ['content', 'output', 'parts'] as const) {
      const arr = o[key];
      if (Array.isArray(arr)) for (const x of arr) walk(x);
    }
  };
  for (const item of output) walk(item);
  const s = deep.join('\n').trim();
  return s || null;
}

export function resolveLlmBackend(): LlmBackend {
  const { key, model } = doubaoEnv();
  if (key && model) return 'doubao';
  if (process.env.GEMINI_API_KEY?.trim()) return 'gemini';
  return 'none';
}

export function llmUnconfiguredHint(): string {
  return '未配置 AI：在 backend/.env 设置 ARK_API_KEY（控制台 API Key），并设置 DOUBAO_ENDPOINT_ID：填 ep-… 走 Chat Completions，或填官方模型名（如 doubao-seed-2-0-lite-260215）走 Responses API；详见火山方舟快速入门。也可回退 GEMINI_API_KEY。';
}

async function doubaoChatCompletions(userText: string, options?: { json?: boolean }): Promise<string> {
  const { key, model, base } = doubaoEnv();
  const url = `${base}/chat/completions`;
  const tryOnce = async (withJson: boolean) => {
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: 'user', content: userText }],
    };
    if (withJson) {
      body.response_format = { type: 'json_object' };
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`doubao_http_${res.status}: ${raw.slice(0, 800)}`);
    }
    if (!res.ok) {
      const err = data as { error?: { message?: string } };
      throw new Error(err.error?.message || `doubao_http_${res.status}: ${raw.slice(0, 800)}`);
    }
    const parsed = data as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const text = parsed.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('doubao_empty_response');
    }
    return text.trim();
  };
  if (options?.json) {
    try {
      return await tryOnce(true);
    } catch (e) {
      console.warn('[llm] doubao chat json_mode failed, retry without:', e);
      return tryOnce(false);
    }
  }
  return tryOnce(false);
}

/**
 * 火山方舟 Responses API（与官方 curl 一致）：
 * POST {base}/responses，Authorization: Bearer {ARK_API_KEY}，body: { model, input }，可选 thinking。
 * @see https://www.volcengine.com/docs/82379/2272060
 */
async function doubaoResponses(userText: string, options?: { json?: boolean }): Promise<string> {
  const { key, model, base } = doubaoEnv();
  const url = `${base}/responses`;
  const thinking = arkResponsesThinking();

  const buildBody = (withJsonFormat: boolean): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      model,
      input: userText,
    };
    if (thinking) body.thinking = thinking;
    if (withJsonFormat) {
      body.response_format = { type: 'json_object' };
    }
    return body;
  };

  const tryRequest = async (withJsonFormat: boolean) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(buildBody(withJsonFormat)),
    });
    const raw = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`doubao_http_${res.status}: ${raw.slice(0, 800)}`);
    }
    if (!res.ok) {
      const err = data as { error?: { message?: string } };
      throw new Error(err.error?.message || `doubao_http_${res.status}: ${raw.slice(0, 800)}`);
    }
    return data;
  };

  if (options?.json) {
    try {
      const data = await tryRequest(true);
      const text = extractArkResponsesText(data);
      if (text) return text;
    } catch (e) {
      console.warn('[llm] responses json_object format rejected or empty, retry plain:', e);
    }
  }

  const data = await tryRequest(false);
  const text = extractArkResponsesText(data);
  if (!text) throw new Error('doubao_empty_response');
  return text;
}

async function doubaoComplete(userText: string, options?: { json?: boolean }): Promise<string> {
  const { model } = doubaoEnv();
  if (useArkResponsesApi(model)) {
    return doubaoResponses(userText, options);
  }
  return doubaoChatCompletions(userText, options);
}

async function geminiComplete(userText: string, options?: { json?: boolean }): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY!.trim();
  const ai = new GoogleGenAI({ apiKey });
  const r = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash',
    contents: userText,
    config: options?.json ? { responseMimeType: 'application/json' } : undefined,
  });
  const t = r.text?.trim();
  if (!t) throw new Error('gemini_empty_response');
  return t;
}

/** 单轮文本补全：优先豆包（Responses 或 Chat，按模型 id 自动选），否则 Gemini */
export async function llmComplete(userText: string, options?: { json?: boolean }): Promise<string> {
  const b = resolveLlmBackend();
  if (b === 'doubao') return doubaoComplete(userText, options);
  if (b === 'gemini') return geminiComplete(userText, options);
  throw new Error('llm_not_configured');
}
