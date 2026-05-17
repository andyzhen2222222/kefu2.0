import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import H5TabBar from '@/src/h5/components/H5TabBar';

/** 工单详情全屏时隐藏底栏，避免与输入条冲突 */
function shouldHideTabBar(pathname: string): boolean {
  return /^\/ticket\/[^/]+/.test(pathname);
}

export default function H5Shell() {
  const { pathname } = useLocation();
  const hideTabBar = shouldHideTabBar(pathname);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <main
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden',
          !hideTabBar && 'pb-[calc(4rem+env(safe-area-inset-bottom,0px))]'
        )}
      >
        <Outlet />
      </main>
      {!hideTabBar ? <H5TabBar /> : null}
    </div>
  );
}
