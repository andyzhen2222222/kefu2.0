import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Upload,
  FileText,
  Globe,
  Trash2,
  X,
  Sparkles,
  MessageCircleQuestion,
  ThumbsUp,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  CITATION_FEEDBACK_CHANGED_EVENT,
  loadStoredCitationFeedback,
  removeStoredCitationFeedback,
} from '@/src/lib/citationFeedbackStore';

const DISMISSED_DEMO_FEEDBACK_KEY = 'edesk_citation_feedback_dismissed_demo_v1';

function readDismissedDemoFeedbackIds(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DISMISSED_DEMO_FEEDBACK_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    return Array.isArray(data) ? data.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeDismissedDemoFeedbackIds(ids: string[]) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(DISMISSED_DEMO_FEEDBACK_KEY, JSON.stringify(ids));
}

type KbDocStatus = 'draft' | 'processing' | 'published';

interface KbDocument {
  id: string;
  name: string;
  status: KbDocStatus;
  scope: string;
  updatedAt: string;
  source: 'upload' | 'paste' | 'url';
}

interface KbFaq {
  id: string;
  question: string;
  answer: string;
  status: 'draft' | 'published';
  updatedAt: string;
}

interface KbChunk {
  id: string;
  docId: string;
  docName: string;
  excerpt: string;
  score: number;
}

interface CitationFeedback {
  id: string;
  ticketRef: string;
  snippet: string;
  feedback: 'helpful' | 'stale' | 'pending';
  createdAt: string;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const INITIAL_DOCS: KbDocument[] = [
  {
    id: 'kb-1',
    name: '破损商品处理政策（2026Q1）',
    status: 'published',
    scope: '全店铺',
    updatedAt: '2026-03-20',
    source: 'upload',
  },
  {
    id: 'kb-2',
    name: '退换货 SLA 与物流说明',
    status: 'published',
    scope: 'Amazon 北美',
    updatedAt: '2026-03-18',
    source: 'paste',
  },
  {
    id: 'kb-3',
    name: '欧盟 VAT 发票开具指引',
    status: 'draft',
    scope: '全店铺',
    updatedAt: '2026-03-15',
    source: 'upload',
  },
];

const INITIAL_FAQS: KbFaq[] = [
  {
    id: 'faq-1',
    question: '商品破损可以退款还是补发？',
    answer: '根据破损程度可提供全额退款或免费补发，需买家提供外包装与商品照片。',
    status: 'published',
    updatedAt: '2026-03-22',
  },
  {
    id: 'faq-2',
    question: '多久内必须回复买家消息？',
    answer: '建议在工作日 24 小时内首次回复；紧急工单以 SLA 规则为准。',
    status: 'draft',
    updatedAt: '2026-03-10',
  },
];

const SEARCH_INDEX: KbChunk[] = [
  {
    id: 'ch-1',
    docId: 'kb-1',
    docName: '破损商品处理政策（2026Q1）',
    excerpt:
      '若商品在送达时已损坏，买家可申请全额退款至原支付方式，或选择免费换货。请在 48 小时内提交清晰照片…',
    score: 0.94,
  },
  {
    id: 'ch-2',
    docId: 'kb-2',
    docName: '退换货 SLA 与物流说明',
    excerpt: '退货物流单号需在发起退货后 7 日内填写，超时将关闭退货申请…',
    score: 0.81,
  },
  {
    id: 'ch-3',
    docId: 'kb-1',
    docName: '破损商品处理政策（2026Q1）',
    excerpt: '轻微外包装压痕不影响二次销售的不属于「破损」范畴，可协商部分补偿…',
    score: 0.72,
  },
];

const INITIAL_FEEDBACK: CitationFeedback[] = [
  {
    id: 'fb-1',
    ticketRef: '#T-9281',
    snippet: '引用：破损商品全额退款条款',
    feedback: 'stale',
    createdAt: '2026-03-26',
  },
  {
    id: 'fb-2',
    ticketRef: '#T-9156',
    snippet: '引用：VAT 发票模板段落',
    feedback: 'helpful',
    createdAt: '2026-03-25',
  },
  {
    id: 'fb-3',
    ticketRef: '#T-9102',
    snippet: '引用：退换货物流说明',
    feedback: 'pending',
    createdAt: '2026-03-24',
  },
];

function rebuildCitationFeedbackList(): CitationFeedback[] {
  const dismissed = readDismissedDemoFeedbackIds();
  const demo = INITIAL_FEEDBACK.filter((f) => !dismissed.includes(f.id));
  const stored: CitationFeedback[] = loadStoredCitationFeedback().map((s) => ({
    id: s.id,
    ticketRef: s.ticketRef,
    snippet: s.snippet,
    feedback: s.feedback,
    createdAt: s.createdAt,
  }));
  return [...stored, ...demo].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const SCOPE_OPTIONS = ['全店铺', 'Amazon 北美', 'Amazon 欧洲', 'eBay', 'Walmart', 'Shopify'];

type TabId = 'docs' | 'faq' | 'feedback';

export default function KnowledgeBasePage() {
  const [tab, setTab] = useState<TabId>('docs');
  const [documents, setDocuments] = useState<KbDocument[]>(INITIAL_DOCS);
  const [faqs, setFaqs] = useState<KbFaq[]>(INITIAL_FAQS);
  const [feedback, setFeedback] = useState<CitationFeedback[]>(() => rebuildCitationFeedbackList());

  const [docSearch, setDocSearch] = useState('');
  const [trialQuery, setTrialQuery] = useState('');
  const [trialResults, setTrialResults] = useState<KbChunk[] | null>(null);
  const [trialLoading, setTrialLoading] = useState(false);

  const [addDocOpen, setAddDocOpen] = useState(false);
  const [addFaqOpen, setAddFaqOpen] = useState(false);

  const [docForm, setDocForm] = useState({
    name: '',
    mode: 'paste' as 'upload' | 'paste',
    paste: '',
    scope: '全店铺',
    fileName: '' as string | null,
  });

  const [faqForm, setFaqForm] = useState({ question: '', answer: '' });

  const filteredDocs = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    return documents.filter((d) => !q || d.name.toLowerCase().includes(q));
  }, [documents, docSearch]);

