import { AfterSalesType, Ticket, Message, Order } from "../types";
import {
  intellideskConfigured,
  intellideskTenantId,
  intellideskUserIdForApi,
  formatAiUserVisibleError,
  postAiPolish,
  postAiRecognizeAfterSales,
  postAiSuggestReply,
  postAiSummarize,
  postAiSummarizeMessages,
  type AiPolishTone,
  type AiPolishStyle,
} from "./intellideskApi";
import { frontendLlmComplete } from "@/src/lib/llmClient";

/** 与提交售后表单「售后类型」下拉 value 一致 */
export type AfterSalesCategoryValue =
  | ""
  | "logistics"
  | "quality"
  | "wrong_item"
  | "missing_part"
  | "not_received"
  | "customer_reason";

export interface AfterSalesRecognitionResult {
  afterSalesType: AfterSalesCategoryValue;
  priority: "low" | "medium" | "high";
  processingType: AfterSalesType;
  refundAmount?: number | null;
  summary?: string;
}

function mockRecognizeAfterSales(text: string): AfterSalesRecognitionResult {
  const t = text.toLowerCase();
  let afterSalesType: AfterSalesCategoryValue = "";
  if (/物流|延误|迟到|慢|没发货|催单/.test(text)) afterSalesType = "logistics";
  else if (/质量|坏|破|划痕|瑕疵/.test(text) || /quality|defective/.test(t)) afterSalesType = "quality";
  else if (/错发|发错|颜色不对|尺码错|不是我要的/.test(text)) afterSalesType = "wrong_item";
  else if (/少发|漏发|缺件|少件/.test(text)) afterSalesType = "missing_part";
  else if (/没收到|未到|丢失|丢件/.test(text)) afterSalesType = "not_received";
  else if (/不要|退[货款]?|不想要|取消/.test(text)) afterSalesType = "customer_reason";

  let priority: "low" | "medium" | "high" = "medium";
  if (/急|投诉|律师|差评|urgent|asap/.test(t)) priority = "high";
  else if (/谢谢|请问|咨询/.test(text) && !/退|坏|没收到/.test(text)) priority = "low";

  let processingType = AfterSalesType.REFUND;
  if (/换货|换一|换个大|exchange/.test(text) || /exchange/.test(t)) processingType = AfterSalesType.EXCHANGE;
  else if (/退货|退回|return/.test(text) || /return/.test(t)) processingType = AfterSalesType.RETURN;
  else if (/重发|补发|resend|reissue/.test(text) || /reissue|resend/.test(t)) processingType = AfterSalesType.REISSUE;

  const amtMatch = text.match(/(\d+(\.\d+)?)\s*(usd|\$|美元|美金|元)?/i);
  const refundAmount = amtMatch ? parseFloat(amtMatch[1]) : null;

  return {
    afterSalesType,
    priority,
    processingType,
    refundAmount: Number.isFinite(refundAmount as number) ? refundAmount : null,
  };
}

function mapRawToAfterSalesResult(
  raw: Record<string, unknown>,
  options?: { maxRefund?: number }
): AfterSalesRecognitionResult {
  const allowed: AfterSalesCategoryValue[] = [
    "",
    "logistics",
    "quality",
    "wrong_item",
    "missing_part",
    "not_received",
    "customer_reason",
  ];
  const at = allowed.includes(raw.afterSalesType as AfterSalesCategoryValue)
    ? (raw.afterSalesType as AfterSalesCategoryValue)
    : "";
  const pr = ["low", "medium", "high"].includes(raw.priority as string)
    ? (raw.priority as "low" | "medium" | "high")
    : "medium";
  const ptMap: Record<string, AfterSalesType> = {
    refund: AfterSalesType.REFUND,
    return: AfterSalesType.RETURN,
    exchange: AfterSalesType.EXCHANGE,
    reissue: AfterSalesType.REISSUE,
  };
  const pt =
    ptMap[String(raw.processingType).toLowerCase()] ?? AfterSalesType.REFUND;
  let refundAmount: number | null = null;
  if (raw.refundAmount != null && raw.refundAmount !== "") {
    const n = Number(raw.refundAmount);
    if (Number.isFinite(n)) refundAmount = n;
  }
  if (
    options?.maxRefund != null &&
    refundAmount != null &&
    refundAmount > options.maxRefund
  ) {
    refundAmount = options.maxRefund;
  }
  return { afterSalesType: at, priority: pr, processingType: pt, refundAmount };
}

