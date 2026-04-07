import { useState, useMemo, useEffect, useCallback } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Edit2, Shield, UserCog, GitBranch, Check, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { AgentSeat, CustomRole } from '@/src/types';
import { useAuth } from '@/src/hooks/useAuth';
import TicketRoutingRulesBlock from './TicketRoutingRulesBlock';
import { getDefaultSettingsPath } from './settingsNavConfig';
import { DEMO_AGENT_SEATS_INITIAL } from '@/src/data/demoAgentSeats';
import {
  intellideskConfigured,
  intellideskTenantId,
  intellideskUserIdForApi,
  fetchAgentSeats,
  createAgentSeat,
  deleteAgentSeat,
  splitSeatSyncApiError,
} from '@/src/services/intellideskApi';
import {
  SEAT_ROLE_TEMPLATES,
  SEAT_PERMISSION_EDITOR_GROUPS,
  permissionKeysForTemplate,
  normalizeSeatPermissionKeys,
  detectTemplateId,
  templateLabel,
  type SeatRoleTemplateId,
} from '@/src/lib/seatPermissions';

const INITIAL_ROLES: CustomRole[] = [
  {
    id: 'role-admin',
    name: '管理员',
    description: '含设置与分配管理',
    permissionTemplateId: 'full',
    permissionKeys: permissionKeysForTemplate('full'),
  },
  {
    id: 'role-agent',
    name: '一线客服',
    description: '日常接待、会话与售后',
    permissionTemplateId: 'standard',
    permissionKeys: permissionKeysForTemplate('standard'),
  },
  {
    id: 'role-finance',
    name: '财务/运营',
    description: '售后单审核与退款操作',
    permissionTemplateId: 'finance',
    permissionKeys: permissionKeysForTemplate('finance'),
  },
];

