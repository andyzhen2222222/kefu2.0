import { useState, useMemo } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Copy, Globe, Tag } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import AddTemplateModal, { type TemplateFormValues, type TemplateDraft } from './AddTemplateModal';

interface Template {
  id: string;
  name: string;
  platform: string;
  category: string;
  categoryValue: string;
  content: string;
  languages: string[];
  updatedAt: string;
  status: 'active' | 'draft';
}

const CATEGORY_LABELS: Record<string, string> = {
  logistics: '物流问题',
  after_sales_refund: '售后退款',
  quality: '质量问题',
  wrong_item: '发错货',
  missing_part: '少发漏发',
  not_received: '未收到货',
  customer_reason: '客户原因/不想要了',
  invoice: '发票相关',
  marketing: '营销关怀',
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function newTemplateId() {
  return `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const INITIAL_TEMPLATES: Template[] = [
  {
    id: '1',
    name: '物流延误安抚',
    platform: 'Amazon',
    category: '物流问题',
    categoryValue: 'logistics',
    content:
      'Dear {买家姓名},\n\nWe apologize for the delay on order {订单号}. Tracking: {物流单号}.\n\nBest regards,\n{店铺名称}',
    languages: ['EN', 'DE', 'FR'],
    updatedAt: '2026-03-24',
    status: 'active',
  },
  {
    id: '2',
    name: '退款确认通知',
    platform: 'All',
    category: '售后退款',
    categoryValue: 'after_sales_refund',
    content:
      'Hi {买家姓名},\n\nYour refund for order {订单号} has been processed. Thank you for your patience.\n\n{店铺名称}',
    languages: ['EN', 'ES'],
    updatedAt: '2026-03-23',
    status: 'active',
  },
  {
    id: '3',
    name: '好评邀请 (节假日)',
    platform: 'eBay',
    category: '营销关怀',
    categoryValue: 'marketing',
    content:
      'Dear {买家姓名},\n\nHappy holidays! If you enjoyed {商品名称}, we would appreciate your feedback.\n\n{店铺名称}',
    languages: ['EN'],
    updatedAt: '2026-03-20',
    status: 'draft',
  },
];

function templateToDraft(t: Template): TemplateDraft {
  return {
    id: t.id,
    name: t.name,
    platform: t.platform,
    categoryValue: t.categoryValue,
    categoryLabel: t.category,
    languages: t.languages,
    content: t.content,
    status: t.status,
  };
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(INITIAL_TEMPLATES);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateDraft | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    platform: '',
    category: '',
  });

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return templates.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q) && !t.content.toLowerCase().includes(q)) {
        return false;
      }
      if (filters.platform && t.platform !== filters.platform) return false;
      if (filters.category && t.categoryValue !== filters.category) return false;
      return true;
    });
  }, [templates, searchQuery, filters]);

  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingTemplate(null);
  };

  const openNew = () => {
    setEditingTemplate(null);
    setIsAddModalOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditingTemplate(templateToDraft(t));
    setIsAddModalOpen(true);
  };

  const handleSave = (values: TemplateFormValues, editingId?: string) => {
    const categoryLabel = CATEGORY_LABELS[values.category] ?? values.category;
    const updatedAt = todayStr();

    if (editingId) {
      setTemplates((prev) =>
        prev.map((row) =>
          row.id === editingId
            ? {
                ...row,
                name: values.name,
                platform: values.platform,
                category: categoryLabel,
                categoryValue: values.category,
                content: values.content,
                languages: values.languages.length ? values.languages : [values.language],
                status: values.status,
                updatedAt,
              }
            : row
        )
      );
      return;
    }

    setTemplates((prev) => [
      ...prev,
      {
        id: newTemplateId(),
        name: values.name,
        platform: values.platform,
        category: categoryLabel,
        categoryValue: values.category,
        content: values.content,
        languages: values.languages.length ? values.languages : [values.language],
        status: values.status,
        updatedAt,
      },
    ]);
  };

  const handleCopy = (t: Template) => {
    setTemplates((prev) => [
      ...prev,
      {
        ...t,
        id: newTemplateId(),
        name: `${t.name} (副本)`,
        status: 'draft',
        updatedAt: todayStr(),
      },
    ]);
  };

  const handleDelete = (t: Template) => {
    if (!window.confirm(`确定删除模板「${t.name}」吗？`)) return;
    setTemplates((prev) => prev.filter((row) => row.id !== t.id));
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">模板管理</h1>
            <p className="text-sm text-slate-500 mt-1">管理多平台、多语言的客服回复模板</p>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-[#F97316] hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            新建模板
          </button>
        </div>

        {/* Filters & Search */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索模板名称、内容..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] rounded-xl text-sm transition-all outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-medium transition-colors',
                activeFilterCount > 0 || isFilterOpen
                  ? 'border-[#F97316] text-[#F97316] bg-orange-50'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
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
                <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500">平台</label>
                      <select
                        value={filters.platform}
                        onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                      >
                        <option value="">全部</option>
                        <option value="All">所有平台</option>
                        <option value="Amazon">Amazon</option>
                        <option value="eBay">eBay</option>
                        <option value="Shopify">Shopify</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500">售后类型</label>
                      <select
                        value={filters.category}
                        onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                      >
                        <option value="">全部</option>
                        <option value="logistics">物流问题</option>
                        <option value="after_sales_refund">售后退款</option>
                        <option value="quality">质量问题</option>
                        <option value="wrong_item">发错货</option>
                        <option value="missing_part">少发漏发</option>
                        <option value="not_received">未收到货</option>
                        <option value="customer_reason">客户原因</option>
                        <option value="invoice">发票相关</option>
                        <option value="marketing">营销关怀</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-slate-50 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setFilters({ platform: '', category: '' });
                        setIsFilterOpen(false);
                      }}
                      className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      重置
                    </button>
                    <button
                      type="button"
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

        {/* Template List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium">模板名称</th>
                <th className="px-6 py-4 font-medium">适用平台</th>
                <th className="px-6 py-4 font-medium">
                  <div className="flex items-center gap-1.5">
                    售后类型
                    <div className="group relative flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold cursor-help">
                        ?
                      </div>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 text-white text-xs rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl">
                        <div className="font-bold mb-1 text-indigo-300">AI 意图关联说明</div>
                        <p className="text-slate-300 leading-relaxed">
                          售后类型与 AI 意图识别关联。当识别到买家意图时，系统会推荐对应类型下的模板。
                        </p>
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
                      </div>
                    </div>
                  </div>
                </th>
                <th className="px-6 py-4 font-medium">支持语言</th>
                <th className="px-6 py-4 font-medium">状态</th>
                <th className="px-6 py-4 font-medium">更新时间</th>
                <th className="px-6 py-4 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTemplates.map((template) => (
                <tr key={template.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{template.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-medium">
                      {template.platform}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                        <Tag className="w-3.5 h-3.5 text-slate-400" />
                        {template.category}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                        AI 意图关联
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {template.languages.map((lang) => (
                          <span
                            key={lang}
                            className="text-xs font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded"
                          >
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-1 rounded-full text-xs font-bold',
                        template.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                      )}
                    >
                      {template.status === 'active' ? '已启用' : '草稿'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{template.updatedAt}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(template)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="编辑"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(template)}
                        className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="复制"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(template)}
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredTemplates.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-slate-500">暂无匹配的模板</div>
          )}
        </div>
      </div>

      <AddTemplateModal
        isOpen={isAddModalOpen}
        onClose={closeModal}
        editingTemplate={editingTemplate}
        onSave={handleSave}
      />
    </div>
  );
}
