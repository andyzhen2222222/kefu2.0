import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';

const DOUBAO_DEFAULT_BASE = 'https://ark.cn-beijing.volces.com/api/v3';

export type FrontendLlmBackend = 'doubao' | 'gemini' | 'none';

function doubaoEnv() {
  const key = (import.meta.env.VITE_DOUBAO_API_KEY ?? '').trim();
  const model =
    (import.meta.env.VITE_DOUBAO_MODEL_ID ?? '').trim() ||
    (import.meta.env.VITE_DOUBAO_ENDPOINT_ID ?? '').trim();
  const base = (import.meta.env.VITE_DOUBAO_BASE_URL || DOUBAO_DEFAULT_BASE).replace(/\/$/, '');
  return { key, model, base };
}

function useArkResponsesApi(model: string): boolean {
  const mode = (import.meta.env.VITE_DOUBAO_API_MODE ?? '').trim().toLowerCase();
  if (mode === 'responses') return true;
  if (mode === 'chat') return false;
  return !model.startsWith('ep-');
}

function extractArkResponsesText(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { error?: { message?: string }; output?: unknown[] };
  if (d.error?.message) {
    throw new Error(d.error.message);
  }
  const output = d.output;
  if (!Array.isArray(output) || output.length === 0) return null;
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const it = item as { type?: string; content?: unknown[] };
    if (it.type === 'message' && Array.isArray(it.content)) {
      for (const c of it.content) {
        if (c && typeof c === 'object' && typeof (c as { text?: string }).text === 'string') {
          chunks.push((c as { text: string }).text);
        }
      }
    }
  }
  const s = chunks.join('\n').trim();
  return s || null;
}

export function resolveFrontendLlmBackend(): FrontendLlmBackend {
  const { key, model } = doubaoEnv();
  if (key && model) return 'doubao';
  const g = (process.env.GEMINI_API_KEY as string | undefined)?.trim();
  if (g) return 'gemini';
  return 'none';
}

async function doubaoChatCompletions(
  userText: string,
  options?: { json?: boolean }
): Promise<string> {
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

async function doubaoResponses(userText: string, _options?: { json?: boolean }): Promise<string> {
  const { key, model, base } = doubaoEnv();
  const url = `${base}/responses`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, input: userText }),
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
  const apiKey = (process.env.GEMINI_API_KEY as string) || '';
  const ai = new GoogleGenAI({ apiKey });
  const model = (import.meta.env.VITE_GEMINI_MODEL ?? '').trim() || 'gemini-3-flash-preview';
  const response: GenerateContentResponse = await ai.models.generateContent({
    model,
    contents: userText,
    config: options?.json ? { responseMimeType: 'application/json' } : undefined,
  });
  const t = response.text?.trim();
  if (!t) throw new Error('gemini_empty_response');
  return t;
}

/**
 * 浏览器直连：优先 VITE_DOUBAO_*（模型名为 doubao-seed-… 时走 /responses，ep-… 走 /chat/completions）。
 * 生产环境建议只用自建后端 /api/ai/*，避免暴露 Key。
 */
export async function frontendLlmComplete(
  prompt: string,
  options?: { json?: boolean }
): Promise<string | null> {
  const b = resolveFrontendLlmBackend();
  try {
    if (b === 'doubao') return await doubaoComplete(prompt, options);
    if (b === 'gemini') return await geminiComplete(prompt, options);
  } catch (e) {
    console.error('frontendLlmComplete:', e);
    return null;
  }
  return null;
}
