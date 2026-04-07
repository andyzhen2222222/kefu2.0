import { useState, useMemo, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Copy, Tag, Download, Upload } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import AddTemplateModal, {
  type TemplateFormValues,
  type TemplateDraft,
  type TemplatePickOption,
} from './AddTemplateModal';
import {
  loadStoredReplyTemplates,
  persistStoredReplyTemplates,
  type StoredReplyTemplate,
} from '@/src/lib/replyTemplatesStore';
import { useAuth } from '@/src/hooks/useAuth';
import {
  fetchRoutingRuleOptions,
  intellideskConfigured,
  intellideskTenantId,
  intellideskUserIdForApi,
  type ApiRoutingRuleOptions,
} from '@/src/services/intellideskApi';
import {
  ROUTING_AFTER_SALES_TYPE_OPTIONS,
  ROUTING_DEMO_CHANNELS,
  routingAfterSalesLabel,
} from '@/src/lib/routingRuleOptions';
import {
  parseReplyTemplatesImportCsv,
  triggerReplyTemplatesImportTemplateDownload,
} from '@/src/lib/replyTemplatesImportExport';

interface Template {
  id: string;
  name: string;
  platforms: string[];
  categoryValues: string[]; // 统一使用复数形式存 ID
  content: string;
  languages: string[];
  updatedAt: string;
  status: 'active' | 'draft';
  // 以下字段仅为显示或兼容性保留
  category?: string; 
  categoryValue?: string;
}

