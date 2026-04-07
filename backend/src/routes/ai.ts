import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import type { TenantRequest } from '../middleware/tenant.js';
import { rateLimitDistributed } from '../lib/redisClient.js';
import { llmComplete, llmUnconfiguredHint, resolveLlmBackend } from '../lib/llmClient.js';
import { buildClassifyIntentPrompt, normalizeClassifiedIntent } from '../lib/ticketIntentLabels.js';
import { normalizeClassifiedSentiment } from '../lib/ticketSentimentLabels.js';
import { resolveTicketVisibility, ticketVisibilityWhereClause } from '../lib/ticketRoutingAssign.js';

const router = Router();

function logAiUpstreamError(op: string, ticketId: string | undefined, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn('[ai]', op, ticketId ? `ticketId=${ticketId}` : 'ticketId=(n/a)', msg.slice(0, 400));
}

const ticketBody = z.object({ ticketId: z.string().uuid() });

const audit: { at: string; ticketId?: string; userId: string | null | undefined; op: string }[] = [];

async function aiRateLimit(req: TenantRequest): Promise<boolean> {
  const key = `${req.userId ?? 'anon'}:${req.tenantId}`;
  return rateLimitDistributed(key, 20, 60_000);
}

async function loadTicketMessages(
  tenantId: string,
  ticketId: string,
  userId: string | null | undefined
) {
  const vis = await resolveTicketVisibility(tenantId, userId);
  const visClause = ticketVisibilityWhereClause(vis);
  return prisma.ticket.findFirst({
    where: { id: ticketId, tenantId, ...(Object.keys(visClause).length > 0 ? visClause : {}) },
    include: {
      messages: { orderBy: { createdAt: 'asc' }, take: 80 },
      channel: true,
    },
  });
}

router.post('/summarize', async (req: TenantRequest, res) => {
  const parsed = ticketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'bad_request', message: JSON.stringify(parsed.error.flatten()) });
    return;
  }
  if (!(await aiRateLimit(req))) {
    res.status(429).json({ error: 'rate_limit', message: 'Too many AI requests' });
    return;
  }

  const ticket = await loadTicketMessages(req.tenantId!, parsed.data.ticketId, req.userId);
  if (!ticket) {
    res.status(404).json({ error: 'not_found', message: 'Ticket not found' });
    return;
  }

  if (resolveLlmBackend() === 'none') {
    const fallback = ticket.messages.map((m) => m.content).join('\n').slice(0, 500);
    audit.push({
      at: new Date().toISOString(),
      ticketId: ticket.id,
      userId: req.userId,
      op: 'summarize_fallback',
    });
    res.json({
      summary: fallback ? `（${llmUnconfiguredHint()}）会话摘录：${fallback}` : '无内容可摘要',
    });
    return;
  }

  const text = ticket.messages.map((m) => `${m.senderType}: ${m.content}`).join('\n');
  try {
    const summary = await llmComplete(
      `用中文 3 句话总结以下客服工单对话：\n${text}`
    );
    audit.push({
      at: new Date().toISOString(),
      ticketId: ticket.id,
      userId: req.userId,
      op: 'summarize',
    });
    res.json({ summary: summary || '（模型无返回）' });
  } catch (e) {
    logAiUpstreamError('summarize', parsed.data.ticketId, e);
    res.status(502).json({
      error: 'ai_error',
      message: e instanceof Error ? e.message : String(e),
    });
  }
});

