-- AlterTable
ALTER TABLE "Message" ADD COLUMN "motherMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Message_ticketId_motherMessageId_key" ON "Message"("ticketId", "motherMessageId");

-- CreateTable
CREATE TABLE "TenantSyncState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "lastWatermarkAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantSyncState_tenantId_scope_key" ON "TenantSyncState"("tenantId", "scope");

-- CreateIndex
CREATE INDEX "TenantSyncState_tenantId_idx" ON "TenantSyncState"("tenantId");

-- AddForeignKey
ALTER TABLE "TenantSyncState" ADD CONSTRAINT "TenantSyncState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
