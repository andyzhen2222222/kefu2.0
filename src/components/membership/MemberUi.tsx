import { CircleDollarSign, Lock, Sparkles } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { MEMBERSHIP_UPGRADE_URL, PAID_FEATURE_HINT } from '@/src/lib/membership';

export function MembershipStatusPill({
  isMember,
  className,
}: {
  isMember: boolean;
  className?: string;
}) {
  return (
    <span
      title={PAID_FEATURE_HINT}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold',
        isMember
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700',
        className
      )}
    >
      {isMember ? <Sparkles className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
      {isMember ? '已付' : '未付'}
    </span>
  );
}

export function MemberOnlyBadge({ className }: { className?: string }) {
  return (
    <span
      title={PAID_FEATURE_HINT}
      aria-label={PAID_FEATURE_HINT}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700',
        className
      )}
    >
      <Lock className="h-3 w-3" />
      付费标识
    </span>
  );
}

export type PaidFeatureLinkTone = 'default' | 'manager' | 'ai' | 'customer';

/** 跳转订阅页；仅图标，悬停显示「付费功能」 */
export function UpgradeLink({
  className,
  tone = 'default',
  iconClassName,
}: {
  className?: string;
  tone?: PaidFeatureLinkTone;
  iconClassName?: string;
}) {
  const toneClass: Record<PaidFeatureLinkTone, string> = {
    default:
      'border-amber-300 bg-white text-amber-700 hover:border-amber-400 hover:bg-amber-50 shadow-sm',
    manager: 'border-amber-300/90 bg-amber-100 text-amber-900 hover:bg-amber-200',
    ai: 'border-white/30 bg-white/15 text-white hover:bg-white/25',
    customer: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100',
  };

  return (
    <a
      href={MEMBERSHIP_UPGRADE_URL}
      target="_blank"
      rel="noopener noreferrer"
      title={PAID_FEATURE_HINT}
      aria-label={PAID_FEATURE_HINT}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md border p-1 transition-colors',
        toneClass[tone],
        className
      )}
    >
      <CircleDollarSign className={cn('h-3.5 w-3.5', iconClassName)} aria-hidden />
    </a>
  );
}

export function LockedFeatureNotice({
  title,
  description,
  className,
  compact = false,
}: {
  title: string;
  description: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-amber-200 bg-amber-50 text-amber-950',
        compact ? 'px-3 py-2' : 'px-4 py-3',
        className
      )}
    >
      <div className={cn('flex items-start justify-start gap-1.5', compact && 'items-center')}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn('font-bold', compact ? 'text-xs' : 'text-sm')}>{title}</p>
          </div>
          <p className={cn('mt-1 leading-relaxed text-amber-900/90', compact ? 'text-[11px]' : 'text-xs')}>
            {description}
          </p>
        </div>
        <UpgradeLink className="shrink-0 p-1.5 mt-0.5" />
      </div>
    </div>
  );
}
