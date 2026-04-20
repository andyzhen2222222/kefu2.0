import { X, ShoppingBag, Clock, Tag, Search, FileText } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/src/lib/utils';
import { MOCK_TEMPLATES } from '@/src/data/demoTemplates';
import { DEMO_KB_SNIPPETS_FOR_IMPORT } from '@/src/data/demoKnowledgeSnippets';
import { ROUTING_AFTER_SALES_TYPE_OPTIONS } from '@/src/lib/routingRuleOptions';
import type { AutoReplyConditionsV1 } from '@/src/lib/autoReplyConditions';
import { isAutoReplyConditionsV1 } from '@/src/lib/autoReplyConditions';
import type { ApiAutoReplyRuleRow } from '@/src/services/intellideskApi';

export type NewAutoReplyRulePayload = {
  name: string;
  conditionsJson: AutoReplyConditionsV1;
  intentMatch: null;
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
  const [combineMode, setCombineMode] = useState<'and' | 'or'>('and');
  const [timeEnabled, setTimeEnabled] = useState(true);
  const [kwEnabled, setKwEnabled] = useState(false);
  const [asEnabled, setAsEnabled] = useState(false);
  const [legacyEnabled, setLegacyEnabled] = useState(false);
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
      const cj = initialRule.conditionsJson;
      if (cj != null && isAutoReplyConditionsV1(cj)) {
        setCombineMode(cj.combine);
        setTimeEnabled(Boolean(cj.time?.preset));
        if (cj.time?.preset) {
          setTimePreset(
            ['weekend', 'weekday', 'daily'].includes(cj.time.preset) ? cj.time.preset : 'weekend'
          );
          setTimeStart(cj.time.start || '18:00');
          setTimeEnd(cj.time.end || '09:00');
        } else {
          setTimePreset('weekend');
          setTimeStart('18:00');
          setTimeEnd('09:00');
        }
        setKwEnabled(Boolean(cj.keywords?.length));
        setKeywordsText((cj.keywords ?? []).join(', '));
        setAsEnabled(Boolean(cj.afterSalesType?.trim()));
        if (cj.afterSalesType?.trim()) {
          const v = cj.afterSalesType.trim();
          const valid = ROUTING_AFTER_SALES_TYPE_OPTIONS.some((o) => o.value === v);
          setAfterSalesTypeKey(valid ? v : ROUTING_AFTER_SALES_TYPE_OPTIONS[0].value);
        } else {
          setAfterSalesTypeKey('logistics');
        }
        const leg = cj.legacyIntent?.trim() ?? '';
        setLegacyEnabled(Boolean(leg));
        setLegacyIntentText(leg);
        setHadLegacySource(Boolean(leg));
        return;
      }
      const kws = initialRule.keywords ?? [];
      const im = initialRule.intentMatch ?? '';
      const plainIntent =
        im.trim() &&
        !im.startsWith('__time__:') &&
        !im.startsWith('__after_sales_type__:')
          ? im.trim()
          : '';
      setCombineMode('and');
      setTimeEnabled(im.startsWith('__time__:'));
      if (im.startsWith('__time__:')) {
        const rest = im.slice('__time__:'.length);
        const idx = rest.indexOf(':');
        const preset = idx === -1 ? rest : rest.slice(0, idx);
        const times = idx === -1 ? '' : rest.slice(idx + 1);
        setTimePreset(['weekend', 'weekday', 'daily'].includes(preset) ? preset : 'weekend');
        const [ts, te] = times.split('-');
        setTimeStart(ts?.trim() || '18:00');
        setTimeEnd(te?.trim() || '09:00');
      } else {
        setTimePreset('weekend');
        setTimeStart('18:00');
        setTimeEnd('09:00');
      }
      setKwEnabled(kws.length > 0);
      setKeywordsText(kws.join(', '));
      setAsEnabled(im.startsWith('__after_sales_type__:'));
      if (im.startsWith('__after_sales_type__:')) {
        const v = im.slice('__after_sales_type__:'.length);
        const valid = ROUTING_AFTER_SALES_TYPE_OPTIONS.some((o) => o.value === v);
        setAfterSalesTypeKey(valid ? v : ROUTING_AFTER_SALES_TYPE_OPTIONS[0].value);
      } else {
        setAfterSalesTypeKey('logistics');
      }
      setLegacyEnabled(Boolean(plainIntent));
      setLegacyIntentText(plainIntent);
      setHadLegacySource(Boolean(plainIntent));
    } else {
      setRuleName('');
      setCombineMode('and');
      setTimeEnabled(true);
      setKwEnabled(false);
      setAsEnabled(false);
      setLegacyEnabled(false);
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
    const parsedKeywords = keywordsText
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (kwEnabled && parsedKeywords.length === 0) {
      window.alert('已启用「包含关键字」时，请至少填写一个关键词');
      return;
    }
    if (legacyEnabled && !legacyIntentText.trim()) {
      window.alert('已启用「意图直配（旧）」时，请填写工单意图标签');
      return;
    }
    let activeCount = 0;
    if (timeEnabled) activeCount += 1;
    if (kwEnabled) activeCount += 1;
    if (asEnabled) activeCount += 1;
    if (legacyEnabled) activeCount += 1;
    if (activeCount === 0) {
      window.alert('请至少启用一项触发条件（时间段、关键字、售后类型或旧版意图）');
      return;
    }
    const conditionsJson: AutoReplyConditionsV1 = { v: 1, combine: combineMode };
    if (timeEnabled) {
      conditionsJson.time = { preset: timePreset, start: timeStart, end: timeEnd };
    }
    if (kwEnabled && parsedKeywords.length) {
      conditionsJson.keywords = parsedKeywords;
    }
    if (asEnabled) {
      conditionsJson.afterSalesType = afterSalesTypeKey;
    }
    if (legacyEnabled && legacyIntentText.trim()) {
      conditionsJson.legacyIntent = legacyIntentText.trim();
    }
    if (onSubmit) {
      await onSubmit({
        name,
        conditionsJson,
        intentMatch: null,
        keywords: [],
        replyContent: templateContent,
        markRepliedOnSend: markReplied,
        ruleId: initialRule?.id,
      });
    }
    handleClose();
  };

  if (!isOpen) return null;

  const isEdit = Boolean(initialRule);
  const showLegacyBlock = isEdit && hadLegacySource;

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
              <div className="flex flex-wrap items-end justify-between gap-2">
                <label className="text-sm font-bold text-slate-700">触发条件</label>
                <div
                  className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium"
                  role="group"
                  aria-label="多条件组合方式"
                >
                  <button
                    type="button"
                    onClick={() => setCombineMode('and')}
                    className={cn(
                      'px-3 py-1.5 rounded-md transition-colors',
                      combineMode === 'and'
                        ? 'bg-white text-[#F97316] shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                    )}
                  >
                    全部满足（且）
                  </button>
                  <button
                    type="button"
                    onClick={() => setCombineMode('or')}
                    className={cn(
                      'px-3 py-1.5 rounded-md transition-colors',
                      combineMode === 'or'
                        ? 'bg-white text-[#F97316] shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                    )}
                  >
                    满足任一（或）
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed -mt-1">
                可同时勾选多项；「且」表示<strong>已勾选</strong>的维度都要成立才触发，「或」表示<strong>已勾选</strong>的维度任一条成立即触发。关键字维度内仍为<strong>任一关键词子串命中</strong>即算该维度成立。
              </p>

              <div className="space-y-2 rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                <label className="flex items-start gap-3 p-3 bg-white cursor-pointer hover:bg-slate-50/80">
                  <input
                    type="checkbox"
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
                    checked={timeEnabled}
                    onChange={(e) => setTimeEnabled(e.target.checked)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                      <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                      特定时间段
                    </div>
                    {timeEnabled && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-3 animate-in fade-in">
                        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                          <div className="flex-1 space-y-1">
                            <span className="text-xs font-medium text-slate-500">生效周期</span>
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
                            <span className="text-xs font-medium text-slate-500">时间段</span>
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
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-white cursor-pointer hover:bg-slate-50/80">
                  <input
                    type="checkbox"
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
                    checked={kwEnabled}
                    onChange={(e) => setKwEnabled(e.target.checked)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                      <Tag className="w-4 h-4 text-slate-500 shrink-0" />
                      包含关键字
                    </div>
                    {kwEnabled && (
                      <div className="mt-3 space-y-1 animate-in fade-in">
                        <span className="text-xs font-medium text-slate-500">
                          关键字 (多个用逗号分隔)
                        </span>
                        <input
                          type="text"
                          placeholder="例如：refund, 退款, remboursement"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#F97316]"
                          value={keywordsText}
                          onChange={(e) => setKeywordsText(e.target.value)}
                        />
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          对买家消息做<strong>子串匹配</strong>（不区分大小写），非整句语义。类目命中请配合「售后类型」。
                        </p>
                      </div>
                    )}
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-white cursor-pointer hover:bg-slate-50/80">
                  <input
                    type="checkbox"
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
                    checked={asEnabled}
                    onChange={(e) => setAsEnabled(e.target.checked)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                      <ShoppingBag className="w-4 h-4 text-slate-500 shrink-0" />
                      售后类型
                    </div>
                    {asEnabled && (
                      <div className="mt-3 space-y-1 animate-in fade-in">
                        <select
                          aria-label="售后类型"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#F97316]"
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
                          与分配规则字典一致；依赖工单上 AI 归类后的意图标签。
                        </p>
                      </div>
                    )}
                  </div>
                </label>

                {showLegacyBlock && (
                  <label className="flex items-start gap-3 p-3 bg-white cursor-pointer hover:bg-slate-50/80">
                    <input
                      type="checkbox"
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
                      checked={legacyEnabled}
                      onChange={(e) => setLegacyEnabled(e.target.checked)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                        <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                        意图直配（旧）
                      </div>
                      {legacyEnabled && (
                        <div className="mt-3 space-y-1 animate-in fade-in">
                          <span className="text-xs font-medium text-slate-500">
                            工单意图标签（须与 AI 归类逐字一致）
                          </span>
                          <input
                            type="text"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#F97316]"
                            value={legacyIntentText}
                            onChange={(e) => setLegacyIntentText(e.target.value)}
                            placeholder="例如：物流查询"
                          />
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            仅用于兼容历史规则；新建请优先用「售后类型」。
                          </p>
                        </div>
                      )}
                    </div>
                  </label>
                )}
              </div>
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