router.post('/ticket-insight', async (req: TenantRequest, res) => {
  const parsed = ticketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'bad_request', message: JSON.stringify(parsed.error.flatten()) });
    return;
  }
  if (!(await aiRateLimit(req))) {
    res.status(429).json({ error: 'rate_limit', message: 'Too many AI requests' });
    return;
  }

  const ticket = await loadTicketMessages(req.tenantId!, parsed.data.ticketId, req.userId);
  if (!ticket) {
    res.status(404).json({ error: 'not_found', message: 'Ticket not found' });
    return;
  }

  if (resolveLlmBackend() === 'none') {
    const fallback = ticket.messages.map((m) => m.content).join('\n').slice(0, 500);
    res.json({
      summary: fallback ? `（${llmUnconfiguredHint()}）会话摘录：${fallback}` : '无内容可总结',
      intent: '未配置AI',
      sentiment: 'neutral',
    });
    return;
  }

  const text = ticket.messages.map((m) => `${m.senderType}: ${m.content}`).join('\n');
  const prompt = `你是电商客服专家。请分析以下客服工单对话，并输出 JSON。

对话历史：
"""
${text}
"""

请输出以下字段：
1. summary: 用中文简洁总结对话（约 3 句话）。
2. intent: 识别客户的主要意图。可选值见下，若无匹配请根据理解输出 2-4 字中文：
   - 破损/漏发 (Damaged/Missing)
   - 物流咨询 (Logistics Inquiry)
   - 退货退款 (Return/Refund)
   - 售后投诉 (Complaint)
   - 催促发货 (Urge Dispatch)
3. sentiment: 识别用户的情绪级别。可选值：
   - angry: 愤怒抱怨
   - anxious: 焦急催促
   - neutral: 平静中性
   - joyful: 开心满意

JSON 示例：
{
  "summary": "...",
  "intent": "物流咨询",
  "sentiment": "anxious"
}
只输出 JSON，不要 Markdown 标签。`;

  try {
    const rawText = await llmComplete(prompt, { json: true });
    let result: { summary?: string; intent?: string; sentiment?: string } = {};
    try {
      result = JSON.parse(rawText);
    } catch {
      // Regexp fallback for JSON
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) result = JSON.parse(match[0]);
    }

    const summary = result.summary || '（模型未提供总结）';
    const intent = normalizeClassifiedIntent(result.intent || '');
    const sentiment = normalizeClassifiedSentiment(result.sentiment || 'neutral');

    audit.push({
      at: new Date().toISOString(),
      ticketId: ticket.id,
      userId: req.userId,
      op: 'ticket_insight',
    });

    res.json({ summary, intent, sentiment });
  } catch (e) {
    logAiUpstreamError('ticket-insight', parsed.data.ticketId, e);
    res.status(502).json({
      error: 'ai_error',
      message: e instanceof Error ? e.message : String(e),
    });
  }
});

router.post('/suggest-reply', async (req: TenantRequest, res) => {
  const parsed = ticketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'bad_request', message: JSON.stringify(parsed.error.flatten()) });
    return;
  }
  if (!(await aiRateLimit(req))) {
    res.status(429).json({ error: 'rate_limit', message: 'Too many AI requests' });
    return;
  }

  const ticket = await loadTicketMessages(req.tenantId!, parsed.data.ticketId, req.userId);
  if (!ticket) {
    res.status(404).json({ error: 'not_found', message: 'Ticket not found' });
    return;
  }

  const platformLang = ticket.channel?.platformLanguage || 'English';

  if (resolveLlmBackend() === 'none') {
    audit.push({
      at: new Date().toISOString(),
      ticketId: ticket.id,
      userId: req.userId,
      op: 'suggest_fallback',
    });
    res.json({
      suggestion: `（${llmUnconfiguredHint()}）请根据工单主题手动回复买家。`,
      platformSuggestion: `（${llmUnconfiguredHint()}）Please reply manually in ${platformLang}.`,
    });
    return;
  }

  const text = ticket.messages.map((m) => `${m.senderType}: ${m.content}`).join('\n');
  try {
    const prompt = `你是跨境电商客服专家。请根据以下对话内容，生成一段专业且有同理心的回复草稿。
你需要同时生成两个版本的回复：
1. 「我的语言」：中文版本，供客服预览和确认。
2. 「平台语言」：目标平台使用的语言（${platformLang}），这是最终发给客户的版本。

工单主题：${ticket.subject}
对话历史：
${text}

请严格按照以下 JSON 格式返回，不要包含任何 markdown 标签或多余解释：
{
  "myLanguage": "中文回复内容...",
  "platformLanguage": "平台语言回复内容..."
}`;

    const suggestionRaw = await llmComplete(prompt, { json: true });
    let suggestionObj = { myLanguage: '', platformLanguage: '' };
    try {
      suggestionObj = JSON.parse(suggestionRaw);
    } catch {
      // 容错处理
      suggestionObj = { myLanguage: suggestionRaw, platformLanguage: '' };
    }

    audit.push({
      at: new Date().toISOString(),
      ticketId: ticket.id,
      userId: req.userId,
      op: 'suggest-reply',
    });
    res.json({
      suggestion: suggestionObj.myLanguage || '（模型未生成中文）',
      platformSuggestion: suggestionObj.platformLanguage || '（模型未生成平台语）',
    });
  } catch (e) {
    logAiUpstreamError('suggest-reply', parsed.data.ticketId, e);
    res.status(502).json({
      error: 'ai_error',
      message: e instanceof Error ? e.message : String(e),
    });
  }
});

