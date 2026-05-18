import type { Ticket } from '@/src/types';
import { TicketStatus } from '@/src/types';

/** 收件箱/详情：是否视为未读（与列表角标、左滑「标为已读」一致） */
export function isTicketUnreadForList(t: Pick<Ticket, 'messageProcessingStatus' | 'status'>): boolean {
  return t.messageProcessingStatus === 'unread' || t.status === TicketStatus.NEW;
}

/** 切换已读/未读（未读 → 未回复；已读态 → 未读） */
export function buildToggleReadPatch(ticket: Pick<Ticket, 'messageProcessingStatus' | 'status'>): Partial<Ticket> {
  if (isTicketUnreadForList(ticket)) {
    const patch: Partial<Ticket> = {
      messageProcessingStatus: 'unreplied',
      unreadCount: 0,
    };
    if (ticket.status === TicketStatus.NEW) patch.status = TicketStatus.TODO;
    return patch;
  }
  return { messageProcessingStatus: 'unread', unreadCount: 1 };
}

/** 切换已回复/未回复 */
export function buildToggleRepliedPatch(
  ticket: Pick<Ticket, 'messageProcessingStatus'>
): Partial<Ticket> {
  const replied = ticket.messageProcessingStatus === 'replied';
  return { messageProcessingStatus: replied ? 'unreplied' : 'replied' };
}

export function readToggleLabel(ticket: Pick<Ticket, 'messageProcessingStatus' | 'status'>): string {
  return isTicketUnreadForList(ticket) ? '标记已读' : '标记未读';
}

export function repliedToggleLabel(ticket: Pick<Ticket, 'messageProcessingStatus'>): string {
  return ticket.messageProcessingStatus === 'replied' ? '标记未回复' : '标记已回复';
}
