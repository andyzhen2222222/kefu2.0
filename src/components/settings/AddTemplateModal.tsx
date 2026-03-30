import { X, Wand2, Globe, Tag, LayoutTemplate } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn, openFieldConfigPage } from '@/src/lib/utils';

export interface TemplateFormValues {
  name: string;
  content: string;
  category: string;
  platform: string;
  language: string;
  languages: string[];
  status: 'active' | 'draft';
  enableOnSave: boolean;
}

export interface TemplateDraft {
  id?: string;
  name: string;
  platform: string;
  categoryValue: string;
  categoryLabel: string;
  languages: string[];
  content: string;
  status: 'active' | 'draft';
}

interface AddTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 传入则为编辑模式，表单预填 */
  editingTemplate?: TemplateDraft | null;
  onSave?: (values: TemplateFormValues, editingId?: string) => void;
}

const emptyForm = (): Omit<TemplateFormValues, 'enableOnSave'> & { enableOnSave: boolean } => ({
  name: '',
  content: '',
  category: 'logistics',
  platform: 'All',
  language: 'EN',
  languages: ['EN'],
  status: 'draft',
  enableOnSave: true,
});

export default function AddTemplateModal({
  isOpen,
  onClose,
  editingTemplate,
  onSave,
}: AddTemplateModalProps) {
  const [templateName, setTemplateName] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [category, setCategory] = useState('logistics');
  const [platform, setPlatform] = useState('All');
  const [language, setLanguage] = useState('EN');
  const [enableOnSave, setEnableOnSave] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingTemplate) {
      setTemplateName(editingTemplate.name);
      setTemplateContent(editingTemplate.content);
      setCategory(editingTemplate.categoryValue);
      setPlatform(editingTemplate.platform);
      const primary = editingTemplate.languages[0] ?? 'EN';
      setLanguage(primary);
      setEnableOnSave(editingTemplate.status === 'active');
    } else {
      const f = emptyForm();
      setTemplateName(f.name);
      setTemplateContent(f.content);
      setCategory(f.category);
      setPlatform(f.platform);
      setLanguage(f.language);
      setEnableOnSave(f.enableOnSave);
    }
  }, [isOpen, editingTemplate]);

  if (!isOpen) return null;

  const isEdit = Boolean(editingTemplate?.id);

  const handleAIGenerate = () => {
    setIsGenerating(true);
    // Mock AI generation
    setTimeout(() => {
      setTemplateContent(`Dear {买家姓名},\n\nThank you for your order {订单号}. We are writing to inform you that there might be a slight delay in the delivery of your package {物流单号} due to unexpected logistics congestion.\n\nWe apologize for any inconvenience this may cause and appreciate your patience. Your order is important to us, and we are doing everything we can to expedite the process.\n\nBest regards,\n{店铺名称} Customer Service`);
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
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[75vh] space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2 col-span-2">
              <label className="text-sm font-bold text-slate-700">模板名称</label>
              <input 
                type="text" 
                placeholder="例如：物流延误安抚 (英文)"
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
              <select 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-all"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                <option value="All">所有平台</option>
                <option value="Amazon">Amazon</option>
                <option value="eBay">eBay</option>
                <option value="Shopify">Shopify</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-slate-400" />
                  售后类型
                </span>
                <button 
                  type="button"
                  onClick={() => openFieldConfigPage('after_sales_type')}
                  className="text-xs text-[#F97316] font-medium hover:underline"
                >
                  管理售后类型
                </button>
              </label>
              <select 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-all"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="logistics">物流问题</option>
                <option value="after_sales_refund">售后退款</option>
                <option value="quality">质量问题</option>
                <option value="wrong_item">发错货</option>
                <option value="missing_part">少发漏发</option>
                <option value="not_received">未收到货</option>
                <option value="customer_reason">客户原因/不想要了</option>
                <option value="invoice">发票相关</option>
                <option value="marketing">营销关怀</option>
              </select>
            </div>

            <div className="space-y-2 col-span-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-slate-400" />
                支持语言
              </label>
              <div className="flex flex-wrap gap-3">
                {['EN', 'DE', 'FR', 'ES', 'IT', 'JA', 'ZH'].map((lang) => (
                  <label key={lang} className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-all",
                    language === lang 
                      ? "border-[#F97316] bg-orange-50 text-[#F97316]" 
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  )}>
                    <input 
                      type="radio" 
                      name="language" 
                      value={lang}
                      checked={language === lang}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="hidden"
                    />
                    <span className="text-sm font-bold">{lang}</span>
                  </label>
                ))}
              </div>
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
                    onClick={() => setTemplateContent(prev => prev + variable)}
                    className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-all shadow-sm"
                  >
                    {variable}
                  </button>
                ))}
              </div>
              <textarea 
                className="w-full h-48 p-4 text-sm outline-none resize-none leading-relaxed"
                placeholder="请输入模板内容，或点击右上角使用 AI 智能生成..."
                value={templateContent}
                onChange={(e) => setTemplateContent(e.target.value)}
              />
            </div>
            <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              提示：使用变量可以在发送时自动替换为订单的实际信息。
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
            <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
              取消
            </button>
            <button
              onClick={() => {
                const values: TemplateFormValues = {
                  name: templateName,
                  content: templateContent,
                  category,
                  platform,
                  language,
                  languages: [language],
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
