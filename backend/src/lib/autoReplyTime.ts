/** 解析 `__time__:weekend:18:00-09:00` */
export function parseTimeIntentMatch(intentMatch: string): { preset: string; timeRange: string } | null {
  const prefix = '__time__:';
  if (!intentMatch.startsWith(prefix)) return null;
  const rest = intentMatch.slice(prefix.length);
  const idx = rest.indexOf(':');
  if (idx === -1) return { preset: rest, timeRange: '' };
  return { preset: rest.slice(0, idx), timeRange: rest.slice(idx + 1) };
}

/**
 * 自动回复：时间段是否在「周期 + 时段」内（时段为空则周期内全天）
 */
export function isNowInTimeRange(preset: string, timeRange: string): boolean {
  const now = new Date();
  const day = now.getDay();

  if (preset === 'weekend') {
    if (day !== 0 && day !== 6) return false;
  } else if (preset === 'weekday') {
    if (day === 0 || day === 6) return false;
  }

  if (!timeRange.trim()) return true;

  const [start, end] = timeRange.split('-');
  if (!start?.trim() || !end?.trim()) return true;

  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  if (!Number.isFinite(sH) || !Number.isFinite(eH)) return true;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = sH * 60 + (sM || 0);
  const endMinutes = eH * 60 + (eM || 0);

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
}