  const runTrialSearch = () => {
    const q = trialQuery.trim().toLowerCase();
    if (!q) {
      setTrialResults(null);
      return;
    }
    setTrialLoading(true);
    window.setTimeout(() => {
      const hits = SEARCH_INDEX.filter(
        (c) =>
          c.excerpt.toLowerCase().includes(q) || c.docName.toLowerCase().includes(q)
      );
      setTrialResults(hits.length ? hits : []);
      setTrialLoading(false);
    }, 400);
  };

  const saveDocumentDraft = () => {
    const name = docForm.name.trim() || docForm.fileName || '未命名文档';
    if (!docForm.paste.trim() && !docForm.fileName) {
      window.alert('请粘贴正文或选择文件（演示环境可只填标题+粘贴一段文字）');
      return;
    }
    setDocuments((prev) => [
      {
        id: newId('kb'),
        name,
        status: 'processing',
        scope: docForm.scope,
        updatedAt: todayStr(),
        source: docForm.mode === 'upload' ? 'upload' : 'paste',
      },
      ...prev,
    ]);
    setAddDocOpen(false);
    setDocForm({ name: '', mode: 'paste', paste: '', scope: '全店铺', fileName: null });
    window.setTimeout(() => {
      setDocuments((prev) =>
        prev.map((d) => (d.status === 'processing' ? { ...d, status: 'draft' as const } : d))
      );
    }, 1200);
  };