const polishBody = z.object({
  ticketId: z.string().uuid(),
  draftText: z.string().min(1).max(50_000),
});

router.post('/polish', async (req: TenantRequest, res) => {
  const parsed = polishBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'bad_request', message: JSON.stringify(parsed.error.flatten()) });
    return;
  }
  if (!(await aiRateLimit(req))) {
    res.status(429).json({ error: 'rate_limit', message: 'Too many AI requests' });
    return;
  }

  const ticket = await loadTicketMessages(req.tenantId!, parsed.data.ticketId, req.userId);
  if (!ticket) {
    res.status(404).json({ error: 'not_found', message: 'Ticket not found' });
    return;
  }

  if (resolveLlmBackend() === 'none') {
    res.json({
      polished: `[Polished by AI] ${parsed.data.draftText.trim()} - We apologize for any inconvenience caused and appreciate your patience.`,
    });
    return;
  }

  const convo = ticket.messages.map((m) => `${m.senderType}: ${m.content}`).join('\n');
  const prompt = `你是专业客服润色助手。在保持原意的前提下，将下列草稿改写得更专业、有同理心、表达清晰，可直接发给买家。只输出润色后的正文，不要解释。

草稿：
"""
${parsed.data.draftText}
"""

上下文：
- 工单主题：${ticket.subject}
- 近期对话：
${convo}`;
  try {
    const polished = await llmComplete(prompt);
    audit.push({
      at: new Date().toISOString(),
      ticketId: ticket.id,
      userId: req.userId,
      op: 'polish',
    });
    res.json({ polished: polished || '（模型无返回）' });
  } catch (e) {
    logAiUpstreamError('polish', parsed.data.ticketId, e);
    res.status(502).json({
      error: 'ai_error',
      message: e instanceof Error ? e.message : String(e),
    });
  }
});

const recognizeBody = z.object({
  buyerFeedback: z.string().max(20_000).optional(),
  ticketId: z.string().uuid().optional(),
  maxRefund: z.number().optional(),
  currency: z.string().max(8).optional(),
});

