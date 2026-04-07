import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Database, Plus, Search, Edit2, Trash2, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { RETURN_CARRIER_DICT_ID, RETURN_CARRIER_SEED_ITEMS } from '@/src/lib/afterSalesFieldOptions';

// Mock Dictionary Data
const DICTIONARIES = [
  { id: 'after_sales_type', name: '售后类型', description: '全局统一分类（包含AI意图、模板场景、售后问题归因等）', type: 'dropdown', isRequired: true },
  { id: 'resolution', name: '处理方式', description: '客服处理售后的方式，如：仅退款、退货退款、换货等', type: 'dropdown', isRequired: true },
  { id: 'receiver', name: '签收方/退件仓', description: '退货包裹的接收仓库或负责部门', type: 'dropdown', isRequired: true },
  {
    id: RETURN_CARRIER_DICT_ID,
    name: '退回承运商',
    description: '退货物流常用承运商，供售后表单下拉选用',
    type: 'dropdown',
    isRequired: false,
  },
];

const DICT_ITEMS: Record<string, { id: string; label: string; value: string; status: 'active' | 'disabled' }[]> = {
  'after_sales_type': [
    { id: '1', label: '物流问题', value: 'logistics', status: 'active' },
    { id: 'as-refund', label: '售后退款', value: 'after_sales_refund', status: 'active' },
    { id: '2', label: '质量问题', value: 'quality', status: 'active' },
    { id: '3', label: '发错货', value: 'wrong_item', status: 'active' },
    { id: '4', label: '少发漏发', value: 'missing_part', status: 'active' },
    { id: '5', label: '未收到货', value: 'not_received', status: 'active' },
    { id: '6', label: '客户原因/不想要了', value: 'customer_reason', status: 'active' },
    { id: '7', label: '发票相关', value: 'invoice', status: 'active' },
    { id: '8', label: '营销关怀', value: 'marketing', status: 'active' },
  ],
  'resolution': [
    { id: '1', label: '仅退款', value: 'refund_only', status: 'active' },
    { id: '2', label: '退货退款', value: 'return_and_refund', status: 'active' },
    { id: '3', label: '换货', value: 'exchange', status: 'active' },
    { id: '4', label: '补发包裹/重发', value: 'resend', status: 'active' },
  ],
  'receiver': [
    { id: '1', label: '美东一号仓', value: 'us_east_1', status: 'active' },
    { id: '2', label: '美西二号仓', value: 'us_west_2', status: 'active' },
    { id: '3', label: '欧洲中心仓', value: 'eu_central', status: 'active' },
  ],
  [RETURN_CARRIER_DICT_ID]: RETURN_CARRIER_SEED_ITEMS.map((i) => ({ ...i })),
};

