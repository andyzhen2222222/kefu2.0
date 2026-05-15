import { NavLink, Outlet } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/hooks/useAuth';
import { filterSettingsNav } from './settingsNavConfig';
import { useIsMobile } from '@/src/hooks/useIsMobile';

export default function SettingsLayout() {
  const { user } = useAuth();
  const visibleItems = filterSettingsNav(user?.role);
  const isAdmin = user?.role === 'admin';
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="flex min-h-full min-w-0 flex-col bg-slate-50">
        <div className="border-b border-slate-200 bg-white px-4 py-3">
          <h2 className="text-base font-bold tracking-tight text-slate-900">系统设置</h2>
          <p className="mt-0.5 text-[12px] leading-snug text-slate-500">规则、模版与基础数据</p>
          {isAdmin && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200/80 bg-amber-50 px-2.5 py-1.5">
              <Shield className="h-3.5 w-3.5 shrink-0 text-amber-700" strokeWidth={2.5} />
              <span className="text-[11px] font-semibold leading-tight text-amber-900">管理员</span>
            </div>
          )}
        </div>
        <nav
          className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="设置分区"
        >
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'shrink-0 whitespace-nowrap rounded-full border px-3 py-2 text-[12px] font-semibold transition-colors active:scale-[0.98]',
                  isActive
                    ? 'border-orange-200 bg-orange-50 text-[#F97316]'
                    : 'border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-h-0 min-w-0 flex-1 px-4 pb-8 pt-2">
          <Outlet />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full w-full bg-slate-50">
      <div className="flex min-h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-6 pb-4">
          <h2 className="text-lg font-bold text-slate-900">系统设置</h2>
          <p className="mt-1 text-xs text-slate-500">管理系统规则与基础数据</p>
          {isAdmin && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2">
              <Shield className="h-3.5 w-3.5 shrink-0 text-amber-700" strokeWidth={2.5} />
              <span className="text-[11px] font-bold leading-tight text-amber-900">管理员视图</span>
            </div>
          )}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all',
                  isActive ? 'bg-orange-50 text-[#F97316]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )
              }
            >
              <item.icon className="h-4 w-4" strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex min-h-full min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