export interface AISuggestion {
  reply: string;
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  classification: string;
  confidence: number;
  sources: string[];
}

export async function getAISuggestion(
  ticketSubject: string,
  messages: { role: string; content: string }[],
  orderInfo?: string,
  customerInfo?: string,
  knowledgeBase?: string
): Promise<AISuggestion | null> {
  const prompt = `
      You are an intelligent customer service assistant for a cross-border e-commerce platform.
      
      Context:
      - Ticket Subject: ${ticketSubject}
      - Order Info: ${orderInfo || 'N/A'}
      - Customer Info: ${customerInfo || 'N/A'}
      - Knowledge Base Context: ${knowledgeBase || 'N/A'}
      
      Conversation History:
      ${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
      
      Task:
      1. Summarize the current situation.
      2. Classify the ticket (e.g., Refund Request, Shipping Inquiry, Product Question).
      3. Analyze the customer's sentiment.
      4. Generate a professional, helpful draft reply to the customer.
      5. Provide a confidence score (0-1) for the generated reply.
      
      Return the response in JSON format with the following structure:
      {
        "reply": "...",
        "summary": "...",
        "sentiment": "...",
        "classification": "...",
        "confidence": 0.95,
        "sources": ["..."]
      }
    `;

  const text = await frontendLlmComplete(prompt, { json: true });
  if (!text) return null;
  try {
    return JSON.parse(text.trim()) as AISuggestion;
  } catch {
    return null;
  }
}

export interface KnowledgeBaseTrialSnippet {
  title: string;
  body: string;
}

/**
 * 设置 → 知识库「AI 回答试测」：结合命中的知识片段生成预览回复，供租户评估回答质量。
 */
export async function previewKnowledgeBaseTrialAnswer(
  buyerQuestion: string,
  snippets: KnowledgeBaseTrialSnippet[]
): Promise<string> {
  const trimmedQ = buyerQuestion.trim();
  const ctx =
    snippets.length > 0
      ? snippets
          .map((s, i) => `【片段${i + 1}】${s.title}\n${s.body}`)
          .join('\n\n')
      : '（当前未检索到知识库片段：请给出礼貌、简短的通用客服回复，并建议买家补充订单号或具体情况，避免编造政策。）';

  const prompt = `你是跨境电商智能客服助手。租户正在「知识库」里测试：请根据下方「知识片段」回答「买家问题」，用于评估 AI 回答质量与知识覆盖。
规则：仅用片段中的事实；不得编造退款比例、时效等具体政策数字。若片段不足以具体答复，须明确说明需人工核实或请买家提供信息。
使用简体中文，语气专业友好，篇幅不超过 220 字。

买家问题：
${trimmedQ}

知识片段：
${ctx}

请直接输出拟发送给买家的回复正文，不要标题、不要使用 JSON。`;

  const out = await frontendLlmComplete(prompt);
  if (out?.trim()) return out.trim();

  const ref = snippets[0]?.title ? `建议结合「${snippets[0].title}」等依据人工核对后回复。` : '';
  return `【暂时无法生成智能预览】当前未能连接回复生成服务，请稍后再试或由管理员检查系统设置。${ref}`;
}

export interface ReplySuggestionResult {
  suggestion: string;
  platformSuggestion?: string;
}

