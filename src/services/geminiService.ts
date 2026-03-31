import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AfterSalesType, Ticket, Message, Order } from "../types";
import {
  intellideskConfigured,
  intellideskTenantId,
  intellideskUserIdForApi,
  postAiSuggestReply,
} from "./intellideskApi";

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

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

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
  try {
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

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    if (response.text) {
      return JSON.parse(response.text.trim());
    }
    return null;
  } catch (error) {
    console.error("AI Suggestion Error:", error);
    return null;
  }
}

export async function generateReplySuggestion(
  ticket: Ticket,
  messages: Message[],
  order?: Order,
  authUserId?: string | null
): Promise<string | null> {
  if (intellideskConfigured()) {
    try {
      const tenantId = intellideskTenantId();
      const userId = intellideskUserIdForApi(authUserId);
      const { suggestion } = await postAiSuggestReply(tenantId, userId, ticket.id);
      return suggestion?.trim() || null;
    } catch (error) {
      console.error("AI Reply Suggestion Error (API):", error);
      return null;
    }
  }

  try {
    const prompt = `
      You are an intelligent customer service assistant. Generate a professional, helpful, and concise reply to the customer based on the following context.
      
      Ticket Subject: ${ticket.subject}
      Ticket Status: ${ticket.status}
      
      Order Info: ${order ? `Order #${order.platformOrderId}, Status: ${order.shippingStatus}, Amount: ${order.currency} ${order.amount}` : 'No order linked'}
      
      Conversation History:
      ${messages.map(m => `${m.senderType.toUpperCase()}: ${m.content}`).join('\n')}
      
      Task:
      Generate a draft reply that addresses the customer's most recent concern. If there's an order issue, acknowledge it and provide relevant info if available. Keep it under 150 words.
      
      Return ONLY the reply text.
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text?.trim() || null;
  } catch (error) {
    console.error("AI Reply Suggestion Error:", error);
    return null;
  }
}

/**
 * 根据买家反馈文本识别售后类型、优先级、处理方式等；API 不可用时回退本地规则。
 */
export async function recognizeAfterSalesFromFeedback(
  buyerFeedback: string,
  options?: { maxRefund?: number; currency?: string }
): Promise<AfterSalesRecognitionResult> {
  const trimmed = buyerFeedback.trim();
  if (!trimmed) {
    return {
      afterSalesType: "",
      priority: "medium",
      processingType: AfterSalesType.REFUND,
    };
  }

  const fallback = () => mockRecognizeAfterSales(trimmed);

  try {
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

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    if (response.text) {
      try {
        const raw = JSON.parse(response.text.trim()) as Record<string, unknown>;
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
      } catch {
        /* JSON 非预期时走本地规则 */
      }
    }
  } catch (error) {
    console.error("recognizeAfterSalesFromFeedback:", error);
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

export async function summarizeTicket(messages: { role: string; content: string }[]): Promise<string | null> {
  try {
    const prompt = `
      Summarize the following customer service conversation in 2-3 concise bullet points.
      
      Conversation:
      ${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text || null;
  } catch (error) {
    console.error("AI Summary Error:", error);
    return null;
  }
}
