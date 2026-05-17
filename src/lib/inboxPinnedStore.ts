const STORAGE_KEY = 'intellidesk_inbox_pinned_v1';

function readRaw(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function loadInboxPinnedIds(): Set<string> {
  return new Set(readRaw());
}

export function saveInboxPinnedIds(ids: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function toggleInboxPinned(ticketId: string): Set<string> {
  const next = loadInboxPinnedIds();
  if (next.has(ticketId)) next.delete(ticketId);
  else next.add(ticketId);
  saveInboxPinnedIds(next);
  return next;
}
