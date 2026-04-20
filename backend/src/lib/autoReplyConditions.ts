import { isNowInTimeRange } from './autoReplyTime.js';
import { ticketIntentMatchesAfterSalesType } from './autoReplyAfterSalesMatch.js';

/** 与前端 `src/lib/autoReplyConditions.ts` 结构一致 */
export type AutoReplyConditionsV1 = {
  v: 1;
  /** 多条件同时启用时：全部满足 / 任一满足 */
  combine: 'and' | 'or';
  time?: { preset: string; start: string; end: string };
  /** 任一子串命中即该条为 true（维度内为「或」） */
  keywords?: string[];
  afterSalesType?: string | null;
  /** 与 ticket.intent 逐字相等 */
  legacyIntent?: string | null;
};

export function isAutoReplyConditionsV1(raw: unknown): raw is AutoReplyConditionsV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  return o.v === 1 && (o.combine === 'and' || o.combine === 'or');
}

export function evaluateAutoReplyConditions(
  raw: unknown,
  ctx: { messageContent: string; ticketIntent: string }
): boolean {
  if (!isAutoReplyConditionsV1(raw)) return false;
  const c = raw;
  const parts: boolean[] = [];

  if (c.time?.preset) {
    const range = `${c.time.start ?? '00:00'}-${c.time.end ?? '23:59'}`;
    parts.push(isNowInTimeRange(c.time.preset, range));
  }
  if (c.keywords && c.keywords.length > 0) {
    const lower = ctx.messageContent.toLowerCase();
    parts.push(c.keywords.some((kw) => lower.includes(String(kw).toLowerCase())));
  }
  if (c.afterSalesType?.trim()) {
    parts.push(ticketIntentMatchesAfterSalesType(ctx.ticketIntent, c.afterSalesType.trim()));
  }
  if (c.legacyIntent?.trim()) {
    parts.push(ctx.ticketIntent.trim() === c.legacyIntent.trim());
  }

  if (parts.length === 0) return false;
  return c.combine === 'and' ? parts.every(Boolean) : parts.some(Boolean);
}
