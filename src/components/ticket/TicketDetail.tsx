import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Send, 
  Paperclip, 
  Smile, 
  User, 
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Sparkles,
  FileText,
  Info,
  Loader2,
  ChevronDown,
  Upload,
  ExternalLink,
  Package,
  Truck,
  Download,
  ArrowRight,
  Plus,
  RotateCcw,
  AlertTriangle,
  History,
  Briefcase,
  X,
  Languages,
  Check,
  Search,
  ThumbsUp,
  Copy,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import { platformGroupLabelForTicket } from '@/src/lib/platformLabels';
import {
  Ticket,
  TicketStatus,
  Sentiment,
  Message,
  Order,
  Customer,
  LogisticsStatus,
  AfterSalesRecord,
  AfterSalesType,
  AfterSalesStatus,
} from '@/src/types';
import { format } from 'date-fns';
import { generateReplySuggestion } from '@/src/services/geminiService';
import { useAuth } from '@/src/hooks/useAuth';
import {
  intellideskConfigured,
  intellideskTenantId,
  intellideskUserIdForApi,
  fetchAfterSalesList,
} from '@/src/services/intellideskApi';
import InvoicePreviewModal from './InvoicePreviewModal';
import SubmitAfterSalesModal from './SubmitAfterSalesModal';
import {
  getTranslationSettings,
  getTicketSubjectForDisplay,
} from '@/src/components/settings/TranslationSettingsPage';
import { getActiveReplyTemplatesForPicker } from '@/src/lib/replyTemplatesStore';
import {
  TicketDetailStatusChips,
  TicketConversationStatusSelect,
  detailHeaderSelectClassName,
} from '@/src/lib/ticketStatusUi';
import { appendStoredCitationFeedback } from '@/src/lib/citationFeedbackStore';

const DEFAULT_MAIN_SYSTEM_ORDER_BASE =
  'https://tiaojia.nezhachuhai.com/dashboard/analyzeOrder/platformOrderDetail';

/** AI 引用来源演示（与设置-知识库文档对应） */
const MOCK_KB_CITATIONS = [
  {
    id: 'cite-1',
    docName: '破损商品处理政策（2026Q1）',
    excerpt:
      '若商品在送达时已损坏，买家可申请全额退款至原支付方式，或选择免费换货。请在 48 小时内提交清晰照片作为凭证。',
  },
  {
    id: 'cite-2',
    docName: '退换货 SLA 与物流说明',
    excerpt: '客服应在首次接触后 24 小时内给出解决方案选项（退款/补发/部分补偿），并与买家确认。',
  },
] as const;

function messageDisplayText(
  message: Message,
  opts: {
    translationOn: boolean;
    showOriginal: boolean;
  }
): { text: string; hasPair: boolean; showingOriginal: boolean } {
  const { translationOn, showOriginal } = opts;

  if (
    message.senderType === 'agent' &&
    !message.isInternal &&
    message.sentPlatformText
  ) {
    if (showOriginal) {
      return {
        text: message.content,
        hasPair: true,
        showingOriginal: true,
      };
    }
    return {
      text: message.sentPlatformText,
      hasPair: true,
      showingOriginal: false,
    };
  }

  if (
    translationOn &&
    message.translatedContent &&
    (message.senderType === 'customer' ||
      message.senderType === 'manager' ||
      message.senderType === 'ai')
  ) {
    if (showOriginal) {
      return {
        text: message.content,
        hasPair: true,
        showingOriginal: true,
      };
    }
    return {
      text: message.translatedContent,
      hasPair: true,
      showingOriginal: false,
    };
  }

  return {
    text: message.content,
    hasPair: false,
    showingOriginal: false,
  };
}

function buildMainSystemOrderUrl(order: Order): string {
  const base =
    (typeof import.meta !== 'undefined' &&
      (import.meta as { env?: Record<string, string> }).env?.VITE_MAIN_SYSTEM_ORDER_URL) ||
    DEFAULT_MAIN_SYSTEM_ORDER_BASE;
  const q = new URLSearchParams({
    platformOrderId: order.platformOrderId,
    orderId: order.id,
    channelId: order.channelId,
  });
  return `${base}?${q.toString()}`;
}

interface TicketDetailProps {
  ticket: Ticket;
  messages: Message[];
  order?: Order;
  customer?: Customer;
  /** 发送回复：可指定送达客户、平台经理或同时送达 */
  onSendMessage?: (payload: {
    content: string;
    recipients: ('customer' | 'manager')[];
    isInternal: boolean;
    translateToPlatform?: boolean;
  }) => void;
  onSend?: () => void;
  /** 可选坐席列表；与 onAssignSeat 同时传入时展示「分配给坐席」下拉 */
  seatOptions?: { id: string; label: string }[];
  /** 当前选中的坐席 id，未分配为空串 */
  assignedSeatId?: string | null;
  onAssignSeat?: (seatId: string | null) => void;
  /** 手动修改工单字段（演示：会话处理状态等） */
  onUpdateTicket?: (patch: Partial<Ticket>) => void;
}

