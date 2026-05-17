import { cn } from '@/src/lib/utils';
import { H5_SAFE_BOTTOM, H5_TAB_BOTTOM_BAR } from '@/src/h5/h5UiSpec';

type H5TabBottomBarProps = {
  children: React.ReactNode;
  className?: string;
};

/** 工单详情业务 Tab 底部主操作区（会话 Tab 使用 H5ComposerBar） */
export default function H5TabBottomBar({ children, className }: H5TabBottomBarProps) {
  if (!children) return null;

  return (
    <div
      className={cn(
        H5_TAB_BOTTOM_BAR,
        H5_SAFE_BOTTOM,
        'space-y-2 px-3 pt-2',
        className
      )}
    >
      {children}
    </div>
  );
}
