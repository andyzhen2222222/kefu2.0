import { prisma } from '../lib/prisma.js';
import { llmComplete, resolveLlmBackend } from '../lib/llmClient.js';
import {
  buildClassifyIntentAndSentimentPrompt,
  normalizeClassifiedIntent,
  normalizeClassifiedSentiment,
} from '../lib/ticketIntentLabels.js';

/**
 * 批量对工单跑意图 + 情绪（单条 LLM 调用），用于收件箱「同步」后刷新 AI 字段。
 */
export async function batchEnrichTicketIntentSentiment(
  tenantId: string,
  maxTickets: number
): Promise<{ updated: number; skippedNoLlm: number; failed: number }> {
  if (resolveLlmBackend() === 'none') {
    return { updated: 0, skippedNoLlm: Math.min(maxTickets, 100), failed: 0 };
  }

  const cap = Math.max(1, Math.min(maxTickets, 100));
  const tickets = await prisma.ticket.findMany({
    where: { tenantId },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 80 } },
    orderBy: { updatedAt: 'desc' },
    take: cap,
  });

  let updated = 0;
  let failed = 0;

  for (const t of tickets) {
    if (t.messages.length === 0) continue;

    const conversationText = t.messages
      .map((m) => `${m.senderType}: ${m.content}`)
      .join('\n')
      .slice(0, 12_000);

    const prompt = buildClassifyIntentAndSentimentPrompt({
      subject: t.subject,
      subjectOriginal: t.subjectOriginal,
      conversationText,
    });

    try {
      const rawText = await llmComplete(prompt, { json: true });
      let intent = '未分类';
      let sentiment = 'neutral';
      try {
        const j = JSON.parse(rawText) as { intent?: unknown; sentiment?: unknown };
        if (typeof j.intent === 'string') intent = normalizeClassifiedIntent(j.intent);
        if (typeof j.sentiment === 'string') sentiment = normalizeClassifiedSentiment(j.sentiment);
      } catch {
        intent = normalizeClassifiedIntent(rawText);
      }

      await prisma.ticket.update({
        where: { id: t.id },
        data: { intent, sentiment },
      });
      updated++;
    } catch {
      failed++;
    }
  }

  return {
    updated,
    skippedNoLlm: 0,
    failed,
  };
}
