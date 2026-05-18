import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Sparkles,
  Languages,
  FileText,
  Users,
  X,
  Mail,
  MailOpen,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import type { Ticket } from '@/src/types';
import {
  buildToggleReadPatch,
  buildToggleRepliedPatch,
  isTicketUnreadForList,
  readToggleLabel,
  repliedToggleLabel,
} from '@/src/lib/ticketProcessingPatches';
import { cn } from '@/src/lib/utils';
import ToggleSwitch from '@/src/components/ui/ToggleSwitch';
import {
  H5_COMPOSER_BAR,
  H5_COMPOSER_INLINE_BTN,
  H5_COMPOSER_INPUT,
  H5_COMPOSER_ROW,
  H5_COMPOSER_SEND,
  H5_SAFE_BOTTOM,
} from '@/src/h5/h5UiSpec';

export type H5ComposerNotice = {
  type: 'error' | 'success' | 'info';
  message: string;
};

export type H5ComposerBarProps = {
  replyText: string;
  onReplyTextChange: (v: string) => void;
  onSend: () => void;
  sendDisabled: boolean;
  sendLabel: string;
  /** 内部备注模式（仅坐席可见） */
  isInternalNote?: boolean;
  onExitInternalNote?: () => void;
  /** 递增后聚焦输入框（如从订单 Tab「添加备注」跳入） */
  focusTrigger?: number;
  composerNotice?: H5ComposerNotice | null;
  onDismissComposerNotice?: () => void;
  sendToCustomer: boolean;
  sendToManager: boolean;
  onSendToCustomerChange: (v: boolean) => void;
  onSendToManagerChange: (v: boolean) => void;
  onOpenTemplate: () => void;
  onAiAssist: () => void;
  aiAssistLoading: boolean;
  onOpenPolish?: () => void;
  polishDisabled?: boolean;
  onTranslateDraft?: () => void;
  translateDisabled?: boolean;
  translateLoading?: boolean;
  /** 批量翻译当前会话全部待译消息 */
  onTranslateAllPage?: () => void;
  translateAllPageLoading?: boolean;
  translateAllPageDisabled?: boolean;
  onPickFiles?: (files: FileList) => void;
  /** 工单会话状态快捷切换（与收件箱左滑一致） */
  ticket?: Pick<Ticket, 'messageProcessingStatus' | 'status'>;
  onTicketPatch?: (patch: Partial<Ticket>) => void;
};

type MoreItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  sub?: string;
  disabled?: boolean;
  onClick: () => void;
};

const H5_COMPOSER_TEXTAREA_MAX_LINES = 5;

function syncH5ComposerTextareaHeight(el: HTMLTextAreaElement, maxLines: number) {
  const cs = getComputedStyle(el);
  const fontSize = parseFloat(cs.fontSize) || 15;
  const lh = cs.lineHeight;
  const lineHeight = lh === 'normal' || Number.isNaN(parseFloat(lh)) ? fontSize * 1.375 : parseFloat(lh);
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const maxH = lineHeight * maxLines + padY;

  el.style.maxHeight = `${maxH}px`;
  el.style.height = 'auto';
  const next = Math.min(el.scrollHeight, maxH);
  el.style.height = `${next}px`;
  el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
}

