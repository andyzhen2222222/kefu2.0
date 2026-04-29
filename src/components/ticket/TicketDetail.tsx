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
  ChevronUp,
  Upload,
  ExternalLink,
  Package,
  Truck,
  Download,
  ArrowRight,
  Plus,
  RefreshCw,
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
  ShieldCheck,
  Pencil,
  Trash2,
  Activity,
  Star,
  GripVertical,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import { platformGroupLabelForTicket } from '@/src/lib/platformLabels';
import {
  Ticket,
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
import {
  generateReplySuggestion,
  generateReplyPolish,
  summarizeTicketById,
} from '@/src/services/geminiService';
import { useAuth } from '@/src/hooks/useAuth';
import {
  intellideskConfigured,
  intellideskTenantId,
  intellideskUserIdForApi,
  fetchAfterSalesList,
  deleteAfterSalesRecord,
  postAiTranslate,
  postAiBatchTranslate,
  postAiClassifyIntent,
  postAiClassifySentiment,
  postAiTicketInsight,
  fetchOrderDetail,
  postOrderLogisticsSync,
  mapApiOrderToUi,
  setGlobalApiError,
  formatAiUserVisibleError,
} from '@/src/services/intellideskApi';
import InvoicePreviewModal from './InvoicePreviewModal';
import SubmitAfterSalesModal from './SubmitAfterSalesModal';
import AiSuggestionModal from './AiSuggestionModal';
import {
  getTranslationSettings,
  saveTranslationSettings,
  getTicketSubjectForDisplay,
  getInboundTargetLangLabel,
  inboundTranslationDisplayTag,
  type TranslationSettingsState,
} from '@/src/components/settings/TranslationSettingsPage';
import {
  getActiveReplyTemplatesForPicker,
  replyTemplatePickerRowMatchesTicket,
  type ReplyTemplatePickerRow,
} from '@/src/lib/replyTemplatesStore';
import { routingAfterSalesLabel } from '@/src/lib/routingRuleOptions';
import { ticketIntentMatchesAfterSalesCategoryValue } from '@/src/lib/replyTemplateIntentMatch';
import {
  TicketDetailStatusChips,
  TicketConversationStatusSelect,
  detailHeaderSelectClassName,
} from '@/src/lib/ticketStatusUi';
import { appendStoredCitationFeedback } from '@/src/lib/citationFeedbackStore';
import { displayOrderShippingAddress, formatOrderMoney } from '@/src/lib/orderDisplay';
import { htmlishMessageToPlainText, messageSenderLabel } from '@/src/lib/messageContent';
import {
  formatAfterSalesReadableLabel,
  formatTicketReadableRef,
} from '@/src/lib/businessRefDisplay';

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

const COMMON_EMOJIS = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁',
  '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨',
  '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲',
  '👋', '🤚', '🖐', '✋', '🖖', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎',
  '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '❤️', '💔', '💕', '💖', '💗', '💘', '💙', '💚',
  '💛', '🧡', '💜', '🖤', '🤍', '🤎', '🎁', '📦', '🚚', '✈️', '🛒', '🛍️', '🎉', '🎊', '🎈', '✅', '❌', '⚠️'
];

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
    isAiGenerated?: boolean;
    attachments?: string[];
  }) => void | Promise<void>;
  /** 侧栏「内部备注」：编辑保存（仅 isInternal + agent 消息） */
  onUpdateInternalNote?: (messageId: string, content: string) => void | Promise<void>;
  onDeleteInternalNote?: (messageId: string) => void | Promise<void>;
  onSend?: () => void;
  /** 可选坐席列表；与 onAssignSeat 同时传入时展示「分配给坐席」下拉 */
  seatOptions?: { id: string; label: string }[];
  /** 当前选中的坐席 id，未分配为空串 */
  assignedSeatId?: string | null;
  onAssignSeat?: (seatId: string | null) => void;
  /** 手动修改工单字段（演示：会话处理状态等） */
  onUpdateTicket?: (patch: Partial<Ticket>) => void;
  /** API 模式下正在拉取工单详情（会话消息） */
  conversationLoading?: boolean;
  /** 拉取会话/详情失败时的说明（与 messages 空态一起展示） */
  conversationError?: string | null;
  /** 服务端统计的会话消息总条数；大于当前 messages 时表示仅加载了最近若干条 */
  conversationMessagesTotal?: number | null;
  /** 加载早于当前列表的历史消息（分页） */
  onLoadOlderMessages?: () => void | Promise<void>;
  olderMessagesLoading?: boolean;
  /** 重新拉取工单详情（会话） */
  onReloadConversation?: () => void;
  /** 当前工单坐席展示名：用于坐席气泡在仅有 Agent/客服 占位 senderId 时显示真实坐席 */
  agentSeatDisplayName?: string | null;
}

