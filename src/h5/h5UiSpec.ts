/**
 * H5 移动端 UI 规范（单一来源）
 *
 * 依据：
 * - edesk_prd_v_2.md §7.1–7.4（独立工单客户端、Tab 与能力）
 * - edesk_prd_v_2.md §7.2.4 历史草案（IM 会话详情、底部输入 + 半屏工具面板）
 * - 工程内 MobileHeader / MobileBottomNav 已落地的触控与安全区实践
 *
 * 原则：H5 是「手机 App 式」交互，不是 PC 三栏布局的缩小版。
 */

export const H5_BRAND = '#F97316';

/** 最小触控尺寸 44px（Apple HIG / Material 建议） */
export const H5_TOUCH = 'min-h-11 min-w-11';

/** 顶栏 */
export const H5_HEADER =
  'sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur-sm supports-[backdrop-filter]:bg-white/90';

export const H5_HEADER_INNER = 'grid h-12 min-h-[48px] grid-cols-[44px_1fr_44px] items-center px-1';

/** 底部安全区 */
export const H5_SAFE_BOTTOM = 'pb-[max(0.75rem,env(safe-area-inset-bottom))]';

/** 主 Tab 底栏占位（与 H5TabBar 高度一致，避免内容被遮挡） */
export const H5_TAB_BAR_OFFSET =
  'pb-[calc(4rem+env(safe-area-inset-bottom,0px))]';

/** 横向 Tab 胶囊（详情页业务分区） */
export const H5_TAB_PILL_ACTIVE =
  'shrink-0 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold text-[#F97316] shadow-sm';

export const H5_TAB_PILL_INACTIVE =
  'shrink-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600';

/** 工单详情顶：业务分区 TAB（下划线式，与内容区顶栏一体） */
export const H5_DETAIL_TAB_BAR = 'mt-2 -mx-3 border-b border-slate-200';

export const H5_DETAIL_TAB_SCROLL =
  'flex min-h-10 min-w-0 flex-nowrap overflow-x-auto px-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export const H5_DETAIL_TAB_BTN =
  'relative shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-center text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400/35';

export const H5_DETAIL_TAB_ACTIVE = 'border-[#F97316] text-[#F97316]';

export const H5_DETAIL_TAB_INACTIVE =
  'border-transparent text-slate-500 active:bg-slate-50/80';

/** 底部 IM 输入条（微信/钉钉式） */
export const H5_COMPOSER_BAR =
  'shrink-0 border-t border-slate-200 bg-white/95 backdrop-blur-sm supports-[backdrop-filter]:bg-white/90';

export const H5_COMPOSER_ROW = 'flex items-end gap-2 px-3 pt-2';

/** 输入框与发送按钮统一高度（单行） */
export const H5_COMPOSER_CONTROL_H = 'min-h-[40px] h-[40px]';

export const H5_COMPOSER_INPUT =
  'min-h-[40px] resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[15px] leading-snug outline-none transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-500/15';

export const H5_COMPOSER_SEND =
  'inline-flex h-[40px] min-h-[40px] shrink-0 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-semibold leading-none text-white transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-40';

/** 输入框内嵌操作钮（翻译 / +） */
export const H5_COMPOSER_INLINE_BTN =
  'flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40';

/** 发送对象：轻量胶囊（客户 / 经理） */
export const H5_COMPOSER_OUTBOUND_ROW = 'flex min-w-0 items-center gap-1';

export const H5_COMPOSER_OUTBOUND_CHIP_ACTIVE =
  'border border-blue-200/70 bg-blue-50/60 text-blue-800 shadow-none';

export const H5_COMPOSER_OUTBOUND_CHIP_INACTIVE =
  'border border-slate-200/60 bg-slate-50/50 text-slate-500 shadow-none active:bg-slate-100/80';

/** AI 能力：辅助 / 润色（紧凑横排） */
export const H5_COMPOSER_AI_WRAP =
  'grid h-8 w-[8.5rem] shrink-0 grid-cols-2 gap-px rounded-lg bg-slate-100/90 p-px';

/** 输入框上方工具条（模板 / AI 等） */
export const H5_COMPOSER_TOOLBAR =
  'flex items-center gap-1 overflow-x-auto px-3 pb-0.5 pt-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export const H5_COMPOSER_TOOL_BTN =
  'inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-slate-200/80 bg-white px-2.5 text-[11px] font-medium text-slate-600 transition-colors active:scale-[0.98] active:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';

/** 业务 Tab 底栏（与输入条同级，贴底固定） */
export const H5_TAB_BOTTOM_BAR =
  'shrink-0 border-t border-slate-200 bg-white/95 backdrop-blur-sm supports-[backdrop-filter]:bg-white/90';

export const H5_TAB_BTN_PRIMARY =
  'flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

export const H5_TAB_BTN_SECONDARY =
  'flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors active:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

export const H5_TAB_BTN_ACCENT =
  'flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#F97316] to-[#FB923C] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

/** 弹层底栏：次要/取消（无描边，轻量） */
export const H5_MODAL_BTN_GHOST =
  'flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50';

/** 全屏表单弹层：顶栏 */
export const H5_MODAL_HEADER =
  'flex shrink-0 items-center justify-between border-b border-slate-200 bg-white';

/** 表单控件（select / input / textarea 基础） */
export const H5_FORM_CONTROL =
  'w-full min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[15px] outline-none transition-colors focus:border-[#F97316] focus:bg-white focus:ring-2 focus:ring-[#F97316]/20';
