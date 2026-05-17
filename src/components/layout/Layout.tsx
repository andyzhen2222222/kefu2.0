import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileBottomNav from './MobileBottomNav';
import MobileHeader from './MobileHeader';
import { useIsMobile } from '@/src/hooks/useIsMobile';
import { cn } from '@/src/lib/utils';

export default function Layout() {
  const isMobile = useIsMobile();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 font-sans text-slate-900 antialiased">
      {!isMobile ? <Header /> : <MobileHeader />}
      
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {!isMobile && <Sidebar />}
        <main
          className={cn(
            'min-h-0 flex-1 overflow-y-auto',
            isMobile && 'pb-16 mb-safe text-[15px] leading-relaxed' // 正文略放大，易读
          )}
        >
          <Outlet />
        </main>
      </div>

      {isMobile && <MobileBottomNav />}
    </div>
  );
}
