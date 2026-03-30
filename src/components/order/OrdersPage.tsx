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
    <div className="p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-slate-500 text-sm">Manage and track all customer orders across channels.</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-blue-700 transition-all flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" />
          Sync Orders
        </button>
      </header>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Order ID, SKU, or Customer..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 rounded-lg text-sm transition-all outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 transition-all">
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order Info</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Channel</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Products</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {MOCK_ORDERS.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">#{order.platformOrderId}</span>
                      <span className="text-xs text-slate-400">ID: {order.id}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center">
                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{order.channelId}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col max-w-xs">
                      <span className="text-sm text-slate-700 truncate font-medium">{order.productTitles[0]}</span>
                      {order.productTitles.length > 1 && (
                        <span className="text-[10px] text-slate-400 font-bold">+{order.productTitles.length - 1} more items</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-slate-900">{order.currency} {order.amount.toFixed(2)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(order.shippingStatus)}
                      <span className="text-xs font-bold text-slate-700">{order.shippingStatus}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
        
        <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <p className="text-xs text-slate-500 font-medium">Showing 3 of 1,284 orders</p>
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
