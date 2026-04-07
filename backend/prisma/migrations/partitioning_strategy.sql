-- Horizontal Partitioning Strategy for Message and LogisticsEvent
-- This SQL script demonstrates how to implement range partitioning by month in PostgreSQL.
-- Note: Prisma does not natively support partitioning in schema.prisma. 
-- These changes should be applied manually via a migration or as part of the initial table creation.

--------------------------------------------------------------------------------
-- 1. Message Table Partitioning
--------------------------------------------------------------------------------

-- Rename existing table (if it exists)
-- ALTER TABLE "Message" RENAME TO "Message_old";

-- Create partitioned table
-- CREATE TABLE "Message" (
--   "id" UUID NOT NULL,
--   "ticketId" UUID NOT NULL,
--   "senderId" TEXT NOT NULL,
--   "senderType" TEXT NOT NULL,
--   "content" TEXT NOT NULL,
--   "isInternal" BOOLEAN NOT NULL DEFAULT false,
--   "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
--   "translatedContent" TEXT,
--   "sentPlatformText" TEXT,
--   "deliveryTargets" TEXT[] DEFAULT ARRAY[]::TEXT[],
--   "motherMessageId" TEXT,
--   CONSTRAINT "Message_pkey" PRIMARY KEY ("id", "createdAt")
-- ) PARTITION BY RANGE ("createdAt");

-- Example: Create partitions for 2026
-- CREATE TABLE "Message_2026_04" PARTITION OF "Message" FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
-- CREATE TABLE "Message_2026_05" PARTITION OF "Message" FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
-- ... and so on.

-- Re-create indexes on the parent table
-- CREATE INDEX "Message_ticketId_idx" ON "Message" ("ticketId");
-- CREATE INDEX "Message_ticketId_createdAt_idx" ON "Message" ("ticketId", "createdAt");


--------------------------------------------------------------------------------
-- 2. LogisticsEvent Table Partitioning
--------------------------------------------------------------------------------

-- Rename existing table (if it exists)
-- ALTER TABLE "LogisticsEvent" RENAME TO "LogisticsEvent_old";

-- Create partitioned table
-- CREATE TABLE "LogisticsEvent" (
--   "id" UUID NOT NULL,
--   "orderId" UUID NOT NULL,
--   "status" TEXT NOT NULL,
--   "subStatus" TEXT NOT NULL DEFAULT '',
--   "description" TEXT NOT NULL,
--   "location" TEXT,
--   "timestamp" TIMESTAMP(3) NOT NULL,
--   "sortIndex" INTEGER NOT NULL DEFAULT 0,
--   CONSTRAINT "LogisticsEvent_pkey" PRIMARY KEY ("id", "timestamp")
-- ) PARTITION BY RANGE ("timestamp");

-- Example: Create partitions for 2026
-- CREATE TABLE "LogisticsEvent_2026_04" PARTITION OF "LogisticsEvent" FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
-- CREATE TABLE "LogisticsEvent_2026_05" PARTITION OF "LogisticsEvent" FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
-- ... and so on.

-- Re-create indexes on the parent table
-- CREATE INDEX "LogisticsEvent_orderId_idx" ON "LogisticsEvent" ("orderId");