export default function TicketDetail({
  ticket,
  messages,
  order,
  customer,
  onSendMessage,
  onSend,
  seatOptions,
  assignedSeatId: assignedSeatIdProp,
  onAssignSeat,
  onUpdateTicket,
}: TicketDetailProps) {
  const { user } = useAuth();
  const [replyText, setReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [showTemplatePopover, setShowTemplatePopover] = useState(false);
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'order' | 'logistics' | 'invoice' | 'after-sales'>('order');
  const [isOrderInfoOpen, setIsOrderInfoOpen] = useState(true);
  const [isInternalNotesOpen, setIsInternalNotesOpen] = useState(true);
  const [isReplyExpanded, setIsReplyExpanded] = useState(false);
  const [invoiceTemplate, setInvoiceTemplate] = useState('standard');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isAfterSalesModalOpen, setIsAfterSalesModalOpen] = useState(false);
  const [afterSalesRecords, setAfterSalesRecords] = useState<AfterSalesRecord[]>([]);
  const [sendToCustomer, setSendToCustomer] = useState(true);
  const [sendToManager, setSendToManager] = useState(false);
  const [showOriginalByMessageId, setShowOriginalByMessageId] = useState<Record<string, boolean>>({});
  const [platformTranslateOnSend, setPlatformTranslateOnSend] = useState(false);
  const [citationMessageId, setCitationMessageId] = useState<string | null>(null);
  const [citationRecordHint, setCitationRecordHint] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!intellideskConfigured()) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchAfterSalesList(
          intellideskTenantId(),
          intellideskUserIdForApi(user?.id),
          { ticketId: ticket.id }
        );
        if (!cancelled) setAfterSalesRecords(rows);
      } catch {
        if (!cancelled) setAfterSalesRecords([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticket.id, user?.id]);

  const recordKbCitationFeedback = (
    kind: 'helpful' | 'stale' | 'pending',
    cite: (typeof MOCK_KB_CITATIONS)[number]
  ) => {
    const excerptShort =
      cite.excerpt.length > 80 ? `${cite.excerpt.slice(0, 80)}…` : cite.excerpt;
    appendStoredCitationFeedback({
      ticketRef: `#${ticket.id}`,
      snippet: `引用：《${cite.docName}》${excerptShort}`,
      feedback: kind,
      docId: cite.id,
      messageId: citationMessageId ?? undefined,
    });
    const map = {
      helpful: '已标记「有用」，已写入「设置 → 知识库 → 引用与反馈」',
      stale: '已标记「待更新」，已写入「设置 → 知识库 → 引用与反馈」',
      pending: '已标记「待跟进」，已写入「设置 → 知识库 → 引用与反馈」',
    } as const;
    setCitationRecordHint(map[kind]);
    window.setTimeout(() => setCitationRecordHint(null), 4000);
  };

  const translationSettings = getTranslationSettings();
  const outboundTranslateActive =
    translationSettings.autoTranslateEnabled && translationSettings.outboundTranslateOnSend;
  const showPlatformTranslateCheckbox =
    outboundTranslateActive && translationSettings.allowSendOriginalChinese;

  useEffect(() => {
    setIsReplyExpanded(false);
    setReplyText('');
    setShowOriginalByMessageId({});
    setCitationMessageId(null);
    const s = getTranslationSettings();
    const active = s.autoTranslateEnabled && s.outboundTranslateOnSend;
    setPlatformTranslateOnSend(s.allowSendOriginalChinese ? active : !!active);
  }, [ticket.id]);

  useEffect(() => {
    if (!isInternalNote && !sendToCustomer && !sendToManager) {
      setSendToCustomer(true);
    }
  }, [isInternalNote, sendToCustomer, sendToManager]);

  const [copiedOrderId, setCopiedOrderId] = useState(false);

  const handleCopyOrderId = (orderId: string) => {
    navigator.clipboard.writeText(orderId);
    setCopiedOrderId(true);
    setTimeout(() => setCopiedOrderId(false), 2000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const internalNotes = useMemo(() => {
    const filtered = messages.filter((m) => m.isInternal && m.senderType === 'agent');
    const byId = new Map<string, Message>();
    for (const m of filtered) {
      if (!byId.has(m.id)) byId.set(m.id, m);
    }
    return [...byId.values()].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [messages]);

  const [pickerTemplates, setPickerTemplates] = useState(() => getActiveReplyTemplatesForPicker());

  useEffect(() => {
    const sync = () => setPickerTemplates(getActiveReplyTemplatesForPicker());
    window.addEventListener('intellidesk-templates-changed', sync);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'intellidesk.templates.v1' || e.key === null) sync();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('intellidesk-templates-changed', sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const visibleMessages = useMemo(
    () => messages.filter((m) => !m.isInternal),
    [messages]
  );

  const getStatusIcon = (status: TicketStatus) => {
    switch (status) {
      case TicketStatus.RESOLVED: return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case TicketStatus.WAITING: return <Clock className="w-4 h-4 text-amber-500" />;
      case TicketStatus.NEW: return <AlertCircle className="w-4 h-4 text-blue-500" />;
      default: return <MessageSquare className="w-4 h-4 text-slate-400" />;
    }
  };

  const getLogisticsStatusConfig = (status?: LogisticsStatus) => {
    switch (status) {
      case LogisticsStatus.NOT_FOUND: return { label: '查询不到', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' };
      case LogisticsStatus.INFO_RECEIVED: return { label: '已接收信息', color: 'bg-blue-50 text-blue-600 border-blue-200', dot: 'bg-blue-500' };
      case LogisticsStatus.IN_TRANSIT: return { label: '运输中', color: 'bg-orange-50 text-orange-600 border-orange-200', dot: 'bg-orange-500' };
      case LogisticsStatus.AVAILABLE_FOR_PICKUP: return { label: '到达待取', color: 'bg-cyan-50 text-cyan-600 border-cyan-200', dot: 'bg-cyan-500' };
      case LogisticsStatus.OUT_FOR_DELIVERY: return { label: '派送中', color: 'bg-purple-50 text-purple-600 border-purple-200', dot: 'bg-purple-500' };
      case LogisticsStatus.DELIVERED: return { label: '已妥投', color: 'bg-green-50 text-green-600 border-green-200', dot: 'bg-green-500' };
      case LogisticsStatus.DELIVERY_FAILURE: return { label: '投递失败', color: 'bg-red-50 text-red-600 border-red-200', dot: 'bg-red-500' };
      case LogisticsStatus.EXPIRED: return { label: '运输过久', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' };
      case LogisticsStatus.EXCEPTION: return { label: '异常', color: 'bg-red-50 text-red-600 border-red-200', dot: 'bg-red-500' };
      default: return { label: '未知', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' };
    }
  };

  /** 物流接口未必返回预计送达；空串、纯空白、未定义均展示「未知」 */
  const formatDeliveryEtaDisplay = (eta?: string) => {
    const v = eta?.trim();
    return v ? v : '未知';
  };

  const handleGenerateDraft = async () => {
    if (isGeneratingDraft) return;
    
    setIsGeneratingDraft(true);
    try {
      const suggestion = await generateReplySuggestion(ticket, messages, order, user?.id);
      if (suggestion) {
        setReplyText(suggestion);
        setIsReplyExpanded(true);
      }
    } catch (error) {
      console.error('Failed to generate AI draft:', error);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleSubmitAfterSales = (_data: Record<string, unknown>) => {
    if (intellideskConfigured()) return;
    const newRecord: AfterSalesRecord = {
      id: `AS-${Math.floor(Math.random() * 1000)}`,
      orderId: order?.id || '',
      ticketId: ticket.id,
      type: AfterSalesType.REFUND,
      status: AfterSalesStatus.SUBMITTED,
      handlingMethod: '待确认',
      priority: 'low',
      problemType: '质量问题',
      buyerFeedback: '产品收到时有划痕',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setAfterSalesRecords([newRecord, ...afterSalesRecords]);
    setIsAfterSalesModalOpen(false);
  };

  const handleSend = () => {
    const text = replyText.trim();
    if (!text) return;

    const recipients: ('customer' | 'manager')[] = [];
    if (!isInternalNote) {
      if (sendToCustomer) recipients.push('customer');
      if (sendToManager) recipients.push('manager');
      if (recipients.length === 0) return;
    }

    setReplyText('');
    setIsReplyExpanded(false);

    if (onSendMessage) {
      const translateToPlatform =
        !isInternalNote &&
        outboundTranslateActive &&
        (translationSettings.allowSendOriginalChinese
          ? platformTranslateOnSend
          : true);
      onSendMessage({
        content: text,
        recipients,
        isInternal: isInternalNote,
        translateToPlatform,
      });
    } else if (onSend) {
      onSend();
    }
  };

  const outboundRecipientReady = isInternalNote || sendToCustomer || sendToManager;

  const assignSeatValue = assignedSeatIdProp ?? ticket.assignedSeatId ?? '';

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      {/* Main Conversation Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white border-r border-slate-200">
        {/* Header */}
        <header className="border-b border-slate-200 px-6 py-3 bg-white shrink-0">
          <div className="flex flex-col gap-1 min-w-0 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                {getStatusIcon(ticket.status)}
                <h2 className="text-base font-bold text-slate-900 truncate">
                  {getTicketSubjectForDisplay(ticket)}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-slate-500">
                <span className="font-medium text-slate-400">#{ticket.id}</span>
                <span className="w-1 h-1 bg-slate-300 rounded-full shrink-0" />
                <span className="font-medium uppercase tracking-wider">{ticket.channelId}</span>
              </div>
              <TicketDetailStatusChips
                ticket={ticket}
                order={order}
                renderConversationAside={Boolean(onUpdateTicket)}
                onMessageProcessingStatusChange={
                  onUpdateTicket
                    ? (status) => onUpdateTicket({ messageProcessingStatus: status })
                    : undefined
                }
              />
            </div>

            {((seatOptions && seatOptions.length > 0 && onAssignSeat) || onUpdateTicket) && (
              <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto lg:pt-1 lg:items-end">
                {seatOptions && seatOptions.length > 0 && onAssignSeat && (
                  <div className="flex items-center gap-2 min-w-0 justify-end w-full sm:w-auto">
                    <label
                      htmlFor={`assign-seat-${ticket.id}`}
                      className="text-xs font-medium text-slate-500 whitespace-nowrap hidden lg:inline"
                    >
                      分配给坐席
                    </label>
                    <div className="relative w-full max-w-[8rem] sm:w-[8rem]">
                      <select
                        id={`assign-seat-${ticket.id}`}
                        value={assignSeatValue}
                        onChange={(e) => onAssignSeat(e.target.value || null)}
                        className={detailHeaderSelectClassName}
                        title="选择负责跟进的客服坐席"
                        aria-label="分配给坐席"
                      >
                        <option value="">未分配</option>
                        {seatOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>
                )}
                {onUpdateTicket && (
                  <div className="flex items-center gap-2 min-w-0 justify-end w-full sm:w-auto">
                    <label
                      htmlFor={`conv-status-${ticket.id}`}
                      className="text-xs font-medium text-slate-500 whitespace-nowrap hidden lg:inline"
                    >
                      会话状态
                    </label>
                    <div className="w-full max-w-[8rem] sm:w-[8rem] min-w-0">
                      <TicketConversationStatusSelect
                        selectId={`conv-status-${ticket.id}`}
                        ticket={ticket}
                        onChange={(status) => onUpdateTicket({ messageProcessingStatus: status })}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
        
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {visibleMessages.map((message) => {
            const showOriginal = !!showOriginalByMessageId[message.id];
            const disp = messageDisplayText(message, {
              translationOn: translationSettings.autoTranslateEnabled,
              showOriginal,
            });
            const isRtl = message.senderType === 'agent' || message.senderType === 'ai';

            return (
            <div 
              key={message.id} 
              className={cn(
                "flex gap-4 max-w-[85%]",
                isRtl ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                message.senderType === 'customer' ? "bg-blue-100 text-blue-600" :
                message.senderType === 'manager' ? "bg-amber-100 text-amber-700" :
                message.senderType === 'system' ? "bg-slate-200 text-slate-600" :
                message.senderType === 'ai' ? "bg-purple-100 text-purple-600" : "bg-slate-200 text-slate-600"
              )}>
                {message.senderType === 'customer' ? <User className="w-4 h-4" /> :
                 message.senderType === 'manager' ? <Briefcase className="w-4 h-4" /> :
                 message.senderType === 'system' ? <Info className="w-4 h-4" /> :
                 message.senderType === 'ai' ? <Sparkles className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              
              <div className={cn("space-y-1", isRtl ? "items-end flex flex-col" : "")}>
                <div className={cn(
                  "flex items-center gap-2 mb-1 w-full",
                  isRtl ? "justify-end" : ""
                )}>
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                    {message.senderType === 'ai' ? 'AI 助手' : message.senderId}
                    {message.senderType === 'manager' && (
                      <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-md">
                        平台经理
                      </span>
                    )}
                    {message.senderType === 'customer' && (
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md">
                        客户
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {format(new Date(message.createdAt), 'MM月dd日 HH:mm')}
                  </span>
                </div>
                
                <div className={cn(
                  "p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                  message.senderType === 'customer' ? "bg-white text-slate-800 border border-slate-200 rounded-tl-none" :
                  message.senderType === 'manager' ? "bg-amber-50 text-amber-950 border border-amber-200 rounded-tl-none" :
                  message.senderType === 'system' ? "bg-slate-100 text-slate-800 border border-slate-200 rounded-tl-none" :
                  message.senderType === 'ai' ? "bg-[#9333EA] text-white rounded-tr-none" :
                  message.isInternal ? "bg-orange-50 text-orange-900 border border-orange-100 rounded-tr-none" :
                  "bg-blue-600 text-white rounded-tr-none"
                )}>
                  {disp.text}
                </div>

                {disp.hasPair && (
                  <button
                    type="button"
                    onClick={() =>
                      setShowOriginalByMessageId((prev) => ({
                        ...prev,
                        [message.id]: !prev[message.id],
                      }))
                    }
                    className={cn(
                      'text-[10px] font-medium hover:underline',
                      isRtl ? 'text-slate-500 hover:text-slate-700' : 'text-blue-600 hover:text-blue-800'
                    )}
                  >
                    {disp.showingOriginal ? '查看译文' : '查看原文'}
                  </button>
                )}

                {message.senderType === 'agent' && message.deliveryTargets && message.deliveryTargets.length > 0 && (
                  <p className={cn(
                    "text-[10px] text-slate-400 mt-0.5",
                    isRtl ? "text-right w-full" : ""
                  )}>
                    已发送给：{message.deliveryTargets.map((t) => (t === 'customer' ? '客户' : '平台经理')).join('、')}
                    {message.sentPlatformText && ' · 已按平台语发送'}
                  </p>
                )}
                
                {message.senderType === 'ai' && (
                  <div className={cn("flex items-center gap-3 mt-1", isRtl ? "justify-end flex-wrap" : "")}>
                    <button
                      type="button"
                      onClick={() => setCitationMessageId(message.id)}
                      className="text-[10px] font-medium text-[#9333EA] hover:underline inline-flex items-center gap-1"
                    >
                      <Info className="w-3 h-3" />
                      查看引用来源
                    </button>
                  </div>
                )}
              </div>
            </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Reply Area */}
        <div className="p-6 bg-white border-t border-slate-200 shrink-0 flex flex-col gap-4">
          {isReplyExpanded && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-4">
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button 
                    onClick={() => setIsInternalNote(false)}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                      !isInternalNote ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    回复买家
                  </button>
                  <button 
                    onClick={() => setIsInternalNote(true)}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                      isInternalNote ? "bg-white text-[#F97316] shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    内部备注
                  </button>
                </div>
                
                <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
                  {!isInternalNote && outboundTranslateActive && showPlatformTranslateCheckbox && (
                    <div
                      className="inline-flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-lg border border-slate-200 bg-white shadow-sm"
                      title="开启后发送前译为当前店铺平台语言并计积分"
                    >
                      <Languages className="w-3.5 h-3.5 text-slate-500 shrink-0" strokeWidth={2} />
                      <span className="text-xs font-medium text-slate-700 whitespace-nowrap">自动翻译</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={platformTranslateOnSend}
                        aria-label="自动翻译"
                        onClick={() => setPlatformTranslateOnSend(!platformTranslateOnSend)}
                        className={cn(
                          'relative h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1',
                          platformTranslateOnSend ? 'bg-indigo-500' : 'bg-slate-200'
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                            platformTranslateOnSend ? 'translate-x-4' : 'translate-x-0'
                          )}
                        />
                      </button>
                    </div>
                  )}
                  {!isInternalNote && outboundTranslateActive && !showPlatformTranslateCheckbox && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200">
                      <Languages className="w-3.5 h-3.5 opacity-70" />
                      将自动译为平台语
                    </span>
                  )}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowTemplatePopover((v) => !v)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 border hover:bg-slate-50 rounded-lg text-xs font-medium transition-colors shadow-sm",
                        showTemplatePopover ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-white border-slate-200 text-slate-700"
                      )}
                    >
                      插入模板
                      <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform", showTemplatePopover && "rotate-180")} />
                    </button>

                    {showTemplatePopover && (
                      <div className="absolute right-0 top-full mt-2 w-[340px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                          <div className="relative">
                            <input
                              type="text"
                              autoFocus
                              placeholder="搜索模板名称、内容..."
                              value={templateSearchQuery}
                              onChange={(e) => setTemplateSearchQuery(e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                            />
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          </div>
                        </div>
                        <div className="max-h-[280px] overflow-y-auto p-2 space-y-1">
                          {pickerTemplates
                            .filter(
                              (tpl) =>
                                tpl.title.toLowerCase().includes(templateSearchQuery.toLowerCase()) ||
                                tpl.content.toLowerCase().includes(templateSearchQuery.toLowerCase())
                            )
                            .map((tpl) => (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => {
                                setReplyText((prev) => (prev ? prev + '\n' : '') + tpl.content);
                                setShowTemplatePopover(false);
                                setTemplateSearchQuery('');
                              }}
                              className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-slate-800 group-hover:text-[#F97316] transition-colors line-clamp-1">
                                  {tpl.title}
                                </span>
                                <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                  {tpl.platform}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                {tpl.content}
                              </p>
                            </button>
                          ))}
                          {pickerTemplates.filter(
                            (tpl) =>
                              tpl.title.toLowerCase().includes(templateSearchQuery.toLowerCase()) ||
                              tpl.content.toLowerCase().includes(templateSearchQuery.toLowerCase())
                          ).length === 0 && (
                            <div className="px-3 py-8 text-center text-xs text-slate-400">
                              没有找到匹配的模板
                            </div>
                          )}
                        </div>
                        <div className="p-2 border-t border-slate-100 bg-slate-50/50">
                          <Link 
                            to="/settings/templates" 
                            className="text-[11px] font-medium text-[#F97316] hover:underline flex items-center justify-center"
                          >
                            管理所有模板
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateDraft}
                    disabled={isGeneratingDraft}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-[#9333EA] hover:bg-purple-100 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-purple-100 shadow-sm',
                      isGeneratingDraft ? 'animate-pulse' : ''
                    )}
                  >
                    {isGeneratingDraft ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {isGeneratingDraft ? '生成中...' : 'AI 草稿'}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <div className={cn(
            "relative border rounded-xl transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500/20",
            isInternalNote ? "bg-orange-50/30 border-orange-200" : "bg-white border-slate-200"
          )}>
            <textarea
              placeholder={isInternalNote ? "输入内部备注... (@提及同事)" : "点击输入回复内容..."}
              className={cn(
                "w-full p-4 bg-transparent outline-none text-sm resize-none transition-all duration-200",
                isReplyExpanded ? "min-h-[120px]" : "min-h-[44px] h-[44px] overflow-hidden"
              )}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onFocus={() => setIsReplyExpanded(true)}
            />
            
            {isReplyExpanded && (
              <div className="p-3 border-t border-slate-100 animate-in fade-in duration-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button type="button" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                      <Smile className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-end min-w-0 flex-1">
                    {!isInternalNote && (
                      <div className="flex flex-wrap items-center gap-2 pr-2 sm:border-r sm:border-slate-200">
                        <span className="text-[10px] font-semibold text-slate-600 leading-tight shrink-0 mr-0.5 self-center">
                          收件人
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            aria-pressed={sendToCustomer}
                            onClick={() => setSendToCustomer((v) => !v)}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
                              sendToCustomer
                                ? 'border-blue-200 bg-blue-50 text-blue-900'
                                : 'border-dashed border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                                sendToCustomer
                                  ? 'border-blue-600 bg-blue-600 text-white'
                                  : 'border-slate-300 bg-white'
                              )}
                              aria-hidden
                            >
                              {sendToCustomer && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                            </span>
                            客户
                          </button>
                          <button
                            type="button"
                            aria-pressed={sendToManager}
                            onClick={() => setSendToManager((v) => !v)}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
                              sendToManager
                                ? 'border-amber-200 bg-amber-50 text-amber-950'
                                : 'border-dashed border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                                sendToManager
                                  ? 'border-amber-600 bg-amber-600 text-white'
                                  : 'border-slate-300 bg-white'
                              )}
                              aria-hidden
                            >
                              {sendToManager && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                            </span>
                            平台经理
                          </button>
                        </div>
                        {!outboundRecipientReady && (
                          <span className="text-amber-600 text-[11px] font-medium w-full sm:w-auto">
                            请至少选择一名收件人
                          </span>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsReplyExpanded(false)}
                      className="px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!replyText.trim() || !outboundRecipientReady}
                      title={!outboundRecipientReady && !isInternalNote ? '请至少选择客户或平台经理' : undefined}
                      className={cn(
                        'flex items-center gap-2 px-6 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-all',
                        isInternalNote
                          ? 'bg-[#F97316] hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed'
                      )}
                    >
                      {isInternalNote ? '保存备注' : '发送'}
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Right Sidebar - Business Intelligence */}
      <div className="w-[320px] flex flex-col shrink-0 bg-white overflow-y-auto border-l border-slate-200">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-2 pt-2">
          <button 
            onClick={() => setActiveTab('order')}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === 'order' ? "border-[#F97316] text-[#F97316]" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            订单
          </button>
          <button 
            onClick={() => setActiveTab('logistics')}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === 'logistics' ? "border-[#F97316] text-[#F97316]" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            物流
          </button>
          <button 
            onClick={() => setActiveTab('invoice')}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === 'invoice' ? "border-[#F97316] text-[#F97316]" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            发票
          </button>
          <button 
            onClick={() => setActiveTab('after-sales')}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === 'after-sales' ? "border-[#F97316] text-[#F97316]" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            售后
          </button>
        </div>

        {activeTab === 'order' && (
          <div className="flex flex-col">
            {/* Customer Info */}
            <section className="p-4 border-b border-slate-100">
              {customer ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                    {customer.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{customer.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      平台{' '}
                      <span className="font-medium text-slate-700">
                        {platformGroupLabelForTicket(ticket.platformType, ticket.channelId)}
                      </span>
                      <span className="mx-1">·</span>
                      店铺 <span className="font-medium text-slate-700">{ticket.channelId}</span>
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">未关联客户数据</p>
              )}
            </section>
            
            {/* Order Info */}
            <section className="border-b border-slate-100">
              <button 
                onClick={() => setIsOrderInfoOpen(!isOrderInfoOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  订单信息
                </h3>
                <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isOrderInfoOpen ? "rotate-180" : "")} />
              </button>
              
              {isOrderInfoOpen && (
                <div className="px-4 pb-4 space-y-4">
                  {order ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1 group">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">订单号</p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-blue-600 hover:underline cursor-pointer">{order.platformOrderId}</p>
                            <button
                              onClick={() => handleCopyOrderId(order.platformOrderId)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-blue-600 rounded"
                              title="复制订单号"
                            >
                              {copiedOrderId ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-md font-bold border",
                          order.orderStatus === 'unshipped' ? "bg-amber-50 text-amber-600 border-amber-200" :
                          order.orderStatus === 'shipped' ? "bg-blue-50 text-blue-600 border-blue-200" :
                          order.orderStatus === 'refunded' ? "bg-red-50 text-red-600 border-red-200" :
                          order.orderStatus === 'partial_refund' ? "bg-orange-50 text-orange-600 border-orange-200" :
                          "bg-slate-50 text-slate-600 border-slate-200"
                        )}>
                          {order.orderStatus === 'unshipped' ? '未发货' :
                           order.orderStatus === 'shipped' ? '已发货' :
                           order.orderStatus === 'refunded' ? '已退款' :
                           order.orderStatus === 'partial_refund' ? '部分退款' : '未知状态'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">下单时间</p>
                          <p className="text-sm text-slate-900">2024-04-10</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">预计送达</p>
                          <p className="text-sm text-slate-900">{formatDeliveryEtaDisplay(order.deliveryEta)}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">收货地址</p>
                        <p className="text-sm text-slate-900 leading-tight">Calle del Doctor Fleming, 44, 112, Madrid, ES, Madrid, 28036</p>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">商品明细</p>
                        {order.productTitles.map((title, i) => (
                          <div key={i} className="flex justify-between text-sm text-slate-900">
                            <span className="truncate pr-2">{title}</span>
                            <span className="shrink-0 whitespace-nowrap">1 x ${order.amount}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="pt-2 border-t border-slate-100 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">税费</span>
                          <span className="text-slate-900">$11.72</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold">
                          <span className="text-slate-900">总计</span>
                          <span className="text-slate-900">${order.amount}</span>
                        </div>
                      </div>
                      
                      <a 
                        href={buildMainSystemOrderUrl(order)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-1 mt-4"
                      >
                        查看订单
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 italic">未关联订单数据</p>
                  )}
                </div>
              )}
            </section>

            {/* 内部备注（仅右侧汇总展示，主会话流不重复显示） */}
            <section className="border-b border-slate-100">
              <button
                type="button"
                onClick={() => setIsInternalNotesOpen(!isInternalNotesOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    内部备注
                  </h3>
                  {internalNotes.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-orange-100 text-[#F97316] border border-orange-200">
                      {internalNotes.length}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-slate-400 transition-transform shrink-0',
                    isInternalNotesOpen ? 'rotate-180' : ''
                  )}
                />
              </button>

              {isInternalNotesOpen && (
                <div className="px-4 pb-4 space-y-3">
                  {internalNotes.length === 0 ? (
                    <p className="text-xs text-slate-400 leading-relaxed">
                      暂无内部备注。在下方输入框切换为「内部备注」并保存后，将在此按时间记录客服、时间与内容。
                    </p>
                  ) : (
                    [...internalNotes]
                      .reverse()
                      .map((note) => (
                        <article
                          key={note.id}
                          className="rounded-xl border border-orange-100 bg-gradient-to-b from-orange-50/80 to-white p-3 shadow-sm space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-orange-100 text-[#F97316] flex items-center justify-center shrink-0">
                                <User className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate">客服 · {note.senderId}</p>
                                <p className="text-[10px] text-slate-500 tabular-nums">
                                  {format(new Date(note.createdAt), 'yyyy-MM-dd HH:mm')}
                                </p>
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap pl-9">
                            {note.content}
                          </p>
                        </article>
                      ))
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'logistics' && (
          <div className="flex flex-col h-full overflow-hidden">
            {order && order.logisticsEvents && order.logisticsEvents.length > 0 ? (
              <>
                {/* Logistics Header */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">{order.carrier || '未知承运商'}</p>
                        <p className="text-sm font-bold text-slate-900">{order.trackingNumber || '无运单号'}</p>
                      </div>
                    </div>
                    {order.logisticsStatus && (
                      <span className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-bold border",
                        getLogisticsStatusConfig(order.logisticsStatus).color
                      )}>
                        {getLogisticsStatusConfig(order.logisticsStatus).label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex flex-col">
                      <span className="text-slate-400">发货时间</span>
                      <span className="font-medium text-slate-700">
                        {order.logisticsEvents[order.logisticsEvents.length - 1] ? format(new Date(order.logisticsEvents[order.logisticsEvents.length - 1].timestamp), 'yyyy-MM-dd') : '-'}
                      </span>
                    </div>
                    <div className="w-px h-6 bg-slate-200" />
                    <div className="flex flex-col">
                      <span className="text-slate-400">预计送达</span>
                      <span className="font-medium text-slate-700">{formatDeliveryEtaDisplay(order.deliveryEta)}</span>
                    </div>
                  </div>
                </div>

                {/* Logistics Timeline */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="relative pl-4 border-l-2 border-slate-100 ml-4 space-y-6 pb-4">
                    {order.logisticsEvents.map((event, index) => {
                      const isLatest = index === 0;
                      const config = getLogisticsStatusConfig(event.status);
                      
                      return (
                        <div key={event.id} className="relative">
                          {/* Timeline Dot */}
                          <div className={cn(
                            "absolute -left-[21px] w-3 h-3 rounded-full border-2 border-white ring-4 ring-white",
                            isLatest ? config.dot : "bg-slate-300"
                          )} />
                          
                          <div className={cn(
                            "flex flex-col gap-1",
                            isLatest ? "opacity-100" : "opacity-60"
                          )}>
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                "text-sm font-bold",
                                isLatest ? "text-slate-900" : "text-slate-700"
                              )}>
                                {event.description}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="font-medium">{format(new Date(event.timestamp), 'yyyy-MM-dd HH:mm')}</span>
                              {event.location && (
                                <>
                                  <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                  <span>{event.location}</span>
                                </>
                              )}
                            </div>
                            {isLatest && event.subStatus && (
                              <div className="mt-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                  {event.subStatus}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Truck className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">暂无物流轨迹信息</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'invoice' && (
          <div className="flex flex-col h-full overflow-hidden bg-slate-50/50">
            {order?.hasVatInfo ? (
              <div className="p-6 flex flex-col h-full">
                <div className="flex-1 space-y-8">
                  <div className="text-center space-y-2 mb-8">
                    <div className="w-12 h-12 bg-orange-100 text-[#F97316] rounded-xl flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">生成发票</h3>
                    <p className="text-sm text-slate-500">请选择发票模版并预览</p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">选择发票模版</label>
                    <div className="grid grid-cols-1 gap-3">
                      {['simple', 'standard', 'detailed'].map((tpl) => (
                        <button 
                          key={tpl}
                          onClick={() => setInvoiceTemplate(tpl)}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-xl border-2 transition-all",
                            invoiceTemplate === tpl 
                              ? "border-[#F97316] bg-orange-50/50" 
                              : "border-slate-200 bg-white hover:border-slate-300"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                              invoiceTemplate === tpl ? "border-[#F97316]" : "border-slate-300"
                            )}>
                              {invoiceTemplate === tpl && <div className="w-2 h-2 rounded-full bg-[#F97316]" />}
                            </div>
                            <span className="font-medium text-slate-700">
                              {tpl === 'simple' ? '简易模版 (Receipt)' : tpl === 'standard' ? '标准模版 (Standard)' : '详细模版 (Commercial)'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200 mt-auto">
                  <button 
                    onClick={() => setIsPreviewModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#F97316] text-white rounded-xl text-sm font-bold hover:bg-[#ea580c] transition-colors shadow-sm"
                  >
                    <FileText className="w-4 h-4" />
                    生成并预览发票
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-orange-100 text-[#F97316] rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">未维护主体/VAT信息</h3>
                <p className="text-sm text-slate-500 mb-6 max-w-[240px]">
                  生成发票前，请先在店铺管理系统中维护您的店铺主体信息及 VAT 信息。
                </p>
                <a 
                  href="https://tiaojia.nezhachuhai.com/tools/vat/shop" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#F97316] text-white rounded-xl text-sm font-medium hover:bg-[#ea580c] transition-colors shadow-sm"
                >
                  去维护主体信息
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        )}

        {activeTab === 'after-sales' && (
          <div className="flex flex-col h-full bg-slate-50/50">
            {afterSalesRecords.length > 0 ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-900">已登记售后 ({afterSalesRecords.length})</h3>
                  <button 
                    onClick={() => setIsAfterSalesModalOpen(true)}
                    className="flex items-center gap-1 text-xs font-bold text-[#F97316] hover:underline"
                  >
                    <Plus className="w-3 h-3" />
                    再次提交
                  </button>
                </div>
                
                {afterSalesRecords.map((record) => (
                  <div key={record.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
                          record.type === AfterSalesType.REFUND ? "bg-red-50 text-red-600" : 
                          record.type === AfterSalesType.RETURN ? "bg-blue-50 text-blue-600" :
                          record.type === AfterSalesType.EXCHANGE ? "bg-purple-50 text-purple-600" :
                          "bg-green-50 text-green-600"
                        )}>
                          {record.type === AfterSalesType.REFUND ? '仅退款' : 
                           record.type === AfterSalesType.RETURN ? '退货退款' : 
                           record.type === AfterSalesType.EXCHANGE ? '换货' : '重发'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">{record.id}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-orange-50 text-[#F97316] text-[10px] font-bold border border-orange-100">
                        已提交
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-[11px]">
                      <div className="space-y-1">
                        <p className="text-slate-400 font-medium">处理方式</p>
                        <p className="text-slate-700 font-bold">{record.handlingMethod}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-400 font-medium">优先级</p>
                        <p className={cn(
                          "font-bold",
                          record.priority === 'high' ? "text-red-600" : "text-slate-700"
                        )}>{record.priority === 'high' ? '高' : record.priority === 'medium' ? '中' : '低'}</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        {format(new Date(record.createdAt), 'yyyy-MM-dd HH:mm')}
                      </span>
                      <button className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                        查看详情
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-orange-100 text-[#F97316] rounded-full flex items-center justify-center mb-4">
                  <RotateCcw className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">暂无售后记录</h3>
                <p className="text-sm text-slate-500 mb-6 max-w-[240px]">
                  该订单尚未登记任何售后申请。您可以点击下方按钮提交退款或退货申请。
                </p>
                <button 
                  onClick={() => setIsAfterSalesModalOpen(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-[#F97316] text-white rounded-xl text-sm font-bold hover:bg-[#ea580c] transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  提交售后申请
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI 知识库引用来源（演示） */}
      {citationMessageId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50"
            aria-label="关闭"
            onClick={() => setCitationMessageId(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md max-h-[min(80vh,520px)] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <h2 className="text-base font-bold text-slate-900">引用来源</h2>
              <button
                type="button"
                onClick={() => setCitationMessageId(null)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {citationRecordHint ? (
                <p className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  {citationRecordHint}
                </p>
              ) : null}
              <p className="text-xs text-slate-500">
                以下为当前 AI 回复所依据的知识库片段（演示数据）。可对单条提交反馈，数据写入本地并同步至「设置 → 知识库 → 引用与反馈」；上线后可改为埋点上报。
              </p>
              {MOCK_KB_CITATIONS.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-orange-100 bg-orange-50/40 p-4 space-y-3"
                >
                  <p className="text-xs font-bold text-slate-900">{c.docName}</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{c.excerpt}</p>
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-orange-100/80">
                    <button
                      type="button"
                      onClick={() => recordKbCitationFeedback('helpful', c)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/80"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      有用
                    </button>
                    <button
                      type="button"
                      onClick={() => recordKbCitationFeedback('stale', c)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 hover:border-amber-300 hover:bg-amber-50/80"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      内容需更新
                    </button>
                    <button
                      type="button"
                      onClick={() => recordKbCitationFeedback('pending', c)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      待跟进
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0 bg-slate-50/80 rounded-b-2xl">
              <Link
                to="/settings/knowledge"
                onClick={() => setCitationMessageId(null)}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-[#F97316] hover:underline"
              >
                在知识库中打开
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setCitationMessageId(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit After-sales Modal */}
      <SubmitAfterSalesModal
        isOpen={isAfterSalesModalOpen}
        onClose={() => setIsAfterSalesModalOpen(false)}
        order={order}
        onSubmit={handleSubmitAfterSales}
        apiSubmit={
          intellideskConfigured()
            ? {
                tenantId: intellideskTenantId(),
                userId: intellideskUserIdForApi(user?.id),
                defaultTicketId: ticket.id,
                onSuccess: async () => {
                  const rows = await fetchAfterSalesList(
                    intellideskTenantId(),
                    intellideskUserIdForApi(user?.id),
                    { ticketId: ticket.id }
                  );
                  setAfterSalesRecords(rows);
                },
              }
            : undefined
        }
      />

      {/* Invoice Preview Modal */}
      {order && (
        <InvoicePreviewModal 
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          template={invoiceTemplate}
          order={order}
          customer={customer}
        />
      )}
    </div>
  );
}
