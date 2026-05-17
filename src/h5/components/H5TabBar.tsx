import { NavLink, useLocation } from 'react-router-dom';
import { BarChart3, Headphones, User } from 'lucide-react';
import { cn } from '@/src/lib/utils';

const tabs = [
  { path: '/bi', label: 'BI', icon: BarChart3, end: true as const },
  { path: '/inbox', label: '客服', icon: Headphones },
  { path: '/me', label: '我的', icon: User, end: true as const },
] as const;

function isInboxTabActive(pathname: string): boolean {
  return pathname === '/inbox' || pathname.startsWith('/ticket/');
}

export default function H5TabBar() {
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex h-[calc(4rem+env(safe-area-inset-bottom,0px))] min-h-16 items-stretch justify-around border-t border-slate-200 bg-white/95 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-sm supports-[backdrop-filter]:bg-white/90"
      aria-label="主导航"
    >
      {tabs.map((tab) => {
        const active =
          tab.path === '/inbox' ? isInboxTabActive(pathname) : tab.end
            ? pathname === tab.path
            : pathname.startsWith(tab.path);

        return (
          <NavLink
            key={tab.path}
            to={tab.path}
            end={'end' in tab ? tab.end : false}
            className={() =>
              cn(
                'flex min-h-[3.25rem] min-w-[3.25rem] flex-1 max-w-[5.5rem] flex-col items-center justify-center gap-0.5 rounded-xl transition-colors active:scale-[0.97]',
                active ? 'text-[#F97316]' : 'text-slate-400 active:bg-slate-50'
              )
            }
          >
            <tab.icon className="h-6 w-6 shrink-0" strokeWidth={active ? 2.25 : 2} />
            <span className="text-[10px] font-semibold leading-none">{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
