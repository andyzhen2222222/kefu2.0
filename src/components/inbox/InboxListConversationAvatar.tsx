import { formatUnreadBadgeCount } from '@/src/lib/unreadBadge';
import { cn } from '@/src/lib/utils';

function avatarInitial(buyerName: string): string {
  const trimmed = buyerName.trim();
  if (!trimmed) return '买';
  const first = [...trimmed][0] ?? '?';
  return first.toUpperCase();
}

type Props = {
  buyerName: string;
  unreadCount: number;
  className?: string;
};

/** 收件箱会话头像：买家首字 + 微信式未读数红点 */
export function InboxListConversationAvatar({
  buyerName,
  unreadCount,
  className,
}: Props) {
  const badgeText = formatUnreadBadgeCount(unreadCount);
  const showBadge = badgeText.length > 0;

  return (
    <div className={cn('relative h-11 w-11 shrink-0', className)}>
      <div
        className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-[15px] font-semibold text-slate-600 shadow-sm ring-1 ring-black/5"
        title={buyerName}
      >
        {avatarInitial(buyerName)}
      </div>
      {showBadge ? (
        <span
          className="absolute -right-1 -top-1 z-[2] flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-[#FA5151] px-1 text-[10px] font-semibold leading-none text-white tabular-nums shadow-sm"
          aria-label={`${unreadCount} 条未读`}
        >
          {badgeText}
        </span>
      ) : null}
    </div>
  );
}
