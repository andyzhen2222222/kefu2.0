import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 新标签页打开「设置 - 字段管理」，并通过 ?dict= 定位到具体业务字典 */
export function openFieldConfigPage(dictId: string) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const url = `${window.location.origin}${base}/settings/dictionary?dict=${encodeURIComponent(dictId)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