  const publishDoc = (id: string) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: 'published' as const, updatedAt: todayStr() } : d))
    );
  };

  const unpublishDoc = (id: string) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: 'draft' as const, updatedAt: todayStr() } : d))
    );
  };

  const deleteDoc = (d: KbDocument) => {
    if (!window.confirm(`确定删除「${d.name}」吗？`)) return;
    setDocuments((prev) => prev.filter((x) => x.id !== d.id));
  };

  const saveFaq = () => {
    if (!faqForm.question.trim() || !faqForm.answer.trim()) {
      window.alert('请填写问题与答案');
      return;
    }
    setFaqs((prev) => [
      {
        id: newId('faq'),
        question: faqForm.question.trim(),
        answer: faqForm.answer.trim(),
        status: 'draft',
        updatedAt: todayStr(),
      },
      ...prev,
    ]);
    setAddFaqOpen(false);
    setFaqForm({ question: '', answer: '' });
  };

  const publishFaq = (id: string) => {
    setFaqs((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: 'published' as const, updatedAt: todayStr() } : f))
    );
  };

  const deleteFaq = (f: KbFaq) => {
    if (!window.confirm('确定删除该问答对吗？')) return;
    setFaqs((prev) => prev.filter((x) => x.id !== f.id));
  };

  useEffect(() => {
    const onChange = () => setFeedback(rebuildCitationFeedbackList());
    window.addEventListener(CITATION_FEEDBACK_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CITATION_FEEDBACK_CHANGED_EVENT, onChange);
  }, []);

  const dismissFeedback = (id: string) => {
    const isBuiltInDemo = INITIAL_FEEDBACK.some((f) => f.id === id);
    if (isBuiltInDemo) {
      const dismissed = readDismissedDemoFeedbackIds();
      if (!dismissed.includes(id)) {
        writeDismissedDemoFeedbackIds([...dismissed, id]);
      }
    } else {
      removeStoredCitationFeedback(id);
    }
    setFeedback(rebuildCitationFeedbackList());
  };

  const statusBadge = (status: KbDocStatus) => {
    if (status === 'published')
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          已发布
        </span>
      );
    if (status === 'processing')
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <Loader2 className="w-3 h-3 animate-spin" />
          处理中
        </span>
      );
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        草稿
      </span>
    );
  };

  const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
    { id: 'docs', label: '文档库', icon: FileText },
    { id: 'faq', label: '问答对', icon: MessageCircleQuestion },
    { id: 'feedback', label: '引用与反馈', icon: ThumbsUp },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-7 h-7 text-[#F97316]" />
              知识库
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              上传或粘贴政策与说明，自动切片索引；AI 回复可展示引用来源。先发布再参与检索。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 p-1 bg-white rounded-xl border border-slate-200 shadow-sm w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                tab === t.id ? 'bg-[#F97316] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'docs' && (
          <>
            <div className="bg-gradient-to-br from-orange-50 to-white border border-orange-100 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm mb-3">
                <Sparkles className="w-4 h-4 text-[#F97316]" />
                试答检索
              </div>
              <p className="text-xs text-slate-600 mb-4">
                输入买家可能问法，预览会命中哪些知识片段（不调用大模型，仅检索演示）。
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
                  <input
                    value={trialQuery}
                    onChange={(e) => setTrialQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runTrialSearch()}
                    placeholder="例如：商品破损怎么退款"
                    className="w-full pl-10 pr-3 py-2.5 bg-white border border-orange-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                  />
                </div>
                <button
                  type="button"
                  onClick={runTrialSearch}
                  className="px-5 py-2.5 bg-[#F97316] hover:bg-[#ea580c] text-white rounded-xl text-sm font-bold shrink-0 transition-colors"
                >
                  试检索
                </button>
              </div>
              {trialLoading && (
                <div className="flex items-center gap-2 mt-4 text-sm text-slate-700">
                  <Loader2 className="w-4 h-4 animate-spin text-[#F97316]" />
                  检索中…
                </div>
              )}
              {trialResults && !trialLoading && (
                <ul className="mt-4 space-y-3">
                  {trialResults.length === 0 ? (
                    <li className="text-sm text-slate-600">暂无匹配片段，可尝试换关键词或补充文档。</li>
                  ) : (
                    trialResults.map((c) => (
                      <li
                        key={c.id}
                        className="bg-white/90 border border-orange-100 rounded-xl p-4 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-slate-900">{c.docName}</span>
                          <span className="text-[11px] font-mono text-[#F97316]">
                            相关度 {(c.score * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-slate-600 leading-relaxed">{c.excerpt}</p>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  placeholder="搜索文档名称…"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAddDocOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#F97316] hover:bg-[#ea580c] text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  添加文档
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-left border-b border-slate-200">
                      <th className="px-4 py-3 font-semibold">名称</th>
                      <th className="px-4 py-3 font-semibold">状态</th>
                      <th className="px-4 py-3 font-semibold">适用范围</th>
                      <th className="px-4 py-3 font-semibold">来源</th>
                      <th className="px-4 py-3 font-semibold">更新时间</th>
                      <th className="px-4 py-3 font-semibold text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                        <td className="px-4 py-3">{statusBadge(row.status)}</td>
                        <td className="px-4 py-3 text-slate-600">{row.scope}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {row.source === 'upload' ? '文件上传' : row.source === 'paste' ? '粘贴正文' : '网页同步'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 tabular-nums">{row.updatedAt}</td>
                        <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                          {row.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => publishDoc(row.id)}
                              className="text-xs font-bold text-emerald-600 hover:underline"
                            >
                              发布
                            </button>
                          )}
                          {row.status === 'published' && (
                            <button
                              type="button"
                              onClick={() => unpublishDoc(row.id)}
                              className="text-xs font-bold text-amber-700 hover:underline"
                            >
                              撤回
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteDoc(row)}
                            className="text-xs font-bold text-red-600 hover:underline inline-flex items-center gap-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'faq' && (
          <>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setAddFaqOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#F97316] hover:bg-[#ea580c] text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加问答对
              </button>
            </div>
            <div className="space-y-4">
              {faqs.map((f) => (
                <div
                  key={f.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-slate-900">Q：{f.question}</p>
                    <span
                      className={cn(
                        'shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full border',
                        f.status === 'published'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      )}
                    >
                      {f.status === 'published' ? '已发布' : '草稿'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">A：{f.answer}</p>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-400">更新 {f.updatedAt}</span>
                    <div className="space-x-2">
                      {f.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => publishFaq(f.id)}
                          className="text-xs font-bold text-emerald-600 hover:underline"
                        >
                          发布
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteFaq(f)}
                        className="text-xs font-bold text-red-600 hover:underline"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'feedback' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              来自会话中「查看引用来源」的反馈：客服在引用弹窗内点击「有用 / 内容需更新 / 待跟进」会写入本地并出现在此列表；内置三条为演示样例。上线后可改为埋点上报并由服务端回写。
            </p>
            {feedback.map((fb) => (
              <div
                key={fb.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-500">{fb.ticketRef}</span>
                    {fb.feedback === 'stale' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        <AlertTriangle className="w-3 h-3" />
                        待更新
                      </span>
                    )}
                    {fb.feedback === 'helpful' && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        有用
                      </span>
                    )}
                    {fb.feedback === 'pending' && (
                      <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                        待跟进
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700">{fb.snippet}</p>
                  <p className="text-xs text-slate-400 mt-1">{fb.createdAt}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissFeedback(fb.id)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg border border-slate-200 shrink-0"
                >
                  标记已处理
                </button>
              </div>
            ))}
            {feedback.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-12">暂无反馈记录</p>
            )}
          </div>
        )}
      </div>

      {addDocOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="关闭"
            onClick={() => setAddDocOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">添加知识文档</h2>
              <button
                type="button"
                onClick={() => setAddDocOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500">文档标题</label>
                <input
                  value={docForm.name}
                  onChange={(e) => setDocForm((s) => ({ ...s, name: e.target.value }))}
                  placeholder="例如：破损商品处理政策"
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500">添加方式</span>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setDocForm((s) => ({ ...s, mode: 'paste' }))}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors',
                      docForm.mode === 'paste'
                        ? 'border-[#F97316] bg-orange-50 text-slate-900'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    粘贴正文
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocForm((s) => ({ ...s, mode: 'upload' }))}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors',
                      docForm.mode === 'upload'
                        ? 'border-[#F97316] bg-orange-50 text-slate-900'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    上传文件
                  </button>
                </div>
              </div>
              {docForm.mode === 'upload' ? (
                <div>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-[#F97316]/50 hover:bg-orange-50/50 transition-colors">
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-sm text-slate-600">点击选择 PDF / Word / TXT</span>
                    <span className="text-xs text-slate-400 mt-1">演示环境仅记录文件名</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.md"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        setDocForm((s) => ({ ...s, fileName: f?.name ?? null }));
                      }}
                    />
                  </label>
                  {docForm.fileName && (
                    <p className="text-xs text-slate-600 mt-2">已选：{docForm.fileName}</p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-slate-500">正文</label>
                  <textarea
                    value={docForm.paste}
                    onChange={(e) => setDocForm((s) => ({ ...s, paste: e.target.value }))}
                    placeholder="直接粘贴政策全文或章节…"
                    rows={8}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] resize-y min-h-[160px]"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-500">适用范围</label>
                <select
                  value={docForm.scope}
                  onChange={(e) => setDocForm((s) => ({ ...s, scope: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                >
                  {SCOPE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-500 flex items-start gap-2">
                <Globe className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                保存后自动切片与建索引（演示为短时「处理中」再变草稿）；仅「已发布」文档参与 AI 引用检索。
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddDocOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={saveDocumentDraft}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-[#F97316] text-white hover:bg-[#ea580c] transition-colors"
                >
                  保存并入库
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {addFaqOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="关闭"
            onClick={() => setAddFaqOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">添加问答对</h2>
              <button
                type="button"
                onClick={() => setAddFaqOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500">买家可能问法</label>
                <input
                  value={faqForm.question}
                  onChange={(e) => setFaqForm((s) => ({ ...s, question: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">标准答复要点</label>
                <textarea
                  value={faqForm.answer}
                  onChange={(e) => setFaqForm((s) => ({ ...s, answer: e.target.value }))}
                  rows={5}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] resize-y"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddFaqOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={saveFaq}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-[#F97316] text-white hover:bg-[#ea580c] transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
