import { PrismaClient } from '@prisma/client';
import { syncOrdersFromMotherSystem } from '../src/services/motherSystemSync.js';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error("No tenant found!");
    return;
  }
  const token = "TESTYU60ltGTM9_1006755";
  
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);
  
  console.log(`Syncing orders since ${oneHourAgo.toISOString()}...`);
  const orders = await syncOrdersFromMotherSystem(tenant.id, token, oneHourAgo);
  console.log(`Successfully synced ${orders} orders.`);
}

main().finally(() => prisma.$disconnect());
