import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.channel.findMany({
    select: {
      displayName: true,
      externalShopId: true,
      invoiceStoreEntity: true,
    },
    orderBy: { displayName: 'asc' },
  });

  for (const r of rows) {
    const inv = r.invoiceStoreEntity as Record<string, unknown> | null;
    const legal = inv && String(inv.legalName ?? '').trim();
    const vat = inv && String(inv.vatNumber ?? '').trim();
    const hasSubject = !!legal;
    const hasVat = !!vat;
    console.log(
      JSON.stringify({
        displayName: r.displayName,
        externalShopId: r.externalShopId,
        hasSubject,
        hasVat,
        legalName: legal || undefined,
        vatNumber: vat || undefined,
      })
    );
  }
}

main().finally(() => prisma.$disconnect());