export async function generateReplySuggestion(
  ticket: Ticket,
  messages: Message[],
  order?: Order,
  authUserId?: string | null
): Promise<ReplySuggestionResult | null> {
  if (intellideskConfigured()) {
    try {
      const tenantId = intellideskTenantId();
      const userId = intellideskUserIdForApi(authUserId);
      const res = await postAiSuggestReply(tenantId, userId, ticket.id);
      return {
        suggestion: res.suggestion?.trim() || "",
        platformSuggestion: res.platformSuggestion?.trim(),
      };
    } catch (error) {
      console.error("AI Reply Suggestion Error (API):", error);
      return {
        suggestion: `[Mock API AI 生成] Hello! Thank you for reaching out regarding "${ticket.subject}". I have checked your order ${order ? `(#${order.platformOrderId})` : ""} and I understand you are experiencing issues. How can I further assist you with a refund or replacement today?`,
        platformSuggestion: `Hello! Thank you for reaching out regarding "${ticket.subject}". I have checked your order ${order ? `(#${order.platformOrderId})` : ""} and I understand you are experiencing issues. How can I further assist you with a refund or replacement today?`,
      };
    }
  }

  const prompt = `
      You are an intelligent customer service assistant. Generate a professional, helpful, and concise reply to the customer based on the following context.
      
      Ticket Subject: ${ticket.subject}
      Ticket Status: ${ticket.status}
      
      Order Info: ${order ? `Order #${order.platformOrderId}, Status: ${order.shippingStatus}, Amount: ${order.currency} ${order.amount}` : "No order linked"}
      
      Conversation History:
      ${messages.map((m) => `${m.senderType.toUpperCase()}: ${m.content}`).join("\n")}
      
      Task:
      Generate a draft reply that addresses the customer's most recent concern. If there's an order issue, acknowledge it and provide relevant info if available. Keep it under 150 words.
      
      Return ONLY the reply text.
    `;

  const out = await frontendLlmComplete(prompt);
  if (out?.trim()) {
    return {
      suggestion: out.trim(),
      platformSuggestion: out.trim(),
    };
  }

  const defaultText = `Hello! Thank you for reaching out regarding "${ticket.subject}". I have checked your order ${order ? `(#${order.platformOrderId})` : ""} and I understand you are experiencing issues. How can I further assist you with a refund or replacement today?`;
  return {
    suggestion: defaultText,
    platformSuggestion: defaultText,
  };
}

/** 与后端 `buildPolishToneBlock` / `buildPolishStyleBlock` 文案保持一致 */
function frontendPolishToneBlock(tone: AiPolishTone): string {
  switch (tone) {
    case 'warm_friendly':
      return '【语气】温馨友好：日常咨询与一般安抚；亲切、有同理心，避免生硬套话，不过度煽情。';
    case 'professional_formal':
      return '【语气】专业正式：技术说明、账户/订单规则、流程与权限；客观、准确、可核对，少用口语与表情化表达。';
    case 'concise_clear':
      return '【语气】简洁干练：只保留结论、关键事实与下一步动作；短句为主，删冗余客套与重复信息。';
    case 'apologetic':
      return '【语气】诚恳致歉：承认我方疏失、延误或体验不佳；真诚道歉并给出可执行的补救或明确跟进，不辩解、不甩锅。';
    case 'auto':
    default:
      return '【语气】请根据工单主题与客户近期表述自动选择合适语气。若情境不够明确，则：请使用友好的语气，简洁且不失温暖。';
  }
}

function frontendPolishStyleBlock(style: AiPolishStyle): string {
  switch (style) {
    case 'reassure':
      return '【风格】安抚客户：当客户有抱怨或困惑时，使用温和的措辞安抚情绪。';
    case 'solution_oriented':
      return '【风格】解决方案导向：提供实际的解决方案并承诺跟进。';
    case 'auto':
    default:
      return '【风格】请根据不同情境自动优化表达方式。若情境不够明确，则：将语言优化为直接解决客户问题，避免过多的修饰和选项。';
  }
}

export async function generateReplyPolish(
  currentText: string,
  ticket: Ticket,
  messages: Message[],
  order?: Order,
  authUserId?: string | null,
  polish?: { tone?: AiPolishTone; style?: AiPolishStyle }
): Promise<string | null> {
  if (!currentText.trim()) return null;

  const tone = polish?.tone ?? 'auto';
  const style = polish?.style ?? 'auto';

  if (intellideskConfigured()) {
    try {
      const tenantId = intellideskTenantId();
      const userId = intellideskUserIdForApi(authUserId);
      const { polished } = await postAiPolish(tenantId, userId, ticket.id, currentText, {
        tone,
        style,
      });
      return polished?.trim() || null;
    } catch (error) {
      console.error("AI Reply Polish Error (API):", error);
    }
  }

  const extraZh = `${frontendPolishToneBlock(tone)}\n\n${frontendPolishStyleBlock(style)}`;

  const prompt = `
      You are a professional customer service assistant. Polish and rewrite the following draft while preserving meaning. Follow the tone and style requirements given in Chinese below exactly.

      ${extraZh}

      Original Draft: 
      """
      ${currentText}
      """
      
      Context:
      - Ticket Subject: ${ticket.subject}
      - Order Info: ${order ? `Order #${order.platformOrderId}, Status: ${order.shippingStatus}` : 'No order linked'}
      
      Conversation History:
      ${messages.map(m => `${m.senderType.toUpperCase()}: ${m.content}`).join('\n')}
      
      Return ONLY the polished reply text (same language as the draft unless context clearly requires otherwise).
    `;

  const out = await frontendLlmComplete(prompt);
  if (out?.trim()) return out.trim();

  return `[Polished by AI] ${currentText.trim()} - We apologize for any inconvenience caused and appreciate your patience.`;
}

/**
 * 根据买家反馈文本或工单 ID 识别售后类型、优先级、处理方式等；API 不可用时回退本地规则。
 */
export async function recognizeAfterSalesFromFeedback(
  buyerFeedback?: string,
  options?: { ticketId?: string; maxRefund?: number; currency?: string; onApiFailure?: (msg: string) => void }
): Promise<AfterSalesRecognitionResult> {
  const trimmed = buyerFeedback?.trim();
  if (!trimmed && !options?.ticketId) {
    return {
      afterSalesType: "",
      priority: "medium",
      processingType: AfterSalesType.REFUND,
    };
  }

  const fallback = () => mockRecognizeAfterSales(trimmed || "");

  if (intellideskConfigured()) {
    try {
      const tenantId = intellideskTenantId();
      const userId = intellideskUserIdForApi(undefined);
      const { result } = await postAiRecognizeAfterSales(tenantId, userId, {
        buyerFeedback: trimmed,
        ticketId: options?.ticketId,
        maxRefund: options?.maxRefund,
        currency: options?.currency,
      });
      const mapped = mapRawToAfterSalesResult(result, options);
      if (typeof result.summary === 'string') mapped.summary = result.summary;
      return mapped;
    } catch (e) {
      console.error("recognizeAfterSalesFromFeedback (API):", e);
      options?.onApiFailure?.(formatAiUserVisibleError(e));
      const mock = fallback();
      if (
        options?.maxRefund != null &&
        mock.refundAmount != null &&
        mock.refundAmount > options.maxRefund
      ) {
        mock.refundAmount = options.maxRefund;
      }
      return mock;
    }
  }

  const prompt = `
你是跨境电商售后助手。根据买家反馈文本，判断售后分类与处理建议。

买家反馈：
"""
${trimmed}
"""

订单上下文：${options?.maxRefund != null ? `最大可退金额约 ${options.maxRefund} ${options?.currency || "USD"}` : "未知"}

请严格输出 JSON（不要 markdown），字段：
- afterSalesType: 必须是以下之一："" | "logistics" | "quality" | "wrong_item" | "missing_part" | "not_received" | "customer_reason"
- priority: "low" | "medium" | "high"
- processingType: "refund" | "return" | "exchange" | "reissue"（与 AfterSales 处理方式一致）
- refundAmount: 若文本明确提到退款数字则填数字，否则 null

规则：物流/延误/催单 -> logistics；质量问题 -> quality；发错货 -> wrong_item；少发漏发 -> missing_part；未收到货 -> not_received；买家主观不想要 -> customer_reason。
`;

  const responseText = await frontendLlmComplete(prompt, { json: true });
  if (responseText) {
    try {
      const raw = JSON.parse(responseText.trim()) as Record<string, unknown>;
      return mapRawToAfterSalesResult(raw, options);
    } catch {
      /* JSON 非预期时走本地规则 */
    }
  }

  const mock = fallback();
  if (
    options?.maxRefund != null &&
    mock.refundAmount != null &&
    mock.refundAmount > options.maxRefund
  ) {
    mock.refundAmount = options.maxRefund;
  }
  return mock;
}

/** 基于工单会话调用后端 POST /api/ai/summarize */
export async function summarizeTicketById(
  ticketId: string,
  userId?: string | null
): Promise<string | null> {
  if (!intellideskConfigured()) return null;
  const { summary } = await postAiSummarize(
    intellideskTenantId(),
    intellideskUserIdForApi(userId ?? undefined),
    ticketId
  );
  return summary?.trim() || null;
}

export async function summarizeTicket(messages: { role: string; content: string }[]): Promise<string | null> {
  const normalized = messages.map((m) => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.content,
  }));

  if (intellideskConfigured()) {
    try {
      const tenantId = intellideskTenantId();
      const userId = intellideskUserIdForApi(undefined);
      const { summary } = await postAiSummarizeMessages(tenantId, userId, normalized);
      return summary || null;
    } catch (e) {
      console.error("summarizeTicket (API):", e);
      throw e;
    }
  }

  const prompt = `
      Summarize the following customer service conversation in 2-3 concise bullet points.
      
      Conversation:
      ${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
    `;

  return frontendLlmComplete(prompt);
}
