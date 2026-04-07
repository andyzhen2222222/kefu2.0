import type { Message } from '@/src/types';

export type MessageSenderLabelOptions = {
  /** 无具体 senderId 时（如同步为 Agent/客服），用当前工单坐席展示名 */
  agentSeatDisplayName?: string | null;
};

/** 气泡标题：同步默认 senderId 为 Agent/Buyer 时改为中文；坐席消息可回落为坐席名 */
export function messageSenderLabel(
  m: Pick<Message, 'senderType' | 'senderId'>,
  options?: MessageSenderLabelOptions
): string {
  const id = (m.senderId ?? '').trim();
  const seat = options?.agentSeatDisplayName?.trim();
  switch (m.senderType) {
    case 'ai':
      return 'AI 助手';
    case 'system':
      return '系统';
    case 'customer':
      if (!id || id === 'Buyer' || id === '买家') return '客户';
      return id;
    case 'manager':
      return id || '平台信息';
    case 'agent':
      if (!id || id === 'Agent' || id === 'agent' || id === '客服') {
        return seat || '客服';
      }
      return id;
    default:
      return id || '未知';
  }
}

/**
 * 将母系统/邮件同步里常见的 HTML 片段转为纯文本（用于气泡内展示，避免 XSS）。
 * - br / 块级闭合标签 → 换行
 * - 其余标签剥离
 * - 常见 HTML 实体解码
 */
export function htmlishMessageToPlainText(raw: string): string {
  if (!raw) return '';
  let s = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|tr|table|h[1-6])\s*>/gi, '\n');
  s = s.replace(/<\/(li|td|th)\s*>/gi, '\n');

  s = s.replace(/<\/?[a-zA-Z][a-zA-Z0-9:-]*(?:\s[^>]*)?>/g, '');

  s = s.replace(/&nbsp;/gi, ' ');
  s = s.replace(/&#x([0-9a-f]{1,8});/gi, (_, h) => {
    const n = parseInt(h, 16);
    try {
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    } catch {
      return _;
    }
  });
  s = s.replace(/&#(\d{1,7});/g, (_, d) => {
    const n = Number(d);
    try {
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    } catch {
      return _;
    }
  });
  s = s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  s = s.replace(/&amp;/g, '&');

  return s;
}
