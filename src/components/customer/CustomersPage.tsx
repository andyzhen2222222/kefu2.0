import { useState } from 'react';
import { 
  Search, 
  Filter, 
  Users, 
  UserPlus, 
  MoreHorizontal, 
  ChevronRight, 
  Mail, 
  Phone, 
  MapPin,
  TrendingUp,
  Star,
  Clock,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Customer, Sentiment } from '@/src/types';
import { useAuth } from '@/src/hooks/useAuth';

const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'C-5001',
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1 234 567 890',
    shippingCountry: 'USA',
    sentiment: Sentiment.ANGRY,
    segments: ['VIP', 'Repeat Customer'],
    totalOrderValue: 450.50,
    ordersCount: 5,
    latestPurchaseAt: '2026-03-20T10:00:00Z',
    customerSince: '2025-01-15T00:00:00Z'
  },
  {
    id: 'C-5002',
    name: 'Jane Smith',
    email: 'jane.smith@example.co.uk',
    shippingCountry: 'UK',
    sentiment: Sentiment.JOYFUL,
    segments: ['Active Customer'],
    totalOrderValue: 120.00,
    ordersCount: 2,
    latestPurchaseAt: '2026-03-15T14:30:00Z',
    customerSince: '2025-11-02T00:00:00Z'
  },
  {
    id: 'C-5003',
    name: 'Robert Brown',
    email: 'robert.b@example.com',
    shippingCountry: 'Canada',
    sentiment: Sentiment.NEUTRAL,
    segments: ['New Customer'],
    totalOrderValue: 35.00,
    ordersCount: 1,
    latestPurchaseAt: '2026-03-22T09:15:00Z',
    customerSince: '2026-03-22T00:00:00Z'
  }
];

export default function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();

  const getSentimentColor = (sentiment: Sentiment) => {
    switch (sentiment) {
      case Sentiment.JOYFUL: return 'text-green-600 bg-green-50';
      case Sentiment.ANGRY: return 'text-red-600 bg-red-50';
      case Sentiment.ANXIOUS: return 'text-orange-600 bg-orange-50';
      case Sentiment.NEUTRAL: return 'text-slate-600 bg-slate-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  return (
    <div className="space-y-4 p-4 sm:space-y-6 sm:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">客户</h1>
          <p className="mt-1 text-[13px] leading-snug text-slate-600 sm:text-sm sm:text-slate-500">
            客户库与分群概览（演示数据）。
          </p>
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-blue-700 sm:py-2"
        >
          <UserPlus className="h-4 w-4 shrink-0" />
          新建客户
        </button>
      </header>
      
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="rounded-xl bg-blue-50 p-3">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">客户总数</p>
            <p className="text-2xl font-bold text-slate-900">8,432</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="rounded-xl bg-green-50 p-3">
            <Star className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">VIP 客户</p>
            <p className="text-2xl font-bold text-slate-900">1,204</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="rounded-xl bg-purple-50 p-3">
            <TrendingUp className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">平均 LTV</p>
            <p className="text-2xl font-bold text-slate-900">$124.50</p>
          </div>
        </div>
      </div>
      
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
          <div className="relative max-w-md min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="姓名、邮箱、国家…"
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
              分群
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-4">客户</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-4">地区</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-4">情绪</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-4">订单数</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-4">消费</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-4">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {MOCK_CUSTOMERS.map((customer) => (
                <tr key={customer.id} className="group transition-colors hover:bg-slate-50/50">
                  <td className="px-4 py-3 sm:px-6 sm:py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-600">
                        {customer.name.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">{customer.name}</span>
                        <span className="text-xs text-slate-400">{customer.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {customer.shippingCountry}
                    </div>
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      getSentimentColor(customer.sentiment)
                    )}>
                      {customer.sentiment}
                    </span>
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4">
                    <span className="text-sm font-medium text-slate-900">{customer.ordersCount}</span>
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4">
                    <span className="text-sm font-bold text-slate-900">${customer.totalOrderValue.toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3 text-right sm:px-6 sm:py-4">
                    <div className="flex items-center justify-end gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                      <button className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-500 transition-all">
                        <Mail className="w-4 h-4" />
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
          <p className="text-xs font-medium leading-relaxed text-slate-600 sm:text-slate-500">演示：本页 3 条，全库约 8,432 人</p>
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
