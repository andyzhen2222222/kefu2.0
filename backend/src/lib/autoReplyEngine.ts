import { randomUUID } from 'crypto';
import { TicketStatus } from '@prisma/client';
import { prisma } from './prisma.js';
import { replyToConversationInMotherSystem } from '../services/motherSystemSync.js';
import { broadcastTenant } from './wsHub.js';
import { mapMessage, mapTicket } from '../dto/mappers.js';
import {
  parseAfterSalesTypeFromIntentMatch,
  ticketIntentMatchesAfterSalesType,
} from './autoReplyAfterSalesMatch.js';
import { parseTimeIntentMatch, isNowInTimeRange } from './autoReplyTime.js';
import { evaluateAutoReplyConditions, isAutoReplyConditionsV1 } from './autoReplyConditions.js';

/**
 * 母系统入站消息写入后：按租户规则尝试自动回复并发往哪吒会话。
 */
export async function triggerAutoReplyIfNeeded(
  tenantId: string,
  ticketId: string,
  messageContent: string,
  ticketIntent: string
) {
  const rules = await prisma.autoReplyRule.findMany({
    where: { tenantId, enabled: true },
    orderBy: { createdAt: 'desc' },
  });
  if (rules.length === 0) return;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { channel: true, customer: true, order: true },
  });
  if (!ticket?.externalId?.trim()) return;

  const token = process.env.NEZHA_API_TOKEN?.trim() || '';
  if (!token) {
    console.warn('[AutoReply] NEZHA_API_TOKEN 未配置，跳过自动回复');
    return;
  }

  const intentTrim = (ticketIntent || '').trim();

  for (const rule of rules) {
    let matched = false;

    const rawJson = rule.conditionsJson;
    if (rawJson != null && isAutoReplyConditionsV1(rawJson)) {
      matched = evaluateAutoReplyConditions(rawJson, { messageContent, ticketIntent: intentTrim });
    } else {
      if (rule.keywords.length > 0) {
        const lower = messageContent.toLowerCase();
        if (rule.keywords.some((kw) => lower.includes(String(kw).toLowerCase()))) {
          matched = true;
        }
      }

      if (!matched && rule.intentMatch) {
        const timeParsed = parseTimeIntentMatch(rule.intentMatch);
        if (timeParsed) {
          if (isNowInTimeRange(timeParsed.preset, timeParsed.timeRange)) matched = true;
        } else {
          const asType = parseAfterSalesTypeFromIntentMatch(rule.intentMatch);
          if (asType) {
            if (ticketIntentMatchesAfterSalesType(intentTrim, asType)) matched = true;
          } else if (intentTrim && rule.intentMatch.trim() === intentTrim) {
            matched = true;
          }
        }
      }
    }

    if (!matched) continue;

    const replyText = rule.replyContent?.trim();
    if (!replyText) continue;

    const buyerName = ticket.customer?.name?.trim() || '买家';
    const orderNo = ticket.order?.platformOrderId?.trim() || ticket.orderId || '';
    const tracking = ticket.order?.trackingNumber?.trim() || '';

    const finalReply = replyText
      .replace(/{买家姓名}/g, buyerName)
      .replace(/{订单号}/g, orderNo)
      .replace(/{物流单号}/g, tracking);

    try {
      await replyToConversationInMotherSystem(token, ticket.externalId.trim(), {
        content: finalReply,
      });

      const msg = await prisma.message.create({
        data: {
          id: randomUUID(),
          ticketId,
          senderId: 'system-auto-reply',
          senderType: 'ai',
          content: finalReply,
          isInternal: false,
          createdAt: new Date(),
        },
      });

      const updateData: {
        updatedAt: Date;
        status?: TicketStatus;
        messageProcessingStatus?: string;
        resolvedAt?: Date | null;
        firstResponseAt?: Date;
      } = { updatedAt: new Date() };

      if (rule.markRepliedOnSend) {
        updateData.status = TicketStatus.resolved;
        updateData.messageProcessingStatus = 'replied';
        updateData.resolvedAt = new Date();
        if (!ticket.firstResponseAt) updateData.firstResponseAt = new Date();
      }

      const updatedTicketRow = await prisma.ticket.update({
        where: { id: ticketId },
        data: updateData,
        include: { channel: true, customer: true, order: true },
      });

      broadcastTenant(tenantId, {
        type: 'message_created',
        ticketId,
        message: mapMessage(msg),
      });
      broadcastTenant(tenantId, {
        type: 'ticket_updated',
        ticket: mapTicket(updatedTicketRow),
      });

      console.log(`[AutoReply] Rule "${rule.name}" triggered for ticket ${ticketId}`);
      break;
    } catch (err) {
      console.error(`[AutoReply] Failed for rule "${rule.name}":`, err);
    }
  }
}
