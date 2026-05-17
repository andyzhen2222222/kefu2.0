import { useState, useEffect, useMemo } from 'react';
import { X, Search, Plus, Upload, Calendar, AlertCircle, Package, Sparkles, Loader2 } from 'lucide-react';
import { cn, openFieldConfigPage } from '@/src/lib/utils';
import { useIsMobile } from '@/src/hooks/useIsMobile';
import {
  H5_FORM_CONTROL,
  H5_MODAL_BTN_GHOST,
  H5_MODAL_HEADER,
  H5_SAFE_BOTTOM,
  H5_TAB_BOTTOM_BAR,
  H5_TAB_BTN_ACCENT,
  H5_TAB_BTN_SECONDARY,
} from '@/src/h5/h5UiSpec';
import { RETURN_CARRIER_DICT_ID, RETURN_CARRIER_SEED_ITEMS } from '@/src/lib/afterSalesFieldOptions';
import { Order, AfterSalesType, type AfterSalesRecord } from '@/src/types';
import { recognizeAfterSalesFromFeedback } from '@/src/services/geminiService';
import {
  fetchOrderByPlatformOrderId,
  mapApiOrderToUi,
  createAfterSalesRecord,
  patchAfterSalesRecord,
} from '@/src/services/intellideskApi';

type AfterSalesPriority = 'low' | 'medium' | 'high';

function coerceAfterSalesPriority(v: unknown): AfterSalesPriority {
  if (v === 'low' || v === 'medium' || v === 'high') return v;
  return 'low';
}

const AFTER_SALES_CATEGORY_LABELS: Record<string, string> = {
  logistics: '物流问题',
  quality: '质量问题',
  wrong_item: '发错货',
  missing_part: '少发漏发',
  not_received: '未收到货',
  customer_reason: '客户原因',
};

interface SubmitAfterSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  order?: Order;
  initialData?: AfterSalesRecord;
  onSubmit: (data: Record<string, unknown>) => void;
  /** 配置 API 时由父组件传入，走 POST/PATCH /api/after-sales */
  apiSubmit?: {
    tenantId: string;
    userId: string | undefined;
    /** 从工单详情打开时传入，用于与订单一并提交；手动登记仅搜订单时不必传 */
    defaultTicketId?: string;
    onSuccess: () => void | Promise<void>;
  };
}

