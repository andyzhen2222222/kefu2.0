import { useState, useEffect } from 'react';
import { X, Search, Plus, Upload, Calendar, AlertCircle, Package, Sparkles, Loader2 } from 'lucide-react';
import { cn, openFieldConfigPage } from '@/src/lib/utils';
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

  useEffect(() => {
    if (!isOpen) return;
    setApiError(null);
    if (initialData) {
      setType(initialData.type);
      setHandlingMethod(initialData.handlingMethod || '待确认');
      setPriority(coerceAfterSalesPriority(initialData.priority));
      setProblemType(initialData.problemType || '');
      setBuyerFeedback(initialData.buyerFeedback || '');
      setRefundAmount(initialData.refundAmount ?? '');
    } else {
      setType(AfterSalesType.REFUND);
      setHandlingMethod('待确认');
      setPriority('low');
      setProblemType('');
      setBuyerFeedback('');
      setRefundAmount('');
      setSearchedOrder(null);
      setSearchOrderQuery('');
    }
  }, [isOpen, initialData?.id, apiSubmit?.defaultTicketId]);

  if (!isOpen) return null;

  const currentOrder = order || searchedOrder;
  const currentChannel = currentOrder?.channelId || '';
  const isApiRefundSupported = ['Shopify', 'WooCommerce', '独立站'].includes(currentChannel);

  const handleAIRecognize = async () => {
    if (!buyerFeedback.trim()) return;
    setIsRecognizing(true);
    try {
      const result = await recognizeAfterSalesFromFeedback(buyerFeedback, {
        maxRefund: currentOrder?.amount,
        currency: currentOrder?.currency,
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{initialData ? '修改售后工单' : '提交售后'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
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
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5 col-span-2 md:col-span-1">
                  <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                    <span className="text-red-500">*</span>{' '}
                    {apiSubmit ? '平台订单号' : '订单号搜索'}:
                  </label>
                  <div className="relative flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type="text" 
                        value={searchOrderQuery}
                        onChange={(e) => setSearchOrderQuery(e.target.value)}
                        placeholder="请输入订单号进行搜索"
                        className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                      />
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                    <button 
                      type="button" 
                      onClick={handleSearchOrder}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                    >
                      搜索带入
                    </button>
                  </div>
                  {apiSubmit && !initialData ? (
                    <p className="text-[11px] text-slate-400 col-span-2">
                      输入平台订单号搜索即可；系统会按订单自动关联工单（无工单时会自动创建）。
                    </p>
                  ) : null}
                </div>
              </div>
              
              {!searchedOrder ? (
                <div className="p-4 bg-slate-50 border border-slate-200 border-dashed rounded-xl flex items-center justify-center text-sm text-slate-400">
                  请先搜索并选择订单，系统将自动带入订单详情与买家信息
                </div>
              ) : (
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
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
            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <span className="text-red-500">*</span> 处理方式:
                </label>
                <select 
                  value={type}
                  onChange={(e) => setType(e.target.value as AfterSalesType)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                >
                  <option value={AfterSalesType.REFUND}>退款 (Refund)</option>
                  <option value={AfterSalesType.RETURN}>退货 (Return)</option>
                  <option value={AfterSalesType.EXCHANGE}>换货 (Exchange)</option>
                  <option value={AfterSalesType.REISSUE}>重发 (Reissue)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <span className="text-red-500">*</span> 优先级:
                </label>
                <select 
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as AfterSalesPriority)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                >
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">售后状态:</label>
                <select disabled className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500">
                  <option>已提交</option>
                </select>
              </div>
            </div>

            {/* Dynamic Fields based on Type */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
              {type === AfterSalesType.REFUND && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <span className="text-red-500">*</span> 退款金额 ({currentOrder?.currency || 'USD'}):
                    </label>
                    <input 
                      type="number" 
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value ? Number(e.target.value) : '')}
                      max={currentOrder?.amount}
                      placeholder={`最大可退: ${currentOrder?.amount || 0}`}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]" 
                    />
                  </div>
            <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="text-red-500">*</span> 售后类型:
                  </span>
                  <button 
                    type="button"
                    onClick={() => openFieldConfigPage('after_sales_type')}
                    className="text-[10px] text-[#F97316] font-medium hover:underline"
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
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
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
                  <div className="col-span-2 space-y-2 mt-2 border-t border-slate-100 pt-4">
                    <label className="text-xs font-bold text-slate-700">退款执行方式</label>
                    <div className="grid grid-cols-2 gap-4">
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
                            <div className="font-bold text-sm text-slate-900">API 自动原路退款</div>
                          </div>
                          {isApiRefundSupported ? (
                            <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded font-bold">支持</span>
                          ) : (
                            <span className="bg-slate-200 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-bold" title={`${currentChannel || '当前'}平台不支持API退款`}>不支持</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 pl-6">
                          提交后直接调用 {currentChannel ? <span className="font-medium">{currentChannel}</span> : '平台'} API 完成退款。
                        </div>
                      </label>
                    </div>
                  </div>

                </div>
              )}

              {(type === AfterSalesType.RETURN || type === AfterSalesType.EXCHANGE) && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <span className="text-red-500">*</span> 退回物流单号:
                    </label>
                    <input 
                      type="text" 
                      placeholder="请输入买家退回的物流单号"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <span className="text-red-500">*</span> 退回承运商:
                    </label>
                    <input 
                      type="text" 
                      placeholder="例如: USPS, UPS"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]" 
                    />
                  </div>
                </div>
              )}

              {(type === AfterSalesType.REISSUE || type === AfterSalesType.EXCHANGE) && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <span className="text-red-500">*</span> 重发SKU:
                    </label>
                    <input 
                      type="text" 
                      placeholder="请输入要重发的SKU"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <span className="text-red-500">*</span> 重发数量:
                    </label>
                    <input 
                      type="number" 
                      min="1"
                      defaultValue="1"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]" 
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="text-red-500">*</span> 签收方:
                  </span>
                  <button 
                    type="button"
                    onClick={() => openFieldConfigPage('receiver')}
                    className="text-[10px] text-[#F97316] font-medium hover:underline"
                  >
                    管理签收方
                  </button>
                </label>
                <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                  <option value="">选择退件仓</option>
                  <option value="us_east">美东 1 号仓 (NJ)</option>
                  <option value="us_west">美西退件仓 (CA)</option>
                  <option value="eu_uk">英国伦敦转运仓</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <span className="text-red-500">*</span> 客户签收时间:
                </label>
                <div className="relative">
                  <input type="date" className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <span className="text-red-500">*</span> 客户反馈时间:
                </label>
                <div className="relative">
                  <input type="date" className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <span className="text-red-500">*</span> 买家反馈:
              </label>
              <div className="flex gap-2">
                <textarea 
                  value={buyerFeedback}
                  onChange={(e) => setBuyerFeedback(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                  placeholder="请输入买家反馈内容..."
                />
                <div className="flex flex-col gap-2 shrink-0 self-start mt-1">
                  <button
                    type="button"
                    disabled={isRecognizing || !buyerFeedback.trim()}
                    onClick={handleAIRecognize}
                    className={cn(
                      "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors border",
                      isRecognizing || !buyerFeedback.trim()
                        ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    )}
                    title="根据当前反馈自动填充售后类型、优先级、处理方式等"
                  >
                    {isRecognizing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    AI 自动识别
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 bg-[#F97316] text-white rounded-lg text-xs font-bold hover:bg-[#ea580c] transition-colors"
                  >
                    添加
                  </button>
                </div>
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
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              setApiError(null);
              if (apiSubmit && !initialData?.id) {
                if (!currentOrder?.id) {
                  setApiError('请先搜索并匹配订单');
                  return;
                }
                if (!buyerFeedback.trim()) {
                  setApiError('请填写买家反馈');
                  return;
                }
                setSubmitting(true);
                try {
                  await createAfterSalesRecord(apiSubmit.tenantId, apiSubmit.userId, {
                    orderId: currentOrder.id,
                    ...(apiSubmit.defaultTicketId
                      ? { ticketId: apiSubmit.defaultTicketId }
                      : {}),
                    type,
                    handlingMethod,
                    priority: priority as 'low' | 'medium' | 'high',
                    problemType,
                    buyerFeedback: buyerFeedback.trim(),
                    refundAmount:
                      refundAmount === '' || refundAmount === undefined
                        ? undefined
                        : Number(refundAmount),
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
                setSubmitting(true);
                try {
                  await patchAfterSalesRecord(
                    apiSubmit.tenantId,
                    apiSubmit.userId,
                    initialData.id,
                    {
                      handlingMethod,
                      priority: priority as 'low' | 'medium' | 'high',
                      problemType,
                      buyerFeedback: buyerFeedback.trim(),
                      refundAmount:
                        refundAmount === '' || refundAmount === undefined
                          ? undefined
                          : Number(refundAmount),
                    }
                  );
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
              });
              onClose();
            }}
            className={cn(
              'px-8 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm text-white inline-flex items-center gap-2',
              type === AfterSalesType.REFUND && refundExecutionType === 'api'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-[#F97316] hover:bg-[#ea580c]',
              submitting && 'opacity-70 pointer-events-none'
            )}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {initialData
              ? '保存修改'
              : type === AfterSalesType.REFUND &&
                  refundExecutionType === 'api' &&
                  refundAmount
                ? `提交并原路退款 (${currentOrder?.currency || 'USD'} ${refundAmount})`
                : '提交售后'}
          </button>
        </div>
      </div>
    </div>
  );
}
