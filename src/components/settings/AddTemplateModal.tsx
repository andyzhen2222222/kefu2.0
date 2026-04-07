import { X, Wand2, Tag, LayoutTemplate, Info, ChevronDown, Check, Search as SearchIcon } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { openFieldConfigPage, cn } from '@/src/lib/utils';

export type TemplatePickOption = { value: string; label: string };

export interface TemplateFormValues {
  name: string;
  content: string;
  categoryValues: string[]; // 改为数组
  platforms: string[];
  status: 'active' | 'draft';
  enableOnSave: boolean;
}

export interface TemplateDraft {
  id?: string;
  name: string;
  platforms: string[];
  categoryValues: string[]; // 改为数组
  categoryLabel?: string; // 保持兼容，但保存时将根据数组生成
  languages: string[];
  content: string;
  status: 'active' | 'draft';
}

interface AddTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 传入则为编辑模式，表单预填 */
  editingTemplate?: TemplateDraft | null;
  /** 平台选项：如 Amazon, eBay；含「所有平台」 */
  platformOptions: TemplatePickOption[];
  /** 与 `/api/settings/routing-rule-options` · afterSalesTypes 及字段管理「售后类型」对齐 */
  afterSalesTypeOptions: TemplatePickOption[];
  onSave?: (values: TemplateFormValues, editingId?: string) => void;
}