export default function SubmitAfterSalesModal({
  isOpen,
  onClose,
  order,
  initialData,
  onSubmit,
  apiSubmit,
}: SubmitAfterSalesModalProps) {
  const isMobile = useIsMobile();
  const isH5App = import.meta.env.VITE_APP_TYPE === 'h5';
  const [pcManageHint, setPcManageHint] = useState<string | null>(null);
  // If initialData exists, we initialize state with it (simulating an edit mode)
  const [searchOrderQuery, setSearchOrderQuery] = useState('');
  const [searchedOrder, setSearchedOrder] = useState<Order | null>(null);

  const [type, setType] = useState<AfterSalesType>(initialData?.type || AfterSalesType.REFUND);
  const [handlingMethod, setHandlingMethod] = useState(initialData?.handlingMethod || '待确认');
  const [priority, setPriority] = useState<AfterSalesPriority>(
    coerceAfterSalesPriority(initialData?.priority)
  );
  const [problemType, setProblemType] = useState(initialData?.problemType || '');
  const [buyerFeedback, setBuyerFeedback] = useState(initialData?.buyerFeedback || '');
  const [refundAmount, setRefundAmount] = useState<number | ''>(initialData?.refundAmount || '');
  const [refundExecutionType, setRefundExecutionType] = useState<'manual' | 'api'>('manual');
  const [afterSalesCategory, setAfterSalesCategory] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [returnTrackingNumber, setReturnTrackingNumber] = useState('');
  const [returnCarrier, setReturnCarrier] = useState('');

  const carrierSelectOptions = useMemo(() => {
    const active = RETURN_CARRIER_SEED_ITEMS.filter((i) => i.status === 'active');
    if (returnCarrier && !active.some((c) => c.value === returnCarrier)) {
      return [
        { id: '_legacy', label: `${returnCarrier}（历史）`, value: returnCarrier, status: 'active' as const },
        ...active,
      ];
    }
    return active;
  }, [returnCarrier]);

  const handleOpenFieldManage = (dictId: string, fieldLabel: string) => {
    if (isH5App || isMobile) {
      setPcManageHint(`请在 PC 端打开「设置 → 字段管理」维护${fieldLabel}。`);
      return;
    }
    openFieldConfigPage(dictId);
  };

  useEffect(() => {
    if (!isOpen) return;
    setApiError(null);
    setPcManageHint(null);
    if (initialData) {
      setType(initialData.type);
      setHandlingMethod(initialData.handlingMethod || '待确认');
      setPriority(coerceAfterSalesPriority(initialData.priority));
      setProblemType(initialData.problemType || '');
      setBuyerFeedback(initialData.buyerFeedback || '');
      setRefundAmount(initialData.refundAmount ?? '');
      setReturnTrackingNumber(initialData.returnTrackingNumber?.trim() ?? '');
      setReturnCarrier(initialData.returnCarrier?.trim() ?? '');
    } else {
      setType(AfterSalesType.REFUND);
      setHandlingMethod('待确认');
      setPriority('low');
      setProblemType('');
      setBuyerFeedback('');
      setRefundAmount('');
      setReturnTrackingNumber('');
      setReturnCarrier('');
      setSearchedOrder(null);
      setSearchOrderQuery('');
    }
  }, [isOpen, initialData?.id, apiSubmit?.defaultTicketId]);

  if (!isOpen) return null;

  const currentOrder = order || searchedOrder;
  const currentPlatformType = currentOrder?.platformType || '';
  const isApiRefundSupported = ['SHOPIFY', 'WOOCOMMERCE', 'CDISCOUNT', 'OZON', 'WALMART_US', '独立站'].includes(currentPlatformType.toUpperCase());

  const handleAIRecognize = async () => {
    setApiError(null);
    setIsRecognizing(true);
    try {
      const result = await recognizeAfterSalesFromFeedback(buyerFeedback, {
        ticketId: apiSubmit?.defaultTicketId,
        maxRefund: currentOrder?.amount,
        currency: currentOrder?.currency,
        onApiFailure: (msg) => setApiError(`AI 识别失败：${msg}（已用本地规则填充，可手动调整）`),
      });
      if (result.afterSalesType) setAfterSalesCategory(result.afterSalesType);
      setPriority(coerceAfterSalesPriority(result.priority));
      setType(result.processingType);
      if (result.afterSalesType) {
        setProblemType(AFTER_SALES_CATEGORY_LABELS[result.afterSalesType] || result.afterSalesType);
      }
      if (
        result.refundAmount != null &&
        result.processingType === AfterSalesType.REFUND
      ) {
        setRefundAmount(result.refundAmount);
      }
      if (result.summary) {
        setBuyerFeedback(result.summary);
      }
    } finally {
      setIsRecognizing(false);
    }
  };

  const handleSearchOrder = async () => {
    setApiError(null);
    const q = searchOrderQuery.trim();
    if (!q) return;
    if (apiSubmit) {
      try {
        const raw = await fetchOrderByPlatformOrderId(
          apiSubmit.tenantId,
          apiSubmit.userId,
          q
        );
        setSearchedOrder(mapApiOrderToUi(raw));
      } catch (e) {
        setSearchedOrder(null);
        setApiError(e instanceof Error ? e.message : String(e));
      }
      return;
    }
    setSearchedOrder({
      id: q,
      platformOrderId: `PLTF-${q}`,
      customerId: 'C-MOCK',
      channelId: 'Amazon',
      skuList: ['SKU-123', 'SKU-456'],
      productTitles: ['Mock Product 1', 'Mock Product 2'],
      amount: 199.99,
      currency: 'USD',
      orderStatus: 'shipped',
      shippingStatus: 'Delivered',
      trackingNumber: 'TRK-MOCK-123',
      deliveryEta: '2024-03-20',
      paymentStatus: 'Paid',
      carrier: 'UPS',
      hasVatInfo: false,
      logisticsEvents: [],
    });
  };

  const submitAccentClass =
    type === AfterSalesType.REFUND && refundExecutionType === 'api'
      ? '!bg-green-600 hover:!bg-green-700'
      : '';

  const submitLabel = initialData
    ? '保存修改'
    : type === AfterSalesType.REFUND && refundExecutionType === 'api' && refundAmount
      ? isMobile
        ? '提交并原路退回'
        : `提交并原路退回 (${currentOrder?.currency || 'USD'} ${refundAmount})`
      : '提交售后';

  const handleSubmit = async () => {
    setApiError(null);
    if (apiSubmit && !initialData?.id) {
      if (!currentOrder?.id) {
        setApiError('请先搜索并匹配订单');
        return;
      }
      if (
        type === AfterSalesType.REFUND &&
        typeof refundAmount === 'number' &&
        currentOrder.amount &&
        refundAmount > currentOrder.amount
      ) {
        setApiError('退款金额不可超过订单最大可退金额');
        return;
      }
      if (
        (type === AfterSalesType.RETURN || type === AfterSalesType.EXCHANGE) &&
        (!returnTrackingNumber.trim() || !returnCarrier.trim())
      ) {
        setApiError('请填写退回物流单号并选择退回承运商');
        return;
      }
      setSubmitting(true);
      try {
        await createAfterSalesRecord(apiSubmit.tenantId, apiSubmit.userId, {
          orderId: currentOrder.id,
          ...(apiSubmit.defaultTicketId ? { ticketId: apiSubmit.defaultTicketId } : {}),
          type,
          handlingMethod,
          priority: priority as 'low' | 'medium' | 'high',
          problemType,
          buyerFeedback: buyerFeedback.trim(),
          refundAmount:
            refundAmount === '' || refundAmount === undefined ? undefined : Number(refundAmount),
          refundExecutionType,
          ...(type === AfterSalesType.RETURN || type === AfterSalesType.EXCHANGE
            ? {
                returnTrackingNumber: returnTrackingNumber.trim(),
                returnCarrier: returnCarrier.trim(),
              }
            : {}),
        });
        await apiSubmit.onSuccess();
        onClose();
      } catch (e) {
        setApiError(e instanceof Error ? e.message : String(e));
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (apiSubmit && initialData?.id) {
      if (
        type === AfterSalesType.REFUND &&
        typeof refundAmount === 'number' &&
        currentOrder?.amount &&
        refundAmount > currentOrder.amount
      ) {
        setApiError('退款金额不可超过订单最大可退金额');
        return;
      }
      if (
        (type === AfterSalesType.RETURN || type === AfterSalesType.EXCHANGE) &&
        (!returnTrackingNumber.trim() || !returnCarrier.trim())
      ) {
        setApiError('请填写退回物流单号并选择退回承运商');
        return;
      }
      setSubmitting(true);
      try {
        await patchAfterSalesRecord(apiSubmit.tenantId, apiSubmit.userId, initialData.id, {
          handlingMethod,
          priority: priority as 'low' | 'medium' | 'high',
          problemType,
          buyerFeedback: buyerFeedback.trim(),
          refundAmount:
            refundAmount === '' || refundAmount === undefined ? undefined : Number(refundAmount),
          ...(type === AfterSalesType.RETURN || type === AfterSalesType.EXCHANGE
            ? {
                returnTrackingNumber: returnTrackingNumber.trim(),
                returnCarrier: returnCarrier.trim(),
              }
            : {}),
        });
        await apiSubmit.onSuccess();
        onClose();
      } catch (e) {
        setApiError(e instanceof Error ? e.message : String(e));
      } finally {
        setSubmitting(false);
      }
      return;
    }
    onSubmit({
      orderId: currentOrder?.id,
      ticketId: apiSubmit?.defaultTicketId,
      type,
      handlingMethod,
      priority,
      problemType,
      buyerFeedback,
      refundAmount,
      refundExecutionType,
      afterSalesCategory,
      ...(type === AfterSalesType.RETURN || type === AfterSalesType.EXCHANGE
        ? {
            returnTrackingNumber: returnTrackingNumber.trim(),
            returnCarrier: returnCarrier.trim(),
          }
        : {}),
    });
    onClose();
  };

  const fieldClass = (extra?: string) =>
    cn(
      isMobile
        ? H5_FORM_CONTROL
        : 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20',
      extra
    );

  const fieldClassWhite = (extra?: string) => fieldClass(cn('bg-white', extra));

  /** 移动端不用 grid+col-span，避免隐式多列导致字段挤在一行 */
  const formFieldsLayout = isMobile ? 'flex w-full min-w-0 flex-col gap-6' : 'grid gap-6 grid-cols-2';

  const formFieldWrap = 'w-full min-w-0 space-y-1.5';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-0 backdrop-blur-sm animate-in fade-in duration-200 sm:p-4">
      <div
        className={cn(
          'flex flex-col overflow-hidden bg-white shadow-2xl animate-in zoom-in-95 duration-200',
          isMobile ? 'h-full w-full rounded-none' : 'max-h-[90vh] w-full max-w-4xl rounded-2xl'
        )}
      >
        {/* Header */}
        <div className={cn(H5_MODAL_HEADER, isMobile ? 'px-3 py-3' : 'px-6 py-4')}>
          <h2 className={cn('font-bold text-slate-900', isMobile ? 'text-sm' : 'text-lg')}>
            {initialData ? '修改售后工单' : '提交售后'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className={cn(
              'rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600',
              isMobile ? 'p-1.5' : 'p-2'
            )}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto',
            isMobile ? 'space-y-6 p-4' : 'space-y-8 p-6'
          )}
        >
          {pcManageHint ? (
            <div
              role="status"
              className="flex items-start justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950"
            >
              <span className="min-w-0 flex-1 leading-relaxed">{pcManageHint}</span>
              <button
                type="button"
                onClick={() => setPcManageHint(null)}
                className="shrink-0 text-xs font-medium text-amber-800 underline-offset-2 hover:underline"
              >
                知道了
              </button>
            </div>
          ) : null}
          {apiError ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-800">
              {apiError}
            </div>
          ) : null}
          {/* Order Info Section (Manual Entry) */}
          {!order && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <div className="w-1 h-4 bg-[#F97316] rounded-full" />
                关联订单
              </h3>
              <div className={cn('grid gap-6', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                <div className="col-span-full space-y-1.5 md:col-span-1">
                  <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                    <span className="text-red-500">*</span> 平台订单号:
                  </label>
                  <div className={cn('flex gap-2', isMobile && 'flex-col')}>
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={searchOrderQuery}
                        onChange={(e) => setSearchOrderQuery(e.target.value)}
                        placeholder="请输入订单号进行搜索"
                        className={cn(fieldClass(), 'pr-10')}
                      />
                      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSearchOrder()}
                      className={cn(
                        isMobile
                          ? H5_TAB_BTN_SECONDARY
                          : 'rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200'
                      )}
                    >
                      搜索带入
                    </button>
                  </div>
                </div>
              </div>
              
              {searchedOrder && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Package className="w-4 h-4 text-slate-500" />
                      已带入订单摘要: {searchedOrder.id}
                    </span>
                    <button 
                      type="button" 
                      onClick={() => setSearchedOrder(null)}
                      className="text-xs text-[#F97316] hover:underline"
                    >
                      重新搜索
                    </button>
                  </div>
                  <div className={cn(
                    "grid gap-4 text-xs",
                    isMobile ? "grid-cols-2" : "grid-cols-4"
                  )}>
                    <div>
                      <span className="text-slate-500 block mb-1">平台单号</span>
                      <span className="font-medium text-slate-900">{searchedOrder.platformOrderId}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">店铺</span>
                      <span className="font-medium text-slate-900">{searchedOrder.channelId}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">金额</span>
                      <span className="font-medium text-slate-900">{searchedOrder.amount} {searchedOrder.currency}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">物流状态</span>
                      <span className="font-medium text-slate-900">{searchedOrder.shippingStatus}</span>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* After-sales Info Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <div className="w-1 h-4 bg-[#F97316] rounded-full" />
              售后信息
            </h3>
            <div
              className={cn(
                'gap-6',
                isMobile ? 'flex w-full min-w-0 flex-col' : 'grid grid-cols-3'
              )}
            >
              <div className={formFieldWrap}>
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <span className="text-red-500">*</span> 处理方式:
                </label>
                <select 
                  value={type}
                  onChange={(e) => setType(e.target.value as AfterSalesType)}
                  title="处理方式"
                  className={fieldClass()}
                >
                  <option value={AfterSalesType.REFUND}>退款 (Refund)</option>
                  <option value={AfterSalesType.RETURN}>退货 (Return)</option>
                  <option value={AfterSalesType.EXCHANGE}>换货 (Exchange)</option>
                  <option value={AfterSalesType.REISSUE}>重发 (Reissue)</option>
                </select>
              </div>
              <div className={formFieldWrap}>
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <span className="text-red-500">*</span> 优先级:
                </label>
                <select 
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as AfterSalesPriority)}
                  title="优先级"
                  className={fieldClass()}
                >
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                </select>
              </div>
              <div className={formFieldWrap}>
                <label className="text-xs font-medium text-slate-500">售后状态:</label>
                <select 
                  disabled 
                  title="售后状态"
                  className={fieldClass('bg-slate-100 text-slate-500')}
                >
                  <option>已提交</option>
                </select>
              </div>
            </div>

            {/* Dynamic Fields based on Type */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
              {type === AfterSalesType.REFUND && (
                <div className={formFieldsLayout}>
                  <div className={formFieldWrap}>
                    <label className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="text-red-500">*</span>
                        <span className="truncate">退款金额 ({currentOrder?.currency || 'USD'})</span>
                      </span>
                      {currentOrder?.amount ? (
                        <button
                          type="button"
                          onClick={() => setRefundAmount(currentOrder.amount)}
                          className="shrink-0 text-[10px] font-bold text-[#F97316] hover:underline"
                        >
                          全额退款
                        </button>
                      ) : null}
                    </label>
                    <div className="relative flex flex-col gap-1">
                      <input
                        type="number"
                        value={refundAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          const num = Number(val);
                          setRefundAmount(val === '' ? '' : num);
                        }}
                        max={currentOrder?.amount}
                        placeholder={`最大可退: ${currentOrder?.amount || 0}`}
                        className={fieldClassWhite(
                          typeof refundAmount === 'number' &&
                            currentOrder?.amount &&
                            refundAmount > currentOrder.amount
                            ? 'border-red-400 bg-red-50/50 text-red-600 focus:border-red-500 focus:ring-red-500/20'
                            : undefined
                        )}
                      />
                      {typeof refundAmount === 'number' &&
                        currentOrder?.amount &&
                        refundAmount > currentOrder.amount && (
                          <p className="flex items-center gap-1 text-[10px] font-bold text-red-500">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            金额不可超过订单实际支付最大可退金额
                          </p>
                        )}
                    </div>
                  </div>

                  <div className={formFieldWrap}>
                    <label className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="text-red-500">*</span> 售后类型
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenFieldManage('after_sales_type', '售后类型')}
                        className="shrink-0 text-[10px] font-medium text-[#F97316] hover:underline"
                      >
                        管理售后类型
                      </button>
                    </label>
                    <select
                      value={afterSalesCategory}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAfterSalesCategory(v);
                        setProblemType(v ? AFTER_SALES_CATEGORY_LABELS[v] || v : '');
                      }}
                      title="售后类型"
                      className={fieldClassWhite()}
                    >
                <option value="">请选择售后类型</option>
                <option value="logistics">物流问题</option>
                <option value="quality">质量问题</option>
                <option value="wrong_item">发错货</option>
                <option value="missing_part">少发漏发</option>
                <option value="not_received">未收到货</option>
                <option value="customer_reason">客户原因/不想要了</option>
              </select>
            </div>

                  {/* 退款执行方式选择 */}
                  <div
                    className={cn(
                      'w-full min-w-0 space-y-2 border-t border-slate-100 pt-4',
                      !isMobile && 'col-span-2'
                    )}
                  >
                    <label className="text-xs font-bold text-slate-700">退款执行方式</label>
                    <div className={cn(
                      "grid gap-4",
                      isMobile ? "grid-cols-1" : "grid-cols-2"
                    )}>
                      <label 
                        className={cn(
                          "border rounded-xl p-4 cursor-pointer transition-all", 
                          refundExecutionType === 'manual' ? 'border-[#F97316] bg-orange-50 ring-1 ring-[#F97316]' : 'border-slate-200 bg-white hover:border-[#F97316]/50'
                        )}
                        onClick={() => setRefundExecutionType('manual')}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", refundExecutionType === 'manual' ? "border-[#F97316]" : "border-slate-300")}>
                            {refundExecutionType === 'manual' && <div className="w-2 h-2 rounded-full bg-[#F97316]" />}
                          </div>
                          <div className="font-bold text-sm text-slate-900">登记退款申请</div>
                        </div>
                        <div className="text-xs text-slate-500 pl-6">仅在系统生成售后单，后续需人工审核或去平台后台操作退款。</div>
                      </label>

                      <label 
                        className={cn(
                          "border rounded-xl p-4 transition-all relative overflow-hidden", 
                          isApiRefundSupported 
                            ? (refundExecutionType === 'api' ? 'border-green-500 bg-green-50 ring-1 ring-green-500 cursor-pointer' : 'border-slate-200 bg-white hover:border-green-500/50 cursor-pointer') 
                            : 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                        )}
                        onClick={() => { if (isApiRefundSupported) setRefundExecutionType('api'); }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", refundExecutionType === 'api' ? "border-green-500" : "border-slate-300")}>
                              {refundExecutionType === 'api' && <div className="w-2 h-2 rounded-full bg-green-500" />}
                            </div>
                            <div className="font-bold text-sm text-slate-900">平台原路退回</div>
                          </div>
                          {isApiRefundSupported ? (
                            <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded font-bold">支持</span>
                          ) : (
                            <span className="bg-slate-200 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-bold">不支持</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 pl-6">
                          {isApiRefundSupported 
                            ? `提交后直接通过 ${currentOrder?.platformType || '平台'} 系统完成原路退款。`
                            : `${currentOrder?.platformType || '当前平台'} 暂不支持直接原路退回。`}
                        </div>
                      </label>
                    </div>
                  </div>

                </div>
              )}

              {(type === AfterSalesType.RETURN || type === AfterSalesType.EXCHANGE) && (
                <div className={formFieldsLayout}>
                  <div className={formFieldWrap}>
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <span className="text-red-500">*</span> 退回物流单号:
                    </label>
                    <input
                      type="text"
                      value={returnTrackingNumber}
                      onChange={(e) => setReturnTrackingNumber(e.target.value)}
                      placeholder="请输入买家退回的物流单号"
                      className={fieldClassWhite()}
                    />
                  </div>
                  <div className={formFieldWrap}>
                    <label className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="text-red-500">*</span> 退回承运商
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenFieldManage(RETURN_CARRIER_DICT_ID, '承运商')}
                        className="text-[10px] text-[#F97316] font-medium hover:underline"
                      >
                        管理承运商
                      </button>
                    </label>
                    <select
                      value={returnCarrier}
                      onChange={(e) => setReturnCarrier(e.target.value)}
                      title="退回承运商"
                      className={fieldClassWhite()}
                    >
                      <option value="">请选择承运商</option>
                      {carrierSelectOptions.map((c) => (
                        <option key={c.id} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {(type === AfterSalesType.REISSUE || type === AfterSalesType.EXCHANGE) && (
                <div className={formFieldsLayout}>
                  <div className={formFieldWrap}>
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <span className="text-red-500">*</span> 重发SKU
                    </label>
                    <input
                      type="text"
                      placeholder="请输入要重发的SKU"
                      className={fieldClassWhite()}
                    />
                  </div>
                  <div className={formFieldWrap}>
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <span className="text-red-500">*</span> 重发数量
                    </label>
                    <input
                      type="number"
                      min="1"
                      defaultValue="1"
                      className={fieldClassWhite()}
                    />
                  </div>
                </div>
              )}
            </div>

            <div
              className={cn(
                'gap-6',
                isMobile ? 'flex w-full min-w-0 flex-col' : 'grid grid-cols-3'
              )}
            >
              <div className={formFieldWrap}>
                <label className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="text-red-500">*</span> 签收方
                  </span>
                  <button 
                    type="button"
                    onClick={() => handleOpenFieldManage('receiver', '签收方')}
                    className="text-[10px] text-[#F97316] font-medium hover:underline"
                  >
                    管理签收方
                  </button>
                </label>
                <select title="签收方" className={fieldClass()}>
                  <option value="">选择退件仓</option>
                  <option value="us_east">美东 1 号仓 (NJ)</option>
                  <option value="us_west">美西退件仓 (CA)</option>
                  <option value="eu_uk">英国伦敦转运仓</option>
                </select>
              </div>
              <div className={formFieldWrap}>
                <label className="text-xs font-medium text-slate-500">客户签收时间</label>
                <div className="relative">
                  <input type="date" className={cn(fieldClass(), 'pr-10')} />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className={formFieldWrap}>
                <label className="text-xs font-medium text-slate-500">客户反馈时间</label>
                <div className="relative">
                  <input type="date" className={cn(fieldClass(), 'pr-10')} />
                  <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                买家反馈:
              </label>
              <div className={cn('flex gap-2', isMobile && 'flex-col')}>
                <textarea
                  value={buyerFeedback}
                  onChange={(e) => setBuyerFeedback(e.target.value)}
                  className={cn(fieldClass(), 'min-h-[88px] resize-none')}
                  placeholder="请输入买家反馈内容..."
                />
                <button
                  type="button"
                  disabled={isRecognizing || !buyerFeedback.trim()}
                  onClick={() => void handleAIRecognize()}
                  className={cn(
                    'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition-colors',
                    isMobile ? 'min-h-11 w-full touch-manipulation' : 'self-start px-3 py-2',
                    isRecognizing || !buyerFeedback.trim()
                      ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                      : 'border-indigo-200 bg-indigo-50 text-indigo-700 active:bg-indigo-100'
                  )}
                  title="根据当前反馈自动填充售后类型、优先级、处理方式等"
                >
                  {isRecognizing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  AI 自动识别
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">买家图片:</label>
              <div className="flex gap-4">
                <div className="w-24 h-24 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-[#F97316] hover:text-[#F97316] cursor-pointer transition-all">
                  <Plus className="w-6 h-6" />
                  <span className="text-[10px] font-bold">上传图片</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        {isMobile ? (
          <div className={cn(H5_TAB_BOTTOM_BAR, H5_SAFE_BOTTOM, 'space-y-2 px-3 pt-2')}>
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className={H5_MODAL_BTN_GHOST}
            >
              取消
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleSubmit()}
              className={cn(H5_TAB_BTN_ACCENT, submitAccentClass)}
            >
              {submitting ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
              {submitLabel}
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200"
            >
              取消
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleSubmit()}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-8 py-2.5 text-sm font-bold text-white shadow-sm transition-colors',
                type === AfterSalesType.REFUND && refundExecutionType === 'api'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-[#F97316] hover:bg-[#ea580c]',
                submitting && 'pointer-events-none opacity-70'
              )}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
