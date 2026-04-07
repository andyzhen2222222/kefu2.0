import { PrismaClient } from '@prisma/client';
import { 
  syncChannelsFromMotherSystem, 
  syncOrdersFromMotherSystem, 
  syncInvoiceEntitiesFromMotherSystem 
} from './src/services/motherSystemSync';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error("No tenant found!");
    return;
  }
  const token = "TESTYU60ltGTM9_1006755";
  console.log(`Starting sync for tenant ${tenant.id} with token ${token}...`);
  
  try {
    const channels = await syncChannelsFromMotherSystem(tenant.id, token);
    console.log(`Successfully synced ${channels} channels.`);
  } catch (e: any) {
    console.error("Error syncing channels:", e.message);
  }

  try {
    const invoices = await syncInvoiceEntitiesFromMotherSystem(tenant.id, token);
    console.log(`Successfully synced ${invoices.updated} invoice entities.`);
  } catch (e: any) {
    console.error("Error syncing invoice entities:", e.message);
  }

  try {
    const orders = await syncOrdersFromMotherSystem(tenant.id, token);
    console.log(`Successfully synced ${orders} orders.`);
  } catch (e: any) {
    console.error("Error syncing orders:", e.message);
  }
}

main().finally(() => prisma.$disconnect());