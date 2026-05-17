import type { Ticket } from '@/src/types';
import { TicketStatus } from '@/src/types';

/** 列表角标展示文案：超过 99 显示 99+ */
export function formatUnreadBadgeCount(count: number): string {
  if (count <= 0) return '';
  if (count > 99) return '99+';
  return String(count);
}

/** 工单在收件箱列表上应展示的未读条数（优先母系统同步值，否则未读态兜底为 1） */
export function resolveTicketUnreadBadgeCount(ticket: Ticket): number {
  const stored = ticket.unreadCount;
  if (typeof stored === 'number' && stored > 0) return stored;
  if (ticket.messageProcessingStatus === 'unread' || ticket.status === TicketStatus.NEW) {
    return 1;
  }
  return 0;
}
