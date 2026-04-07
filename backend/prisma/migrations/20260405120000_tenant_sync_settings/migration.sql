-- CreateTable
CREATE TABLE "TenantSyncSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "messagePollIntervalSec" INTEGER NOT NULL DEFAULT 300,
    "orderPollIntervalSec" INTEGER NOT NULL DEFAULT 900,
    "incrementalSyncDays" INTEGER NOT NULL DEFAULT 14,
    "useSyncWatermark" BOOLEAN NOT NULL DEFAULT true,
    "messageSyncDisabledPlatformTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultNewShopOrderBackfillMode" TEXT NOT NULL DEFAULT 'recent_days',
    "defaultNewShopOrderBackfillFrom" TIMESTAMP(3),
    "defaultNewShopOrderBackfillRecentDays" INTEGER NOT NULL DEFAULT 90,
    "defaultNewShopTicketBackfillMode" TEXT NOT NULL DEFAULT 'recent_days',
    "defaultNewShopTicketBackfillFrom" TIMESTAMP(3),
    "defaultNewShopTicketBackfillRecentDays" INTEGER NOT NULL DEFAULT 90,
    "skipMockTickets" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantSyncSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantSyncSettings_tenantId_key" ON "TenantSyncSettings"("tenantId");

-- AddForeignKey
ALTER TABLE "TenantSyncSettings" ADD CONSTRAINT "TenantSyncSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Channel" ADD COLUMN "syncMessagesEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Channel" ADD COLUMN "syncOrdersEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Channel" ADD COLUMN "orderBackfillMode" TEXT;
ALTER TABLE "Channel" ADD COLUMN "orderBackfillFrom" TIMESTAMP(3);
ALTER TABLE "Channel" ADD COLUMN "orderBackfillRecentDays" INTEGER;
ALTER TABLE "Channel" ADD COLUMN "ticketBackfillMode" TEXT;
ALTER TABLE "Channel" ADD COLUMN "ticketBackfillFrom" TIMESTAMP(3);
ALTER TABLE "Channel" ADD COLUMN "ticketBackfillRecentDays" INTEGER;
ALTER TABLE "Channel" ADD COLUMN "initialBackfillCompletedAt" TIMESTAMP(3);
