import { X, ShoppingBag, Clock, Tag, Search, FileText } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/src/lib/utils';
import { MOCK_TEMPLATES } from '@/src/data/demoTemplates';
import { DEMO_KB_SNIPPETS_FOR_IMPORT } from '@/src/data/demoKnowledgeSnippets';
import { ROUTING_AFTER_SALES_TYPE_OPTIONS } from '@/src/lib/routingRuleOptions';
import type { ApiAutoReplyRuleRow } from '@/src/services/intellideskApi';

export type NewAutoReplyRulePayload = {
  name: string;
  intentMatch: string | null;
  keywords: string[];
  replyContent: string;
  markRepliedOnSend: boolean;
};

export type AutoReplyRuleSavePayload = NewAutoReplyRulePayload & { ruleId?: string };

interface AddAutoReplyRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 传入则从该规则预填表单（编辑模式） */
  initialRule?: ApiAutoReplyRuleRow | null;
  onSubmit?: (payload: AutoReplyRuleSavePayload) => Promise<void>;
  submitting?: boolean;
}

function isLegacyIntentRule(rule: ApiAutoReplyRuleRow): boolean {
  const im = rule.intentMatch?.trim() ?? '';
  if (!im) return false;
  if (im.startsWith('__time__:') || im.startsWith('__after_sales_type__:')) return false;
  return !(rule.keywords?.length);
}

function appendToReply(prev: string, chunk: string) {
  const t = chunk.trim();
  if (!t) return prev;
  return prev ? `${prev.trimEnd()}\n\n${t}` : t;
}