function mergePickOption(
  base: TemplatePickOption[],
  current: string | undefined,
  orphanSuffix: string
): TemplatePickOption[] {
  if (!current) return base;
  if (base.some((o) => o.value === current)) return base;
  return [{ value: current, label: `${current}${orphanSuffix}` }, ...base];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function newTemplateId() {
  return `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function templateToDraft(t: Template): TemplateDraft {
  return {
    id: t.id,
    name: t.name,
    platforms: t.platforms || [],
    categoryValues: t.categoryValues || (t.categoryValue ? [t.categoryValue] : []),
    languages: t.languages || ['ZH'],
    content: t.content,
    status: t.status,
  };
}

export default function TemplatesPage() {
  const { user } = useAuth();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<Template[]>(() => {
    const stored = loadStoredReplyTemplates() as any[];
    return stored.map(t => ({
      ...t,
      platforms: Array.isArray(t.platforms) ? t.platforms : (t.platform ? [t.platform] : ['All']),
      categoryValues: Array.isArray(t.categoryValues) ? t.categoryValues : (t.categoryValue ? [t.categoryValue] : []),
    })) as Template[];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateDraft | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    platform: '',
    category: '',
  });

  const routingApi = useMemo(
    () =>
      intellideskConfigured()
        ? { tenantId: intellideskTenantId(), userId: intellideskUserIdForApi(user?.id) }
        : undefined,
    [user?.id]
  );

  const [ruleOptions, setRuleOptions] = useState<ApiRoutingRuleOptions>({
    platforms: [],
    channels: ROUTING_DEMO_CHANNELS,
    afterSalesTypes: ROUTING_AFTER_SALES_TYPE_OPTIONS,
  });

  const loadRoutingOptions = useCallback(async () => {
    const tid = routingApi?.tenantId;
    const uid = routingApi?.userId;
    if (!tid) {
      setRuleOptions({
        platforms: [],
        channels: ROUTING_DEMO_CHANNELS,
        afterSalesTypes: ROUTING_AFTER_SALES_TYPE_OPTIONS,
      });
      return;
    }
    try {
      const data = await fetchRoutingRuleOptions(tid, uid);
      setRuleOptions({
        platforms: data.platforms,
        channels: data.channels.length ? data.channels : ROUTING_DEMO_CHANNELS,
        afterSalesTypes: data.afterSalesTypes.length ? data.afterSalesTypes : ROUTING_AFTER_SALES_TYPE_OPTIONS,
      });
    } catch {
      setRuleOptions({
        platforms: [],
        channels: ROUTING_DEMO_CHANNELS,
        afterSalesTypes: ROUTING_AFTER_SALES_TYPE_OPTIONS,
      });
    }
  }, [routingApi?.tenantId, routingApi?.userId]);

  useEffect(() => {
    void loadRoutingOptions();
  }, [loadRoutingOptions]);

  const platformPickOptions = useMemo((): TemplatePickOption[] => {
    const opts: TemplatePickOption[] = [{ value: 'All', label: '所有平台' }];
    // 仅使用接口同步的平台列表（去重后的 platformType）
    if (ruleOptions.platforms.length > 0) {
      // 过滤掉已经在 opts 里的（通常 platforms 里不含 All）
      const apiPlatforms = ruleOptions.platforms.filter(p => p.value !== 'All');
      return [...opts, ...apiPlatforms];
    }
    // 如果没有任何同步平台，至少保留一个所有平台
    return opts;
  }, [ruleOptions.platforms]);

  const afterSalesTypePickOptions = useMemo((): TemplatePickOption[] => {
    return ruleOptions.afterSalesTypes.map((o) => ({ value: o.value, label: o.label }));
  }, [ruleOptions.afterSalesTypes]);

  const modalPlatformOptions = useMemo(() => {
    let base = platformPickOptions;
    if (editingTemplate && Array.isArray(editingTemplate.platforms)) {
      for (const p of editingTemplate.platforms) {
        base = mergePickOption(base, p, '（未在同步平台中）');
      }
    }
    return base;
  }, [platformPickOptions, editingTemplate]);

  const modalAfterSalesOptions = useMemo(() => {
    let base = afterSalesTypePickOptions;
    const currentValues = editingTemplate?.categoryValues || [];
    for (const v of currentValues) {
      base = mergePickOption(base, v, '（未在类型列表中）');
    }
    return base;
  }, [afterSalesTypePickOptions, editingTemplate]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const filteredTemplates = useMemo(() => {
    try {
      const q = searchQuery.trim().toLowerCase();
      return (templates || []).filter((t) => {
        if (!t) return false;
        if (q && !String(t.name || '').toLowerCase().includes(q) && !String(t.content || '').toLowerCase().includes(q)) {
          return false;
        }
        const tPlatforms = Array.isArray(t.platforms) ? t.platforms : [];
        if (filters.platform && !tPlatforms.includes(filters.platform)) return false;
        
        if (filters.category) {
          const tCategories = Array.isArray(t.categoryValues) ? t.categoryValues : [];
          if (!tCategories.includes(filters.category)) return false;
        }
        return true;
      });
    } catch (e) {
      console.error('Failed to filter templates:', e);
      return [];
    }
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
    const updatedAt = todayStr();
    const languages = ['ZH'];

    if (editingId) {
      setTemplates((prev) => {
        const next = (prev || []).map((row) =>
          row.id === editingId
            ? {
                ...row,
                name: values.name,
                platforms: values.platforms,
                categoryValues: values.categoryValues,
                content: values.content,
                languages,
                status: values.status,
                updatedAt,
              }
            : row
        );
        persistStoredReplyTemplates(next as StoredReplyTemplate[]);
        return next;
      });
      return;
    }

    setTemplates((prev) => {
      const next: Template[] = [
        ...(prev || []),
        {
          id: newTemplateId(),
          name: values.name,
          platforms: values.platforms,
          categoryValues: values.categoryValues,
          content: values.content,
          languages,
          status: values.status,
          updatedAt,
        },
      ];
      persistStoredReplyTemplates(next as StoredReplyTemplate[]);
      return next;
    });
  };

  const handleCopy = (t: Template) => {
    setTemplates((prev) => {
      const next: Template[] = [
        ...prev,
        {
          ...t,
          id: newTemplateId(),
          name: `${t.name} (副本)`,
          status: 'draft',
          updatedAt: todayStr(),
        },
      ];
      persistStoredReplyTemplates(next as StoredReplyTemplate[]);
      return next;
    });
  };

  const handleDelete = (t: Template) => {
    if (!window.confirm(`确定删除模板「${t.name}」吗？`)) return;
    setTemplates((prev) => {
      const next = prev.filter((row) => row.id !== t.id);
      persistStoredReplyTemplates(next as StoredReplyTemplate[]);
      return next;
    });
  };

  const handleDownloadImportTemplate = () => {
    triggerReplyTemplatesImportTemplateDownload();
  };

  const handleImportFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const parseResult = parseReplyTemplatesImportCsv(text);
      if (parseResult.ok === false) {
        window.alert(parseResult.error);
        return;
      }
      const importedRows = parseResult.rows;
      setTemplates((prev) => {
        const added: Template[] = importedRows.map((row) => ({
          id: newTemplateId(),
          name: row.name,
          platforms: row.platforms,
          categoryValues: row.categoryValues,
          content: row.content,
          languages: ['ZH'],
          status: row.status,
          updatedAt: todayStr(),
        }));
        const next = [...(prev || []), ...added];
        persistStoredReplyTemplates(next as StoredReplyTemplate[]);
        return next;
      });
      window.alert(`已导入 ${importedRows.length} 条模板（已追加到列表末尾）。`);
    };
    reader.onerror = () => window.alert('读取文件失败，请重试。');
    reader.readAsText(file, 'UTF-8');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">模板管理</h1>
            <p className="text-sm text-slate-500 mt-1">管理快捷回复模板，可按平台与类型筛选，支持 CSV 批量导入。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadImportTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-bold transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              下载导入模版
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-bold transition-colors shadow-sm"
            >
              <Upload className="w-4 h-4" />
              导入模版
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              aria-label="选择要导入的 CSV 模版文件"
              onChange={handleImportFileChange}
            />
            <button
              type="button"
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 bg-[#F97316] hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              新建模板
            </button>
          </div>
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
                        aria-label="按平台筛选模板"
                        value={filters.platform}
                        onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                      >
                        <option value="">全部</option>
                        {platformPickOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500">售后类型</label>
                      <select
                        aria-label="按售后类型筛选模板"
                        value={filters.category}
                        onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                      >
                        <option value="">全部</option>
                        {afterSalesTypePickOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
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
                <th className="px-6 py-4 font-medium">售后类型</th>
                <th className="px-6 py-4 font-medium">状态</th>
                <th className="px-6 py-4 font-medium">更新时间</th>
                <th className="px-6 py-4 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(filteredTemplates || []).map((template) => {
                if (!template) return null;
                return (
                  <tr key={template.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{template.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(template.platforms) && template.platforms.map((p) => (
                          <span
                            key={p}
                            className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-medium"
                          >
                            {p === 'All' ? '所有平台' : p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray(template.categoryValues) && template.categoryValues.length > 0
                          ? template.categoryValues
                          : template.categoryValue
                          ? [template.categoryValue]
                          : []
                        ).map((cv) => (
                          <span
                            key={cv}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 text-indigo-600 text-xs font-medium border border-indigo-100"
                          >
                            <Tag className="w-3 h-3" />
                            {routingAfterSalesLabel(cv)}
                          </span>
                        ))}
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
                );
              })}
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
        platformOptions={modalPlatformOptions}
        afterSalesTypeOptions={modalAfterSalesOptions}
        onSave={handleSave}
      />
    </div>
  );
}
