import type { LucideIcon } from 'lucide-react';
import {
  FileText,
  Clock,
  MessageSquare,
  Database,
  UserCog,
  Languages,
  BookOpen,
} from 'lucide-react';
import type { User } from '@/src/types';

export interface SettingsNavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  /** 仅租户管理员可见（坐席、角色、工单分配） */
  adminOnly?: boolean;
}

export const settingsNavItems: SettingsNavItem[] = [
  { icon: UserCog, label: '坐席与分配', path: '/settings/seats', adminOnly: true },
  { icon: Languages, label: '智能翻译', path: '/settings/translation', adminOnly: true },
  { icon: FileText, label: '模板管理', path: '/settings/templates' },
  { icon: BookOpen, label: '知识库', path: '/settings/knowledge' },
  { icon: Clock, label: 'SLA规则', path: '/settings/sla' },
  { icon: MessageSquare, label: '自动回复', path: '/settings/rules' },
  { icon: Database, label: '字段管理', path: '/settings/dictionary' },
];

export function filterSettingsNav(role: User['role'] | undefined) {
  return settingsNavItems.filter((i) => !i.adminOnly || role === 'admin');
}

export function getDefaultSettingsPath(role: User['role'] | undefined) {
  const first = filterSettingsNav(role)[0];
  return first?.path ?? '/settings/templates';
}
