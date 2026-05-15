import { useState } from 'react';
import { 
  Search, 
  Filter, 
  ShoppingCart, 
  Package, 
  Truck, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  MoreHorizontal,
  ChevronRight,
  ExternalLink,
  Globe
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Order } from '@/src/types';
import { useAuth } from '@/src/hooks/useAuth';

const MOCK_ORDERS: Order[] = [
  {
    id: 'ORD-9901',
    platformOrderId: '114-1234567-1234567',
    customerId: 'C-5001',
    channelId: 'Amazon US',
    skuList: ['SKU-VIBE-RED'],
    productTitles: ['Vibrant Red Skateboard - Pro Edition'],
    amount: 89.99,
    currency: 'USD',
    orderStatus: 'shipped',
    shippingStatus: 'Delivered',
    trackingNumber: '1Z999AA10123456784',
    deliveryEta: 'Mar 24, 2026',
    paymentStatus: 'Paid'
  },
  {
    id: 'ORD-9902',
    platformOrderId: '27-09876-54321',
    customerId: 'C-5002',
    channelId: 'eBay UK',
    skuList: ['SKU-HELM-BLUE'],
    productTitles: ['Safety First Helmet - Ocean Blue'],
    amount: 45.50,
    currency: 'GBP',
    orderStatus: 'shipped',
    shippingStatus: 'In Transit',
    trackingNumber: 'GB123456789',
    deliveryEta: 'Mar 28, 2026',
    paymentStatus: 'Paid'
  },
  {
    id: 'ORD-9903',
    platformOrderId: 'SH-554433',
    customerId: 'C-5003',
    channelId: 'Shopify',
    skuList: ['SKU-PADS-BLK'],
    productTitles: ['Pro Knee & Elbow Pads - Stealth Black'],
    amount: 35.00,
    currency: 'USD',
    orderStatus: 'unshipped',
    shippingStatus: 'Processing',
    paymentStatus: 'Paid'
  }
];

export default function OrdersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'in transit': return <Truck className="w-4 h-4 text-blue-500" />;
      case 'processing': return <Clock className="w-4 h-4 text-amber-500" />;
      default: return <Package className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4 p-4 sm:space-y-6 sm:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">订单</h1>
          <p className="mt-1 text-[13px] leading-snug text-slate-600 sm:text-sm sm:text-slate-500">
            跨渠道查看与跟踪客户订单（演示数据）。
          </p>
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-blue-700 sm:py-2"
        >
          <ShoppingCart className="h-4 w-4 shrink-0" />
          同步订单
        </button>
      </header>
      
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
          <div className="relative max-w-md min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="订单号、SKU、客户…"
              className="w-full rounded-lg border border-transparent bg-slate-50 py-2 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-slate-500 focus:border-blue-500 focus:bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-all hover:bg-slate-50"
            >
              <Filter className="h-4 w-4" />
              筛选
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-4">订单信息</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-4">渠道</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-4">商品</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-4">金额</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-4">状态</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-4">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {MOCK_ORDERS.map((order) => (
                <tr key={order.id} className="group transition-colors hover:bg-slate-50/50">
                  <td className="px-4 py-3 sm:px-6 sm:py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">#{order.platformOrderId}</span>
                      <span className="text-xs text-slate-400">ID: {order.id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-100">
                        <Globe className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{order.channelId}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4">
                    <div className="flex max-w-xs flex-col">
                      <span className="truncate text-sm font-medium text-slate-700">{order.productTitles[0]}</span>
                      {order.productTitles.length > 1 && (
                        <span className="text-[10px] font-bold text-slate-400">另有 {order.productTitles.length - 1} 件</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4">
                    <span className="text-sm font-bold text-slate-900">{order.currency} {order.amount.toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(order.shippingStatus)}
                      <span className="text-xs font-bold text-slate-700">{order.shippingStatus}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right sm:px-6 sm:py-4">
                    <div className="flex items-center justify-end gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                      <button className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-500 transition-all">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-500 transition-all">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/30 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <p className="text-xs font-medium leading-relaxed text-slate-600 sm:text-slate-500">演示：共 3 条，全量约 1,284 单</p>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-white rounded-lg text-slate-400 disabled:opacity-50" disabled>
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
            <button className="p-2 hover:bg-white rounded-lg text-slate-400">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
