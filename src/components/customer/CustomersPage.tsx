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
    <div className="p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-500 text-sm">View and manage your customer database and segments.</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-blue-700 transition-all flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Add Customer
        </button>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-xl">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Customers</p>
            <p className="text-2xl font-bold text-slate-900">8,432</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-xl">
            <Star className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">VIP Customers</p>
            <p className="text-2xl font-bold text-slate-900">1,204</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-purple-50 rounded-xl">
            <TrendingUp className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Avg. LTV</p>
            <p className="text-2xl font-bold text-slate-900">$124.50</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Name, Email, or Country..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 rounded-lg text-sm transition-all outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 transition-all">
              <Filter className="w-4 h-4" />
              Segments
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sentiment</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Orders</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Spend</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {MOCK_CUSTOMERS.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
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
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {customer.shippingCountry}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide",
                      getSentimentColor(customer.sentiment)
                    )}>
                      {customer.sentiment}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-slate-900">{customer.ordersCount}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-slate-900">${customer.totalOrderValue.toFixed(2)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
        
        <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <p className="text-xs text-slate-500 font-medium">Showing 3 of 8,432 customers</p>
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
