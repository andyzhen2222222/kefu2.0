import { cn } from '@/src/lib/utils';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

/** 与正式环境一致的轨道式开关 */
export default function ToggleSwitch({
  checked,
  onChange,
  disabled,
  id,
  'aria-label': ariaLabel,
  className,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-[#F97316]' : 'bg-slate-200',
        className
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'left-[18px]' : 'left-0.5'
        )}
      />
    </button>
  );
}
