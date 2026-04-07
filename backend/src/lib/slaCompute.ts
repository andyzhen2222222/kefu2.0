import { prisma } from './prisma.js';

type SlaRuleCondition = {
  calendar?: 'natural' | 'weekdays';
  [key: string]: unknown;
};

export async function computeSlaDueAtForTicket(
  tenantId: string,
  channel: { id: string; displayName: string; platformType: string | null },
  createdAt: Date
): Promise<Date> {
  const rules = await prisma.slaRule.findMany({
    where: { tenantId, enabled: true },
    orderBy: { createdAt: 'asc' },
  });

  let matchedRule = null;

  for (const rule of rules) {
    let matchesChannel = true;
    if (rule.channelPattern) {
      const pattern = rule.channelPattern.replace(/%/g, '').toLowerCase();
      const nameMatch = channel.displayName.toLowerCase().includes(pattern);
      const typeMatch = channel.platformType ? channel.platformType.toLowerCase().includes(pattern) : false;
      if (!nameMatch && !typeMatch) {
        matchesChannel = false;
      }
    }

    if (matchesChannel) {
      matchedRule = rule;
      break;
    }
  }

  const timeoutHours = matchedRule?.timeoutHours ?? 24;
  let isNatural = true;

  if (matchedRule?.conditions && typeof matchedRule.conditions === 'object') {
    const cond = matchedRule.conditions as SlaRuleCondition;
    if (cond.calendar === 'weekdays') {
      isNatural = false;
    }
  }

  return calculateDueAt(createdAt, timeoutHours, isNatural);
}

function calculateDueAt(start: Date, timeoutHours: number, isNatural: boolean): Date {
  if (isNatural) {
    return new Date(start.getTime() + timeoutHours * 3600000);
  }

  let remainingHours = timeoutHours;
  const current = new Date(start);

  while (remainingHours > 0) {
    current.setTime(current.getTime() + 3600000);
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      remainingHours--;
    }
  }

  return current;
}
