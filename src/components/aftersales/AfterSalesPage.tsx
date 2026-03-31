import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Download, 
  Plus, 
  MoreHorizontal, 
  Eye, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle,
  ArrowUpDown,
  RotateCcw,
  ExternalLink,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { AfterSalesRecord, AfterSalesType, AfterSalesStatus } from '@/src/types';
import { format } from 'date-fns';

import SubmitAfterSalesModal from '../ticket/SubmitAfterSalesModal';
import { useAuth } from '@/src/hooks/useAuth';
import {
  intellideskConfigured,
  intellideskTenantId,
  intellideskUserIdForApi,
  fetchAfterSalesList,
} from '@/src/services/intellideskApi';

/** 与「更多筛选」售后类型 value 对应，用于和 problemType 文案匹配 */
const CATEGORY_FILTER_TO_LABELS: Record<string, string[]> = {
  logistics: ['物流问题', '物流'],
  quality: ['质量问题', '质量', '损坏'],
  wrong_item: ['发错货', '错发'],
  missing_part: ['少发', '漏发'],
  not_received: ['未收到', '未收到货'],
  customer_reason: ['客户原因', '不想要'],
};

const HANDLING_FILTER_TO_TYPE: Record<string, AfterSalesType> = {
  refund: AfterSalesType.REFUND,
  return: AfterSalesType.RETURN,
  exchange: AfterSalesType.EXCHANGE,
  reissue: AfterSalesType.REISSUE,
};

function recordMatchesCategory(record: AfterSalesRecord, categoryKey: string): boolean {
  if (!categoryKey) return true;
  const labels = CATEGORY_FILTER_TO_LABELS[categoryKey];
  if (!labels?.length) return true;
  const pt = (record.problemType || '').trim();
  return labels.some((l) => pt.includes(l) || pt === l);
}

function isTicketUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim()
  );
}

const MOCK_RECORDS: AfterSalesRecord[] = [
  {
    id: 'AS-8291',
    orderId: 'ORD-2024-0321',
    ticketId: 'TKT-1001',
    type: AfterSalesType.REFUND,
    status: AfterSalesStatus.SUBMITTED,
    handlingMethod: '仅退款',
    priority: 'high',
    problemType: '质量问题',
    buyerFeedback: '产品收到时有划痕',
    createdAt: '2024-03-25T10:30:00Z',
    updatedAt: '2024-03-25T10:30:00Z',
    refundAmount: 25.99
  },
  {
    id: 'AS-8292',
    orderId: 'ORD-2024-0322',
    ticketId: 'TKT-1002',
    type: AfterSalesType.RETURN,
    status: AfterSalesStatus.PROCESSING,
    handlingMethod: '退货退款',
    priority: 'medium',
    problemType: '发错货',
    buyerFeedback: '颜色不对，我买的是红色',
    createdAt: '2024-03-24T14:20:00Z',
    updatedAt: '2024-03-25T09:15:00Z',
    returnTrackingNumber: 'TRK123456789',
    returnCarrier: 'UPS'
  },
  {
    id: 'AS-8293',
    orderId: 'ORD-2024-0323',
    ticketId: 'TKT-1003',
    type: AfterSalesType.EXCHANGE,
    status: AfterSalesStatus.COMPLETED,
    handlingMethod: '换货',
    priority: 'low',
    problemType: '尺码不合',
    buyerFeedback: '太小了，需要换大一码',
    createdAt: '2024-03-22T11:00:00Z',
    updatedAt: '2024-03-24T16:45:00Z'
  }
];