export default function H5ComposerBar({
  replyText,
  onReplyTextChange,
  onSend,
  sendDisabled,
  sendLabel,
  sendToCustomer,
  sendToManager,
  onSendToCustomerChange,
  onSendToManagerChange,
  onOpenTemplate,
  onAiAssist,
  aiAssistLoading,
  onOpenPolish,
  polishDisabled,
  onTranslateDraft,
  translateDisabled,
  translateLoading,
  onTranslateAllPage,
  translateAllPageLoading = false,
  translateAllPageDisabled = false,
  onPickFiles,
  ticket,
  onTicketPatch,
  isInternalNote = false,
  onExitInternalNote,
  focusTrigger = 0,
  composerNotice = null,
  onDismissComposerNotice,
}: H5ComposerBarProps) {
  const fileInputId = 'h5-attachment-upload';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [sendSubOpen, setSendSubOpen] = useState(false);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    syncH5ComposerTextareaHeight(el, H5_COMPOSER_TEXTAREA_MAX_LINES);
  }, [replyText]);

  const closeMore = () => {
    setMoreOpen(false);
    setSendSubOpen(false);
  };

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMore();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [moreOpen]);

  useEffect(() => {
    if (!focusTrigger) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, [focusTrigger]);

  const sendSummary = () => {
    const parts: string[] = [];
    if (sendToCustomer) parts.push('客户');
    if (sendToManager) parts.push('经理');
    return parts.length ? parts.join('·') : '未选';
  };

  const wrapAction = (fn: () => void) => () => {
    closeMore();
    fn();
  };

  const moreItems: MoreItem[] = [
    {
      key: 'send',
      label: '发送对象',
      sub: sendSummary(),
      icon: <Users className="h-6 w-6 text-slate-600" />,
      onClick: () => setSendSubOpen((v) => !v),
    },
    ...(onOpenPolish
      ? [
          {
            key: 'polish',
            label: '润色',
            sub: '选方案',
            icon: <Pencil className="h-6 w-6 text-indigo-600" />,
            disabled: Boolean(polishDisabled),
            onClick: wrapAction(onOpenPolish),
          } as MoreItem,
        ]
      : []),
    ...(onTranslateAllPage
      ? [
          {
            key: 'translate-all',
            label: '全页翻译',
            sub: '会话消息',
            icon: translateAllPageLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-[#F97316]" />
            ) : (
              <Languages className="h-6 w-6 text-[#F97316]" />
            ),
            disabled: translateAllPageDisabled || translateAllPageLoading,
            onClick: wrapAction(onTranslateAllPage),
          } as MoreItem,
        ]
      : []),
    {
      key: 'ai',
      label: '智能回复',
      sub: '自动生成',
      icon: aiAssistLoading ? (
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      ) : (
        <Sparkles className="h-6 w-6 text-blue-600" />
      ),
      disabled: aiAssistLoading,
      onClick: wrapAction(onAiAssist),
    },
    {
      key: 'tpl',
      label: '模板',
      sub: '插入',
      icon: <FileText className="h-6 w-6 text-slate-600" />,
      onClick: wrapAction(onOpenTemplate),
    },
    ...(ticket && onTicketPatch
      ? [
          {
            key: 'read',
            label: readToggleLabel(ticket),
            sub: isTicketUnreadForList(ticket) ? '当前未读' : '当前已读',
            icon: isTicketUnreadForList(ticket) ? (
              <MailOpen className="h-6 w-6 text-amber-600" />
            ) : (
              <Mail className="h-6 w-6 text-amber-600" />
            ),
            onClick: wrapAction(() => onTicketPatch(buildToggleReadPatch(ticket))),
          } as MoreItem,
          {
            key: 'reply',
            label: repliedToggleLabel(ticket),
            sub:
              ticket.messageProcessingStatus === 'replied' ? '已回复' : '待回复',
            icon:
              ticket.messageProcessingStatus === 'replied' ? (
                <MessageCircle className="h-6 w-6 text-orange-600" />
              ) : (
                <CheckCircle2 className="h-6 w-6 text-orange-600" />
              ),
            onClick: wrapAction(() => onTicketPatch(buildToggleRepliedPatch(ticket))),
          } as MoreItem,
        ]
      : []),
    {
      key: 'file',
      label: '添加文件',
      sub: '本机',
      icon: <Paperclip className="h-6 w-6 text-slate-600" />,
      onClick: () => {
        closeMore();
        fileInputRef.current?.click();
      },
    },
  ];

  return (
    <div className={cn(H5_COMPOSER_BAR, H5_SAFE_BOTTOM, 'relative flex flex-col')}>
      {moreOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] cursor-default bg-slate-900/35"
            aria-label="关闭更多功能"
            onClick={closeMore}
          />
          <div
            className="relative z-[62] max-h-[min(52vh,26rem)] w-full overflow-y-auto rounded-t-2xl border border-b-0 border-slate-200 bg-white shadow-[0_-8px_30px_rgba(15,23,42,0.12)] animate-in slide-in-from-bottom-4 duration-200"
            role="dialog"
            aria-label="更多功能"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2 pb-1">
              <div className="h-1 w-9 rounded-full bg-slate-200" />
            </div>
            <div className="grid grid-cols-4 gap-x-1 gap-y-5 px-3 pb-4 pt-2">
              {moreItems.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  disabled={it.disabled}
                  onClick={it.onClick}
                  className="flex flex-col items-center gap-1 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <span className="flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-2xl bg-slate-100 ring-1 ring-slate-200/60">
                    {it.icon}
                  </span>
                  <span className="max-w-[4.5rem] truncate text-center text-[11px] font-medium text-slate-700">
                    {it.label}
                  </span>
                  {it.sub ? (
                    <span className="max-w-[4.5rem] truncate text-center text-[9px] leading-tight text-slate-400">
                      {it.sub}
                    </span>
                  ) : (
                    <span className="h-[9px]" />
                  )}
                </button>
              ))}
            </div>

            {sendSubOpen ? (
              <div className="border-t border-slate-100 px-4 py-3">
                <p className="mb-2 text-xs font-semibold text-slate-700">选择发送对象</p>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                    <span>客户</span>
                    <ToggleSwitch
                      checked={sendToCustomer}
                      onChange={onSendToCustomerChange}
                      aria-label="发送至客户"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                    <span>经理</span>
                    <ToggleSwitch
                      checked={sendToManager}
                      onChange={onSendToManagerChange}
                      aria-label="发送至平台经理"
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {composerNotice ? (
        <div
          role="alert"
          className={cn(
            'relative z-[62] flex items-start justify-between gap-2 border-b px-3 py-2 text-xs font-medium',
            composerNotice.type === 'error' &&
              'border-red-100 bg-red-50/95 text-red-800',
            composerNotice.type === 'success' &&
              'border-emerald-100 bg-emerald-50/95 text-emerald-800',
            composerNotice.type === 'info' && 'border-slate-200 bg-slate-50/95 text-slate-700'
          )}
        >
          <span className="min-w-0 flex-1 leading-relaxed">{composerNotice.message}</span>
          {onDismissComposerNotice ? (
            <button
              type="button"
              onClick={onDismissComposerNotice}
              className="shrink-0 rounded p-0.5 opacity-70 active:opacity-100"
              aria-label="关闭提示"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}

      {isInternalNote ? (
        <div className="relative z-[62] flex items-center justify-between gap-2 border-b border-orange-100 bg-orange-50/90 px-3 py-2 text-xs font-medium text-[#F97316]">
          <span>内部备注（仅团队可见）</span>
          {onExitInternalNote ? (
            <button
              type="button"
              onClick={onExitInternalNote}
              className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold text-orange-800 active:bg-orange-100"
            >
              回复买家
            </button>
          ) : null}
        </div>
      ) : null}

      {translateLoading ? (
        <div
          className="relative z-[62] flex items-center gap-2 border-b border-orange-100 bg-orange-50/90 px-3 py-2 text-xs font-medium text-[#F97316]"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          正在翻译，请稍候…
        </div>
      ) : null}

      <div className={cn(H5_COMPOSER_ROW, 'relative z-[62] items-end bg-white/95 pb-2 supports-[backdrop-filter]:bg-white/90 backdrop-blur-sm')}>
        <div className="relative min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={replyText}
            onChange={(e) => onReplyTextChange(e.target.value)}
            placeholder={
              translateLoading
                ? '正在翻译…'
                : isInternalNote
                  ? '输入内部备注…'
                  : '输入要发送的消息…'
            }
            aria-label={isInternalNote ? '内部备注' : '回复消息'}
            aria-busy={translateLoading}
            rows={1}
            readOnly={translateLoading}
            className={cn(
              H5_COMPOSER_INPUT,
              'w-full pr-[5.25rem]',
              translateLoading && 'opacity-60'
            )}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!sendDisabled) onSend();
              }
            }}
          />
          <div className="absolute bottom-[3px] right-1.5 flex items-center gap-0.5">
            {onTranslateDraft ? (
              <button
                type="button"
                className={cn(
                  H5_COMPOSER_INLINE_BTN,
                  translateLoading && 'bg-orange-50 text-[#F97316]'
                )}
                disabled={translateLoading}
                aria-busy={translateLoading}
                onClick={() => {
                  if (translateLoading) return;
                  setMoreOpen(false);
                  onTranslateDraft();
                }}
                aria-label={translateLoading ? '正在翻译' : '翻译'}
                title={translateLoading ? '正在翻译' : '翻译'}
              >
                {translateLoading ? (
                  <Loader2 className="h-[1.15rem] w-[1.15rem] animate-spin text-[#F97316]" />
                ) : (
                  <Languages className="h-[1.15rem] w-[1.15rem]" />
                )}
              </button>
            ) : null}
            <button
              type="button"
              className={cn(H5_COMPOSER_INLINE_BTN, moreOpen && 'bg-slate-100 text-slate-800')}
              aria-label={moreOpen ? '关闭更多功能' : '更多功能'}
              onClick={() => {
                setMoreOpen((v) => !v);
                if (moreOpen) setSendSubOpen(false);
              }}
            >
              {moreOpen ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            id={fileInputId}
            className="hidden"
            multiple
            aria-label="添加附件"
            onChange={(e) => {
              const list = e.target.files;
              if (list?.length) onPickFiles?.(list);
              e.target.value = '';
            }}
          />
        </div>

        <button
          type="button"
          className={H5_COMPOSER_SEND}
          disabled={sendDisabled || translateLoading}
          onClick={onSend}
          aria-label={sendLabel}
        >
          {sendLabel}
        </button>
      </div>
    </div>
  );
}