/** 通用下拉多选组件 */
function MultiSelectDropdown({
  options,
  selectedValues,
  onChange,
  placeholder = '请选择...',
  allOptionValue = 'All',
}: {
  options: TemplatePickOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  allOptionValue?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    return options.filter((o) =>
      o.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  const toggleOption = (val: string) => {
    let next: string[];
    if (val === allOptionValue) {
      next = [allOptionValue];
    } else {
      const withoutAll = selectedValues.filter((v) => v !== allOptionValue);
      if (withoutAll.includes(val)) {
        next = withoutAll.filter((v) => v !== val);
        if (next.length === 0) next = [allOptionValue];
      } else {
        next = [...withoutAll, val];
      }
    }
    onChange(next);
  };

  const displayLabel = useMemo(() => {
    if (selectedValues.includes(allOptionValue)) {
      return options.find(o => o.value === allOptionValue)?.label || '所有';
    }
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) {
      return options.find(o => o.value === selectedValues[0])?.label || selectedValues[0];
    }
    return `已选 ${selectedValues.length} 项`;
  }, [selectedValues, options, allOptionValue, placeholder]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm hover:border-slate-300 transition-all focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
      >
        <span className={cn("truncate", selectedValues.length === 0 && "text-slate-400")}>
          {displayLabel}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-slate-50 bg-slate-50/50">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#F97316]/20"
                placeholder="搜索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">未找到选项</div>
            ) : (
              filteredOptions.map((o) => {
                const isSelected = selectedValues.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleOption(o.value)}
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm transition-colors",
                      isSelected ? "bg-orange-50 text-[#F97316] font-medium" : "hover:bg-slate-50 text-slate-700"
                    )}
                  >
                    <span>{o.label}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const emptyForm = (): Omit<TemplateFormValues, 'enableOnSave'> & { enableOnSave: boolean } => ({
  name: '',
  content: '',
  categoryValues: [], // 默认空
  platforms: ['All'], // 默认选所有平台
  status: 'draft',
  enableOnSave: true,
});

export default function AddTemplateModal({
  isOpen,
  onClose,
  editingTemplate,
  platformOptions,
  afterSalesTypeOptions,
  onSave,
}: AddTemplateModalProps) {
  const [templateName, setTemplateName] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [categoryValues, setCategoryValues] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>(['All']);
  const [enableOnSave, setEnableOnSave] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;

    if (editingTemplate) {
      setTemplateName(editingTemplate.name);
      setTemplateContent(editingTemplate.content);
      setCategoryValues(editingTemplate.categoryValues || []);
      setPlatforms(editingTemplate.platforms || ['All']);
      setEnableOnSave(editingTemplate.status === 'active');
      return;
    }

    if (justOpened) {
      const f = emptyForm();
      setTemplateName(f.name);
      setTemplateContent(f.content);
      setCategoryValues([]);
      setPlatforms(['All']);
      setEnableOnSave(f.enableOnSave);
    }
  }, [isOpen, editingTemplate, platformOptions, afterSalesTypeOptions]);

  if (!isOpen) return null;

  const isEdit = Boolean(editingTemplate?.id);

  const handleAIGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setTemplateContent(
        `尊敬的 {买家姓名}，您好！\n\n关于订单 {订单号}，物流单号 {物流单号} 因承运商环节延误，送达可能略有推迟，我们已催促跟进。\n\n给您带来不便深表歉意，感谢您的耐心。如有疑问请随时联系我们。\n\n{店铺名称} 客服团队`
      );
      setIsGenerating(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-100 text-[#F97316] rounded-lg">
              <LayoutTemplate className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {isEdit ? '编辑回复模板' : '新建回复模板'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[75vh] space-y-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 flex gap-3 text-sm text-slate-600">
            <Info className="w-5 h-5 text-[#F97316] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              建议使用<strong className="text-slate-800">中文</strong>撰写模板。发送时系统将根据买家语种<strong className="text-slate-800">自动翻译</strong>，无需为不同语言重复创建。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2 col-span-2">
              <label className="text-sm font-bold text-slate-700">模板名称</label>
              <input
                type="text"
                placeholder="例如：物流延误安抚"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-all"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                <LayoutTemplate className="w-4 h-4 text-slate-400" />
                适用平台
              </label>
              <MultiSelectDropdown
                options={platformOptions}
                selectedValues={platforms}
                onChange={setPlatforms}
                placeholder="选择适用平台..."
              />
              <p className="text-[11px] text-slate-500">
                支持多选。若选择“所有平台”则不限制渠道。
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="template-after-sales-type"
                  className="text-sm font-bold text-slate-700 flex items-center gap-1.5"
                >
                  <Tag className="w-4 h-4 text-slate-400" />
                  售后类型
                </label>
                <button
                  type="button"
                  onClick={() => openFieldConfigPage('after_sales_type')}
                  className="text-xs text-[#F97316] font-medium hover:underline shrink-0"
                >
                  管理售后类型
                </button>
              </div>
              <MultiSelectDropdown
                options={afterSalesTypeOptions}
                selectedValues={categoryValues}
                onChange={setCategoryValues}
                placeholder="选择售后类型..."
                allOptionValue="none" // 售后类型通常没有 "All" 选项，这里设置一个不匹配的值
              />
              <p className="text-[11px] text-slate-500">支持多选。当识别到买家意图时，会推荐关联的模板。</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700">模板内容</label>
              <button
                onClick={handleAIGenerate}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-600 hover:from-indigo-100 hover:to-purple-100 rounded-lg text-xs font-bold transition-all border border-indigo-100 shadow-sm disabled:opacity-50"
              >
                {isGenerating ? (
                  <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5" />
                )}
                AI 智能生成
              </button>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:border-[#F97316] focus-within:ring-1 focus-within:ring-[#F97316] transition-all bg-white shadow-sm">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500 mr-2">插入变量：</span>
                {['{买家姓名}', '{订单号}', '{物流单号}', '{店铺名称}', '{商品名称}'].map((variable) => (
                  <button
                    key={variable}
                    type="button"
                    onClick={() => setTemplateContent((prev) => prev + variable)}
                    className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-all shadow-sm"
                  >
                    {variable}
                  </button>
                ))}
              </div>
              <textarea
                className="w-full h-48 p-4 text-sm outline-none resize-none leading-relaxed"
                placeholder="建议使用中文撰写，发送时将自动翻译为买家语种。"
                value={templateContent}
                onChange={(e) => setTemplateContent(e.target.value)}
              />
            </div>
            <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              变量会在插入模板到工单时按当前订单/客户信息替换。
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
                checked={enableOnSave}
                onChange={(e) => setEnableOnSave(e.target.checked)}
              />
              <span className="text-sm font-medium text-slate-700">保存后立即启用</span>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => {
                const values: TemplateFormValues = {
                  name: templateName,
                  content: templateContent,
                  categoryValues, // 数组
                  platforms, // 数组
                  status: enableOnSave ? 'active' : 'draft',
                  enableOnSave,
                };
                onSave?.(values, editingTemplate?.id);
                onClose();
              }}
              className="px-6 py-2.5 bg-[#F97316] text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors shadow-sm"
            >
              {isEdit ? '保存修改' : '保存模板'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