function MessageBubbleContent({ text }: { text: string }) {
  const plain = htmlishMessageToPlainText(text);
  const match = plain.match(/^\[(.*?)]\s*(.*)/s);
  if (match) {
    let [, label, content] = match;

    // 剥离店铺名：如果包含分隔符（如 " · " 或 " - "），只取最后一段语种名
    const parts = label.split(/\s*[·•\-\|]\s*/);
    if (parts.length > 1) {
      label = parts[parts.length - 1];
    }

    // 统一补全 UI 表现（国旗图标）
    const lowerLabel = label.toLowerCase();
    const hasAnyFlag = /[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/.test(label);
    if (!hasAnyFlag) {
      if (lowerLabel.includes('english')) label = `🇺🇸 ${label}`;
      else if (lowerLabel.includes('deutsch') || lowerLabel.includes('german')) label = `🇩🇪 ${label}`;
      else if (lowerLabel.includes('français') || lowerLabel.includes('french')) label = `🇫🇷 ${label}`;
      else if (lowerLabel.includes('español') || lowerLabel.includes('spanish')) label = `🇪🇸 ${label}`;
      else if (lowerLabel.includes('italiano') || lowerLabel.includes('italian')) label = `🇮🇹 ${label}`;
      else if (lowerLabel.includes('日本語') || lowerLabel.includes('japanese')) label = `🇯🇵 ${label}`;
      else if (lowerLabel.includes('한국어') || lowerLabel.includes('korean')) label = `🇰🇷 ${label}`;
      else if (lowerLabel.includes('русский') || lowerLabel.includes('russian')) label = `🇷🇺 ${label}`;
      else if (lowerLabel.includes('português') || lowerLabel.includes('portuguese')) label = `🇵🇹 ${label}`;
      else if (lowerLabel.includes('中文')) label = `🇨🇳 ${label}`;
    }

    return (
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/10 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
          {label}
        </div>
        <div className="whitespace-pre-wrap">{content}</div>
      </div>
    );
  }
  return <div className="whitespace-pre-wrap">{plain}</div>;
}

export default function TicketDetail({
  ticket,
  messages,
  order: orderFromParent,
  customer,
  onSendMessage,
  onUpdateInternalNote,
  onDeleteInternalNote,
  onSend,
  seatOptions,
  assignedSeatId: assignedSeatIdProp,
  onAssignSeat,
  onUpdateTicket,
  conversationLoading = false,
  conversationError = null,
  conversationMessagesTotal = null,
  onLoadOlderMessages,
  olderMessagesLoading = false,
  onReloadConversation,
  agentSeatDisplayName = null,
}: TicketDetailProps) {
  const { user } = useAuth();
  const [replyText, setReplyText] = useState('');
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [showTemplatePopover, setShowTemplatePopover] = useState(false);
  const [showTranslationPopover, setShowTranslationPopover] = useState(false);
  const translationPopoverRef = useRef<HTMLDivElement>(null);
  const templatePopoverRef = useRef<HTMLDivElement>(null);
  const emojiPopoverRef = useRef<HTMLDivElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  
  type TabId = 'order' | 'logistics' | 'invoice' | 'after-sales' | 'ai-insight';
  const [tabOrder, setTabOrder] = useState<TabId[]>(() => {
    const saved = localStorage.getItem('intellidesk_ticket_tabs_order');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 校验是否包含所有必需的 tabId，防止以后新增 tab 导致旧缓存出问题
        const required: TabId[] = ['order', 'logistics', 'invoice', 'after-sales', 'ai-insight'];
        if (Array.isArray(parsed) && required.every(id => parsed.includes(id))) {
          return parsed;
        }
      } catch { /* ignore */ }
    }
    return ['ai-insight', 'order', 'logistics', 'invoice', 'after-sales'];
  });

  const [activeTab, setActiveTab] = useState<TabId>(() => tabOrder[0]);

  const needsUpstreamOrder =
    activeTab === 'order' ||
    activeTab === 'logistics' ||
    activeTab === 'invoice' ||
    activeTab === 'after-sales';
  const [isOrderInfoOpen, setIsOrderInfoOpen] = useState(true);
  const [isInternalNotesOpen, setIsInternalNotesOpen] = useState(true);
  const [editingInternalNoteId, setEditingInternalNoteId] = useState<string | null>(null);
  const [editingInternalNoteDraft, setEditingInternalNoteDraft] = useState('');
  const [savingInternalNote, setSavingInternalNote] = useState(false);
  const [isReplyExpanded, setIsReplyExpanded] = useState(false);
  const invoiceTemplate = 'commercial';
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isAfterSalesModalOpen, setIsAfterSalesModalOpen] = useState(false);
  const [editingAfterSalesRecord, setEditingAfterSalesRecord] = useState<AfterSalesRecord | undefined>(undefined);
  const [afterSalesRecords, setAfterSalesRecords] = useState<AfterSalesRecord[]>([]);
  const [sendToCustomer, setSendToCustomer] = useState(true);
  const [sendToManager, setSendToManager] = useState(false);
  const [citationMessageId, setCitationMessageId] = useState<string | null>(null);
  const [citationRecordHint, setCitationRecordHint] = useState<string | null>(null);
  const [autoInsightEnabled, setAutoInsightEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('intellidesk_auto_insight') !== '0';
  });
  const [ticketInsightLoading, setTicketInsightLoading] = useState(false);
  const [draggedTab, setDraggedTab] = useState<TabId | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent, id: TabId) => {
    setDraggedTab(id);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handleDragOver = (e: React.DragEvent, id: TabId) => {
    e.preventDefault();
    if (!draggedTab || draggedTab === id) return;

    const newOrder = [...tabOrder];
    const oldIdx = newOrder.indexOf(draggedTab);
    const newIdx = newOrder.indexOf(id);

    newOrder.splice(oldIdx, 1);
    newOrder.splice(newIdx, 0, draggedTab);

    setTabOrder(newOrder);
    localStorage.setItem('intellidesk_ticket_tabs_order', JSON.stringify(newOrder));
  };

  const handleDragEnd = () => {
    setDraggedTab(null);
  };

  /** 侧栏订单字段（含收货地址）以订单接口为准，避免仅工单详情里摘要不全 */
  const [orderApiEnriched, setOrderApiEnriched] = useState<Order | null>(null);
  const [isSyncingLogistics, setIsSyncingLogistics] = useState(false);

  useEffect(() => {
    setOrderApiEnriched(null);
    if (!intellideskConfigured() || !orderFromParent?.id || !needsUpstreamOrder) return;
    let cancelled = false;
    void (async () => {
      try {
        const raw = await fetchOrderDetail(
          intellideskTenantId(),
          intellideskUserIdForApi(user?.id),
          orderFromParent.id,
          { upstreamEnrich: true }
        );
        if (cancelled) return;
        setOrderApiEnriched(mapApiOrderToUi(raw));
      } catch {
        if (!cancelled) setOrderApiEnriched(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderFromParent?.id, user?.id, needsUpstreamOrder]);

  const order = useMemo((): Order | undefined => {
    if (!orderFromParent) return undefined;
    if (!orderApiEnriched) return orderFromParent;
    return { ...orderFromParent, ...orderApiEnriched };
  }, [orderFromParent, orderApiEnriched]);

  const orderMoneyCurrency = useMemo(() => {
    const oc = (order?.currency ?? '').trim();
    if (oc) return oc;
    const tc = (ticket.channelDefaultCurrency ?? '').trim();
    return tc || undefined;
  }, [order?.currency, ticket.channelDefaultCurrency]);

  const loadAfterSales = async () => {
    if (!intellideskConfigured()) return;
    try {
      const rows = await fetchAfterSalesList(
        intellideskTenantId(),
        intellideskUserIdForApi(user?.id),
        { ticketId: ticket.id }
      );
      setAfterSalesRecords(rows);
    } catch {
      setAfterSalesRecords([]);
    }
  };

  useEffect(() => {
    void loadAfterSales();
  }, [ticket.id, user?.id]);

  const handleDeleteAfterSales = async (id: string) => {
    if (!window.confirm('确定要删除这笔售后记录吗？删除后售后管理页面也将同步移除。')) return;
    if (intellideskConfigured()) {
      try {
        await deleteAfterSalesRecord(intellideskTenantId(), intellideskUserIdForApi(user?.id), id);
        void loadAfterSales();
      } catch (e) {
        alert(`删除失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      setAfterSalesRecords((prev) => prev.filter((r) => r.id !== id));
    }
  };

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

  const [translationSettings, setTranslationSettings] = useState(() => getTranslationSettings());
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ suggestion: string; platformSuggestion?: string } | null>(null);
  useEffect(() => {
    const handleStorage = () => setTranslationSettings(getTranslationSettings());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    setIsReplyExpanded(false);
    setReplyText('');
    setCitationMessageId(null);
  }, [ticket.id]);

  /** 联调 + 开启自动翻译：入站消息无 translatedContent 时调用后端 /api/ai/translate（豆包），仅内存展示不落库 */
  const [aiTranslations, setAiTranslations] = useState<Record<string, string>>({});
  const [aiTranslateFailed, setAiTranslateFailed] = useState<Record<string, boolean>>({});
  const aiTranslateInflightRef = useRef(new Set<string>());
  const inboundTranslateErrNotifiedRef = useRef(false);
  const [intentClassifyLoading, setIntentClassifyLoading] = useState(false);
  const [sentimentClassifyLoading, setSentimentClassifyLoading] = useState(false);
  const [ticketAiSummary, setTicketAiSummary] = useState<string | null>(null);
  const [ticketAiSummaryLoading, setTicketAiSummaryLoading] = useState(false);

  useEffect(() => {
    setAiTranslations({});
    setAiTranslateFailed({});
    aiTranslateInflightRef.current.clear();
    inboundTranslateErrNotifiedRef.current = false;
    setIntentClassifyLoading(false);
    setSentimentClassifyLoading(false);
    setTicketAiSummary(null);
  }, [ticket.id]);

  const aiInsightRefreshable = intellideskConfigured() && Boolean(onUpdateTicket);

  const handleIntentRefresh = async () => {
    if (!onUpdateTicket || !intellideskConfigured()) return;
    setIntentClassifyLoading(true);
    setGlobalApiError(null);
    try {
      const { intent } = await postAiClassifyIntent(
        intellideskTenantId(),
        intellideskUserIdForApi(user?.id),
        ticket.id
      );
      const next = intent?.trim() || '未分类';
      onUpdateTicket({ intent: next });
    } catch (e) {
      console.error('classify intent:', e);
      setGlobalApiError(`[意图识别] ${formatAiUserVisibleError(e)}`);
    } finally {
      setIntentClassifyLoading(false);
    }
  };

  const handleSentimentRefresh = async () => {
    if (!onUpdateTicket || !intellideskConfigured()) return;
    setSentimentClassifyLoading(true);
    setGlobalApiError(null);
    try {
      const { sentiment } = await postAiClassifySentiment(
        intellideskTenantId(),
        intellideskUserIdForApi(user?.id),
        ticket.id
      );
      const raw = sentiment?.trim().toLowerCase() || 'neutral';
      const next = Object.values(Sentiment).includes(raw as Sentiment)
        ? (raw as Sentiment)
        : Sentiment.NEUTRAL;
      onUpdateTicket({ sentiment: next });
    } catch (e) {
      console.error('classify sentiment:', e);
      setGlobalApiError(`[情绪识别] ${formatAiUserVisibleError(e)}`);
    } finally {
      setSentimentClassifyLoading(false);
    }
  };

  const handleTicketAiSummary = async () => {
    if (!intellideskConfigured()) return;
    setTicketAiSummaryLoading(true);
    setGlobalApiError(null);
    try {
      const s = await summarizeTicketById(ticket.id, user?.id);
      setTicketAiSummary(s?.trim() || '（无摘要返回）');
    } catch (e) {
      console.error('ticket AI summary:', e);
      setTicketAiSummary(null);
      setGlobalApiError(`[工单摘要] ${formatAiUserVisibleError(e)}`);
    } finally {
      setTicketAiSummaryLoading(false);
    }
  };

  const handleTicketInsight = async () => {
    if (!intellideskConfigured() || !onUpdateTicket) return;
    setTicketInsightLoading(true);
    setGlobalApiError(null);
    try {
      const res = await postAiTicketInsight(
        intellideskTenantId(),
        intellideskUserIdForApi(user?.id),
        ticket.id
      );
      setTicketAiSummary(res.summary);
      onUpdateTicket({
        intent: res.intent,
        sentiment: res.sentiment as Sentiment,
      });
    } catch (e) {
      console.error('ticket insight error:', e);
      setGlobalApiError(`[AI 智能摘要] ${formatAiUserVisibleError(e)}`);
    } finally {
      setTicketInsightLoading(false);
    }
  };

  useEffect(() => {
    if (autoInsightEnabled && intellideskConfigured() && onUpdateTicket) {
      // 仅在摘要为空时自动触发，避免重复调用
      if (!ticketAiSummary && !ticketInsightLoading) {
        void handleTicketInsight();
      }
    }
  }, [ticket.id, autoInsightEnabled]);

  const toggleAutoInsight = (enabled: boolean) => {
    setAutoInsightEnabled(enabled);
    localStorage.setItem('intellidesk_auto_insight', enabled ? '1' : '0');
  };

  /** 
   * 对消息列表执行批量翻译。
   */
  const handleBatchTranslateMessages = async (messagesToTranslate: Message[]) => {
    if (!intellideskConfigured() || !translationSettings.inboundTranslateEnabled || messagesToTranslate.length === 0) return;

    const tenantId = intellideskTenantId();
    const userId = intellideskUserIdForApi(user?.id);
    const myLangLabel = getInboundTargetLangLabel(translationSettings.inboundTargetLang);

    // 过滤掉已经在翻译中的
    const need = messagesToTranslate.filter(m => !aiTranslateInflightRef.current.has(m.id));
    if (need.length === 0) return;

    need.forEach(m => aiTranslateInflightRef.current.add(m.id));
    setAiTranslateFailed(prev => ({ ...prev })); 

    try {
      // 分批发送，每批最多 50 条消息
      const chunkSize = 50;
      const chunks = [];
      for (let i = 0; i < need.length; i += chunkSize) {
        chunks.push(need.slice(i, i + chunkSize));
      }

      const allResults: Record<string, string> = {};
      const failedMap: Record<string, boolean> = {};

      for (const chunk of chunks) {
        try {
          const { results } = await postAiBatchTranslate(tenantId, userId, {
            messages: chunk.map((m) => ({ id: m.id, content: m.content })),
            targetLang: myLangLabel,
          });
          Object.assign(allResults, results);
          chunk.forEach((m) => {
            if (!results[m.id]) failedMap[m.id] = true;
          });
        } catch (err) {
          console.error('[Batch Chunk Error]', err);
          chunk.forEach((m) => {
            failedMap[m.id] = true;
          });
        }
      }

      setAiTranslations((prev) => ({ ...prev, ...allResults }));
      if (Object.keys(failedMap).length > 0) {
        setAiTranslateFailed((prev) => ({ ...prev, ...failedMap }));
      }
    } catch (e) {
      console.error('AI batch translate messages:', e);
      const failedMap: Record<string, boolean> = {};
      need.forEach(m => { failedMap[m.id] = true; });
      setAiTranslateFailed((prev) => ({ ...prev, ...failedMap }));
      setGlobalApiError(`[批量翻译] ${formatAiUserVisibleError(e)}`);
    } finally {
      need.forEach(m => aiTranslateInflightRef.current.delete(m.id));
    }
  };

  /** 
   * 对单条消息执行翻译（用于手动点击重试）。
   */
  const handleTranslateMessage = async (message: Message) => {
    await handleBatchTranslateMessages([message]);
  };

  /** 
   * 当租户点击工单（ticket.id 变化）或有新消息时，批量翻译所有缺失翻译的消息。
   */
  useEffect(() => {
    if (!intellideskConfigured() || !translationSettings.inboundTranslateEnabled) return;

    const need = messages.filter((m) => {
      if (m.isInternal || !m.content?.trim()) return false;
      if (aiTranslations[m.id] || aiTranslateFailed[m.id] || aiTranslateInflightRef.current.has(m.id)) return false;

      const isRtl = m.senderType === 'agent' || m.senderType === 'ai';
      if (isRtl) {
        if (m.sentPlatformText?.trim()) return false;
        if (/[\u4e00-\u9fa5]/.test(m.content)) return false;
        return true;
      } else {
        return !m.translatedContent?.trim();
      }
    });

    if (need.length > 0) {
      void handleBatchTranslateMessages(need);
    }
  }, [
    ticket.id,
    messages,
    translationSettings.inboundTranslateEnabled,
    translationSettings.inboundTargetLang,
    user?.id,
    aiTranslations,
    aiTranslateFailed,
  ]);

  useEffect(() => {
    // 监听翻译设置变化
  }, [ticket.id, translationSettings]);

  useEffect(() => {
    if (!isInternalNote && !sendToCustomer && !sendToManager) {
      setSendToCustomer(true);
    }
  }, [isInternalNote, sendToCustomer, sendToManager]);

  /** 自动翻译 / 插入模板 / 表情：点击浮层外关闭；打开其一则收起其余 */
  useEffect(() => {
    if (!showTranslationPopover && !showTemplatePopover && !showEmojiPicker) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        translationPopoverRef.current?.contains(target) ||
        templatePopoverRef.current?.contains(target) ||
        emojiPopoverRef.current?.contains(target)
      ) {
        return;
      }
      setShowTranslationPopover(false);
      setShowTemplatePopover(false);
      setShowEmojiPicker(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [showTranslationPopover, showTemplatePopover, showEmojiPicker]);

  const [copiedOrderId, setCopiedOrderId] = useState(false);

  const handleCopyOrderId = (orderId: string) => {
    navigator.clipboard.writeText(orderId);
    setCopiedOrderId(true);
    setTimeout(() => setCopiedOrderId(false), 2000);
  };

  const handleSyncLogistics = async (force = false) => {
    if (!order || !order.id || isSyncingLogistics) return;
    setIsSyncingLogistics(true);
    try {
      const res = await postOrderLogisticsSync(
        intellideskTenantId(),
        intellideskUserIdForApi(user?.id),
        order.id,
        force
      );
      if (res.ok) {
        // 重新获取订单详情以刷新物流状态和事件
        const raw = await fetchOrderDetail(
          intellideskTenantId(),
          intellideskUserIdForApi(user?.id),
          order.id,
          { upstreamEnrich: true }
        );
        setOrderApiEnriched(mapApiOrderToUi(raw));
      }
    } catch (err) {
      console.error('[logistics] sync error:', err);
      setGlobalApiError(formatAiUserVisibleError(err));
    } finally {
      setIsSyncingLogistics(false);
    }
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

  useEffect(() => {
    if (
      editingInternalNoteId &&
      !internalNotes.some((n) => n.id === editingInternalNoteId)
    ) {
      setEditingInternalNoteId(null);
      setEditingInternalNoteDraft('');
    }
  }, [internalNotes, editingInternalNoteId]);

  const [pickerTemplates, setPickerTemplates] = useState(() => getActiveReplyTemplatesForPicker());

  const pickerTemplatesForTicket = useMemo(
    () => pickerTemplates.filter((row) => replyTemplatePickerRowMatchesTicket(row, ticket)),
    [pickerTemplates, ticket.platformType, ticket.intent]
  );

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

  /** 哪吒已回填单号但尚未写入 logisticsStatus / 未点同步时展示 */
  const logisticsBadgeForOrder = (o: Order) => {
    if (o.logisticsPrimaryStatus && o.logisticsStatus) {
      const config = getLogisticsStatusConfig(o.logisticsStatus);
      return {
        ...config,
        label: o.logisticsPrimaryStatus,
      };
    }
    if (o.logisticsStatus != null) return getLogisticsStatusConfig(o.logisticsStatus);
    if (o.trackingNumber?.trim()) {
      return {
        label: '待同步物流追踪详情',
        color: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
      };
    }
    return getLogisticsStatusConfig(undefined);
  };

  /** 物流接口未必返回预计送达；空串、纯空白、未定义均展示「未知」 */
  const formatDeliveryEtaDisplay = (eta?: string) => {
    const v = eta?.trim();
    return v ? v : '未知';
  };

  const handleAiSuggest = async () => {
    setIsAiModalOpen(true);
    setAiSuggestion(null);
    setIsGeneratingDraft(true);
    setGlobalApiError(null);
    try {
      const res = await generateReplySuggestion(ticket, messages, order, user?.id);
      if (res) {
        setAiSuggestion(res);
      }
    } catch (error) {
      console.error('Failed to generate AI suggestion:', error);
      setGlobalApiError(`[AI 智能生成] ${formatAiUserVisibleError(error)}`);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleAdoptAiSuggestion = (text: string) => {
    setReplyText(text);
    setIsAiGenerated(true);
    setIsReplyExpanded(true);
    setIsAiModalOpen(false);
  };

  const handleAiPolish = async () => {
    if (isPolishing || !replyText.trim()) return;

    setIsPolishing(true);
    setGlobalApiError(null);
    try {
      const polished = await generateReplyPolish(replyText, ticket, messages, order, user?.id);
      if (polished) {
        setReplyText(polished);
        setIsAiGenerated(true);
      }
    } catch (error) {
      console.error('Failed to polish with AI:', error);
      setGlobalApiError(`[AI 润色] ${formatAiUserVisibleError(error)}`);
    } finally {
      setIsPolishing(false);
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
      channelShopLabel: ticket.channelId,
      channelPlatformType: ticket.platformType ?? null,
    };
    setAfterSalesRecords([newRecord, ...afterSalesRecords]);
    setIsAfterSalesModalOpen(false);
  };

  const replaceTemplatePlaceholders = (content: string) => {
    let result = content;
    
    // {买家姓名}
    const buyerName = customer?.name || 'Customer';
    result = result.replace(/\{买家姓名\}/g, buyerName);
    
    // {订单号}
    const orderId = order?.platformOrderId || order?.id || '';
    result = result.replace(/\{订单号\}/g, orderId);
    
    // {物流单号}
    const trackingNo = order?.trackingNumber || '';
    result = result.replace(/\{物流单号\}/g, trackingNo);
    
    // {商品名称}
    const productTitle = order?.productTitles?.[0] || '';
    result = result.replace(/\{商品名称\}/g, productTitle);
    
    // {店铺名称}
    const shopName = ticket.channelId || '';
    result = result.replace(/\{店铺名称\}/g, shopName);
    
    return result;
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

    if (onSendMessage) {
      const translateToPlatform =
        !isInternalNote &&
        translationSettings.outboundTranslateOnSend;
      onSendMessage({
        content: text,
        recipients,
        isInternal: isInternalNote,
        translateToPlatform,
        isAiGenerated,
      });
    } else if (onSend) {
      onSend();
    }

    setReplyText('');
    setIsAiGenerated(false);
    setIsReplyExpanded(false);
  };

  const outboundRecipientReady = isInternalNote || sendToCustomer || sendToManager;

  const assignSeatValue = assignedSeatIdProp ?? ticket.assignedSeatId ?? '';

  const getInvoiceLang = () => {
    const channel = ticket.channelId.toLowerCase();
    if (channel.includes('de')) return 'de';
    if (channel.includes('fr')) return 'fr';
    return 'en';
  };

  const getPlatformLanguageLabel = () => {
    const channel = ticket.channelId.toLowerCase();
    if (channel.includes('de')) return '德语';
    if (channel.includes('fr')) return '法语';
    if (channel.includes('es')) return '西班牙语';
    if (channel.includes('it')) return '意大利语';
    if (channel.includes('jp')) return '日语';
    return '英语';
  };

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      {/* Main Conversation Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white border-r border-slate-200">
        {/* Header */}
        <header className="border-b border-slate-200 px-6 py-3 bg-white shrink-0">
          <div className="flex flex-col gap-1 min-w-0 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-slate-900 truncate min-w-0" title={getTicketSubjectForDisplay(ticket)}>
                工单主题：{getTicketSubjectForDisplay(ticket)}
              </h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-slate-500">
                <span
                  className="font-medium text-slate-600 tabular-nums"
                  title={`完整工单 ID：${ticket.id}`}
                >
                  工单 {formatTicketReadableRef(ticket)}
                </span>
                {ticket.createdAt && (
                  <>
                    <span className="w-1 h-1 bg-slate-300 rounded-full shrink-0" aria-hidden />
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      创建于 {format(new Date(ticket.createdAt), 'MM月dd日 HH:mm')}
                    </span>
                  </>
                )}
                {ticket.updatedAt && (
                  <>
                    <span className="w-1 h-1 bg-slate-300 rounded-full shrink-0" />
                    <span className="flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5" />
                      更新于 {format(new Date(ticket.updatedAt), 'HH:mm')}
                    </span>
                  </>
                )}
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
                intentRefreshable={aiInsightRefreshable}
                intentRefreshLoading={intentClassifyLoading}
                onIntentRefresh={handleIntentRefresh}
                sentimentRefreshable={aiInsightRefreshable}
                sentimentRefreshLoading={sentimentClassifyLoading}
                onSentimentRefresh={handleSentimentRefresh}
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
                    <div className="relative w-full max-w-[76px] sm:w-[76px]">
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
                      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
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
                    <div className="w-full max-w-[76px] sm:w-[76px] min-w-0">
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
          {conversationMessagesTotal != null &&
          conversationMessagesTotal > messages.length &&
          !conversationLoading ? (
            <div className="rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 leading-relaxed space-y-2">
              <p>
                为加快加载，仅拉取最近 {messages.length} 条消息（含内部备注）；该会话共有{' '}
                {conversationMessagesTotal} 条。如需调高单次条数，可在后端设置环境变量{' '}
                <code className="rounded bg-amber-100/80 px-1">TICKET_DETAIL_MESSAGES_LIMIT</code> 或请求参数{' '}
                <code className="rounded bg-amber-100/80 px-1">messagesLimit</code>。
              </p>
              {onLoadOlderMessages ? (
                <button
                  type="button"
                  disabled={olderMessagesLoading}
                  onClick={() => void onLoadOlderMessages()}
                  className="text-left text-[11px] font-medium text-amber-900 underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {olderMessagesLoading ? '正在加载更早消息…' : '加载更早消息'}
                </button>
              ) : null}
            </div>
          ) : null}
          {conversationLoading && visibleMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-sm gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              <span>正在加载会话…</span>
            </div>
          ) : null}
          {!conversationLoading && messages.length > 0 && visibleMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-600 text-sm px-4 max-w-md">
              <MessageSquare className="w-10 h-10 text-slate-300 mb-3" />
              <p className="font-medium text-slate-700">会话时间线暂无对外展示的消息</p>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                当前加载的记录均为<strong>内部备注</strong>（或对买家不可见），不会出现在中间对话区。请在页面中的
                <strong>内部备注</strong>区域查看与编辑。
              </p>
            </div>
          ) : null}
          {!conversationLoading && visibleMessages.length === 0 && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 text-sm px-4">
              <MessageSquare className="w-10 h-10 text-slate-300 mb-3" />
              <p>暂无消息，请尝试重新加载。</p>
              {intellideskConfigured() && !conversationError ? (
                <div className="text-xs text-slate-500 mt-2 max-w-md leading-relaxed space-y-2">
                  {ticket.motherConversationLinked &&
                  (conversationMessagesTotal == null || conversationMessagesTotal === 0) ? (
                    <p>
                      该工单<strong>已在母系统有关联会话</strong>，但本地库中还没有消息记录。请在左侧工单列表标题旁点击
                      <strong>刷新</strong>，执行收件箱同步（近 90 天会话与消息）。同步完成后此处会显示对话内容。
                    </p>
                  ) : null}
                  <p>
                    若列表有工单但始终无消息：请在左侧点击<strong>刷新</strong>从母系统同步；并确认使用{' '}
                    <code className="px-1 bg-slate-100 rounded">npm run dev:api</code> 且后端已启动。默认会在打开工单后
                    <strong>后台</strong>尝试从母系统补消息（需 <code className="px-1 bg-slate-100 rounded">NEZHA_API_TOKEN</code>
                    ）；若已关闭，可在 <code className="px-1 bg-slate-100 rounded">backend/.env</code> 去掉{' '}
                    <code className="px-1 bg-slate-100 rounded">TICKET_DETAIL_NEZHA_HYDRATE=0</code>。
                  </p>
                </div>
              ) : null}
              {conversationError ? (
                <p className="text-xs text-red-600 mt-2 max-w-md whitespace-pre-wrap">{conversationError}</p>
              ) : null}
              {onReloadConversation ? (
                <button
                  type="button"
                  onClick={onReloadConversation}
                  className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  重新加载
                </button>
              ) : null}
            </div>
          ) : null}
          {visibleMessages.map((message) => {
            const isRtl = message.senderType === 'agent' || message.senderType === 'ai';
            const translationOn = translationSettings.inboundTranslateEnabled;
            
            let topText = message.content;
            let bottomText = '';
            let isLoadingTranslation = false;

            if (translationOn) {
              const inline = aiTranslations[message.id];
              const tag = inboundTranslationDisplayTag(translationSettings.inboundTargetLang);

              if (isRtl) {
                // 发出的信息：
                if (message.sentPlatformText?.trim()) {
                  // 情况 A: 已有平台语翻译，上方外语，下方中文原话
                  topText = message.sentPlatformText.trim();
                  bottomText = message.content;
                } else if (inline) {
                  // 情况 B: 同步回来的外语消息，上方外语原文，下方翻译后的中文
                  topText = message.content;
                  bottomText = `[${tag}] ${inline}`;
                } else if (message.senderType === 'agent' || message.senderType === 'ai') {
                  isLoadingTranslation = intellideskConfigured() && !aiTranslateFailed[message.id];
                }
              } else {
                // 收到的信息：上方原文，下方译文
                if (message.translatedContent?.trim()) {
                  topText = message.content;
                  bottomText = `[${tag}] ${message.translatedContent.trim()}`;
                } else if (inline) {
                  topText = message.content;
                  bottomText = `[${tag}] ${inline}`;
                } else if (message.senderType === 'customer' || message.senderType === 'manager') {
                  isLoadingTranslation = intellideskConfigured() && !aiTranslateFailed[message.id];
                }
              }
            }

            return (
              <div
                key={message.id}
                className={cn('flex gap-4 max-w-[85%]', isRtl ? 'ml-auto flex-row-reverse' : '')}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[13px] font-bold uppercase select-none',
                    message.senderType === 'customer'
                      ? 'bg-blue-100 text-blue-600'
                      : message.senderType === 'manager'
                        ? 'bg-amber-100 text-amber-700'
                        : message.senderType === 'system'
                          ? 'bg-slate-200 text-slate-600'
                          : message.senderType === 'ai'
                            ? 'bg-purple-100 text-purple-600'
                            : 'bg-slate-200 text-slate-600'
                  )}
                >
                  {(() => {
                    if (message.senderType === 'ai') return <Sparkles className="w-4 h-4" />;
                    if (message.senderType === 'system') return <Info className="w-4 h-4" />;
                    if (message.senderType === 'manager') return <ShieldCheck className="w-4 h-4" />;
                    
                    const label = message.senderType === 'customer' && customer?.name
                      ? customer.name
                      : messageSenderLabel(message, { agentSeatDisplayName });
                    
                    const firstChar = label.trim().charAt(0);
                    return firstChar || <User className="w-4 h-4" />;
                  })()}
                </div>

                <div className={cn('space-y-1', isRtl ? 'items-end flex flex-col' : '')}>
                  <div className={cn('flex items-center gap-2 mb-1 w-full', isRtl ? 'justify-end' : '')}>
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                      {message.senderType === 'customer' && customer?.name
                        ? customer.name
                        : messageSenderLabel(message, { agentSeatDisplayName })}
                      {message.senderType === 'manager' && (
                        <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-md">
                          平台信息
                        </span>
                      )}
                      {message.senderType === 'customer' && (
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md">
                          客户
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      {format(new Date(message.createdAt), 'MM月dd日 HH:mm')}
                      {(message.senderType === 'agent' || message.senderType === 'ai') &&
                        message.deliveryStatus &&
                        !message.isInternal && (
                          <span
                            className="ml-0.5"
                            title={
                              message.deliveryStatus === 'failed'
                                ? message.deliveryError || '发送失败'
                                : message.deliveryStatus === 'sending'
                                  ? '发送中...'
                                  : '已发送至平台'
                            }
                          >
                            {message.deliveryStatus === 'sending' && (
                              <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />
                            )}
                            {message.deliveryStatus === 'success' && (
                              <Check
                                className="w-3.5 h-3.5 text-emerald-500"
                                strokeWidth={3}
                              />
                            )}
                            {message.deliveryStatus === 'failed' && (
                              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                            )}
                          </span>
                        )}
                    </span>
                  </div>

                  <div
                    onClick={() => {
                      if (isLoadingTranslation) {
                        void handleTranslateMessage(message);
                      }
                    }}
                    className={cn(
                      'p-4 rounded-2xl text-sm leading-relaxed shadow-sm transition-all',
                      isLoadingTranslation ? 'cursor-pointer hover:shadow-md' : '',
                      message.senderType === 'customer'
                        ? 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                        : message.senderType === 'manager'
                          ? 'bg-amber-50/80 text-amber-950 border border-amber-200/50 rounded-lg shadow-none backdrop-blur-sm'
                        : message.senderType === 'system'
                            ? 'bg-slate-100 text-slate-800 border border-slate-200 rounded-tl-none'
                            : message.senderType === 'ai'
                              ? 'bg-[#9333EA] text-white rounded-tr-none'
                              : message.isInternal
                                ? 'bg-orange-50 text-orange-900 border border-orange-100 rounded-tr-none'
                                : 'bg-blue-600 text-white rounded-tr-none'
                    )}
                  >
                    <MessageBubbleContent text={topText} />

                    {bottomText && (
                      <div
                        className={cn(
                          'mt-2 pt-2 border-t',
                          isRtl
                            ? message.senderType === 'ai'
                              ? 'border-white/20'
                              : 'border-white/20'
                            : message.senderType === 'manager'
                              ? 'border-amber-200/50'
                              : 'border-slate-100'
                        )}
                      >
                        <MessageBubbleContent text={bottomText} />
                      </div>
                    )}

                    {isLoadingTranslation && (
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
                        <div
                          className={cn(
                            'w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center',
                            aiTranslateInflightRef.current.has(message.id) ? 'animate-pulse' : ''
                          )}
                        >
                          <Languages className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {aiTranslateInflightRef.current.has(message.id)
                            ? '正在请求智能翻译...'
                            : '点击气泡获取翻译'}
                        </span>
                      </div>
                    )}

                    {message.attachments && message.attachments.length > 0 && (
                    <div
                      className={cn(
                        'mt-2 pt-2 flex flex-wrap gap-2',
                        message.senderType === 'customer'
                          ? 'border-t border-slate-100'
                          : message.senderType === 'manager'
                            ? 'border-t border-amber-200/50'
                            : message.senderType === 'system'
                              ? 'border-t border-slate-200'
                              : message.senderType === 'ai'
                                ? 'border-t border-white/20'
                                : message.isInternal
                                  ? 'border-t border-orange-200/60'
                                  : 'border-t border-white/25'
                      )}
                    >
                      {message.attachments.map((att, idx) => {
                        const isPdf =
                          att.startsWith('data:application/pdf') ||
                          att.toLowerCase().includes('application/pdf');
                        return (
                          <a
                            key={`${message.id}-att-${idx}`}
                            href={att}
                            download={isPdf ? `attachment-${idx + 1}.pdf` : undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors',
                              message.senderType === 'ai'
                                ? 'bg-white/15 text-white hover:bg-white/25'
                                : message.isInternal
                                  ? 'bg-orange-100/80 text-orange-900 hover:bg-orange-100'
                                  : message.senderType === 'agent'
                                    ? 'bg-white/15 text-white hover:bg-white/25'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            )}
                          >
                            <Paperclip className="w-3 h-3 shrink-0" />
                            {isPdf ? '发票 PDF' : `附件 ${idx + 1}`}
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>

                {message.senderType === 'agent' && message.deliveryTargets && message.deliveryTargets.length > 0 && (
                  <p className={cn(
                    "text-[10px] text-slate-400 mt-0.5",
                    isRtl ? "text-right w-full" : ""
                  )}>
                    已发送给：{message.deliveryTargets.map((t) => (t === 'customer' ? '客户' : '平台经理')).join('、')}
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
          <div className="flex flex-col gap-4">
            {isReplyExpanded && (
              <div className="flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
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
                  {!isInternalNote && (
                    <div className="relative" ref={translationPopoverRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTemplatePopover(false);
                          setShowEmojiPicker(false);
                          setShowTranslationPopover((v) => !v);
                        }}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 border hover:bg-slate-50 rounded-lg text-xs font-medium transition-colors shadow-sm",
                          showTranslationPopover ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-white border-slate-200 text-slate-700"
                        )}
                        title="查看翻译配置"
                      >
                        <Languages className="w-3.5 h-3.5 text-slate-500 shrink-0" strokeWidth={2} />
                        自动翻译
                        <ChevronUp className={cn("w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform", showTranslationPopover && "rotate-180")} />
                      </button>

                      {showTranslationPopover && (
                        <div className="absolute right-0 bottom-full mb-2 w-[320px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                          <div className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-slate-900">我的语言与自动翻译</p>
                                <p className="text-[10px] text-slate-400">将外语消息（含同步信息）译为 {getInboundTargetLangLabel(translationSettings.inboundTargetLang)}</p>
                              </div>
                              <div
                                className={cn(
                                  'relative h-5 w-9 shrink-0 rounded-full transition-colors',
                                  translationSettings.inboundTranslateEnabled ? 'bg-[#F97316]/50' : 'bg-slate-200/50'
                                )}
                              >
                                <span
                                  className={cn(
                                    'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                                    translationSettings.inboundTranslateEnabled ? 'translate-x-4' : 'translate-x-0'
                                  )}
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-slate-900">发送信息自动翻译</p>
                                <p className="text-[10px] text-slate-400">发送前自动译为 {getPlatformLanguageLabel()}</p>
                              </div>
                              <div
                                className={cn(
                                  'relative h-5 w-9 shrink-0 rounded-full transition-colors',
                                  translationSettings.outboundTranslateOnSend ? 'bg-[#F97316]/50' : 'bg-slate-200/50'
                                )}
                              >
                                <span
                                  className={cn(
                                    'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                                    translationSettings.outboundTranslateOnSend ? 'translate-x-4' : 'translate-x-0'
                                  )}
                                />
                              </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg flex items-start gap-2">
                              <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                              <p className="text-[10px] text-slate-500 leading-relaxed">
                                上述为系统当前状态，若需修改请前往
                                <Link to="/settings/translation" className="text-blue-600 hover:text-blue-700 hover:underline mx-0.5 font-bold">系统设置</Link>
                                。
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="relative" ref={templatePopoverRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowTranslationPopover(false);
                        setShowEmojiPicker(false);
                        setShowTemplatePopover((v) => !v);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 border hover:bg-slate-50 rounded-lg text-xs font-medium transition-colors shadow-sm",
                        showTemplatePopover ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-white border-slate-200 text-slate-700"
                      )}
                    >
                      插入模板
                      <ChevronUp className={cn("w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform", showTemplatePopover && "rotate-180")} />
                    </button>

                    {showTemplatePopover && (
                      <div className="absolute right-0 bottom-full mb-2 w-[340px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
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
                          {pickerTemplatesForTicket
                            .filter(
                              (tpl) =>
                                String(tpl.title ?? '')
                                  .toLowerCase()
                                  .includes(templateSearchQuery.toLowerCase()) ||
                                String(tpl.content ?? '')
                                  .toLowerCase()
                                  .includes(templateSearchQuery.toLowerCase())
                            )
                            .sort((a, b) => {
                              const intent = (ticket.intent ?? '').trim();
                              const rowMatchesIntent = (row: ReplyTemplatePickerRow) => {
                                if (!intent) return false;
                                const rowCats =
                                  row.categoryValues?.length > 0
                                    ? row.categoryValues
                                    : row.categoryValue
                                    ? [row.categoryValue]
                                    : [];
                                return rowCats.some((c) =>
                                  ticketIntentMatchesAfterSalesCategoryValue(intent, String(c).trim())
                                );
                              };
                              const aMatch = rowMatchesIntent(a);
                              const bMatch = rowMatchesIntent(b);
                              if (aMatch && !bMatch) return -1;
                              if (!aMatch && bMatch) return 1;
                              return 0;
                            })
                            .map((tpl) => {
                              const intent = (ticket.intent ?? '').trim();
                              const cats = tpl.categoryValues?.length
                                ? tpl.categoryValues
                                : tpl.categoryValue
                                ? [tpl.categoryValue]
                                : [];
                              const isRecommended =
                                !!intent &&
                                cats.some((c) =>
                                  ticketIntentMatchesAfterSalesCategoryValue(intent, String(c).trim())
                                );
                              return (
                                <button
                                  key={tpl.id}
                                  type="button"
                                  onClick={() => {
                                    const processedContent = replaceTemplatePlaceholders(tpl.content);
                                    setReplyText(processedContent);
                                    setIsAiGenerated(false);
                                    setIsReplyExpanded(true);
                                    setShowTemplatePopover(false);
                                    setTemplateSearchQuery('');
                                  }}
                                  className={cn(
                                    "w-full text-left p-2.5 rounded-lg transition-colors group relative",
                                    isRecommended ? "bg-orange-50/50 hover:bg-orange-50 border border-orange-100/50" : "hover:bg-slate-50"
                                  )}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className={cn(
                                        "text-xs font-bold transition-colors",
                                        isRecommended ? "text-orange-700" : "text-slate-900 group-hover:text-[#F97316]"
                                      )}>
                                        {tpl.title}
                                      </span>
                                      {isRecommended && (
                                        <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-orange-100 text-[9px] font-bold text-orange-600 uppercase tracking-tight">
                                          <Sparkles className="w-2 h-2" />
                                          推荐
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                                      {cats.length > 0
                                        ? cats.map((v) => routingAfterSalesLabel(String(v))).join('、')
                                        : tpl.category && tpl.category !== 'all'
                                          ? tpl.category
                                          : '通用'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                    {tpl.content}
                                  </p>
                                </button>
                              );
                            })}
                        </div>
                        <div className="p-2.5 border-t border-slate-100 bg-slate-50/50 flex justify-center">
                          <Link
                            to="/settings/templates"
                            className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                          >
                            管理模板库
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAiPolish}
                      disabled={isPolishing || !replyText.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-lg text-xs font-bold text-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      title="对已输入内容进行专业润色"
                    >
                      {isPolishing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Pencil className="w-3.5 h-3.5" />
                      )}
                      AI 润色
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="relative group">
              <textarea
                placeholder={isInternalNote ? "在此输入仅内部可见的备注信息..." : "在此输入回复内容，Shift + Enter 换行"}
                value={replyText}
                onFocus={() => setIsReplyExpanded(true)}
                onChange={(e) => {
                  setReplyText(e.target.value);
                  // 当输入框被完全清空时，才重置 AI 生成与引用状态
                  if (!e.target.value) {
                    setIsAiGenerated(false);
                  }
                  if (!isReplyExpanded && e.target.value) setIsReplyExpanded(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className={cn(
                  "w-full p-4 text-sm bg-slate-50/50 border rounded-xl outline-none transition-all placeholder:text-slate-400 resize-none",
                  isReplyExpanded ? "min-h-[100px]" : "min-h-[46px] py-2.5",
                  isInternalNote 
                    ? "border-orange-100 focus:bg-white focus:border-orange-200 focus:ring-4 focus:ring-orange-500/5" 
                    : "border-slate-200 focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-500/5"
                )}
              />
              <div className={cn(
                "absolute right-3 bottom-3 flex items-center gap-2 transition-opacity",
                isReplyExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
              )}>
                  <div className="relative" ref={emojiPopoverRef}>
                    <button 
                      type="button" 
                      onClick={() => {
                        setShowTranslationPopover(false);
                        setShowTemplatePopover(false);
                        setShowEmojiPicker((v) => !v);
                      }}
                      title="选择表情"
                      className={cn(
                        "p-2 transition-colors rounded-lg",
                        showEmojiPicker ? "bg-slate-100 text-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                    
                    {showEmojiPicker && (
                      <div className="absolute right-0 bottom-full mb-2 w-[280px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                          <p className="text-xs font-semibold text-slate-700 px-1">常用表情</p>
                        </div>
                        <div className="grid grid-cols-7 gap-1 h-[200px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent hover:scrollbar-thumb-slate-300">
                          {COMMON_EMOJIS.map((emoji, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => {
                                setReplyText(prev => prev + emoji);
                              }}
                              className="flex items-center justify-center h-8 hover:bg-slate-100 rounded-lg text-lg transition-colors cursor-pointer"
                              title={emoji}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="file"
                      id="attachment-upload"
                      className="hidden"
                      multiple
                      aria-label="上传附件"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          alert(`已选择 ${e.target.files.length} 个文件：\n` + Array.from(e.target.files).map(f => f.name).join('\n') + '\n\n(前端演示，尚未对接后端上传)');
                          // Reset the input so the same files can be selected again if needed
                          e.target.value = '';
                        }
                      }}
                    />
                    <label 
                      htmlFor="attachment-upload"
                      className="p-2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer inline-flex items-center justify-center rounded-lg hover:bg-slate-50"
                      title="添加附件"
                    >
                      <Paperclip className="w-4 h-4" />
                    </label>
                  </div>
              </div>
            </div>

            {isReplyExpanded && (
              <div className="flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center gap-4">
                  {!isInternalNote && (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-500">发送至:</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
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
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setIsReplyExpanded(false);
                      setReplyText('');
                    }}
                    className="px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!replyText.trim() || !outboundRecipientReady}
                    title={
                      !outboundRecipientReady && !isInternalNote
                        ? '请至少选择客户或平台经理'
                        : undefined
                    }
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
            )}
          </div>
        </div>
      </div>
      
      {/* Right Sidebar - Business Intelligence */}
      <div className="w-[320px] flex flex-col shrink-0 bg-white overflow-y-auto border-l border-slate-200">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-2 pt-2 overflow-x-auto no-scrollbar scroll-smooth">
          {tabOrder.map((id) => {
            const label = {
              'order': '订单',
              'logistics': '物流',
              'invoice': '发票',
              'after-sales': '售后',
              'ai-insight': 'AI 摘要'
            }[id];
            
            return (
              <button 
                key={id}
                draggable
                onDragStart={(e) => handleDragStart(e, id)}
                onDragOver={(e) => handleDragOver(e, id)}
                onDragEnd={handleDragEnd}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "px-3 py-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 group relative",
                  activeTab === id ? "border-[#F97316] text-[#F97316]" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
                  draggedTab === id && "opacity-50"
                )}
              >
                {id === 'ai-insight' && (
                  <Sparkles className={cn("w-3 h-3 transition-colors", activeTab === id ? "text-[#F97316]" : "text-purple-400")} />
                )}
                {label}
                <GripVertical className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity absolute -left-0.5" />
              </button>
            );
          })}
        </div>

        {activeTab === 'ai-insight' && (
          <div className="flex flex-col h-full overflow-hidden">
            <section className="p-4 flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  AI 分析
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void handleTicketInsight()}
                    disabled={ticketInsightLoading}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
                    title="重新生成分析"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", ticketInsightLoading ? "animate-spin" : "")} />
                  </button>
                  <label className="flex items-center gap-1.5 cursor-pointer group" title="点开工单时是否自动调用 AI 总结">
                    <div
                      className={cn(
                        'w-7 h-4 rounded-full relative transition-colors',
                        autoInsightEnabled ? 'bg-purple-500' : 'bg-slate-200'
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        toggleAutoInsight(!autoInsightEnabled);
                      }}
                    >
                      <div
                        className={cn(
                          'absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform shadow-sm',
                          autoInsightEnabled ? 'left-3.5' : 'left-0.5'
                        )}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 group-hover:text-slate-700 transition-colors">
                      自动
                    </span>
                  </label>
                </div>
              </div>

              {ticketInsightLoading && !ticketAiSummary ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-3 text-slate-200" />
                  <p className="text-xs">正在深度分析对话并生成摘要…</p>
                </div>
              ) : ticketAiSummary ? (
                <div className="space-y-4 overflow-y-auto pr-1 custom-scrollbar">
                  <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-400/50" />
                    <h4 className="text-[11px] font-bold text-purple-800 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      核心摘要
                    </h4>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {ticketAiSummary}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 shadow-sm">
                      <h4 className="text-[10px] font-bold text-blue-800 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        主要意图
                      </h4>
                      <p className="text-sm font-medium text-slate-800">{ticket.intent || '分析中…'}</p>
                    </div>
                    <div className={cn(
                      "border rounded-xl p-3 shadow-sm",
                      ticket.sentiment === Sentiment.ANGRY ? "bg-red-50/50 border-red-100" :
                      ticket.sentiment === Sentiment.ANXIOUS ? "bg-orange-50/50 border-orange-100" :
                      ticket.sentiment === Sentiment.JOYFUL ? "bg-green-50/50 border-green-100" :
                      "bg-slate-50/50 border-slate-100"
                    )}>
                      <h4 className={cn(
                        "text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1",
                        ticket.sentiment === Sentiment.ANGRY ? "text-red-800" :
                        ticket.sentiment === Sentiment.ANXIOUS ? "text-orange-800" :
                        ticket.sentiment === Sentiment.JOYFUL ? "text-green-800" :
                        "text-slate-600"
                      )}>
                        <Smile className="w-3 h-3" />
                        用户情绪
                      </h4>
                      <p className="text-sm font-medium text-slate-800">
                        {ticket.sentiment === Sentiment.ANGRY ? '愤怒抱怨' :
                         ticket.sentiment === Sentiment.ANXIOUS ? '焦急催促' :
                         ticket.sentiment === Sentiment.JOYFUL ? '开心满意' :
                         '平静中性'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAiSuggest}
                    disabled={isGeneratingDraft}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-purple-50 border border-purple-200 hover:bg-purple-100 text-xs font-bold text-purple-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title="基于知识库自动生成回复草稿"
                  >
                    {isGeneratingDraft ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    )}
                    生成智能回复
                  </button>

                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-[10px] text-slate-400 text-center italic">
                      分析仅供参考，AI 识别可能存在误差。
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed mb-4">
                    点击按钮开始分析工单，AI 将自动识别客户意图、情绪并生成摘要。
                  </p>
                  <button
                    onClick={() => void handleTicketInsight()}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
                  >
                    开始分析
                  </button>
                  <button
                    type="button"
                    onClick={handleAiSuggest}
                    disabled={isGeneratingDraft}
                    className="mt-3 w-full max-w-[260px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-purple-50 border border-purple-200 hover:bg-purple-100 text-xs font-bold text-purple-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title="基于知识库自动生成回复草稿"
                  >
                    {isGeneratingDraft ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    )}
                    生成智能回复
                  </button>
                </div>
              )}
            </section>
          </div>
        )}

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
                      <span className="font-medium text-slate-700">
                        {platformGroupLabelForTicket(ticket.platformType, ticket.channelId)}
                      </span>
                      <span className="text-slate-400 px-0.5">|</span>
                      <span className="font-medium text-slate-700">{ticket.channelId}</span>
                    </p>
                    {ticket.channelPlatformLanguage && (
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                        <span>平台语言 {ticket.channelPlatformLanguage}</span>
                      </p>
                    )}
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
                      
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">工单创建时间</p>
                        <p className="text-sm text-slate-900 tabular-nums">
                          {format(new Date(ticket.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">下单时间</p>
                          <p className="text-sm text-slate-900 tabular-nums">
                            {order.paidAt
                              ? format(new Date(order.paidAt), 'yyyy-MM-dd HH:mm')
                              : order.createdAt
                                ? format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm')
                                : '未知'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">预计送达</p>
                          <p className="text-sm text-slate-900">{formatDeliveryEtaDisplay(order.deliveryEta)}</p>
                        </div>
                        {order.orderStatus === 'shipped' && order.shippedAt && (
                          <div className="space-y-1">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">发货时间</p>
                            <p className="text-sm text-slate-900 tabular-nums">
                              {format(new Date(order.shippedAt), 'yyyy-MM-dd HH:mm')}
                            </p>
                          </div>
                        )}
                        {(order.orderStatus === 'refunded' || order.orderStatus === 'partial_refund') && order.refundedAt && (
                          <div className="space-y-1">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">退款时间</p>
                            <p className="text-sm text-slate-900 tabular-nums">
                              {format(new Date(order.refundedAt), 'yyyy-MM-dd HH:mm')}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">收货地址</p>
                        <p className="text-sm text-slate-900 leading-tight">
                          {displayOrderShippingAddress(order)}
                        </p>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">商品明细</p>
                        {order.productTitles.map((title, i) => (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between text-sm text-slate-900 group/product">
                              <span 
                                className="truncate pr-2 cursor-help" 
                                title={title}
                              >
                                {title}
                              </span>
                              <span className="shrink-0 whitespace-nowrap text-slate-500">
                                1 × {formatOrderMoney(order.amount, orderMoneyCurrency)}
                              </span>
                            </div>
                            {order.eanList?.[i] && (
                              <p className="text-[10px] text-slate-400 tabular-nums">
                                EAN: <span className="font-medium text-slate-500">{order.eanList[i]}</span>
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      <div className="pt-2 border-t border-slate-100 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">金额</span>
                          <span className="text-slate-900">
                            {formatOrderMoney(order.amount, orderMoneyCurrency)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm font-bold">
                          <span className="text-slate-900">总计</span>
                          <span className="text-slate-900">
                            {formatOrderMoney(order.amount, orderMoneyCurrency)}
                          </span>
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
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400 italic">未关联订单数据</p>
                      {intellideskConfigured() ? (
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          请点左侧工单列表旁<strong>刷新</strong>（会同步订单再匹配工单）。若会话标题实为平台单号，同步后会自动尝试关联。
                        </p>
                      ) : null}
                    </div>
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
                                <p className="text-xs font-bold text-slate-900 truncate">
                                  {(agentSeatDisplayName?.trim() || '坐席') + ' · ' + note.senderId}
                                </p>
                                <p className="text-[10px] text-slate-500 tabular-nums">
                                  {format(new Date(note.createdAt), 'yyyy-MM-dd HH:mm')}
                                </p>
                              </div>
                            </div>
                            {(onUpdateInternalNote || onDeleteInternalNote) &&
                              editingInternalNoteId !== note.id && (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  {onUpdateInternalNote ? (
                                    <button
                                      type="button"
                                      title="编辑"
                                      className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                                      onClick={() => {
                                        setEditingInternalNoteId(note.id);
                                        setEditingInternalNoteDraft(note.content);
                                      }}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                  ) : null}
                                  {onDeleteInternalNote ? (
                                    <button
                                      type="button"
                                      title="删除"
                                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                      onClick={() => {
                                        if (!window.confirm('确定删除此条内部备注？')) return;
                                        void Promise.resolve(onDeleteInternalNote(note.id)).catch(() => {
                                          /* 错误由父级展示 */
                                        });
                                      }}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  ) : null}
                                </div>
                              )}
                          </div>
                          {editingInternalNoteId === note.id && onUpdateInternalNote ? (
                            <div className="space-y-2 pl-9">
                              <textarea
                                className="w-full text-sm text-slate-800 leading-relaxed border border-orange-200 rounded-lg p-2 min-h-[72px] bg-white focus:outline-none focus:ring-2 focus:ring-orange-200/80 resize-y"
                                value={editingInternalNoteDraft}
                                onChange={(e) => setEditingInternalNoteDraft(e.target.value)}
                                disabled={savingInternalNote}
                                rows={3}
                                aria-label="编辑内部备注"
                                placeholder="输入备注内容..."
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
                                  disabled={savingInternalNote}
                                  onClick={() => {
                                    setEditingInternalNoteId(null);
                                    setEditingInternalNoteDraft('');
                                  }}
                                >
                                  取消
                                </button>
                                <button
                                  type="button"
                                  className="px-2.5 py-1 text-xs font-bold text-white bg-[#F97316] hover:bg-orange-600 rounded-md transition-colors disabled:opacity-50"
                                  disabled={savingInternalNote || !editingInternalNoteDraft.trim()}
                                  onClick={async () => {
                                    const text = editingInternalNoteDraft.trim();
                                    if (!text) return;
                                    setSavingInternalNote(true);
                                    try {
                                      await Promise.resolve(onUpdateInternalNote(note.id, text));
                                      setEditingInternalNoteId(null);
                                      setEditingInternalNoteDraft('');
                                    } catch {
                                      /* 父级已 setApiError */
                                    } finally {
                                      setSavingInternalNote(false);
                                    }
                                  }}
                                >
                                  {savingInternalNote ? '保存中…' : '保存'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap pl-9">
                              {note.content}
                            </p>
                          )}
                        </article>
                      ))
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'logistics' && (
          <div className="flex flex-col p-4">
            {order && (order.trackingNumber?.trim() || order.logisticsStatus != null) ? (
              <div className="space-y-6">
                {/* Logistics Overview Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm shrink-0">
                        <Package className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">承运商 & 单号</p>
                        <div className="flex flex-col">
                          <p className="text-xs font-medium text-slate-500 truncate" title={order.carrier || ''}>
                            {order.carrier?.trim() || '未知承运商'}
                          </p>
                          <p className="text-sm font-bold text-slate-900 break-all leading-tight">
                            {order.trackingNumber?.trim() || '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                     {(() => {
                       const badge = logisticsBadgeForOrder(order);
                       return (
                         <div className="flex flex-col items-end gap-1 shrink-0">
                           <span className={cn(
                             "text-[10px] px-2 py-0.5 rounded-md font-bold border flex items-center gap-1.5",
                             badge.color
                           )}>
                             <span className={cn("w-1.5 h-1.5 rounded-full", badge.dot)} />
                             {badge.label}
                           </span>
                           {order.logisticsSecondaryStatus && order.logisticsSecondaryStatus !== badge.label && (
                             <span className="text-[9px] text-slate-400 font-medium px-1 max-w-[120px] truncate text-right">
                               {order.logisticsSecondaryStatus}
                             </span>
                           )}
                         </div>
                       );
                     })()}
                     <div className="flex flex-col items-end gap-1 shrink-0">
                       <button
                         onClick={() => handleSyncLogistics(true)}
                         disabled={isSyncingLogistics}
                         className={cn(
                           "p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all shadow-sm disabled:opacity-50",
                           isSyncingLogistics && "animate-spin"
                         )}
                         title="同步 17track 物流轨迹"
                       >
                         <RefreshCw className={cn("w-3.5 h-3.5", isSyncingLogistics && "animate-spin")} />
                       </button>
                       {order.logisticsLastSyncedAt && (
                         <span className="text-[9px] text-slate-400 font-medium">
                           上次同步: {format(new Date(order.logisticsLastSyncedAt), 'HH:mm')}
                         </span>
                       )}
                     </div>
                   </div>
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">发货时间</p>
                      <p className="text-xs text-slate-700 font-medium">
                        {order.shippedAt
                          ? format(new Date(order.shippedAt), 'yyyy-MM-dd')
                          : order.logisticsEvents?.length
                            ? format(
                                new Date(
                                  order.logisticsEvents[order.logisticsEvents.length - 1].timestamp
                                ),
                                'yyyy-MM-dd'
                              )
                            : '—'}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">预计送达</p>
                      <p className="text-xs text-slate-700 font-medium">{formatDeliveryEtaDisplay(order.deliveryEta)}</p>
                    </div>
                  </div>
                </div>

                {/* Logistics Timeline */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-slate-400" />
                    物流追踪详情
                  </h4>
                  <div className="relative pl-4 space-y-6 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                    {(order.logisticsEvents || []).length > 0 ? (
                      order.logisticsEvents?.map((event, idx) => (
                        <div key={event.id} className="relative pl-6">
                          <div className={cn(
                            "absolute left-[-14.5px] top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10",
                            idx === 0 ? getLogisticsStatusConfig(event.status).dot : "bg-slate-300"
                          )} />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className={cn(
                                "text-sm font-medium",
                                idx === 0 ? "text-slate-900" : "text-slate-600"
                              )}>
                                {event.description}
                              </p>
                              {idx === 0 && event.subStatus && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">
                                  {event.subStatus}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 tabular-nums">
                              <span>{format(new Date(event.timestamp), 'yyyy-MM-dd HH:mm')}</span>
                              {event.location && (
                                <>
                                  <span>·</span>
                                  <span>{event.location}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
                          <Truck className="w-6 h-6 text-slate-200" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            {order.logisticsStatus === LogisticsStatus.NOT_FOUND 
                              ? '轨迹尚未生成' 
                              : '暂无详细追踪轨迹'}
                          </p>
                          <p className="text-[11px] text-slate-400 max-w-[220px] mx-auto leading-relaxed">
                            {order.logisticsStatus === LogisticsStatus.NOT_FOUND
                              ? '单号已提交查询，17track 抓取到信息后将自动同步。'
                              : '请稍后点击上方刷新按钮同步，或前往承运商官网查询。'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center space-y-3">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                  <Truck className="w-8 h-8 text-slate-200" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900">暂无物流轨迹信息</p>
                  <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">
                    当前订单尚未产生物流追踪数据，可能还在等待揽收。
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'invoice' && (
          <div className="p-4 space-y-6">
            {!order?.hasVatInfo ? (
              <div className="flex flex-col items-center justify-center h-64 text-center space-y-4 animate-in fade-in duration-300">
                <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center text-[#F97316]">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900">未维护主体/VAT信息</p>
                  <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed mx-auto">
                    当前店铺尚未在母系统中配置 VAT 税号或公司开票抬头，无法生成正式发票。
                  </p>
                </div>
                <a 
                  href="https://tiaojia.nezhachuhai.com/tools/vat/shop"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-white border border-slate-200 hover:border-[#F97316] hover:text-[#F97316] rounded-lg text-xs font-bold text-slate-600 transition-all shadow-sm"
                >
                  去维护主体信息
                </a>
              </div>
            ) : !order.storeEntity ? (
              <div className="flex flex-col items-center justify-center h-64 text-center space-y-4 animate-in fade-in duration-300">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
                  <Info className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900">主体详情待同步</p>
                  <p className="text-xs text-slate-400 max-w-[220px] leading-relaxed mx-auto">
                    已检测到 VAT 标识，但母系统尚未同步具体主体详情（公司名、地址等）。
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full px-8">
                  <button 
                    onClick={() => window.location.reload()}
                    className="w-full py-2 bg-white border border-slate-200 hover:border-amber-500 hover:text-amber-600 rounded-lg text-xs font-bold text-slate-600 transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    强制刷新同步
                  </button>
                  <p className="text-[9px] text-slate-400">若多次刷新无效，请联系系统管理员检查母系统 API。 </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-[#F97316]">
                      <FileText className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">生成发票</h4>
                      </div>
                      <p className="text-[11px] text-slate-500">当前仅提供统一发票模版</p>
                    </div>
                  </div>
                  {order.storeEntity && (
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">已绑定主体</p>
                        <p className="text-[10px] text-slate-600 truncate font-medium">{order.storeEntity.legalName}</p>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold shrink-0">
                        {order.storeEntity.vatNumber}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setIsPreviewModalOpen(true)}
                  className="w-full py-3 bg-gradient-to-r from-[#F97316] to-[#FB923C] hover:from-orange-600 hover:to-orange-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 group active:scale-[0.98]"
                >
                  <FileText className="w-4 h-4 group-hover:rotate-6 transition-transform" />
                  生成并预览发票
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'after-sales' && (
          <div className="flex flex-col min-h-full">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                已登记售后 ({afterSalesRecords.length})
              </h4>
              {afterSalesRecords.length > 0 && (
                <button 
                  onClick={() => setIsAfterSalesModalOpen(true)}
                  className="text-[11px] font-bold text-[#F97316] hover:text-orange-600 flex items-center gap-1 transition-colors px-2 py-1 rounded-md hover:bg-orange-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  再次提交
                </button>
              )}
            </div>

            <div className="flex-1 p-4">
              {afterSalesRecords.length > 0 ? (
                <div className="space-y-4">
                  {afterSalesRecords.map((record) => (
                    <article 
                      key={record.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3 hover:border-slate-300 transition-colors group/record"
                    >
                      <div className="flex items-start justify-between">
                        <span className={cn(
                          "px-2 py-1 rounded-md text-[10px] font-bold border",
                          record.type === AfterSalesType.REFUND ? "bg-red-50 text-red-600 border-red-100" :
                          record.type === AfterSalesType.RETURN ? "bg-blue-50 text-blue-600 border-blue-100" :
                          record.type === AfterSalesType.EXCHANGE ? "bg-purple-50 text-purple-600 border-purple-100" :
                          "bg-orange-50 text-orange-600 border-orange-100"
                        )}>
                          {record.type === AfterSalesType.REFUND ? '退款' :
                           record.type === AfterSalesType.RETURN ? '退货' :
                           record.type === AfterSalesType.EXCHANGE ? '换货' : '补发'} · {record.handlingMethod}
                        </span>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => {
                              setEditingAfterSalesRecord(record);
                              setIsAfterSalesModalOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all opacity-0 group-hover/record:opacity-100"
                            title="编辑售后记录"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => handleDeleteAfterSales(record.id)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all opacity-0 group-hover/record:opacity-100"
                            title="删除售后记录"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <span className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-bold",
                            record.status === AfterSalesStatus.COMPLETED ? "bg-green-50 text-green-600" :
                            record.status === AfterSalesStatus.REJECTED ? "bg-slate-100 text-slate-500" :
                            "bg-amber-50 text-amber-600 animate-pulse"
                          )}>
                            {record.status === AfterSalesStatus.SUBMITTED ? '已提交' :
                             record.status === AfterSalesStatus.PROCESSING ? '处理中' :
                             record.status === AfterSalesStatus.COMPLETED ? '已完成' : '已拒绝'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-[11px] text-slate-400 tabular-nums">
                          单号：
                          <span
                            className="text-slate-700 font-medium"
                            title={`完整售后单 ID：${record.id}`}
                          >
                            {formatAfterSalesReadableLabel({
                              channelId: record.channelShopLabel ?? ticket.channelId,
                              platformType: record.channelPlatformType ?? ticket.platformType,
                              type: record.type,
                              createdAt: record.createdAt,
                              rawId: record.id,
                            })}
                          </span>
                          <span className="mx-2">·</span>
                          分类：<span className="text-slate-700 font-medium">{record.problemType}</span>
                        </p>
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                          反馈：{record.buyerFeedback}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
                        <p className="text-[10px] text-slate-400 tabular-nums">
                          {format(new Date(record.createdAt), 'yyyy-MM-dd HH:mm')}
                        </p>
                        <button className="text-[10px] font-bold text-blue-600 hover:underline">
                          查看详情
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                    <History className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900">暂无售后记录</p>
                    <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed mx-auto">
                      目前该订单尚未在系统中登记任何售后申请（退款、退货、补发等）。
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsAfterSalesModalOpen(true)}
                    className="px-6 py-2.5 bg-[#F97316] hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98]"
                  >
                    提交售后申请
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <InvoicePreviewModal 
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        template={invoiceTemplate}
        order={order}
        customer={customer}
        lang={getInvoiceLang()}
        onSendToCustomer={
          onSendMessage
            ? ({ content, attachments }) =>
                onSendMessage({
                  content,
                  recipients: ['customer'],
                  isInternal: false,
                  translateToPlatform: false,
                  attachments,
                })
            : undefined
        }
      />
      
      <SubmitAfterSalesModal
        isOpen={isAfterSalesModalOpen}
        onClose={() => {
          setIsAfterSalesModalOpen(false);
          setEditingAfterSalesRecord(undefined);
        }}
        initialData={editingAfterSalesRecord}
        apiSubmit={{
          tenantId: intellideskTenantId(),
          userId: intellideskUserIdForApi(user?.id),
          defaultTicketId: ticket.id,
          onSuccess: async () => {
            await loadAfterSales();
          },
        }}
        onSubmit={handleSubmitAfterSales}
        order={order || undefined}
      />

      <AiSuggestionModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        isLoading={isGeneratingDraft}
        suggestion={aiSuggestion}
        onAdopt={handleAdoptAiSuggestion}
        onRefresh={handleAiSuggest}
      />

      {/* Citation Sources Modal */}
      {citationMessageId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-[#9333EA]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900">AI 回复引用来源</h3>
              </div>
              <button 
                onClick={() => setCitationMessageId(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                title="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                {MOCK_KB_CITATIONS.map((cite) => (
                  <div key={cite.id} className="p-4 rounded-xl border border-purple-100 bg-purple-50/30 space-y-3 relative group">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-purple-600 bg-white border border-purple-200 px-2 py-0.5 rounded-md shadow-sm">
                        知识库匹配 ({(0.85 + Math.random() * 0.1).toFixed(2)})
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => recordKbCitationFeedback('helpful', cite)}
                          className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-all"
                          title="引用准确"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => recordKbCitationFeedback('stale', cite)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-all"
                          title="内容陈旧/需更新"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => recordKbCitationFeedback('pending', cite)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"
                          title="引用不相关/需人工介入"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-900">《{cite.docName}》</p>
                      <p className="text-sm text-slate-600 leading-relaxed italic">
                        "...{cite.excerpt}..."
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {citationRecordHint && (
                <div className="p-3 bg-green-50 border border-green-100 rounded-lg flex items-center gap-2 text-xs text-green-700 animate-in fade-in slide-in-from-top-1">
                  <CheckCircle2 className="w-4 h-4" />
                  {citationRecordHint}
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 italic">
                <span>* 基于知识库检索结果自动生成</span>
                <Link 
                  to="/settings/knowledge" 
                  className="text-blue-600 hover:underline font-medium non-italic"
                >
                  去管理知识库
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
