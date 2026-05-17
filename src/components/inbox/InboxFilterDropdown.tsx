import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, type LucideIcon } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export type InboxFilterOption = {
  id: string;
  label: string;
  count: number;
};

type InboxFilterDropdownProps = {
  ariaLabel: string;
  shortLabel: string;
  icon: LucideIcon;
  activeHint?: string;
  options: InboxFilterOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  isActive?: boolean;
};

function formatCount(n: number): string {
  if (n > 99) return '99+';
  return String(n);
}

type AnchorRect = { top: number; left: number; width: number };

export default function InboxFilterDropdown({
  ariaLabel,
  shortLabel,
  icon: Icon,
  activeHint,
  options,
  selectedId,
  onSelect,
  isOpen,
  onOpenChange,
  disabled,
  isActive,
}: InboxFilterDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  const updateAnchor = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAnchor({ top: r.bottom, left: r.left, width: r.width });
  };

  useLayoutEffect(() => {
    if (!isOpen) {
      setAnchor(null);
      return;
    }
    updateAnchor();
    window.addEventListener('resize', updateAnchor);
    window.addEventListener('scroll', updateAnchor, true);
    return () => {
      window.removeEventListener('resize', updateAnchor);
      window.removeEventListener('scroll', updateAnchor, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const handleTriggerClick = (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    onOpenChange(!isOpen);
  };

  const menuWidth = typeof window !== 'undefined' ? Math.min(280, window.innerWidth - 16) : 280;
  const menuLeft =
    anchor != null
      ? Math.max(8, Math.min(anchor.left + anchor.width / 2 - menuWidth / 2, window.innerWidth - menuWidth - 8))
      : 8;
  const menuTop = anchor != null ? anchor.top + 6 : 0;

  const portal =
    isOpen && anchor && typeof document !== 'undefined'
      ? createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[200] touch-none bg-slate-900/40"
              aria-label="关闭筛选"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChange(false);
              }}
            />
            <div
              role="listbox"
              aria-label={ariaLabel}
              className="fixed z-[201] overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150"
              style={{ top: menuTop, left: menuLeft, width: menuWidth }}
              onClick={(e) => e.stopPropagation()}
            >
              <ul className="max-h-[min(52vh,20rem)] overflow-y-auto overscroll-contain py-1">
                {options.map((opt) => {
                  const active = opt.id === selectedId;
                  return (
                    <li key={opt.id} role="option" aria-selected={active}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(opt.id);
                          onOpenChange(false);
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-3 text-left text-[14px] transition-colors touch-manipulation',
                          active ? 'bg-blue-50 text-blue-600' : 'text-slate-800 active:bg-slate-50'
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">{opt.label}</span>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                            active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                          )}
                        >
                          {formatCount(opt.count)}
                        </span>
                        {active ? (
                          <Check className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title={activeHint ? `${shortLabel}：${activeHint}` : shortLabel}
        onClick={handleTriggerClick}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          'relative z-[1] flex h-9 shrink-0 touch-manipulation flex-row items-center gap-1.5 rounded-lg px-2.5 transition-colors',
          isOpen && 'bg-slate-100 ring-1 ring-slate-200/80',
          isActive
            ? 'bg-orange-50 text-[#F97316]'
            : 'text-slate-600 active:bg-slate-50',
          disabled && 'cursor-not-allowed opacity-40'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        <span className="text-[13px] font-medium leading-none">{shortLabel}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 opacity-50 transition-transform', isOpen && 'rotate-180')}
          aria-hidden
        />
      </button>
      {portal}
    </>
  );
}
