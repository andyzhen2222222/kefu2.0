import { useState, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Edit2, Shield, UserCog, GitBranch, Check, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { AgentSeat, CustomRole } from '@/src/types';
import { useAuth } from '@/src/hooks/useAuth';
import TicketRoutingRulesBlock from './TicketRoutingRulesBlock';
import { getDefaultSettingsPath } from './settingsNavConfig';
import { DEMO_AGENT_SEATS_INITIAL } from '@/src/data/demoAgentSeats';

const PERMISSION_PRESETS: { key: string; label: string }[] = [
  { key: 'inbox.view', label: '收件箱查看' },
  { key: 'inbox.reply', label: '会话回复与发送' },
  { key: 'after_sales', label: '售后工单' },
  { key: 'orders.view', label: '订单查看' },
  { key: 'settings.read', label: '设置只读' },
  { key: 'settings.write', label: '设置编辑' },
];

const INITIAL_ROLES: CustomRole[] = [
  {
    id: 'role-admin',
    name: '管理员',
    description: '全功能，含坐席与分配规则配置',
    permissionKeys: PERMISSION_PRESETS.map((p) => p.key),
  },
  {
    id: 'role-agent',
    name: '一线客服',
    description: '处理收件箱与售后，无组织设置权限',
    permissionKeys: ['inbox.view', 'inbox.reply', 'after_sales', 'orders.view'],
  },
];

const STEPS = [
  { n: 1 as const, label: '创建角色', icon: Shield },
  { n: 2 as const, label: '创建坐席', icon: UserCog },
  { n: 3 as const, label: '工单分配', icon: GitBranch },
];

export default function SeatsAndRolesPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const step: 1 | 2 | 3 = useMemo(() => {
    const s = searchParams.get('step');
    if (s === '2') return 2;
    if (s === '3') return 3;
    return 1;
  }, [searchParams]);

  const setStep = (n: 1 | 2 | 3) => {
    if (n === 1) setSearchParams({});
    else setSearchParams({ step: String(n) });
  };

  const [roles, setRoles] = useState<CustomRole[]>(INITIAL_ROLES);
  const [seats, setSeats] = useState<AgentSeat[]>(DEMO_AGENT_SEATS_INITIAL);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [seatModalOpen, setSeatModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [roleForm, setRoleForm] = useState({ name: '', description: '', permissionKeys: [] as string[] });
  const [seatForm, setSeatForm] = useState({
    displayName: '',
    email: '',
    account: '',
    password: '',
    roleId: INITIAL_ROLES[0]?.id || '',
    status: 'active' as 'active' | 'inactive',
  });

  const seatOptions = useMemo(
    () => seats.filter((s) => s.status === 'active').map((s) => ({ id: s.id, label: s.displayName })),
    [seats]
  );

  if (user?.role !== 'admin') {
    return <Navigate to={getDefaultSettingsPath(user?.role)} replace />;
  }

  const openNewRole = () => {
    setEditingRole(null);
    setRoleForm({ name: '', description: '', permissionKeys: ['inbox.view', 'inbox.reply'] });
    setRoleModalOpen(true);
  };

  const openEditRole = (r: CustomRole) => {
    setEditingRole(r);
    setRoleForm({
      name: r.name,
      description: r.description,
      permissionKeys: [...r.permissionKeys],
    });
    setRoleModalOpen(true);
  };

  const saveRole = () => {
    if (!roleForm.name.trim()) return;
    if (editingRole) {
      setRoles((prev) =>
        prev.map((r) =>
          r.id === editingRole.id
            ? {
                ...r,
                name: roleForm.name.trim(),
                description: roleForm.description.trim(),
                permissionKeys: roleForm.permissionKeys,
              }
            : r
        )
      );
    } else {
      setRoles((prev) => [
        ...prev,
        {
          id: `role-${Date.now()}`,
          name: roleForm.name.trim(),
          description: roleForm.description.trim(),
          permissionKeys: roleForm.permissionKeys,
        },
      ]);
    }
    setRoleModalOpen(false);
  };

  const deleteRole = (id: string) => {
    if (seats.some((s) => s.roleId === id)) {
      window.alert('仍有坐席绑定该角色，请先调整坐席角色后再删除。');
      return;
    }
    if (!window.confirm('确定删除该角色？')) return;
    setRoles((prev) => prev.filter((r) => r.id !== id));
  };

  const togglePermission = (key: string) => {
    setRoleForm((prev) => ({
      ...prev,
      permissionKeys: prev.permissionKeys.includes(key)
        ? prev.permissionKeys.filter((k) => k !== key)
        : [...prev.permissionKeys, key],
    }));
  };

  const openNewSeat = () => {
    setSeatForm({
      displayName: '',
      email: '',
      account: '',
      password: '',
      roleId: roles[0]?.id || '',
      status: 'active',
    });
    setSeatModalOpen(true);
  };

  const saveSeat = () => {
    if (
      !seatForm.displayName.trim() ||
      !seatForm.email.trim() ||
      !seatForm.account.trim() ||
      !seatForm.password.trim()
    ) {
      window.alert('请填写显示名称、邮箱、登录账号与登录密码。');
      return;
    }
    setSeats((prev) => [
      ...prev,
      {
        id: `seat-${Date.now()}`,
        displayName: seatForm.displayName.trim(),
        email: seatForm.email.trim(),
        account: seatForm.account.trim(),
        roleId: seatForm.roleId,
        status: seatForm.status,
        loginPasswordConfigured: true,
      },
    ]);
    setSeatModalOpen(false);
  };

  const deleteSeat = (id: string) => {
    if (!window.confirm('确定移除该坐席？相关分配规则需手动调整。')) return;
    setSeats((prev) => prev.filter((s) => s.id !== id));
  };

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name || id;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">坐席与分配</h1>
          <p className="text-sm text-slate-500 mt-1">
            按步骤完成：角色 → 坐席（含登录账号与密码）→ 工单自动分配规则。本页仅
            <span className="font-semibold text-slate-700"> 租户管理员 </span>
            可见与可配置。
          </p>
        </div>

        {/* 分步指示 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-2">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const active = step === s.n;
              const done = step > s.n;
              return (
                <div key={s.n} className="flex items-center flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => setStep(s.n)}
                    className={cn(
                      'flex items-center gap-3 w-full text-left rounded-xl px-3 py-2.5 transition-colors',
                      active ? 'bg-orange-50 ring-1 ring-[#F97316]/30' : 'hover:bg-slate-50'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                        active
                          ? 'bg-[#F97316] text-white'
                          : done
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {done ? <Check className="w-4 h-4" strokeWidth={3} /> : s.n}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                        <Icon className="w-4 h-4 text-[#F97316] shrink-0" />
                        {s.label}
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        {s.n === 1 && '定义权限包'}
                        {s.n === 2 && '账号密码用于坐席登录'}
                        {s.n === 3 && '按平台/店铺/类型路由'}
                      </span>
                    </span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div className="hidden sm:block w-px h-10 bg-slate-200 mx-1 shrink-0" aria-hidden />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {step === 1 && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#F97316]" />
                <h2 className="text-lg font-bold text-slate-900">第一步 · 自定义角色</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 text-sm font-bold text-[#F97316] hover:bg-orange-50 rounded-xl transition-colors"
                >
                  下一步
                </button>
                <button
                  type="button"
                  onClick={openNewRole}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#F97316] text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  新建角色
                </button>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {roles.map((r) => (
                <div
                  key={r.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div>
                    <p className="font-bold text-slate-900">{r.name}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{r.description || '—'}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {r.permissionKeys.map((k) => (
                        <span
                          key={k}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium"
                        >
                          {PERMISSION_PRESETS.find((p) => p.key === k)?.label || k}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditRole(r)}
                      className="p-2 text-slate-500 hover:text-[#F97316] hover:bg-orange-50 rounded-lg transition-colors"
                      title="编辑"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRole(r.id)}
                      className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserCog className="w-5 h-5 text-[#F97316]" />
                <h2 className="text-lg font-bold text-slate-900">第二步 · 客服坐席</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  上一步
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2 text-sm font-bold text-[#F97316] hover:bg-orange-50 rounded-xl transition-colors"
                >
                  下一步
                </button>
                <button
                  type="button"
                  onClick={openNewSeat}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  添加坐席
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[720px]">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 font-semibold">坐席</th>
                    <th className="px-6 py-3 font-semibold">登录账号</th>
                    <th className="px-6 py-3 font-semibold">邮箱</th>
                    <th className="px-6 py-3 font-semibold">登录密码</th>
                    <th className="px-6 py-3 font-semibold">角色</th>
                    <th className="px-6 py-3 font-semibold">状态</th>
                    <th className="px-6 py-3 font-semibold text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {seats.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80">
                      <td className="px-6 py-4 font-medium text-slate-900">{s.displayName}</td>
                      <td className="px-6 py-4 text-slate-700 font-mono text-xs">{s.account}</td>
                      <td className="px-6 py-4 text-slate-600">{s.email}</td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {s.loginPasswordConfigured ? '已设置（不明文展示）' : '—'}
                      </td>
                      <td className="px-6 py-4 text-slate-700">{roleName(s.roleId)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            'text-xs font-bold px-2 py-1 rounded-full',
                            s.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                          )}
                        >
                          {s.status === 'active' ? '启用' : '停用'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => deleteSeat(s.id)}
                          className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                          title="移除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white border border-slate-200 rounded-xl transition-colors bg-white shadow-sm"
              >
                上一步
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
              <TicketRoutingRulesBlock seatOptions={seatOptions} seatsStepHref="/settings/seats?step=2" />
            </div>
          </div>
        )}
      </div>

      {roleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">{editingRole ? '编辑角色' : '新建角色'}</h3>
              <button
                type="button"
                onClick={() => setRoleModalOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">角色名称</label>
                <input
                  value={roleForm.name}
                  onChange={(e) => setRoleForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] outline-none"
                  placeholder="例如：北美专职客服"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">说明</label>
                <textarea
                  value={roleForm.description}
                  onChange={(e) => setRoleForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] outline-none resize-none"
                  placeholder="职责简述"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500">权限</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PERMISSION_PRESETS.map((p) => (
                    <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={roleForm.permissionKeys.includes(p.key)}
                        onChange={() => togglePermission(p.key)}
                        className="rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRoleModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveRole}
                disabled={!roleForm.name.trim()}
                className="px-5 py-2 text-sm font-bold text-white bg-[#F97316] rounded-xl hover:bg-orange-600 disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {seatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">添加坐席</h3>
              <button
                type="button"
                onClick={() => setSeatModalOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">显示名称</label>
                <input
                  value={seatForm.displayName}
                  onChange={(e) => setSeatForm((p) => ({ ...p, displayName: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">登录账号</label>
                <input
                  value={seatForm.account}
                  onChange={(e) => setSeatForm((p) => ({ ...p, account: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] font-mono"
                  placeholder="用于坐席登录的唯一账号"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">登录密码</label>
                <input
                  type="password"
                  value={seatForm.password}
                  onChange={(e) => setSeatForm((p) => ({ ...p, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                  placeholder="初始密码，接入后端后应加密存储"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">邮箱（联系与通知）</label>
                <input
                  type="email"
                  value={seatForm.email}
                  onChange={(e) => setSeatForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">角色</label>
                <select
                  value={seatForm.roleId}
                  onChange={(e) => setSeatForm((p) => ({ ...p, roleId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">状态</label>
                <select
                  value={seatForm.status}
                  onChange={(e) =>
                    setSeatForm((p) => ({ ...p, status: e.target.value as 'active' | 'inactive' }))
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none"
                >
                  <option value="active">启用</option>
                  <option value="inactive">停用</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSeatModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-200"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveSeat}
                className="px-5 py-2 text-sm font-bold text-white bg-[#F97316] rounded-xl hover:bg-orange-600"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