const STEPS = [
  { n: 1 as const, label: '角色', icon: Shield },
  { n: 2 as const, label: '坐席', icon: UserCog },
  { n: 3 as const, label: '分配', icon: GitBranch },
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
  const [roleForm, setRoleForm] = useState<{
    name: string;
    description: string;
    permissionKeys: string[];
  }>({
    name: '',
    description: '',
    permissionKeys: permissionKeysForTemplate('standard'),
  });
  const [seatForm, setSeatForm] = useState({
    displayName: '',
    email: '',
    account: '',
    password: '',
    roleId: INITIAL_ROLES[0]?.id || '',
    status: 'active' as 'active' | 'inactive',
  });
  const [seatSyncBanner, setSeatSyncBanner] = useState<{ summary: string; detail: string } | null>(null);

  const reloadSeats = useCallback(async () => {
    if (!intellideskConfigured()) return;
    try {
      const rows = await fetchAgentSeats(
        intellideskTenantId(),
        intellideskUserIdForApi(user?.id)
      );
      setSeats(
        rows.map((r) => ({
          id: r.id,
          displayName: r.displayName,
          email: r.email,
          account: r.account,
          roleId: r.roleId,
          status: r.status,
        }))
      );
      setSeatSyncBanner(null);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setSeatSyncBanner(splitSeatSyncApiError(raw));
    }
  }, [user?.id]);

  useEffect(() => {
    void reloadSeats();
  }, [reloadSeats]);

  const seatOptions = useMemo(
    () => seats.filter((s) => s.status === 'active').map((s) => ({ id: s.id, label: s.displayName })),
    [seats]
  );

  const routingApi = useMemo(
    () =>
      intellideskConfigured()
        ? { tenantId: intellideskTenantId(), userId: intellideskUserIdForApi(user?.id) }
        : undefined,
    [user?.id]
  );

  if (user?.role !== 'admin') {
    return <Navigate to={getDefaultSettingsPath(user?.role)} replace />;
  }

  const openNewRole = () => {
    setEditingRole(null);
    setRoleForm({
      name: '',
      description: '',
      permissionKeys: permissionKeysForTemplate('standard'),
    });
    setRoleModalOpen(true);
  };

  const openEditRole = (r: CustomRole) => {
    setEditingRole(r);
    setRoleForm({
      name: r.name,
      description: r.description,
      permissionKeys: normalizeSeatPermissionKeys([...r.permissionKeys]),
    });
    setRoleModalOpen(true);
  };

  const toggleRolePermissionKey = (key: string, enabled: boolean) => {
    setRoleForm((f) => {
      const next = new Set(f.permissionKeys);
      if (enabled) next.add(key);
      else next.delete(key);
      return { ...f, permissionKeys: normalizeSeatPermissionKeys([...next]) };
    });
  };

  const saveRole = () => {
    if (!roleForm.name.trim()) return;
    const keys = normalizeSeatPermissionKeys(roleForm.permissionKeys);
    const permissionTemplateId = detectTemplateId(keys);
    if (editingRole) {
      setRoles((prev) =>
        prev.map((r) =>
          r.id === editingRole.id
            ? {
                ...r,
                name: roleForm.name.trim(),
                description: roleForm.description.trim(),
                permissionKeys: keys,
                permissionTemplateId,
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
          permissionKeys: keys,
          permissionTemplateId,
        },
      ]);
    }
    setRoleModalOpen(false);
  };

  const deleteRole = (id: string) => {
    if (seats.some((s) => s.roleId === id)) {
      window.alert('有坐席仍绑定该角色，请先调整后再删。');
      return;
    }
    if (!window.confirm('删除该角色？')) return;
    setRoles((prev) => prev.filter((r) => r.id !== id));
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
    if (!seatForm.displayName.trim() || !seatForm.email.trim() || !seatForm.account.trim()) {
      window.alert('请填写名称、邮箱、登录账号。');
      return;
    }
    if (!intellideskConfigured() && !seatForm.password.trim()) {
      window.alert('演示须填写登录密码。');
      return;
    }
    if (intellideskConfigured()) {
      void (async () => {
        try {
          await createAgentSeat(intellideskTenantId(), intellideskUserIdForApi(user?.id), {
            displayName: seatForm.displayName.trim(),
            email: seatForm.email.trim(),
            account: seatForm.account.trim(),
            roleId: seatForm.roleId?.trim() || 'default',
            status: seatForm.status,
          });
          await reloadSeats();
          setSeatModalOpen(false);
        } catch (e) {
          window.alert(e instanceof Error ? e.message : String(e));
        }
      })();
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
    if (!window.confirm('移除该坐席？请检查分配规则。')) return;
    if (intellideskConfigured()) {
      void (async () => {
        try {
          await deleteAgentSeat(intellideskTenantId(), intellideskUserIdForApi(user?.id), id);
          await reloadSeats();
        } catch (e) {
          window.alert(e instanceof Error ? e.message : String(e));
        }
      })();
      return;
    }
    setSeats((prev) => prev.filter((s) => s.id !== id));
  };

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name || id;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          {seatSyncBanner ? (
            <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-amber-950 leading-snug min-w-0">
                  坐席列表未从服务器更新：{seatSyncBanner.summary}
                  <span className="block text-xs font-normal text-amber-800/90 mt-1">
                    当前表格仍为上次成功加载的数据或本地演示数据；接口恢复后可刷新页面重试。
                  </span>
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => void reloadSeats()}
                    className="text-xs font-semibold text-[#c2410c] hover:underline px-2 py-1"
                  >
                    重试
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeatSyncBanner(null)}
                    className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100/80"
                    title="关闭提示"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {seatSyncBanner.detail && seatSyncBanner.detail !== seatSyncBanner.summary ? (
                <details className="mt-2 text-xs text-amber-900/85 border-t border-amber-200/80 pt-2">
                  <summary className="cursor-pointer select-none font-medium text-amber-900 hover:text-amber-950">
                    完整诊断信息
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed opacity-95">
                    {seatSyncBanner.detail}
                  </p>
                </details>
              ) : null}
            </div>
          ) : null}
          <h1 className="text-2xl font-bold text-slate-900">坐席与分配</h1>
          <p className="text-sm text-slate-500 mt-1">
            角色 → 坐席 → 分配规则。<span className="font-semibold text-slate-700">仅管理员</span>可编辑。
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
                        {s.n === 1 && '权限包'}
                        {s.n === 2 && '账号与登录'}
                        {s.n === 3 && '平台/店铺/类型'}
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
                <h2 className="text-lg font-bold text-slate-900">1 · 角色</h2>
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
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                      <span className="font-semibold text-slate-700">权限</span>
                      {': '}
                      {templateLabel(detectTemplateId(r.permissionKeys))}
                      {(() => {
                        const tid = detectTemplateId(r.permissionKeys);
                        if (tid === 'custom') return ' — 已逐项配置';
                        const meta = SEAT_ROLE_TEMPLATES.find((t) => t.id === tid);
                        return meta ? ` — ${meta.description}` : '';
                      })()}
                    </p>
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
                <h2 className="text-lg font-bold text-slate-900">2 · 坐席</h2>
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
                        {s.loginPasswordConfigured ? '已设置' : '—'}
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
              <TicketRoutingRulesBlock
                seatOptions={seatOptions}
                seatsStepHref="/settings/seats?step=2"
                routingApi={routingApi}
              />
            </div>
          </div>
        )}
      </div>

      {roleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
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
                <label className="text-xs font-medium text-slate-500">描述</label>
                <textarea
                  value={roleForm.description}
                  onChange={(e) => setRoleForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] outline-none resize-none"
                  placeholder="可选"
                />
              </div>
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <label htmlFor="seat-role-template" className="text-xs font-semibold text-slate-600">
                  权限包（快捷预设）
                </label>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-2">
                  先选岗位预设一键填充，再在下方勾选微调；与任一预设完全一致时会显示对应包名。
                </p>
                {(() => {
                  const resolved = detectTemplateId(roleForm.permissionKeys);
                  const selectValue = resolved === 'custom' ? '__custom__' : resolved;
                  return (
                    <select
                      id="seat-role-template"
                      value={selectValue}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '__custom__') return;
                        setRoleForm((f) => ({
                          ...f,
                          permissionKeys: permissionKeysForTemplate(v as SeatRoleTemplateId),
                        }));
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                    >
                      <option value="__custom__" disabled={selectValue !== '__custom__'}>
                        自定义（逐项勾选）
                      </option>
                      {SEAT_ROLE_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                  </select>
                );
              })()}
            </div>
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-600">具体权限（精简）</p>
                
                <div className="space-y-4 max-h-[min(42vh,320px)] overflow-y-auto pr-1">
                  {SEAT_PERMISSION_EDITOR_GROUPS.map((group) => (
                    <div key={group.title}>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        {group.title}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {group.items.map(({ key, label }) => {
                          const checked = roleForm.permissionKeys.includes(key);
                          return (
                            <label
                              key={key}
                              className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none"
                            >
                              <input
                                type="checkbox"
                                className="rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]/30"
                                checked={checked}
                                onChange={(e) => toggleRolePermissionKey(key, e.target.checked)}
                              />
                              <span>{label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
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
                <label className="text-xs font-medium text-slate-500">名称</label>
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
                  placeholder="登录用户名"
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
                  placeholder="初始密码"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">邮箱</label>
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
