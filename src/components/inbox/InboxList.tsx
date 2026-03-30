import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Inbox, ChevronDown, ChevronRight, Store, ArrowUpDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Ticket, TicketStatus, Order, Customer } from '@/src/types';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { InboxTicketStatusIcons } from '@/src/lib/ticketStatusUi';
import {
  getTranslationSettings,
  getTicketSubjectForDisplay,
} from '@/src/components/settings/TranslationSettingsPage';

interface InboxListProps {
  tickets: Ticket[];
  orders?: Record<string, Order>;
  customers?: Record<string, Customer>;
  selectedTicketId?: string;
}

export default function InboxList({
  tickets,
  orders = {},
  customers = {},
  selectedTicketId,
}: InboxListProps) {
  const navigate = useNavigate();
  const autoTranslateEnabled = getTranslationSettings().autoTranslateEnabled;
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'time_desc' | 'time_asc' | 'priority'>('time_desc');
  
  // Tree state
  const [expandedPlatforms, setExpandedPlatforms] = useState<Record<string, boolean>>({});
  const [expandedShops, setExpandedShops] = useState<Record<string, boolean>>({});

  const togglePlatform = (platform: string) => {
    setExpandedPlatforms(prev => ({ ...prev, [platform]: !prev[platform] }));
  };

  const toggleShop = (shop: string) => {
    setExpandedShops(prev => ({ ...prev, [shop]: !prev[shop] }));
  };

  const sortedTickets = useMemo(() => {
    let result = [...tickets];
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((t) => {
        const shown = getTicketSubjectForDisplay(t);
        return (
          shown.toLowerCase().includes(query) ||
          t.subject.toLowerCase().includes(query) ||
          (t.subjectOriginal?.toLowerCase().includes(query) ?? false) ||
          t.channelId.toLowerCase().includes(query) ||
          (t.orderId?.toLowerCase().includes(query) ?? false)
        );
      });
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'time_desc') {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      } else if (sortBy === 'time_asc') {
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      } else if (sortBy === 'priority') {
        return a.priority - b.priority; // Assuming lower number = higher priority
      }
      return 0;
    });

    return result;
  }, [tickets, searchQuery, sortBy, autoTranslateEnabled]);

  const groupedTickets = useMemo(() => {
    return sortedTickets.reduce((acc, ticket) => {
      const platform = ticket.channelId.split(' ')[0];
      const shop = ticket.channelId;
      if (!acc[platform]) acc[platform] = {};
      if (!acc[platform][shop]) acc[platform][shop] = [];
      acc[platform][shop].push(ticket);
      return acc;
    }, {} as Record<string, Record<string, Ticket[]>>);
  }, [sortedTickets]);

  // Initialize expanded state for first render
  useMemo(() => {
    if (Object.keys(expandedPlatforms).length === 0 && Object.keys(groupedTickets).length > 0) {
      const initialPlatforms: Record<string, boolean> = {};
      const initialShops: Record<string, boolean> = {};
      
      Object.entries(groupedTickets).forEach(([platform, shops]) => {
        initialPlatforms[platform] = true;
        Object.keys(shops).forEach(shop => {
          initialShops[shop] = true;
        });
      });
      
      setExpandedPlatforms(initialPlatforms);
      setExpandedShops(initialShops);
    }
  }, [groupedTickets]);

  return (
    <div className="w-[320px] flex flex-col bg-white border-r border-slate-200/90 shrink-0 h-full">
      {/* Header & Search */}
      <div className="p-4 border-b border-slate-200/90 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800 tracking-tight">智能收件箱</h2>
          <div className="flex items-center gap-1">
            <div className="relative group">
              <button className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
                <ArrowUpDown className="w-4 h-4" />
              </button>
              <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 py-1">
                <button 
                  onClick={() => setSortBy('time_desc')}
                  className={cn("w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50", sortBy === 'time_desc' ? "text-[#F97316] font-bold" : "text-slate-700")}
                >
                  按时间降序 (默认)
                </button>
                <button 
                  onClick={() => setSortBy('time_asc')}
                  className={cn("w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50", sortBy === 'time_asc' ? "text-[#F97316] font-bold" : "text-slate-700")}
                >
                  按时间升序
                </button>
                <button 
                  onClick={() => setSortBy('priority')}
                  className={cn("w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50", sortBy === 'priority' ? "text-[#F97316] font-bold" : "text-slate-700")}
                >
                  按优先级排序
                </button>
              </div>
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                showFilters ? "bg-orange-50 text-[#F97316]" : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索订单号、买家姓名..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50/90 border border-slate-200/90 focus:bg-white focus:border-slate-300 focus:ring-1 focus:ring-slate-200 rounded-lg text-[13px] text-slate-700 placeholder:text-slate-400 transition-all outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* 7-Dimension Advanced Filters (Collapsible) */}
        {showFilters && (
          <div className="pt-2 space-y-2 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-2 gap-2">
              <select className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#F97316]">
                <option value="">平台渠道</option>
                <option value="amazon">Amazon</option>
                <option value="ebay">eBay</option>
              </select>
              <select className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#F97316]">
                <option value="">买家意图</option>
                <option value="refund">要求退款</option>
                <option value="logistics">查询物流</option>
                <option value="product">产品咨询</option>
                <option value="aftersales">寻求售后</option>
              </select>
              <select className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#F97316]">
                <option value="">买家情绪</option>
                <option value="angry">愤怒抱怨</option>
                <option value="anxious">焦急催促</option>
                <option value="neutral">平静中性</option>
                <option value="joyful">开心满意</option>
              </select>
              <select className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#F97316]">
                <option value="">订单状态</option>
                <option value="unshipped">待发货</option>
                <option value="shipped">已发货</option>
                <option value="refunded">已退款</option>
                <option value="partial_refund">部分退款</option>
              </select>
              <select className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#F97316]">
                <option value="">会话状态</option>
                <option value="waiting">待回复</option>
                <option value="replied">已回复</option>
                <option value="timeout">已超时</option>
              </select>
            </div>
            <div className="flex justify-end pt-1">
              <button className="text-xs text-[#F97316] font-medium hover:underline">
                重置过滤
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ticket List */}
      <div className="flex-1 overflow-y-auto">
        {sortedTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Inbox className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-900">暂无消息</p>
            <p className="text-xs text-slate-500 mt-1">当前过滤条件下没有找到工单</p>
          </div>
        ) : (
          <div className="pb-4">
            {Object.entries(groupedTickets).map(([platform, shops]) => (
              <div key={platform} className="border-b border-slate-200/70 last:border-0">
                {/* Platform Header */}
                <button 
                  onClick={() => togglePlatform(platform)}
                  className="w-full flex items-center justify-between p-2.5 bg-slate-50/80 hover:bg-slate-100/90 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {expandedPlatforms[platform] ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="text-[13px] font-semibold text-slate-700">{platform}</span>
                  </div>
                  <span className="text-[11px] font-medium tabular-nums text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200/90">
                    {Object.values(shops).flat().length}
                  </span>
                </button>

                {/* Platform Content */}
                {expandedPlatforms[platform] && (
                  <div className="pl-2">
                    {Object.entries(shops).map(([shop, shopTickets]) => (
                      <div key={shop} className="border-l border-slate-200/80 ml-3 my-0.5">
                        {/* Shop Header */}
                        <button 
                          onClick={() => toggleShop(shop)}
                          className="w-full flex items-center justify-between py-1.5 px-2 hover:bg-slate-50/90 transition-colors rounded-r-lg"
                        >
                          <div className="flex items-center gap-1.5">
                            {expandedShops[shop] ? (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                            )}
                            <Store className="w-3.5 h-3.5 text-slate-400" strokeWidth={2} />
                            <span className="text-[12px] font-medium text-slate-600">{shop}</span>
                          </div>
                          <span className="text-[10px] font-medium tabular-nums text-slate-500">
                            {shopTickets.length}
                          </span>
                        </button>

                        {/* Shop Tickets */}
                        {expandedShops[shop] && (
                          <div className="ml-2 border border-slate-200/80 rounded-lg overflow-hidden bg-slate-50/50">
                            {shopTickets.map((ticket) => {
                              const order = ticket.orderId ? orders[ticket.orderId] : null;
                              const subjectLine = getTicketSubjectForDisplay(ticket);
                              const buyerName = customers[ticket.customerId]?.name ?? '买家';

                              const isSelected = selectedTicketId === ticket.id;
                              const showUnreadDot =
                                ticket.messageProcessingStatus === 'unread' ||
                                ticket.status === TicketStatus.NEW;

                              return (
                                <div
                                  key={ticket.id}
                                  onClick={() => navigate(`/mailbox/${ticket.id}`)}
                                  className={cn(
                                    'px-3 py-2.5 cursor-pointer transition-colors relative border-b border-slate-200/70 last:border-b-0',
                                    isSelected
                                      ? 'bg-slate-100/90 hover:bg-slate-100'
                                      : 'bg-white hover:bg-slate-50/90'
                                  )}
                                >
                                  {isSelected && (
                                    <div className="absolute left-0 top-2 bottom-2 w-px bg-orange-400/90 rounded-full" />
                                  )}

                                  <div className={cn('min-w-0', isSelected ? 'pl-2.5' : 'pl-1')}>
                                    <div className="flex items-center gap-1.5 min-h-[15px]">
                                      <span
                                        className={cn(
                                          'w-1 h-1 rounded-full shrink-0',
                                          showUnreadDot ? 'bg-rose-500/90' : 'bg-transparent'
                                        )}
                                        aria-hidden
                                      />
                                      <span
                                        className="text-xs font-medium text-slate-700 truncate min-w-0 flex-1"
                                        title={buyerName}
                                      >
                                        {buyerName}
                                      </span>
                                      <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                                        {formatDistanceToNow(new Date(ticket.updatedAt), {
                                          addSuffix: true,
                                          locale: zhCN,
                                        })}
                                      </span>
                                    </div>
                                    <h3
                                      className={cn(
                                        'text-[13px] leading-snug line-clamp-2 mt-1',
                                        showUnreadDot ? 'text-slate-800 font-medium' : 'text-slate-600 font-normal'
                                      )}
                                    >
                                      {subjectLine}
                                    </h3>
                                    {isSelected && (
                                      <div className="mt-2 pt-2 border-t border-slate-200/80 bg-slate-50/50 -mx-3 px-3 pb-0.5 rounded-b-md">
                                        <InboxTicketStatusIcons
                                          ticket={ticket}
                                          order={order}
                                          compact
                                          className="justify-start pt-0 flex-wrap gap-0.5"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
