import { useState } from 'react';
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
  Trash2
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { AfterSalesRecord, AfterSalesType, AfterSalesStatus } from '@/src/types';
import { format } from 'date-fns';

import SubmitAfterSalesModal from '../ticket/SubmitAfterSalesModal';

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
  const [records, setRecords] = useState<AfterSalesRecord[]>(MOCK_RECORDS);
  const [activeStatus, setActiveStatus] = useState<AfterSalesStatus | 'all'>('all');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AfterSalesRecord | undefined>();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    type: '',
    receiver: '',
    platform: '',
    store: '',
    handlingMethod: ''
  });

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

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
              placeholder="搜索订单号、售后单号、买家姓名..."
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

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500">签收方 / 退件仓</label>
                      <select 
                        value={filters.receiver}
                        onChange={(e) => setFilters({ ...filters, receiver: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                      >
                        <option value="">全部</option>
                        <option value="us_east">美东一号仓</option>
                        <option value="us_west">美西二号仓</option>
                        <option value="eu_central">欧洲中心仓</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500">平台</label>
                      <select 
                        value={filters.platform}
                        onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                      >
                        <option value="">全部</option>
                        <option value="amazon">Amazon</option>
                        <option value="ebay">eBay</option>
                        <option value="shopify">Shopify</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500">店铺</label>
                      <select 
                        value={filters.store}
                        onChange={(e) => setFilters({ ...filters, store: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                      >
                        <option value="">全部</option>
                        <option value="store_a">US Official Store</option>
                        <option value="store_b">EU Official Store</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-slate-50 border-t border-slate-100">
                    <button 
                      onClick={() => {
                        setFilters({ type: '', receiver: '', platform: '', store: '', handlingMethod: '' });
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
              {records.map((record) => {
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
                        <div className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline cursor-pointer mt-0.5">
                          关联工单: {record.ticketId}
                          <ExternalLink className="w-2 h-2" />
                        </div>
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
                            setRecords(records.map(r => r.id === record.id ? { ...r, status: newStatus } : r));
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
                              setRecords(records.filter(r => r.id !== record.id));
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
            <span className="text-xs text-slate-500">显示 1-3 条，共 3 条记录</span>
            <div className="flex items-center gap-2">
              <button disabled className="px-3 py-1 border border-slate-200 rounded-lg text-xs font-medium text-slate-400 bg-white">上一页</button>
              <button className="px-3 py-1 bg-[#F97316] text-white rounded-lg text-xs font-bold shadow-sm">1</button>
              <button disabled className="px-3 py-1 border border-slate-200 rounded-lg text-xs font-medium text-slate-400 bg-white">下一页</button>
            </div>
          </div>
        </div>
      </div>
      {/* Submit / Edit Modal */}
      <SubmitAfterSalesModal 
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        initialData={editingRecord}
        onSubmit={(data) => {
          console.log('Submitted after sales from page:', data);
          setIsSubmitModalOpen(false);
        }}
      />
    </div>
  );
}
