import { prisma } from '../src/lib/prisma.js';
import { resolveTicketVisibility, ticketVisibilityWhereClause } from '../src/lib/ticketRoutingAssign.js';
import { UserRole } from '@prisma/client';

async function runTest() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) return;

  console.log('--- Setting up test data ---');
  await prisma.agentSeat.deleteMany({ where: { email: { in: ['test-agent1@demo.local', 'test-agent2@demo.local'] } } });
  await prisma.ticketRoutingRule.deleteMany({ where: { name: { startsWith: 'Test Rule' } } });

  const agent1Email = 'test-agent1@demo.local';
  const agent2Email = 'test-agent2@demo.local';

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: agent1Email } }, update: {},
    create: { id: 'test-user-1', tenantId: tenant.id, email: agent1Email, role: UserRole.agent, name: 'Agent 1', passwordHash: '123' }
  });
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: agent2Email } }, update: {},
    create: { id: 'test-user-2', tenantId: tenant.id, email: agent2Email, role: UserRole.agent, name: 'Agent 2', passwordHash: '123' }
  });

  const seat1 = await prisma.agentSeat.create({
    data: { id: 'test-seat-1', tenantId: tenant.id, email: agent1Email, account: 'agent1', displayName: 'Agent 1', roleId: 'role-agent', status: 'active' }
  });
  const seat2 = await prisma.agentSeat.create({
    data: { id: 'test-seat-2', tenantId: tenant.id, email: agent2Email, account: 'agent2', displayName: 'Agent 2', roleId: 'role-agent', status: 'active' }
  });

  const channels = await prisma.channel.findMany({ where: { tenantId: tenant.id }, take: 2 });
  const [ch1, ch2] = channels;

  await prisma.ticketRoutingRule.create({
    data: { tenantId: tenant.id, name: 'Test Rule 1 (Seat 1 -> Ch 1)', priority: 10, targetSeatId: seat1.id, enabled: true, conditions: { channelIds: [ch1.id] } }
  });
  
  await prisma.ticketRoutingRule.create({
    data: { tenantId: tenant.id, name: 'Test Rule 2 (Seat 2 -> Ch 2)', priority: 10, targetSeatId: seat2.id, enabled: true, conditions: { channelIds: [ch2.id] } }
  });

  const customer = await prisma.customer.findFirst({ where: { tenantId: tenant.id } });
  
  if (customer) {
    await prisma.ticket.upsert({
      where: { id: 'test-tk-1' }, update: {},
      create: { tenantId: tenant.id, channelId: ch1.id, id: 'test-tk-1', status: 'todo', priority: 1, sentiment: 'neutral', assignedSeatId: null, subject: 'test', subjectOriginal: 'test', customerId: customer.id, slaDueAt: new Date() }
    });
    await prisma.ticket.upsert({
      where: { id: 'test-tk-2' }, update: {},
      create: { tenantId: tenant.id, channelId: ch2.id, id: 'test-tk-2', status: 'todo', priority: 1, sentiment: 'neutral', assignedSeatId: null, subject: 'test', subjectOriginal: 'test', customerId: customer.id, slaDueAt: new Date() }
    });
  }

  console.log(`Created rules mapping [${ch1.displayName}] to Agent 1, and [${ch2.displayName}] to Agent 2.`);

  console.log('\n--- Simulating Visibility ---');
  for (const userEmail of [agent1Email, agent2Email]) {
    const user = await prisma.user.findFirst({ where: { email: userEmail } });
    if (!user) continue;

    const vis = await resolveTicketVisibility(tenant.id, user.id);
    console.log(`\nUser: ${user.email} (Agent ${userEmail === agent1Email ? '1' : '2'})`);
    console.log(`  responsibleChannelIds: ${vis.responsibleChannelIds.join(', ')}`);
    
    const clause = ticketVisibilityWhereClause(vis);
    
    const countCh1 = await prisma.ticket.count({
      where: { tenantId: tenant.id, id: 'test-tk-1', ...(Object.keys(clause).length > 0 ? clause : {}) }
    });
    const countCh2 = await prisma.ticket.count({
      where: { tenantId: tenant.id, id: 'test-tk-2', ...(Object.keys(clause).length > 0 ? clause : {}) }
    });

    console.log(`  [Public tickets in ${ch1.displayName}]: ${countCh1 > 0 ? 'Can See ✅' : 'CANNOT SEE ❌'}`);
    console.log(`  [Public tickets in ${ch2.displayName}]: ${countCh2 > 0 ? 'Can See ✅' : 'CANNOT SEE ❌'}`);
  }

  console.log('\n--- Cleaning up ---');
  await prisma.ticket.deleteMany({ where: { id: { in: ['test-tk-1', 'test-tk-2'] } } });
  await prisma.agentSeat.deleteMany({ where: { id: { in: [seat1.id, seat2.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: ['test-user-1', 'test-user-2'] } } });
  await prisma.ticketRoutingRule.deleteMany({ where: { name: { startsWith: 'Test Rule' } } });
  console.log('Done.');
}
runTest().catch(console.error).finally(() => prisma.$disconnect());
