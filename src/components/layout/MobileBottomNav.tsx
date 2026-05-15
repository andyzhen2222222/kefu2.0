import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Inbox, RotateCcw, User } from 'lucide-react';
import { cn } from '@/src/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: '工作台', path: '/', end: true },
  { icon: Inbox, label: '消息', path: '/mailbox' },
  { icon: RotateCcw, label: '售后', path: '/after-sales' },
  { icon: User, label: '我的', path: '/settings' },
] as const;

export default function MobileBottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex h-[calc(4rem+env(safe-area-inset-bottom,0px))] min-h-16 items-stretch justify-around border-t border-slate-200 bg-white/95 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-sm supports-[backdrop-filter]:bg-white/90"
      aria-label="主导航"
    >
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={'end' in item ? item.end : false}
          className={({ isActive }) =>
            cn(
              'flex min-h-[3.25rem] min-w-[3.25rem] flex-1 max-w-[5.5rem] flex-col items-center justify-center gap-0.5 rounded-xl transition-colors active:scale-[0.97]',
              isActive ? 'text-[#F97316]' : 'text-slate-400 active:bg-slate-50'
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon className="h-6 w-6 shrink-0" strokeWidth={isActive ? 2.25 : 2} />
              <span className="text-[10px] font-semibold leading-none">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
