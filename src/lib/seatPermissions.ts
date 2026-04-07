/**
 * 坐席角色：以「权限包」为主，避免逐项勾选。
 * 底层仍用 permissionKeys 数组，便于后续 RBAC 对接。
 */

/** 与 UI 模板一一对应；custom = 与任一预设集合不完全一致（如历史数据） */
export type SeatRoleTemplateId = 'standard' | 'lead' | 'finance' | 'configurator' | 'full';

const INBOX_SESSION = [
  'inbox.view',
  'inbox.reply',
  'inbox.internal_note',
  'inbox.ai_tools',
] as const;

const SIDEBAR_OPS = ['invoice.manage', 'logistics.sync'] as const;

const DATA_VIEW = ['dashboard.view', 'orders.view', 'customers.view'] as const;

const AFTER_SUBMIT = ['after_sales.view', 'after_sales.submit'] as const;

const AFTER_MANAGE = ['after_sales.manage'] as const;

const REFUND = ['refund.platform'] as const;

const SETTINGS_ALL = [
  'settings.templates',
  'settings.knowledge',
  'settings.sla',
  'settings.rules',
  'settings.dictionary',
  'settings.translation',
  'settings.sync',
] as const;

function uniq(keys: readonly string[]): string[] {
  return [...new Set(keys)];
}

/** 标准客服：日常作业一体化（会话、侧栏、数据、提交与查看售后），不含结案/退款 API/设置 */
export function keysStandardAgent(): string[] {
  return uniq([...INBOX_SESSION, ...SIDEBAR_OPS, ...DATA_VIEW, ...AFTER_SUBMIT]);
}

/** 组长：在标准上可结案/改删售后单 */
export function keysLead(): string[] {
  return uniq([...keysStandardAgent(), ...AFTER_MANAGE]);
}

/** 财务/运营：不重会话回复，侧重售后单与退款 */
export function keysFinance(): string[] {
  return uniq([
    'inbox.view',
    ...DATA_VIEW,
    ...AFTER_SUBMIT,
    ...AFTER_MANAGE,
    ...REFUND,
    'invoice.manage',
  ]);
}

/** 客服 + 可维护各设置子模块（不含坐席页本身，仍依赖账号 admin） */
export function keysConfigurator(): string[] {
  return uniq([...keysStandardAgent(), ...SETTINGS_ALL]);
}

/** 弹窗内分组勾选用：精简字段，覆盖 `getAllSeatPermissionKeys()` */
export const SEAT_PERMISSION_EDITOR_GROUPS: { title: string; items: { key: string; label: string }[] }[] = [
  {
    title: '工单与会话',
    items: [
      { key: 'inbox.view', label: '工单' },
      { key: 'inbox.reply', label: '回复' },
      { key: 'inbox.internal_note', label: '内部备注' },
      { key: 'inbox.ai_tools', label: 'AI' },
    ],
  },
  {
    title: '侧栏',
    items: [
      { key: 'invoice.manage', label: '发票' },
      { key: 'logistics.sync', label: '物流' },
    ],
  },
  {
    title: '售后与资金',
    items: [
      { key: 'after_sales.view', label: '售后列表' },
      { key: 'after_sales.submit', label: '提交售后' },
      { key: 'after_sales.manage', label: '售后结案' },
      { key: 'refund.platform', label: '退款/API' },
    ],
  },
  {
    title: '数据',
    items: [
      { key: 'dashboard.view', label: '工作台' },
      { key: 'orders.view', label: '订单' },
      { key: 'customers.view', label: '客户' },
    ],
  },
  {
    title: '设置',
    items: [
      { key: 'settings.templates', label: '模板' },
      { key: 'settings.knowledge', label: '知识库' },
      { key: 'settings.sla', label: 'SLA' },
      { key: 'settings.rules', label: '自动回复' },
      { key: 'settings.dictionary', label: '字段' },
      { key: 'settings.translation', label: '翻译' },
      { key: 'settings.sync', label: '同步' },
    ],
  },
];

export function getAllSeatPermissionKeys(): string[] {
  return uniq(SEAT_PERMISSION_EDITOR_GROUPS.flatMap((g) => g.items.map((i) => i.key)));
}

export function keysFull(): string[] {
  return getAllSeatPermissionKeys();
}

export function permissionKeysForTemplate(id: SeatRoleTemplateId): string[] {
  switch (id) {
    case 'standard':
      return keysStandardAgent();
    case 'lead':
      return keysLead();
    case 'finance':
      return keysFinance();
    case 'configurator':
      return keysConfigurator();
    case 'full':
      return keysFull();
    default:
      return keysStandardAgent();
  }
}

export const SEAT_ROLE_TEMPLATES: {
  id: SeatRoleTemplateId;
  label: string;
  description: string;
}[] = [
  {
    id: 'standard',
    label: '标准客服',
    description: '日常接待、会话与售后',
  },
  {
    id: 'lead',
    label: '组长',
    description: '日常接待，加售后结案与管理',
  },
  {
    id: 'finance',
    label: '财务 / 运营',
    description: '看单、售后全流程与退款操作',
  },
  {
    id: 'configurator',
    label: '客服 + 维护设置',
    description: '日常接待，加知识库模板等设置',
  },
  {
    id: 'full',
    label: '全部能力',
    description: '除账号管理外的所有权限',
  },
];

export function templateLabel(id: SeatRoleTemplateId | 'custom'): string {
  if (id === 'custom') return '自定义';
  return SEAT_ROLE_TEMPLATES.find((t) => t.id === id)?.label ?? id;
}

export function detectTemplateId(keys: string[]): SeatRoleTemplateId | 'custom' {
  const norm = (arr: string[]) => [...new Set(arr)].sort().join('\0');
  const input = norm(normalizeSeatPermissionKeys(keys));
  for (const t of SEAT_ROLE_TEMPLATES) {
    if (norm(permissionKeysForTemplate(t.id)) === input) return t.id;
  }
  return 'custom';
}

/** 将历史 permissionKeys 归一（仅前端本地角色 state 兼容） */
export function normalizeSeatPermissionKeys(keys: string[]): string[] {
  const set = new Set(keys.filter(Boolean));
  if (set.has('after_sales')) {
    set.delete('after_sales');
    set.add('after_sales.view');
    set.add('after_sales.submit');
    set.add('after_sales.manage');
  }
  return [...set].sort();
}

export function seatPermissionLabel(key: string): string {
  for (const g of SEAT_PERMISSION_EDITOR_GROUPS) {
    const hit = g.items.find((i) => i.key === key);
    if (hit) return hit.label;
  }
  return key;
}
