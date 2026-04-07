/**
 * 与前端收件箱/PRD 常见 intent 展示对齐，供 AI 分类输出校验。
 * 字段库「售后类型」为另一套 value；此处为工单列表筛选用中文意图标签。
 */
export const TICKET_INTENT_LABELS = [
  '物流查询',
  '退款请求',
  '产品咨询',
  '发票相关',
  '地址修改',
  '换货',
  '未收到货',
  '少发漏发',
  '质量问题',
  '差评威胁',
  '营销关怀',
  '退款进度',
  '重发',
  '账号与优惠券',
  '其它',
  '未分类',
] as const;

export type TicketIntentLabel = (typeof TICKET_INTENT_LABELS)[number];

const LABEL_SET = new Set<string>(TICKET_INTENT_LABELS);

/** 模型输出归一化到允许列表；无法匹配时返回「未分类」 */
export function normalizeClassifiedIntent(raw: string): string {
  const t = raw.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
  if (!t) return '未分类';
  if (LABEL_SET.has(t)) return t;
  for (const label of TICKET_INTENT_LABELS) {
    if (t === label || t.includes(label) || label.includes(t)) return label;
  }
  const aliases: Record<string, string> = {
    索要发票: '发票相关',
    要发票: '发票相关',
    物流: '物流查询',
    催单: '物流查询',
    退货: '退款请求',
    退款: '退款请求',
  };
  for (const [k, v] of Object.entries(aliases)) {
    if (t.includes(k)) return v;
  }
  return '未分类';
}

export function buildClassifyIntentPrompt(params: {
  subject: string;
  subjectOriginal: string | null;
  conversationText: string;
}): string {
  const list = TICKET_INTENT_LABELS.join('、');
  return `你是跨境电商客服系统的「工单意图」分类器，输出供列表筛选与自动回复规则匹配使用。

【必须遵守】
1. 只根据下列标签中选出一个最贴切的；标签必须逐字一致（不要自造新词）。
2. 严格只输出一行 JSON，不要 markdown，不要解释。格式：{"intent":"标签"}
3. 信息不足或无法判断时，intent 填「未分类」。

【可选标签】（仅允许其一）
${list}

【工单标题】
${params.subject || '（空）'}
【原标题/平台文】
${params.subjectOriginal?.trim() || '（无）'}
【会话摘录】（senderType: 内容，按时间顺序）
${params.conversationText || '（暂无消息）'}`;
}

const SENTIMENT_ALLOWED = new Set(['angry', 'anxious', 'neutral', 'joyful']);

/** 与前端 Sentiment 枚举一致 */
export function normalizeClassifiedSentiment(raw: string): string {
  const t = raw.trim().toLowerCase().replace(/["'「」]/g, '');
  if (SENTIMENT_ALLOWED.has(t)) return t;
  if (/愤怒|气愤|差评|投诉|威胁/.test(raw)) return 'angry';
  if (/焦虑|着急|催促|尽快|马上/.test(raw)) return 'anxious';
  if (/开心|满意|感谢|好评|棒/.test(raw)) return 'joyful';
  return 'neutral';
}

export function buildClassifyIntentAndSentimentPrompt(params: {
  subject: string;
  subjectOriginal: string | null;
  conversationText: string;
}): string {
  const list = TICKET_INTENT_LABELS.join('、');
  return `你是跨境电商客服系统的「工单意图 + 买家情绪」分类器。

【必须遵守】
1. intent 只能从下列标签中选一个，须与列表逐字一致：${list}
2. sentiment 只能是四选一：angry、anxious、neutral、joyful（小写英文）
3. 严格只输出一行 JSON，不要 markdown，不要解释。格式：{"intent":"标签","sentiment":"neutral"}
4. 信息不足时 intent 填「未分类」，sentiment 填 neutral

【工单标题】
${params.subject || '（空）'}
【原标题/平台文】
${params.subjectOriginal?.trim() || '（无）'}
【会话摘录】
${params.conversationText || '（暂无消息）'}`;
}
