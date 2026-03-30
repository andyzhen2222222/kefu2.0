import { Router } from 'express';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '../lib/prisma.js';
import type { TenantRequest } from '../middleware/tenant.js';

const router = Router();

const body = z.object({ ticketId: z.string().uuid() });

/** 简单内存限流：每用户每分钟 20 次 */
const buckets = new Map<string, { n: number; reset: number }>();
function rateLimit(key: string, max = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.reset) {
    b = { n: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.n += 1;
  return b.n <= max;
}

const audit: { at: string; ticketId: string; userId: string | null; op: string }[] = [];

router.post('/summarize', async (req: TenantRequest, res) => {
  const parsed = body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'bad_request', message: parsed.error.flatten().toString() });
    return;
  }
  const key = `${req.userId ?? 'anon'}:${req.tenantId}`;
  if (!rateLimit(key)) {
    res.status(429).json({ error: 'rate_limit', message: 'Too many AI requests' });
    return;
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id: parsed.data.ticketId, tenantId: req.tenantId! },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 80 } },
  });
  if (!ticket) {
    res.status(404).json({ error: 'not_found', message: 'Ticket not found' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const fallback = ticket.messages.map((m) => m.content).join('\n').slice(0, 500);
    audit.push({
      at: new Date().toISOString(),
      ticketId: ticket.id,
      userId: req.userId,
      op: 'summarize_fallback',
    });
    res.json({
      summary: fallback ? `（未配置 GEMINI_API_KEY）会话摘录：${fallback}` : '无内容可摘要',
    });
    return;
  }

  const ai = new GoogleGenAI({ apiKey });
  const text = ticket.messages.map((m) => `${m.senderType}: ${m.content}`).join('\n');
  try {
    const r = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `用中文 3 句话总结以下客服工单对话：\n${text}`,
    });
    const summary = r.text ?? '';
    audit.push({
      at: new Date().toISOString(),
      ticketId: ticket.id,
      userId: req.userId,
      op: 'summarize',
    });
    res.json({ summary: summary || '（模型无返回）' });
  } catch (e) {
    res.status(502).json({
      error: 'ai_error',
      message: e instanceof Error ? e.message : String(e),
    });
  }
});

router.post('/suggest-reply', async (req: TenantRequest, res) => {
  const parsed = body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'bad_request', message: parsed.error.flatten().toString() });
    return;
  }
  const key = `${req.userId ?? 'anon'}:${req.tenantId}`;
  if (!rateLimit(key)) {
    res.status(429).json({ error: 'rate_limit', message: 'Too many AI requests' });
    return;
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id: parsed.data.ticketId, tenantId: req.tenantId! },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 80 } },
  });
  if (!ticket) {
    res.status(404).json({ error: 'not_found', message: 'Ticket not found' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    audit.push({
      at: new Date().toISOString(),
      ticketId: ticket.id,
      userId: req.userId,
      op: 'suggest_fallback',
    });
    res.json({
      suggestion: '（未配置 GEMINI_API_KEY）请根据工单主题手动回复买家。',
    });
    return;
  }

  const ai = new GoogleGenAI({ apiKey });
  const text = ticket.messages.map((m) => `${m.senderType}: ${m.content}`).join('\n');
  try {
    const r = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `你是跨境电商客服。根据对话写一段专业、简短的中文回复草稿（可直接发送）：\n主题：${ticket.subject}\n\n${text}`,
    });
    const suggestion = r.text ?? '';
    audit.push({
      at: new Date().toISOString(),
      ticketId: ticket.id,
      userId: req.userId,
      op: 'suggest-reply',
    });
    res.json({ suggestion: suggestion || '（模型无返回）' });
  } catch (e) {
    res.status(502).json({
      error: 'ai_error',
      message: e instanceof Error ? e.message : String(e),
    });
  }
});

router.get('/audit', (_req, res) => {
  res.json({ items: audit.slice(-200) });
});

export default router;
