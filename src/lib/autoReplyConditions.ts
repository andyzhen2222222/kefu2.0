import { routingAfterSalesLabel } from '@/src/lib/routingRuleOptions';

/** 与后端 `AutoReplyConditionsV1` 一致 */
export type AutoReplyConditionsV1 = {
  v: 1;
  combine: 'and' | 'or';
  time?: { preset: string; start: string; end: string };
  keywords?: string[];
  afterSalesType?: string | null;
  legacyIntent?: string | null;
};

export function isAutoReplyConditionsV1(raw: unknown): raw is AutoReplyConditionsV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  return o.v === 1 && (o.combine === 'and' || o.combine === 'or');
}

const PRESET_LABEL: Record<string, string> = {
  weekend: '周末',
  weekday: '工作日',
  daily: '每天',
};

/** 列表/详情用：展示 v1 条件摘要 */
export function describeConditionsV1(c: AutoReplyConditionsV1): string {
  const rel = c.combine === 'and' ? '须同时满足' : '满足任一';
  const parts: string[] = [];
  if (c.time?.preset) {
    const pl = PRESET_LABEL[c.time.preset] ?? c.time.preset;
    parts.push(`时间段「${pl}」${c.time.start}-${c.time.end}`);
  }
  if (c.keywords?.length) {
    parts.push(`关键字「${c.keywords.join('、')}」`);
  }
  if (c.afterSalesType?.trim()) {
    parts.push(`售后类型「${routingAfterSalesLabel(c.afterSalesType.trim())}」`);
  }
  if (c.legacyIntent?.trim()) {
    parts.push(`意图直配「${c.legacyIntent.trim()}」`);
  }
  if (parts.length === 0) return '（无条件）';
  return `${rel}：${parts.join('；')}`;
}

/** 规则行展示：优先 conditionsJson，否则旧版 intentMatch + keywords */
export function describeAutoReplyRuleTrigger(row: {
  conditionsJson?: unknown;
  intentMatch?: string | null;
  keywords?: string[];
}): string {
  if (row.conditionsJson != null && isAutoReplyConditionsV1(row.conditionsJson)) {
    return describeConditionsV1(row.conditionsJson);
  }
  const kws = row.keywords ?? [];
  if (kws.length) return `关键字：${kws.join('、')}`;
  const im = row.intentMatch ?? '';
  if (im.startsWith('__time__:')) {
    const rest = im.slice('__time__:'.length);
    const idx = rest.indexOf(':');
    const t = idx === -1 ? rest : rest.slice(0, idx);
    const times = idx === -1 ? '' : rest.slice(idx + 1);
    const label = PRESET_LABEL[t] ?? t;
    return `时间段：${label}${times ? ` (${times})` : ''}`;
  }
  if (im.startsWith('__after_sales_type__:')) {
    const v = im.slice('__after_sales_type__:'.length);
    return `售后类型：${routingAfterSalesLabel(v)}`;
  }
  if (im) return `意图：${im}`;
  return '—';
}