router.post('/recognize-after-sales', async (req: TenantRequest, res) => {
  const parsed = recognizeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'bad_request', message: JSON.stringify(parsed.error.flatten()) });
    return;
  }
  if (!(await aiRateLimit(req))) {
    res.status(429).json({ error: 'rate_limit', message: 'Too many AI requests' });
    return;
  }

  const { buyerFeedback, ticketId, maxRefund, currency } = parsed.data;

  // 如果提供了 ticketId，则优先加载会话内容
  let conversationContext = '';
  if (ticketId) {
    const ticket = await loadTicketMessages(req.tenantId!, ticketId, req.userId);
    if (ticket) {
      conversationContext = ticket.messages
        .map((m) => `${m.senderType}: ${m.content}`)
        .join('\n')
        .slice(0, 10_000);
    }
  }

  const inputSource = conversationContext || buyerFeedback || '';
  if (!inputSource.trim()) {
    res.status(400).json({ error: 'bad_request', message: 'Neither buyerFeedback nor ticketId provided' });
    return;
  }

  if (resolveLlmBackend() === 'none') {
    const fb = inputSource.trim();
    const lower = fb.toLowerCase();
    let afterSalesType: string = '';
    if (/物流|发货|快递|tracking|ship|deliver|没收到|未收到|not received/i.test(fb)) {
      afterSalesType = 'logistics';
    } else if (/坏|破损|质量|defect|broken|quality/i.test(fb)) {
      afterSalesType = 'quality';
    } else if (/发错|wrong item|错发/i.test(fb)) {
      afterSalesType = 'wrong_item';
    } else if (/少|漏发|missing|缺件/i.test(fb)) {
      afterSalesType = 'missing_part';
    } else if (/不想要|改变主意|customer reason/i.test(fb)) {
      afterSalesType = 'customer_reason';
    }
    const wantsRefund = /退款|退费|refund|退钱/i.test(fb) || lower.includes('refund');
    audit.push({ at: new Date().toISOString(), userId: req.userId, op: 'recognize-after-sales_fallback' });
    res.json({
      result: {
        afterSalesType: afterSalesType || 'logistics',
        priority: wantsRefund ? 'high' : 'medium',
        processingType: wantsRefund ? 'refund' : 'return',
        refundAmount: null,
        summary: fb.slice(0, 200),
        hint: `（${llmUnconfiguredHint()}）以下为规则占位结果，配置 AI 后将由模型生成。`,
      },
    });
    return;
  }

  const prompt = `你是跨境电商售后助手。根据以下买家沟通内容或反馈文本，判断售后分类与处理建议。
如果是会话内容，请先总结买家反馈的核心问题。

${conversationContext ? `会话内容：\n"""\n${conversationContext}\n"""` : `买家反馈：\n"""\n${buyerFeedback}\n"""`}

订单上下文：${maxRefund != null ? `最大可退金额约 ${maxRefund} ${currency || 'USD'}` : '未知'}

请严格输出 JSON（不要 markdown），字段：
- summary: 用中文 1-2 句话总结买家反馈的问题点。
- afterSalesType: 必须是以下之一："" | "logistics" | "quality" | "wrong_item" | "missing_part" | "not_received" | "customer_reason"
- priority: "low" | "medium" | "high"
- processingType: "refund" | "return" | "exchange" | "reissue"
- refundAmount: 若文本明确提到退款数字则填数字，否则 null

规则：物流/延误/催单 -> logistics；质量问题 -> quality；发错货 -> wrong_item；少发漏发 -> missing_part；未收到货 -> not_received；买家主观不想要 -> customer_reason。`;

  try {
    const rawText = await llmComplete(prompt, { json: true });
    const raw = JSON.parse(rawText) as Record<string, unknown>;
    audit.push({ at: new Date().toISOString(), userId: req.userId, op: 'recognize-after-sales' });
    res.json({ result: raw });
  } catch (e) {
    logAiUpstreamError('recognize-after-sales', ticketId, e);
    res.status(502).json({
      error: 'ai_error',
      message: e instanceof Error ? e.message : String(e),
    });
  }
});

const summarizeMessagesBody = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().max(20_000),
      })
    )
    .min(1)
    .max(40),
});

router.post('/summarize-messages', async (req: TenantRequest, res) => {
  const parsed = summarizeMessagesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'bad_request', message: JSON.stringify(parsed.error.flatten()) });
    return;
  }
  if (!(await aiRateLimit(req))) {
    res.status(429).json({ error: 'rate_limit', message: 'Too many AI requests' });
    return;
  }

  if (resolveLlmBackend() === 'none') {
    audit.push({ at: new Date().toISOString(), userId: req.userId, op: 'summarize-messages_fallback' });
    res.json({
      summary: `（${llmUnconfiguredHint()}）建议：先处理未读与未回复队列，再跟进 SLA 临近工单。`,
    });
    return;
  }

  const lines = parsed.data.messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
  try {
    const summary = await llmComplete(
      `用中文 2～3 条要点总结下列对话或指令上下文（可含业务数据），末尾给一条可执行建议：\n\n${lines}`
    );
    audit.push({ at: new Date().toISOString(), userId: req.userId, op: 'summarize-messages' });
    res.json({ summary: summary || '（模型无返回）' });
  } catch (e) {
    logAiUpstreamError('summarize-messages', undefined, e);
    res.status(502).json({
      error: 'ai_error',
      message: e instanceof Error ? e.message : String(e),
    });
  }
});