export default function DataDictionaryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDict, setSelectedDict] = useState(DICTIONARIES[0].id);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const dict = searchParams.get('dict');
    if (dict && DICTIONARIES.some((d) => d.id === dict)) {
      setSelectedDict(dict);
    }
  }, [searchParams]);

  const selectDictionary = (id: string) => {
    setSelectedDict(id);
    setSearchParams({ dict: id });
  };
  
  // State for CRUD modal
  const [dictItems, setDictItems] = useState(DICT_ITEMS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: string; label: string; value: string; status: 'active' | 'disabled' } | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<{
    label: string;
    value: string;
    status: 'active' | 'disabled';
  }>({ label: '', value: '', status: 'active' });

  const currentDict = DICTIONARIES.find(d => d.id === selectedDict);
  const currentItems = dictItems[selectedDict] || [];

  const filteredItems = currentItems.filter(item => 
    item.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenModal = (item?: any) => {
    if (item) {
      setEditingItem(item);
      setFormData({ label: item.label, value: item.value, status: item.status });
    } else {
      setEditingItem(null);
      setFormData({ label: '', value: '', status: 'active' });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.label || !formData.value) return;

    setDictItems(prev => {
      const items = prev[selectedDict] || [];
      if (editingItem) {
        return {
          ...prev,
          [selectedDict]: items.map(i => i.id === editingItem.id ? { ...i, ...formData } : i)
        };
      } else {
        return {
          ...prev,
          [selectedDict]: [...items, { id: Date.now().toString(), ...formData }]
        };
      }
    });
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('确定要删除这个选项吗？')) {
      setDictItems(prev => ({
        ...prev,
        [selectedDict]: prev[selectedDict].filter(i => i.id !== id)
      }));
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">字段管理</h1>
            <p className="text-sm text-slate-500 mt-1">
              维护售后类型、处理方式、签收方、退回承运商等字典数据，供表单与业务规则引用
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-[#F97316] shrink-0">
            <Database className="w-5 h-5" strokeWidth={2} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {DICTIONARIES.map((dict) => (
                <button
                  key={dict.id}
                  type="button"
                  onClick={() => selectDictionary(dict.id)}
                  className={cn(
                    'inline-flex flex-col items-start gap-0.5 rounded-xl border px-4 py-2.5 text-left transition-all min-w-[140px]',
                    selectedDict === dict.id
                      ? 'border-[#F97316] bg-orange-50 shadow-sm'
                      : 'border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-slate-50'
                  )}
                >
                  <span
                    className={cn(
                      'text-sm font-bold',
                      selectedDict === dict.id ? 'text-[#F97316]' : 'text-slate-800'
                    )}
                  >
                    {dict.name}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {dictItems[dict.id]?.length ?? 0} 项
                    {dict.isRequired ? ' · 必填' : ''}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative w-full lg:max-w-xs shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="搜索选项标签或存储值..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {currentDict ? (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900">{currentDict.name}</h2>
                <p className="text-sm text-slate-500 mt-1">{currentDict.description}</p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenModal()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#F97316] hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition-colors shadow-sm shrink-0"
              >
                <Plus className="w-4 h-4" />
                新增选项
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-slate-100 bg-slate-50/80">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  选项列表
                </span>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-sm text-slate-600">表单必填</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      defaultChecked={currentDict.isRequired}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus-visible:outline peer-focus-visible:ring-2 peer-focus-visible:ring-[#F97316]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F97316]" />
                  </div>
                </label>
              </div>

              <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between text-sm text-slate-500">
                <span>共 {filteredItems.length} 个选项</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-medium">显示标签</th>
                      <th className="px-6 py-4 font-medium">存储值</th>
                      <th className="px-6 py-4 font-medium">状态</th>
                      <th className="px-6 py-4 font-medium text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.length > 0 ? (
                      filteredItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900">{item.label}</td>
                          <td className="px-6 py-4">
                            <code className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                              {item.value}
                            </code>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={cn(
                                'inline-flex items-center px-2 py-1 rounded-full text-xs font-bold',
                                item.status === 'active'
                                  ? 'bg-green-50 text-green-700'
                                  : 'bg-slate-100 text-slate-600'
                              )}
                            >
                              {item.status === 'active' ? '启用' : '禁用'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenModal(item)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="编辑"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="删除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500 text-sm">
                          没有找到匹配的选项
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
            请选择上方字典类型
          </div>
        )}
      </div>

      {/* CRUD Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingItem ? '编辑选项' : '新增选项'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <span className="text-red-500">*</span> 显示标签 (Label):
                </label>
                <input 
                  type="text" 
                  value={formData.label}
                  onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="例如：物流延误"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <span className="text-red-500">*</span> 存储值 (Value):
                </label>
                <input 
                  type="text" 
                  value={formData.value}
                  onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                  placeholder="例如：logistics_delay"
                  className="w-full px-3 py-2 font-mono bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]" 
                />
                <p className="text-[10px] text-slate-400">仅支持小写字母、数字和下划线，作为系统内部标识。</p>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.status === 'active'}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.checked ? 'active' : 'disabled' }))}
                    className="w-4 h-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]" 
                  />
                  <span className="text-sm font-medium text-slate-700">启用该选项</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleSave}
                disabled={!formData.label || !formData.value}
                className="px-6 py-2.5 bg-[#F97316] text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
