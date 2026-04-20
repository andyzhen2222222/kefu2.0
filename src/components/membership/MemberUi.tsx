import { CreditCard, Lock, Sparkles } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { MEMBERSHIP_UPGRADE_URL } from '@/src/lib/membership';

export function MembershipStatusPill({
  isMember,
  className,
}: {
  isMember: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold',
        isMember
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700',
        className
      )}
    >
      {isMember ? <Sparkles className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
      {isMember ? '会员' : '非会员'}
    </span>
  );
}

export function MemberOnlyBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700',
        className
      )}
    >
      <Lock className="h-3 w-3" />
      会员功能
    </span>
  );
}

export function UpgradeLink({
  className,
  label = '开通会员',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <a
      href={MEMBERSHIP_UPGRADE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1 rounded-lg bg-[#F97316] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-orange-600',
        className
      )}
    >
      <CreditCard className="h-3.5 w-3.5" />
      {label}
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
      <div className={cn('flex items-start justify-between gap-3', compact && 'items-center')}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MemberOnlyBadge />
            <p className={cn('font-bold', compact ? 'text-xs' : 'text-sm')}>{title}</p>
          </div>
          <p className={cn('mt-1 leading-relaxed text-amber-900/90', compact ? 'text-[11px]' : 'text-xs')}>
            {description}
          </p>
        </div>
        <UpgradeLink className="shrink-0" />
      </div>
    </div>
  );
}