const translateBody = z.object({
  text: z.string().min(1).max(50_000),
  targetLang: z.string().min(1).max(40),
  sourceLang: z.string().max(40).optional(),
});

const batchTranslateBody = z.object({
  messages: z.array(z.object({
    id: z.string(),
    content: z.string().min(1)
  })).min(1).max(50),
  targetLang: z.string().min(1).max(40),
});

router.post('/classify-intent', async (req: TenantRequest, res) => {
  const parsed = ticketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'bad_request', message: JSON.stringify(parsed.error.flatten()) });
    return;
  }
  if (!(await aiRateLimit(req))) {
    res.status(429).json({ error: 'rate_limit', message: 'Too many AI requests' });
    return;
  }

  const ticket = await loadTicketMessages(req.tenantId!, parsed.data.ticketId, req.userId);
  if (!ticket) {
    res.status(404).json({ error: 'not_found', message: 'Ticket not found' });
    return;
  }

  if (resolveLlmBackend() === 'none') {
    audit.push({
      at: new Date().toISOString(),
      ticketId: ticket.id,
      userId: req.userId,
      op: 'classify-intent_fallback',
    });
    res.json({ intent: ticket.intent?.trim() || '未分类' });
    return;
  }

  const conversationText = ticket.messages
    .map((m) => `${m.senderType}: ${m.content}`)
    .join('\n')
    .slice(0, 12_000);

  const prompt = buildClassifyIntentPrompt({
    subject: ticket.subject,
    subjectOriginal: ticket.subjectOriginal,
    conversationText,
  });

  try {
    const rawText = await llmComplete(prompt, { json: true });
    let intent = '未分类';
    try {
      const j = JSON.parse(rawText) as { intent?: unknown };
      if (typeof j.intent === 'string') {
        intent = normalizeClassifiedIntent(j.intent);
      }
    } catch {
      intent = normalizeClassifiedIntent(rawText);
    }
    audit.push({
      at: new Date().toISOString(),
      ticketId: ticket.id,
      userId: req.userId,
      op: 'classify-intent',
    });
    res.json({ intent });
  } catch (e) {
    logAiUpstreamError('classify-intent', parsed.data.ticketId, e);
    res.status(502).json({
      error: 'ai_error',
      message: e instanceof Error ? e.message : String(e),
    });
  }
});

router.post('/classify-sentiment', async (req: TenantRequest, res) => {
  const parsed = ticketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'bad_request', message: JSON.stringify(parsed.error.flatten()) });
    return;
  }
  if (!(await aiRateLimit(req))) {
    res.status(429).json({ error: 'rate_limit', message: 'Too many AI requests' });
    return;
  }

  const ticket = await loadTicketMessages(req.tenantId!, parsed.data.ticketId, req.userId);
  if (!ticket) {
    res.status(404).json({ error: 'not_found', message: 'Ticket not found' });
    return;
  }

  if (resolveLlmBackend() === 'none') {
    audit.push({
      at: new Date().toISOString(),
      ticketId: ticket.id,
      userId: req.userId,
      op: 'classify-sentiment_fallback',
    });
    res.json({
      sentiment: normalizeClassifiedSentiment(ticket.sentiment || 'neutral'),
    });
    return;
  }

  const conversationText = ticket.messages
    .map((m) => `${m.senderType}: ${m.content}`)
    .join('\n')
    .slice(0, 12_000);

  const prompt = `你是跨境电商客服助手。根据工单主题与对话内容，判断买家在当前会话中的整体情绪倾向。

工单主题：${ticket.subject ?? ''}
${ticket.subjectOriginal ? `原文主题：${ticket.subjectOriginal}\n` : ''}
对话（按时间顺序）：
${conversationText}

请严格输出 JSON（不要 markdown），格式：{ "sentiment": "angry" | "anxious" | "neutral" | "joyful" }
含义对应中文产品标签：
- angry：愤怒抱怨
- anxious：焦急催促
- neutral：平静中性
- joyful：开心满意

若信息不足，选 neutral。只输出 JSON。`;

  try {
    const rawText = await llmComplete(prompt, { json: true });
    let sentiment = 'neutral';
    try {
      const j = JSON.parse(rawText) as { sentiment?: unknown };
      if (typeof j.sentiment === 'string') {
        sentiment = normalizeClassifiedSentiment(j.sentiment);
      }
    } catch {
      sentiment = normalizeClassifiedSentiment(rawText);
    }
    audit.push({
      at: new Date().toISOString(),
      ticketId: ticket.id,
      userId: req.userId,
      op: 'classify-sentiment',
    });
    res.json({ sentiment });
  } catch (e) {
    logAiUpstreamError('classify-sentiment', parsed.data.ticketId, e);
    res.status(502).json({
      error: 'ai_error',
      message: e instanceof Error ? e.message : String(e),
    });
  }
});

