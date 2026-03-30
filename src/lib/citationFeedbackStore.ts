/**
 * 会话「引用来源」反馈的客户端持久化（localStorage）。
 * 生产环境可将同结构事件上报埋点平台，并由后端回写列表；当前用于打通设置-知识库「引用与反馈」与收件箱弹窗。
 */
export const CITATION_FEEDBACK_STORAGE_KEY = 'edesk_citation_feedback_v1';

export const CITATION_FEEDBACK_CHANGED_EVENT = 'edesk-citation-feedback';

export type CitationFeedbackKind = 'helpful' | 'stale' | 'pending';

export interface StoredCitationFeedback {
  id: string;
  ticketRef: string;
  snippet: string;
  feedback: CitationFeedbackKind;
  /** 展示用日期 YYYY-MM-DD */
  createdAt: string;
  docId?: string;
  messageId?: string;
}

function parseList(raw: string | null): StoredCitationFeedback[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(
      (x): x is StoredCitationFeedback =>
        typeof x === 'object' &&
        x !== null &&
        typeof (x as StoredCitationFeedback).id === 'string' &&
        typeof (x as StoredCitationFeedback).ticketRef === 'string' &&
        typeof (x as StoredCitationFeedback).snippet === 'string' &&
        ['helpful', 'stale', 'pending'].includes((x as StoredCitationFeedback).feedback)
    );
  } catch {
    return [];
  }
}

export function loadStoredCitationFeedback(): StoredCitationFeedback[] {
  if (typeof localStorage === 'undefined') return [];
  return parseList(localStorage.getItem(CITATION_FEEDBACK_STORAGE_KEY));
}

function saveAll(list: StoredCitationFeedback[]) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(CITATION_FEEDBACK_STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(CITATION_FEEDBACK_CHANGED_EVENT));
}

/** 记录一条引用反馈（新记录插到列表最前） */
export function appendStoredCitationFeedback(
  entry: Omit<StoredCitationFeedback, 'id' | 'createdAt'> & {
    createdAt?: string;
  }
): StoredCitationFeedback {
  const id = `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = entry.createdAt ?? new Date().toISOString().slice(0, 10);
  const rec: StoredCitationFeedback = {
    id,
    ticketRef: entry.ticketRef,
    snippet: entry.snippet,
    feedback: entry.feedback,
    createdAt,
    docId: entry.docId,
    messageId: entry.messageId,
  };
  const prev = loadStoredCitationFeedback();
  saveAll([rec, ...prev]);
  return rec;
}

export function removeStoredCitationFeedback(id: string) {
  const next = loadStoredCitationFeedback().filter((x) => x.id !== id);
  saveAll(next);
}