export default function AfterSalesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<AfterSalesRecord[]>(MOCK_RECORDS);
  const [apiError, setApiError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingRecord, setViewingRecord] = useState<AfterSalesRecord | null>(null);

  const reloadAfterSales = useCallback(async () => {
    if (!intellideskConfigured()) return;
    try {
      const rows = await fetchAfterSalesList(
        intellideskTenantId(),
        intellideskUserIdForApi(user?.id)
      );
      setRecords(rows);
      setApiError(null);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : String(e));
    }
  }, [user?.id]);

  useEffect(() => {
    if (!intellideskConfigured()) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchAfterSalesList(
          intellideskTenantId(),
          intellideskUserIdForApi(user?.id)
        );
        if (!cancelled) setRecords(rows.length ? rows : []);
        if (!cancelled) setApiError(null);
      } catch (e) {
        if (!cancelled) {
          setApiError(e instanceof Error ? e.message : String(e));
          setRecords([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
  const [activeStatus, setActiveStatus] = useState<AfterSalesStatus | 'all'>('all');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AfterSalesRecord | undefined>();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    type: '',
    handlingMethod: '',
  });

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const filteredRecords = useMemo(() => {
    let list = records;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.orderId.toLowerCase().includes(q) ||
          (r.problemType || '').toLowerCase().includes(q) ||
          (r.buyerFeedback || '').toLowerCase().includes(q)
      );
    }
    if (activeStatus !== 'all') {
      list = list.filter((r) => r.status === activeStatus);
    }
    if (filters.type) {
      list = list.filter((r) => recordMatchesCategory(r, filters.type));
    }
    if (filters.handlingMethod) {
      const want = HANDLING_FILTER_TO_TYPE[filters.handlingMethod];
      if (want) list = list.filter((r) => r.type === want);
    }
    return list;
  }, [records, searchQuery, activeStatus, filters.type, filters.handlingMethod]);

  const getStatusConfig = (status: AfterSalesStatus) => {
    switch (status) {
      case AfterSalesStatus.SUBMITTED:
        return { label: '已提交', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: <Clock className="w-3 h-3" /> };
      case AfterSalesStatus.PROCESSING:
        return { label: '处理中', color: 'bg-orange-50 text-orange-600 border-orange-100', icon: <RotateCcw className="w-3 h-3" /> };
      case AfterSalesStatus.COMPLETED:
        return { label: '已完成', color: 'bg-green-50 text-green-600 border-green-100', icon: <CheckCircle2 className="w-3 h-3" /> };
      case AfterSalesStatus.REJECTED:
        return { label: '已拒绝', color: 'bg-red-50 text-red-600 border-red-100', icon: <XCircle className="w-3 h-3" /> };
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {apiError ? (
        <div className="shrink-0 mx-8 mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-800">
          {apiError}
        </div>
      ) : null}
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">售后管理</h1>
            <p className="text-sm text-slate-500 mt-1">处理退款、退货及换货申请</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              <Download className="w-4 h-4" />
              导出数据
            </button>
            <button 
              onClick={() => {
                setEditingRecord(undefined);
                setIsSubmitModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#F97316] text-white rounded-xl text-sm font-bold hover:bg-[#ea580c] transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              手动登记售后
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-slate-200 px-8 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索订单号、售后单号、问题类型、买家反馈…"
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
            />
          </div>
          
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
            {(['all', ...Object.values(AfterSalesStatus)] as const).map((status) => (
              <button
                key={status}
                onClick={() => setActiveStatus(status)}
                className={cn(
                  "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                  activeStatus === status 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {status === 'all' ? '全部' : getStatusConfig(status as AfterSalesStatus).label}
              </button>
            ))}
          </div>

          <div className="relative">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-medium transition-colors",
                activeFilterCount > 0 || isFilterOpen
                  ? "border-[#F97316] text-[#F97316] bg-orange-50"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              <Filter className="w-4 h-4" />
              更多筛选
              {activeFilterCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#F97316] text-white text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {isFilterOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsFilterOpen(false)} 
                />
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500">售后类型</label>
                      <select 
                        value={filters.type}
                        onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                      >
                        <option value="">全部</option>
                        <option value="logistics">物流问题</option>
                        <option value="quality">质量问题</option>
                        <option value="wrong_item">发错货</option>
                        <option value="missing_part">少发漏发</option>
                        <option value="not_received">未收到货</option>
                        <option value="customer_reason">客户原因</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500">处理方式</label>
                      <select 
                        value={filters.handlingMethod}
                        onChange={(e) => setFilters({ ...filters, handlingMethod: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                      >
                        <option value="">全部</option>
                        <option value="refund">仅退款</option>
                        <option value="return">退货退款</option>
                        <option value="exchange">换货</option>
                        <option value="reissue">重发</option>
                      </select>
                    </div>

                  </div>

                  <div className="flex items-center gap-3 p-4 bg-slate-50 border-t border-slate-100">
                    <button 
                      onClick={() => {
                        setFilters({ type: '', handlingMethod: '' });
                        setIsFilterOpen(false);
                      }}
                      className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      重置
                    </button>
                    <button 
                      onClick={() => setIsFilterOpen(false)}
                      className="flex-1 px-4 py-2 text-sm font-bold text-white bg-[#F97316] rounded-xl hover:bg-[#ea580c] transition-colors"
                    >
                      确定
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-4 font-bold text-slate-700">
                  <div className="flex items-center gap-2 cursor-pointer hover:text-slate-900">
                    售后单号
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-6 py-4 font-bold text-slate-700">订单信息</th>
                <th className="px-6 py-4 font-bold text-slate-700">处理方式</th>
                <th className="px-6 py-4 font-bold text-slate-700">处理状态</th>
                <th className="px-6 py-4 font-bold text-slate-700">退款/退件详情</th>
                <th className="px-6 py-4 font-bold text-slate-700">优先级</th>
                <th className="px-6 py-4 font-bold text-slate-700">售后类型</th>
                <th className="px-6 py-4 font-bold text-slate-700 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                    没有符合条件的售后记录，请调整搜索或筛选条件。
                  </td>
                </tr>
              ) : null}
              {filteredRecords.map((record) => {
                const statusConfig = getStatusConfig(record.status);
                return (
                  <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{record.id}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          {format(new Date(record.createdAt), 'yyyy-MM-dd HH:mm')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-700">{record.orderId}</span>
                        <button
                          type="button"
                          disabled={!isTicketUuid(record.ticketId)}
                          onClick={() => {
                            if (isTicketUuid(record.ticketId))
                              navigate(`/mailbox/${record.ticketId}`);
                          }}
                          className={cn(
                            'flex items-center gap-1 text-[10px] mt-0.5 text-left',
                            isTicketUuid(record.ticketId)
                              ? 'text-blue-600 hover:underline cursor-pointer'
                              : 'text-slate-400 cursor-default'
                          )}
                        >
                          关联工单: {record.ticketId}
                          {isTicketUuid(record.ticketId) ? (
                            <ExternalLink className="w-2 h-2 shrink-0" />
                          ) : null}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-bold",
                        record.type === AfterSalesType.REFUND ? "bg-red-50 text-red-600" : 
                        record.type === AfterSalesType.RETURN ? "bg-blue-50 text-blue-600" :
                        record.type === AfterSalesType.EXCHANGE ? "bg-purple-50 text-purple-600" :
                        "bg-green-50 text-green-600"
                      )}>
                        {record.type === AfterSalesType.REFUND ? '仅退款' : 
                         record.type === AfterSalesType.RETURN ? '退货退款' : 
                         record.type === AfterSalesType.EXCHANGE ? '换货' : '重发'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative group/status">
                        <select 
                          className={cn(
                            "appearance-none bg-transparent cursor-pointer outline-none font-bold text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all hover:ring-2 hover:ring-opacity-50",
                            statusConfig.color,
                            "hover:ring-current"
                          )}
                          value={record.status}
                          onChange={(e) => {
                            const newStatus = e.target.value as AfterSalesStatus;
                            setRecords((prev) =>
                              prev.map((r) => (r.id === record.id ? { ...r, status: newStatus } : r))
                            );
                          }}
                        >
                          <option value={AfterSalesStatus.SUBMITTED} className="text-slate-900 bg-white">已提交</option>
                          <option value={AfterSalesStatus.PROCESSING} className="text-slate-900 bg-white">处理中</option>
                          <option value={AfterSalesStatus.COMPLETED} className="text-slate-900 bg-white">已完成</option>
                          <option value={AfterSalesStatus.REJECTED} className="text-slate-900 bg-white">已拒绝</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        {record.refundAmount ? (
                          <span className="text-xs font-bold text-slate-700">退款: ${record.refundAmount}</span>
                        ) : record.returnTrackingNumber ? (
                          <>
                            <span className="text-xs font-bold text-slate-700">退件单号: {record.returnTrackingNumber}</span>
                            {record.returnCarrier && <span className="text-[10px] text-slate-500 mt-0.5">承运商: {record.returnCarrier}</span>}
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          record.priority === 'high' ? "bg-red-500" : 
                          record.priority === 'medium' ? "bg-orange-500" : "bg-slate-300"
                        )} />
                        <span className="text-xs font-medium text-slate-600">
                          {record.priority === 'high' ? '高' : record.priority === 'medium' ? '中' : '低'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col max-w-[200px]">
                        <span className="text-xs font-bold text-slate-700 truncate">{record.problemType}</span>
                        <span className="text-[11px] text-slate-500 truncate mt-0.5">{record.buyerFeedback}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingRecord(record)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-1.5 text-slate-400 hover:text-[#F97316] hover:bg-orange-50 rounded-lg transition-all"
                          title="编辑修改"
                          onClick={() => {
                            setEditingRecord(record);
                            setIsSubmitModalOpen(true);
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="删除单据"
                          onClick={() => {
                            if (window.confirm('确定要删除这条售后记录吗？')) {
                              setRecords((prev) => prev.filter((r) => r.id !== record.id));
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {/* Pagination */}
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {filteredRecords.length === 0
                ? '无匹配记录'
                : `共 ${filteredRecords.length} 条记录（已应用搜索与筛选）`}
            </span>
            <div className="flex items-center gap-2">
              <button disabled className="px-3 py-1 border border-slate-200 rounded-lg text-xs font-medium text-slate-400 bg-white">上一页</button>
              <button className="px-3 py-1 bg-[#F97316] text-white rounded-lg text-xs font-bold shadow-sm">1</button>
              <button disabled className="px-3 py-1 border border-slate-200 rounded-lg text-xs font-medium text-slate-400 bg-white">下一页</button>
            </div>
          </div>
        </div>
      </div>

      {viewingRecord ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="after-sales-detail-title"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 id="after-sales-detail-title" className="text-lg font-bold text-slate-900">
                售后详情
              </h2>
              <button
                type="button"
                onClick={() => setViewingRecord(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-slate-500">售后单号</span>
                  <p className="font-mono font-medium text-slate-900 mt-0.5">{viewingRecord.id}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">订单</span>
                  <p className="font-medium text-slate-900 mt-0.5">{viewingRecord.orderId}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-slate-500">关联工单</span>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-slate-800">{viewingRecord.ticketId}</span>
                    {isTicketUuid(viewingRecord.ticketId) ? (
                      <button
                        type="button"
                        onClick={() => {
                          navigate(`/mailbox/${viewingRecord.ticketId}`);
                          setViewingRecord(null);
                        }}
                        className="text-xs font-bold text-[#F97316] hover:underline inline-flex items-center gap-1"
                      >
                        打开收件箱工单
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-500">状态</span>
                  <p className="font-medium text-slate-900 mt-0.5">
                    {getStatusConfig(viewingRecord.status).label}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">优先级</span>
                  <p className="font-medium text-slate-900 mt-0.5">
                    {viewingRecord.priority === 'high'
                      ? '高'
                      : viewingRecord.priority === 'medium'
                        ? '中'
                        : '低'}
                  </p>
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500">售后类型 / 问题</span>
                <p className="text-slate-900 mt-0.5">{viewingRecord.problemType || '—'}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">买家反馈</span>
                <p className="text-slate-700 mt-0.5 whitespace-pre-wrap">{viewingRecord.buyerFeedback}</p>
              </div>
              {viewingRecord.refundAmount != null ? (
                <div>
                  <span className="text-xs text-slate-500">退款金额</span>
                  <p className="font-medium text-slate-900 mt-0.5">{viewingRecord.refundAmount}</p>
                </div>
              ) : null}
              {viewingRecord.returnTrackingNumber ? (
                <div>
                  <span className="text-xs text-slate-500">退件物流</span>
                  <p className="text-slate-900 mt-0.5">
                    {viewingRecord.returnCarrier ? `${viewingRecord.returnCarrier} · ` : ''}
                    {viewingRecord.returnTrackingNumber}
                  </p>
                </div>
              ) : null}
              <p className="text-xs text-slate-400">
                创建 {format(new Date(viewingRecord.createdAt), 'yyyy-MM-dd HH:mm')} · 更新{' '}
                {format(new Date(viewingRecord.updatedAt), 'yyyy-MM-dd HH:mm')}
              </p>
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewingRecord(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                关闭
              </button>
              <button
                type="button"
                onClick={() => {
                  const r = viewingRecord;
                  setViewingRecord(null);
                  setEditingRecord(r);
                  setIsSubmitModalOpen(true);
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-[#F97316] rounded-xl hover:bg-[#ea580c]"
              >
                编辑
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Submit / Edit Modal */}
      <SubmitAfterSalesModal
        isOpen={isSubmitModalOpen}
        onClose={() => {
          setIsSubmitModalOpen(false);
          setEditingRecord(undefined);
        }}
        initialData={editingRecord}
        apiSubmit={
          intellideskConfigured()
            ? {
                tenantId: intellideskTenantId(),
                userId: intellideskUserIdForApi(user?.id),
                onSuccess: () => void reloadAfterSales(),
              }
            : undefined
        }
        onSubmit={(data) => {
          if (intellideskConfigured()) return;
          const newRec: AfterSalesRecord = {
            id: `AS-${Date.now()}`,
            orderId: String(data.orderId ?? 'ORD-MOCK'),
            ticketId: String(data.ticketId ?? `TKT-${Date.now()}`),
            type: (data.type as AfterSalesType) ?? AfterSalesType.REFUND,
            status: AfterSalesStatus.SUBMITTED,
            handlingMethod: String(data.handlingMethod ?? ''),
            priority: (data.priority as AfterSalesRecord['priority']) ?? 'medium',
            problemType: String(data.problemType ?? ''),
            buyerFeedback: String(data.buyerFeedback ?? ''),
            refundAmount:
              data.refundAmount !== undefined && data.refundAmount !== ''
                ? Number(data.refundAmount)
                : undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setRecords((prev) => [newRec, ...prev]);
          setIsSubmitModalOpen(false);
          setEditingRecord(undefined);
        }}
      />
    </div>
  );
}
