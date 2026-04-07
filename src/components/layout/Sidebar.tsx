import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Inbox, 
  Settings, 
  FileText,
  Clock,
  MessageSquare,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: '工作台', path: '/' },
  { icon: Inbox, label: '工单', path: '/mailbox' },
  { icon: RotateCcw, label: '售后管理', path: '/after-sales' },
  { icon: Settings, label: '设置', path: '/settings' },
];

export default function Sidebar() {
  return (
    <aside className="w-[64px] bg-white flex flex-col h-full items-center py-4 border-r border-slate-200 shrink-0">
      <nav className="flex-1 flex flex-col gap-4 w-full px-2 mt-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={item.label}
            className={({ isActive }) => {
              const isSettingsActive = item.path === '/settings' && window.location.pathname.startsWith('/settings');
              const isMailboxActive = item.label === '工单' && window.location.pathname.startsWith('/mailbox');
              return cn(
              "flex items-center justify-center w-12 h-12 rounded-xl transition-all group relative",
              isActive || isSettingsActive || isMailboxActive
                ? "bg-orange-50 text-[#F97316]" 
                : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
            )}}
          >
            <item.icon className="w-[22px] h-[22px]" strokeWidth={2} />
            
            {/* Tooltip */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
              {item.label}
            </div>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
