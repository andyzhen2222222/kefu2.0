const ALLOWED = new Set(['angry', 'anxious', 'neutral', 'joyful']);

/** 将模型输出规范为 Prisma/前端使用的 sentiment 字符串 */
export function normalizeClassifiedSentiment(raw: string): string {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (ALLOWED.has(s)) return s;
  // 常见别名
  if (s === 'joy' || s === 'happy' || s === 'positive') return 'joyful';
  if (s === 'worry' || s === 'urgent' || s === 'impatient') return 'anxious';
  if (s === 'mad' || s === 'rage' || s === 'upset') return 'angry';
  if (s === 'calm' || s === 'ok' || s === 'fine') return 'neutral';
  return 'neutral';
}
