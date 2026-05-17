/**
 * AI 润色方案（localStorage），供工单回复「AI 润色」与设置页管理共用。
 */

const STORAGE_KEY = 'intellidesk.ai_polish_presets.v1';
const STORAGE_EVENT = 'intellidesk-ai-polish-presets-changed';

export type AiPolishPreset = {
  id: string;
  name: string;
  hint: string;
  /** 注入润色 Prompt 的语气/风格说明（中文为主） */
  prompt: string;
  enabled: boolean;
  /** 内置方案可编辑提示词，不可删除 */
  builtin?: boolean;
  sortOrder: number;
  updatedAt: string;
};

const DEFAULT_PRESETS: AiPolishPreset[] = [
  {
    id: 'builtin:auto',
    name: '自动（依情境）',
    hint: '由模型按工单与对话选最合适语气',
    prompt:
      '【语气】请根据工单主题与客户近期表述自动选择合适语气。若情境不够明确，则：请使用友好的语气，简洁且不失温暖。',
    enabled: true,
    builtin: true,
    sortOrder: 0,
    updatedAt: '2026-05-16',
  },
  {
    id: 'builtin:warm_friendly',
    name: '温馨友好',
    hint: '日常咨询与一般安抚，亲切不煽情',
    prompt: '【语气】温馨友好：日常咨询与一般安抚；亲切、有同理心，避免生硬套话，不过度煽情。',
    enabled: true,
    builtin: true,
    sortOrder: 1,
    updatedAt: '2026-05-16',
  },
  {
    id: 'builtin:professional_formal',
    name: '专业正式',
    hint: '技术/账户/规则与流程，客观可核对',
    prompt:
      '【语气】专业正式：技术说明、账户/订单规则、流程与权限；客观、准确、可核对，少用口语与表情化表达。',
    enabled: true,
    builtin: true,
    sortOrder: 2,
    updatedAt: '2026-05-16',
  },
  {
    id: 'builtin:concise_clear',
    name: '简洁干练',
    hint: '结论与下一步为主，少客套少重复',
    prompt: '【语气】简洁干练：只保留结论、关键事实与下一步动作；短句为主，删冗余客套与重复信息。',
    enabled: true,
    builtin: true,
    sortOrder: 3,
    updatedAt: '2026-05-16',
  },
  {
    id: 'builtin:apologetic',
    name: '诚恳致歉',
    hint: '我方疏失或体验不佳时道歉与补救',
    prompt:
      '【语气】诚恳致歉：承认我方疏失、延误或体验不佳；真诚道歉并给出可执行的补救或明确跟进，不辩解、不甩锅。',
    enabled: true,
    builtin: true,
    sortOrder: 4,
    updatedAt: '2026-05-16',
  },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function normalizePreset(raw: unknown, index: number): AiPolishPreset | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? '').trim();
  const name = String(o.name ?? '').trim();
  const prompt = String(o.prompt ?? '').trim();
  if (!id || !name || !prompt) return null;
  return {
    id,
    name,
    hint: String(o.hint ?? '').trim(),
    prompt,
    enabled: o.enabled !== false,
    builtin: o.builtin === true,
    sortOrder: typeof o.sortOrder === 'number' ? o.sortOrder : index,
    updatedAt: String(o.updatedAt ?? todayStr()),
  };
}

function mergeWithDefaults(stored: AiPolishPreset[]): AiPolishPreset[] {
  const byId = new Map(stored.map((p) => [p.id, p]));
  const builtins = DEFAULT_PRESETS.map((def) => {
    const existing = byId.get(def.id);
    if (!existing) return { ...def };
    return {
      ...def,
      name: existing.name || def.name,
      hint: existing.hint ?? def.hint,
      prompt: existing.prompt || def.prompt,
      enabled: existing.enabled,
      updatedAt: existing.updatedAt,
    };
  });
  const customs = stored
    .filter((p) => !p.builtin && !DEFAULT_PRESETS.some((d) => d.id === p.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return [...builtins, ...customs].map((p, i) => ({ ...p, sortOrder: i }));
}

export function loadAiPolishPresets(): AiPolishPreset[] {
  if (typeof window === 'undefined') return [...DEFAULT_PRESETS];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return mergeWithDefaults([]);
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return mergeWithDefaults([]);
    const stored = parsed
      .map((item, i) => normalizePreset(item, i))
      .filter((p): p is AiPolishPreset => p != null);
    return mergeWithDefaults(stored);
  } catch {
    return mergeWithDefaults([]);
  }
}

export function persistAiPolishPresets(presets: AiPolishPreset[]): void {
  if (typeof window === 'undefined') return;
  const normalized = presets.map((p, i) => ({ ...p, sortOrder: i, updatedAt: p.updatedAt || todayStr() }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT));
}

export function subscribeAiPolishPresets(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => onChange();
  window.addEventListener(STORAGE_EVENT, handler);
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) handler();
  });
  return () => window.removeEventListener(STORAGE_EVENT, handler);
}

export function getEnabledPolishPresets(): AiPolishPreset[] {
  return loadAiPolishPresets().filter((p) => p.enabled);
}

export function getPolishPresetById(id: string): AiPolishPreset | undefined {
  return loadAiPolishPresets().find((p) => p.id === id);
}

export function getDefaultBuiltinPolishPreset(id: string): AiPolishPreset | undefined {
  return DEFAULT_PRESETS.find((p) => p.id === id);
}

export function newPolishPresetId(): string {
  return `polish-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function resetBuiltinPolishPreset(id: string): AiPolishPreset[] {
  const def = DEFAULT_PRESETS.find((p) => p.id === id);
  if (!def) return loadAiPolishPresets();
  const next = loadAiPolishPresets().map((p) => (p.id === id ? { ...def, enabled: p.enabled } : p));
  persistAiPolishPresets(next);
  return next;
}

/** 供设置页展示默认提示词对照 */
export { DEFAULT_PRESETS as AI_POLISH_BUILTIN_DEFAULTS };
