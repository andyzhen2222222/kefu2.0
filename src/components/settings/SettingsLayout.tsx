import { NavLink, Outlet } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/hooks/useAuth';
import { filterSettingsNav } from './settingsNavConfig';

export default function SettingsLayout() {
  const { user } = useAuth();
  const visibleItems = filterSettingsNav(user?.role);
  const isAdmin = user?.role === 'admin';

  return (
    <div className="flex w-full min-h-full bg-slate-50">
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 min-h-full">
        <div className="p-6 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">系统设置</h2>
          <p className="text-xs text-slate-500 mt-1">管理系统规则与基础数据</p>
          {isAdmin && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200/80">
              <Shield className="w-3.5 h-3.5 text-amber-700 shrink-0" strokeWidth={2.5} />
              <span className="text-[11px] font-bold text-amber-900 leading-tight">管理员视图</span>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm',
                  isActive ? 'bg-orange-50 text-[#F97316]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                )
              }
            >
              <item.icon className="w-4 h-4" strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex-1 min-w-0 min-h-full flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
