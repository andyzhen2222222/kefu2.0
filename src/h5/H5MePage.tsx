import { LogOut, User as UserIcon, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/hooks/useAuth';

function initials(name: string): string {
  const s = name.trim();
  if (!s) return '?';
  const parts = s.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

export default function H5MePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const displayName = user?.name?.trim() || user?.email?.trim() || '未登录';
  const roleLabel =
    user?.role === 'admin'
      ? '管理员'
      : user?.role === 'team_lead'
        ? '主管'
        : user?.role === 'finance'
          ? '财务'
          : user?.role === 'operations'
            ? '运营'
            : '客服';

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-y-contain bg-slate-50">
      <div className="bg-gradient-to-b from-[#F97316] to-[#ea580c] px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <h1 className="text-center text-lg font-bold">我的</h1>
        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold ring-2 ring-white/30">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="h-full w-full rounded-2xl object-cover" />
            ) : (
              initials(displayName)
            )}
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">{displayName}</p>
            <p className="mt-0.5 text-sm text-white/80">{roleLabel}</p>
            {user?.email ? (
              <p className="mt-1 text-xs text-white/70">{user.email}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="-mt-4 flex-1 px-4 pb-4">
        <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
            <UserIcon className="h-5 w-5 shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800">账号</p>
              <p className="truncate text-xs text-slate-500">{user?.id || '—'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium text-red-600 active:bg-red-50"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className="flex-1">退出登录</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-red-300" />
          </button>
        </section>

        <p className="mt-6 text-center text-[11px] text-slate-400">
          IntelliDesk · 哪吒智能客服
        </p>
      </div>
    </div>
  );
}