export default function AddAutoReplyRuleModal({
  isOpen,
  onClose,
  initialRule = null,
  onSubmit,
  submitting = false,
}: AddAutoReplyRuleModalProps) {
  const [ruleName, setRuleName] = useState('');
  const [triggerType, setTriggerType] = useState('time');
  const [templateContent, setTemplateContent] = useState('');
  const [keywordsText, setKeywordsText] = useState('');
  const [timePreset, setTimePreset] = useState('weekend');
  const [timeStart, setTimeStart] = useState('18:00');
  const [timeEnd, setTimeEnd] = useState('09:00');
  const [afterSalesTypeKey, setAfterSalesTypeKey] = useState('logistics');
  const [legacyIntentText, setLegacyIntentText] = useState('');
  const [hadLegacySource, setHadLegacySource] = useState(false);
  const [markReplied, setMarkReplied] = useState(true);
  const [kbPickerOpen, setKbPickerOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [kbSearchQuery, setKbSearchQuery] = useState('');
  const [tplSearchQuery, setTplSearchQuery] = useState('');

  const filteredKb = useMemo(() => {
    const q = kbSearchQuery.trim().toLowerCase();
    return DEMO_KB_SNIPPETS_FOR_IMPORT.filter(
      (s) =>
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.body.toLowerCase().includes(q)
    );
  }, [kbSearchQuery]);

  const filteredTemplates = useMemo(() => {
    const q = tplSearchQuery.trim().toLowerCase();
    return MOCK_TEMPLATES.filter(
      (t) =>
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.content.toLowerCase().includes(q)
    );
  }, [tplSearchQuery]);

  const handleClose = () => {
    setKbPickerOpen(false);
    setTemplatePickerOpen(false);
    setKbSearchQuery('');
    setTplSearchQuery('');
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    if (initialRule) {
      setRuleName(initialRule.name);
      setTemplateContent(initialRule.replyContent ?? '');
      setMarkReplied(initialRule.markRepliedOnSend);
      const kws = initialRule.keywords ?? [];
      const im = initialRule.intentMatch ?? '';
      if (kws.length > 0) {
        setTriggerType('keyword');
        setKeywordsText(kws.join(', '));
        setTimePreset('weekend');
        setTimeStart('18:00');
        setTimeEnd('09:00');
        setAfterSalesTypeKey('logistics');
        setHadLegacySource(false);
        setLegacyIntentText('');
      } else if (im.startsWith('__time__:')) {
        setTriggerType('time');
        const rest = im.slice('__time__:'.length);
        const idx = rest.indexOf(':');
        const preset = idx === -1 ? rest : rest.slice(0, idx);
        const times = idx === -1 ? '' : rest.slice(idx + 1);
        setTimePreset(['weekend', 'weekday', 'daily'].includes(preset) ? preset : 'weekend');
        const [ts, te] = times.split('-');
        setTimeStart(ts?.trim() || '18:00');
        setTimeEnd(te?.trim() || '09:00');
        setKeywordsText('');
        setHadLegacySource(false);
        setLegacyIntentText('');
      } else if (im.startsWith('__after_sales_type__:')) {
        setTriggerType('after_sales_type');
        const v = im.slice('__after_sales_type__:'.length);
        const valid = ROUTING_AFTER_SALES_TYPE_OPTIONS.some((o) => o.value === v);
        setAfterSalesTypeKey(valid ? v : ROUTING_AFTER_SALES_TYPE_OPTIONS[0].value);
        setKeywordsText('');
        setHadLegacySource(false);
        setLegacyIntentText('');
      } else if (im.trim()) {
        setTriggerType('legacy_intent');
        setLegacyIntentText(im.trim());
        setHadLegacySource(isLegacyIntentRule(initialRule));
        setKeywordsText('');
      } else {
        setTriggerType('time');
        setTimePreset('weekend');
        setTimeStart('18:00');
        setTimeEnd('09:00');
        setKeywordsText('');
        setAfterSalesTypeKey('logistics');
        setHadLegacySource(false);
        setLegacyIntentText('');
      }
    } else {
      setRuleName('');
      setTriggerType('time');
      setTemplateContent('');
      setKeywordsText('');
      setTimePreset('weekend');
      setTimeStart('18:00');
      setTimeEnd('09:00');
      setAfterSalesTypeKey('logistics');
      setHadLegacySource(false);
      setLegacyIntentText('');
      setMarkReplied(true);
    }
  }, [isOpen, initialRule]);

  const handleSubmit = async () => {
    const name = ruleName.trim();
    if (!name) return;
    if (onSubmit && !templateContent.trim()) {
      window.alert('请填写自动回复正文');
      return;
    }
    if (triggerType === 'legacy_intent' && !legacyIntentText.trim()) {
      window.alert('请填写意图标签');
      return;
    }
    let intentMatch: string | null = null;
    let keywords: string[] = [];
    if (triggerType === 'time') {
      intentMatch = `__time__:${timePreset}:${timeStart}-${timeEnd}`;
    } else if (triggerType === 'keyword') {
      keywords = keywordsText
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (triggerType === 'after_sales_type') {
      intentMatch = `__after_sales_type__:${afterSalesTypeKey}`;
    } else if (triggerType === 'legacy_intent') {
      intentMatch = legacyIntentText.trim() || null;
      keywords = [];
    }
    if (onSubmit) {
      await onSubmit({
        name,
        intentMatch,
        keywords,
        replyContent: templateContent,
        markRepliedOnSend: markReplied,
        ruleId: initialRule?.id,
      });
    }
    handleClose();
  };

  if (!isOpen) return null;

  const isEdit = Boolean(initialRule);
  const showLegacyTab = hadLegacySource;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? '编辑自动回复规则' : '新增自动回复规则'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">规则名称</label>
              <input
                type="text"
                placeholder="例如：周末自动安抚回复"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700">触发条件</label>
              <div
                className={cn(
                  'grid gap-3',
                  showLegacyTab ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
                )}
              >
                <button
                  type="button"
                  onClick={() => setTriggerType('time')}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                    triggerType === 'time'
                      ? 'border-[#F97316] bg-orange-50/50 text-[#F97316]'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  )}
                >
                  <Clock className="w-6 h-6" />
                  <span className="text-sm font-medium">特定时间段</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTriggerType('keyword')}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                    triggerType === 'keyword'
                      ? 'border-[#F97316] bg-orange-50/50 text-[#F97316]'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  )}
                >
                  <Tag className="w-6 h-6" />
                  <span className="text-sm font-medium">包含关键字</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTriggerType('after_sales_type')}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                    triggerType === 'after_sales_type'
                      ? 'border-[#F97316] bg-orange-50/50 text-[#F97316]'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  )}
                >
                  <ShoppingBag className="w-6 h-6" />
                  <span className="text-sm font-medium">售后类型</span>
                </button>
                {showLegacyTab && (
                  <button
                    type="button"
                    onClick={() => setTriggerType('legacy_intent')}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                      triggerType === 'legacy_intent'
                        ? 'border-[#F97316] bg-orange-50/50 text-[#F97316]'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    )}
                  >
                    <FileText className="w-6 h-6" />
                    <span className="text-sm font-medium text-center leading-tight">意图直配（旧）</span>
                  </button>
                )}
              </div>

              {triggerType === 'time' && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 mt-2 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-medium text-slate-500">生效周期</label>
                      <select
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[#F97316]"
                        value={timePreset}
                        onChange={(e) => setTimePreset(e.target.value)}
                      >
                        <option value="weekend">周末 (周六、周日)</option>
                        <option value="weekday">工作日 (周一至周五)</option>
                        <option value="daily">每天</option>
                      </select>
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-medium text-slate-500">时间段</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={timeStart}
                          onChange={(e) => setTimeStart(e.target.value)}
                          className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[#F97316]"
                        />
                        <span className="text-slate-400">-</span>
                        <input
                          type="time"
                          value={timeEnd}
                          onChange={(e) => setTimeEnd(e.target.value)}
                          className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[#F97316]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {triggerType === 'keyword' && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 mt-2 animate-in fade-in">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">
                      关键字 (多个关键字用逗号分隔)
                    </label>
                    <input
                      type="text"
                      placeholder="例如：refund, 退款, remboursement"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[#F97316]"
                      value={keywordsText}
                      onChange={(e) => setKeywordsText(e.target.value)}
                    />
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      匹配方式：对买家消息做<strong>子串匹配</strong>（不区分大小写），<strong>不是</strong>整句语义理解，也<strong>不是</strong>整词精确匹配。
                      各平台语言不同可并列多条关键词（中/英/德等），例如：
                      <span className="font-mono text-slate-600"> refund,退款,remboursement </span>
                      。需要按业务类目命中时，请优先用「售后类型」（依赖工单上已归类的意图标签）。
                    </p>
                  </div>
                </div>
              )}

              {triggerType === 'after_sales_type' && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 mt-2 animate-in fade-in">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">售后类型</label>
                    <select
                      aria-label="售后类型"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[#F97316]"
                      value={afterSalesTypeKey}
                      onChange={(e) => setAfterSalesTypeKey(e.target.value)}
                    >
                      {ROUTING_AFTER_SALES_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      与「分配规则 / 字段管理」中的售后类型字典一致。命中条件为：工单上由 AI
                      归类后的<strong>意图标签</strong>（中文）属于该类型对应范围；若尚未跑意图分类，请先同步或刷新工单意图后再试。
                    </p>
                  </div>
                </div>
              )}

              {triggerType === 'legacy_intent' && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 mt-2 animate-in fade-in">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">工单意图标签（须与 AI 归类结果逐字一致）</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[#F97316]"
                      value={legacyIntentText}
                      onChange={(e) => setLegacyIntentText(e.target.value)}
                      placeholder="例如：物流查询"
                    />
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      为兼容早期规则保留。新建规则请优先使用「售后类型」。
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-bold text-slate-700">回复内容 (模版)</label>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setKbSearchQuery('');
                      setKbPickerOpen(true);
                    }}
                    className="font-medium text-[#F97316] hover:underline"
                  >
                    从知识库导入
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTplSearchQuery('');
                      setTemplatePickerOpen(true);
                    }}
                    className="font-medium text-[#F97316] hover:underline"
                  >
                    从现有模版导入
                  </button>
                </div>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:border-[#F97316] focus-within:ring-1 focus-within:ring-[#F97316] transition-all">
                <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTemplateContent((p) => appendToReply(p, '{买家姓名}'))}
                    className="px-2 py-1 text-xs font-medium bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50"
                  >
                    {'{买家姓名}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateContent((p) => appendToReply(p, '{订单号}'))}
                    className="px-2 py-1 text-xs font-medium bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50"
                  >
                    {'{订单号}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateContent((p) => appendToReply(p, '{物流单号}'))}
                    className="px-2 py-1 text-xs font-medium bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50"
                  >
                    {'{物流单号}'}
                  </button>
                </div>
                <textarea
                  className="w-full h-32 p-3 text-sm outline-none resize-none"
                  placeholder="请输入自动回复的内容..."
                  value={templateContent}
                  onChange={(e) => setTemplateContent(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700">执行动作</label>
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
                  checked={markReplied}
                  onChange={(e) => setMarkReplied(e.target.checked)}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-700">
                    发送回复后，将消息标记为&quot;已回复&quot;
                  </span>
                  <span className="text-[10px] text-slate-400">
                    工单状态将变更为 RESOLVED，并解除 SLA 超时预警
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!ruleName.trim() || submitting}
            onClick={() => void handleSubmit()}
            className="px-5 py-2.5 bg-[#F97316] text-white rounded-xl text-sm font-bold hover:bg-[#ea580c] transition-colors shadow-sm disabled:opacity-50"
          >
            {submitting ? '保存中…' : isEdit ? '保存修改' : '保存规则'}
          </button>
        </div>
      </div>

      {/* 从知识库导入 */}
      {kbPickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 animate-in fade-in duration-150">
          <div
            className="absolute inset-0"
            role="presentation"
            onClick={() => setKbPickerOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[min(80vh,520px)] flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">从知识库导入</h3>
              <button
                type="button"
                onClick={() => setKbPickerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 border-b border-slate-100 bg-slate-50/80">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={kbSearchQuery}
                  onChange={(e) => setKbSearchQuery(e.target.value)}
                  placeholder="搜索知识标题或正文…"
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                  autoFocus
                />
              </div>
            </div>
            <ul className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[200px] max-h-[360px]">
              {filteredKb.length === 0 ? (
                <li className="text-xs text-slate-400 text-center py-8">无匹配片段</li>
              ) : (
                filteredKb.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTemplateContent((p) => appendToReply(p, s.body));
                        setKbPickerOpen(false);
                        setKbSearchQuery('');
                      }}
                      className="w-full text-left p-3 rounded-xl border border-transparent hover:border-orange-100 hover:bg-orange-50/50 transition-colors"
                    >
                      <p className="text-xs font-bold text-slate-800 line-clamp-1">{s.title}</p>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{s.body}</p>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <p className="px-3 py-2 text-[10px] text-slate-400 border-t border-slate-100 bg-slate-50/50">
              演示数据；上线后对接知识库已发布切片检索。
            </p>
          </div>
        </div>
      )}

      {/* 从现有模版导入 */}
      {templatePickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 animate-in fade-in duration-150">
          <div
            className="absolute inset-0"
            role="presentation"
            onClick={() => setTemplatePickerOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[min(80vh,520px)] flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">从现有模版导入</h3>
              <button
                type="button"
                onClick={() => setTemplatePickerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 border-b border-slate-100 bg-slate-50/80">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={tplSearchQuery}
                  onChange={(e) => setTplSearchQuery(e.target.value)}
                  placeholder="搜索模版标题或内容…"
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                  autoFocus
                />
              </div>
            </div>
            <ul className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[200px] max-h-[360px]">
              {filteredTemplates.length === 0 ? (
                <li className="text-xs text-slate-400 text-center py-8">无匹配模版</li>
              ) : (
                filteredTemplates.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTemplateContent((p) => appendToReply(p, t.content));
                        setTemplatePickerOpen(false);
                        setTplSearchQuery('');
                      }}
                      className="w-full text-left p-3 rounded-xl border border-transparent hover:border-orange-100 hover:bg-orange-50/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-800 line-clamp-1">{t.title}</span>
                        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                          {t.platforms?.join(', ')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{t.content}</p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
