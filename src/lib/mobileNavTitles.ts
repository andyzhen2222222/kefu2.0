import { settingsNavItems } from '@/src/components/settings/settingsNavConfig';

/** 移动端顶栏标题：与各路由、设置子页一致，便于扫读 */
export function getMobileNavTitle(pathname: string): string {
  const p = pathname || '/';
  if (p === '/' || p === '') return '工作台';
  if (p.startsWith('/mailbox')) return '工单';
  if (p.startsWith('/orders')) return '订单';
  if (p.startsWith('/customers')) return '客户';
  if (p.startsWith('/after-sales')) return '售后';
  if (p.startsWith('/insights')) return '洞察';
  if (p.startsWith('/admin')) return '系统';
  if (p.startsWith('/settings')) {
    if (p === '/settings' || p === '/settings/') return '设置';
    const sorted = [...settingsNavItems].sort((a, b) => b.path.length - a.path.length);
    const hit = sorted.find((i) => p === i.path || p.startsWith(`${i.path}/`));
    return hit?.label ?? '设置';
  }
  return '工作台';
}