router.post('/translate', async (req: TenantRequest, res) => {
  const parsed = translateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'bad_request', message: JSON.stringify(parsed.error.flatten()) });
    return;
  }
  if (!(await aiRateLimit(req))) {
    res.status(429).json({ error: 'rate_limit', message: 'Too many AI requests' });
    return;
  }

  if (resolveLlmBackend() === 'none') {
    audit.push({ at: new Date().toISOString(), userId: req.userId, op: 'translate_fallback' });
    res.json({
      translated: `（${llmUnconfiguredHint()}）[未调用模型] 原文：${parsed.data.text.slice(0, 500)}`,
    });
    return;
  }

  const { text, targetLang, sourceLang } = parsed.data;
  const prompt = `你是电商客服翻译。将下列文本翻译为「${targetLang}」。${sourceLang?.trim() ? `源语言倾向：${sourceLang}。` : ''}只输出译文，不要引号或解释。

原文：
"""
${text}
"""`;

  try {
    const translated = await llmComplete(prompt);
    audit.push({ at: new Date().toISOString(), userId: req.userId, op: 'translate' });
    res.json({ translated: translated || '（模型无返回）' });
  } catch (e) {
    logAiUpstreamError('translate', undefined, e);
    res.status(502).json({
      error: 'ai_error',
      message: e instanceof Error ? e.message : String(e),
    });
  }
});

router.post('/batch-translate', async (req: TenantRequest, res) => {
  const parsed = batchTranslateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'bad_request', message: JSON.stringify(parsed.error.flatten()) });
    return;
  }
  if (!(await aiRateLimit(req))) {
    res.status(429).json({ error: 'rate_limit', message: 'Too many AI requests' });
    return;
  }

  const { messages, targetLang } = parsed.data;

  if (resolveLlmBackend() === 'none') {
    const results: Record<string, string> = {};
    for (const m of messages) {
      results[m.id] = `（${llmUnconfiguredHint()}）[未调用模型] 原文：${m.content.slice(0, 50)}`;
    }
    res.json({ results });
    return;
  }

  // 构建批量 Prompt
  const itemsText = messages.map((m, idx) => `ID: ${m.id}\nContent: ${m.content}`).join('\n\n---\n\n');
  const prompt = `你是跨境电商客服翻译专家。请将以下多条客服/买家消息翻译为「${targetLang}」。
这些消息属于同一个工单对话上下文，请确保术语统一、人称代词指代准确。

### 待翻译消息列表：
${itemsText}

### 要求：
1. 严格返回 JSON 格式数据。
2. JSON 的键为消息的 ID，值为对应的译文。
3. 只翻译内容，不要添加解释或引号。
4. 格式示例：{"id-1": "译文1", "id-2": "译文2"}`;

  try {
    const rawText = await llmComplete(prompt, { json: true });
    let results: Record<string, string> = {};
    try {
      results = JSON.parse(rawText);
    } catch {
      // 容错：如果 AI 没有返回纯 JSON，尝试正则提取
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) results = JSON.parse(match[0]);
    }
    
    audit.push({ at: new Date().toISOString(), userId: req.userId, op: 'batch_translate' });
    res.json({ results });
  } catch (e) {
    logAiUpstreamError('batch-translate', undefined, e);
    res.status(502).json({
      error: 'ai_error',
      message: e instanceof Error ? e.message : String(e),
    });
  }
});

router.get('/audit', (_req, res) => {
  res.json({ items: audit.slice(-200), provider: resolveLlmBackend() });
});

export default router;
